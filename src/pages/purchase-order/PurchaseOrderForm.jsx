// PurchaseOrderForm.jsx
// Purchase Order entry form (add / edit).
// Mirrors PurchaseInquiryForm.jsx exactly — same three-phase load, same 3-tab layout.
// PO-specific additions vs PI: Currency, Cr. Days, Supplier auto-fill on select.
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel — header fields (PO No, Date, Division, PO Type,
//                              Based On, Supplier, Currency (locked), Currency Rate (locked),
//                              Cr. Days, Delivery Date, Dept, Remarks)
//   2. po-grid-section       — 2-tab wrapper
//        • Item Grid tab  → EntryGrid (API columns, RB_PurPODet)
//                           button: Select Item
//        • Terms tab      → static terms table
//        Fixed controls (always): Approved filter | Delete
//   3. EnterpriseSummaryPanel — live totals computed from grid rows (reusable)
//   4. ActionBar            — Save / Cancel / Close etc. (bottom-right, Alt shortcuts)

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
const DocumentLogModal = lazy(() => import("../../components/txn/DocumentLogModal"));
import { DOCUMENT_LOG_CONFIG as DOC_LOG_CFG } from "../../components/txn/documentLogConfig";
import EnterpriseSummaryPanel from "../../components/filters/EnterpriseSummaryPanel";
import SearchSelect from "../../components/ui/SearchSelect";
import { usePurchaseOrder } from "../../hooks/usePurchaseOrder";
import { useItemPickerGroupFilter } from "../../hooks/useItemPickerGroupFilter";
import { useDocumentLogAccess } from "../../hooks/useDocumentLogAccess";
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
import { validateApiColumnsByField, validateGridRows, validateGridRowsDetailed } from "../../utils/columnValidation";
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
  PO_CONFIG,
  PO_REMARK_COLUMNS,
  PO_GRID_TABS,
  APPROVED_OPTS,
  TERMS_COLUMNS,
  PO_FILTER_CASCADE_RESETS,
  PO_SUMMARY_FIELDS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  formatTranDate,
} from "./constants";
import { buildDirectItemPickerFilterParams } from "../../utils/purchaseItemPicker";
import { controlTypeMap } from "../../data/dummyData";
import "./PurchaseOrderPage.css";

// Fields that come from the master RB but belong to the summary footer — exclude from header filter.
const PO_SUMMARY_COL_NAMES = new Set(PO_SUMMARY_FIELDS.map((f) => f.SummaryParameterID));
// currencyid is a hidden context field — auto-filled from supplier, sent at save, not shown in UI.
const PO_HEADER_HIDDEN_COLS = new Set(["currencyid"]);
// Currency display fields — force LABEL (readonly) regardless of what the RB returns.
const PO_LABEL_OVERRIDE_COLS = new Set(["currencyname", "currencyrate"]);

// ── Temp-ID generator (negative → never clash with real IDs) ──────────
let _poTempId = -1;
const nextTempId = () => _poTempId--;

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;

  // Validate basedonid against PO_CONFIG.BASED_ON_OPTIONS.
  // API may return values (e.g. 1) that are not in our config options — fall back to "0" (Direct).
  const basedOnStr = String(headerValues.basedonid ?? "0");
  const validBasedOn = PO_CONFIG.BASED_ON_OPTIONS.find((o) => o.value === basedOnStr);
  const resolvedBasedOnID = validBasedOn ? validBasedOn.value : "0";

  return {
    trancode: headerValues.trancode ?? "",
    trandate: headerValues.trandate ?? "",
    divisionid: String(headerValues.divisionid ?? ""),
    configid: String(headerValues.configid ?? ""),
    deliverydate: headerValues.deliverydate ?? "",
    supplierid: String(headerValues.supplierid ?? ""),
    deptid: String(headerValues.deptid ?? ""),
    basedonid: resolvedBasedOnID,
    currencyname: headerValues.currencyname ?? "",
    currencyrate: String(headerValues.currencyrate ?? ""),
    creditdays: String(headerValues.creditdays ?? ""),
    remarks: headerValues.remarks ?? "",
  };
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

// ── Component ──────────────────────────────────────────────────────────

export default function PurchaseOrderForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord = location.state?.record ?? null;
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [itemCellErrors, setItemCellErrors] = useState(null);
  const navigate = useNavigate();

  const itemGridRef = useRef(null);
  const itemGridSectionRef = useRef(null);
  const summaryRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();
  const { get: getLive } = useApi(API_BASE_URL);
  const { post: postSave } = useApi(API_BASE_URL_IMS);

  const {
    headerColumns,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    divisionOptions,
    poTypeOptions,
    supplierOptions,
    departmentOptions,
    fetchPoTypes,
    clearPoTypes,
    fetchSupplierInfo,
    getSupplierCurrency,
    fetchUniqueId,
    isLoadingPoTypes,
    columns,
    allColumns,
    isFetching,
    metaError,
    eventColumns,
    fetchDetailMeta,
    fetchGridColumns,
    fetchEditRecord,
    seedOptionsFromMaster,
    fetchUnlockedHeaderDropdowns,
    fireCellEvent,
    saveTxn,
    isSaving,
    saveError,
    clearSaveError,
  } = usePurchaseOrder(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  const headerValuesRef = useRef({
    trancode: "",
    trandate: getTodayDateInputValue(),
    configid: 0,
    deliverydate: null,
    divisionid: 0,
    supplierid: 0,
    deptid: 0,
    currencyid: 0,
    currencyname: "",
    currencyrate: 0,
    creditdays: 0,
    basedonid: "",
    remarks: "",
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: recordId,
    isamend: 0,
    amendpoid: 0,
    compuniquekey: 0,
    funccode: PO_CONFIG.RB_MASTER,
  });

  // trandate defaults to today on a new record; existing records keep their
  // loaded date. basedonid still has no default — client requirement
  // 2026-07-24 remains for that dropdown.
  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { basedonid: "", trandate: getTodayDateInputValue() };
  }, [loadedFilterValues]);

  const [filterResetKey, setFilterResetKey] = useState(0);

  // ── Edit-mode gate ─────────────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false);

  // Document Log modal (F6) — same pattern as Purchase Indent (see
  // PurchaseIndentForm.jsx / useDocumentLogAccess.js for the full reasoning).
  const docLog = useDocumentLogAccess({
    tranTypeId: PO_CONFIG.DM_TRAN_TYPE_ID,
    refDepartmentId: DOC_LOG_CFG.PURCHASE_REF_DEPARTMENT_ID,
    recordId,
    getDivisionId: () => headerValuesRef.current?.divisionid,
    isEditMode,
    postSave,
    logLabel: "[PO]",
  });

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
        if (!focusFirstEditableFilterField()) {
          focusSelectItemButton();
        }
      }, 80);
    });
  }, [isNewRoute, fetchUniqueId, focusFirstEditableFilterField, focusSelectItemButton]);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  // ── Tab state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("items");

  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const activeSelectionCount = activeTab === "items" ? itemSelectionCount : 0;

  const [approvedFilter, setApprovedFilter] = useState("all");
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [gridRows, setGridRows] = useState([]);
  const [currencyExternalValues, setCurrencyExternalValues] = useState(null);

  // Item picker modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);
  const [itemNameFilter, setItemNameFilter] = useState("");
  // Select Item popup filters (Based On = Direct only) — items are only
  // fetched once the user clicks Filter; Indent-wise/Quotation branches
  // are untouched.
  const groupFilter = useItemPickerGroupFilter({
    spMainGroup: PO_CONFIG.SP_ITEM_MAIN_GROUP,
    spSubMainGroup: PO_CONFIG.SP_ITEM_SUB_MAIN_GROUP,
    formTag: PO_CONFIG.FORM_TAG,
  });
  const [itemPickerIsDirect, setItemPickerIsDirect] = useState(false);

  // Collapsible indent children (indent-wise mode)
  const [childRowsMap, setChildRowsMap] = useState({});
  const [childColumns, setChildColumns] = useState([]);

  usePageHeader({
    title: isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then use Item Grid or Terms tabs."
      : recordLoading
        ? "Loading purchase order…"
        : recordLoadError
          ? recordLoadError
          : `PO #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: PO_CONFIG.ROUTE_PATH,
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
        idFields: ["poid"],
      });
      const { master, headerValues, details, indentDetails } = await fetchEditRecord(params);

      if (!master || !headerValues) {
        throw new Error("Purchase Order record not found.");
      }

      headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      // Seed single-item options from display names in master response.
      // Non-editable fields (IsEditAllow:false) only ever need this one option.
      // Editable fields get the full list when user clicks Add (Alt+A).
      seedOptionsFromMaster(master);

      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      if (headerValues.currencyname || headerValues.currencyrate || headerValues.creditdays) {
        setCurrencyExternalValues({
          currencyname: headerValues.currencyname ?? "",
          currencyrate: String(headerValues.currencyrate ?? ""),
          creditdays: String(headerValues.creditdays ?? ""),
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

      if (indentDetails.length > 0) {
        const newChildRowsMap = {};
        indentDetails.forEach((row) => {
          // DetailID matches the parent detail row's IDNumber/CompUniqueKey,
          // which is what mapDetailRowsToGridRows assigns as the grid row id.
          const key = String(row.detailid ?? 0);
          if (!newChildRowsMap[key]) newChildRowsMap[key] = [];
          newChildRowsMap[key].push(row);
        });
        setChildRowsMap(newChildRowsMap);

        // Fetch indent picker columns so the collapsible panel renders the same
        // column headers as in the Add flow (RB_ITEM_PICKER_INDENT → buildGridColumns).
        if (String(headerValues.basedonid) === "2") {
          try {
            const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
              ObjType: OBJ_TYPE.FUNCTION,
              ObjName: PO_CONFIG.SP_RB_META,
              JSon: JSON.stringify([{ prmrbcode: PO_CONFIG.RB_ITEM_PICKER_INDENT }]),
              p_ErrCode: -1,
              p_ErrMsg: "",
            });
            const rbRow = rbRes?.[0];
            if (rbRow) {
              const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
                prmMasterID: rbRow.rbid,
                prmLoginID: getUserSession().loginId,
              });
              const pickerCols = buildGridColumns(colRes || [], {}, {
                filterable: false,
                allEditable: false,
              });
              setItemModalColumns(pickerCols);
              setChildColumns(pickerCols.filter((c) => c.key !== "cb"));
            }
          } catch (pickerErr) {
            console.warn("[PO] Could not load indent picker columns for edit view:", pickerErr);
          }
        }
      }
    } catch (err) {
      console.error("[PO] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load purchase order record.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, listRecord, fetchEditRecord, seedOptionsFromMaster, fetchGridColumns, getLive]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || allColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, allColumns.length, loadEditRecord]);

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

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  // ── syncedFilters — built purely from API headerColumns (fully dynamic) ──
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    divisionid: divisionOptions,
    configid: poTypeOptions,
    supplierid: supplierOptions,
    deptid: departmentOptions,
    basedonid: PO_CONFIG.BASED_ON_OPTIONS,
  }), [divisionOptions, poTypeOptions, supplierOptions, departmentOptions]);

  const syncedFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];

    const cols = headerColumns
      .filter((col) =>
        isTruthyApiFlag(col.isvisible) &&
        !PO_SUMMARY_COL_NAMES.has(col.colname) &&
        !PO_HEADER_HIDDEN_COLS.has(col.colname)
      )
      .sort((a, b) => Number(a.colseqno) - Number(b.colseqno))
      .map((col) => {
        const lockOnEditMode = isLockOnEditModeCol(col);
        const staticOptions = DROPDOWN_OPTIONS_BY_COL[col.colname];
        const base = {
          FilterParameterID: col.colname,
          FilterColName: col.colname,
          FilterCaption: col.displayname ?? col.colname,
          FilterColCtrlType: PO_LABEL_OVERRIDE_COLS.has(col.colname)
            ? controlTypeMap.LABEL
            : (col.colctrltype ?? 0),
          ...(staticOptions ? { staticOptions } : {}),
        };
        return syncHeaderFilterWithApiCol(base, col, { lockOnEditMode });
      });

    // If RB master doesn't expose currencyname as a column, inject it as a
    // readonly label immediately after supplierid so externalValues can populate it.
    if (!cols.some((f) => f.FilterParameterID === "currencyname")) {
      const supplierIdx = cols.findIndex((f) => f.FilterParameterID === "supplierid");
      cols.splice(supplierIdx >= 0 ? supplierIdx + 1 : cols.length, 0, {
        FilterParameterID: "currencyname",
        FilterColName: "currencyname",
        FilterCaption: "Currency",
        FilterColCtrlType: controlTypeMap.LABEL,
      });
    }

    return cols;
  }, [headerColumns, DROPDOWN_OPTIONS_BY_COL]);

  // ── filterFieldTones — per-field visual state driven by IsLockOnEditModeAllow ──
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

  // ── syncedSummaryFields — only fields RB marks visible, labelled from header RB columns ──
  const syncedSummaryFields = useMemo(
    () => syncMasterSummaryFields(PO_SUMMARY_FIELDS, headerColumns),
    [headerColumns]
  );

  // ── Filter change / cascade ────────────────────────────────────────
  const handleFilterChange = useCallback(
    async (colName, val) => {
      headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };
      setFieldErrors((prev) => {
        if (!prev[colName]) return prev;
        const next = { ...prev };
        delete next[colName];
        return next;
      });

      if (colName === "divisionid") {
        headerValuesRef.current.configid = 0;
        headerValuesRef.current.supplierid = 0;
        clearPoTypes();
        itemGridRef.current?.clearRows?.();
        setChildRowsMap({});
        if (val && val !== "0") {
          await fetchPoTypes(val);
          focusFieldAfterCascade(filterPanelRef, "configid");
        }
        return;
      }

      if (colName === "trandate") {
        headerValuesRef.current.supplierid = 0;
        itemGridRef.current?.clearRows?.();
        setChildRowsMap({});
        return;
      }

      if (colName === "configid") {
        itemGridRef.current?.clearRows?.();
        setChildRowsMap({});
        return;
      }

      if (colName === "basedonid") {
        itemGridRef.current?.clearRows?.();
        setChildRowsMap({});
        return;
      }

      if (colName === "supplierid") {
        itemGridRef.current?.clearRows?.();
        setChildRowsMap({});
        if (val && val !== "0") {
          const cached = getSupplierCurrency(val);
          if (cached) {
            headerValuesRef.current.currencyid = cached.currencyid;
            headerValuesRef.current.currencyname = cached.currencyname;
            headerValuesRef.current.currencyrate = cached.currencyrate;
            headerValuesRef.current.creditdays = cached.crdays;
            setCurrencyExternalValues({
              currencyname: cached.currencyname,
              currencyrate: String(cached.currencyrate),
              creditdays: String(cached.crdays),
            });
          } else {
            const info = await fetchSupplierInfo(val);
            if (info) {
              headerValuesRef.current.currencyid = info.currencyid;
              headerValuesRef.current.currencyname = info.currencyname ?? "";
              headerValuesRef.current.currencyrate = info.currencyrate;
              headerValuesRef.current.creditdays = info.crdays;
              setCurrencyExternalValues({
                currencyname: info.currencyname ?? "",
                currencyrate: String(info.currencyrate),
                creditdays: String(info.crdays),
              });
            }
          }
        } else {
          headerValuesRef.current.currencyid = 0;
          headerValuesRef.current.currencyname = "";
          headerValuesRef.current.currencyrate = 0;
          setCurrencyExternalValues({ currencyname: "", currencyrate: "", creditdays: "" });
        }
      }
    },
    [fetchPoTypes, clearPoTypes, fetchSupplierInfo, getSupplierCurrency]
  );

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
  const handleCellEvent = useCallback(
    ({ rowId, colKey, rowData }) =>
      trackCellEvent(async () => {
        const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
        if (!result || !itemGridRef.current) return;
        const responseRow = result?.[0];
        if (!responseRow) return;
        const errCode = responseRow.errcode;
        if (errCode !== 1 && errCode !== 1.0) {
          console.warn("[PO] Cell-event error:", responseRow.errmsg ?? `ErrCode ${errCode}`);
          return;
        }
        const { errcode, errmsg, ...updatedFields } = responseRow;
        itemGridRef.current.updateRow?.(rowId, updatedFields);
      }),
    [fireCellEvent, trackCellEvent]
  );

  // ── Select Item ────────────────────────────────────────────────────
  // Direct branch (basedonid not 2 or 3) defers the item fetch until the
  // user clicks Filter — Indent-wise/Quotation branches fetch immediately,
  // unchanged. Client instruction 2026-07-28, same rollout as Purchase Indent.
  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValues, headerColsToValidate, {
      zeroValidFields: new Set(["basedonid"]),
    });
    setFieldErrors(headerErrorMap);
    if (Object.keys(headerErrorMap).length > 0) {
      setFormErrors(["Please fix the highlighted field(s) below."]);
      return;
    }
    setFormErrors([]);
    const { divisionid, configid, trandate, basedonid } = headerValues;
    const divisionID = divisionid ?? 0;
    const basedOnNum = Number(basedonid);
    const isDirect = basedOnNum !== 2 && basedOnNum !== 3;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);
    setItemNameFilter("");
    groupFilter.resetFilter();
    setItemPickerIsDirect(isDirect); // non-Direct modes have no filter step to await

    try {
      let rbCode;
      if (basedOnNum === 2) rbCode = PO_CONFIG.RB_ITEM_PICKER_INDENT;
      else if (basedOnNum === 3) rbCode = PO_CONFIG.RB_ITEM_PICKER_QUOT;
      else rbCode = PO_CONFIG.RB_ITEM_PICKER_DIRECT;

      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PO_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: rbCode }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

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

      if (isDirect) {
        await groupFilter.fetchMainGroupOptions({ divisionId: divisionID, configId: configid });
        await groupFilter.fetchSubMainGroupOptions({
          divisionId: divisionID,
          configId: configid,
          mainGroupId: 0,
        });
      } else {
        const spItemPicker = basedOnNum === 2 ? PO_CONFIG.SP_ITEM_PICKER_INDENT : PO_CONFIG.SP_ITEM_PICKER_QUOT;
        const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: spItemPicker,
          JSon: JSON.stringify([
            {
              prmdivisionid: Number(divisionID),
              prmyearid: getUserSession().yearId,
              prmloginid: getUserSession().loginId,
              prmtrandate: formatTranDate(trandate),
              prmconfigid: Number(configid ?? 0),
              prmsupplierid: Number(headerValuesRef.current?.supplierid ?? 0),
              prmtranbook: PO_CONFIG.TRAN_BOOK,
              prmfrmoption: basedOnNum || 0,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        setItemModalItems(rowRes || []);
      }
    } catch (err) {
      console.error("[PO] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, headerColumns, groupFilter]);

  // Direct Select Item (fn_tbl_rb_purposelonlyitem) — trailing AEI filter args + Item Name.
  // Indent/Quotation picker SPs keep their existing payloads unchanged.
  const handleApplyItemFilter = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const { divisionid, configid, trandate } = headerValues;
    const divisionID = divisionid ?? 0;
    const itemName = String(itemNameFilter ?? "").trim();

    setItemModalError(null);
    try {
      await groupFilter.applyFilter(
        async (groupParams) => {
          const hasMain = Boolean(groupFilter.mainGroupFilter);
          const hasSub = Boolean(groupFilter.subMainGroupFilter);
          const hasItemName = itemName.length >= 3;
          const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: OBJ_TYPE.FUNCTION,
            ObjName: PO_CONFIG.SP_ITEM_PICKER_DIRECT,
            JSon: JSON.stringify([
              {
                prmdivisionid: Number(divisionID),
                prmyearid: getUserSession().yearId,
                prmloginid: getUserSession().loginId,
                prmtrandate: formatTranDate(trandate),
                prmconfigid: Number(configid ?? 0),
                prmsupplierid: Number(headerValuesRef.current?.supplierid ?? 0),
                prmtranbook: PO_CONFIG.TRAN_BOOK,
                prmfrmoption: 0,
                ...buildDirectItemPickerFilterParams({
                  maGroupId: hasMain ? groupParams.prmmaingroupid : 0,
                  subMaGroupId: hasSub ? groupParams.prmsubmaingroupid : 0,
                  itemNameSearch: hasItemName ? itemName : "",
                }),
              },
            ]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          });
          setItemModalItems(rowRes || []);
        },
        {
          validate: ({ mainGroupFilter, subMainGroupFilter }) => {
            const hasMain = Boolean(mainGroupFilter);
            const hasSub = Boolean(subMainGroupFilter);
            const hasItemName = itemName.length >= 3;
            if (itemName.length > 0 && itemName.length < 3) {
              throw new Error("Item Name must be at least 3 characters.");
            }
            if (!hasMain && !hasSub && !hasItemName) {
              throw new Error(
                "Select Item Main Group, Item Sub Main Group, or enter at least 3 characters in Item Name."
              );
            }
          },
        }
      );
    } catch (err) {
      console.error("[PO] Item filter fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    }
  }, [getLive, groupFilter, itemNameFilter]);

  const handleInsertItems = useCallback(
    async (selectedItems) => {
      if (!selectedItems?.length) return;
      setActiveTab("items");

      const isIndentWise = Number(headerValuesRef.current?.basedonid) === 2;

      if (!isIndentWise) {
        const activeCols = await ensureItemColumns();
        if (!activeCols?.length) return;
        setChildRowsMap({});
        setChildColumns([]);
        const rows = selectedItems.map((item) => mapPickerToItemRow(item, allColumns));
        rows.forEach((row) => addItemRow(row));
        // Fire the same qty/rate recalc a manual blur would trigger, so a
        // picker-inserted row's calculated amounts are correct immediately
        // instead of staying 0.00 until the user touches the cell (client-
        // confirmed 2026-07-24, same fix as Purchase Voucher).
        await Promise.all(rows.map((row) => handleCellEvent({ rowId: row.id, colKey: "tranqty", rowData: row })));
        return;
      }

      ensureItemColumns().catch(() => { });

      const cleanItems = selectedItems.map(({ id: _id, ...rest }) => rest);
      setIsGridLoading(true);
      try {
        const summaryRes = await postSave(ENDPOINTS.API_VALUES, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PO_CONFIG.SP_INDENT_SUMMARY,
          JSon: [{ prmJSon: cleanItems }],
          p_ErrCode: -1,
          p_ErrMsg: "",
        });

        const parents = summaryRes ?? [];
        if (!parents.length) return;

        const newChildRowsMap = {};
        parents.forEach((parent) => {
          const pid = String(Math.round(Number(parent.itemid)));
          const children = cleanItems.filter(
            (c) => String(Math.round(Number(c.childfkey))) === pid
          );
          if (children.length > 0) newChildRowsMap[pid] = children;

          // The summary API does not return tranunitid / baseunitid.
          // Seed them from the first child (original picker row) so they
          // are present in prmStrDetJSON at save time.
          const ref = children[0] ?? {};
          const row = { ...parent, id: pid };
          if (!(row.tranunitid > 0) && ref.tranunitid > 0) row.tranunitid = ref.tranunitid;
          if (!(row.baseunitid > 0) && ref.baseunitid > 0) row.baseunitid = ref.baseunitid;
          addItemRow(row);
        });

        setChildRowsMap((prev) => ({ ...prev, ...newChildRowsMap }));
        setChildColumns(itemModalColumns.filter((c) => c.key !== "cb"));
      } catch (err) {
        console.error("[PO] Indent summary fetch failed:", err);
      } finally {
        setIsGridLoading(false);
      }
    },
    [ensureItemColumns, allColumns, addItemRow, itemModalColumns, postSave, handleCellEvent]
  );

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
  const [isSavingPO, setIsSavingPO] = useState(false);

  const buildDefaultHeaderValues = useCallback(() => ({
    trancode: "",
    trandate: getTodayDateInputValue(),
    configid: 0,
    deliverydate: null,
    divisionid: 0,
    supplierid: 0,
    deptid: 0,
    currencyid: 0,
    currencyname: "",
    currencyrate: 0,
    creditdays: 0,
    basedonid: "",
    remarks: "",
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: 0,
    isamend: 0,
    amendpoid: 0,
    compuniquekey: 0,
    funccode: PO_CONFIG.RB_MASTER,
  }), []);

  const { resetFormToInitialState, discardChanges } = useTransactionFormReset({
    storageKeys: [PO_CONFIG.STORAGE_HEADER_META, PO_CONFIG.STORAGE_ENTRY_META],
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
    extraClearFns: [clearPoTypes, docLog.resetDocGuid],
    extraReset: () => {
      sessionStorage.removeItem(PO_CONFIG.STORAGE_HEADER_META);
      sessionStorage.removeItem(PO_CONFIG.STORAGE_ENTRY_META);
      setCurrencyExternalValues({ currencyname: "", currencyrate: "", creditdays: "" });
      setApprovedFilter("all");
      setChildRowsMap({});
      setChildColumns([]);
      summaryRef.current?.resetOverrides?.();
      setFieldErrors({});
      setItemCellErrors(null);
      if (isNewRoute) docLog.fetchDocGuid();
    },
  });

  const completeSuccessfulSave = useCallback(() => {
    if (isEditRoute) {
      navigate(PO_CONFIG.ROUTE_PATH);
    } else {
      resetFormToInitialState();
    }
  }, [isEditRoute, navigate, resetFormToInitialState]);

  const handleSave = useCallback(async ({ skipPostSave = false } = {}) => {
    await flushPendingCellEvents(itemGridSectionRef);

    setFormErrors([]);
    const hv = headerValuesRef.current;

    // ── Validation (header + detail + indent) ────────────────────────
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(hv, headerColsToValidate, {
      zeroValidFields: new Set(["basedonid"]),
    });
    setFieldErrors(headerErrorMap);

    const itemRows = itemGridRef.current?.getRows?.() ?? [];
    const { errors: detailErrors, cellErrors: nextItemCellErrors } = validateGridRowsDetailed(
      itemRows,
      columns,
      { requireAtLeastOne: true }
    );
    setItemCellErrors(nextItemCellErrors);

    const indentChildRows = Object.values(childRowsMap).flat();
    const indentErrors = validateGridRows(indentChildRows, childColumns);

    // Header errors show inline on their fields (fieldErrors, above); only a
    // single summary line goes in the top banner alongside the grid errors,
    // which have no per-cell display yet and still need their full messages.
    const headerBannerMsg =
      Object.keys(headerErrorMap).length > 0 ? ["Please fix the highlighted field(s) below."] : [];
    const allErrors = [...headerBannerMsg, ...detailErrors, ...indentErrors];
    if (allErrors.length > 0) {
      setFormErrors(allErrors);
      return false;
    }

    const { loginId } = getUserSession();
    const masterColumnDefs = headerColumns.map((col) => ({
      key: col.colname,
      colDataType: col.coldatatype || null,
    }));
    const mstRow = buildSaveRowFromColumns(hv, masterColumnDefs, {
      ...(summaryRef.current?.getSummary?.() ?? {}),
      loginid: loginId,
    });

    const detRows = itemRows.map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, { loginid: loginId })
    );

    const indentDetailRows = indentChildRows.map(({ id: _id, ...rest }) => ({ ...rest, loginid: loginId }));

    const payload = await withSaveContextFields(
      buildSaveJsonFields({
        label: "PO",
        mst: mstRow,
        det: detRows,
        indtDet: indentDetailRows,
      }),
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSavingPO(true);
    try {
      const result = await postSave(PO_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message, newId } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
      // Same Add-mode-gap fix as Purchase Indent — see
      // PurchaseIndentForm.jsx's handleSave for the full reasoning.
      const savedTranId = newId ?? (isEditRoute ? recordId : null);
      await docLog.finalizeSave(savedTranId);
      if (!skipPostSave) completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[PO Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSavingPO(false);
    }
  }, [headerColumns, allColumns, childRowsMap, columns, childColumns, isEditRoute, recordId, completeSuccessfulSave, docLog.finalizeSave, postSave, flushPendingCellEvents]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave({ skipPostSave: true });
    if (!saved) return;
    window.print();
    completeSuccessfulSave();
  }, [handleSave, completeSuccessfulSave]);

  const [discardOpen, setDiscardOpen] = useState(false);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    // Covers discardChanges()'s edit-route branch too (re-fetches instead of
    // going through extraReset) — a stale Round Off override must not
    // survive a Cancel either way.
    summaryRef.current?.resetOverrides?.();
    discardChanges();
  }, [discardChanges]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = headerFetching || isLoadingPoTypes;

  useEntryFormKeyboard({
    blocked: itemModalOpen || docLog.docModalOpen,
    isEditMode,
    isSaving: isSavingPO,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onSavePrint: handleSaveAndPrint,
    onCancel: handleCancel,
    onSelectList: handleSelectListShortcut,
    onToggleCollapsible: handleToggleCollapsible,
    onDocuments: docLog.handleOpenDocuments,
  });

  // ── Extra ActionBar buttons ────────────────────────────────────────
  const poExtraButtons = useMemo(
    () => [
      // Show/hide only, never a disabled state — matches Purchase Indent's
      // convention (docLog.documentsButtonEntry is null when permission
      // gates say no, so spreading it in/out hides/shows it with Add/Edit
      // mode the same way every other extra button does).
      ...(docLog.documentsButtonEntry ? [docLog.documentsButtonEntry] : []),
      {
        key: "saveprint",
        label: "Save & Print",
        Icon: Printer,
        variant: "print",
        onClick: handleSaveAndPrint,
        disabled: isSavingPO,
        accessKey: "p",
        title: FORM_SHORTCUT_TITLES.savePrint,
      },
      {
        key: "save",
        label: isSavingPO ? "Saving…" : "Save",
        Icon: Save,
        variant: "save",
        onClick: handleSave,
        disabled: isSavingPO,
        loading: isSavingPO,
        accessKey: "s",
        title: FORM_SHORTCUT_TITLES.save,
      },
    ],
    [docLog.documentsButtonEntry, handleSaveAndPrint, isSavingPO, handleSave]
  );

  const itemGridConfig = {
    columns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const combinedError = metaError || headerError;

  // Direct mode only — Indent-wise/Quotation items fetch immediately, no filter step.
  const itemFilterBar = !itemPickerIsDirect ? null : (
    <ItemPickerGroupFilterBar
      mainGroupOptions={groupFilter.mainGroupOptions}
      subMainGroupOptions={groupFilter.subMainGroupOptions}
      mainGroupValue={groupFilter.mainGroupFilter}
      subMainGroupValue={groupFilter.subMainGroupFilter}
      onMainGroupChange={(value) => groupFilter.handleMainGroupChange(value, {
        divisionId: headerValuesRef.current.divisionid,
        configId: headerValuesRef.current.configid,
        defaultMaGroupId: 0,
      })}
      onSubMainGroupChange={groupFilter.setSubMainGroupFilter}
      onFilter={handleApplyItemFilter}
      filterLoading={groupFilter.filterLoading}
      subMainAlwaysEnabled
      showItemName
      itemNameValue={itemNameFilter}
      onItemNameChange={setItemNameFilter}
    />
  );

  return (
    <div className="workspace-page workspace-page--fill po-page">
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
          <>
            {/* ── Header filter panel ──────────────────────────────── */}
            <EnterpriseFilterPanel
              key={filterResetKey}
              panelRef={filterPanelRef}
              title="Purchase Order Detail"
              staticFilters={syncedFilters}
              initialValues={filterInitialValues}
              cascadeResets={PO_FILTER_CASCADE_RESETS}
              onFilterChange={handleFilterChange}
              externalValues={currencyExternalValues}
              isSearching={filterBusy || recordLoading}
              isMetaLoading={!headerMetaReady || recordLoading}
              disabled={filterBusy || !headerMetaReady}
              fieldTones={filterFieldTones}
              fieldErrors={fieldErrors}
              onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
            />
          </>
        )}
      </section>

      {/* ── 3-tab grid section ───────────────────────────────────────── */}
      <section className="po-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={PO_GRID_TABS}
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

              <div className="po-tab-filter">
                <span className="po-tab-filter__label">Approved</span>
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
          tabContentOverride={
            activeTab === "terms" ? (
              <div className="po-terms-pane">
                <table className="po-terms-table">
                  <thead>
                    <tr>
                      {TERMS_COLUMNS.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={TERMS_COLUMNS.length} className="po-terms-empty">
                        No terms &amp; conditions added.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null
          }
          emptyMessage="No items yet. Click Entry Form or Select Item above."
          onSelectionChange={setItemSelectionCount}
          onRowsChange={(rows) => {
            setGridRows(rows);
            // Clear the whole cell-error map on any edit rather than tracking
            // which cell changed — Save re-validates and re-marks whatever's
            // still invalid, same "clear on edit" spirit as the field-level
            // work without needing a per-cell edit callback from EntryGrid.
            setItemCellErrors((prev) => (prev && prev.size > 0 ? null : prev));
          }}
          cellErrors={itemCellErrors}
          onCellEvent={handleCellEvent}
          eventColumns={eventColumns}
          enableCollapsible={Object.keys(childRowsMap).length > 0}
          childRowsMap={childRowsMap}
          childColumns={childColumns}
          readOnly={isEditRoute && !isEditMode}
          existingRecordEdit={isEditRoute && isEditMode}
          hideBottomPanel
          remarkModalColumns={PO_REMARK_COLUMNS}
        />
      </section>

      {/* ── Summary totals — live from grid rows ── */}
      <EnterpriseSummaryPanel ref={summaryRef} fields={syncedSummaryFields} rows={gridRows} masterValues={loadedMasterRow} />

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        onCancel={handleCancel}
        addLabel={isEditRoute ? "Edit" : "Add"}
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={poExtraButtons}
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

      <Suspense fallback={null}>
        <DocumentLogModal
          ref={docLog.docModalRef}
          isOpen={docLog.docModalOpen}
          onClose={() => docLog.setDocModalOpen(false)}
          tranId={recordId}
          divisionId={headerValuesRef.current?.divisionid}
          tranTypeId={PO_CONFIG.DM_TRAN_TYPE_ID}
          refDepartmentId={DOC_LOG_CFG.PURCHASE_REF_DEPARTMENT_ID}
          guid={docLog.docGuid}
        />
      </Suspense>
    </div>
  );
}
