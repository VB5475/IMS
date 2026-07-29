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
import { AlertCircle, Trash2, Package, Printer, Save, Filter as FilterIcon } from "lucide-react";
import SearchSelect from "../../components/ui/SearchSelect";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
import EnterpriseSummaryPanel from "../../components/filters/EnterpriseSummaryPanel";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import { usePurchaseVoucher } from "../../hooks/usePurchaseVoucher";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
  getColDefault,
  buildSaveRowFromColumns,
  OBJ_TYPE,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { buildGridColumns, isLockOnEditModeCol, isTruthyApiFlag, syncHeaderFilterWithApiCol, editRecordGridColumnOpts, syncEditGridDropdownValues, syncMasterSummaryFields } from "../../utils/gridUtils";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { focusFieldAfterCascade } from "../../utils/focusUtils";
import { queryEditableFilterFields, resolveEditLoadParams } from "../../utils/txnFormUtils";
import { getTodayDateInputValue } from "../../utils/dateFormat";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { useTransactionFormReset } from "../../hooks/useTransactionFormReset";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  PV_CONFIG,
  PV_GRID_TABS,
  PV_FILTER_CASCADE_RESETS,
  PV_SUMMARY_FIELDS,
  PV_SUMMARY_ROW_FILTER,
  PV_SUMMARY_FIELD_NAMES,
  PV_MULTI_PASTE_COLUMNS,
  PV_REMARK_COLUMNS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  formatPVTranDate,
  getMissingItemPickerHeaderFields,
} from "./constants";
import "./PurchaseVoucherPage.css";

// ── Temp-ID generator (negative → never clash with real IDs) ──────────
let _pvTempId = -1;
const nextTempId = () => _pvTempId--;

// Same inline ISO→yyyy-MM-dd normalization used by usePurchaseVoucher.js's
// mapMasterRowToHeaderValues, for the date-input-bound header fields.
function toDateInputValue(value) {
  if (!value) return null;
  if (typeof value === "string" && value.includes("T")) return value.split("T")[0];
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    trancode: headerValues.trancode ?? "",
    trandate: headerValues.trandate ?? "",
    divisionid: String(headerValues.divisionid ?? ""),
    locationid: String(headerValues.locationid ?? ""),
    configid: String(headerValues.configid ?? ""),
    basedonid: String(headerValues.basedonid ?? "2"),
    supplierid: String(headerValues.supplierid ?? ""),
    currencyname: headerValues.currencyname ?? headerValues.currency ?? "",
    currencyrate: String(headerValues.currencyrate ?? ""),
    billno: headerValues.billno ?? "",
    billdate: headerValues.billdate ?? "",
    costcenterid: String(headerValues.costcenterid ?? ""),
    creditstartdate: headerValues.creditstartdate ?? "",
    narration: headerValues.narration ?? "",
    remarks: headerValues.remarks ?? "",
  };
}

function mapPickerToItemRow(item, allColumns) {
  const row = { id: nextTempId() };
  allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
  Object.entries(item).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (lk !== "id" && v != null && Object.prototype.hasOwnProperty.call(row, lk)) row[lk] = v;
  });
  // "Put To Use" (RB_PurPVDet) is a per-line checkbox with no default from the
  // picker SPs — getColDefault("int") leaves it at 0, which PV_SUMMARY_ROW_FILTER
  // reads as "excluded from totals" (matches confirmed backend save behaviour).
  // Left unset, every freshly-picked row is excluded and the summary panel always
  // shows 0.00. Default new rows to put-to-use=1; user can still uncheck a row
  // to exclude it from the totals.
  if (Object.prototype.hasOwnProperty.call(row, "puttouse") && item?.puttouse == null) {
    row.puttouse = 1;
  }
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
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);
  const navigate = useNavigate();

  const itemGridRef = useRef(null);
  const summaryRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);
  const { post: postSave } = useApi(API_BASE_URL_IMS);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, pvTypeOptions, supplierOptions,
    costCenterOptions,
    locationOptions, fetchLocationOptions, clearLocations,
    isLoadingPvTypes,
    fetchPVTypes, clearPvTypes,
    fetchSupplierInfo, getSupplierCurrency,
    fetchCostCenters,
    itemMainGroupOptions, itemSubMainGroupOptions,
    fetchItemMainGroupOptions, fetchItemSubMainGroupOptions, clearItemSubMainGroupOptions,
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

  const session = getUserSession();

  const headerValuesRef = useRef({
    trancode: "",
    trandate: getTodayDateInputValue(),
    divisionid: 0,
    configid: 0,
    basedonid: "",
    supplierid: 0,
    currencyid: 0,
    currencyrate: 0,
    billno: "",
    billdate: getTodayDateInputValue(),
    costcenterid: 0,
    creditstartdate: getTodayDateInputValue(),
    narration: "",
    remarks: "",
    tranmstgenid: 0,
    companyid: session.companyId,
    yearid: session.yearId,
    loginid: session.loginId,
    idnumber: recordId,
    funccode: PV_CONFIG.RB_MASTER,
  });

  // trandate, billdate, and creditstartdate default to today on a new record;
  // existing records keep their loaded dates. basedonid still has no default —
  // client requirement 2026-07-24 remains for that dropdown.
  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return {
      trandate: getTodayDateInputValue(),
      basedonid: "",
      billdate: getTodayDateInputValue(),
      creditstartdate: getTodayDateInputValue(),
    };
  }, [loadedFilterValues]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState("items");
  const [currencyExternalValues, setCurrencyExternalValues] = useState(null);
  const [billExternalValues, setBillExternalValues] = useState(null);
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
  // Select Item popup filters (Based On = Direct only) — items are only
  // fetched once the user clicks Filter; GRN/PO-base branches are untouched.
  const [itemMainGroupFilter, setItemMainGroupFilter] = useState("");
  const [itemSubMainGroupFilter, setItemSubMainGroupFilter] = useState("");
  const [itemFilterApplied, setItemFilterApplied] = useState(false);
  const [itemFilterLoading, setItemFilterLoading] = useState(false);
  const [itemPickerIsDirect, setItemPickerIsDirect] = useState(false);

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
    title: isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then add items via the grid."
      : recordLoading
        ? "Loading purchase voucher…"
        : recordLoadError
          ? recordLoadError
          : `PV #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: PV_CONFIG.ROUTE_PATH,
  });

  // ── Mount: load metadata ───────────────────────────────────────────
  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta, isEditRoute]);

  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(headerValuesRef.current?.divisionid ?? 0).then((cols) => {
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
      const params = resolveEditLoadParams(recordId, listRecord, {
        idFields: ["PVID"],
      });
      const { master, headerValues, details } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("Purchase Voucher record not found.");

      headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      seedOptionsFromMaster(master);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      // seedOptionsFromMaster only seeds dropdowns the master-fill row embeds
      // a display name for (divisionname, suppliername, ...) — the master
      // fill has no locationname, so fetch location options for the loaded
      // division directly, same as the divisionid cascade does on change.
      if (headerValues.divisionid) {
        fetchLocationOptions(headerValues.divisionid);
      }

      if (headerValues.currencyname || headerValues.currencyrate) {
        setCurrencyExternalValues({
          currencyname: headerValues.currencyname ?? "",
          currencyrate: String(headerValues.currencyrate ?? ""),
        });
      }

      const activeCols = await fetchGridColumns(headerValues.divisionid ?? 0, editRecordGridColumnOpts(master));
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
  }, [recordId, listRecord, fetchEditRecord, seedOptionsFromMaster, fetchGridColumns, fetchLocationOptions]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || allColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, allColumns.length, loadEditRecord]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode || !loadedMasterRow) return;
    const hv = headerValuesRef.current;
    fetchUnlockedHeaderDropdowns(
      hv.divisionid ?? loadedMasterRow?.divisionid ?? 0,
      hv.trandate,
      hv.configid,
      hv.supplierid,
    );
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

  // Visible RB header columns, RB-ordered. Source of truth for which fields
  // exist as filters — no hand-maintained field list to fall out of sync
  // with the RB (see PV_HEADER_FILTERS removal in constants.js / GRN fix).
  // Summary-panel fields (mstbaseamount, tdsamount, ...) are excluded — RB
  // marks them visible, but they're rendered in EnterpriseSummaryPanel and
  // computed from grid rows, not real header inputs.
  const visibleHeaderColumns = useMemo(() => {
    return headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible) && !PV_SUMMARY_FIELD_NAMES.has(col.colname))
      .sort((a, b) => Number(a.colseqno) - Number(b.colseqno));
  }, [headerColumns]);

  // Dropdown options we fetch ourselves, keyed by live RB colname.
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    divisionid: divisionOptions,
    configid: pvTypeOptions,
    supplierid: supplierOptions,
    costcenterid: costCenterOptions,
    locationid: locationOptions,
    basedonid: PV_CONFIG.BASED_ON_OPTIONS,
  }), [divisionOptions, pvTypeOptions, supplierOptions, costCenterOptions, locationOptions]);

  // ── syncedFilters — built straight from the live RB column ──────────
  const buildFilterDefFromApiCol = useCallback(
    (col) => {
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
    },
    [DROPDOWN_OPTIONS_BY_COL]
  );

  // "Select All (Put To Use)" (RB colname selectallputtouse) mirrors the grid's
  // own puttouse column: all rows on → checked, none on → unchecked, a mix →
  // indeterminate. Derived from gridRows, never independently user-set.
  const puttouseHeaderState = useMemo(() => {
    if (gridRows.length === 0) return { checked: 0, indeterminate: false };
    const onCount = gridRows.filter((r) => Number(r.puttouse) !== 0).length;
    return {
      checked: onCount === gridRows.length ? 1 : 0,
      indeterminate: onCount > 0 && onCount < gridRows.length,
    };
  }, [gridRows]);

  // Keep the ref in sync too, so a save that reads headerValuesRef directly
  // (buildSaveRowFromColumns) reflects the live grid aggregate, not whatever
  // was last independently clicked.
  useEffect(() => {
    headerValuesRef.current.selectallputtouse = puttouseHeaderState.checked;
  }, [puttouseHeaderState.checked]);

  const syncedFilters = useMemo(() => {
    const base = visibleHeaderColumns.map(buildFilterDefFromApiCol);
    return base.map((f) =>
      f.FilterColName === "selectallputtouse"
        ? { ...f, indeterminate: puttouseHeaderState.indeterminate }
        : f
    );
  }, [visibleHeaderColumns, buildFilterDefFromApiCol, puttouseHeaderState.indeterminate]);

  // EnterpriseFilterPanel only accepts a single externalValues prop — merge the
  // currency-cascade values, the GRN-selection BillNo/BillDate values, and the
  // grid-derived Select-All-Put-To-Use checked state into one.
  const combinedExternalValues = useMemo(() => ({
    ...currencyExternalValues,
    ...billExternalValues,
    selectallputtouse: puttouseHeaderState.checked,
  }), [currencyExternalValues, billExternalValues, puttouseHeaderState.checked]);

  // Only fields RB marks visible on the master render — same rule as syncedFilters.
  const syncedSummaryFields = useMemo(
    () => syncMasterSummaryFields(PV_SUMMARY_FIELDS, headerColumns),
    [headerColumns]
  );

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

    if (colName === "divisionid") {
      headerValuesRef.current.configid = 0;
      headerValuesRef.current.supplierid = 0;
      headerValuesRef.current.locationid = 0;
      clearPvTypes();
      clearLocations();
      itemGridRef.current?.clearRows?.();
      if (val && val !== "0") {
        await Promise.all([
          fetchPVTypes(val),
          fetchCostCenters(val, headerValuesRef.current.trandate),
          fetchLocationOptions(val),
        ]);
        focusFieldAfterCascade(filterPanelRef, "configid");
      }
      return;
    }

    if (colName === "supplierid") {
      itemGridRef.current?.clearRows?.();
      if (val && val !== "0") {
        const cached = getSupplierCurrency(val);
        if (cached) {
          headerValuesRef.current.currencyid = cached.currencyid ?? cached.CurrencyID;
          headerValuesRef.current.currencyname = cached.currencyname ?? cached.CurrencyName;
          headerValuesRef.current.currencyrate = cached.currencyrate ?? cached.CurrencyRate;
          setCurrencyExternalValues({
            currencyname: cached.currencyname ?? cached.CurrencyName ?? "",
            currencyrate: String(cached.currencyrate ?? cached.CurrencyRate ?? ""),
          });
        } else {
          const info = await fetchSupplierInfo(val);
          if (info) {
            headerValuesRef.current.currencyid = info.CurrencyID ?? info.currencyid;
            headerValuesRef.current.currencyname = info.CurrencyName ?? info.currencyname ?? "";
            headerValuesRef.current.currencyrate = info.CurrencyRate ?? info.currencyrate;
            setCurrencyExternalValues({
              currencyname: info.CurrencyName ?? info.currencyname ?? "",
              currencyrate: String(info.CurrencyRate ?? info.currencyrate ?? ""),
            });
          }
        }
      } else {
        headerValuesRef.current.currencyid = 0;
        headerValuesRef.current.currencyname = "";
        headerValuesRef.current.currencyrate = 0;
        setCurrencyExternalValues({ currencyname: "", currencyrate: "" });
      }
      return;
    }

    if (colName === "configid") {
      itemGridRef.current?.clearRows?.();
      return;
    }

    if (colName === "basedonid") {
      setBasedOnId(String(val));
      itemGridRef.current?.clearRows?.();
      return;
    }

    // Header "Select All (Put To Use)" click — toggles every grid row's
    // puttouse in one shot via local grid state only (updateAllRows never
    // routes through fireCellEvent, matching the "don't recalc on puttouse"
    // rule). The checkbox's own displayed value is otherwise fully derived
    // from gridRows (see puttouseHeaderState) — this click is the one place
    // it acts as an input rather than a pure read-out.
    if (colName === "selectallputtouse") {
      const next = Number(val) ? 1 : 0;
      headerValuesRef.current.selectallputtouse = next;
      itemGridRef.current?.updateAllRows?.({ puttouse: next });
      return;
    }
  }, [fetchPVTypes, clearPvTypes, fetchSupplierInfo, getSupplierCurrency, fetchCostCenters, fetchLocationOptions, clearLocations]);

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
      const activeCols = await fetchGridColumns(headerValuesRef.current?.divisionid ?? 0);
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
    const responseRow = result?.[0];
    if (!responseRow) return;
    const errCode = responseRow.errcode;
    if (errCode !== 1 && errCode !== 1.0) {
      console.warn("[PV] Cell-event error:", responseRow.errmsg ?? `ErrCode ${errCode}`);
      return;
    }
    const { errcode, errmsg, ...updatedFields } = responseRow;
    itemGridRef.current.updateRow?.(rowId, updatedFields);
  }, [fireCellEvent]);

  // ── Select Item ────────────────────────────────────────────────────
  // Three-way picker: 0=GRN Base, 1=PO Base, 2=Direct. Direct defers the item
  // fetch until Filter is clicked — GRN/PO Base branches fetch immediately,
  // unchanged. Client instruction 2026-07-28, same rollout as Purchase Indent.
  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues, headerColumns);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }
    const { divisionid, configid, trandate, basedonid, supplierid, locationid } = headerValues;
    const divisionID = divisionid ?? 0;
    const basedOnNum = Number(basedonid);
    const isDirect = basedOnNum !== 0 && basedOnNum !== 1;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);
    setItemMainGroupFilter("");
    setItemSubMainGroupFilter("");
    setItemFilterApplied(!isDirect);
    setItemPickerIsDirect(isDirect);
    clearItemSubMainGroupOptions();

    try {
      let rbCode;
      if (basedOnNum === 0) rbCode = PV_CONFIG.RB_ITEM_PICKER_GRN;
      else if (basedOnNum === 1) rbCode = PV_CONFIG.RB_ITEM_PICKER_PO;
      else rbCode = PV_CONFIG.RB_ITEM_PICKER_DIRECT;

      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PV_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: rbCode }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.rbid,
        prmLoginID: getUserSession().loginId,
      });
      const gridColumns = buildGridColumns(colRes || [], {}, { filterable: false, allEditable: false });
      setItemModalColumns(gridColumns);

      if (isDirect) {
        await fetchItemMainGroupOptions({ divisionId: divisionID, configId: configid });
      } else {
        const spItemPicker = basedOnNum === 0 ? PV_CONFIG.SP_ITEM_PICKER_GRN : PV_CONFIG.SP_ITEM_PICKER_PO;
        const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: spItemPicker,
          JSon: JSON.stringify([{
            prmdivisionid: Number(divisionID),
            prmyearid: getUserSession().yearId,
            prmloginid: getUserSession().loginId,
            prmtrandate: formatPVTranDate(trandate),
            prmconfigid: Number(configid ?? 0),
            prmsupplierid: Number(supplierid ?? 0),
            prmlocationid: Number(locationid ?? 0),
            prmtranbook: PV_CONFIG.TRAN_BOOK,
            prmfrmoption: basedOnNum || 0,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        });
        setItemModalItems(rowRes || []);
      }
    } catch (err) {
      console.error("[PV] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, headerColumns, fetchItemMainGroupOptions, clearItemSubMainGroupOptions]);

  // Main Group changed → reload Sub Main Group options, reset its own selection.
  const handleItemMainGroupFilterChange = useCallback((value) => {
    setItemMainGroupFilter(value);
    setItemSubMainGroupFilter("");
    const headerValues = headerValuesRef.current;
    if (value) {
      fetchItemSubMainGroupOptions({ divisionId: headerValues.divisionid, configId: headerValues.configid, mainGroupId: value });
    } else {
      clearItemSubMainGroupOptions();
    }
  }, [fetchItemSubMainGroupOptions, clearItemSubMainGroupOptions]);

  // Direct-mode item fetch — deferred until Filter is clicked. Main/Sub Main
  // Group aren't sent to SP_ITEM_PICKER_DIRECT yet — see constants.js
  // DBA-CONFIRM note (SP doesn't accept these params yet, live-confirmed).
  // Main/Sub Main Group ARE now sent — live-confirmed 2026-07-28 (previously
  // threw "Must declare the scalar variable ..."; that's gone).
  const handleApplyItemFilter = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const { divisionid, configid, trandate, supplierid, locationid } = headerValues;
    const divisionID = divisionid ?? 0;

    setItemModalError(null);
    setItemFilterLoading(true);
    try {
      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PV_CONFIG.SP_ITEM_PICKER_DIRECT,
        JSon: JSON.stringify([{
          prmdivisionid: Number(divisionID),
          prmyearid: getUserSession().yearId,
          prmloginid: getUserSession().loginId,
          prmtrandate: formatPVTranDate(trandate),
          prmconfigid: Number(configid ?? 0),
          prmsupplierid: Number(supplierid ?? 0),
          prmlocationid: Number(locationid ?? 0),
          prmtranbook: PV_CONFIG.TRAN_BOOK,
          prmfrmoption: 2,
          prmmaingroupid: Number(itemMainGroupFilter) || 0,
          prmsubmaingroupid: Number(itemSubMainGroupFilter) || 0,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      setItemModalItems(rowRes || []);
      setItemFilterApplied(true);
    } catch (err) {
      console.error("[PV] Item filter fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemFilterLoading(false);
    }
  }, [getLive, itemMainGroupFilter, itemSubMainGroupFilter]);

  const handleInsertItems = useCallback(async (selectedItems) => {
    if (!selectedItems?.length) return;
    setActiveTab("items");
    const activeCols = await ensureItemColumns();
    if (!activeCols?.length) return;

    const rows = selectedItems.map((item) => mapPickerToItemRow(item, allColumns));
    rows.forEach((row) => addItemRow(row));

    // A picker-inserted row's Qty/Rate already carry real values (from the
    // GRN/PO/Item Master source), but the grid's calculated columns
    // (baseamount/expense/taxablevalue/cgst/sgst/igst) only ever populate via
    // the server recalc SP a manual Qty/Rate blur triggers — never
    // automatically on insert (confirmed live 2026-07-24: picker SPs return
    // short-form fields like baseamt/tranamt, not the grid's own baseamount/
    // tranamount columns, so those start zeroed until touched). Fire the same
    // recalc for every newly-inserted row right away, via the same
    // handleCellEvent path a real blur uses (errcode check + updateRow),
    // so the summary panel is correct immediately without the user needing
    // to click into and back out of a cell. "tranqty" is always a real
    // event-column here regardless of RB flags (see usePurchaseVoucher.js's
    // fallback list) — colKey only identifies the field to the SP, so any
    // row content is fine to send under it.
    await Promise.all(rows.map((row) => handleCellEvent({ rowId: row.id, colKey: "tranqty", rowData: row })));

    // GRN Base (BasedOnID 0) picker rows carry the source GRN's BillNo/BillDate
    // (fn_tbl_rb_purpvselgrndet) — PM: copy them onto the PV's own BillNo/BillDate
    // master fields. Multiple items may span more than one GRN, so use the first
    // selected item's bill details, per PM's clarified rule.
    if (Number(basedOnId) === 0) {
      const first = selectedItems[0];
      const billno = first?.billno ?? "";
      const billdate = toDateInputValue(first?.billdate);
      if (billno || billdate) {
        headerValuesRef.current.billno = billno;
        headerValuesRef.current.billdate = billdate;
        setBillExternalValues({ billno, billdate: billdate ?? "" });
      }
    }
  }, [ensureItemColumns, allColumns, addItemRow, basedOnId, handleCellEvent]);

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

  const buildDefaultHeaderValues = useCallback(() => {
    const resetSession = getUserSession();
    return {
      trancode: "", trandate: getTodayDateInputValue(), divisionid: 0, configid: 0,
      basedonid: "", supplierid: 0, currencyid: 0, currencyrate: 0,
      billno: "", billdate: getTodayDateInputValue(),
      costcenterid: 0, creditstartdate: getTodayDateInputValue(),
      narration: "", remarks: "", tranmstgenid: 0,
      companyid: resetSession.companyId, yearid: resetSession.yearId,
      loginid: resetSession.loginId, idnumber: 0, funccode: PV_CONFIG.RB_MASTER,
    };
  }, []);

  const { resetFormToInitialState, discardChanges } = useTransactionFormReset({
    storageKeys: [PV_CONFIG.STORAGE_HEADER_META, PV_CONFIG.STORAGE_ENTRY_META],
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
    extraClearFns: [clearPvTypes],
    extraReset: () => {
      setCurrencyExternalValues({ currencyname: "", currencyrate: "" });
      // null (not blank strings) — billno/billdate are ordinary RB header
      // fields already blank in the New-record initialValues; a blank merge
      // isn't needed and, unlike currency, must never later stomp a freshly
      // reloaded edit record's real BillNo/BillDate (see handleDiscardConfirm).
      setBillExternalValues(null);
      summaryRef.current?.resetOverrides?.();
    },
  });

  const completeSuccessfulSave = useCallback(() => {
    if (isEditRoute) navigate(PV_CONFIG.ROUTE_PATH);
    else resetFormToInitialState();
  }, [isEditRoute, navigate, resetFormToInitialState]);

  const handleSave = useCallback(async ({ skipPostSave = false } = {}) => {
    setFormErrors([]);
    // Validate every RB-visible header field, not a hand-maintained subset —
    // a field missing from a static list must never be silently skipped at
    // save time just because nobody remembered to list it (see GRN fix).
    const headerErrors = validateApiColumns(headerValuesRef.current, visibleHeaderColumns, {
      zeroValidFields: new Set(["basedonid"]),
    });

    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    const detailErrors = validateGridRows(detailRows, columns);

    const allErrors = [...headerErrors, ...detailErrors];
    if (allErrors.length > 0) {
      setFormErrors(allErrors);
      return false;
    }

    const hv = headerValuesRef.current;
    const masterColumnDefs = headerColumns.map((col) => ({
      key: col.colname,
      colDataType: col.coldatatype || null,
    }));
    const mstRow = buildSaveRowFromColumns(hv, masterColumnDefs, {
      ...(summaryRef.current?.getSummary?.() ?? {}),
      loginid: getUserSession().loginId,
    });

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, { loginid: getUserSession().loginId })
    );

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: "PV", mst: mstRow, det: detRows }),
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSavingPV(true);
    try {
      const result = await postSave(PV_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
      if (!skipPostSave) completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[PV Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSavingPV(false);
    }
  }, [headerColumns, visibleHeaderColumns, allColumns, columns, isEditRoute, completeSuccessfulSave]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave({ skipPostSave: true });
    if (!saved) return;
    window.print();
    completeSuccessfulSave();
  }, [handleSave, completeSuccessfulSave]);

  const [discardOpen, setDiscardOpen] = useState(false);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    // Covers the edit-route branch of discardChanges() (re-fetches the record
    // instead of going through resetFormToInitialState/extraReset, which is
    // where the New-record reset clears this) — a stale Round Off override or
    // GRN-picked BillNo/BillDate must not survive a Cancel either way. Cleared
    // to null (not blank strings) so the merge is a no-op once discardChanges()
    // reloads the record and remounts the filter panel with its real BillNo/
    // BillDate — a blank-string merge would otherwise stomp the reloaded values.
    summaryRef.current?.resetOverrides?.();
    setBillExternalValues(null);
    discardChanges();
  }, [discardChanges]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

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

  // Direct mode only — GRN Base/PO Base items fetch immediately, no filter step.
  const itemFilterBar = !itemPickerIsDirect ? null : (
    <div className="oim-filter-bar">
      <label className="oim-filter-bar__field">
        <span>Item Main Group</span>
        <SearchSelect
          value={itemMainGroupFilter}
          onChange={handleItemMainGroupFilterChange}
          options={itemMainGroupOptions}
          placeholder="All main groups"
          ariaLabel="Item Main Group"
        />
      </label>
      <label className="oim-filter-bar__field">
        <span>Item Sub Main Group</span>
        <SearchSelect
          value={itemSubMainGroupFilter}
          onChange={setItemSubMainGroupFilter}
          options={itemSubMainGroupOptions}
          placeholder="All sub main groups"
          ariaLabel="Item Sub Main Group"
          disabled={!itemMainGroupFilter}
        />
      </label>
      <button
        type="button"
        className="oim-filter-bar__btn"
        onClick={handleApplyItemFilter}
        disabled={itemFilterLoading}
        title="Load items for the selected filters"
      >
        <FilterIcon size={13} strokeWidth={2.5} />
        {itemFilterLoading ? "Filtering…" : "Filter"}
      </button>
    </div>
  );

  return (
    <div className="workspace-page workspace-page--fill pv-page">
      <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
      <ConfirmDialog
        isOpen={discardOpen}
        message="Discard changes and reset the form?"
        onConfirm={handleDiscardConfirm}
        onCancel={() => setDiscardOpen(false)}
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
            title="Purchase Voucher Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={PV_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            externalValues={combinedExternalValues}
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
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={PV_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          headerControls={
            <>
              {pasteNotice && (
                <span className="pv-paste-notice" role="status" aria-live="polite">
                  ✓ {pasteNotice}
                </span>
              )}

              <button
                ref={selectItemBtnRef}
                type="button"
                className="eg-tab-btn"
                onClick={handleSelectItem}
                disabled={!isEditMode}
                title="Pick items from list (Tab here after header fields)"
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
          onRowsChange={setGridRows}
          onCellEvent={handleCellEvent}
          eventColumns={eventColumns}
          readOnly={isEditRoute && !isEditMode}
          existingRecordEdit={isEditRoute && isEditMode}
          multiValuePasteColumns={basedOnId === "2" ? PV_MULTI_PASTE_COLUMNS : null}
          onMultiValuePaste={basedOnId === "2" ? handleMultiValuePaste : null}
          remarkModalColumns={PV_REMARK_COLUMNS}
        />
      </section>

      <EnterpriseSummaryPanel
        ref={summaryRef}
        fields={syncedSummaryFields}
        rows={gridRows}
        masterValues={loadedMasterRow}
        rowFilter={PV_SUMMARY_ROW_FILTER}
      />

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        onCancel={handleCancel}
        addLabel={isEditRoute ? "Edit" : "Add"}
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
          isLoading={itemModalLoading || itemFilterLoading}
          error={itemModalError}
          onInsert={handleInsertItems}
          filterBar={itemFilterBar}
          awaitingFilter={!itemFilterApplied}
        />
      </Suspense>
    </div>
  );
}
