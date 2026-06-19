// PurchaseVoucherForm.jsx
// Purchase Voucher entry form (add / edit).
// Mirrors PurchaseIndentForm.jsx — same three-phase load, edit-mode gate, item grid.
//
// PV-specific vs Indent:
//   Added: Supplier, Currency, CurrencyRate, BillNo, BillDate,
//          CostCenter, CreditStartDate, Narration
//   3 item picker modes: GRN Base (0) | PO Base (1) | Direct (2)
//   Cascade: DivisionID → clear ConfigID + SupplierID + grid
//            SupplierID → auto-fill Currency + clear grid
//            BasedOnID  → clear grid
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — header fields
//   2. pv-grid-section        — single-tab Item Grid
//        buttons: Select Item | Delete
//   3. EnterpriseSummaryPanel — live totals computed from grid rows
//   4. ActionBar              — Add / Save / Cancel / Close (Alt shortcuts)

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import EnterpriseSummaryPanel from "../../components/filters/EnterpriseSummaryPanel";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import { usePurchaseVoucher } from "../../hooks/usePurchaseVoucher";
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
import { buildGridColumns, isLockOnEditModeCol, syncHeaderFilterWithApiCol, buildHeaderColMap, resolveHeaderApiCol } from "../../utils/gridUtils";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  PV_CONFIG,
  PV_HEADER_FILTERS,
  PV_GRID_TABS,
  PV_FILTER_CASCADE_RESETS,
  PV_SUMMARY_FIELDS,
  PV_MULTI_PASTE_COLUMNS,
  formatPVTranDate,
  getMissingItemPickerHeaderFields,
} from "./constants";
import { controlTypeMap } from "../../data/dummyData";
import "./PurchaseVoucherPage.css";

// ── Temp-ID generator (negative → never clash with real IDs) ──────────
let _pvTempId = -1;
const nextTempId = () => _pvTempId--;

function resolveEditLoadParams(recordId, listRecord) {
  const session = getUserSession();
  return {
    companyId: listRecord?.CompanyID ?? session.companyId ?? DEFAULT_COMPANY_ID,
    yearId: listRecord?.YearID ?? session.yearId ?? PV_CONFIG.CONFIG_YEAR_ID,
    loginId: listRecord?.LoginID ?? session.loginId,
    sessionId: listRecord?.SessionID ?? listRecord?.SessionId ?? DEFAULT_SESSION_ID,
    idNumber: listRecord?.PVID ?? listRecord?.IDNumber ?? recordId,
  };
}

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    TranCode: headerValues.TranCode ?? "",
    TranDate: headerValues.TranDate ?? "",
    DivisionID: String(headerValues.DivisionID ?? ""),
    ConfigID: String(headerValues.ConfigID ?? ""),
    BasedOnID: String(headerValues.BasedOnID ?? "2"),
    SupplierID: String(headerValues.SupplierID ?? ""),
    CurrencyName: headerValues.CurrencyName ?? headerValues.Currency ?? "",
    CurrencyRate: String(headerValues.CurrencyRate ?? ""),
    BillNo: headerValues.BillNo ?? "",
    BillDate: headerValues.BillDate ?? "",
    CostCenterID: String(headerValues.CostCenterID ?? ""),
    CreditStartDate: headerValues.CreditStartDate ?? "",
    Narration: headerValues.Narration ?? "",
    Remarks: headerValues.Remarks ?? "",
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

// ── Component ──────────────────────────────────────────────────────────

export default function PurchaseVoucherForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord = location.state?.record ?? null;
  const navigate = useNavigate();

  const itemGridRef = useRef(null);
  const summaryRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, pvTypeOptions, supplierOptions,
    costCenterOptions,
    isLoadingPvTypes,
    fetchPVTypes, clearPvTypes,
    fetchSupplierInfo, getSupplierCurrency,
    fetchCostCenters,
    columns, allColumns, eventColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fireCellEvent,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    clearSaveError,
  } = usePurchaseVoucher(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const headerValuesRef = useRef({
    TranCode: "",
    TranDate: todayISO,
    DivisionID: 0,
    ConfigID: 0,
    BasedOnID: "2",
    SupplierID: 0,
    CurrencyID: 0,
    CurrencyRate: 0,
    BillNo: "",
    BillDate: null,
    CostCenterID: 0,
    CreditStartDate: todayISO,
    Narration: "",
    Remarks: "",
    TranMstGenID: 0,
    CompanyID: DEFAULT_COMPANY_ID,
    YearID: PV_CONFIG.DIVISION_YEAR_ID,
    LoginID: DEFAULT_LOGIN_ID,
    IDNumber: recordId,
    FuncCode: PV_CONFIG.RB_MASTER,
  });

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { TranDate: todayISO, BasedOnID: "2", CreditStartDate: todayISO };
  }, [loadedFilterValues, todayISO]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState("items");
  const [currencyExternalValues, setCurrencyExternalValues] = useState(null);
  const [basedOnId, setBasedOnId] = useState("2");
  const [pasteNotice, setPasteNotice] = useState(null);
  const pasteNoticeTimerRef = useRef(null);
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [gridRows, setGridRows] = useState([]);

  // Item picker modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);

  // ── Edit-mode gate ─────────────────────────────────────────────────
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
    title: isNewRoute ? "New Purchase Voucher" : "Purchase Voucher",
    subtitle: isNewRoute
      ? "Fill in the header fields, then add items via the grid."
      : recordLoading
        ? "Loading purchase voucher…"
        : recordLoadError
          ? recordLoadError
          : `PV #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: "/purchase-voucher",
  });

  // ── Mount: load metadata ───────────────────────────────────────────
  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta, isEditRoute]);

  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(headerValuesRef.current?.DivisionID ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns, fetchGridColumns, isEditRoute]);

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

  // ── Edit flow: load existing record ───────────────────────────────
  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const params = resolveEditLoadParams(recordId, listRecord);
      const { master, headerValues, details } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("Purchase Voucher record not found.");

      headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      seedOptionsFromMaster(master);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      if (headerValues.CurrencyName || headerValues.CurrencyRate) {
        setCurrencyExternalValues({
          CurrencyName: headerValues.CurrencyName ?? "",
          CurrencyRate: String(headerValues.CurrencyRate ?? ""),
        });
      }

      const activeCols = await fetchGridColumns(headerValues.DivisionID ?? 0, editRecordGridColumnOpts(master));
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;

      const syncedDetails = syncEditGridDropdownValues(details, activeCols || []);

      if (itemGridRef.current?.loadRows) {
        itemGridRef.current.loadRows(syncedDetails);
      } else {
        queuedRowsRef.current = syncedDetails;
      }
    } catch (err) {
      console.error("[PV] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load purchase voucher record.");
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
    fetchUnlockedHeaderDropdowns(
      hv.DivisionID ?? loadedMasterRow?.DivisionID ?? 0,
      hv.TranDate,
      hv.ConfigID,
      hv.SupplierID,
    );
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

  // ── syncedFilters — inject dynamic options ─────────────────────────
  const syncedFilters = useMemo(() => {
    const injectOptions = (filter) => {
      switch (filter.FilterParameterID) {
        case "DivisionID": return { ...filter, staticOptions: divisionOptions };
        case "ConfigID": return { ...filter, staticOptions: pvTypeOptions };
        case "SupplierID": return { ...filter, staticOptions: supplierOptions };
        case "CostCenterID": return { ...filter, staticOptions: costCenterOptions };
        default: return filter;
      }
    };

    if (headerColumns.length === 0) return PV_HEADER_FILTERS.map(injectOptions);

    const apiColMap = buildHeaderColMap(headerColumns);

    return PV_HEADER_FILTERS.map((filter) => {
      const withOpts = injectOptions(filter);
      const apiCol = resolveHeaderApiCol(filter, apiColMap);
      if (!apiCol) return withOpts;
      const lockOnEditMode = isLockOnEditModeCol(apiCol);
      const def = syncHeaderFilterWithApiCol(withOpts, apiCol, { lockOnEditMode });
      def.FilterColCtrlType = withOpts.FilterColCtrlType === controlTypeMap.LABEL
        ? controlTypeMap.LABEL
        : (apiCol.ColCtrlType ?? withOpts.FilterColCtrlType);
      return def;
    });
  }, [headerColumns, divisionOptions, pvTypeOptions, supplierOptions, costCenterOptions]);

  const syncedSummaryFields = useMemo(() => {
    const colMap = {};
    headerColumns.forEach((col) => { colMap[col.ColName] = col; });
    return PV_SUMMARY_FIELDS.map((f) => ({
      ...f,
      mstKey: f.SummaryParameterID,
      label: colMap[f.SummaryParameterID]?.DisplayName ?? f.SummaryParameterID,
    }));
  }, [headerColumns]);

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

  // ── Filter change / cascade ────────────────────────────────────────
  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

    if (colName === "DivisionID") {
      headerValuesRef.current.ConfigID = 0;
      headerValuesRef.current.SupplierID = 0;
      clearPvTypes();
      itemGridRef.current?.clearRows?.();
      if (val && val !== "0") {
        await fetchPVTypes(val);
        await fetchCostCenters(val, headerValuesRef.current.TranDate);
      }
      return;
    }

    if (colName === "SupplierID") {
      itemGridRef.current?.clearRows?.();
      if (val && val !== "0") {
        const cached = getSupplierCurrency(val);
        if (cached) {
          headerValuesRef.current.CurrencyID = cached.CurrencyID;
          headerValuesRef.current.CurrencyName = cached.CurrencyName;
          headerValuesRef.current.CurrencyRate = cached.CurrencyRate;
          setCurrencyExternalValues({
            CurrencyName: cached.CurrencyName ?? "",
            CurrencyRate: String(cached.CurrencyRate ?? ""),
          });
        } else {
          const info = await fetchSupplierInfo(val);
          if (info) {
            headerValuesRef.current.CurrencyID = info.CurrencyID;
            headerValuesRef.current.CurrencyRate = info.CurrencyRate;
            setCurrencyExternalValues({
              CurrencyName: "",
              CurrencyRate: String(info.CurrencyRate ?? ""),
            });
          }
        }
      } else {
        headerValuesRef.current.CurrencyID = 0;
        headerValuesRef.current.CurrencyName = "";
        headerValuesRef.current.CurrencyRate = 0;
        setCurrencyExternalValues({ CurrencyName: "", CurrencyRate: "" });
      }
      return;
    }

    if (colName === "ConfigID") {
      itemGridRef.current?.clearRows?.();
      return;
    }

    if (colName === "BasedOnID") {
      setBasedOnId(String(val));
      itemGridRef.current?.clearRows?.();
    }
  }, [fetchPVTypes, clearPvTypes, fetchSupplierInfo, getSupplierCurrency, fetchCostCenters]);

  // ── Multi-value paste — Sr. No replication (Direct mode only) ─────
  const handleMultiValuePaste = useCallback((sourceRow, colKey, values) => {
    itemGridRef.current?.updateRow?.(sourceRow.id, { [colKey]: values[0] });
    values.slice(1).forEach((val) => {
      addItemRow({ ...sourceRow, id: nextTempId(), [colKey]: val });
    });
    if (pasteNoticeTimerRef.current) clearTimeout(pasteNoticeTimerRef.current);
    setPasteNotice(`${values.length} row${values.length !== 1 ? "s" : ""} added from pasted serial numbers.`);
    pasteNoticeTimerRef.current = setTimeout(() => setPasteNotice(null), 4000);
  }, [addItemRow]);

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

  // ── Cell event — qty / rate recalculation ─────────────────────────
  const handleCellEvent = useCallback(async ({ rowId, colKey, rowData }) => {
    const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
    if (!result || !itemGridRef.current) return;
    const responseRow = result?.Links?.[0];
    if (!responseRow) return;
    const errCode = responseRow.ErrCode;
    if (errCode !== 1 && errCode !== 1.0) {
      console.warn("[PV] Cell-event error:", responseRow.ErrMsg ?? `ErrCode ${errCode}`);
      return;
    }
    const { ErrCode, ErrMsg, ...updatedFields } = responseRow;
    itemGridRef.current.updateRow?.(rowId, updatedFields);
  }, [fireCellEvent]);

  // ── Select Item ────────────────────────────────────────────────────
  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues);
    if (missingFields.length > 0) {
      alert(`Please fill in the following before selecting items:\n${missingFields.join("\n")}`);
      return;
    }
    const { DivisionID, ConfigID, TranDate, BasedOnID, SupplierID } = headerValues;
    const divisionID = DivisionID ?? 0;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      // Three-way picker: 0=GRN Base, 1=PO Base, 2=Direct
      let rbCode;
      if (Number(BasedOnID) === 0) rbCode = PV_CONFIG.RB_ITEM_PICKER_GRN;
      else if (Number(BasedOnID) === 1) rbCode = PV_CONFIG.RB_ITEM_PICKER_PO;
      else rbCode = PV_CONFIG.RB_ITEM_PICKER_DIRECT;

      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PV_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: rbCode }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const rbRow = rbRes?.Table?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const gridColumns = buildGridColumns(colRes?.Links || [], {}, { filterable: false, allEditable: false });
      setItemModalColumns(gridColumns);

      let spItemPicker;
      if (Number(BasedOnID) === 0) spItemPicker = PV_CONFIG.SP_ITEM_PICKER_GRN;
      else if (Number(BasedOnID) === 1) spItemPicker = PV_CONFIG.SP_ITEM_PICKER_PO;
      else spItemPicker = PV_CONFIG.SP_ITEM_PICKER_DIRECT;

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: spItemPicker,
        JSon: JSON.stringify([{
          prmDivisionID: Number(divisionID),
          prmYearID: PV_CONFIG.CONFIG_YEAR_ID,
          prmLoginID: DEFAULT_LOGIN_ID,
          prmTranDate: formatPVTranDate(TranDate),
          prmConfigID: Number(ConfigID ?? 0),
          prmSupplierID: Number(SupplierID ?? 0),
          prmTranBook: PV_CONFIG.TRAN_BOOK,
          prmFrmOption: Number(BasedOnID) || 0,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      setItemModalItems(rowRes?.Table || []);
    } catch (err) {
      console.error("[PV] Item picker fetch failed:", err);
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

  const handleToggleCollapsible = useCallback(() => {
    itemGridRef.current?.toggleFocusedRowCollapsible?.();
  }, []);

  // ── Delete selected rows ───────────────────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    if (!itemGridRef.current) return;
    const selected = itemGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  // ── Save ───────────────────────────────────────────────────────────
  const [isSavingPV, setIsSavingPV] = useState(false);

  const handleSave = useCallback(async () => {
    const headerFieldNames = new Set(PV_HEADER_FILTERS.map((f) => f.FilterParameterID));
    const headerColsToValidate = headerColumns.filter((c) => headerFieldNames.has(c.ColName));
    const headerErrors = validateApiColumns(headerValuesRef.current, headerColsToValidate);

    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    const detailErrors = validateGridRows(detailRows, columns);

    const allErrors = [...headerErrors, ...detailErrors];
    if (allErrors.length > 0) {
      alert(allErrors.join("\n"));
      return false;
    }

    const mstRow = {};
    headerColumns.forEach((col) => { mstRow[col.ColName] = getColDefault(col.ColDataType); });
    const hv = headerValuesRef.current;
    Object.entries(hv).forEach(([k, v]) => { if (k !== "id") mstRow[k] = v; });
    Object.assign(mstRow, summaryRef.current?.getSummary?.() ?? {});
    mstRow.LoginID = DEFAULT_LOGIN_ID;

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) => {
      const row = {};
      allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
      return { ...row, ...rest, LoginID: DEFAULT_LOGIN_ID };
    });

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: "PV", mst: mstRow, det: detRows }),
      { divisionId: hv.DivisionID, isEdit: isEditRoute }
    );

    setIsSavingPV(true);
    try {
      const res = await fetch(`${API_BASE_URL_IMS}${PV_CONFIG.SAVE_ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      console.log("%c[PV Save] Response:", "color:#22c55e;font-weight:700", result);
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert("Purchase Voucher saved successfully!");
    } catch (err) {
      console.error("[PV Save] Failed:", err);
      alert(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSavingPV(false);
    }
  }, [headerColumns, allColumns, columns, isEditRoute]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave();
    if (!saved) return;
    window.print();
  }, [handleSave]);

  const handleCancel = useCallback(() => {
    if (!window.confirm("Discard changes and reset the form?")) return;

    localStorage.removeItem(PV_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(PV_CONFIG.STORAGE_ENTRY_META);

    headerValuesRef.current = {
      TranCode: "", TranDate: todayISO, DivisionID: 0, ConfigID: 0,
      BasedOnID: "2", SupplierID: 0, CurrencyID: 0, CurrencyRate: 0,
      BillNo: "", BillDate: null,
      CostCenterID: 0, CreditStartDate: todayISO,
      Narration: "", Remarks: "", TranMstGenID: 0,
      CompanyID: DEFAULT_COMPANY_ID, YearID: PV_CONFIG.DIVISION_YEAR_ID,
      LoginID: DEFAULT_LOGIN_ID, IDNumber: 0, FuncCode: PV_CONFIG.RB_MASTER,
    };

    queuedRowsRef.current = [];
    gridColumnsLoadedRef.current = false;
    clearPvTypes();
    clearSaveError();
    setCurrencyExternalValues({ CurrencyName: "", CurrencyRate: "" });
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
  }, [clearPvTypes, clearSaveError, exitEditMode, todayISO]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = headerFetching || isLoadingPvTypes;

  useEntryFormKeyboard({
    blocked: itemModalOpen,
    isEditMode,
    isSaving: isSavingPV,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onSavePrint: handleSaveAndPrint,
    onCancel: handleCancel,
    onSelectList: handleSelectListShortcut,
    onToggleCollapsible: handleToggleCollapsible,
  });

  // ── Extra ActionBar buttons ────────────────────────────────────────
  const pvExtraButtons = useMemo(() => [
    {
      key: "saveprint", label: "Save & Print", Icon: Printer, variant: "print",
      onClick: handleSaveAndPrint, disabled: isSavingPV,
      title: FORM_SHORTCUT_TITLES.savePrint,
    },
    {
      key: "save", label: isSavingPV ? "Saving…" : "Save", Icon: Save, variant: "save",
      onClick: handleSave, disabled: isSavingPV, loading: isSavingPV,
      accessKey: "s", title: FORM_SHORTCUT_TITLES.save,
    },
  ], [handleSaveAndPrint, isSavingPV, handleSave]);

  const itemGridConfig = { columns, pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] } };
  const combinedError = metaError || headerError;

  return (
    <div className="workspace-page pv-page">
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
            title="Purchase Voucher Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={PV_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            externalValues={currencyExternalValues}
            isSearching={filterBusy || recordLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterBusy || !headerMetaReady}
            fieldTones={filterFieldTones}
            onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
          />
        )}
      </section>

      {/* ── Single-tab grid section ───────────────────────────────────── */}
      <section className="pv-grid-section">
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {PV_GRID_TABS.map((t) => (
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
            {pasteNotice && (
              <span className="pv-paste-notice" role="status" aria-live="polite">
                ✓ {pasteNotice}
              </span>
            )}

            <button
              ref={selectItemBtnRef}
              type="button"
              className="pv-tab-action-btn"
              onClick={handleSelectItem}
              disabled={!isEditMode}
              title="Pick items from list (Tab here after header fields)"
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

        <div className={`pv-tab-pane${activeTab === "items" ? " pv-tab-pane--active" : ""}`}>
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
            multiValuePasteColumns={basedOnId === "2" ? PV_MULTI_PASTE_COLUMNS : null}
            onMultiValuePaste={basedOnId === "2" ? handleMultiValuePaste : null}
          />
        </div>
      </section>

      <EnterpriseSummaryPanel ref={summaryRef} fields={syncedSummaryFields} rows={gridRows} />

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        onCancel={handleCancel}
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={pvExtraButtons}
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
