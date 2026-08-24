// PurchaseQuotationForm.jsx
// Purchase Quotation entry form (add / edit).
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — header fields only (no action buttons)
//   2. pq-grid-section        — 2-tab wrapper
//        • Item Grid tab  → EntryGrid (RB_PurQtnDet)
//                           button: Select Item
//        • Terms tab      → static terms table (no buttons)
//        Fixed controls (always): Approved filter | Delete
//   3. EnterpriseSummaryPanel — live totals computed from grid rows
//   4. QtnActionBar           — Save / Cancel etc.
//
// Quotation item picker RB + prmFrmOption follow BasedOnID ('0' Direct | '2' Inquiry Based).

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, FileText, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EnterpriseSummaryPanel from "../../components/filters/EnterpriseSummaryPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
const DocumentLogModal = lazy(() => import("../../components/txn/DocumentLogModal"));
import { DOCUMENT_LOG_CONFIG as DOC_LOG_CFG } from "../../components/txn/documentLogConfig";
import SearchSelect from "../../components/ui/SearchSelect";
import { usePurchaseQuotation } from "../../hooks/usePurchaseQuotation";
import { useDocumentLogAccess } from "../../hooks/useDocumentLogAccess";
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
  syncMasterSummaryFields,
} from "../../utils/gridUtils";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { focusFieldAfterCascade } from "../../utils/focusUtils";
import { validateApiColumnsByField, validateGridRowsDetailed } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { queryEditableFilterFields, resolveEditLoadParams } from "../../utils/txnFormUtils";
import { getTodayDateInputValue } from "../../utils/dateFormat";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { useTransactionFormReset } from "../../hooks/useTransactionFormReset";
import { usePendingCellEventFlush } from "../../hooks/usePendingCellEventFlush";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  QTN_CONFIG,
  QTN_REMARK_COLUMNS,
  QTN_MASTER,
  QTN_HEADER_FILTERS,
  QTN_GRID_TABS,
  APPROVED_OPTS,
  TERMS_COLUMNS,
  QTN_FILTER_CASCADE_RESETS,
  QTN_ITEM_PICKER_CONTEXT_FIELDS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  buildItemPickerJsonPayload,
} from "./constants";
import "./PurchaseQuotationForm.css";

// ── Temp-ID generator (negative → never clash with real IDs) ─────────
let _pqTempId = -1;
const nextTempId = () => _pqTempId--;

function mapHeaderValuesToFilterValues(headerValues, masterRow = null) {
  if (!headerValues) return null;
  return {
    trancode: headerValues.trancode ?? "",
    trandate: headerValues.trandate ?? "",
    divisionid: String(headerValues.divisionid ?? ""),
    configid: String(headerValues.configid ?? ""),
    inquiryexpirydate: headerValues.inquiryexpirydate ?? "",
    supplierid: String(headerValues.supplierid ?? ""),
    currencyname: masterRow?.currencyname ?? String(headerValues.currencyname ?? ""),
    currencyrate: headerValues.currencyrate != null ? String(headerValues.currencyrate) : "",
    basedonid: String(headerValues.basedonid ?? "0"),
    suppquotno: headerValues.suppquotno ?? "",
    suppquotdate: headerValues.suppquotdate ?? "",
    contactperson: headerValues.contactperson ?? "",
    remarks: headerValues.remarks ?? "",
  };
}

function buildCurrencyPatchFromSupplier(supplier) {
  if (!supplier) return { currencyname: "", currencyrate: "" };
  return {
    currencyname: supplier.currencyname ?? "",
    currencyrate: supplier.currencyrate != null ? String(supplier.currencyrate) : "",
  };
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

export default function PurchaseQuotationForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new");
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord = location.state?.record ?? null;
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [detailCellErrors, setDetailCellErrors] = useState(null);

  // 2026-08-14 (/pm) — the "Fix N error(s) before saving" banner (built once,
  // at validation time, into formErrors) doesn't auto-update as the user
  // fixes fields one at a time (each field's own change handler only clears
  // fieldErrors for the field just edited) — so a field that's valid again
  // can still show the stale banner above it. Clearing just the known
  // header-validation banner string (not touching any other message already
  // in formErrors, e.g. save-failure/business-rule/detail-grid errors) once
  // every field error is gone fixes that without hiding unrelated errors.
  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) {
      setFormErrors((prev) => prev.filter((m) => m !== "Please fix the highlighted field(s) below."));
    }
  }, [fieldErrors]);
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
    quotationTypeOptions,
    supplierOptions,
    fetchQuotationTypes,
    clearQuotationTypes,
    fetchSupplierOptions,
    clearSuppliers,
    getSupplierRow,
    isLoadingQuotationTypes,
    isLoadingSuppliers,
    columns,
    allColumns,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    fetchEditRecord,
    fetchUnlockedHeaderDropdowns,
    fireCellEvent,
    eventColumns,
  } = usePurchaseQuotation(API_BASE_URL);

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
    inquiryexpirydate: null,
    divisionid: 0,
    supplierid: 0,
    currencyid: "",
    currencyrate: "",
    basedonid: "",
    suppquotno: "",
    suppquotdate: null,
    contactperson: "",
    remarks: "",
    companyid: session.companyId,
    yearid: session.yearId,
    loginid: session.loginId,
    userid: session.userId,
    idnumber: recordId,
  });

  // trandate defaults to today on a new record; existing records keep their
  // loaded date. basedonid still has no default — client requirement
  // 2026-07-24 remains for that dropdown.
  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { basedonid: "", trandate: getTodayDateInputValue() };
  }, [loadedFilterValues]);

  // Incrementing this forces EnterpriseFilterPanel to remount and re-apply
  // initialValues, resetting all filter field values visually on Cancel.
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [currencyExternalValues, setCurrencyExternalValues] = useState(null);

  // ── Edit-mode gate ─────────────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false);

  // Document Log modal (F6) — see PurchaseIndentForm.jsx's docLog for the
  // full reasoning (permission gates, GUID issuance, button-visibility
  // fetch, post-save document linking all live in the shared
  // useDocumentLogAccess hook now).
  const docLog = useDocumentLogAccess({
    tranTypeId: QTN_CONFIG.DM_TRAN_TYPE_ID,
    refDepartmentId: DOC_LOG_CFG.PURCHASE_REF_DEPARTMENT_ID,
    recordId,
    getDivisionId: () => headerValuesRef.current?.divisionid,
    isEditMode,
    postSave,
    logLabel: "[Quotation]",
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

  const buildDefaultHeaderValues = useCallback(() => {
    const resetSession = getUserSession();
    return {
      trancode: "",
      trandate: getTodayDateInputValue(),
      configid: 0,
      inquiryexpirydate: null,
      divisionid: 0,
      supplierid: 0,
      currencyid: "",
      currencyrate: "",
      basedonid: "",
      suppquotno: "",
      suppquotdate: null,
      contactperson: "",
      remarks: "",
      companyid: resetSession.companyId,
      yearid: resetSession.yearId,
      loginid: resetSession.loginId,
      userid: resetSession.userId,
      idnumber: 0,
    };
  }, []);

  // ── Tab state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("items");

  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [gridRows, setGridRows] = useState([]);
  const activeSelectionCount = activeTab === "items" ? itemSelectionCount : 0;

  const [approvedFilter, setApprovedFilter] = useState("all");
  const [isGridLoading, setIsGridLoading] = useState(false);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);

  usePageHeader({
    title: isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then use the Item Grid tab."
      : `Quotation #${recordId || routeId || "—"} — fill in the header fields, then use the Item Grid tab.`,
    showBack: true,
    backTo: QTN_CONFIG.ROUTE_PATH,
  });

  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta, isEditRoute]);

  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);

    try {
      const params = resolveEditLoadParams(recordId, listRecord, {
        idFields: [],
      });
      const { master, headerValues, details } = await fetchEditRecord(params);

      if (!master || !headerValues) {
        throw new Error("Quotation record not found.");
      }

      headerValuesRef.current = headerValues;
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues, master));
      setFilterResetKey((k) => k + 1);

      const activeCols = await fetchGridColumns(headerValues.divisionid ?? 0, editRecordGridColumnOpts(master));
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;

      const syncedDetails = syncEditGridDropdownValues(details, activeCols || []);

      if (itemGridRef.current?.loadRows) {
        itemGridRef.current.loadRows(syncedDetails);
      } else {
        queuedRowsRef.current = syncedDetails;
      }
    } catch (err) {
      console.error("[PQ] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load quotation record.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, listRecord, fetchEditRecord, fetchGridColumns]);

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

  /** Clear item EntryGrid + summary when item-picker API context changes */
  const clearItemGridState = useCallback(() => {
    itemGridRef.current?.clearRows?.();
    setGridRows([]);
    setItemSelectionCount(0);
    queuedRowsRef.current = [];
    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);
  }, []);

  // ── Filter cascade ─────────────────────────────────────────────────
  const handleFilterChange = useCallback(
    async (colName, val) => {
      if (QTN_ITEM_PICKER_CONTEXT_FIELDS.has(colName)) {
        clearItemGridState();
      }

      headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };
      setFieldErrors((prev) => {
        if (!prev[colName]) return prev;
        const next = { ...prev };
        delete next[colName];
        return next;
      });

      if (colName === "supplierid") {
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
        setCurrencyExternalValues({ currencyname: "", currencyrate: "" });
        clearQuotationTypes();
        clearSuppliers();
        if (val && val !== "0") {
          await Promise.all([fetchQuotationTypes(val), fetchSupplierOptions(val)]);
          focusFieldAfterCascade(filterPanelRef, "configid");
        }
        return buildCurrencyPatchFromSupplier(null);
      }

      return undefined;
    },
    [
      fetchQuotationTypes,
      fetchSupplierOptions,
      clearQuotationTypes,
      clearSuppliers,
      getSupplierRow,
      clearItemGridState,
    ]
  );

  // ── syncedFilters ─────────────────────────────────────────────────
  const syncedFilters = useMemo(() => {
    const apiColMap = buildHeaderColMap(headerColumns);

    const injectListOptions = (filter, baseFilter) => {
      switch (filter.FilterParameterID) {
        case "divisionid":
          return { ...baseFilter, staticOptions: divisionOptions };
        case "configid":
          return { ...baseFilter, staticOptions: quotationTypeOptions };
        case "supplierid":
          return { ...baseFilter, staticOptions: supplierOptions };
        default:
          return baseFilter;
      }
    };

    const buildFilterDef = (filter) => {
      const apiCol = resolveHeaderApiCol(filter, apiColMap);
      const lockOnEditMode = apiCol ? isLockOnEditModeCol(apiCol) : false;

      let def = syncHeaderFilterWithApiCol(filter, apiCol, { lockOnEditMode });

      if (apiCol) {
        def.FilterColCtrlType = apiCol.colctrltype;
      }

      const isDropdownField = apiCol?.colctrltype === 4;

      // Edit route — locked dropdowns from GET_MASTER_DATA_FILL; unlocked use list APIs in edit mode
      if (isEditRoute && loadedMasterRow) {
        if (filter.FilterParameterID === "basedonid") {
          const basedOnVal = String(
            loadedMasterRow.basedonid ?? headerValuesRef.current?.basedonid ?? "0"
          );
          if (lockOnEditMode || !isEditMode) {
            const match = QTN_CONFIG.BASED_ON_OPTIONS.find((o) => o.value === basedOnVal);
            def.staticOptions = [{ value: basedOnVal, label: match?.label ?? basedOnVal }];
          } else {
            def.staticOptions = QTN_CONFIG.BASED_ON_OPTIONS;
          }
          return def;
        }

        if (isDropdownField) {
          if (lockOnEditMode || !isEditMode) {
            // RB_PurQtnMst leaves CtrlDisplayCol blank for supplierid — fall back to
            // the "suppliername" field GET_MASTER_DATA_FILL actually returns.
            const effectiveApiCol =
              filter.FilterParameterID === "supplierid" && !apiCol?.ctrldisplaycol
                ? { ...apiCol, ctrldisplaycol: "suppliername" }
                : apiCol;
            def.staticOptions = buildDropdownOptionFromRow(effectiveApiCol, loadedMasterRow);
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
    return QTN_MASTER.headerFields
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
    quotationTypeOptions,
    supplierOptions,
    isEditRoute,
    loadedMasterRow,
    isEditMode,
  ]);

  const syncedSummaryFields = useMemo(
    () => syncMasterSummaryFields(QTN_MASTER.summaryFields, headerColumns),
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
  //   1. Pick RB code + row-fetch SP by BasedOn ('0' Direct | '2' Inquiry Based)
  //   2. Fetch RBID via fn_fetch_rbdetailbyrbcode
  //   3. Fetch grid columns via GetDetailColData
  //   4. Fetch item rows via SP_ITEM_PICKER_DIRECT | SP_ITEM_PICKER_INQUIRY
  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    // Same validation call + display pattern as handleSave's own header
    // check below (inline fieldErrors highlighting + generic banner),
    // instead of the old bullet-list-of-labels-only banner — also fixes a
    // real gap the old path had: it never passed zeroValidFields, so
    // Based On=0 ("Direct") was wrongly flagged missing even when set.
    const headerFieldNames = new Set(QTN_HEADER_FILTERS.map((f) => f.FilterParameterID));
    const headerColsToValidate = headerColumns.filter((c) => headerFieldNames.has(c.colname));
    const headerErrorMap = validateApiColumnsByField(headerValues, headerColsToValidate, {
      zeroValidFields: new Set(["basedonid"]),
    });
    setFieldErrors(headerErrorMap);
    if (Object.keys(headerErrorMap).length > 0) {
      setFormErrors(["Please fix the highlighted field(s) below."]);
      return;
    }
    setFormErrors([]);

    const { basedonid: BasedOnID } = headerValues;
    const loginId = getUserSession().loginId;
    const isInquiryBased = Number(BasedOnID) === 2;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      const rbCode = isInquiryBased
        ? QTN_CONFIG.RB_ITEM_PICKER_INQUIRY
        : QTN_CONFIG.RB_ITEM_PICKER_DIRECT;
      const itemPickerSp = isInquiryBased
        ? QTN_CONFIG.SP_ITEM_PICKER_INQUIRY
        : QTN_CONFIG.SP_ITEM_PICKER_DIRECT;

      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: QTN_CONFIG.SP_RB_META,
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
      const gridColumns = buildGridColumns(
        colRes || [],
        {},
        {
          filterable: false,
          allEditable: false,
        }
      );
      setItemModalColumns(gridColumns);

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: itemPickerSp,
        JSon: JSON.stringify([buildItemPickerJsonPayload(headerValues, loginId)]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setItemModalItems(rowRes || []);
    } catch (err) {
      console.error("[PQ] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, headerColumns]);

  const handleCellEvent = useCallback(
    ({ rowId, colKey, rowData }) =>
      trackCellEvent(async () => {
        const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
        if (!result || !itemGridRef.current) return;
        const responseRow = result?.[0];
        if (!responseRow) return;
        const errCode = responseRow.errcode;
        if (errCode !== 1 && errCode !== 1.0) {
          console.warn("[PQ] Cell-event error:", responseRow.errmsg ?? `ErrCode ${errCode}`);
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

      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) return;
      const rows = selectedItems.map((item) => mapPickerToItemRow(item, allColumns));
      rows.forEach((row) => addItemRow(row));
      // Fire the same qty/rate recalc a manual blur would trigger, so a
      // picker-inserted row's calculated amounts are correct immediately
      // instead of staying 0.00 until the user touches the cell (client-
      // confirmed 2026-07-24, same fix as Purchase Voucher/Order).
      await Promise.all(rows.map((row) => handleCellEvent({ rowId: row.id, colKey: "tranqty", rowData: row })));
    },
    [ensureItemColumns, allColumns, addItemRow, handleCellEvent]
  );

  // ── Delete selected rows (items grid) ──────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    const ref = itemGridRef;
    if (!ref?.current) return;
    const selected = ref.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    ref.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  const { resetFormToInitialState, discardChanges, completeSuccessfulSave } = useTransactionFormReset({
    storageKeys: [QTN_CONFIG.STORAGE_HEADER_META, QTN_CONFIG.STORAGE_ENTRY_META],
    buildDefaultHeaderValues,
    headerValuesRef,
    queuedRowsRef,
    gridColumnsLoadedRef,
    itemGridRef,
    editRecordLoadedRef,
    isEditRoute,
    loadEditRecord,
    exitEditMode,
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
    extraClearFns: [clearQuotationTypes, clearSuppliers, docLog.resetDocGuid],
    extraReset: () => {
      setCurrencyExternalValues({ currencyname: "", currencyrate: "" });
      setApprovedFilter("all");
      setLoadedMasterRow(null);
      summaryRef.current?.resetOverrides?.();
      setFieldErrors({});
      setDetailCellErrors(null);
      // Back to a blank new-entry state — re-issue a fresh GUID for whatever
      // the user enters next, same as the initial mount fetch. No-op on an
      // edit route (isNewRoute is false there).
      if (isNewRoute) docLog.fetchDocGuid();
    },
  });


  // ── Save / Cancel ──────────────────────────────────────────────────
  const [isSavingQtn, setIsSavingQtn] = useState(false);

  const handleSave = useCallback(
    async ({ skipPostSave = false } = {}) => {
      await flushPendingCellEvents(itemGridSectionRef);

      setFormErrors([]);
      const hv = headerValuesRef.current;

      // ── Validation (header + detail grid) ────────────────────────────
      const headerFieldNames = new Set(QTN_HEADER_FILTERS.map((f) => f.FilterParameterID));
      const headerColsToValidate = headerColumns.filter((c) => headerFieldNames.has(c.colname));
      const headerErrorMap = validateApiColumnsByField(hv, headerColsToValidate, {
        zeroValidFields: new Set(["basedonid"]),
      });
      setFieldErrors(headerErrorMap);

      const itemRows = itemGridRef.current?.getRows?.() ?? [];
      const { errors: detailErrors, cellErrors: detailCellErrs } = validateGridRowsDetailed(itemRows, columns, { requireAtLeastOne: true });
      setDetailCellErrors(detailCellErrs);

      const headerBannerMsg =
        Object.keys(headerErrorMap).length > 0 ? ["Please fix the highlighted field(s) below."] : [];
      const allErrors = [...headerBannerMsg, ...(itemRows.length === 0 ? detailErrors : [])];
      if (Object.keys(headerErrorMap).length > 0 || detailCellErrs.size > 0 || itemRows.length === 0) {
        setFormErrors(allErrors);
        return false;
      }

      // ── Master ────────────────────────────────────────────────────────
      const userSession = getUserSession();
      const masterColumnDefs = headerColumns.map((col) => ({
        key: col.colname,
        colDataType: col.coldatatype,
      }));
      const mstRow = buildSaveRowFromColumns(hv, masterColumnDefs, {
        ...(summaryRef.current?.getSummary?.() ?? {}),
        loginid: userSession.loginId,
        userid: userSession.userId,
      });

      // ── Detail ────────────────────────────────────────────────────────
      const sessionFields = { loginid: userSession.loginId, userid: userSession.userId };
      const detRows = itemRows.map(({ id, ...rest }) =>
        buildSaveRowFromColumns(rest, allColumns, sessionFields)
      );

      const payload = await withSaveContextFields(
        buildSaveJsonFields({ label: "PQ", mst: mstRow, det: detRows }),
        { divisionId: hv.divisionid, isEdit: isEditRoute }
      );

      setIsSavingQtn(true);
      try {
        const result = await postSave(QTN_CONFIG.SAVE_ENDPOINT, payload);
        const { success, message, newId } = parseApiErrMsg(result);
        if (!success) { setFormErrors([message]); return false; }
        notify.success(message);

        // Saves any document rows staged in the Documents modal but never
        // explicitly submitted via its own Save button, then links any docs
        // staged under docGuid (before this transaction existed) to the
        // now-saved transaction — see useDocumentLogAccess.finalizeSave.
        // Covers Add-mode too, since savedTranId comes from this save's own
        // response rather than the (Add-mode-stale) recordId. Best-effort:
        // a failure here must never be treated as the Quotation's own save
        // having failed — it already succeeded by this point.
        const savedTranId = newId ?? (isEditRoute ? recordId : null);
        await docLog.finalizeSave(savedTranId);

        if (!skipPostSave) completeSuccessfulSave();
        return true;
      } catch (err) {
        console.error("[PQ Save] Failed:", err);
        notify.error(err?.message || "Save failed. Please try again.");
        return false;
      } finally {
        setIsSavingQtn(false);
      }
    },
    [headerColumns, allColumns, columns, postSave, completeSuccessfulSave, isEditRoute, recordId, docLog.finalizeSave, flushPendingCellEvents]
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
    // Covers the isEditRoute branch below too (re-fetches instead of going
    // through resetFormToInitialState/extraReset) — a stale Round Off
    // override must not survive a Cancel either way.
    summaryRef.current?.resetOverrides?.();

    if (isEditRoute) {
      exitEditMode();
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
  const filterBusy = filterPanelLoading || isLoadingQuotationTypes || isLoadingSuppliers;

  useEntryFormKeyboard({
    blocked: itemModalOpen || docLog.docModalOpen,
    isEditMode,
    isSaving: isSavingQtn,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onSavePrint: handleSaveAndPrint,
    onCancel: handleCancel,
    onSelectList: handleSelectListShortcut,
    onToggleCollapsible: handleToggleCollapsible,
    onDocuments: docLog.handleOpenDocuments,
  });

  // Extra buttons visible in the ActionBar while in edit mode
  const qtnExtraButtons = useMemo(
    () => [
      // Show/hide only, never a disabled state (matches Indent's convention)
      // — docLog.documentsButtonEntry already encodes this (null when
      // permission gates say no), spread in/out of the array so ActionBar's
      // own `showAlways || isEditMode` filter hides/shows it with Add/Edit
      // mode the same way every other extra button does.
      ...(docLog.documentsButtonEntry ? [docLog.documentsButtonEntry] : []),
      {
        key: "saveprint",
        label: "Save & Print",
        Icon: Printer,
        variant: "print",
        onClick: handleSaveAndPrint,
        disabled: isSavingQtn,
        accessKey: "p",
        title: FORM_SHORTCUT_TITLES.savePrint,
      },
      {
        key: "save",
        label: isSavingQtn ? "Saving…" : "Save",
        Icon: Save,
        variant: "save",
        onClick: () => handleSave(),
        disabled: isSavingQtn,
        loading: isSavingQtn,
        accessKey: "s",
        title: FORM_SHORTCUT_TITLES.save,
      },
    ],
    [docLog.documentsButtonEntry, handleSaveAndPrint, isSavingQtn, handleSave]
  );

  return (
    <div className="workspace-page workspace-page--fill pq-page">
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
            title="Purchase Quotation Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={QTN_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            isSearching={filterPanelLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterPanelLoading || !headerMetaReady}
            fieldTones={filterFieldTones}
            fieldErrors={fieldErrors}
            externalValues={currencyExternalValues}
            onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
          />
        )}
      </section>

      <section className="pq-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={QTN_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchable={activeTab === "items"}
          hideBottomPanel
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

              <div className="pq-tab-filter">
                <span className="pq-tab-filter__label">Approved</span>
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
              <div className="pq-terms-pane">
                <table className="pq-terms-table">
                  <thead>
                    <tr>
                      {TERMS_COLUMNS.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={TERMS_COLUMNS.length} className="pq-terms-empty">
                        No terms &amp; conditions added.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null
          }
          readOnly={isEditRoute && !isEditMode}
          emptyMessage="No items yet. Click Select Item above."
          onSelectionChange={setItemSelectionCount}
          onRowsChange={setGridRows}
          onCellEvent={handleCellEvent}
          eventColumns={eventColumns}
          existingRecordEdit={isEditRoute}
          cellErrors={detailCellErrors}
          remarkModalColumns={QTN_REMARK_COLUMNS}
        />
      </section>

      <EnterpriseSummaryPanel ref={summaryRef} fields={syncedSummaryFields} rows={gridRows} masterValues={loadedMasterRow} />

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        onCancel={handleCancel}
        addLabel={isEditRoute ? "Edit" : "Add"}
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={qtnExtraButtons}
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

      <Suspense fallback={null}>
        <DocumentLogModal
          ref={docLog.docModalRef}
          isOpen={docLog.docModalOpen}
          onClose={() => docLog.setDocModalOpen(false)}
          tranId={recordId}
          divisionId={headerValuesRef.current?.divisionid}
          tranTypeId={QTN_CONFIG.DM_TRAN_TYPE_ID}
          refDepartmentId={DOC_LOG_CFG.PURCHASE_REF_DEPARTMENT_ID}
          guid={docLog.docGuid}
        />
      </Suspense>
    </div>
  );
}
