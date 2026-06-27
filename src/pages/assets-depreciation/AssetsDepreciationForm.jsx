// AssetsDepreciationForm.jsx — Assets Depreciation entry form (Add / Edit)
//
// Pattern mirrors CWIPToFAForm.jsx exactly:
//   1. fetchHeaderMeta  → RB_AstDepCAMst → GET_DETAIL_COL_DATA (header column METADATA — dynamic)
//   2. fetchDetailMeta  → RB_AstDepCADet → GET_DETAIL_COL_DATA (grid column METADATA — dynamic)
//   3. fetchGridColumns → GET_FILTER_DETAIL + buildGridColumns  (lazy, on first Add New)
//   4. syncedFilters useMemo merges static layout + API IsMandatory/IsLockOnEditMode flags
//
// DPC vs C2F:
//   No PutToUseInstDate, LocationID, CostCenterAccID, ConversionFactor, ConvTypeID
//   FixedAstAcID — cascades from DivisionID (fetchAssetsAccByDivision)
//   TotalDepAmount — computed client-side: sum of grid Amount column
//   Cascade: DivisionID → clear FixedAstAcID + grid
//   Cascade: FixedAstAcID → clear grid

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EnterpriseSummaryPanel from "../../components/filters/EnterpriseSummaryPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import { useAstDepCA } from "../../hooks/useAstDepCA";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
  getColDefault,
  OBJ_TYPE,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import {
  buildGridColumns,
  isLockOnEditModeCol,
  isTruthyApiFlag,
  syncHeaderFilterWithApiCol,
} from "../../utils/gridUtils";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  DPC_CONFIG,
  DPC_SUMMARY_FIELDS,
  DPC_GRID_TABS,
  DPC_FILTER_CASCADE_RESETS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  getMissingItemPickerHeaderFields,
} from "./constants";
import "./AssetsDepreciationPage.css";

let _dpcTempId = -1;
const nextTempId = () => _dpcTempId--;

// ── Item picker column builder (fallback when RB metadata columns are empty) ──
const PICKER_HIDDEN_COLS = new Set(["ItemID", "ItemTypeID", "ParentUKey", "ChildFKey", "BaseUnitID", "TranUnitID"]);
// Summary panel fields — exclude from header filter (already shown in footer EnterpriseSummaryPanel)
const DPC_SUMMARY_COL_NAMES = new Set(DPC_SUMMARY_FIELDS.map((f) => f.SummaryParameterID.toLowerCase()));
const PICKER_LABEL_MAP = {
  ItemTypeDesc: "Item Type",
  ItemCode:     "Item Code",
  ItemName:     "Item Name",
  BaseUnit:     "Base Unit",
  TranUnit:     "Tran Unit",
  BaseQty:      "Base Qty",
  TranQty:      "Tran Qty",
  BaseRate:     "Base Rate",
  TranRate:     "Tran Rate",
  BaseAmount:   "Base Amount",
  TranAmount:   "Tran Amount",
};
function toPickerLabel(key) {
  return PICKER_LABEL_MAP[key] ?? key.replace(/([A-Z])/g, " $1").trim();
}
const PICKER_CB_COL = {
  id: "cb", name: "", key: "cb", controlType: -1,
  width: 48, filterable: false, isFixed: true, isEditAllow: false,
};

function buildPickerColumnsFromData(firstRow) {
  if (!firstRow) return [];
  const dataCols = Object.keys(firstRow)
    .filter((k) => !PICKER_HIDDEN_COLS.has(k))
    .map((key) => ({
      id: key, key, name: toPickerLabel(key), label: toPickerLabel(key),
      controlType: 1, filterable: false, isEditAllow: false, align: "left",
    }));
  return [PICKER_CB_COL, ...dataCols];
}

function resolveEditLoadParams(recordId, listRecord) {
  const session = getUserSession();
  return {
    companyId: listRecord?.companyid  ?? session.companyId ?? DEFAULT_COMPANY_ID,
    yearId:    listRecord?.yearid     ?? session.yearId    ?? DPC_CONFIG.CONFIG_YEAR_ID,
    loginId:   listRecord?.loginid    ?? session.loginId,
    sessionId: listRecord?.sessionid  ?? listRecord?.SessionId ?? DEFAULT_SESSION_ID,
    idNumber:  listRecord?.astdepid   ?? listRecord?.idnumber  ?? recordId,
  };
}

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    trancode:       headerValues.trancode       ?? "",
    trandate:       headerValues.trandate        ?? "",
    divisionid:     String(headerValues.divisionid   ?? ""),
    fixedastacid:   String(headerValues.fixedastacid ?? ""),
    totaldepamount: String(headerValues.totaldepamount ?? "0"),
    remarks:        headerValues.remarks         ?? "",
    funccode:       headerValues.funccode        ?? "",
  };
}

function queryEditableFilterFields(panel) {
  if (!panel) return [];
  return [
    ...panel.querySelectorAll(
      "input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), .search-select__trigger:not([disabled])"
    ),
  ].filter((el) => el.offsetParent !== null);
}

function mapPickerToItemRow(item, allColumns) {
  const row = { id: nextTempId() };
  allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
  Object.entries(item).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (lk !== "id" && v != null && Object.prototype.hasOwnProperty.call(row, lk)) row[lk] = v;
  });
  return row;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AssetsDepreciationForm() {
  const { id: routeId } = useParams();
  const location    = useLocation();
  const isNewRoute  = location.pathname.endsWith("/new") || routeId === "new";
  const recordId    = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord  = location.state?.record ?? null;
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);
  const navigate    = useNavigate();

  const itemGridRef          = useRef(null);
  const summaryRef           = useRef(null);
  const filterPanelRef       = useRef(null);
  const selectItemBtnRef     = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef        = useRef([]);
  const { get: getLive }     = useApi(API_BASE_URL);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, assetsAccOptions,
    fetchAssetsAccByDivision, clearAssetsAccOptions,
    columns, allColumns, eventColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    clearSaveError,
  } = useAstDepCA(API_BASE_URL);

  const [loadedMasterRow,    setLoadedMasterRow]    = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading,      setRecordLoading]      = useState(false);
  const [recordLoadError,    setRecordLoadError]    = useState(null);
  const editRecordLoadedRef = useRef(false);

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }, []);

  const headerValuesRef = useRef({
    trancode:       "",
    trandate:       todayISO,
    divisionid:     0,
    fixedastacid:   0,
    totaldepamount: 0,
    remarks:        "",
    funccode:       DPC_CONFIG.RB_MASTER,
    tranmstgenid:   0,
    companyid:      DEFAULT_COMPANY_ID,
    yearid:         DPC_CONFIG.CONFIG_YEAR_ID,
    loginid:        DEFAULT_LOGIN_ID,
    idnumber:       recordId,
  });

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { trandate: todayISO };
  }, [loadedFilterValues, todayISO]);

  const [filterResetKey,     setFilterResetKey]     = useState(0);
  const [activeTab,          setActiveTab]          = useState("items");
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [isGridLoading,      setIsGridLoading]      = useState(false);
  const [gridRows,           setGridRows]           = useState([]);
  const [isSaving,           setIsSaving]           = useState(false);

  const [itemModalOpen,    setItemModalOpen]    = useState(false);
  const [itemModalItems,   setItemModalItems]   = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError,   setItemModalError]   = useState(null);

  const [isEditMode, setIsEditMode] = useState(false);

  const focusFirstEditableFilterField = useCallback(() => {
    const fields = queryEditableFilterFields(filterPanelRef.current);
    if (fields.length === 0) return false;
    fields[0].focus();
    return true;
  }, []);

  const focusSelectItemButton = useCallback(() => {
    setActiveTab("items");
    selectItemBtnRef.current?.focus();
  }, []);

  const enterEditModeWithFocus = useCallback(async () => {
    setIsEditMode(true);
    setActiveTab("items");
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (!focusFirstEditableFilterField()) focusSelectItemButton();
      }, 80);
    });
  }, [focusFirstEditableFilterField, focusSelectItemButton]);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  usePageHeader({
    title:    isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then add items via the grid."
      : recordLoading
        ? "Loading record…"
        : recordLoadError
          ? recordLoadError
          : `Depreciation #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo:   "/assets-depreciation",
  });

  // ── Mount: load metadata ───────────────────────────────────────────────────
  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta, isEditRoute]);

  // Eager grid column load for new records (once detail meta is ready)
  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(headerValuesRef.current?.divisionid ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns, fetchGridColumns, isEditRoute]);

  // Flush any queued rows once grid columns are built
  useEffect(() => {
    if (columns.length > 0 && itemGridRef.current && queuedRowsRef.current.length > 0) {
      if (itemGridRef.current.loadRows) {
        itemGridRef.current.loadRows(queuedRowsRef.current);
      } else {
        queuedRowsRef.current.forEach((r) => itemGridRef.current.addRow(r));
      }
      queuedRowsRef.current = [];
    }
  }, [columns]);

  // ── Edit flow: load existing record ───────────────────────────────────────
  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const params = resolveEditLoadParams(recordId, listRecord);
      const { master, headerValues, details } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("Assets Depreciation record not found.");

      headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      seedOptionsFromMaster(master);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      const activeCols = await fetchGridColumns(headerValues.divisionid ?? 0, {
        existingRecordEdit: true,
        masterRow: master,
        fetchUnlockedDropdowns: false,
      });
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;

      if (itemGridRef.current?.loadRows) {
        itemGridRef.current.loadRows(details);
      } else {
        queuedRowsRef.current = details;
      }
    } catch (err) {
      console.error("[DPC] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load Assets Depreciation record.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, listRecord, fetchEditRecord, seedOptionsFromMaster, fetchGridColumns]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || allColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, allColumns.length, loadEditRecord]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode || !loadedMasterRow) return;
    const hv = headerValuesRef.current;
    fetchUnlockedHeaderDropdowns(hv.divisionid ?? loadedMasterRow?.divisionid ?? 0);
    fetchGridColumns(hv.divisionid ?? loadedMasterRow?.divisionid ?? 0, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
  }, [isEditRoute, isEditMode, loadedMasterRow, fetchUnlockedHeaderDropdowns, fetchGridColumns]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  // ── syncedSummaryFields — labels from API headerColumns ───────────────────
  const syncedSummaryFields = useMemo(() => {
    const colMap = {};
    headerColumns.forEach((col) => { colMap[col.colname] = col; });
    return DPC_SUMMARY_FIELDS.map((f) => ({
      ...f,
      mstKey: f.SummaryParameterID,
      label:  colMap[f.SummaryParameterID]?.displayname ?? f.SummaryParameterID,
    }));
  }, [headerColumns]);

  // ── syncedFilters — built purely from API headerColumns (fully dynamic) ────
  // ColCtrlType from RB_AstDepCAMst drives control rendering directly.
  // Only Division + FixedAstAcID get API-loaded options injected by ColName.
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    divisionid:   divisionOptions,
    fixedastacid: assetsAccOptions,
  }), [divisionOptions, assetsAccOptions]);

  const syncedFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];
    return headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible) && !DPC_SUMMARY_COL_NAMES.has(col.colname))
      .map((col) => {
        const lockOnEditMode = isLockOnEditModeCol(col);
        const staticOptions  = DROPDOWN_OPTIONS_BY_COL[col.colname];
        const base = {
          FilterParameterID: col.colname,
          FilterColName:     col.colname,
          FilterCaption:     col.displayname ?? col.colname,
          FilterColCtrlType: col.colctrltype ?? 0,
          ...(staticOptions ? { staticOptions } : {}),
        };
        return syncHeaderFilterWithApiCol(base, col, { lockOnEditMode });
      });
  }, [headerColumns, DROPDOWN_OPTIONS_BY_COL]);

  const filterFieldTones = useMemo(() => {
    const tones = {};
    syncedFilters.forEach((f) => {
      let tone = "editable";
      if (!isEditMode)                          tone = "view";
      else if (isEditRoute && f.lockOnEditMode) tone = "frozen";
      tones[f.FilterColName]       = tone;
      if (f.FilterParameterID) tones[f.FilterParameterID] = tone;
    });
    return tones;
  }, [syncedFilters, isEditMode, isEditRoute]);

  // ── Filter change / cascade ────────────────────────────────────────────────
  const requestGridClear = useCallback((fieldLabel, action) => {
    const rows = itemGridRef.current?.getRows?.() ?? [];
    if (rows.length === 0) { action(); return; }
    pendingClearActionRef.current = action;
    setClearRowsLabel(fieldLabel);
    setClearRowsOpen(true);
  }, []);

  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

    if (colName === "divisionid") {
      requestGridClear("Division", async () => {
        headerValuesRef.current.fixedastacid = 0;
        clearAssetsAccOptions();
        itemGridRef.current?.clearRows?.();
        if (val && val !== "0") {
          await fetchAssetsAccByDivision(val);
          requestAnimationFrame(() =>
            filterPanelRef.current
              ?.querySelector("#efq-fixedastacid .search-select__trigger")
              ?.focus()
          );
        }
      });
      return;
    }

    if (colName === "fixedastacid") {
      requestGridClear("Fixed Asset A/C", () => {
        itemGridRef.current?.clearRows?.();
      });
      return;
    }
  }, [requestGridClear, clearAssetsAccOptions, fetchAssetsAccByDivision]);

  const ensureItemColumns = useCallback(async () => {
    if (gridColumnsLoadedRef.current && columns.length > 0) return columns;
    if (allColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const activeCols = await fetchGridColumns(headerValuesRef.current?.divisionid ?? 0);
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [columns, allColumns, fetchGridColumns]);

  // ── Cell event — Amount = Qty × Rate (client-side; no SP_GRID_EVENT in MRD) ──
  const handleCellEvent = useCallback(({ rowId, colKey, rowData }) => {
    if (colKey === "Qty" || colKey === "Rate") {
      const qty  = Number(rowData.Qty)  || 0;
      const rate = Number(rowData.Rate) || 0;
      itemGridRef.current?.updateRow?.(rowId, { Amount: qty * rate });
    }
  }, []);

  // ── Select Item ────────────────────────────────────────────────────────────
  const handleSelectItem = useCallback(async () => {
    const headerValues  = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }

    const { divisionid, fixedastacid, trandate } = headerValues;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: DPC_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: DPC_CONFIG.RB_ITEM_PICKER }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const [colRes, rowRes] = await Promise.all([
        getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
          prmMasterID: rbRow.rbid,
          prmLoginID:  DEFAULT_LOGIN_ID,
        }),
        getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: DPC_CONFIG.SP_ITEM_PICKER,
          JSon: JSON.stringify([{
            prmTranDate:    trandate ?? "",
            prmDivisionID:  Number(divisionid   ?? 0),
            prmCompanyID:   DEFAULT_COMPANY_ID,
            prmYearID:      DPC_CONFIG.CONFIG_YEAR_ID,
            prmMLNNotIN:    "",
            prmGroupID:     0,
            prmAccountID:   Number(fixedastacid ?? 0),
            prmDepType:     "",
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }),
      ]);

      const rows    = rowRes || [];
      const rbLinks = colRes || [];
      const rbDataKeys  = new Set(rbLinks.map((c) => c.colname));
      const dataKeys    = rows.length > 0 ? Object.keys(rows[0]) : [];
      const rbMatchesData = rbLinks.length > 0 && dataKeys.some((k) => rbDataKeys.has(k));

      const cols = rbMatchesData
        ? buildGridColumns(rbLinks, {}, { filterable: false, allEditable: false })
        : buildPickerColumnsFromData(rows[0] ?? null);

      setItemModalColumns(cols);
      setItemModalItems(rows);
    } catch (err) {
      console.error("[DPC] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive]);

  const handleInsertItems = useCallback(async (selectedItems) => {
    if (!selectedItems?.length) return;
    setActiveTab("items");
    const activeCols = await ensureItemColumns();
    if (!activeCols?.length) return;
    selectedItems.forEach((item) => addItemRow(mapPickerToItemRow(item, allColumns)));
  }, [ensureItemColumns, allColumns, addItemRow]);

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "items") handleSelectItem();
  }, [activeTab, handleSelectItem]);

  // ── Delete selected rows ───────────────────────────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    if (!itemGridRef.current) return;
    const selected = itemGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrors  = validateApiColumns(headerValuesRef.current, headerColsToValidate);
    const detailRows    = itemGridRef.current?.getRows?.() ?? [];
    const detailErrors  = validateGridRows(detailRows, columns);

    const allErrors = [...headerErrors, ...detailErrors];
    if (allErrors.length > 0) {
      setFormErrors(allErrors);
      return false;
    }

    const mstRow = {};
    headerColumns.forEach((col) => { mstRow[col.colname] = getColDefault(col.coldatatype); });
    const hv = headerValuesRef.current;
    Object.entries(hv).forEach(([k, v]) => { if (k !== "id") mstRow[k] = v; });
    Object.assign(mstRow, summaryRef.current?.getSummary?.() ?? {});
    mstRow.loginid = DEFAULT_LOGIN_ID;

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) => {
      const row = {};
      allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
      return { ...row, ...rest, loginid: DEFAULT_LOGIN_ID };
    });

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: DPC_CONFIG.FORM_TAG, mst: mstRow, det: detRows }),
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const res    = await fetch(`${API_BASE_URL_IMS}${DPC_CONFIG.SAVE_ENDPOINT}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
      return true;
    } catch (err) {
      console.error("[DPC Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [headerColumns, allColumns, columns, isEditRoute]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave();
    if (!saved) return;
    window.print();
  }, [handleSave]);

  const [discardOpen,    setDiscardOpen]    = useState(false);
  const [clearRowsOpen,  setClearRowsOpen]  = useState(false);
  const [clearRowsLabel, setClearRowsLabel] = useState("");
  const pendingClearActionRef = useRef(null);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);

    localStorage.removeItem(DPC_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(DPC_CONFIG.STORAGE_ENTRY_META);
    sessionStorage.removeItem(DPC_CONFIG.STORAGE_HEADER_META);
    sessionStorage.removeItem(DPC_CONFIG.STORAGE_ENTRY_META);

    clearAssetsAccOptions();

    headerValuesRef.current = {
      trancode: "", trandate: todayISO,
      divisionid: 0, fixedastacid: 0,
      totaldepamount: 0, remarks: "",
      funccode: DPC_CONFIG.RB_MASTER, tranmstgenid: 0,
      companyid: DEFAULT_COMPANY_ID, yearid: DPC_CONFIG.CONFIG_YEAR_ID,
      loginid: DEFAULT_LOGIN_ID, idnumber: 0,
    };

    queuedRowsRef.current        = [];
    gridColumnsLoadedRef.current = false;
    clearSaveError();
    setActiveTab("items");
    setIsGridLoading(false);
    setGridRows([]);
    setItemSelectionCount(0);
    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);
    itemGridRef.current?.clearRows?.();
    setFilterResetKey((k) => k + 1);
    exitEditMode();
  }, [clearAssetsAccOptions, clearSaveError, exitEditMode, todayISO]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  const handleClearRowsConfirm = useCallback(() => {
    setClearRowsOpen(false);
    const fn = pendingClearActionRef.current;
    pendingClearActionRef.current = null;
    fn?.();
  }, []);

  const handleClearRowsCancel = useCallback(() => {
    setClearRowsOpen(false);
    pendingClearActionRef.current = null;
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy      = headerFetching;

  useEntryFormKeyboard({
    blocked:      itemModalOpen,
    isEditMode,
    isSaving,
    addDisabled:  filterBusy,
    onAdd:        enterEditModeWithFocus,
    onSave:       handleSave,
    onSavePrint:  handleSaveAndPrint,
    onCancel:     handleCancel,
    onSelectList: handleSelectListShortcut,
  });

  const extraButtons = useMemo(() => [
    {
      key: "saveprint", label: "Save & Print", Icon: Printer, variant: "print",
      onClick: handleSaveAndPrint, disabled: isSaving,
      title: FORM_SHORTCUT_TITLES.savePrint,
    },
    {
      key: "save", label: isSaving ? "Saving…" : "Save", Icon: Save, variant: "save",
      onClick: handleSave, disabled: isSaving, loading: isSaving,
      accessKey: "s", title: FORM_SHORTCUT_TITLES.save,
    },
  ], [handleSaveAndPrint, handleSave, isSaving]);

  const itemGridConfig = { columns, pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] } };
  const combinedError  = metaError || headerError;

  return (
    <div className="workspace-page dpc-page">
      <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
      <ConfirmDialog
        isOpen={discardOpen}
        message="Discard changes and reset the form?"
        onConfirm={handleDiscardConfirm}
        onCancel={() => setDiscardOpen(false)}
      />
      <ConfirmDialog
        isOpen={clearRowsOpen}
        type="warning"
        message={`Changing ${clearRowsLabel} will clear all item rows. Proceed?`}
        confirmLabel="Continue"
        cancelLabel="Cancel"
        onConfirm={handleClearRowsConfirm}
        onCancel={handleClearRowsCancel}
      />

      <section className="workspace-page__filters">
        {combinedError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{combinedError}</span>
            <button type="button" onClick={() => { fetchHeaderMeta(); fetchDetailMeta(); }}>Retry</button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            panelRef={filterPanelRef}
            title="Assets Depreciation Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={DPC_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            isSearching={filterBusy || recordLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterBusy || !headerMetaReady}
            fieldTones={filterFieldTones}
            onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
          />
        )}
      </section>

      {/* ── Item grid section ──────────────────────────────────────────────── */}
      <section className="dpc-grid-section">
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {DPC_GRID_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`grid-tab ${activeTab === t.id ? "grid-tab--active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid-tabbar__controls">
            <button
              ref={selectItemBtnRef}
              type="button"
              className="eg-tab-btn"
              onClick={handleSelectItem}
              disabled={!isEditMode}
              title="Pick depreciation items (Tab here after header fields)"
            >
              <Package size={12} strokeWidth={2.5} />
              Select Item
            </button>

            <button
              type="button"
              className="eg-tab-btn eg-tab-btn--danger"
              onClick={handleDeleteSelected}
              disabled={!isEditMode || itemSelectionCount === 0}
              title="Delete selected rows"
            >
              <Trash2 size={12} strokeWidth={2} />
              Delete
            </button>
          </div>
        </div>

        <div className={`dpc-tab-pane${activeTab === "items" ? " dpc-tab-pane--active" : ""}`}>
          <EntryGrid
            ref={itemGridRef}
            config={itemGridConfig}
            title=""
            hideBottomPanel
            emptyMessage="No items yet. Click Select Item above."
            onSelectionChange={setItemSelectionCount}
            onRowsChange={setGridRows}
            onCellEvent={handleCellEvent}
            eventColumns={eventColumns}
            readOnly={isEditRoute && !isEditMode}
            existingRecordEdit={isEditRoute && isEditMode}
          />
        </div>
      </section>

      <EnterpriseSummaryPanel
        ref={summaryRef}
        fields={syncedSummaryFields}
        rows={gridRows}
      />

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        onCancel={handleCancel}
        addLabel={isEditRoute ? "Edit" : "Add"}
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={extraButtons}
      />

      <Suspense fallback={null}>
        <OrderItemModal
          isOpen={itemModalOpen}
          onClose={() => setItemModalOpen(false)}
          items={itemModalItems}
          columns={itemModalColumns}
          isLoading={itemModalLoading}
          error={itemModalError}
          onInsert={handleInsertItems}
        />
      </Suspense>
    </div>
  );
}
