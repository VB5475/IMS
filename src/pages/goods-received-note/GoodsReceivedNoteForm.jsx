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
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import {
  buildGridColumns,
  buildDropdownOptionFromRow,
  editRecordGridColumnOpts,
  isLockOnEditModeCol,
  syncEditGridDropdownValues,
  syncHeaderFilterWithApiCol,
  buildHeaderColMap,
  resolveHeaderApiCol,
} from "../../utils/gridUtils";
import { controlTypeMap } from "../../data/dummyData";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  GRN_CONFIG,
  GRN_HEADER_FILTERS,
  GRN_TRANSPORTER_FILTERS,
  GRN_DRIVER_FILTERS,
  GRN_GRID_TABS,
  GRN_LIST_DROPDOWN_FIELDS,
  GRN_READONLY_FIELDS,
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
    TranCode: headerValues.TranCode ?? "",
    TranDate: headerValues.TranDate ?? "",
    DivisionID: String(headerValues.DivisionID ?? ""),
    ConfigID: String(headerValues.ConfigID ?? ""),
    SupplierID: String(headerValues.SupplierID ?? ""),
    CurrencyID: masterRow?.CurrencyName ?? String(headerValues.CurrencyID ?? ""),
    CurrencyRate: headerValues.CurrencyRate != null ? String(headerValues.CurrencyRate) : "",
    BasedOnID: String(headerValues.BasedOnID ?? "0"),
    BillNo: headerValues.BillNo ?? "",
    BillDate: headerValues.BillDate ?? "",
    ChallanNo: headerValues.ChallanNo ?? "",
    ChallanDate: headerValues.ChallanDate ?? "",
    TransporterID: String(headerValues.TransporterID ?? ""),
    DestinationID: String(headerValues.DestinationID ?? ""),
    LRNo: headerValues.LRNo ?? "",
    LRDate: headerValues.LRDate ?? "",
    VehicleNo: headerValues.VehicleNo ?? "",
    VehicleTypeId: String(headerValues.VehicleTypeId ?? ""),
    NoOfPerson: headerValues.NoOfPerson ?? "",
    DriverName: headerValues.DriverName ?? "",
    DriverContactNo: headerValues.DriverContactNo ?? "",
    DriverLicenceNo: headerValues.DriverLicenceNo ?? "",
  };
}

function buildCurrencyPatchFromSupplier(supplier) {
  if (!supplier) return { CurrencyID: "", CurrencyRate: "" };
  return {
    CurrencyID: supplier.CurrencyName ?? String(supplier.CurrencyID ?? ""),
    CurrencyRate: supplier.CurrencyRate != null ? String(supplier.CurrencyRate) : "",
  };
}

function resolveEditLoadParams(recordId, listRecord) {
  const session = getUserSession();
  return {
    companyId: listRecord?.CompanyID ?? session.companyId ?? DEFAULT_COMPANY_ID,
    yearId: listRecord?.YearID ?? session.yearId ?? GRN_CONFIG.CONFIG_YEAR_ID,
    loginId: listRecord?.LoginID ?? session.loginId,
    sessionId: listRecord?.SessionID ?? listRecord?.SessionId ?? DEFAULT_SESSION_ID,
    idNumber: listRecord?.IDNUMBER ?? listRecord?.IDNumber ?? recordId,
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
    if (k !== "id" && v != null && Object.prototype.hasOwnProperty.call(row, k)) row[k] = v;
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
  const { post: postSave } = useApi(API_BASE_URL_IMS);

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
    TranCode: "",
    TranDate: todayISO,
    ConfigID: 0,
    DivisionID: 0,
    SupplierID: 0,
    CurrencyID: "",
    CurrencyRate: "",
    BasedOnID: "0",
    BillNo: "",
    BillDate: null,
    ChallanNo: "",
    ChallanDate: null,
    TransporterID: 0,
    DestinationID: 0,
    LRNo: "",
    LRDate: null,
    VehicleNo: "",
    VehicleTypeId: 0,
    NoOfPerson: 0,
    DriverName: "",
    DriverContactNo: "",
    DriverLicenceNo: "",
    CompanyID: 1,
    YearID: GRN_CONFIG.DIVISION_YEAR_ID,
    LoginID: session.loginId,
    UserID: session.userId,
    IDNumber: recordId,
  });

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { ...GRN_FILTER_INITIAL_VALUES, TranDate: todayISO };
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
      const cols = await fetchGridColumns(divisionId ?? headerValuesRef.current?.DivisionID ?? 0, {
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
      TranCode: "",
      TranDate: todayISO,
      ConfigID: 0,
      DivisionID: 0,
      SupplierID: 0,
      CurrencyID: "",
      CurrencyRate: "",
      BasedOnID: "0",
      BillNo: "",
      BillDate: null,
      ChallanNo: "",
      ChallanDate: null,
      TransporterID: 0,
      DestinationID: 0,
      LRNo: "",
      LRDate: null,
      VehicleNo: "",
      VehicleTypeId: 0,
      NoOfPerson: 0,
      DriverName: "",
      DriverContactNo: "",
      DriverLicenceNo: "",
      CompanyID: 1,
      YearID: GRN_CONFIG.DIVISION_YEAR_ID,
      LoginID: resetSession.loginId,
      UserID: resetSession.userId,
      IDNumber: 0,
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
    setCurrencyExternalValues({ CurrencyID: "", CurrencyRate: "" });
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
    if (isEditRoute) navigate("/goods-received-note");
    else resetFormToInitialState();
  }, [isEditRoute, navigate, resetFormToInitialState]);

  usePageHeader({
    title: isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then use the Item Grid tab."
      : `GRN #${recordId || routeId || "—"} — fill in the header fields, then use the Item Grid tab.`,
    showBack: true,
    backTo: "/goods-received-note",
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

      const divisionId = headerValues.DivisionID ?? 0;
      if (divisionId) {
        await Promise.all([
          fetchGrnTypes(divisionId),
          fetchSupplierOptions(divisionId),
          fetchTransporterOptions(divisionId),
        ]);
        if (headerValues.TransporterID) {
          await fetchDestinationOptions(divisionId, headerValues.TransporterID);
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
    const divisionId = headerValuesRef.current?.DivisionID ?? loadedMasterRow?.DivisionID ?? 0;
    const transporterId =
      headerValuesRef.current?.TransporterID ?? loadedMasterRow?.TransporterID ?? 0;
    fetchUnlockedHeaderDropdowns(divisionId, transporterId);
    fetchGridColumns(divisionId, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
  }, [isEditRoute, isEditMode, loadedMasterRow, fetchUnlockedHeaderDropdowns, fetchGridColumns]);

  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(headerValuesRef.current?.DivisionID ?? 0).then((cols) => {
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

  const buildFilterDef = useCallback(
    (filter, apiColMap, optionInjectors) => {
      const apiCol = resolveHeaderApiCol(filter, apiColMap);
      const lockOnEditMode = apiCol ? isLockOnEditModeCol(apiCol) : false;
      const forceListDropdown = GRN_LIST_DROPDOWN_FIELDS.has(filter.FilterParameterID);

      let def = syncHeaderFilterWithApiCol(filter, apiCol, { lockOnEditMode });

      if (apiCol) {
        def.FilterColCtrlType = forceListDropdown
          ? controlTypeMap.DROPDOWN
          : (apiCol.ColCtrlType ?? filter.FilterColCtrlType);
      }

      const isDropdownField = forceListDropdown || def.FilterColCtrlType === controlTypeMap.DROPDOWN;

      if (isEditRoute && loadedMasterRow) {
        if (filter.FilterParameterID === "BasedOnID") {
          const basedOnVal = String(
            loadedMasterRow.BasedOnID ?? headerValuesRef.current?.BasedOnID ?? "0"
          );
          if (lockOnEditMode || !isEditMode) {
            const match = GRN_CONFIG.BASED_ON_OPTIONS.find((o) => o.value === basedOnVal);
            def.staticOptions = [{ value: basedOnVal, label: match?.label ?? basedOnVal }];
          } else {
            def.staticOptions = GRN_CONFIG.BASED_ON_OPTIONS;
          }
          return def;
        }

        if (isDropdownField) {
          if (lockOnEditMode || !isEditMode) {
            def.staticOptions = buildDropdownOptionFromRow(apiCol, loadedMasterRow);
          } else {
            return optionInjectors(filter, def);
          }
          return def;
        }
        return def;
      }

      return optionInjectors(filter, def);
    },
    [isEditRoute, loadedMasterRow, isEditMode]
  );

  const syncedHeaderFilters = useMemo(() => {
    const apiColMap = buildHeaderColMap(headerColumns);
    const inject = (filter, baseFilter) => {
      switch (filter.FilterParameterID) {
        case "DivisionID":
          return { ...baseFilter, staticOptions: divisionOptions };
        case "ConfigID":
          return { ...baseFilter, staticOptions: grnTypeOptions };
        case "SupplierID":
          return { ...baseFilter, staticOptions: supplierOptions };
        default:
          return baseFilter;
      }
    };
    if (headerColumns.length === 0) return [];
    return GRN_HEADER_FILTERS.map((f) => buildFilterDef(f, apiColMap, inject));
  }, [headerColumns, divisionOptions, grnTypeOptions, supplierOptions, buildFilterDef]);

  const syncedTransporterFilters = useMemo(() => {
    const apiColMap = buildHeaderColMap(headerColumns);
    const inject = (filter, baseFilter) => {
      switch (filter.FilterParameterID) {
        case "TransporterID":
          return { ...baseFilter, staticOptions: transporterOptions };
        case "DestinationID":
          return { ...baseFilter, staticOptions: destinationOptions };
        default:
          return baseFilter;
      }
    };
    return GRN_TRANSPORTER_FILTERS.map((f) => buildFilterDef(f, apiColMap, inject));
  }, [headerColumns, transporterOptions, destinationOptions, buildFilterDef]);

  const syncedDriverFilters = useMemo(() => {
    const apiColMap = buildHeaderColMap(headerColumns);
    return GRN_DRIVER_FILTERS.map((f) => buildFilterDef(f, apiColMap, (_, def) => def));
  }, [headerColumns, buildFilterDef]);

  const buildFieldTones = useCallback(
    (filters) => {
      const tones = {};
      filters.forEach((f) => {
        const alwaysReadOnly =
          GRN_READONLY_FIELDS.includes(f.FilterColName) ||
          GRN_READONLY_FIELDS.includes(f.FilterParameterID);
        let tone = "editable";
        if (alwaysReadOnly || !isEditMode) tone = "view";
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

      if (colName === "SupplierID") {
        void refreshItemGridMeta(headerValuesRef.current.DivisionID);
        if (!val || val === "0") {
          headerValuesRef.current.CurrencyID = "";
          headerValuesRef.current.CurrencyRate = "";
          setCurrencyExternalValues({ CurrencyID: "", CurrencyRate: "" });
          return buildCurrencyPatchFromSupplier(null);
        }
        const supplier = getSupplierRow(val);
        if (supplier) {
          headerValuesRef.current.CurrencyID = supplier.CurrencyID ?? 0;
          headerValuesRef.current.CurrencyRate = supplier.CurrencyRate ?? "";
          const patch = buildCurrencyPatchFromSupplier(supplier);
          setCurrencyExternalValues(patch);
          return patch;
        }
        return undefined;
      }

      if (colName === "DivisionID") {
        headerValuesRef.current.ConfigID = 0;
        headerValuesRef.current.SupplierID = 0;
        headerValuesRef.current.CurrencyID = "";
        headerValuesRef.current.CurrencyRate = "";
        headerValuesRef.current.TransporterID = 0;
        headerValuesRef.current.DestinationID = 0;
        setCurrencyExternalValues({ CurrencyID: "", CurrencyRate: "" });
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
        }
        return buildCurrencyPatchFromSupplier(null);
      }

      if (colName === "TransporterID") {
        headerValuesRef.current.DestinationID = 0;
        clearDestinations();
        if (val && val !== "0") {
          const divisionId = headerValuesRef.current.DivisionID;
          if (divisionId) void fetchDestinationOptions(divisionId, val);
        }
        return { DestinationID: "" };
      }

      if (colName === "BasedOnID") {
        void refreshItemGridMeta(headerValuesRef.current.DivisionID);
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
      const activeCols = await fetchGridColumns(headerValuesRef.current?.DivisionID ?? 0, {
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
    const missingFields = getMissingItemPickerHeaderFields(headerValues);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }

    const loginId = getUserSession().loginId;
    const rbCode = resolveItemPickerRbCode(headerValues.BasedOnID);
    const itemPickerSp = resolveItemPickerSpName(headerValues.BasedOnID);

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: GRN_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: rbCode }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.Table?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.RBID,
        prmLoginID: loginId,
      });
      setItemModalColumns(
        buildGridColumns(colRes?.Links || [], {}, { filterable: false, allEditable: false })
      );

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: itemPickerSp,
        JSon: JSON.stringify([buildItemPickerJsonPayload(headerValues, loginId)]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setItemModalItems(rowRes?.Table || []);
    } catch (err) {
      console.error("[GRN] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive]);

  const handleInsertItems = useCallback(
    async (selectedItems) => {
      if (!selectedItems?.length) return;
      setActiveTab("items");

      const isIndentBase = Number(headerValuesRef.current?.BasedOnID) === 3;

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
        const summaryResponse = await fetch(`${API_BASE_URL_IMS}${ENDPOINTS.API_VALUES}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ObjType: OBJ_TYPE.FUNCTION,
            ObjName: GRN_CONFIG.SP_INDENT_SUMMARY,
            JSon: [{ prmJSon: cleanItems }],
            p_ErrCode: -1,
            p_ErrMsg: "",
          }),
        });
        const summaryRes = await summaryResponse.json();

        const parents = summaryRes?.Table ?? [];
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
    [ensureItemColumns, allColumns, addItemRow, fetchIndentDetailColumns]
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
      const responseRow = result?.Links?.[0];
      if (!responseRow) return;
      const errCode = responseRow.ErrCode;
      if (errCode !== 1 && errCode !== 1.0) {
        console.warn("[GRN] Cell-event error:", responseRow.ErrMsg ?? `ErrCode ${errCode}`);
        return;
      }
      const { ErrCode, ErrMsg, ...updatedFields } = responseRow;
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
      const headerColsToValidate = headerColumns.filter((c) => headerFieldNames.has(c.ColName));
      const headerErrors = validateApiColumns(hv, headerColsToValidate);

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
        key: col.ColName,
        colDataType: col.ColDataType || null,
      }));
      const mstRow = buildSaveRowFromColumns(hv, masterColumnDefs, {
        LoginID: userSession.loginId,
        UserID: userSession.userId,
      });

      const sessionFields = { LoginID: userSession.loginId, UserID: userSession.userId };
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
        { divisionId: hv.DivisionID, isEdit: isEditRoute }
      );

      setIsSaving(true);
      try {
        const result = await postSave(GRN_CONFIG.SAVE_ENDPOINT, payload);
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
      postSave,
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

  const handleDocument = useCallback(() => {
    console.log("[GRN] Document F6 — reserved for document generation.");
  }, []);

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
        key: "document",
        label: "Document F6",
        Icon: FileText,
        variant: "secondary",
        onClick: handleDocument,
      },
      { key: "sep1", separator: true },
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
    [handleDocument, handleSaveAndPrint, isSaving, handleSave]
  );

  return (
    <div className="workspace-page grn-page">
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
          />
        </div>

        {activeTab === "transporter" && (
          <div className="grn-tab-pane grn-tab-pane--active grn-sub-panel">
            <EnterpriseFilterPanel
              key={`transporter-${filterResetKey}`}
              title="Transporter Detail"
              staticFilters={syncedTransporterFilters}
              initialValues={filterInitialValues}
              cascadeResets={{ TransporterID: ["DestinationID"] }}
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
