// GoodsReceivedNoteForm.jsx
// Goods Received Note entry form (add / edit).
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — header fields (RB_PurGRNMst)
//   2. grn-grid-section       — 3-tab wrapper
//        • Item Grid tab     → EntryGrid (RB_PurGRNDet) — Select Item
//        • Transporter tab   → EnterpriseFilterPanel (transporter fields)
//        • Driver tab        → EnterpriseFilterPanel (driver fields)
//        Fixed controls: Approved filter | Delete
//   3. ActionBar            — Add / Save / Cancel (Alt shortcuts)
//
// Transporter/Driver panels are passed as `tabPanes` so they stay mounted
// across tab switches (same pattern as Purchase Inquiry). Their field values
// live in each panel's state + headerValuesRef; remounting via filterResetKey
// still resets them on discard / edit load.
//
// Item picker RB follows BasedOnID ('0' Direct | '1' PO | '3' Indent).

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, FileText, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import ItemPickerGroupFilterBar from "../../components/txn/ItemPickerGroupFilterBar";
import { useNotification } from "../../context/NotificationContext";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import SearchSelect from "../../components/ui/SearchSelect";
import { useGoodsReceivedNote } from "../../hooks/useGoodsReceivedNote";
import { useItemPickerGroupFilter } from "../../hooks/useItemPickerGroupFilter";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  getColDefault,
  buildSaveRowFromColumns,
  OBJ_TYPE,
  DEFAULT_SESSION_ID,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import {
  buildGridColumns,
  editRecordGridColumnOpts,
  isLockOnEditModeCol,
  isTruthyApiFlag,
  syncEditGridDropdownValues,
  syncHeaderFilterWithApiCol,
} from "../../utils/gridUtils";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { focusFieldAfterCascade } from "../../utils/focusUtils";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { getTodayDateInputValue } from "../../utils/dateFormat";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { usePendingCellEventFlush } from "../../hooks/usePendingCellEventFlush";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  GRN_CONFIG,
  GRN_MULTI_PASTE_COLUMNS,
  GRN_REMARK_COLUMNS,
  GRN_TRANSPORTER_FIELD_NAMES,
  GRN_DRIVER_FIELD_NAMES,
  GRN_GRID_TABS,
  APPROVED_OPTS,
  GRN_FILTER_CASCADE_RESETS,
  GRN_FILTER_INITIAL_VALUES,
  GRN_ITEM_PICKER_CONTEXT_FIELDS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  buildItemPickerJsonPayload,
  getMissingItemPickerHeaderFields,
  resolveItemPickerRbCode,
  resolveItemPickerSpName,
} from "./constants";
import "./GoodsReceivedNoteForm.css";

let _grnTempId = -1;
const nextTempId = () => _grnTempId--;

function mapHeaderValuesToFilterValues(headerValues, masterRow = null) {
  if (!headerValues) return null;
  return {
    trancode: headerValues.trancode ?? "",
    trandate: headerValues.trandate ?? "",
    divisionid: String(headerValues.divisionid ?? ""),
    locationid: String(headerValues.locationid ?? ""),
    configid: String(headerValues.configid ?? ""),
    supplierid: String(headerValues.supplierid ?? ""),
    // Edit-mode master fill (fn_tbl_rb_purgrnmst) returns the display name under
    // "currency", not "currencyname" — that key is only present on the supplier
    // row (fn_tbl_fetchcustomersuppliertranws4web), used when cascading from Add mode.
    currencyname: masterRow?.currency ?? String(headerValues.currency ?? ""),
    currencyrate: headerValues.currencyrate != null ? String(headerValues.currencyrate) : "",
    basedonid: String(headerValues.basedonid ?? "0"),
    billno: headerValues.billno ?? "",
    billdate: headerValues.billdate ?? "",
    challanno: headerValues.challanno ?? "",
    challandate: headerValues.challandate ?? "",
    remarks: headerValues.remarks ?? "",
    transporterid: String(headerValues.transporterid ?? ""),
    destinationid: String(headerValues.destinationid ?? ""),
    lrno: headerValues.lrno ?? "",
    lrdate: headerValues.lrdate ?? "",
    vehicleno: headerValues.vehicleno ?? "",
    vehicletypeid: String(headerValues.vehicletypeid ?? ""),
    noofperson: headerValues.noofperson ?? "",
    drivername: headerValues.drivername ?? "",
    drivercontactno: headerValues.drivercontactno ?? "",
    driverlicenceno: headerValues.driverlicenceno ?? "",
  };
}

function buildCurrencyPatchFromSupplier(supplier) {
  if (!supplier) return { currencyname: "", currencyrate: "" };
  return {
    currencyname: supplier.currencyname ?? supplier.CurrencyName ?? "",
    currencyrate: (supplier.currencyrate ?? supplier.CurrencyRate) != null ? String(supplier.currencyrate ?? supplier.CurrencyRate) : "",
  };
}

function resolveEditLoadParams(recordId, listRecord) {
  const session = getUserSession();
  return {
    companyId: listRecord?.companyid ?? session.companyId,
    yearId: listRecord?.yearid ?? session.yearId,
    loginId: listRecord?.loginid ?? session.loginId,
    sessionId: listRecord?.sessionid ?? DEFAULT_SESSION_ID,
    idNumber: listRecord?.idnumber ?? recordId,
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
  allColumns.forEach(({ key, colDataType }) => {
    row[key] = getColDefault(colDataType);
  });
  Object.entries(item).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (lk !== "id" && v != null && Object.prototype.hasOwnProperty.call(row, lk)) row[lk] = v;
  });
  return row;
}

export default function GoodsReceivedNoteForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new");
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord = location.state?.record ?? null;
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);
  const navigate = useNavigate();

  const itemGridRef = useRef(null);
  const itemGridSectionRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();
  const { get: getLive } = useApi(API_BASE_URL);
  const { post } = useApi(API_BASE_URL_IMS);

  const {
    headerColumns,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchDivisionOptions,
    divisionOptions,
    grnTypeOptions,
    supplierOptions,
    transporterOptions,
    destinationOptions,
    locationOptions,
    fetchGrnTypes,
    clearGrnTypes,
    fetchSupplierOptions,
    clearSuppliers,
    getSupplierRow,
    fetchTransporterOptions,
    fetchDestinationOptions,
    fetchLocationOptions,
    clearTransporters,
    clearDestinations,
    clearLocations,
    isLoadingGrnTypes,
    isLoadingSuppliers,
    isLoadingTransporters,
    isLoadingDestinations,
    isLoadingLocations,
    columns,
    allColumns,
    allIndentColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    fetchEditRecord,
    fetchIndentDetailColumns,
    clearIndentDetailMeta,
    fetchUnlockedHeaderDropdowns,
    fireCellEvent,
    eventColumns,
  } = useGoodsReceivedNote(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  const session = getUserSession();

  const headerValuesRef = useRef({
    trancode: "",
    trandate: getTodayDateInputValue(),
    configid: 0,
    divisionid: 0,
    supplierid: 0,
    currencyid: "",
    currencyrate: "",
    basedonid: "",
    billno: "",
    billdate: getTodayDateInputValue(),
    challanno: "",
    challandate: null,
    transporterid: 0,
    destinationid: 0,
    lrno: "",
    lrdate: null,
    vehicleno: "",
    vehicletypeid: 0,
    noofperson: 0,
    drivername: "",
    drivercontactno: "",
    driverlicenceno: "",
    companyid: session.companyId,
    yearid: session.yearId,
    loginid: session.loginId,
    userid: session.userId,
    idnumber: recordId,
  });

  // trandate/billdate default to today on a new record; existing records keep
  // their loaded date. basedonid still has no default — client requirement
  // 2026-07-24 remains for that dropdown.
  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return {
      ...GRN_FILTER_INITIAL_VALUES,
      trandate: getTodayDateInputValue(),
      billdate: getTodayDateInputValue(),
    };
  }, [loadedFilterValues]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [currencyExternalValues, setCurrencyExternalValues] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState("items");
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const activeSelectionCount = activeTab === "items" ? itemSelectionCount : 0;
  const [approvedFilter, setApprovedFilter] = useState("all");
  const [isGridLoading, setIsGridLoading] = useState(false);

  const [childRowsMap, setChildRowsMap] = useState({});
  const [childColumns, setChildColumns] = useState([]);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);
  // Select Item popup filters (Based On = Direct only) — items are only
  // fetched once the user clicks Filter; PO Base branch is untouched.
  const groupFilter = useItemPickerGroupFilter({
    spMainGroup: GRN_CONFIG.SP_ITEM_MAIN_GROUP,
    spSubMainGroup: GRN_CONFIG.SP_ITEM_SUB_MAIN_GROUP,
    formTag: GRN_CONFIG.FORM_TAG,
  });
  const [itemPickerIsDirect, setItemPickerIsDirect] = useState(false);

  const clearItemGridState = useCallback(() => {
    queuedRowsRef.current = [];
    itemGridRef.current?.clearRows?.();
    setItemSelectionCount(0);
    setChildRowsMap({});
    setChildColumns([]);
    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);
  }, []);

  const refreshItemGridMeta = useCallback(
    async (divisionId) => {
      gridColumnsLoadedRef.current = false;
      const cols = await fetchGridColumns(divisionId ?? headerValuesRef.current?.divisionid ?? 0, {
        existingRecordEdit: isEditRoute,
        masterRow: loadedMasterRow,
        fetchUnlockedDropdowns: true,
      });
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
      return cols;
    },
    [fetchGridColumns, isEditRoute, isEditMode, loadedMasterRow]
  );

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

  const resetFormToInitialState = useCallback(() => {
    localStorage.removeItem(GRN_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(GRN_CONFIG.STORAGE_ENTRY_META);
    localStorage.removeItem(GRN_CONFIG.STORAGE_INDT_META);
    sessionStorage.removeItem(GRN_CONFIG.STORAGE_HEADER_META);
    sessionStorage.removeItem(GRN_CONFIG.STORAGE_ENTRY_META);
    sessionStorage.removeItem(GRN_CONFIG.STORAGE_INDT_META);

    const resetSession = getUserSession();
    headerValuesRef.current = {
      trancode: "",
      trandate: getTodayDateInputValue(),
      configid: 0,
      divisionid: 0,
      supplierid: 0,
      currencyid: "",
      currencyrate: "",
      basedonid: "",
      billno: "",
      billdate: getTodayDateInputValue(),
      challanno: "",
      challandate: null,
      transporterid: 0,
      destinationid: 0,
      lrno: "",
      lrdate: null,
      vehicleno: "",
      vehicletypeid: 0,
      noofperson: 0,
      drivername: "",
      drivercontactno: "",
      driverlicenceno: "",
      companyid: resetSession.companyId,
      yearid: resetSession.yearId,
      loginid: resetSession.loginId,
      userid: resetSession.userId,
      idnumber: 0,
    };

    queuedRowsRef.current = [];
    gridColumnsLoadedRef.current = false;
    clearGrnTypes();
    clearSuppliers();
    clearTransporters();
    clearIndentDetailMeta();

    setActiveTab("items");
    setApprovedFilter("all");
    setIsGridLoading(false);
    setCurrencyExternalValues({ currencyname: "", currencyrate: "" });
    clearItemGridState();
    setFilterResetKey((k) => k + 1);
    exitEditMode();
  }, [
    clearGrnTypes,
    clearSuppliers,
    clearTransporters,
    clearIndentDetailMeta,
    clearItemGridState,
    exitEditMode,
  ]);

  const completeSuccessfulSave = useCallback(() => {
    if (isEditRoute) navigate(GRN_CONFIG.ROUTE_PATH);
    else resetFormToInitialState();
  }, [isEditRoute, navigate, resetFormToInitialState]);

  usePageHeader({
    title: isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then use the Item Grid tab."
      : `GRN #${recordId || routeId || "—"} — fill in the header fields, then use the Item Grid tab.`,
    showBack: true,
    backTo: GRN_CONFIG.ROUTE_PATH,
  });

  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta, isEditRoute]);

  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);

    try {
      const params = resolveEditLoadParams(recordId, listRecord);
      const { master, headerValues, details, childRowsMap: loadedChildMap } =
        await fetchEditRecord(params);

      if (!master || !headerValues) throw new Error("GRN record not found.");

      headerValuesRef.current = headerValues;
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues, master));
      setFilterResetKey((k) => k + 1);

      const divisionId = headerValues.divisionid ?? 0;
      if (divisionId) {
        // fetchDivisionOptions is unconditional here (and not gated behind
        // isEditMode via fetchUnlockedHeaderDropdowns) — the Division
        // SearchSelect needs a matching option to resolve/display its label
        // even in read-only view, same reason location/supplier/transporter
        // are already fetched eagerly on edit-record load.
        await Promise.all([
          fetchDivisionOptions(),
          fetchGrnTypes(divisionId),
          fetchSupplierOptions(divisionId),
          fetchTransporterOptions(divisionId),
          fetchLocationOptions(divisionId),
        ]);
        if (headerValues.transporterid) {
          await fetchDestinationOptions(divisionId, headerValues.transporterid);
        }
      }

      const activeCols = await fetchGridColumns(divisionId, editRecordGridColumnOpts(master));
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;

      if (Object.keys(loadedChildMap).length > 0) {
        const indentChildColumns = await fetchIndentDetailColumns();
        setChildColumns(indentChildColumns.filter((c) => c.key !== "cb"));
        setChildRowsMap(loadedChildMap);
      }

      const syncedDetails = syncEditGridDropdownValues(details, activeCols || []);

      if (itemGridRef.current?.loadRows) itemGridRef.current.loadRows(syncedDetails);
      else queuedRowsRef.current = syncedDetails;
    } catch (err) {
      console.error("[GRN] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load GRN record.");
    } finally {
      setRecordLoading(false);
    }
  }, [
    recordId,
    listRecord,
    fetchEditRecord,
    fetchGridColumns,
    fetchDivisionOptions,
    fetchGrnTypes,
    fetchSupplierOptions,
    fetchTransporterOptions,
    fetchDestinationOptions,
    fetchLocationOptions,
    fetchIndentDetailColumns,
  ]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode || !loadedMasterRow) return;
    const divisionId = headerValuesRef.current?.divisionid ?? loadedMasterRow?.divisionid ?? 0;
    const transporterId =
      headerValuesRef.current?.transporterid ?? loadedMasterRow?.transporterid ?? 0;
    fetchUnlockedHeaderDropdowns(divisionId, transporterId);
    fetchGridColumns(divisionId, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
  }, [isEditRoute, isEditMode, loadedMasterRow, fetchUnlockedHeaderDropdowns, fetchGridColumns]);

  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(headerValuesRef.current?.divisionid ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns, fetchGridColumns, isEditRoute]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || allColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, allColumns.length, loadEditRecord]);

  useEffect(() => {
    if (columns.length > 0 && itemGridRef.current && queuedRowsRef.current.length > 0) {
      if (itemGridRef.current.loadRows) itemGridRef.current.loadRows(queuedRowsRef.current);
      else queuedRowsRef.current.forEach((r) => itemGridRef.current.addRow(r));
      queuedRowsRef.current = [];
    }
  }, [columns]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  // ── Multi-value paste — Sr. No replication ──────────────────────
  const handleMultiValuePaste = useCallback((sourceRow, colKey, values) => {
    itemGridRef.current?.updateRow?.(sourceRow.id, { [colKey]: values[0] });
    values.slice(1).forEach((val) => {
      addItemRow({ ...sourceRow, id: nextTempId(), [colKey]: val });
    });
  }, [addItemRow]);

  // Always attach the fully-fetched options list (real names) regardless of
  // lock/edit state — mirrors Purchase Order's DROPDOWN_OPTIONS_BY_COL pattern.
  // Avoids depending on live ctrlvaluecol/ctrldisplaycol RB metadata, which is
  // blank for several GRN header columns (configid, supplierid, ...) and was
  // causing locked/edit-mode fields to display raw IDs instead of names.
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    divisionid: divisionOptions,
    configid: grnTypeOptions,
    supplierid: supplierOptions,
    basedonid: GRN_CONFIG.BASED_ON_OPTIONS,
    transporterid: transporterOptions,
    destinationid: destinationOptions,
    locationid: locationOptions,
  }), [divisionOptions, grnTypeOptions, supplierOptions, transporterOptions, destinationOptions, locationOptions]);

  // Filter definitions are built straight from the live RB column (caption,
  // control type, lock state, validation constraints) — no hand-maintained
  // field list to fall out of sync with the RB. Mirrors Purchase Indent's
  // syncedFilters. Only `staticOptions` (division/supplier/etc. dropdown data
  // we fetch ourselves) is layered on top, keyed by colname.
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

  // Visible RB columns, RB-ordered, partitioned by which of GRN's three tabs
  // they belong to. Tab membership is the one thing the RB can't tell us —
  // see GRN_TRANSPORTER_FIELD_NAMES/GRN_DRIVER_FIELD_NAMES in constants.js.
  const visibleHeaderColumns = useMemo(() => {
    return headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible))
      .sort((a, b) => Number(a.colseqno) - Number(b.colseqno));
  }, [headerColumns]);

  const syncedHeaderFilters = useMemo(() => {
    return visibleHeaderColumns
      .filter(
        (col) => !GRN_TRANSPORTER_FIELD_NAMES.has(col.colname) && !GRN_DRIVER_FIELD_NAMES.has(col.colname)
      )
      .map(buildFilterDefFromApiCol);
  }, [visibleHeaderColumns, buildFilterDefFromApiCol]);

  const syncedTransporterFilters = useMemo(() => {
    return visibleHeaderColumns
      .filter((col) => GRN_TRANSPORTER_FIELD_NAMES.has(col.colname))
      .map(buildFilterDefFromApiCol);
  }, [visibleHeaderColumns, buildFilterDefFromApiCol]);

  const syncedDriverFilters = useMemo(() => {
    return visibleHeaderColumns
      .filter((col) => GRN_DRIVER_FIELD_NAMES.has(col.colname))
      .map(buildFilterDefFromApiCol);
  }, [visibleHeaderColumns, buildFilterDefFromApiCol]);

  const buildFieldTones = useCallback(
    (filters) => {
      const tones = {};
      filters.forEach((f) => {
        let tone = "editable";
        if (!isEditMode) tone = "view";
        else if (isEditRoute && f.lockOnEditMode) tone = "frozen";

        tones[f.FilterColName] = tone;
        if (f.FilterParameterID) tones[f.FilterParameterID] = tone;
      });
      return tones;
    },
    [isEditMode, isEditRoute]
  );

  const headerFieldTones = useMemo(
    () => buildFieldTones(syncedHeaderFilters),
    [syncedHeaderFilters, buildFieldTones]
  );
  const transporterFieldTones = useMemo(
    () => buildFieldTones(syncedTransporterFilters),
    [syncedTransporterFilters, buildFieldTones]
  );
  const driverFieldTones = useMemo(
    () => buildFieldTones(syncedDriverFilters),
    [syncedDriverFilters, buildFieldTones]
  );

  const handleFilterChange = useCallback(
    async (colName, val) => {
      if (GRN_ITEM_PICKER_CONTEXT_FIELDS.has(colName)) {
        clearItemGridState();
      }

      headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

      if (colName === "supplierid") {
        void refreshItemGridMeta(headerValuesRef.current.divisionid);
        if (!val || val === "0") {
          headerValuesRef.current.currencyid = "";
          headerValuesRef.current.currencyrate = "";
          setCurrencyExternalValues({ currencyname: "", currencyrate: "" });
          return buildCurrencyPatchFromSupplier(null);
        }
        const supplier = getSupplierRow(val);
        if (supplier) {
          headerValuesRef.current.currencyid = supplier.currencyid ?? supplier.CurrencyID ?? 0;
          headerValuesRef.current.currencyrate = supplier.currencyrate ?? supplier.CurrencyRate ?? "";
          const patch = buildCurrencyPatchFromSupplier(supplier);
          setCurrencyExternalValues(patch);
          return patch;
        }
        return undefined;
      }

      if (colName === "divisionid") {
        headerValuesRef.current.configid = 0;
        headerValuesRef.current.locationid = 0;
        headerValuesRef.current.supplierid = 0;
        headerValuesRef.current.currencyid = "";
        headerValuesRef.current.currencyrate = "";
        headerValuesRef.current.transporterid = 0;
        headerValuesRef.current.destinationid = 0;
        setCurrencyExternalValues({ currencyname: "", currencyrate: "" });
        clearGrnTypes();
        clearLocations();
        clearSuppliers();
        clearTransporters();
        void refreshItemGridMeta(val);
        if (val && val !== "0") {
          await Promise.all([
            fetchGrnTypes(val),
            fetchLocationOptions(val),
            fetchSupplierOptions(val),
            fetchTransporterOptions(val),
          ]);
          focusFieldAfterCascade(filterPanelRef, "configid");
        }
        return buildCurrencyPatchFromSupplier(null);
      }

      if (colName === "transporterid") {
        headerValuesRef.current.destinationid = 0;
        clearDestinations();
        if (val && val !== "0") {
          const divisionId = headerValuesRef.current.divisionid;
          if (divisionId) void fetchDestinationOptions(divisionId, val);
        }
        return { destinationid: "" };
      }

      if (colName === "basedonid") {
        void refreshItemGridMeta(headerValuesRef.current.divisionid);
      }

      return undefined;
    },
    [
      getSupplierRow,
      clearGrnTypes,
      clearLocations,
      clearSuppliers,
      clearTransporters,
      clearDestinations,
      clearItemGridState,
      refreshItemGridMeta,
      fetchGrnTypes,
      fetchLocationOptions,
      fetchSupplierOptions,
      fetchTransporterOptions,
      fetchDestinationOptions,
    ]
  );

  const ensureItemColumns = useCallback(async () => {
    if (gridColumnsLoadedRef.current && columns.length > 0) return columns;
    if (allColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const activeCols = await fetchGridColumns(headerValuesRef.current?.divisionid ?? 0, {
        existingRecordEdit: isEditRoute,
        masterRow: loadedMasterRow,
        fetchUnlockedDropdowns: true,
      });
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [columns, allColumns, fetchGridColumns, isEditRoute, isEditMode, loadedMasterRow]);

  // Direct (basedonid 0) defers the item fetch until Filter is clicked — PO
  // Base (1) fetches immediately, unchanged. Client instruction 2026-07-28,
  // same rollout as Purchase Indent. (Indent-wise/3 is disabled in this
  // module — see BASED_ON_OPTIONS — so only these two branches are live.)
  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues, headerColumns);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }

    const loginId = getUserSession().loginId;
    const rbCode = resolveItemPickerRbCode(headerValues.basedonid);
    const itemPickerSp = resolveItemPickerSpName(headerValues.basedonid);
    const isDirect = Number(headerValues.basedonid) !== 1;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);
    groupFilter.resetFilter();
    setItemPickerIsDirect(isDirect);

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: GRN_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: rbCode }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.rbid,
        prmLoginID: loginId,
      });
      setItemModalColumns(
        buildGridColumns(colRes || [], {}, { filterable: false, allEditable: false })
      );

      if (isDirect) {
        await groupFilter.fetchMainGroupOptions({ divisionId: headerValues.divisionid, configId: headerValues.configid });
      } else {
        const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: itemPickerSp,
          JSon: JSON.stringify([buildItemPickerJsonPayload(headerValues, loginId)]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        setItemModalItems(rowRes || []);
      }
    } catch (err) {
      console.error("[GRN] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, headerColumns, groupFilter]);

  // Direct-mode item fetch — deferred until Filter is clicked. Main/Sub Main
  // Group aren't sent to SP_ITEM_PICKER_DIRECT yet — see constants.js
  // DBA-CONFIRM note (SP doesn't accept these params yet, live-confirmed).
  // Main/Sub Main Group ARE now sent — live-confirmed 2026-07-28 (previously
  // threw "Must declare the scalar variable ..."; that's gone).
  const handleApplyItemFilter = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const loginId = getUserSession().loginId;

    setItemModalError(null);
    try {
      await groupFilter.applyFilter(async () => {
        const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: GRN_CONFIG.SP_ITEM_PICKER_DIRECT,
          JSon: JSON.stringify([{
            ...buildItemPickerJsonPayload(headerValues, loginId),
            prmmaingroupid: Number(groupFilter.mainGroupFilter) || 0,
            prmsubmaingroupid: Number(groupFilter.subMainGroupFilter) || 0,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        setItemModalItems(rowRes || []);
      });
    } catch (err) {
      console.error("[GRN] Item filter fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    }
  }, [getLive, groupFilter]);

  // Fire-and-forget from EntryGrid's blur (it never awaits onCellEvent), but
  // track the promise so handleSave can await it — otherwise Save immediately
  // after editing an event column (without tabbing away) POSTs before the
  // fire-event response updates the row.
  const handleCellEvent = useCallback(
    ({ rowId, colKey, rowData }) =>
      trackCellEvent(async () => {
        const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
        if (!result || !itemGridRef.current) return;
        const responseRow = result?.[0];
        if (!responseRow) return;
        const errCode = responseRow.errcode;
        if (errCode !== 1 && errCode !== 1.0) {
          console.warn("[GRN] Cell-event error:", responseRow.errmsg ?? `ErrCode ${errCode}`);
          return;
        }
        const { errcode, errmsg, ...updatedFields } = responseRow;
        itemGridRef.current.updateRow?.(rowId, updatedFields);
      }),
    [fireCellEvent, trackCellEvent]
  );

  const handleInsertItems = useCallback(
    async (selectedItems) => {
      if (!selectedItems?.length) return;
      setActiveTab("items");

      const isIndentBase = Number(headerValuesRef.current?.basedonid) === 3;

      if (!isIndentBase) {
        const activeCols = await ensureItemColumns();
        if (!activeCols?.length) return;
        setChildRowsMap({});
        setChildColumns([]);
        const rows = selectedItems.map((item) => mapPickerToItemRow(item, allColumns));
        rows.forEach((row) => addItemRow(row));
        // Fire the same qty/rate recalc a manual blur would trigger, so a
        // picker-inserted row's calculated amounts are correct immediately
        // instead of staying 0.00 until the user touches the cell (client-
        // confirmed 2026-07-24, same fix as the Purchase family forms).
        await Promise.all(rows.map((row) => handleCellEvent({ rowId: row.id, colKey: "tranqty", rowData: row })));
        return;
      }

      ensureItemColumns().catch(() => { });

      const cleanItems = selectedItems.map(({ id: _id, ...rest }) => rest);

      setIsGridLoading(true);
      try {
        const summaryRes = await post(ENDPOINTS.API_VALUES, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: GRN_CONFIG.SP_INDENT_SUMMARY,
          JSon: [{ prmJSon: cleanItems }],
          p_ErrCode: -1,
          p_ErrMsg: "",
        });

        const parents = summaryRes ?? [];
        if (!parents.length) return;

        const indentChildColumns = await fetchIndentDetailColumns();

        const newChildRowsMap = {};
        parents.forEach((parent) => {
          const pid = String(Math.round(Number(parent.ItemID)));
          const children = cleanItems.filter(
            (c) => String(Math.round(Number(c.ChildFKey))) === pid
          );
          if (children.length > 0) newChildRowsMap[pid] = children;
          addItemRow({ ...parent, id: pid });
        });

        setChildRowsMap((prev) => ({ ...prev, ...newChildRowsMap }));
        setChildColumns(indentChildColumns.filter((c) => c.key !== "cb"));
      } catch (err) {
        console.error("[GRN] Indent summary fetch failed:", err);
      } finally {
        setIsGridLoading(false);
      }
    },
    [ensureItemColumns, allColumns, addItemRow, fetchIndentDetailColumns, post, handleCellEvent]
  );

  const handleDeleteSelected = useCallback(() => {
    if (!itemGridRef.current) return;
    const selected = itemGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    const removedIds = new Set(selected.map((r) => String(r.id)));
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
    if (Object.keys(childRowsMap).length > 0) {
      setChildRowsMap((prev) => {
        const next = { ...prev };
        removedIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
    }
  }, [childRowsMap]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(
    async ({ skipPostSave = false } = {}) => {
      // Force blur so EntryGrid fires any pending cell-event for the active cell,
      // then await that recalculation before reading rows for the save payload.
      await flushPendingCellEvents(itemGridSectionRef);

      setFormErrors([]);
      const hv = headerValuesRef.current;

      // Validate every RB-visible header field, not a hand-maintained subset —
      // a field missing from a static list (like locationid was) must never be
      // silently skipped at save time just because nobody remembered to list it.
      const headerErrors = validateApiColumns(hv, visibleHeaderColumns, {
        zeroValidFields: new Set(["basedonid"]),
      });

      const itemRows = itemGridRef.current?.getRows?.() ?? [];
      const detailErrors = validateGridRows(itemRows, columns, { requireAtLeastOne: true });

      const indentChildRows = Object.values(childRowsMap).flat();
      const indentErrors = validateGridRows(indentChildRows, childColumns);

      const allErrors = [...headerErrors, ...detailErrors, ...indentErrors];
      if (allErrors.length > 0) {
        setFormErrors(allErrors);
        return false;
      }

      const userSession = getUserSession();
      const masterColumnDefs = headerColumns.map((col) => ({
        key: col.colname,
        colDataType: col.coldatatype || null,
      }));
      const mstRow = buildSaveRowFromColumns(hv, masterColumnDefs, {
        loginid: userSession.loginId,
        userid: userSession.userId,
      });

      const sessionFields = { loginid: userSession.loginId, userid: userSession.userId };
      const detRows = itemRows.map(({ id, ...rest }) =>
        buildSaveRowFromColumns(rest, allColumns, sessionFields)
      );

      const indentDetailRows = indentChildRows.map(({ id: _id, ...rest }) =>
        buildSaveRowFromColumns(rest, allIndentColumns, sessionFields)
      );

      const payload = await withSaveContextFields(
        buildSaveJsonFields({
          label: "GRN",
          mst: mstRow,
          det: detRows,
          indtDet: indentDetailRows,
        }),
        { divisionId: hv.divisionid, isEdit: isEditRoute }
      );

      setIsSaving(true);
      try {
        const result = await post(GRN_CONFIG.SAVE_ENDPOINT, payload);
        const { success, message } = parseApiErrMsg(result);
        if (!success) { setFormErrors([message]); return false; }
        notify.success(message);
        if (!skipPostSave) completeSuccessfulSave();
        return true;
      } catch (err) {
        console.error("[GRN Save] Failed:", err);
        notify.error(err?.message || "Save failed. Please try again.");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      headerColumns,
      visibleHeaderColumns,
      allColumns,
      allIndentColumns,
      childRowsMap,
      childColumns,
      columns,
      post,
      completeSuccessfulSave,
      isEditRoute,
      flushPendingCellEvents,
    ]
  );

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave({ skipPostSave: true });
    if (!saved) return;
    window.print();
    completeSuccessfulSave();
  }, [handleSave, completeSuccessfulSave]);

  const [discardOpen, setDiscardOpen] = useState(false);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);

    if (isEditRoute) {
      exitEditMode();
      setChildRowsMap({});
      setChildColumns([]);
      editRecordLoadedRef.current = false;
      loadEditRecord();
      return;
    }

    resetFormToInitialState();
  }, [exitEditMode, isEditRoute, loadEditRecord, resetFormToInitialState]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "items") handleSelectItem();
  }, [activeTab, handleSelectItem]);

  const handleToggleCollapsible = useCallback(() => {
    itemGridRef.current?.toggleFocusedRowCollapsible?.();
  }, []);

  const itemGridConfig = {
    columns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const combinedError = metaError || headerError || recordLoadError;
  const filterPanelLoading = headerFetching || recordLoading;
  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy =
    filterPanelLoading ||
    isLoadingGrnTypes ||
    isLoadingSuppliers ||
    isLoadingTransporters ||
    isLoadingDestinations ||
    isLoadingLocations;

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
    onToggleCollapsible: handleToggleCollapsible,
  });

  const grnExtraButtons = useMemo(
    () => [
      {
        key: "saveprint",
        label: "Save & Print",
        Icon: Printer,
        variant: "print",
        onClick: handleSaveAndPrint,
        disabled: isSaving,
        accessKey: "p",
        title: FORM_SHORTCUT_TITLES.savePrint,
      },
      {
        key: "save",
        label: isSaving ? "Saving…" : "Save",
        Icon: Save,
        variant: "save",
        onClick: () => handleSave(),
        disabled: isSaving,
        loading: isSaving,
        accessKey: "s",
        title: FORM_SHORTCUT_TITLES.save,
      },
    ],
    [handleSaveAndPrint, isSaving, handleSave]
  );

  // Direct mode only — PO Base items fetch immediately, no filter step.
  const itemFilterBar = !itemPickerIsDirect ? null : (
    <ItemPickerGroupFilterBar
      mainGroupOptions={groupFilter.mainGroupOptions}
      subMainGroupOptions={groupFilter.subMainGroupOptions}
      mainGroupValue={groupFilter.mainGroupFilter}
      subMainGroupValue={groupFilter.subMainGroupFilter}
      onMainGroupChange={(value) => groupFilter.handleMainGroupChange(value, {
        divisionId: headerValuesRef.current.divisionid,
        configId: headerValuesRef.current.configid,
      })}
      onSubMainGroupChange={groupFilter.setSubMainGroupFilter}
      onFilter={handleApplyItemFilter}
      filterLoading={groupFilter.filterLoading}
    />
  );

  return (
    <div className="workspace-page workspace-page--fill grn-page">
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
            <button
              type="button"
              onClick={() => {
                fetchHeaderMeta();
                fetchDetailMeta();
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            panelRef={filterPanelRef}
            title="Goods Received Note Detail"
            staticFilters={syncedHeaderFilters}
            initialValues={filterInitialValues}
            cascadeResets={GRN_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            isSearching={filterPanelLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterPanelLoading || !headerMetaReady}
            fieldTones={headerFieldTones}
            externalValues={currencyExternalValues}
            onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
          />
        )}
      </section>

      <section className="grn-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={GRN_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchable={activeTab === "items"}
          hideBottomPanel
          headerControls={
            activeTab === "items" ? (
              <>
                <button
                  ref={selectItemBtnRef}
                  type="button"
                  className="eg-tab-btn"
                  onClick={handleSelectItem}
                  disabled={!isEditMode}
                  title={FORM_SHORTCUT_TITLES.selectList}
                >
                  <Package size={12} strokeWidth={2.5} />
                  Select Item
                </button>

                <div className="grn-tab-filter">
                  <span className="grn-tab-filter__label">Approved</span>
                  <SearchSelect
                    value={approvedFilter}
                    onChange={setApprovedFilter}
                    options={APPROVED_OPTS}
                    compact
                    ariaLabel="Approved filter"
                  />
                </div>
                <button
                  type="button"
                  className="eg-tab-btn eg-tab-btn--danger"
                  onClick={handleDeleteSelected}
                  disabled={!isEditMode || activeSelectionCount === 0}
                  title="Delete selected rows"
                >
                  <Trash2 size={12} strokeWidth={2} />
                  Delete
                </button>
              </>
            ) : null
          }
          tabPanes={{
            transporter: (
              <EnterpriseFilterPanel
                key={`transporter-${filterResetKey}`}
                title="Transporter Detail"
                staticFilters={syncedTransporterFilters}
                initialValues={filterInitialValues}
                cascadeResets={{ transporterid: ["destinationid"] }}
                onFilterChange={handleFilterChange}
                isSearching={filterPanelLoading}
                isMetaLoading={!headerMetaReady || recordLoading}
                disabled={filterPanelLoading || !headerMetaReady}
                fieldTones={transporterFieldTones}
              />
            ),
            driver: (
              <EnterpriseFilterPanel
                key={`driver-${filterResetKey}`}
                title="Driver Detail"
                staticFilters={syncedDriverFilters}
                initialValues={filterInitialValues}
                onFilterChange={handleFilterChange}
                isSearching={filterPanelLoading}
                isMetaLoading={!headerMetaReady || recordLoading}
                disabled={filterPanelLoading || !headerMetaReady}
                fieldTones={driverFieldTones}
              />
            ),
          }}
          readOnly={isEditRoute && !isEditMode}
          emptyMessage="No items yet. Click Select Item above."
          onSelectionChange={setItemSelectionCount}
          onCellEvent={handleCellEvent}
          eventColumns={eventColumns}
          enableCollapsible={Object.keys(childRowsMap).length > 0}
          childRowsMap={childRowsMap}
          childColumns={childColumns}
          existingRecordEdit={isEditRoute && isEditMode}
          multiValuePasteColumns={GRN_MULTI_PASTE_COLUMNS}
          onMultiValuePaste={handleMultiValuePaste}
          remarkModalColumns={GRN_REMARK_COLUMNS}
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
        extraButtons={grnExtraButtons}
      />

      <Suspense fallback={null}>
        <OrderItemModal
          isOpen={itemModalOpen}
          onClose={() => setItemModalOpen(false)}
          items={itemModalItems}
          columns={itemModalColumns}
          isLoading={itemModalLoading || groupFilter.filterLoading}
          error={itemModalError}
          onInsert={handleInsertItems}
          filterBar={itemFilterBar}
          awaitingFilter={itemPickerIsDirect && !groupFilter.filterApplied}
        />
      </Suspense>
    </div>
  );
}
