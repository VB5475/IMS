// PurchaseOrderForm.jsx
// Purchase Order entry form (add / edit).
// Mirrors PurchaseInquiryForm.jsx exactly — same three-phase load, same 3-tab layout.
// PO-specific additions vs PI: Amend strip, Currency, Cr. Days, Supplier auto-fill on select.
//
// Layout (top → bottom):
//   1. Amend strip          — checkbox + conditional PO-select dropdown
//   2. EnterpriseFilterPanel — header fields (PO No, Date, Division, PO Type,
//                              Based On, Supplier, Currency (locked), Currency Rate (locked),
//                              Cr. Days, Delivery Date, Dept, Remarks)
//   3. po-grid-section       — 2-tab wrapper
//        • Item Grid tab  → EntryGrid (API columns, RB_PurPODet)
//                           button: Select Item
//        • Terms tab      → static terms table
//        Fixed controls (always): Approved filter | Delete
//   4. EnterpriseSummaryPanel — live totals computed from grid rows (reusable)
//   5. ActionBar            — Save / Cancel / Close etc. (bottom-right, Alt shortcuts)

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
import EnterpriseSummaryPanel from "../../components/filters/EnterpriseSummaryPanel";
import SearchSelect from "../../components/ui/SearchSelect";
import { usePurchaseOrder } from "../../hooks/usePurchaseOrder";
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
import { buildGridColumns, isLockOnEditModeCol, isTruthyApiFlag, syncHeaderFilterWithApiCol, editRecordGridColumnOpts, syncEditGridDropdownValues } from "../../utils/gridUtils";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  PO_CONFIG,
  PO_GRID_TABS,
  APPROVED_OPTS,
  TERMS_COLUMNS,
  PO_FILTER_CASCADE_RESETS,
  PO_SUMMARY_FIELDS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  formatTranDate,
  getMissingItemPickerHeaderFields,
} from "./constants";
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

function resolveEditLoadParams(recordId, listRecord) {
  const session = getUserSession();
  return {
    companyId: listRecord?.companyid ?? session.companyId ?? DEFAULT_COMPANY_ID,
    yearId: listRecord?.yearid ?? session.yearId ?? PO_CONFIG.CONFIG_YEAR_ID,
    loginId: listRecord?.loginid ?? session.loginId,
    sessionId: listRecord?.sessionid ?? DEFAULT_SESSION_ID,
    idNumber: listRecord?.poid ?? listRecord?.idnumber ?? recordId,
  };
}

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;

  // Validate basedonid against PO_CONFIG.BASED_ON_OPTIONS.
  // API may return values (e.g. 1) that are not in our config options — fall back to "0" (Direct).
  const basedOnStr = String(headerValues.basedonid ?? "0");
  const validBasedOn = PO_CONFIG.BASED_ON_OPTIONS.find((o) => o.value === basedOnStr);
  const resolvedBasedOnID = validBasedOn ? validBasedOn.value : "0";

  return {
    trancode:     headerValues.trancode ?? "",
    trandate:     headerValues.trandate ?? "",
    divisionid:   String(headerValues.divisionid ?? ""),
    configid:     String(headerValues.configid ?? ""),
    deliverydate: headerValues.deliverydate ?? "",
    supplierid:   String(headerValues.supplierid ?? ""),
    deptid:       String(headerValues.deptid ?? ""),
    basedonid:    resolvedBasedOnID,
    currencyname: headerValues.currencyname ?? "",
    currencyrate: String(headerValues.currencyrate ?? ""),
    creditdays:   String(headerValues.creditdays ?? ""),
    remarks:      headerValues.remarks ?? "",
  };
}

// Returns all focusable, visible filter field elements inside a panel node.
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
  const navigate = useNavigate();

  const itemGridRef = useRef(null);
  const summaryRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);

  const {
    headerColumns,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    divisionOptions,
    poTypeOptions,
    supplierOptions,
    departmentOptions,
    existingPOs,
    fetchPoTypes,
    clearPoTypes,
    fetchSupplierInfo,
    getSupplierCurrency,
    fetchExistingPOs,
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

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const headerValuesRef = useRef({
    trancode:      "",
    trandate:      todayISO,
    configid:      0,
    deliverydate:  null,
    divisionid:    0,
    supplierid:    0,
    deptid:        0,
    currencyid:    0,
    currencyname:  "",
    currencyrate:  0,
    creditdays:    0,
    basedonid:     "0",
    remarks:       "",
    tranmstgenid:  0,
    companyid:     1,
    yearid:        PO_CONFIG.DIVISION_YEAR_ID,
    loginid:       1,
    idnumber:      recordId,
    isamend:       0,
    amendpoid:     0,
    compuniquekey: 0,
    funccode:      PO_CONFIG.RB_MASTER,
  });

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { basedonid: "0", trandate: todayISO };
  }, [loadedFilterValues, todayISO]);

  const [filterResetKey, setFilterResetKey] = useState(0);

  // ── Amend strip state ──────────────────────────────────────────────
  const [isAmend, setIsAmend] = useState(false);
  const [amendPOID, setAmendPOID] = useState("");

  const handleAmendChange = useCallback(
    async (checked) => {
      setIsAmend(checked);
      headerValuesRef.current.isamend = checked ? 1 : 0;
      if (!checked) {
        setAmendPOID("");
        headerValuesRef.current.amendpoid = 0;
        return;
      }
      await fetchExistingPOs();
    },
    [fetchExistingPOs]
  );

  const handleAmendPOChange = useCallback((val) => {
    setAmendPOID(val);
    headerValuesRef.current.amendpoid = Number(val) || 0;
  }, []);

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
    backTo: "/purchase-order",
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
      const params = resolveEditLoadParams(recordId, listRecord);
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
          creditdays:   String(headerValues.creditdays ?? ""),
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
                prmLoginID: DEFAULT_LOGIN_ID,
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
    configid:   poTypeOptions,
    supplierid: supplierOptions,
    deptid:     departmentOptions,
    basedonid:  PO_CONFIG.BASED_ON_OPTIONS,
  }), [divisionOptions, poTypeOptions, supplierOptions, departmentOptions]);

  const syncedFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];

    const cols = headerColumns
      .filter((col) =>
        isTruthyApiFlag(col.isvisible) &&
        !PO_SUMMARY_COL_NAMES.has(col.colname) &&
        !PO_HEADER_HIDDEN_COLS.has(col.colname)
      )
      .map((col) => {
        const lockOnEditMode = isLockOnEditModeCol(col);
        const staticOptions  = DROPDOWN_OPTIONS_BY_COL[col.colname];
        const base = {
          FilterParameterID: col.colname,
          FilterColName:     col.colname,
          FilterCaption:     col.displayname ?? col.colname,
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
        FilterColName:     "currencyname",
        FilterCaption:     "Currency",
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

  // ── syncedSummaryFields — enrich PO_SUMMARY_FIELDS with labels from header RB columns ──
  const syncedSummaryFields = useMemo(() => {
    const colMap = {};
    headerColumns.forEach((col) => { colMap[col.colname] = col; });
    return PO_SUMMARY_FIELDS.map((f) => ({
      ...f,
      mstKey: f.SummaryParameterID,
      label: colMap[f.SummaryParameterID]?.displayname ?? f.SummaryParameterID,
    }));
  }, [headerColumns]);

  // ── Filter change / cascade ────────────────────────────────────────
  const handleFilterChange = useCallback(
    async (colName, val) => {
      headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

      if (colName === "divisionid") {
        headerValuesRef.current.configid = 0;
        headerValuesRef.current.supplierid = 0;
        clearPoTypes();
        itemGridRef.current?.clearRows?.();
        setChildRowsMap({});
        if (val && val !== "0") {
          await fetchPoTypes(val);
          requestAnimationFrame(() =>
            filterPanelRef.current
              ?.querySelector("#efq-configid .search-select__trigger")
              ?.focus()
          );
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
            headerValuesRef.current.currencyid   = cached.currencyid;
            headerValuesRef.current.currencyname = cached.currencyname;
            headerValuesRef.current.currencyrate = cached.currencyrate;
            headerValuesRef.current.creditdays   = cached.crdays;
            setCurrencyExternalValues({
              currencyname: cached.currencyname,
              currencyrate: String(cached.currencyrate),
              creditdays:   String(cached.crdays),
            });
          } else {
            const info = await fetchSupplierInfo(val);
            if (info) {
              headerValuesRef.current.currencyid   = info.currencyid;
              headerValuesRef.current.currencyname = info.currencyname ?? "";
              headerValuesRef.current.currencyrate = info.currencyrate;
              headerValuesRef.current.creditdays   = info.crdays;
              setCurrencyExternalValues({
                currencyname: info.currencyname ?? "",
                currencyrate: String(info.currencyrate),
                creditdays:   String(info.crdays),
              });
            }
          }
        } else {
          headerValuesRef.current.currencyid   = 0;
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
    async ({ rowId, colKey, rowData }) => {
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
    },
    [fireCellEvent]
  );

  // ── Select Item ────────────────────────────────────────────────────
  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }
    const { divisionid, configid, trandate, basedonid } = headerValues;
    const divisionID = divisionid ?? 0;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      let rbCode;
      if (Number(basedonid) === 2) rbCode = PO_CONFIG.RB_ITEM_PICKER_INDENT;
      else if (Number(basedonid) === 3) rbCode = PO_CONFIG.RB_ITEM_PICKER_QUOT;
      else rbCode = PO_CONFIG.RB_ITEM_PICKER_DIRECT;

      let spItemPicker;
      if (Number(basedonid) === 2) spItemPicker = PO_CONFIG.SP_ITEM_PICKER_INDENT;
      else if (Number(basedonid) === 3) spItemPicker = PO_CONFIG.SP_ITEM_PICKER_QUOT;
      else spItemPicker = PO_CONFIG.SP_ITEM_PICKER_DIRECT;

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
        prmLoginID: DEFAULT_LOGIN_ID,
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
        ObjName: spItemPicker,
        JSon: JSON.stringify([
          {
            prmdivisionid: Number(divisionID),
            prmyearid:     PO_CONFIG.CONFIG_YEAR_ID,
            prmloginid:    DEFAULT_LOGIN_ID,
            prmtrandate:   formatTranDate(trandate),
            prmconfigid:   Number(configid ?? 0),
            prmsupplierid: Number(headerValuesRef.current?.supplierid ?? 0),
            prmtranbook:   PO_CONFIG.TRAN_BOOK,
            prmfrmoption:  Number(basedonid) || 0,
          },
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setItemModalItems(rowRes || []);
    } catch (err) {
      console.error("[PO] Item picker fetch failed:", err);
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
            ObjName: PO_CONFIG.SP_INDENT_SUMMARY,
            JSon: [{ prmJSon: cleanItems }],
            p_ErrCode: -1,
            p_ErrMsg: "",
          }),
        });
        const summaryRes = await summaryResponse.json();

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
    [ensureItemColumns, allColumns, addItemRow, itemModalColumns]
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

  const handleSave = useCallback(async () => {
    const hv = headerValuesRef.current;

    // ── Validation (header + detail + indent) ────────────────────────
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
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

    const mstRow = {};
    headerColumns.forEach((col) => {
      mstRow[col.colname] = getColDefault(col.coldatatype);
    });
    Object.entries(hv).forEach(([k, v]) => {
      if (k !== "id") mstRow[k] = v;
    });
    Object.assign(mstRow, summaryRef.current?.getSummary?.() ?? {});
    const { loginId } = getUserSession();
    mstRow.loginid = loginId;

    const detRows = itemRows.map(({ id, ...rest }) => {
      const row = {};
      allColumns.forEach(({ key, colDataType }) => {
        row[key] = getColDefault(colDataType);
      });
      return { ...row, ...rest, loginid: loginId };
    });

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
      const res = await fetch(`${API_BASE_URL_IMS}${PO_CONFIG.SAVE_ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
    } catch (err) {
      console.error("[PO Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSavingPO(false);
    }
  }, [headerColumns, allColumns, childRowsMap, columns, childColumns, isEditRoute]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave();
    if (!saved) return;
    window.print();
  }, [handleSave]);

  const [discardOpen, setDiscardOpen] = useState(false);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);

    localStorage.removeItem(PO_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(PO_CONFIG.STORAGE_ENTRY_META);
    sessionStorage.removeItem(PO_CONFIG.STORAGE_HEADER_META);
    sessionStorage.removeItem(PO_CONFIG.STORAGE_ENTRY_META);

    headerValuesRef.current = {
      trancode:      "",
      trandate:      todayISO,
      configid:      0,
      deliverydate:  null,
      divisionid:    0,
      supplierid:    0,
      deptid:        0,
      currencyid:    0,
      currencyname:  "",
      currencyrate:  0,
      creditdays:    0,
      basedonid:     "0",
      remarks:       "",
      tranmstgenid:  0,
      companyid:     1,
      yearid:        PO_CONFIG.DIVISION_YEAR_ID,
      loginid:       1,
      idnumber:      0,
      isamend:       0,
      amendpoid:     0,
      compuniquekey: 0,
      funccode:      PO_CONFIG.RB_MASTER,
    };
    setGridRows([]);
    setCurrencyExternalValues({ currencyname: "", currencyrate: "", creditdays: "" });

    queuedRowsRef.current = [];
    gridColumnsLoadedRef.current = false;

    clearPoTypes();
    clearSaveError();

    setIsAmend(false);
    setAmendPOID("");
    setActiveTab("items");
    setApprovedFilter("all");
    setIsGridLoading(false);
    setItemSelectionCount(0);

    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);

    setChildRowsMap({});
    setChildColumns([]);

    itemGridRef.current?.clearRows?.();

    setFilterResetKey((k) => k + 1);
    exitEditMode();
  }, [clearPoTypes, clearSaveError, exitEditMode, todayISO]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  const handleDocument = useCallback(() => {
    console.log("[PO] Document F6 — reserved for document generation.");
  }, []);

  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = headerFetching || isLoadingPoTypes;

  useEntryFormKeyboard({
    blocked: itemModalOpen,
    isEditMode,
    isSaving: isSavingPO,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onSavePrint: handleSaveAndPrint,
    onCancel: handleCancel,
    onSelectList: handleSelectListShortcut,
    onToggleCollapsible: handleToggleCollapsible,
  });

  // ── Extra ActionBar buttons ────────────────────────────────────────
  const poExtraButtons = useMemo(
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
    [handleDocument, handleSaveAndPrint, isSavingPO, handleSave]
  );

  const itemGridConfig = {
    columns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const combinedError = metaError || headerError;

  return (
    <div className="workspace-page po-page">
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
            {/* ── Amend strip ─────────────────────────────────────── */}
            <div className="po-amend-strip">
              <div className="po-amend-strip__checkbox">
                <input
                  type="checkbox"
                  id="po-amend-chk"
                  className="po-amend-strip__chk-input"
                  checked={isAmend}
                  onChange={(e) => handleAmendChange(e.target.checked)}
                  disabled={!isEditMode}
                />
                <label htmlFor="po-amend-chk" className="po-amend-strip__chk-label">
                  Amend
                </label>
              </div>

              {isAmend && (
                <div className="po-amend-strip__select">
                  <SearchSelect
                    value={amendPOID}
                    onChange={handleAmendPOChange}
                    options={existingPOs}
                    placeholder="Select PO to Amend…"
                    ariaLabel="Select PO to Amend"
                    disabled={!isEditMode}
                  />
                </div>
              )}
            </div>

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
              onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
            />
          </>
        )}
      </section>

      {/* ── 3-tab grid section ───────────────────────────────────────── */}
      <section className="po-grid-section">
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {PO_GRID_TABS.map((t) => (
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
          </div>
        </div>

        <div className={`po-tab-pane${activeTab === "items" ? " po-tab-pane--active" : ""}`}>
          <EntryGrid
            ref={itemGridRef}
            config={itemGridConfig}
            title=""
            hideBottomPanel
            emptyMessage="No items yet. Click Entry Form or Select Item above."
            onSelectionChange={setItemSelectionCount}
            onRowsChange={setGridRows}
            onCellEvent={handleCellEvent}
            eventColumns={eventColumns}
            enableCollapsible={Object.keys(childRowsMap).length > 0}
            childRowsMap={childRowsMap}
            childColumns={childColumns}
            readOnly={isEditRoute && !isEditMode}
            existingRecordEdit={isEditRoute && isEditMode}
          />
        </div>

        {activeTab === "terms" && (
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
        )}
      </section>

      {/* ── Summary totals — live from grid rows ── */}
      <EnterpriseSummaryPanel ref={summaryRef} fields={syncedSummaryFields} rows={gridRows} />

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
          isLoading={itemModalLoading}
          error={itemModalError}
          onInsert={handleInsertItems}
        />
      </Suspense>
    </div>
  );
}
