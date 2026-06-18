// CWIPToFAForm.jsx — CWIP To Fixed Assets entry form (Add / Edit)
//
// Pattern mirrors PurchaseVoucherForm.jsx exactly:
//   1. fetchHeaderMeta  → RB_AstCWIP2FAMst → GET_DETAIL_COL_DATA (header column METADATA)
//   2. fetchDetailMeta  → RB_AstCWIP2FADet → GET_DETAIL_COL_DATA (grid column METADATA)
//   3. fetchGridColumns → GET_FILTER_DETAIL + buildGridColumns  (lazy, on first Add New)
//   4. syncedFilters useMemo merges static layout + API IsMandatory/IsLockOnEditMode flags
//
// C2F vs PV:
//   No SupplierID, BasedOnID, EnterpriseSummaryPanel
//   PutToUseInstDate — required second date field
//   LocationID       — cascade from Division (fetchLocations)
//   CWIPAccID        — fetched via C2F_CONFIG.SP_CWIP_ACC (direct SP, same pattern as Division)
//   ConvTypeID       — hardcoded 2-option dropdown, clears grid on change
//   NetTotal         — computed client-side: sum of grid Amount column
//   Cascade: DivisionID → clear LocationID + grid; LocationID → clear grid; ConvTypeID → clear grid

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
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
import { getUserSession } from "../../session/userSession";
import {
  buildGridColumns,
  isLockOnEditModeCol,
  syncHeaderFilterWithApiCol,
  buildHeaderColMap,
  resolveHeaderApiCol,
} from "../../utils/gridUtils";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields } from "../../utils/savePayload";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  C2F_CONFIG,
  C2F_HEADER_FILTERS,
  C2F_GRID_TABS,
  C2F_FILTER_CASCADE_RESETS,
  formatC2FTranDate,
  getMissingItemPickerHeaderFields,
} from "./constants";
import { controlTypeMap } from "../../data/dummyData";
import "./CWIPToFAPage.css";

let _c2fTempId = -1;
const nextTempId = () => _c2fTempId--;

function resolveEditLoadParams(recordId, listRecord) {
  const session = getUserSession();
  return {
    companyId: listRecord?.CompanyID ?? session.companyId ?? DEFAULT_COMPANY_ID,
    yearId:    listRecord?.YearID    ?? session.yearId    ?? C2F_CONFIG.CONFIG_YEAR_ID,
    loginId:   listRecord?.LoginID   ?? session.loginId,
    sessionId: listRecord?.SessionID ?? listRecord?.SessionId ?? DEFAULT_SESSION_ID,
    idNumber:  listRecord?.C2FID     ?? listRecord?.IDNumber   ?? recordId,
  };
}

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    TranNo:           headerValues.TranNo           ?? "",
    TranDate:         headerValues.TranDate          ?? "",
    PutToUseInstDate: headerValues.PutToUseInstDate  ?? "",
    DivisionID:       String(headerValues.DivisionID      ?? ""),
    LocationID:       String(headerValues.LocationID      ?? ""),
    CWIPAccID:        String(headerValues.CWIPAccID        ?? ""),
    CostCenterAccID:  String(headerValues.CostCenterAccID  ?? ""),
    ConvTypeID:       String(headerValues.ConvTypeID      ?? "1"),
    NetTotal:         String(headerValues.NetTotal         ?? "0"),
    Remark:           headerValues.Remark            ?? "",
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
    if (k !== "id" && v != null && Object.prototype.hasOwnProperty.call(row, k)) row[k] = v;
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
  const navigate    = useNavigate();

  const itemGridRef          = useRef(null);
  const filterPanelRef       = useRef(null);
  const selectItemBtnRef     = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef        = useRef([]);
  const { get: getLive }     = useApi(API_BASE_URL);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, locationOptions, cWIPAccOptions, costCenterOptions,
    fetchLocations, clearLocations,
    fetchCostCenters,
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
    TranNo:           "",
    TranDate:         todayISO,
    PutToUseInstDate: null,
    DivisionID:       0,
    LocationID:       0,
    CWIPAccID:        0,
    CostCenterAccID:  0,
    ConvTypeID:       "1",
    NetTotal:         0,
    Remark:           "",
    TranMstGenID:     0,
    CompanyID:        DEFAULT_COMPANY_ID,
    YearID:           C2F_CONFIG.CONFIG_YEAR_ID,
    LoginID:          DEFAULT_LOGIN_ID,
    IDNumber:         recordId,
    FuncCode:         C2F_CONFIG.RB_MASTER,
  });

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { TranDate: todayISO, ConvTypeID: "1" };
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

  const enterEditModeWithFocus = useCallback(() => {
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
    title:    isNewRoute ? "New CWIP To FA" : "CWIP To FA",
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
    fetchGridColumns(headerValuesRef.current?.DivisionID ?? 0).then((cols) => {
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
      if (!master || !headerValues) throw new Error("CWIP To FA record not found.");

      headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      seedOptionsFromMaster(master);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      const activeCols = await fetchGridColumns(headerValues.DivisionID ?? 0, {
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
    fetchUnlockedHeaderDropdowns(hv.DivisionID ?? loadedMasterRow?.DivisionID ?? 0, hv.TranDate);
    fetchGridColumns(hv.DivisionID ?? loadedMasterRow?.DivisionID ?? 0, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
  }, [isEditRoute, isEditMode, loadedMasterRow, fetchUnlockedHeaderDropdowns, fetchGridColumns]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  // ── NetTotal — live sum of grid Amount column ──────────────────────────────
  useEffect(() => {
    const total = gridRows.reduce((sum, row) => sum + (Number(row.Amount) || 0), 0);
    headerValuesRef.current.NetTotal = total;
  }, [gridRows]);

  // ── syncedFilters — inject dynamic API metadata + dropdown options ─────────
  // Same pattern as PV: static layout merged with API IsMandatory/IsLockOnEditMode.
  const syncedFilters = useMemo(() => {
    const injectOptions = (filter) => {
      switch (filter.FilterParameterID) {
        case "DivisionID":      return { ...filter, staticOptions: divisionOptions };
        case "LocationID":      return { ...filter, staticOptions: locationOptions };
        case "CWIPAccID":       return { ...filter, staticOptions: cWIPAccOptions };
        case "CostCenterAccID": return { ...filter, staticOptions: costCenterOptions };
        case "ConvTypeID":      return { ...filter, staticOptions: C2F_CONFIG.CONV_TYPE_OPTIONS };
        default:                return filter;
      }
    };

    if (headerColumns.length === 0) return C2F_HEADER_FILTERS.map(injectOptions);

    // buildHeaderColMap / resolveHeaderApiCol / syncHeaderFilterWithApiCol:
    // inject IsMandatory, IsVisible, IsEditAllow, IsLockOnEditModeAllow from API
    const apiColMap = buildHeaderColMap(headerColumns);

    return C2F_HEADER_FILTERS.map((filter) => {
      const withOpts = injectOptions(filter);
      const apiCol   = resolveHeaderApiCol(filter, apiColMap);
      if (!apiCol) return withOpts;
      const lockOnEditMode = isLockOnEditModeCol(apiCol);
      const def = syncHeaderFilterWithApiCol(withOpts, apiCol, { lockOnEditMode });
      // Always keep the static control type — API ColCtrlType is unreliable for header
      // fields (C2F returns 0/LABEL for all columns). Static C2F_HEADER_FILTERS is the
      // source of truth for rendering; API provides only behaviour flags.
      def.FilterColCtrlType = withOpts.FilterColCtrlType;
      return def;
    });
  }, [headerColumns, divisionOptions, locationOptions, cWIPAccOptions, costCenterOptions]);

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
  const confirmGridClear = useCallback((fieldLabel) => {
    const rows = itemGridRef.current?.getRows?.() ?? [];
    if (rows.length === 0) return true;
    return window.confirm(`Changing ${fieldLabel} will clear all item rows. Continue?`);
  }, []);

  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

    if (colName === "DivisionID") {
      if (!confirmGridClear("Division")) {
        // revert via filter panel re-key would be invasive; just skip the update
        return;
      }
      headerValuesRef.current.LocationID = 0;
      clearLocations();
      itemGridRef.current?.clearRows?.();
      if (val && val !== "0") {
        await Promise.all([
          fetchLocations(val),
          fetchCostCenters(val, headerValuesRef.current.TranDate),
        ]);
      }
      return;
    }

    if (colName === "LocationID") {
      if (!confirmGridClear("Location")) return;
      itemGridRef.current?.clearRows?.();
      return;
    }

    if (colName === "ConvTypeID") {
      if (!confirmGridClear("Conversion Type")) return;
      itemGridRef.current?.clearRows?.();
    }
  }, [confirmGridClear, clearLocations, fetchLocations, fetchCostCenters]);

  const ensureItemColumns = useCallback(async () => {
    if (gridColumnsLoadedRef.current && columns.length > 0) return columns;
    if (allColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const activeCols = await fetchGridColumns(headerValuesRef.current?.DivisionID ?? 0);
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [columns, allColumns, fetchGridColumns]);

  // ── Cell event — Qty / Rate → Amount  ─────────────────────────────────────
  // If SP_GRID_EVENT is null (TBD), compute Amount client-side as Qty × Rate.
  const handleCellEvent = useCallback(async ({ rowId, colKey, rowData }) => {
    if (!C2F_CONFIG.SP_GRID_EVENT) {
      // Client-side fallback: Amount = Qty × Rate
      if (colKey === "Qty" || colKey === "Rate") {
        const qty  = Number(rowData.Qty)  || 0;
        const rate = Number(rowData.Rate) || 0;
        itemGridRef.current?.updateRow?.(rowId, { Amount: qty * rate });
      }
      return;
    }
    const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
    if (!result || !itemGridRef.current) return;
    const responseRow = result?.Links?.[0];
    if (!responseRow) return;
    const errCode = responseRow.ErrCode;
    if (errCode !== 1 && errCode !== 1.0) {
      console.warn("[C2F] Cell-event error:", responseRow.ErrMsg ?? `ErrCode ${errCode}`);
      return;
    }
    const { ErrCode, ErrMsg, ...updatedFields } = responseRow;
    itemGridRef.current.updateRow?.(rowId, updatedFields);
  }, [fireCellEvent]);

  // ── Select Item ────────────────────────────────────────────────────────────
  const handleSelectItem = useCallback(async () => {
    const headerValues    = headerValuesRef.current;
    const missingFields   = getMissingItemPickerHeaderFields(headerValues);
    if (missingFields.length > 0) {
      alert(`Please fill in the following before selecting items:\n${missingFields.join("\n")}`);
      return;
    }

    const { DivisionID, LocationID, CWIPAccID, TranDate, PutToUseInstDate, ConvTypeID } = headerValues;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: C2F_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: C2F_CONFIG.RB_ITEM_PICKER }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const rbRow = rbRes?.Table?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.RBID,
        prmLoginID:  DEFAULT_LOGIN_ID,
      });
      setItemModalColumns(buildGridColumns(colRes?.Links || [], {}, { filterable: false, allEditable: false }));

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: C2F_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([{
          prmDivisionID:  Number(DivisionID  ?? 0),
          prmLocationID:  Number(LocationID  ?? 0),
          prmCWIPAcID:    Number(CWIPAccID   ?? 0),
          prmYearID:      C2F_CONFIG.CONFIG_YEAR_ID,
          prmLoginID:     DEFAULT_LOGIN_ID,
          prmTranDate:    formatC2FTranDate(TranDate),
          prmPutToUseDate: formatC2FTranDate(PutToUseInstDate),
          prmConvTypeID:  Number(ConvTypeID  ?? 1),
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      setItemModalItems(rowRes?.Table || []);
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
  const handleSave = useCallback(async () => {
    const headerFieldNames  = new Set(C2F_HEADER_FILTERS.map((f) => f.FilterParameterID));
    const headerColsToValidate = headerColumns.filter((c) => headerFieldNames.has(c.ColName));
    const headerErrors = validateApiColumns(headerValuesRef.current, headerColsToValidate);

    const detailRows    = itemGridRef.current?.getRows?.() ?? [];
    const detailErrors  = validateGridRows(detailRows, columns);

    const allErrors = [...headerErrors, ...detailErrors];
    if (allErrors.length > 0) {
      alert(allErrors.join("\n"));
      return false;
    }

    const mstRow = {};
    headerColumns.forEach((col) => { mstRow[col.ColName] = getColDefault(col.ColDataType); });
    const hv = headerValuesRef.current;
    Object.entries(hv).forEach(([k, v]) => { if (k !== "id") mstRow[k] = v; });
    mstRow.LoginID = DEFAULT_LOGIN_ID;

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) => {
      const row = {};
      allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
      return { ...row, ...rest, LoginID: DEFAULT_LOGIN_ID };
    });

    const payload = await withSaveContextFields(
      {
        prmStrMstJSON: JSON.stringify([mstRow]),
        prmStrDetJSON: JSON.stringify(detRows),
      },
      { divisionId: hv.DivisionID, isEdit: isEditRoute }
    );

    console.log("%c[C2F Save] Payload:",  "color:#f59e0b;font-weight:700", payload);
    console.log("%c[C2F Save] Master:",   "color:#6366f1;font-weight:600", [mstRow]);
    console.log("%c[C2F Save] Detail:",   "color:#22c55e;font-weight:600", detRows);

    setIsSaving(true);
    try {
      const res    = await fetch(`${API_BASE_URL_IMS}${C2F_CONFIG.SAVE_ENDPOINT}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      console.log("%c[C2F Save] Response:", "color:#22c55e;font-weight:700", result);
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert("CWIP To FA record saved successfully!");
      return true;
    } catch (err) {
      console.error("[C2F Save] Failed:", err);
      alert(err?.message || "Save failed. Please try again.");
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

  const handleCancel = useCallback(() => {
    if (!window.confirm("Discard changes and reset the form?")) return;

    localStorage.removeItem(C2F_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(C2F_CONFIG.STORAGE_ENTRY_META);

    headerValuesRef.current = {
      TranNo: "", TranDate: todayISO, PutToUseInstDate: null,
      DivisionID: 0, LocationID: 0, CWIPAccID: 0, CostCenterAccID: 0,
      ConvTypeID: "1", NetTotal: 0, Remark: "",
      TranMstGenID: 0,
      CompanyID: DEFAULT_COMPANY_ID, YearID: C2F_CONFIG.CONFIG_YEAR_ID,
      LoginID: DEFAULT_LOGIN_ID, IDNumber: 0, FuncCode: C2F_CONFIG.RB_MASTER,
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
  }, [clearSaveError, exitEditMode, todayISO]);

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
              className="pv-tab-action-btn"
              onClick={handleSelectItem}
              disabled={!isEditMode}
              title="Pick CWIP items (Tab here after header fields)"
            >
              <Package size={12} strokeWidth={2.5} />
              Select Item
            </button>

            <button
              type="button"
              className="pv-tab-delete-btn"
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

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        onCancel={handleCancel}
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
