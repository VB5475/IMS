// CWIPToFAForm.jsx — CWIP To Fixed Assets entry form (Add / Edit)
//
// Pattern mirrors PurchaseVoucherForm.jsx exactly:
//   1. fetchHeaderMeta  → RB_AstCWIP2FAMst → GET_DETAIL_COL_DATA (header column METADATA)
//   2. fetchDetailMeta  → RB_AstCWIP2FADet → GET_DETAIL_COL_DATA (grid column METADATA)
//   3. fetchGridColumns → GET_FILTER_DETAIL + buildGridColumns  (lazy, on first Add New)
//   4. syncedFilters useMemo merges static layout + API IsMandatory/IsLockOnEditMode flags
//
// C2F vs PV:
//   No SupplierID, BasedOnID
//   PutToUseInstDate — required second date field
//   LocationID       — cascade from Division (fetchLocations)
//   CWIPAccID        — fetched via C2F_CONFIG.SP_CWIP_ACC (direct SP, same pattern as Division)
//   ConvTypeID       — internal field, fixed to C2F_CONFIG.CONV_TYPE_ID, not rendered in UI
//   ConversionFactor — numeric textbox (ColSeqNo 7, between LocationID and CWIPAccID)
//   NetTotal         — computed client-side: sum of grid Amount column
//   Cascade: DivisionID → clear LocationID + grid; LocationID → clear grid

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
import { useCWIPToFA } from "../../hooks/useCWIPToFA";
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
import {
  buildGridColumns,
  isLockOnEditModeCol,
  isTruthyApiFlag,
  syncHeaderFilterWithApiCol,
} from "../../utils/gridUtils";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { queryEditableFilterFields, resolveEditLoadParams } from "../../utils/txnFormUtils";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { useTransactionFormReset } from "../../hooks/useTransactionFormReset";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  C2F_CONFIG,
  C2F_CONV_FACTOR_OPTIONS,
  C2F_SUMMARY_FIELDS,
  C2F_GRID_TABS,
  C2F_FILTER_CASCADE_RESETS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  formatC2FTranDate,
  getMissingItemPickerHeaderFields,
} from "./constants";
import "./CWIPToFAPage.css";

let _c2fTempId = -1;
const nextTempId = () => _c2fTempId--;

// ── Item picker column builder ─────────────────────────────────────────────────
// Used as fallback when RB metadata (RB_AstCWIP2FADetSelO) columns are empty
// or their ColName values don't match the actual SP response field names.
const PICKER_HIDDEN_COLS = new Set(["ItemID", "ItemTypeID", "ParentUKey", "ChildFKey", "BaseUnitID", "TranUnitID"]);
// Summary panel fields — exclude from header filter (already shown in footer EnterpriseSummaryPanel)
const C2F_SUMMARY_COL_NAMES = new Set(C2F_SUMMARY_FIELDS.map((f) => f.SummaryParameterID.toLowerCase()));
const PICKER_LABEL_MAP = {
  ItemTypeDesc: "Item Type",
  ItemCode:     "Item Code",
  ItemName:     "Item Name",
  BaseUnit:     "Base Unit",
  UnitConv:     "Unit Conv",
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
      id:           key,
      key,
      name:         toPickerLabel(key),
      label:        toPickerLabel(key),
      controlType:  1,
      filterable:   false,
      isEditAllow:  false,
      align:        "left",
    }));
  return [PICKER_CB_COL, ...dataCols];
}

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    tranno:           headerValues.tranno           ?? "",
    trandate:         headerValues.trandate          ?? "",
    puttouseinstdate: headerValues.puttouseinstdate  ?? "",
    divisionid:       String(headerValues.divisionid      ?? ""),
    locationid:       String(headerValues.locationid      ?? ""),
    cwipaccid:        String(headerValues.cwipaccid        ?? ""),
    costcenteraccid:  String(headerValues.costcenteraccid  ?? ""),
    convtypeid:       String(headerValues.convtypeid      ?? "1"),
    nettotal:         String(headerValues.nettotal         ?? "0"),
    remark:           headerValues.remark            ?? "",
  };
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

export default function CWIPToFAForm() {
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
  const { post: postSave }   = useApi(API_BASE_URL_IMS);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, locationOptions, cWIPAccOptions, costCenterOptions,
    fetchLocations, clearLocations,
    fetchCWIPAccByDivision, clearCWIPAccOptions,
    fetchCostCenters, clearCostCenterOptions,
    fetchUniqueId,
    columns, allColumns, eventColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fireCellEvent,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    clearSaveError,
  } = useCWIPToFA(API_BASE_URL);

  const [loadedMasterRow,     setLoadedMasterRow]     = useState(null);
  const [loadedFilterValues,  setLoadedFilterValues]  = useState(null);
  const [recordLoading,       setRecordLoading]       = useState(false);
  const [recordLoadError,     setRecordLoadError]     = useState(null);
  const editRecordLoadedRef = useRef(false);

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const headerValuesRef = useRef({
    tranno:            "",
    trandate:          todayISO,
    puttouseinstdate:  null,
    divisionid:        0,
    locationid:        0,
    conversionfactor:  0,
    cwipaccid:         0,
    costcenteraccid:   0,
    convtypeid:        C2F_CONFIG.CONV_TYPE_ID,
    nettotal:          0,
    remark:           "",
    tranmstgenid:     0,
    companyid:        DEFAULT_COMPANY_ID,
    yearid:           C2F_CONFIG.CONFIG_YEAR_ID,
    loginid:          DEFAULT_LOGIN_ID,
    idnumber:         recordId,
    funccode:         C2F_CONFIG.RB_MASTER,
  });

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { trandate: todayISO };
  }, [loadedFilterValues, todayISO]);

  const [filterResetKey,      setFilterResetKey]      = useState(0);
  const [activeTab,           setActiveTab]           = useState("items");
  const [itemSelectionCount,  setItemSelectionCount]  = useState(0);
  const [isGridLoading,       setIsGridLoading]       = useState(false);
  const [gridRows,            setGridRows]            = useState([]);
  const [isSaving,            setIsSaving]            = useState(false);

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
    if (isNewRoute) {
      const uid = await fetchUniqueId();
      headerValuesRef.current.tranmstgenid = uid;
    }
    setIsEditMode(true);
    setActiveTab("items");
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (!focusFirstEditableFilterField()) focusSelectItemButton();
      }, 80);
    });
  }, [isNewRoute, fetchUniqueId, focusFirstEditableFilterField, focusSelectItemButton]);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  usePageHeader({
    title:    isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then add items via the grid."
      : recordLoading
        ? "Loading record…"
        : recordLoadError
          ? recordLoadError
          : `C2F #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo:   "/cwip-to-fa",
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
      const params = resolveEditLoadParams(recordId, listRecord, {
        idFields: ["C2FID"],
        configYearId: C2F_CONFIG.CONFIG_YEAR_ID,
      });
      const { master, headerValues, details } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("CWIP To FA record not found.");

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
      console.error("[C2F] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load CWIP To FA record.");
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
    fetchUnlockedHeaderDropdowns(hv.divisionid ?? loadedMasterRow?.divisionid ?? 0, hv.trandate);
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

  // ── syncedSummaryFields — labels from API headerColumns, structure from C2F_SUMMARY_FIELDS ──
  const syncedSummaryFields = useMemo(() => {
    const colMap = {};
    headerColumns.forEach((col) => { colMap[col.colname] = col; });
    return C2F_SUMMARY_FIELDS.map((f) => ({
      ...f,
      mstKey: f.SummaryParameterID,
      label:  colMap[f.SummaryParameterID]?.displayname ?? f.SummaryParameterID,
    }));
  }, [headerColumns]);

  // ── syncedFilters — built purely from API headerColumns ───────────────────
  // ColCtrlType from RB_AstCWIP2FAMst drives control rendering directly.
  // Only ConversionFactor gets static options injected — all other dropdowns
  // (Division, Location, CWIP A/C, Cost Center) get live API-loaded options.
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    divisionid:      divisionOptions,
    locationid:      locationOptions,
    cwipaccid:       cWIPAccOptions,
    costcenteraccid: costCenterOptions,
    conversionfactor: C2F_CONV_FACTOR_OPTIONS,
  }), [divisionOptions, locationOptions, cWIPAccOptions, costCenterOptions]);

  const syncedFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];

    return headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible) && !C2F_SUMMARY_COL_NAMES.has(col.colname))
      .map((col) => {
        const lockOnEditMode  = isLockOnEditModeCol(col);
        const staticOptions   = DROPDOWN_OPTIONS_BY_COL[col.colname];

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
      if (!isEditMode)                             tone = "view";
      else if (isEditRoute && f.lockOnEditMode)    tone = "frozen";
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
        headerValuesRef.current.locationid      = 0;
        headerValuesRef.current.cwipaccid       = 0;
        headerValuesRef.current.costcenteraccid = 0;
        clearLocations();
        clearCWIPAccOptions();
        clearCostCenterOptions();
        itemGridRef.current?.clearRows?.();
        if (val && val !== "0") {
          await Promise.all([
            fetchLocations(val),
            fetchCWIPAccByDivision(val),
            fetchCostCenters(val, headerValuesRef.current.trandate),
          ]);
          requestAnimationFrame(() =>
            filterPanelRef.current
              ?.querySelector("#efq-locationid .search-select__trigger")
              ?.focus()
          );
        }
      });
      return;
    }

    if (colName === "trandate") {
      const divId = headerValuesRef.current.divisionid;
      if (divId && divId !== 0 && divId !== "0") {
        clearCostCenterOptions();
        fetchCostCenters(divId, val);
      }
      return;
    }

    if (colName === "locationid") {
      requestGridClear("Location", () => {
        itemGridRef.current?.clearRows?.();
      });
      return;
    }

  }, [
    requestGridClear,
    clearLocations, fetchLocations,
    clearCWIPAccOptions, fetchCWIPAccByDivision,
    clearCostCenterOptions, fetchCostCenters,
  ]);

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

  // ── Cell event — server-driven via SP_GRID_EVENT (none configured for CWIP today) ──
  const handleCellEvent = useCallback(async ({ rowId, colKey, rowData }) => {
    if (!C2F_CONFIG.SP_GRID_EVENT) return;
    const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
    if (!result || !itemGridRef.current) return;
    const responseRow = result?.[0];
    if (!responseRow) return;
    const errCode = responseRow.errcode;
    if (errCode !== 1 && errCode !== 1.0) {
      console.warn("[C2F] Cell-event error:", responseRow.errmsg ?? `ErrCode ${errCode}`);
      return;
    }
    const { errcode, errmsg, ...updatedFields } = responseRow;
    itemGridRef.current.updateRow?.(rowId, updatedFields);
  }, [fireCellEvent]);

  // ── Select Item ────────────────────────────────────────────────────────────
  const handleSelectItem = useCallback(async () => {
    const headerValues    = headerValuesRef.current;
    const missingFields   = getMissingItemPickerHeaderFields(headerValues);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }

    const { divisionid, locationid, cwipaccid, trandate, puttouseinstdate } = headerValues;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: C2F_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: C2F_CONFIG.RB_ITEM_PICKER }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      // Fetch RB columns + item rows in parallel
      const [colRes, rowRes] = await Promise.all([
        getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
          prmMasterID: rbRow.rbid,
          prmLoginID:  DEFAULT_LOGIN_ID,
        }),
        getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: C2F_CONFIG.SP_ITEM_PICKER,
          JSon: JSON.stringify([{
            prmdivisionid:   Number(divisionid  ?? 0),
            prmlocationid:   Number(locationid  ?? 0),
            prmcwipacid:     Number(cwipaccid   ?? 0),
            prmyearid:       C2F_CONFIG.CONFIG_YEAR_ID,
            prmloginid:      DEFAULT_LOGIN_ID,
            prmtrandate:     formatC2FTranDate(trandate),
            prmputtousedate: formatC2FTranDate(puttouseinstdate),
            prmconvtypeid:   C2F_CONFIG.CONV_TYPE_ID,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }),
      ]);

      const rows = rowRes || [];

      // Build columns from RB metadata; fall back to data-driven if RB has no columns
      // (RB_AstCWIP2FADetSelO may not be fully configured yet) or its ColName values
      // don't match the actual SP response field names.
      const rbLinks = colRes || [];
      const rbDataKeys = new Set(rbLinks.map((c) => c.colname));
      const dataKeys   = rows.length > 0 ? Object.keys(rows[0]) : [];
      const rbMatchesData = rbLinks.length > 0 && dataKeys.some((k) => rbDataKeys.has(k));

      const cols = rbMatchesData
        ? buildGridColumns(rbLinks, {}, { filterable: false, allEditable: false })
        : buildPickerColumnsFromData(rows[0] ?? null);

      setItemModalColumns(cols);
      setItemModalItems(rows);
    } catch (err) {
      console.error("[C2F] Item picker fetch failed:", err);
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
  const buildDefaultHeaderValues = useCallback(() => ({
    tranno: "", trandate: todayISO, puttouseinstdate: null,
    divisionid: 0, locationid: 0, conversionfactor: 0,
    cwipaccid: 0, costcenteraccid: 0,
    convtypeid: C2F_CONFIG.CONV_TYPE_ID, nettotal: 0, remark: "",
    tranmstgenid: 0,
    companyid: DEFAULT_COMPANY_ID, yearid: C2F_CONFIG.CONFIG_YEAR_ID,
    loginid: DEFAULT_LOGIN_ID, idnumber: 0, funccode: C2F_CONFIG.RB_MASTER,
  }), [todayISO]);

  const clearC2fStorage = useCallback(() => {
    sessionStorage.removeItem(C2F_CONFIG.STORAGE_HEADER_META);
    sessionStorage.removeItem(C2F_CONFIG.STORAGE_ENTRY_META);
  }, []);

  const { resetFormToInitialState, discardChanges } = useTransactionFormReset({
    storageKeys: [C2F_CONFIG.STORAGE_HEADER_META, C2F_CONFIG.STORAGE_ENTRY_META],
    buildDefaultHeaderValues,
    headerValuesRef,
    queuedRowsRef,
    gridColumnsLoadedRef,
    itemGridRef,
    editRecordLoadedRef,
    isEditRoute,
    loadEditRecord,
    exitEditMode,
    clearSaveError,
    setActiveTab,
    setIsGridLoading,
    setItemSelectionCount,
    setItemModalOpen,
    setItemModalItems,
    setItemModalColumns,
    setItemModalLoading,
    setItemModalError,
    setFilterResetKey,
    setLoadedFilterValues,
    setGridRows,
    extraClearFns: [clearLocations, clearCWIPAccOptions, clearCostCenterOptions, clearC2fStorage],
  });

  const completeSuccessfulSave = useCallback(() => {
    if (isEditRoute) navigate("/cwip-to-fa");
    else resetFormToInitialState();
  }, [isEditRoute, navigate, resetFormToInitialState]);

  const handleSave = useCallback(async ({ skipPostSave = false } = {}) => {
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrors = validateApiColumns(headerValuesRef.current, headerColsToValidate);

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
      buildSaveJsonFields({ label: "C2F", mst: mstRow, det: detRows }),
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(C2F_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
      if (!skipPostSave) completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[C2F Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [headerColumns, allColumns, columns, isEditRoute, completeSuccessfulSave]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave({ skipPostSave: true });
    if (!saved) return;
    window.print();
    completeSuccessfulSave();
  }, [handleSave, completeSuccessfulSave]);

  const [discardOpen,   setDiscardOpen]   = useState(false);
  const [clearRowsOpen, setClearRowsOpen] = useState(false);
  const [clearRowsLabel, setClearRowsLabel] = useState("");
  const pendingClearActionRef = useRef(null);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    discardChanges();
  }, [discardChanges]);

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
    blocked:       itemModalOpen,
    isEditMode,
    isSaving,
    addDisabled:   filterBusy,
    onAdd:         enterEditModeWithFocus,
    onSave:        handleSave,
    onSavePrint:   handleSaveAndPrint,
    onCancel:      handleCancel,
    onSelectList:  handleSelectListShortcut,
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
    <div className="workspace-page c2f-page">
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
            title="CWIP To FA Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={C2F_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            isSearching={filterBusy || recordLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterBusy || !headerMetaReady}
            fieldTones={filterFieldTones}
            onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
          />
        )}
      </section>

      {/* ── Single-tab grid section ──────────────────────────────────────────── */}
      <section className="c2f-grid-section">
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {C2F_GRID_TABS.map((t) => (
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
              title="Pick CWIP items (Tab here after header fields)"
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

        <div className={`c2f-tab-pane${activeTab === "items" ? " c2f-tab-pane--active" : ""}`}>
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
