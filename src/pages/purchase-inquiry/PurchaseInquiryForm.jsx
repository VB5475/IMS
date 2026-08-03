// PurchaseInquiryForm.jsx
// Purchase Inquiry entry form (add / edit).
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — header fields only (no action buttons)
//   2. pi-grid-section        — custom 3-tab wrapper
//        • Item Grid tab  → EntryGrid (rb_purinquirydet)
//                           button: Select Item
//        • Suppliers tab  → EntryGrid (RB-driven, rb_purinqsuppdet)
//                           button: Select Supplier
//        • Terms tab      → EntryGrid (RB-driven, rb_purinqtncdet)
//                           button: Select Terms
//        Fixed controls (always): Approved filter | Delete
//   3. CollapsibleGrid        — Indent Details
//   4. PIActionBar            — Save / Cancel etc.
//
// All three detail grids stay mounted for as long as the form is open: the
// Items grid is the EntryGrid itself, and Suppliers/Terms are passed as
// `tabPanes` so EntryGrid only hides the inactive ones. Each pane therefore
// keeps its own rows, selection and scroll position across tab switches.

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Truck, Trash2, Package, FileText, ClipboardList, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import CollapsibleGrid from "../../components/grid/CollapsibleGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import ItemPickerGroupFilterBar from "../../components/txn/ItemPickerGroupFilterBar";
import { useNotification } from "../../context/NotificationContext";
import SupplierPickerModal from "../../components/purchase-inquiry/SupplierPickerModal";
import TermsPickerModal from "../../components/purchase-inquiry/TermsPickerModal";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import SearchSelect from "../../components/ui/SearchSelect";
import { usePurchaseInquiry } from "../../hooks/usePurchaseInquiry";
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
  buildDropdownOptionFromRow,
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
import { getTodayDateInputValue } from "../../utils/dateFormat";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { usePendingCellEventFlush } from "../../hooks/usePendingCellEventFlush";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  PI_CONFIG,
  PI_REMARK_COLUMNS,
  PI_HEADER_FILTERS,
  PI_GRID_TABS,
  APPROVED_OPTS,
  INDENT_DETAILS_COLUMNS,
  PI_FILTER_CASCADE_RESETS,
  PI_ITEM_PICKER_CONTEXT_FIELDS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  buildItemPickerJsonPayload,
  buildTermsPickerJsonPayload,
  getMissingItemPickerHeaderFields,
} from "./constants";
import "./PurchaseInquiryForm.css";

// ── Temp-ID generator (negative → never clash with real IDs) ─────────
let _piTempId = -1;
const nextTempId = () => _piTempId--;

// Row-identity / audit columns present on every rb_purinq*det RB (confirmed
// live on rb_purinqsuppdet: idnumber, masterid, detailid, compuniquekey,
// randomgenid, tranmstgenid, childfkey, entrystatus — all hidden, iseditallow=0).
// These must always come from getColDefault (0 for a brand-new row) or an
// explicit override — never from the picker source object. A picker SP's row
// commonly carries its own "idnumber" (the picked master record's own PK,
// e.g. the supplier's id in Supplier Master) which is a DIFFERENT thing from
// this DETAIL row's own save-identity — silently overlaying it here was
// exactly why supplier rows were saving with a non-zero idnumber in Add mode.
const PICKER_OVERLAY_EXCLUDED_KEYS = new Set([
  "idnumber",
  "masterid",
  "detailid",
  "compuniquekey",
  "randomgenid",
  "tranmstgenid",
  "childfkey",
  "entrystatus",
]);

// Map a picker row → RB-driven grid row (supplier or terms tab). Seeds every
// RB column with its default, applies known key aliases (picker field names
// don't always match the grid RB's ColName, e.g. suppaddress → address), then
// overlays any remaining exact lowercase-key matches — same approach as
// mapPickerToItemRow below, generalized for grids whose columns are RB-driven.
function mapPickerRowToGridRow(item, allGridColumns, aliasMap = {}, overrides = {}) {
  const row = { id: nextTempId() };
  allGridColumns.forEach(({ key, colDataType }) => {
    row[key] = getColDefault(colDataType);
  });
  Object.entries(aliasMap).forEach(([targetKey, sourceKeys]) => {
    if (!Object.prototype.hasOwnProperty.call(row, targetKey)) return;
    for (const sourceKey of sourceKeys) {
      const val = item[sourceKey];
      if (val != null && val !== "") {
        row[targetKey] = val;
        break;
      }
    }
  });
  Object.entries(item).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (lk === "id" || PICKER_OVERLAY_EXCLUDED_KEYS.has(lk)) return;
    if (v != null && Object.prototype.hasOwnProperty.call(row, lk)) row[lk] = v;
  });
  Object.entries(overrides).forEach(([k, v]) => {
    if (Object.prototype.hasOwnProperty.call(row, k)) row[k] = v;
  });
  return row;
}

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    trancode: headerValues.trancode ?? "",
    trandate: headerValues.trandate ?? "",
    divisionid: String(headerValues.divisionid ?? ""),
    configid: String(headerValues.configid ?? ""),
    expecteddate: headerValues.expecteddate ?? "",
    deptid: String(headerValues.deptid ?? ""),
    basedonid: String(headerValues.basedonid ?? "0"),
    remarks: headerValues.remarks ?? "",
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

// Map an item picker row → items grid row (seeded from allColumns).
function mapPickerToItemRow(item, allColumns) {
  const row = { id: nextTempId() };
  allColumns.forEach(({ key, colDataType }) => {
    row[key] = getColDefault(colDataType);
  });
  Object.entries(item).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (lk === "id" || PICKER_OVERLAY_EXCLUDED_KEYS.has(lk)) return;
    if (v != null && Object.prototype.hasOwnProperty.call(row, lk)) row[lk] = v;
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
  const itemGridSectionRef = useRef(null);
  const supplierGridRef = useRef(null);
  const termsGridRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const supplierColumnsLoadedRef = useRef(false);
  const termsColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const queuedSupplierRowsRef = useRef([]);
  const queuedTermsRowsRef = useRef([]);
  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();
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
    supplierColumns,
    allSupplierColumns,
    fetchSupplierDetailMeta,
    fetchSupplierGridColumns,
    termsColumns,
    allTermsColumns,
    fetchTermsDetailMeta,
    fetchTermsGridColumns,
  } = usePurchaseInquiry(API_BASE_URL);

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
    expecteddate: getTodayDateInputValue(),
    divisionid: 0,
    deptid: 0,
    basedonid: "",
    remarks: "",
    yearid: session.yearId,
    funccode: PI_CONFIG.RB_MASTER,
    tranmstgenid: 0,
    loginid: session.loginId,
    sessionid: DEFAULT_SESSION_ID,
    idnumber: recordId,
  });

  // trandate/expecteddate default to today on a new record; existing records
  // keep their loaded date. basedonid still has no default — client requirement
  // 2026-07-24 remains for that dropdown; Select Item is already gated on
  // both being filled (PI_ITEM_PICKER_JSON_FIELDS).
  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { basedonid: "", trandate: getTodayDateInputValue(), expecteddate: getTodayDateInputValue() };
  }, [loadedFilterValues]);

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
    localStorage.removeItem(PI_CONFIG.STORAGE_SUPP_META);
    localStorage.removeItem(PI_CONFIG.STORAGE_TERMS_META);
    sessionStorage.removeItem(PI_CONFIG.STORAGE_HEADER_META);
    sessionStorage.removeItem(PI_CONFIG.STORAGE_ENTRY_META);

    const resetSession = getUserSession();
    headerValuesRef.current = {
      trancode: "",
      trandate: getTodayDateInputValue(),
      configid: 0,
      expecteddate: getTodayDateInputValue(),
      divisionid: 0,
      deptid: 0,
      basedonid: "",
      remarks: "",
      yearid: resetSession.yearId,
      funccode: PI_CONFIG.RB_MASTER,
      tranmstgenid: 0,
      loginid: resetSession.loginId,
      sessionid: DEFAULT_SESSION_ID,
      idnumber: 0,
    };

    queuedRowsRef.current = [];
    queuedSupplierRowsRef.current = [];
    queuedTermsRowsRef.current = [];
    gridColumnsLoadedRef.current = false;
    supplierColumnsLoadedRef.current = false;
    termsColumnsLoadedRef.current = false;

    clearInquiryTypes();
    clearSaveError();

    setActiveTab("items");
    setApprovedFilter("all");
    setIsGridLoading(false);
    setIndentRows([]);
    setItemSelectionCount(0);
    setSupplierSelectionCount(0);
    setTermsSelectionCount(0);

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

    setTermsModalOpen(false);
    setTermsModalItems([]);
    setTermsModalColumns([]);
    setTermsModalLoading(false);
    setTermsModalError(null);

    itemGridRef.current?.clearRows?.();
    supplierGridRef.current?.clearRows?.();
    termsGridRef.current?.clearRows?.();

    setFilterResetKey((k) => k + 1);
    exitEditMode();
  }, [clearInquiryTypes, clearSaveError, exitEditMode]);

  const completeSuccessfulSave = useCallback(() => {
    if (isEditRoute) {
      navigate(PI_CONFIG.ROUTE_PATH);
    } else {
      resetFormToInitialState();
    }
  }, [isEditRoute, navigate, resetFormToInitialState]);

  // ── Tab state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("items");

  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [supplierSelectionCount, setSupplierSelectionCount] = useState(0);
  const [termsSelectionCount, setTermsSelectionCount] = useState(0);
  const activeSelectionCount =
    activeTab === "items"
      ? itemSelectionCount
      : activeTab === "suppliers"
        ? supplierSelectionCount
        : activeTab === "terms"
          ? termsSelectionCount
          : 0;

  const [approvedFilter, setApprovedFilter] = useState("all");
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [indentRows, setIndentRows] = useState([]);

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierModalItems, setSupplierModalItems] = useState([]);
  const [supplierModalColumns, setSupplierModalColumns] = useState([]);
  const [supplierModalLoading, setSupplierModalLoading] = useState(false);
  const [supplierModalError, setSupplierModalError] = useState(null);

  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [termsModalItems, setTermsModalItems] = useState([]);
  const [termsModalColumns, setTermsModalColumns] = useState([]);
  const [termsModalLoading, setTermsModalLoading] = useState(false);
  const [termsModalError, setTermsModalError] = useState(null);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);
  // Select Item popup filters (Based On = Direct only) — items are only
  // fetched once the user clicks Filter; the Indent-wise branch is untouched.
  const groupFilter = useItemPickerGroupFilter({
    spMainGroup: PI_CONFIG.SP_ITEM_MAIN_GROUP,
    spSubMainGroup: PI_CONFIG.SP_ITEM_SUB_MAIN_GROUP,
    formTag: PI_CONFIG.FORM_TAG,
  });
  const [itemPickerIsIndentWise, setItemPickerIsIndentWise] = useState(false);

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
    backTo: PI_CONFIG.ROUTE_PATH,
  });

  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
    fetchSupplierDetailMeta();
    fetchTermsDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta, fetchSupplierDetailMeta, fetchTermsDetailMeta, isEditRoute]);

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
        supplierDetails,
        termsDetails,
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

      const activeSupplierCols = await fetchSupplierGridColumns(
        headerValues.divisionid ?? 0,
        editRecordGridColumnOpts(master)
      );
      if (activeSupplierCols?.length > 0) supplierColumnsLoadedRef.current = true;
      const syncedSupplierDetails = syncEditGridDropdownValues(supplierDetails, activeSupplierCols || []);
      if (supplierGridRef.current?.loadRows) {
        supplierGridRef.current.loadRows(syncedSupplierDetails);
      } else {
        queuedSupplierRowsRef.current = syncedSupplierDetails;
      }

      const activeTermsCols = await fetchTermsGridColumns(
        headerValues.divisionid ?? 0,
        editRecordGridColumnOpts(master)
      );
      if (activeTermsCols?.length > 0) termsColumnsLoadedRef.current = true;
      const syncedTermsDetails = syncEditGridDropdownValues(termsDetails, activeTermsCols || []);
      if (termsGridRef.current?.loadRows) {
        termsGridRef.current.loadRows(syncedTermsDetails);
      } else {
        queuedTermsRowsRef.current = syncedTermsDetails;
      }
    } catch (err) {
      console.error("[PI] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load inquiry record.");
    } finally {
      setRecordLoading(false);
    }
  }, [
    recordId,
    listRecord,
    fetchEditRecord,
    fetchIndentDetailColumns,
    fetchGridColumns,
    fetchSupplierGridColumns,
    fetchTermsGridColumns,
  ]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode || !loadedMasterRow) return;

    const divisionId = headerValuesRef.current?.divisionid ?? loadedMasterRow?.divisionid ?? 0;
    fetchUnlockedHeaderDropdowns(divisionId);
    fetchGridColumns(divisionId, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
    fetchSupplierGridColumns(divisionId, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
    fetchTermsGridColumns(divisionId, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
  }, [
    isEditRoute,
    isEditMode,
    loadedMasterRow,
    fetchUnlockedHeaderDropdowns,
    fetchGridColumns,
    fetchSupplierGridColumns,
    fetchTermsGridColumns,
  ]);

  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(headerValuesRef.current?.divisionid ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns, fetchGridColumns, isEditRoute]);

  useEffect(() => {
    if (allSupplierColumns.length === 0 || supplierColumnsLoadedRef.current || isEditRoute) return;
    fetchSupplierGridColumns(headerValuesRef.current?.divisionid ?? 0).then((cols) => {
      if (cols?.length > 0) supplierColumnsLoadedRef.current = true;
    });
  }, [allSupplierColumns, fetchSupplierGridColumns, isEditRoute]);

  useEffect(() => {
    if (allTermsColumns.length === 0 || termsColumnsLoadedRef.current || isEditRoute) return;
    fetchTermsGridColumns(headerValuesRef.current?.divisionid ?? 0).then((cols) => {
      if (cols?.length > 0) termsColumnsLoadedRef.current = true;
    });
  }, [allTermsColumns, fetchTermsGridColumns, isEditRoute]);

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

  useEffect(() => {
    if (supplierColumns.length > 0 && supplierGridRef.current && queuedSupplierRowsRef.current.length > 0) {
      if (supplierGridRef.current.loadRows) {
        supplierGridRef.current.loadRows(queuedSupplierRowsRef.current);
      } else {
        queuedSupplierRowsRef.current.forEach((r) => supplierGridRef.current.addRow(r));
      }
      queuedSupplierRowsRef.current = [];
    }
  }, [supplierColumns]);

  useEffect(() => {
    if (termsColumns.length > 0 && termsGridRef.current && queuedTermsRowsRef.current.length > 0) {
      if (termsGridRef.current.loadRows) {
        termsGridRef.current.loadRows(queuedTermsRowsRef.current);
      } else {
        queuedTermsRowsRef.current.forEach((r) => termsGridRef.current.addRow(r));
      }
      queuedTermsRowsRef.current = [];
    }
  }, [termsColumns]);

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
    return PI_HEADER_FILTERS
      .filter((filter) =>
        isTruthyApiFlag(resolveHeaderApiCol(filter, apiColMap)?.isvisible)
      )
      .sort((a, b) =>
        Number(resolveHeaderApiCol(a, apiColMap)?.colseqno) -
        Number(resolveHeaderApiCol(b, apiColMap)?.colseqno)
      )
      .map(buildFilterDef);
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
        // MRD cascade rule: division change on the master reloads Tab-2 Supplier
        // Detail (division-scoped dropdown options — city/state/country — plus
        // clearing any previously-picked rows tied to the old division).
        supplierGridRef.current?.clearRows?.();
        setSupplierSelectionCount(0);
        termsGridRef.current?.clearRows?.();
        setTermsSelectionCount(0);
        if (val && val !== "0") {
          await fetchInquiryTypes(val);
          fetchSupplierGridColumns(val);
          fetchTermsGridColumns(val);
          focusFieldAfterCascade(filterPanelRef, "configid");
        }
      }
    },
    [fetchInquiryTypes, clearInquiryTypes, clearItemGridState, fetchSupplierGridColumns, fetchTermsGridColumns]
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

  const ensureSupplierColumns = useCallback(async () => {
    if (supplierColumnsLoadedRef.current && supplierColumns.length > 0) return supplierColumns;
    if (allSupplierColumns.length === 0) return [];
    const activeCols = await fetchSupplierGridColumns(headerValuesRef.current?.divisionid ?? 0, {
      existingRecordEdit: isEditRoute,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
    if (activeCols?.length > 0) supplierColumnsLoadedRef.current = true;
    return activeCols;
  }, [supplierColumns, allSupplierColumns, fetchSupplierGridColumns, isEditRoute, loadedMasterRow]);

  const ensureTermsColumns = useCallback(async () => {
    if (termsColumnsLoadedRef.current && termsColumns.length > 0) return termsColumns;
    if (allTermsColumns.length === 0) return [];
    const activeCols = await fetchTermsGridColumns(headerValuesRef.current?.divisionid ?? 0, {
      existingRecordEdit: isEditRoute,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
    if (activeCols?.length > 0) termsColumnsLoadedRef.current = true;
    return activeCols;
  }, [termsColumns, allTermsColumns, fetchTermsGridColumns, isEditRoute, loadedMasterRow]);

  // ── Select Item (Items tab) ────────────────────────────────────────
  // Flow:
  //   1. Pick RB code by BasedOn ('0'→Direct, '2'→Indent wise)
  //   2. Fetch RBID via fn_fetch_rbdetailbyrbcode
  //   3. Fetch grid columns via GetDetailColData (read-only, no dropdown fetch)
  //   4a. Indent-wise: fetch item rows immediately (unchanged).
  //   4b. Direct: fetch Main Group filter options instead — items are only
  //       fetched once the user clicks Filter (see handleApplyItemFilter).
  //       Client instruction 2026-07-28, same rollout as Purchase Indent.
  //   5. Open modal — EntryGrid in readOnly mode with those columns + rows
  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues, headerColumns);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }

    const loginId = getUserSession().loginId;
    const BasedOnID = headerValues.basedonid;
    const isIndentWise = Number(BasedOnID) === 2;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);
    groupFilter.resetFilter();
    setItemPickerIsIndentWise(isIndentWise); // Indent-wise has no filter step to await

    try {
      // Step 1 — choose RB code + row-fetch SP by BasedOnID
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
        JSon: JSON.stringify([{ prmrbcode: rbCode }]),
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

      if (isIndentWise) {
        // Step 4a — fetch item rows immediately (all JSON params validated before this call)
        const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: itemPickerSp,
          JSon: JSON.stringify([buildItemPickerJsonPayload(headerValues, loginId)]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        setItemModalItems(rowRes || []);
      } else {
        // Step 4b — Direct: load filter options only, defer the item fetch.
        await groupFilter.fetchMainGroupOptions({ divisionId: headerValues.divisionid, configId: headerValues.configid });
      }
    } catch (err) {
      console.error("[PI] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, groupFilter, headerColumns]);

  // Direct-mode item fetch — deferred until Filter is clicked. Main/Sub Main
  // Group ARE now sent to SP_ITEM_PICKER_DIRECT — live-confirmed 2026-07-28
  // (previously threw "Must declare the scalar variable ..."; that's gone).
  const handleApplyItemFilter = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const loginId = getUserSession().loginId;

    setItemModalError(null);
    try {
      await groupFilter.applyFilter(async () => {
        const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PI_CONFIG.SP_ITEM_PICKER_DIRECT,
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
      console.error("[PI] Item filter fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    }
  }, [getLive, groupFilter]);

  const handleCellEvent = useCallback(
    ({ rowId, colKey, rowData }) =>
      trackCellEvent(async () => {
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
      }),
    [fireCellEvent, trackCellEvent]
  );

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
        const rows = selectedItems.map((item) => mapPickerToItemRow(item, allColumns));
        rows.forEach((row) => addItemRow(row));
        // Fire the same qty/rate recalc a manual blur would trigger, so a
        // picker-inserted row's calculated amounts are correct immediately
        // instead of staying 0.00 until the user touches the cell (client-
        // confirmed 2026-07-24, same fix as Purchase Voucher/Order/Quotation).
        await Promise.all(rows.map((row) => handleCellEvent({ rowId: row.id, colKey: "tranqty", rowData: row })));
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
        const summaryRes = await postSave(ENDPOINTS.API_VALUES, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PI_CONFIG.SP_INDENT_SUMMARY,
          JSon: [{ prmJSon: cleanItems }],
          p_ErrCode: -1,
          p_ErrMsg: "",
        });

        const parents = summaryRes ?? [];
        if (!parents.length) return;

        // Fetch collapsible indent columns from RB_PurInquiryIndtDet.
        const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PI_CONFIG.SP_RB_META,
          JSon: JSON.stringify([{ prmrbcode: PI_CONFIG.RB_INDT_DETAIL }]),
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
    [ensureItemColumns, allColumns, addItemRow, getLive, fetchIndentDetailColumns, postSave, handleCellEvent]
  );

  // ── Select Supplier (Suppliers tab) ──────────────────────────────
  // Uses the same header-field gate + JSON payload shape as the item picker
  // (PI_CONFIG.SUPPLIER_SP is the PI-only rb_purinqselonlysupp RB — see constants.js).
  // Same 3-step flow as handleSelectTerms: RB code → RBID → GetDetailColData
  // (picker's own columns, incl. live colwidth) → row-fetch SP. Previously
  // SupplierPickerModal hardcoded its own column widths client-side instead
  // of reading them from the RB, unlike every sibling picker in this form.
  const handleSelectSupplier = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues, headerColumns);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }

    setSupplierModalOpen(true);
    setSupplierModalItems([]);
    setSupplierModalColumns([]);
    setSupplierModalError(null);
    setSupplierModalLoading(true);
    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: PI_CONFIG.RB_SUPPLIER_PICKER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load supplier picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.rbid,
        prmLoginID: getUserSession().loginId,
      });
      const gridColumns = buildGridColumns(colRes || [], {}, { filterable: false, allEditable: false });
      setSupplierModalColumns(gridColumns);

      const response = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SUPPLIER_SP,
        JSon: JSON.stringify([{
          prmdivisionid: Number(headerValues.divisionid) || 0,
          prmcompanyid: getUserSession().companyId,
          prmyearid: getUserSession().yearId,
          prmsupplieridnotin: "",
        }]),
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
  }, [getLive, headerColumns]);

  const handleInsertSuppliers = useCallback(
    async (selectedSuppliers) => {
      if (!selectedSuppliers?.length) return;
      setActiveTab("suppliers");

      const activeCols = await ensureSupplierColumns();
      if (!activeCols?.length) return;

      const existing = supplierGridRef.current?.getRows?.() ?? [];
      const existingIds = new Set(existing.map((r) => String(r.supplierid ?? r.id)));
      const divisionId = Number(headerValuesRef.current?.divisionid) || 0;

      selectedSuppliers.forEach((item) => {
        const sid = String(item.supplierid ?? item.SupplierID ?? item.id);
        if (existingIds.has(sid)) return;
        existingIds.add(sid);
        supplierGridRef.current?.addRow(
          mapPickerRowToGridRow(
            item,
            allSupplierColumns,
            { address: ["suppaddress", "address"] },
            { divisionid: divisionId }
          )
        );
      });
    },
    [ensureSupplierColumns, allSupplierColumns]
  );

  // ── Select Terms (Terms tab) ─────────────────────────────────────
  // Same 3-step flow as handleSelectItem: RB code → RBID → GetDetailColData
  // (picker's own columns) → row-fetch SP. Picker RB fields aren't specified
  // in the MRD, so columns are entirely RB-driven (no hardcoded field names).
  const handleSelectTerms = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues, headerColumns);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }

    setTermsModalOpen(true);
    setTermsModalItems([]);
    setTermsModalColumns([]);
    setTermsModalError(null);
    setTermsModalLoading(true);

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: PI_CONFIG.RB_TERMS_PICKER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load terms & conditions picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.rbid,
        prmLoginID: getUserSession().loginId,
      });
      const gridColumns = buildGridColumns(colRes || [], {}, { filterable: false, allEditable: false });
      setTermsModalColumns(gridColumns);

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SP_TERMS_PICKER,
        JSon: JSON.stringify([
          buildTermsPickerJsonPayload(headerValues, getUserSession().loginId),
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setTermsModalItems(rowRes || []);
    } catch (err) {
      console.error("[PI] Terms picker fetch failed:", err);
      setTermsModalError(err?.message || "Failed to fetch terms & conditions.");
    } finally {
      setTermsModalLoading(false);
    }
  }, [getLive, headerColumns]);

  const handleInsertTerms = useCallback(
    async (selectedTerms) => {
      if (!selectedTerms?.length) return;
      setActiveTab("terms");

      const activeCols = await ensureTermsColumns();
      if (!activeCols?.length) return;

      const existing = termsGridRef.current?.getRows?.() ?? [];
      const existingIds = new Set(existing.map((r) => String(r.termid ?? r.id)));
      const divisionId = Number(headerValuesRef.current?.divisionid) || 0;

      selectedTerms.forEach((item) => {
        const tid = String(item.termid ?? item.TermID ?? item.id);
        if (existingIds.has(tid)) return;
        existingIds.add(tid);
        termsGridRef.current?.addRow(
          mapPickerRowToGridRow(item, allTermsColumns, {}, { divisionid: divisionId })
        );
      });
    },
    [ensureTermsColumns, allTermsColumns]
  );

  // ── Delete selected rows (active tab's grid) ───────────────────────
  const handleDeleteSelected = useCallback(() => {
    const ref =
      activeTab === "items"
        ? itemGridRef
        : activeTab === "suppliers"
          ? supplierGridRef
          : activeTab === "terms"
            ? termsGridRef
            : null;
    if (!ref?.current) return;
    const selected = ref.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    ref.current.removeRows?.(selected.map((r) => r.id));
  }, [activeTab]);

  // ── Save / Cancel ──────────────────────────────────────────────────
  const [isSavingPI, setIsSavingPI] = useState(false);

  const handleSave = useCallback(
    async ({ skipPostSave = false } = {}) => {
      await flushPendingCellEvents(itemGridSectionRef);

      setFormErrors([]);
      const hv = headerValuesRef.current;

      // ── Validation (header + detail grids) ───────────────────────────
      const headerFieldNames = new Set(PI_HEADER_FILTERS.map((f) => f.FilterParameterID));
      const headerColsToValidate = headerColumns.filter((c) => headerFieldNames.has(c.colname));
      const headerErrors = validateApiColumns(hv, headerColsToValidate, {
        zeroValidFields: new Set(["basedonid"]),
      });

      const itemRows = itemGridRef.current?.getRows?.() ?? [];
      const detailErrors = validateGridRows(itemRows, columns, { requireAtLeastOne: true });

      const indentChildRows = Object.values(childRowsMap).flat();
      const indentErrors = validateGridRows(indentChildRows, childColumns);

      const supplierRows = supplierGridRef.current?.getRows?.() ?? [];
      const supplierErrors = validateGridRows(supplierRows, supplierColumns);

      const termsRows = termsGridRef.current?.getRows?.() ?? [];
      const termsErrors = validateGridRows(termsRows, termsColumns);

      const allErrors = [...headerErrors, ...detailErrors, ...indentErrors, ...supplierErrors, ...termsErrors];
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
      mstRow.userid = session.userId;

      // ── Detail ────────────────────────────────────────────────────────
      const sessionFields = { loginid: session.loginId, userid: session.userId };
      const detRows = itemRows.map(({ id, ...rest }) =>
        buildSaveRowFromColumns(rest, allColumns, sessionFields)
      );

      // ── IndentDetail ──────────────────────────────────────────────────
      const indentDetailRows = indentChildRows.map(({ id: _id, ...rest }) =>
        buildSaveRowFromColumns(rest, allIndentColumns, sessionFields)
      );

      // ── Supplier Detail (Tab-2) + Terms & Conditions (Tab-3) ───────────
      const supplierDetailRows = supplierRows.map(({ id, ...rest }) =>
        buildSaveRowFromColumns(rest, allSupplierColumns, sessionFields)
      );
      const termsDetailRows = termsRows.map(({ id, ...rest }) =>
        buildSaveRowFromColumns(rest, allTermsColumns, sessionFields)
      );

      const payload = await withSaveContextFields(
        buildSaveJsonFields({
          label: "PI",
          mst: mstRow,
          det: detRows,
          indtDet: indentDetailRows,
          supplierDet: supplierDetailRows,
          termsDet: termsDetailRows,
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
    [
      headerColumns,
      allColumns,
      allIndentColumns,
      allSupplierColumns,
      allTermsColumns,
      childRowsMap,
      childColumns,
      columns,
      supplierColumns,
      termsColumns,
      postSave,
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
      supplierGridRef.current?.clearRows?.();
      termsGridRef.current?.clearRows?.();
      editRecordLoadedRef.current = false;
      loadEditRecord();
      return;
    }

    resetFormToInitialState();
  }, [exitEditMode, isEditRoute, loadEditRecord, resetFormToInitialState]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "items") handleSelectItem();
    else if (activeTab === "suppliers") handleSelectSupplier();
    else if (activeTab === "terms") handleSelectTerms();
  }, [activeTab, handleSelectItem, handleSelectSupplier, handleSelectTerms]);

  const handleToggleCollapsible = useCallback(() => {
    itemGridRef.current?.toggleFocusedRowCollapsible?.();
  }, []);

  const itemGridConfig = {
    columns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const supplierGridConfig = {
    columns: supplierColumns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const termsGridConfig = {
    columns: termsColumns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const combinedError = metaError || headerError || recordLoadError;
  const filterPanelLoading = headerFetching || recordLoading;
  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = filterPanelLoading || isLoadingInquiryTypes;

  useEntryFormKeyboard({
    blocked: itemModalOpen || supplierModalOpen || termsModalOpen,
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
    [handleSaveAndPrint, isSavingPI, handleSave]
  );

  // Direct mode only — Indent-wise items fetch immediately, no filter step.
  const itemFilterBar = itemPickerIsIndentWise ? null : (
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
    <div className="workspace-page workspace-page--fill pi-page">
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

      <section className="pi-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={PI_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchable={activeTab === "items"}
          headerControls={
            <>
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

              {activeTab === "terms" && (
                <button
                  type="button"
                  className="eg-tab-btn"
                  onClick={handleSelectTerms}
                  disabled={!isEditMode}
                  title={FORM_SHORTCUT_TITLES.selectList}
                >
                  <ClipboardList size={12} strokeWidth={2.5} />
                  Select Terms
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
            </>
          }
          tabPanes={{
            suppliers: (
              <EntryGrid
                ref={supplierGridRef}
                config={supplierGridConfig}
                title=""
                hideBottomPanel
                readOnly={isEditRoute && !isEditMode}
                emptyMessage="No suppliers added. Click Select Supplier above."
                onSelectionChange={setSupplierSelectionCount}
              />
            ),
            terms: (
              <EntryGrid
                ref={termsGridRef}
                config={termsGridConfig}
                title=""
                hideBottomPanel
                readOnly={isEditRoute && !isEditMode}
                emptyMessage="No terms & conditions added. Click Select Terms above."
                onSelectionChange={setTermsSelectionCount}
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
          existingRecordEdit={isEditRoute}
          containerClassName="pi-item-entry-grid"
          remarkModalColumns={PI_REMARK_COLUMNS}
        />
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
        columns={supplierModalColumns}
        isLoading={supplierModalLoading}
        error={supplierModalError}
        onInsert={handleInsertSuppliers}
      />

      <TermsPickerModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        items={termsModalItems}
        columns={termsModalColumns}
        isLoading={termsModalLoading}
        error={termsModalError}
        onInsert={handleInsertTerms}
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
          awaitingFilter={!itemPickerIsIndentWise && !groupFilter.filterApplied}
        />
      </Suspense>
    </div>
  );
}
