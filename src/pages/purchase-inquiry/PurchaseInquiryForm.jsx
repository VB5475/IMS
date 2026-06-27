// PurchaseInquiryForm.jsx
// Purchase Inquiry entry form (add / edit).
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — header fields only (no action buttons)
//   2. pi-grid-section        — custom 3-tab wrapper
//        • Item Grid tab  → EntryGrid (RB_PurInquiryDet)
//                           button: Select Item
//        • Suppliers tab  → EntryGrid (hardcoded SUPPLIER_GRID_CONFIG)
//                           button: Select Supplier
//        • Terms tab      → static terms table (no buttons)
//        Fixed controls (always): Approved filter | Delete
//   3. CollapsibleGrid        — Indent Details
//   4. PIActionBar            — Save / Cancel etc.
//
// Both the Items and Suppliers EntryGrid instances are always mounted (CSS
// show/hide) so their row state is preserved when switching tabs.

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Truck, Trash2, Package, FileText, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import CollapsibleGrid from "../../components/grid/CollapsibleGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
import SupplierPickerModal from "../../components/purchase-inquiry/SupplierPickerModal";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import SearchSelect from "../../components/ui/SearchSelect";
import { usePurchaseInquiry } from "../../hooks/usePurchaseInquiry";
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
import { parseApiErrMsg } from "../../utils/apiResponse";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  PI_CONFIG,
  PI_HEADER_FILTERS,
  PI_GRID_TABS,
  APPROVED_OPTS,
  TERMS_COLUMNS,
  INDENT_DETAILS_COLUMNS,
  PI_FILTER_CASCADE_RESETS,
  PI_ITEM_PICKER_CONTEXT_FIELDS,
  SUPPLIER_GRID_CONFIG,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  buildItemPickerJsonPayload,
  getMissingItemPickerHeaderFields,
} from "./constants";
import "./PurchaseInquiryForm.css";

// ── Temp-ID generator (negative → never clash with real IDs) ─────────
let _piTempId = -1;
const nextTempId = () => _piTempId--;

// Map a supplier picker row → supplier grid row (hardcoded column keys).
function mapPickerToSupplierRow(item, srNo) {
  return {
    id: String(item.supplierid ?? item.SupplierID ?? nextTempId()),
    SrNo: srNo,
    SupplierName: item.suppliername ?? item.SupplierName ?? "",
    Address: item.suppaddress ?? item.SuppAddress ?? item.address ?? item.Address ?? "",
    City: item.city ?? item.City ?? "",
    MobileNo: item.contactno ?? item.ContactNo ?? item.mobileno ?? item.MobileNo ?? "",
  };
}

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    trancode:     headerValues.trancode ?? "",
    trandate:     headerValues.trandate ?? "",
    divisionid:   String(headerValues.divisionid ?? ""),
    configid:     String(headerValues.configid ?? ""),
    expecteddate: headerValues.expecteddate ?? "",
    deptid:       String(headerValues.deptid ?? ""),
    basedonid:    String(headerValues.basedonid ?? "0"),
    remarks:      headerValues.remarks ?? "",
  };
}

function resolveEditLoadParams(recordId, listRecord) {
  const session = getUserSession();
  return {
    companyId: listRecord?.companyid ?? session.companyId ?? DEFAULT_COMPANY_ID,
    yearId: listRecord?.yearid ?? session.yearId ?? PI_CONFIG.CONFIG_YEAR_ID,
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

// Map an item picker row → items grid row (seeded from allColumns).
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

// ── Component ────────────────────────────────────────────────────────

export default function PurchaseInquiryForm() {
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
  const supplierGridRef = useRef(null);
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
    departmentOptions,
    inquiryTypeOptions,
    fetchInquiryTypes,
    clearInquiryTypes,
    isLoadingInquiryTypes,
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
    saveTxn,
    isSaving,
    saveError,
    clearSaveError,
  } = usePurchaseInquiry(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  // Computed first so both the ref and the filter panel share the same initial date.
  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // TranDate seeded with todayISO so prmTranDate is correct on the first
  // "Select Item" click even before the user touches the date field.
  const session = getUserSession();

  const headerValuesRef = useRef({
    trancode:     "",
    trandate:     todayISO,
    configid:     0,
    expecteddate: null,
    divisionid:   0,
    deptid:       0,
    basedonid:    "0",
    remarks:      "",
    yearid:       PI_CONFIG.DIVISION_YEAR_ID,
    funccode:     PI_CONFIG.RB_MASTER,
    tranmstgenid: 0,
    loginid:      session.loginId,
    sessionid:    DEFAULT_SESSION_ID,
    idnumber:     recordId,
  });

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { basedonid: "0", trandate: todayISO };
  }, [loadedFilterValues, todayISO]);

  // Incrementing this forces EnterpriseFilterPanel to remount and re-apply
  // initialValues, resetting all filter field values visually on Cancel.
  const [filterResetKey, setFilterResetKey] = useState(0);

  // ── Edit-mode gate ─────────────────────────────────────────────────
  // Page starts in read-only mode. Clicking the "Add" footer button enters
  // edit mode; "Cancel" (or the action-bar Cancel) returns to read-only.
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
        if (!focusFirstEditableFilterField()) {
          focusSelectItemButton();
        }
      }, 80);
    });
  }, [focusFirstEditableFilterField, focusSelectItemButton]);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  const resetFormToInitialState = useCallback(() => {
    localStorage.removeItem(PI_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(PI_CONFIG.STORAGE_ENTRY_META);
    localStorage.removeItem(PI_CONFIG.STORAGE_INDT_META);
    sessionStorage.removeItem(PI_CONFIG.STORAGE_HEADER_META);
    sessionStorage.removeItem(PI_CONFIG.STORAGE_ENTRY_META);

    const resetSession = getUserSession();
    headerValuesRef.current = {
      trancode:     "",
      trandate:     todayISO,
      configid:     0,
      expecteddate: null,
      divisionid:   0,
      deptid:       0,
      basedonid:    "0",
      remarks:      "",
      yearid:       PI_CONFIG.DIVISION_YEAR_ID,
      funccode:     PI_CONFIG.RB_MASTER,
      tranmstgenid: 0,
      loginid:      resetSession.loginId,
      sessionid:    DEFAULT_SESSION_ID,
      idnumber:     0,
    };

    queuedRowsRef.current = [];
    gridColumnsLoadedRef.current = false;

    clearInquiryTypes();
    clearSaveError();

    setActiveTab("items");
    setApprovedFilter("all");
    setIsGridLoading(false);
    setIndentRows([]);
    setItemSelectionCount(0);
    setSupplierSelectionCount(0);

    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);

    setChildRowsMap({});
    setChildColumns([]);

    setSupplierModalOpen(false);
    setSupplierModalItems([]);
    setSupplierModalLoading(false);
    setSupplierModalError(null);

    itemGridRef.current?.clearRows?.();
    supplierGridRef.current?.clearRows?.();

    setFilterResetKey((k) => k + 1);
    exitEditMode();
  }, [clearInquiryTypes, clearSaveError, exitEditMode, todayISO]);

  const completeSuccessfulSave = useCallback(() => {
    if (isEditRoute) {
      navigate("/purchase-inquiry");
    } else {
      resetFormToInitialState();
    }
  }, [isEditRoute, navigate, resetFormToInitialState]);

  // ── Tab state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("items");

  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [supplierSelectionCount, setSupplierSelectionCount] = useState(0);
  const activeSelectionCount =
    activeTab === "items"
      ? itemSelectionCount
      : activeTab === "suppliers"
        ? supplierSelectionCount
        : 0;

  const [approvedFilter, setApprovedFilter] = useState("all");
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [indentRows, setIndentRows] = useState([]);

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierModalItems, setSupplierModalItems] = useState([]);
  const [supplierModalLoading, setSupplierModalLoading] = useState(false);
  const [supplierModalError, setSupplierModalError] = useState(null);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);

  // ── Collapsible indent children (indent-wise mode only) ───────────────
  // childRowsMap  — { [parentRowId: string]: selectedIndentRows[] }
  // childColumns  — from RB_PurInquiryIndtDet GET_DETAIL_COL_DATA (indent-wise only)
  const [childRowsMap, setChildRowsMap] = useState({});
  const [childColumns, setChildColumns] = useState([]);

  usePageHeader({
    title: isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then use Item Grid or Suppliers tabs."
      : `Inquiry #${recordId || routeId || "—"} — fill in the header fields, then use Item Grid or Suppliers tabs.`,
    showBack: true,
    backTo: "/purchase-inquiry",
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
      const {
        master,
        headerValues,
        details,
        childRowsMap: loadedChildRowsMap,
      } = await fetchEditRecord(params);

      if (!master || !headerValues) {
        throw new Error("Inquiry record not found.");
      }

      headerValuesRef.current = headerValues;
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      const isIndentWise = Number(headerValues.basedonid) === 2;
      if (isIndentWise && Object.keys(loadedChildRowsMap).length > 0) {
        const indentCols = await fetchIndentDetailColumns();
        setChildColumns(indentCols.filter((c) => c.key !== "cb"));
        setChildRowsMap(loadedChildRowsMap);
      } else {
        setChildColumns([]);
        setChildRowsMap({});
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
      console.error("[PI] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load inquiry record.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, listRecord, fetchEditRecord, fetchIndentDetailColumns, fetchGridColumns]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode || !loadedMasterRow) return;

    const divisionId = headerValuesRef.current?.divisionid ?? loadedMasterRow?.divisionid ?? 0;
    fetchUnlockedHeaderDropdowns(divisionId);
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
      if (itemGridRef.current.loadRows) {
        itemGridRef.current.loadRows(queuedRowsRef.current);
      } else {
        queuedRowsRef.current.forEach((r) => itemGridRef.current.addRow(r));
      }
      queuedRowsRef.current = [];
    }
  }, [columns]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  // ── syncedFilters ─────────────────────────────────────────────────
  const syncedFilters = useMemo(() => {
    const apiColMap = buildHeaderColMap(headerColumns);

    const injectListOptions = (filter, baseFilter) => {
      switch (filter.FilterParameterID) {
        case "divisionid":
          return { ...baseFilter, staticOptions: divisionOptions };
        case "configid":
          return { ...baseFilter, staticOptions: inquiryTypeOptions };
        case "deptid":
          return { ...baseFilter, staticOptions: departmentOptions };
        default:
          return baseFilter;
      }
    };

    const buildFilterDef = (filter) => {
      const apiCol = resolveHeaderApiCol(filter, apiColMap);
      const lockOnEditMode = apiCol ? isLockOnEditModeCol(apiCol) : false;

      let def = syncHeaderFilterWithApiCol(filter, apiCol, { lockOnEditMode });

      if (apiCol) {
        def.FilterColCtrlType = apiCol.colctrltype ?? filter.FilterColCtrlType;
      }

      // Edit route — locked dropdowns from GET_MASTER_DATA_FILL; unlocked use list APIs in edit mode
      if (isEditRoute && loadedMasterRow) {
        if (filter.FilterParameterID === "basedonid") {
          const basedOnVal = String(
            loadedMasterRow.basedonid ?? headerValuesRef.current?.basedonid ?? "0"
          );
          if (lockOnEditMode || !isEditMode) {
            const match = PI_CONFIG.BASED_ON_OPTIONS.find((o) => o.value === basedOnVal);
            def.staticOptions = [{ value: basedOnVal, label: match?.label ?? basedOnVal }];
          } else {
            def.staticOptions = PI_CONFIG.BASED_ON_OPTIONS;
          }
          return def;
        }

        if (apiCol?.colctrltype === 4) {
          if (lockOnEditMode || !isEditMode) {
            def.staticOptions = buildDropdownOptionFromRow(apiCol, loadedMasterRow);
          } else {
            return injectListOptions(filter, def);
          }
          return def;
        }

        return def;
      }

      return injectListOptions(filter, def);
    };

    if (headerColumns.length === 0) return [];
    return PI_HEADER_FILTERS.map(buildFilterDef);
  }, [
    headerColumns,
    divisionOptions,
    inquiryTypeOptions,
    departmentOptions,
    isEditRoute,
    loadedMasterRow,
    isEditMode,
  ]);

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

  /** Clear item EntryGrid + collapsible child rows when item-picker API context changes */
  const clearItemGridState = useCallback(() => {
    itemGridRef.current?.clearRows?.();
    setItemSelectionCount(0);
    queuedRowsRef.current = [];
    setChildRowsMap({});
    setChildColumns([]);
    clearIndentDetailMeta();
    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);
  }, [clearIndentDetailMeta]);

  // ── Filter cascade ─────────────────────────────────────────────────
  const handleFilterChange = useCallback(
    async (colName, val) => {
      if (PI_ITEM_PICKER_CONTEXT_FIELDS.has(colName)) {
        clearItemGridState();
      }

      headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

      if (colName === "divisionid") {
        headerValuesRef.current.configid = 0;
        clearInquiryTypes();
        supplierGridRef.current?.clearRows?.();
        setSupplierSelectionCount(0);
        if (val && val !== "0") await fetchInquiryTypes(val);
      }
    },
    [fetchInquiryTypes, clearInquiryTypes, clearItemGridState]
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

  // ── Select Item (Items tab) ────────────────────────────────────────
  // Flow:
  //   1. Pick RB code by BasedOn ('0'→Direct, '2'→Indent wise)
  //   2. Fetch RBID via Fn_Fetch_RBDetailByRBCode
  //   3. Fetch grid columns via GetDetailColData (read-only, no dropdown fetch)
  //   4. Fetch item rows via SP_ITEM_PICKER_DIRECT | SP_ITEM_PICKER_INDENT (by BasedOn)
  //   5. Open modal — EntryGrid in readOnly mode with those columns + rows
  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }

    const loginId = getUserSession().loginId;
    const BasedOnID = headerValues.basedonid;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      // Step 1 — choose RB code + row-fetch SP by BasedOnID
      const isIndentWise = Number(BasedOnID) === 2;
      const rbCode = isIndentWise
        ? PI_CONFIG.RB_ITEM_PICKER_INDENT
        : PI_CONFIG.RB_ITEM_PICKER_DIRECT;
      const itemPickerSp = isIndentWise
        ? PI_CONFIG.SP_ITEM_PICKER_INDENT
        : PI_CONFIG.SP_ITEM_PICKER_DIRECT;

      // Step 2 — fetch RBID
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: rbCode }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      // Step 3 — fetch columns (read-only: skip dropdown options)
      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.rbid,
        prmLoginID: getUserSession().loginId,
      });
      const gridColumns = buildGridColumns(
        colRes || [],
        {},
        {
          filterable: false,
          allEditable: false,
        }
      );
      setItemModalColumns(gridColumns);

      // Step 4 — fetch item rows (all JSON params validated before this call)
      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: itemPickerSp,
        JSon: JSON.stringify([buildItemPickerJsonPayload(headerValues, loginId)]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setItemModalItems(rowRes || []);
    } catch (err) {
      console.error("[PI] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive]);

  const handleInsertItems = useCallback(
    async (selectedItems) => {
      if (!selectedItems?.length) return;
      setActiveTab("items");

      const isIndentWise = Number(headerValuesRef.current?.basedonid) === 2;

      if (!isIndentWise) {
        // ── Direct mode ───────────────────────────────────────────────────
        // Column definitions must be loaded before we can map rows.
        const activeCols = await ensureItemColumns();
        if (!activeCols?.length) return;
        setChildRowsMap({});
        setChildColumns([]);
        selectedItems.forEach((item) => addItemRow(mapPickerToItemRow(item, allColumns)));
        return;
      }

      // ── Indent-wise mode ─────────────────────────────────────────────
      // 1. API_VALUES → aggregated parent item rows
      // 2. RB_PurInquiryIndtDet → RBID (localStorage) → GET_DETAIL_COL_DATA → child columns
      // 3. Attach selected indent rows from the picker under each parent row
      await ensureItemColumns();

      // Strip synthetic '_row_N' ids before sending to the API.
      const cleanItems = selectedItems.map(({ id: _id, ...rest }) => rest);

      setIsGridLoading(true);
      try {
        const summaryResponse = await fetch(`${API_BASE_URL_IMS}${ENDPOINTS.API_VALUES}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ObjType: OBJ_TYPE.FUNCTION,
            ObjName: PI_CONFIG.SP_INDENT_SUMMARY,
            JSon: [{ prmJSon: cleanItems }],
            p_ErrCode: -1,
            p_ErrMsg: "",
          }),
        });
        const summaryRes = await summaryResponse.json();

        const parents = summaryRes ?? [];
        if (!parents.length) return;

        // Fetch collapsible indent columns from RB_PurInquiryIndtDet.
        const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PI_CONFIG.SP_RB_META,
          JSon: JSON.stringify([{ prmRBCode: PI_CONFIG.RB_INDT_DETAIL }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const rbRow = rbRes?.[0];
        if (!rbRow) throw new Error("Could not load indent detail configuration.");

        const indtMeta = { RBID: rbRow.rbid, SaveProcName: rbRow.saveprocname };
        localStorage.setItem(PI_CONFIG.STORAGE_INDT_META, JSON.stringify(indtMeta));

        const indentChildColumns = await fetchIndentDetailColumns();

        // Build childRowsMap: parent.ItemID → matching selected indent rows.
        // Relationship: child.ChildFKey === parent.ItemID
        const newChildRowsMap = {};
        parents.forEach((parent) => {
          // Normalize first — handles both PascalCase (SQL) and lowercase (PG).
          const normalizedParent = Object.fromEntries(
            Object.entries(parent).map(([k, v]) => [k.toLowerCase(), v])
          );
          const pid = String(Math.round(Number(normalizedParent.itemid)));
          const children = cleanItems.filter(
            (c) => String(Math.round(Number(c.ChildFKey ?? c.childfkey))) === pid
          );
          // Shallow-copy each child and assign a unique id — shared object
          // references caused edits in one row to bleed into all others.
          if (children.length > 0) {
            newChildRowsMap[pid] = children.map((c) => ({ ...c, id: nextTempId() }));
          }
          addItemRow({ ...normalizedParent, id: pid });
        });

        setChildRowsMap((prev) => ({ ...prev, ...newChildRowsMap }));
        setChildColumns(indentChildColumns.filter((c) => c.key !== "cb"));
      } catch (err) {
        console.error("[PI] Indent summary fetch failed:", err);
      } finally {
        setIsGridLoading(false);
      }
    },
    [ensureItemColumns, allColumns, addItemRow, getLive, fetchIndentDetailColumns]
  );

  // ── Select Supplier (Suppliers tab) ──────────────────────────────
  const handleSelectSupplier = useCallback(async () => {
    const divisionID = headerValuesRef.current?.divisionid ?? 0;
    if (!divisionID || divisionID === "0" || divisionID === 0) {
      setFormErrors(["Please select a Division before selecting suppliers."]);
      return;
    }
    setSupplierModalOpen(true);
    setSupplierModalItems([]);
    setSupplierModalError(null);
    setSupplierModalLoading(true);
    try {
      const response = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SUPPLIER_SP,
        JSon: JSON.stringify([
          {
            PrmDivisionId: Number(divisionID),
            PrmLoginId: getUserSession().loginId,
            PrmYearId: PI_CONFIG.CONFIG_YEAR_ID,
            PrmPartyType: PI_CONFIG.SUPPLIER_PARTY_TYPE,
          },
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setSupplierModalItems(
        (response || []).map((row, idx) => ({
          ...row,
          id: String(row.supplierid ?? row.SupplierID ?? `sup_${idx}`),
        }))
      );
    } catch (err) {
      console.error("[PI] Supplier fetch failed:", err);
      setSupplierModalError(err?.message || "Failed to fetch suppliers.");
    } finally {
      setSupplierModalLoading(false);
    }
  }, [getLive]);

  const handleInsertSuppliers = useCallback((selectedSuppliers) => {
    if (!selectedSuppliers?.length) return;
    setActiveTab("suppliers");
    const existing = supplierGridRef.current?.getRows?.() ?? [];
    const existingIds = new Set(existing.map((r) => String(r.supplierid ?? r.SupplierID ?? r.id)));
    let nextSrNo = existing.length;
    selectedSuppliers.forEach((item) => {
      const sid = String(item.supplierid ?? item.SupplierID ?? item.id);
      if (existingIds.has(sid)) return;
      existingIds.add(sid);
      nextSrNo += 1;
      supplierGridRef.current?.addRow(mapPickerToSupplierRow(item, nextSrNo));
    });
  }, []);

  // ── Delete selected rows (active tab's grid) ───────────────────────
  const handleDeleteSelected = useCallback(() => {
    const ref =
      activeTab === "items" ? itemGridRef : activeTab === "suppliers" ? supplierGridRef : null;
    if (!ref?.current) return;
    const selected = ref.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    ref.current.removeRows?.(selected.map((r) => r.id));
    if (activeTab === "suppliers") {
      const remaining = ref.current.getRows?.() ?? [];
      remaining.forEach((row, idx) => {
        if (Object.prototype.hasOwnProperty.call(row, "SrNo")) {
          ref.current.updateRow?.(row.id, { SrNo: idx + 1 });
        }
      });
    }
  }, [activeTab]);

  const handleCellEvent = useCallback(
    async ({ rowId, colKey, rowData }) => {
      const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
      if (!result || !itemGridRef.current) return;
      const responseRow = result?.[0];
      if (!responseRow) return;
      const errCode = responseRow.errcode;
      if (errCode !== 1 && errCode !== 1.0) {
        console.warn("[PI] Cell-event error:", responseRow.errmsg ?? `ErrCode ${errCode}`);
        return;
      }
      const { errcode, errmsg, ...updatedFields } = responseRow;
      itemGridRef.current.updateRow?.(rowId, updatedFields);
    },
    [fireCellEvent]
  );

  // ── Save / Cancel ──────────────────────────────────────────────────
  const [isSavingPI, setIsSavingPI] = useState(false);

  const handleSave = useCallback(
    async ({ skipPostSave = false } = {}) => {
      const hv = headerValuesRef.current;

      // ── Validation (header + detail grids) ───────────────────────────
      const headerFieldNames = new Set(PI_HEADER_FILTERS.map((f) => f.FilterParameterID));
      const headerColsToValidate = headerColumns.filter((c) => headerFieldNames.has(c.colname));
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

      // ── Master ────────────────────────────────────────────────────────
      const mstRow = {};
      headerColumns.forEach((col) => {
        mstRow[col.colname] = getColDefault(col.coldatatype);
      });
      Object.entries(hv).forEach(([k, v]) => {
        if (k !== "id") mstRow[k] = v;
      });
      const session = getUserSession();
      mstRow.loginid = session.loginId;
      mstRow.userid  = session.userId;

      // ── Detail ────────────────────────────────────────────────────────
      const sessionFields = { loginid: session.loginId, userid: session.userId };
      const detRows = itemRows.map(({ id, ...rest }) =>
        buildSaveRowFromColumns(rest, allColumns, sessionFields)
      );

      // ── IndentDetail ──────────────────────────────────────────────────
      const indentDetailRows = indentChildRows.map(({ id: _id, ...rest }) =>
        buildSaveRowFromColumns(rest, allIndentColumns, sessionFields)
      );

      const payload = await withSaveContextFields(
        buildSaveJsonFields({
          label: "PI",
          mst: mstRow,
          det: detRows,
          indtDet: indentDetailRows,
        }),
        { divisionId: hv.divisionid, isEdit: isEditRoute }
      );

      setIsSavingPI(true);
      try {
        const result = await postSave(PI_CONFIG.SAVE_ENDPOINT, payload);
        const { success, message } = parseApiErrMsg(result);
        if (!success) { setFormErrors([message]); return false; }
        notify.success(message);

        if (!skipPostSave) completeSuccessfulSave();
        return true;
      } catch (err) {
        console.error("[PI Save] Failed:", err);
        notify.error(err?.message || "Save failed. Please try again.");
        return false;
      } finally {
        setIsSavingPI(false);
      }
    },
    [headerColumns, allColumns, allIndentColumns, childRowsMap, childColumns, columns, postSave, completeSuccessfulSave, isEditRoute]
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
      supplierGridRef.current?.clearRows?.();
      editRecordLoadedRef.current = false;
      loadEditRecord();
      return;
    }

    resetFormToInitialState();
  }, [exitEditMode, isEditRoute, loadEditRecord, resetFormToInitialState]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  const handleDocument = useCallback(() => {
    console.log("[PI] Document F6 — reserved for document generation.");
  }, []);

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "items") handleSelectItem();
    else if (activeTab === "suppliers") handleSelectSupplier();
  }, [activeTab, handleSelectItem, handleSelectSupplier]);

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
  const filterBusy = filterPanelLoading || isLoadingInquiryTypes;

  useEntryFormKeyboard({
    blocked: itemModalOpen || supplierModalOpen,
    isEditMode,
    isSaving: isSavingPI,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onSavePrint: handleSaveAndPrint,
    onCancel: handleCancel,
    onSelectList: handleSelectListShortcut,
    onToggleCollapsible: handleToggleCollapsible,
  });

  // Extra buttons visible in the ActionBar while in edit mode
  const piExtraButtons = useMemo(
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
        disabled: isSavingPI,
        accessKey: "p",
        title: FORM_SHORTCUT_TITLES.savePrint,
      },
      {
        key: "save",
        label: isSavingPI ? "Saving…" : "Save",
        Icon: Save,
        variant: "save",
        onClick: () => handleSave(),
        disabled: isSavingPI,
        loading: isSavingPI,
        accessKey: "s",
        title: FORM_SHORTCUT_TITLES.save,
      },
    ],
    [handleDocument, handleSaveAndPrint, isSavingPI, handleSave]
  );

  return (
    <div className="workspace-page pi-page">
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
            title="Purchase Inquiry Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={PI_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            isSearching={filterPanelLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterPanelLoading || !headerMetaReady}
            fieldTones={filterFieldTones}
            onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
          />
        )}
      </section>

      <section className="pi-grid-section">
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {PI_GRID_TABS.map((t) => (
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

            {activeTab === "suppliers" && (
              <button
                type="button"
                className="eg-tab-btn"
                onClick={handleSelectSupplier}
                disabled={!isEditMode}
                title={FORM_SHORTCUT_TITLES.selectList}
              >
                <Truck size={12} strokeWidth={2.5} />
                Select Supplier
              </button>
            )}

            <div className="pi-tab-filter">
              <span className="pi-tab-filter__label">Approved</span>
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
          </div>
        </div>

        <div
          className={`pi-tab-pane pi-tab-pane--items${activeTab === "items" ? " pi-tab-pane--active" : ""}`}
        >
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
            existingRecordEdit={isEditRoute}
            containerClassName="pi-item-entry-grid"
          />
        </div>

        <div className={`pi-tab-pane${activeTab === "suppliers" ? " pi-tab-pane--active" : ""}`}>
          <EntryGrid
            ref={supplierGridRef}
            config={SUPPLIER_GRID_CONFIG}
            title=""
            hideBottomPanel
            emptyMessage="No suppliers added. Click Select Supplier above."
            onSelectionChange={setSupplierSelectionCount}
          />
        </div>

        {activeTab === "terms" && (
          <div className="pi-terms-pane">
            <table className="pi-terms-table">
              <thead>
                <tr>
                  {TERMS_COLUMNS.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={TERMS_COLUMNS.length} className="pi-terms-empty">
                    No terms &amp; conditions added.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* <section className="pi-page__section">
        <CollapsibleGrid
          title="Indent Details"
          subtitle="(Select one item row above to load its indent records)"
          columns={INDENT_DETAILS_COLUMNS}
          rows={indentRows}
        />
      </section> */}

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        onCancel={handleCancel}
        addLabel={isEditRoute ? "Edit" : "Add"}
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={piExtraButtons}
      />

      <SupplierPickerModal
        isOpen={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        items={supplierModalItems}
        isLoading={supplierModalLoading}
        error={supplierModalError}
        onInsert={handleInsertSuppliers}
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
