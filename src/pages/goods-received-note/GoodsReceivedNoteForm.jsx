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
// Item picker RB follows BasedOnID ('0' Direct | '1' PO | '3' Indent).

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, FileText, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import SearchSelect from "../../components/ui/SearchSelect";
import { useGoodsReceivedNote } from "../../hooks/useGoodsReceivedNote";
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
  buildHeaderColMap,
  resolveHeaderApiCol,
} from "../../utils/gridUtils";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { focusFieldAfterCascade } from "../../utils/focusUtils";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  GRN_CONFIG,
  GRN_MULTI_PASTE_COLUMNS,
  GRN_REMARK_COLUMNS,
  GRN_HEADER_FILTERS,
  GRN_TRANSPORTER_FILTERS,
  GRN_DRIVER_FILTERS,
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
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);
  const { post } = useApi(API_BASE_URL_IMS);

  const {
    headerColumns,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    divisionOptions,
    grnTypeOptions,
    supplierOptions,
    transporterOptions,
    destinationOptions,
    fetchGrnTypes,
    clearGrnTypes,
    fetchSupplierOptions,
    clearSuppliers,
    getSupplierRow,
    fetchTransporterOptions,
    fetchDestinationOptions,
    clearTransporters,
    clearDestinations,
    isLoadingGrnTypes,
    isLoadingSuppliers,
    isLoadingTransporters,
    isLoadingDestinations,
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

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const session = getUserSession();

  const headerValuesRef = useRef({
    trancode: "",
    trandate: todayISO,
    configid: 0,
    divisionid: 0,
    supplierid: 0,
    currencyid: "",
    currencyrate: "",
    basedonid: "0",
    billno: "",
    billdate: null,
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

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { ...GRN_FILTER_INITIAL_VALUES, trandate: todayISO };
  }, [loadedFilterValues, todayISO]);

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
      trandate: todayISO,
      configid: 0,
      divisionid: 0,
      supplierid: 0,
      currencyid: "",
      currencyrate: "",
      basedonid: "0",
      billno: "",
      billdate: null,
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
    todayISO,
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
        await Promise.all([
          fetchGrnTypes(divisionId),
          fetchSupplierOptions(divisionId),
          fetchTransporterOptions(divisionId),
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
    fetchGrnTypes,
    fetchSupplierOptions,
    fetchTransporterOptions,
    fetchDestinationOptions,
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
    divisionid:    divisionOptions,
    configid:      grnTypeOptions,
    supplierid:    supplierOptions,
    basedonid:     GRN_CONFIG.BASED_ON_OPTIONS,
    transporterid: transporterOptions,
    destinationid: destinationOptions,
  }), [divisionOptions, grnTypeOptions, supplierOptions, transporterOptions, destinationOptions]);

  const buildFilterDef = useCallback(
    (filter, apiColMap) => {
      const apiCol = resolveHeaderApiCol(filter, apiColMap);
      const lockOnEditMode = apiCol ? isLockOnEditModeCol(apiCol) : false;

      let def = syncHeaderFilterWithApiCol(filter, apiCol, { lockOnEditMode });

      if (apiCol) {
        def.FilterColCtrlType = apiCol.colctrltype;
      }

      const staticOptions = DROPDOWN_OPTIONS_BY_COL[filter.FilterParameterID];
      if (staticOptions) def.staticOptions = staticOptions;

      return def;
    },
    [DROPDOWN_OPTIONS_BY_COL]
  );

  const syncedHeaderFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];
    const apiColMap = buildHeaderColMap(headerColumns);
    return GRN_HEADER_FILTERS
      .filter((filter) =>
        isTruthyApiFlag(resolveHeaderApiCol(filter, apiColMap)?.isvisible)
      )
      .map((filter) => buildFilterDef(filter, apiColMap));
  }, [headerColumns, buildFilterDef]);

  const syncedTransporterFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];
    const apiColMap = buildHeaderColMap(headerColumns);
    return GRN_TRANSPORTER_FILTERS
      .filter((filter) =>
        isTruthyApiFlag(resolveHeaderApiCol(filter, apiColMap)?.isvisible)
      )
      .map((filter) => buildFilterDef(filter, apiColMap));
  }, [headerColumns, buildFilterDef]);

  const syncedDriverFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];
    const apiColMap = buildHeaderColMap(headerColumns);
    return GRN_DRIVER_FILTERS
      .filter((filter) =>
        isTruthyApiFlag(resolveHeaderApiCol(filter, apiColMap)?.isvisible)
      )
      .map((filter) => buildFilterDef(filter, apiColMap));
  }, [headerColumns, buildFilterDef]);

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
        headerValuesRef.current.supplierid = 0;
        headerValuesRef.current.currencyid = "";
        headerValuesRef.current.currencyrate = "";
        headerValuesRef.current.transporterid = 0;
        headerValuesRef.current.destinationid = 0;
        setCurrencyExternalValues({ currencyname: "", currencyrate: "" });
        clearGrnTypes();
        clearSuppliers();
        clearTransporters();
        void refreshItemGridMeta(val);
        if (val && val !== "0") {
          await Promise.all([
            fetchGrnTypes(val),
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
      clearSuppliers,
      clearTransporters,
      clearDestinations,
      clearItemGridState,
      refreshItemGridMeta,
      fetchGrnTypes,
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

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

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

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: itemPickerSp,
        JSon: JSON.stringify([buildItemPickerJsonPayload(headerValues, loginId)]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setItemModalItems(rowRes || []);
    } catch (err) {
      console.error("[GRN] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, headerColumns]);

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
        selectedItems.forEach((item) => addItemRow(mapPickerToItemRow(item, allColumns)));
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
    [ensureItemColumns, allColumns, addItemRow, fetchIndentDetailColumns, post]
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

  const handleCellEvent = useCallback(
    async ({ rowId, colKey, rowData }) => {
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
    },
    [fireCellEvent]
  );

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(
    async ({ skipPostSave = false } = {}) => {
      const hv = headerValuesRef.current;

      const headerFieldNames = new Set([
        ...GRN_HEADER_FILTERS,
        ...GRN_TRANSPORTER_FILTERS,
        ...GRN_DRIVER_FILTERS,
      ].map((f) => f.FilterParameterID));
      const headerColsToValidate = headerColumns.filter((c) => headerFieldNames.has(c.colname));
      const headerErrors = validateApiColumns(hv, headerColsToValidate, {
        zeroValidFields: new Set(["basedonid"]),
      });

      const itemRows = itemGridRef.current?.getRows?.() ?? [];
      const detailErrors = validateGridRows(itemRows, columns);

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
      allColumns,
      allIndentColumns,
      childRowsMap,
      childColumns,
      columns,
      post,
      completeSuccessfulSave,
      isEditRoute,
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
    isLoadingDestinations;

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

      <section className="grn-grid-section">
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {GRN_GRID_TABS.map((t) => (
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
            {activeTab === "items" && (
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
            )}

            {activeTab === "items" && (
              <>
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
            )}
          </div>
        </div>

        <div className={`grn-tab-pane${activeTab === "items" ? " grn-tab-pane--active" : ""}`}>
          <EntryGrid
            ref={itemGridRef}
            config={itemGridConfig}
            title=""
            hideBottomPanel
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
        </div>

        {activeTab === "transporter" && (
          <div className="grn-tab-pane grn-tab-pane--active grn-sub-panel">
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
          </div>
        )}

        {activeTab === "driver" && (
          <div className="grn-tab-pane grn-tab-pane--active grn-sub-panel">
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
          </div>
        )}
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
          isLoading={itemModalLoading}
          error={itemModalError}
          onInsert={handleInsertItems}
        />
      </Suspense>
    </div>
  );
}
