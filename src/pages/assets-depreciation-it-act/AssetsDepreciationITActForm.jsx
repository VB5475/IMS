// AssetsDepreciationITActForm.jsx — Calculate Depreciation IT Act entry form (Add / Edit)
//
// Modeled directly on AssetsDepreciationForm.jsx (src/pages/assets-depreciation/),
// the closest existing precedent — same header shape (Division → Fixed
// Account cascade via fn_tbl_fetch_assetsaccount), same item-picker RB
// popup pattern. Differences from that template, both MRD-driven:
//
//   - Item Grid toolbar has BOTH "Add New" (blank row, Transporter Master's
//     handleAddDetailRow pattern) AND "Select Item" (picker popup) — this
//     MRD's screen notes explicitly list both buttons, unlike the sibling
//     module which only offers the picker.
//   - Total Dep Amount (totaldepamount) is a plain required/editable header
//     field here (MRD: ReadOnly=No), not a read-only EnterpriseSummaryPanel-
//     computed sum like the sibling module's TotalDepAmount — so this form
//     has no EnterpriseSummaryPanel/summary-fields wiring at all; the field
//     renders through the same fully-dynamic RB header list as Remarks.
//   - Item grid Amount = Qty × Rate is computed client-side via EntryGrid's
//     onCellEvent (see DIT_EVENT_COLUMNS in ./constants.js) — the same
//     Qty/Rate/Amount pattern already used by AssetsWriteOffForm.jsx and
//     several other Assets modules, using the shared usePendingCellEventFlush
//     hook so Save awaits any in-flight recalculation first.
//
// See ./constants.js for the full list of MRD gaps/decisions this form
// proceeds on (module-code collision with the sibling module, SP_LIST params,
// storage-key rename, etc.) — all flagged CONFIRM, not silently guessed past.

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import { useAstDepIT } from "../../hooks/useAstDepIT";
import { useApi } from "../../api/useApi";
import { getUserSession } from "../../session/userSession";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  getColDefault,
  buildSaveRowFromColumns,
  OBJ_TYPE,
} from "../../api/constants";
import {
  buildGridColumns,
  isLockOnEditModeCol,
  isTruthyApiFlag,
  syncHeaderFilterWithApiCol,
} from "../../utils/gridUtils";
import { validateApiColumnsByField, validateGridRowsDetailed } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { focusFieldAfterCascade } from "../../utils/focusUtils";
import { queryEditableFilterFields, resolveEditLoadParams } from "../../utils/txnFormUtils";
import { getTodayDateInputValue } from "../../utils/dateFormat";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { useTransactionFormReset } from "../../hooks/useTransactionFormReset";
import { usePendingCellEventFlush } from "../../hooks/usePendingCellEventFlush";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  DIT_CONFIG,
  DIT_GRID_TABS,
  DIT_FILTER_CASCADE_RESETS,
  DIT_EVENT_COLUMNS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
} from "./constants";
import "./AssetsDepreciationITActPage.css";

let _ditTempId = -1;
const nextTempId = () => _ditTempId--;

// ── Item picker column builder (fallback when RB metadata columns are empty) ──
const PICKER_HIDDEN_COLS = new Set(["ItemID", "ItemTypeID", "ParentUKey", "ChildFKey", "BaseUnitID", "TranUnitID"]);
const PICKER_LABEL_MAP = {
  ItemTypeDesc: "Item Type",
  ItemCode: "Item Code",
  ItemName: "Item Name",
  BaseUnit: "Base Unit",
  TranUnit: "Tran Unit",
  BaseQty: "Base Qty",
  TranQty: "Tran Qty",
  BaseRate: "Base Rate",
  TranRate: "Tran Rate",
  BaseAmount: "Base Amount",
  TranAmount: "Tran Amount",
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

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    trancode: headerValues.trancode ?? "",
    trandate: headerValues.trandate ?? "",
    divisionid: String(headerValues.divisionid ?? ""),
    fixedastacid: String(headerValues.fixedastacid ?? ""),
    totaldepamount: String(headerValues.totaldepamount ?? "0"),
    remarks: headerValues.remarks ?? "",
    funccode: headerValues.funccode ?? "",
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

// ── Component ────────────────────────────────────────────────────────────

export default function AssetsDepreciationITActForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord = location.state?.record ?? null;
  const notify = useNotification();

  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [detailCellErrors, setDetailCellErrors] = useState(null);

  // 2026-08-14 (/pm) pattern — see AssetsDepreciationForm.jsx / other Assets
  // forms for the original write-up: clears the stale "Fix N error(s)"
  // banner once every flagged field is valid again, without touching any
  // other message already in formErrors (save failures, etc.).
  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) {
      setFormErrors((prev) => prev.filter((m) => m !== "Please fix the highlighted field(s) below."));
    }
  }, [fieldErrors]);

  const itemGridRef = useRef(null);
  const itemGridSectionRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);
  const { post: postSave } = useApi(API_BASE_URL_IMS);
  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, assetsAccOptions,
    fetchAssetsAccByDivision, clearAssetsAccOptions,
    columns, allColumns, metaError,
    fetchDetailMeta, fetchGridColumns,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    clearSaveError,
  } = useAstDepIT(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  const headerValuesRef = useRef({
    trancode: "",
    trandate: getTodayDateInputValue(),
    divisionid: 0,
    fixedastacid: 0,
    totaldepamount: 0,
    remarks: "",
    funccode: DIT_CONFIG.RB_MASTER,
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: recordId,
  });

  // trandate defaults to today on a new record; existing records keep their loaded date.
  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { trandate: getTodayDateInputValue() };
  }, [loadedFilterValues]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState("items");
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [, setIsGridLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);

  const [isEditMode, setIsEditMode] = useState(false);

  const focusFirstEditableFilterField = useCallback(() => {
    const fields = queryEditableFilterFields(filterPanelRef.current);
    if (fields.length === 0) return false;
    fields[0].focus();
    return true;
  }, []);

  const focusItemGridButton = useCallback(() => {
    setActiveTab("items");
    selectItemBtnRef.current?.focus();
  }, []);

  const enterEditModeWithFocus = useCallback(async () => {
    setIsEditMode(true);
    setActiveTab("items");
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (!focusFirstEditableFilterField()) focusItemGridButton();
      }, 80);
    });
  }, [focusFirstEditableFilterField, focusItemGridButton]);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  usePageHeader({
    title: isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then add items via the grid."
      : recordLoading
        ? "Loading record…"
        : recordLoadError
          ? recordLoadError
          : `Depreciation #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: DIT_CONFIG.ROUTE_PATH,
  });

  // ── Mount: load metadata ──────────────────────────────────────────────
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

  // ── Edit flow: load existing record ─────────────────────────────────────
  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const params = resolveEditLoadParams(recordId, listRecord);
      const { master, headerValues, details } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("Depreciation IT Act record not found.");

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
      console.error("[DIT] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load Depreciation IT Act record.");
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

  // ── Amount = Qty × Rate — client-side, no SP_GRID_EVENT in the MRD ──────
  const handleCellEvent = useCallback(({ rowId, colKey, rowData }) => {
    return trackCellEvent(async () => {
      const key = String(colKey).toLowerCase();
      if (key !== "qty" && key !== "rate") return;
      const qty = Number(rowData.qty ?? rowData.Qty) || 0;
      const rate = Number(rowData.rate ?? rowData.Rate) || 0;
      const patch = { amount: qty * rate };
      if ("Amount" in rowData) patch.Amount = qty * rate;
      itemGridRef.current?.updateRow?.(rowId, patch);
    });
  }, [trackCellEvent]);

  // ── syncedFilters — built purely from API headerColumns (fully dynamic) ──
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    divisionid: divisionOptions,
    fixedastacid: assetsAccOptions,
  }), [divisionOptions, assetsAccOptions]);

  const syncedFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];
    return headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible))
      .sort((a, b) => Number(a.colseqno) - Number(b.colseqno))
      .map((col) => {
        const lockOnEditMode = isLockOnEditModeCol(col);
        const staticOptions = DROPDOWN_OPTIONS_BY_COL[col.colname];
        const base = {
          FilterParameterID: col.colname,
          FilterColName: col.colname,
          FilterCaption: col.displayname ?? col.colname,
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
      if (!isEditMode) tone = "view";
      else if (isEditRoute && f.lockOnEditMode) tone = "frozen";
      tones[f.FilterColName] = tone;
      if (f.FilterParameterID) tones[f.FilterParameterID] = tone;
    });
    return tones;
  }, [syncedFilters, isEditMode, isEditRoute]);

  // ── Filter change / cascade ──────────────────────────────────────────────
  const [clearRowsOpen, setClearRowsOpen] = useState(false);
  const [clearRowsLabel, setClearRowsLabel] = useState("");
  const pendingClearActionRef = useRef(null);

  const requestGridClear = useCallback((fieldLabel, action) => {
    const rows = itemGridRef.current?.getRows?.() ?? [];
    if (rows.length === 0) { action(); return; }
    pendingClearActionRef.current = action;
    setClearRowsLabel(fieldLabel);
    setClearRowsOpen(true);
  }, []);

  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };
    setFieldErrors((prev) => {
      if (!prev[colName]) return prev;
      const next = { ...prev };
      delete next[colName];
      return next;
    });

    // Division → clear Fixed Account + reload item grid (MRD cascade note)
    if (colName === "divisionid") {
      requestGridClear("Division", async () => {
        headerValuesRef.current.fixedastacid = 0;
        clearAssetsAccOptions();
        itemGridRef.current?.clearRows?.();
        if (val && val !== "0") {
          await fetchAssetsAccByDivision(val);
          focusFieldAfterCascade(filterPanelRef, "fixedastacid");
        }
      });
      return;
    }

    // Fixed Account → clear/reload item grid (MRD cascade note)
    if (colName === "fixedastacid") {
      requestGridClear("Fixed Account", () => {
        itemGridRef.current?.clearRows?.();
      });
      return;
    }
  }, [requestGridClear, clearAssetsAccOptions, fetchAssetsAccByDivision]);

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

  // ── Select Item ──────────────────────────────────────────────────────────
  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValues, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    if (Object.keys(headerErrorMap).length > 0) {
      setFormErrors(["Please fix the highlighted field(s) below."]);
      return;
    }
    setFormErrors([]);

    const { divisionid, fixedastacid, trandate } = headerValues;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      const session = getUserSession();
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: DIT_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: DIT_CONFIG.RB_ITEM_PICKER }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const [colRes, rowRes] = await Promise.all([
        getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
          prmMasterID: rbRow.rbid,
          prmLoginID: session.loginId,
        }),
        getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: DIT_CONFIG.SP_ITEM_PICKER,
          JSon: JSON.stringify([{
            prmtrandate: trandate ?? "",
            prmdivisionid: Number(divisionid ?? 0),
            prmcompanyid: session.companyId,
            prmyearid: session.yearId,
            prmmlnnotin: "",
            prmgroupid: 0,
            prmaccountid: Number(fixedastacid ?? 0),
            prmdeptype: "",
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }),
      ]);

      const rows = rowRes || [];
      const rbLinks = colRes || [];
      const rbDataKeys = new Set(rbLinks.map((c) => c.colname));
      const dataKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
      const rbMatchesData = rbLinks.length > 0 && dataKeys.some((k) => rbDataKeys.has(k));

      const cols = rbMatchesData
        ? buildGridColumns(rbLinks, {}, { filterable: false, allEditable: false })
        : buildPickerColumnsFromData(rows[0] ?? null);

      setItemModalColumns(cols);
      setItemModalItems(rows);
    } catch (err) {
      console.error("[DIT] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, headerColumns]);

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

  // ── Delete selected rows ─────────────────────────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    if (!itemGridRef.current) return;
    const selected = itemGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  // ── Save ───────────────────────────────────────────────────────────────
  const buildDefaultHeaderValues = useCallback(() => {
    const session = getUserSession();
    return {
      trancode: "", trandate: getTodayDateInputValue(),
      divisionid: 0, fixedastacid: 0,
      totaldepamount: 0, remarks: "",
      funccode: DIT_CONFIG.RB_MASTER, tranmstgenid: 0,
      companyid: session.companyId, yearid: session.yearId,
      loginid: session.loginId, idnumber: 0,
    };
  }, []);

  const clearDitStorage = useCallback(() => {
    localStorage.removeItem(DIT_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(DIT_CONFIG.STORAGE_DETAIL_META);
  }, []);

  const { discardChanges, completeSuccessfulSave } = useTransactionFormReset({
    storageKeys: [],
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
    extraClearFns: [clearAssetsAccOptions, clearDitStorage],
    extraReset: () => { setFieldErrors({}); setDetailCellErrors(null); },
  });

  const handleSave = useCallback(async ({ skipPostSave = false } = {}) => {
    await flushPendingCellEvents(itemGridSectionRef);
    setFormErrors([]);
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValuesRef.current, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    const headerBannerMsg =
      Object.keys(headerErrorMap).length > 0 ? ["Please fix the highlighted field(s) below."] : [];
    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    const { errors: detailErrors, cellErrors: detailCellErrs } = validateGridRowsDetailed(detailRows, columns, { requireAtLeastOne: true });
    setDetailCellErrors(detailCellErrs);

    const allErrors = [...headerBannerMsg, ...(detailRows.length === 0 ? detailErrors : [])];
    if (Object.keys(headerErrorMap).length > 0 || detailCellErrs.size > 0 || detailRows.length === 0) {
      setFormErrors(allErrors);
      return false;
    }

    const loginId = getUserSession().loginId;
    const hv = headerValuesRef.current;
    const headerColDefs = headerColumns.map((col) => ({
      key: col.colname,
      colDataType: col.coldatatype,
    }));
    const mstRow = buildSaveRowFromColumns(hv, headerColDefs, { loginid: loginId });

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, { loginid: loginId })
    );

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: DIT_CONFIG.FORM_TAG, mst: mstRow, det: detRows }),
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(DIT_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
      if (!skipPostSave) completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[DIT Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [headerColumns, allColumns, columns, isEditRoute, notify, postSave, completeSuccessfulSave, flushPendingCellEvents]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave({ skipPostSave: true });
    if (!saved) return;
    window.print();
    completeSuccessfulSave();
  }, [handleSave, completeSuccessfulSave]);

  const [discardOpen, setDiscardOpen] = useState(false);
  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    discardChanges();
  }, [discardChanges]);
  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = headerFetching;

  useEntryFormKeyboard({
    blocked: itemModalOpen,
    isEditMode,
    isSaving,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onSavePrint: handleSaveAndPrint,
    onCancel: handleCancel,
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
  const combinedError = metaError || headerError;

  return (
    <div className="workspace-page workspace-page--fill dit-page">
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
            title="Depreciation IT Act Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={DIT_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            isSearching={filterBusy || recordLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterBusy || !headerMetaReady}
            fieldTones={filterFieldTones}
            fieldErrors={fieldErrors}
            onLastFieldTabForward={isEditMode ? focusItemGridButton : null}
          />
        )}
      </section>

      {/* ── Item grid section ────────────────────────────────────────── */}
      <section className="dit-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={DIT_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          headerControls={
            <>
              <button
                ref={selectItemBtnRef}
                type="button"
                className="eg-tab-btn"
                onClick={handleSelectItem}
                disabled={!isEditMode}
                title="Pick depreciation items"
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
            </>
          }
          hideBottomPanel
          emptyMessage="No items yet. Click Select Item above."
          onSelectionChange={setItemSelectionCount}
          readOnly={isEditRoute && !isEditMode}
          existingRecordEdit={isEditRoute && isEditMode}
          cellErrors={detailCellErrors}
          onCellEvent={handleCellEvent}
          eventColumns={DIT_EVENT_COLUMNS}
        />
      </section>

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
