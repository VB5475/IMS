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
//   4. QtnActionBar           — Save / Cancel / Close etc.
//
// Quotation item picker RB + prmFrmOption follow BasedOnID ('0' Direct | '2' Inquiry Based).

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, FileText, Printer, Save, LogOut } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EnterpriseSummaryPanel from "../../components/filters/EnterpriseSummaryPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import OrderItemModal from "../../components/txn/OrderItemModal";
import SearchSelect from "../../components/ui/SearchSelect";
import { usePurchaseQuotation } from "../../hooks/usePurchaseQuotation";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  getColDefault,
  OBJ_TYPE,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import {
  buildGridColumns,
  buildDropdownOptionFromRow,
  isLockOnEditModeCol,
  syncHeaderFilterWithApiCol,
  buildHeaderColMap,
  resolveHeaderApiCol,
  syncMasterSummaryFields,
} from "../../utils/gridUtils";
import { controlTypeMap } from "../../data/dummyData";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import {
  QTN_CONFIG,
  QTN_MASTER,
  QTN_HEADER_FILTERS,
  QTN_GRID_TABS,
  QTN_LIST_DROPDOWN_FIELDS,
  QTN_READONLY_FIELDS,
  APPROVED_OPTS,
  TERMS_COLUMNS,
  QTN_FILTER_CASCADE_RESETS,
  formatTranDate,
} from "./constants";
import "./PurchaseQuotationForm.css";

// ── Temp-ID generator (negative → never clash with real IDs) ─────────
let _pqTempId = -1;
const nextTempId = () => _pqTempId--;

function mapHeaderValuesToFilterValues(headerValues, masterRow = null) {
  if (!headerValues) return null;
  return {
    TranCode: headerValues.TranCode ?? "",
    TranDate: headerValues.TranDate ?? "",
    DivisionID: String(headerValues.DivisionID ?? ""),
    ConfigID: String(headerValues.ConfigID ?? ""),
    ExpiryDate: headerValues.ExpiryDate ?? "",
    SupplierID: String(headerValues.SupplierID ?? ""),
    CurrencyID: masterRow?.CurrencyName ?? String(headerValues.CurrencyID ?? ""),
    CurrencyRate: headerValues.CurrencyRate != null ? String(headerValues.CurrencyRate) : "",
    BasedOnID: String(headerValues.BasedOnID ?? "0"),
    SupplierQuotNo: headerValues.SupplierQuotNo ?? "",
    SupplierQuotDate: headerValues.SupplierQuotDate ?? "",
    ContactPerson: headerValues.ContactPerson ?? "",
    Remarks: headerValues.Remarks ?? "",
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
    yearId: listRecord?.YearID ?? session.yearId ?? QTN_CONFIG.CONFIG_YEAR_ID,
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

// Map an item picker row → items grid row (seeded from allColumns).
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

// ── Component ────────────────────────────────────────────────────────

export default function PurchaseQuotationForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new");
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
    isFetching,
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

  // Computed first so both the ref and the filter panel share the same initial date.
  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const session = getUserSession();

  const headerValuesRef = useRef({
    TranCode: "",
    TranDate: todayISO,
    ConfigID: 0,
    ExpiryDate: null,
    DivisionID: 0,
    SupplierID: 0,
    CurrencyID: "",
    CurrencyRate: "",
    BasedOnID: "0",
    SupplierQuotNo: "",
    SupplierQuotDate: null,
    ContactPerson: "",
    Remarks: "",
    CompanyID: 1,
    YearID: QTN_CONFIG.DIVISION_YEAR_ID,
    LoginID: session.loginId,
    UserID: session.userId,
    IDNumber: recordId,
  });

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { BasedOnID: "0", TranDate: todayISO };
  }, [loadedFilterValues, todayISO]);

  // Incrementing this forces EnterpriseFilterPanel to remount and re-apply
  // initialValues, resetting all filter field values visually on Cancel.
  const [filterResetKey, setFilterResetKey] = useState(0);

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
        if (!focusFirstEditableFilterField()) {
          focusSelectItemButton();
        }
      }, 80);
    });
  }, [focusFirstEditableFilterField, focusSelectItemButton]);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  const resetFormToInitialState = useCallback(() => {
    localStorage.removeItem(QTN_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(QTN_CONFIG.STORAGE_ENTRY_META);
    sessionStorage.removeItem(QTN_CONFIG.STORAGE_HEADER_META);
    sessionStorage.removeItem(QTN_CONFIG.STORAGE_ENTRY_META);

    const resetSession = getUserSession();
    headerValuesRef.current = {
      TranCode: "",
      TranDate: todayISO,
      ConfigID: 0,
      ExpiryDate: null,
      DivisionID: 0,
      SupplierID: 0,
      CurrencyID: "",
      CurrencyRate: "",
      BasedOnID: "0",
      SupplierQuotNo: "",
      SupplierQuotDate: null,
      ContactPerson: "",
      Remarks: "",
      CompanyID: 1,
      YearID: QTN_CONFIG.DIVISION_YEAR_ID,
      LoginID: resetSession.loginId,
      UserID: resetSession.userId,
      IDNumber: 0,
    };

    queuedRowsRef.current = [];
    gridColumnsLoadedRef.current = false;

    clearQuotationTypes();
    clearSuppliers();

    setActiveTab("items");
    setApprovedFilter("all");
    setIsGridLoading(false);
    setItemSelectionCount(0);

    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);

    itemGridRef.current?.clearRows?.();
    setGridRows([]);

    setFilterResetKey((k) => k + 1);
    exitEditMode();
  }, [clearQuotationTypes, clearSuppliers, exitEditMode, todayISO]);

  const completeSuccessfulSave = useCallback(() => {
    if (isEditRoute) {
      navigate("/purchase-quotation");
    } else {
      resetFormToInitialState();
    }
  }, [isEditRoute, navigate, resetFormToInitialState]);

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
    title: isNewRoute ? "New Purchase Quotation" : "Purchase Quotation",
    subtitle: isNewRoute
      ? "Fill in the header fields, then use the Item Grid tab."
      : `Quotation #${recordId || routeId || "—"} — fill in the header fields, then use the Item Grid tab.`,
    showBack: true,
    backTo: "/purchase-quotation",
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
      const { master, headerValues, details } = await fetchEditRecord(params);

      if (!master || !headerValues) {
        throw new Error("Quotation record not found.");
      }

      headerValuesRef.current = headerValues;
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues, master));
      setFilterResetKey((k) => k + 1);

      const activeCols = await fetchGridColumns(headerValues.DivisionID ?? 0, {
        existingRecordEdit: true,
        masterRow: master,
        fetchUnlockedDropdowns: false,
      });
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;

      if (itemGridRef.current?.loadRows) {
        itemGridRef.current.loadRows(details);
      } else {
        queuedRowsRef.current = details;
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

    const divisionId = headerValuesRef.current?.DivisionID ?? loadedMasterRow?.DivisionID ?? 0;
    fetchUnlockedHeaderDropdowns(divisionId);
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
        case "DivisionID":
          return { ...baseFilter, staticOptions: divisionOptions };
        case "ConfigID":
          return { ...baseFilter, staticOptions: quotationTypeOptions };
        case "SupplierID":
          return { ...baseFilter, staticOptions: supplierOptions };
        default:
          return baseFilter;
      }
    };

    const buildFilterDef = (filter) => {
      const apiCol = resolveHeaderApiCol(filter, apiColMap);
      const lockOnEditMode = apiCol ? isLockOnEditModeCol(apiCol) : false;
      const forceListDropdown = QTN_LIST_DROPDOWN_FIELDS.has(filter.FilterParameterID);

      let def = syncHeaderFilterWithApiCol(filter, apiCol, { lockOnEditMode });

      if (apiCol) {
        def.FilterColCtrlType = forceListDropdown
          ? controlTypeMap.DROPDOWN
          : (apiCol.ColCtrlType ?? filter.FilterColCtrlType);
      }

      const isDropdownField =
        forceListDropdown || def.FilterColCtrlType === controlTypeMap.DROPDOWN;

      // Edit route — locked dropdowns from GET_MASTER_DATA_FILL; unlocked use list APIs in edit mode
      if (isEditRoute && loadedMasterRow) {
        if (filter.FilterParameterID === "BasedOnID") {
          const basedOnVal = String(
            loadedMasterRow.BasedOnID ?? headerValuesRef.current?.BasedOnID ?? "0"
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
    return QTN_MASTER.headerFields.map(buildFilterDef);
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
      const alwaysReadOnly =
        QTN_READONLY_FIELDS.includes(f.FilterColName) ||
        QTN_READONLY_FIELDS.includes(f.FilterParameterID);
      if (alwaysReadOnly) tones[f.FilterColName] = "view";
      else if (!isEditMode) tones[f.FilterColName] = "view";
      else if (isEditRoute && f.lockOnEditMode) tones[f.FilterColName] = "frozen";
      else tones[f.FilterColName] = "editable";
    });
    return tones;
  }, [syncedFilters, isEditMode, isEditRoute]);

  // ── Filter cascade ─────────────────────────────────────────────────
  const handleFilterChange = useCallback(
    (colName, val) => {
      headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

      if (colName === "SupplierID") {
        if (!val || val === "0") {
          headerValuesRef.current.CurrencyID = "";
          headerValuesRef.current.CurrencyRate = "";
          return buildCurrencyPatchFromSupplier(null);
        }
        const supplier = getSupplierRow(val);
        if (supplier) {
          headerValuesRef.current.CurrencyID = supplier.CurrencyID ?? 0;
          headerValuesRef.current.CurrencyRate = supplier.CurrencyRate ?? "";
          return buildCurrencyPatchFromSupplier(supplier);
        }
        return undefined;
      }

      if (colName === "DivisionID") {
        headerValuesRef.current.ConfigID = 0;
        headerValuesRef.current.SupplierID = 0;
        headerValuesRef.current.CurrencyID = "";
        headerValuesRef.current.CurrencyRate = "";
        clearQuotationTypes();
        clearSuppliers();
        if (val && val !== "0") {
          void Promise.all([fetchQuotationTypes(val), fetchSupplierOptions(val)]);
        }
      }

      return undefined;
    },
    [fetchQuotationTypes, fetchSupplierOptions, clearQuotationTypes, clearSuppliers, getSupplierRow]
  );

  const ensureItemColumns = useCallback(async () => {
    if (gridColumnsLoadedRef.current && columns.length > 0) return columns;
    if (allColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const activeCols = await fetchGridColumns(headerValuesRef.current?.DivisionID ?? 0, {
        existingRecordEdit: isEditRoute,
        masterRow: loadedMasterRow,
        fetchUnlockedDropdowns: isEditRoute ? isEditMode : true,
      });
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [columns, allColumns, fetchGridColumns, isEditRoute, isEditMode, loadedMasterRow]);

  // ── Select Item (Items tab) ────────────────────────────────────────
  // RB code + prmFrmOption depend on BasedOnID ('0' Direct | '2' Inquiry Based).
  const handleSelectItem = useCallback(async () => {
    const { DivisionID, ConfigID, TranDate, BasedOnID } = headerValuesRef.current;
    const divisionID = DivisionID ?? 0;
    const configID = ConfigID ?? 0;
    const frmOption = Number(BasedOnID) || 0;
    if (!divisionID || divisionID === "0" || divisionID === 0) {
      alert("Please select a Division before selecting items.");
      return;
    }

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      const rbCode =
        frmOption === 2 ? QTN_CONFIG.RB_ITEM_PICKER_INQUIRY : QTN_CONFIG.RB_ITEM_PICKER_DIRECT;

      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: QTN_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: rbCode }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.Table?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.RBID,
        prmLoginID: getUserSession().loginId,
      });
      const gridColumns = buildGridColumns(
        colRes?.Links || [],
        {},
        {
          filterable: false,
          allEditable: false,
        }
      );
      setItemModalColumns(gridColumns);

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: QTN_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([
          {
            prmDivisionID: Number(divisionID),
            prmYearID: QTN_CONFIG.CONFIG_YEAR_ID,
            prmLoginID: getUserSession().loginId,
            prmTranDate: formatTranDate(TranDate),
            prmConfigID: Number(configID),
            prmSupplierID: Number(headerValuesRef.current?.SupplierID ?? 0),
            prmTranBook: QTN_CONFIG.TRAN_BOOK,
            prmFrmOption: frmOption,
          },
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setItemModalItems(rowRes?.Table || []);
    } catch (err) {
      console.error("[PQ] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive]);

  const handleInsertItems = useCallback(
    async (selectedItems) => {
      if (!selectedItems?.length) return;
      setActiveTab("items");

      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) return;
      selectedItems.forEach((item) => addItemRow(mapPickerToItemRow(item, allColumns)));
    },
    [ensureItemColumns, allColumns, addItemRow]
  );

  // ── Delete selected rows (items grid) ──────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    const ref = itemGridRef;
    if (!ref?.current) return;
    const selected = ref.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    ref.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  const handleCellEvent = useCallback(
    async ({ rowId, colKey, rowData }) => {
      const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
      if (!result || !itemGridRef.current) return;
      const responseRow = result?.Links?.[0];
      if (!responseRow) return;
      const errCode = responseRow.ErrCode;
      if (errCode !== 1 && errCode !== 1.0) {
        console.warn("[PQ] Cell-event error:", responseRow.ErrMsg ?? `ErrCode ${errCode}`);
        return;
      }
      const { ErrCode, ErrMsg, ...updatedFields } = responseRow;
      itemGridRef.current.updateRow?.(rowId, updatedFields);
    },
    [fireCellEvent]
  );

  // ── Save / Cancel ──────────────────────────────────────────────────
  const [isSavingQtn, setIsSavingQtn] = useState(false);

  const handleSave = useCallback(
    async ({ skipPostSave = false } = {}) => {
      // ── Master ────────────────────────────────────────────────────────
      const mstRow = {};
      headerColumns.forEach((col) => {
        mstRow[col.ColName] = getColDefault(col.ColDataType);
      });
      const hv = headerValuesRef.current;
      Object.entries(hv).forEach(([k, v]) => {
        if (k !== "id") mstRow[k] = v;
      });
      Object.assign(mstRow, summaryRef.current?.getSummary?.() ?? {});
      const userSession = getUserSession();
      mstRow.LoginID = userSession.loginId;
      mstRow.UserID = userSession.userId;

      // ── Detail ────────────────────────────────────────────────────────
      const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) => {
        const row = {};
        allColumns.forEach(({ key, colDataType }) => {
          row[key] = getColDefault(colDataType);
        });
        return { ...row, ...rest, LoginID: userSession.loginId, UserID: userSession.userId };
      });

      const payload = {
        prmStrMstJSON: JSON.stringify([mstRow]),
        prmStrDetJSON: JSON.stringify(detRows),
      };

      console.log("%c[PQ Save] Payload:", "color:#f59e0b;font-weight:700", payload);
      console.log("%c[PQ Save] Master:", "color:#6366f1;font-weight:600", [mstRow]);
      console.log("%c[PQ Save] Detail:", "color:#22c55e;font-weight:600", detRows);

      setIsSavingQtn(true);
      try {
        const result = await postSave(QTN_CONFIG.SAVE_ENDPOINT, payload);
        console.log("%c[PQ Save] Response:", "color:#22c55e;font-weight:700", result);
        const { success, message } = parseApiErrMsg(result);
        alert(message);
        if (!success) return false;

        if (!skipPostSave) completeSuccessfulSave();
        return true;
      } catch (err) {
        console.error("[PQ Save] Failed:", err);
        alert(err?.message || "Save failed. Please try again.");
        return false;
      } finally {
        setIsSavingQtn(false);
      }
    },
    [headerColumns, allColumns, postSave, completeSuccessfulSave]
  );

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave({ skipPostSave: true });
    if (!saved) return;
    window.print();
    completeSuccessfulSave();
  }, [handleSave, completeSuccessfulSave]);

  const handleCancel = useCallback(() => {
    if (!window.confirm("Discard changes and reset the form?")) return;

    if (isEditRoute) {
      exitEditMode();
      editRecordLoadedRef.current = false;
      loadEditRecord();
      return;
    }

    resetFormToInitialState();
  }, [exitEditMode, isEditRoute, loadEditRecord, resetFormToInitialState]);

  const handleClose = useCallback(() => navigate("/purchase-quotation"), [navigate]);
  const handleDocument = useCallback(() => {
    console.log("[PQ] Document F6 — reserved for document generation.");
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
    blocked: itemModalOpen,
    isEditMode,
    isSaving: isSavingQtn,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onCancel: handleCancel,
    onClose: handleClose,
  });

  // Extra buttons visible in the ActionBar while in edit mode
  const qtnExtraButtons = useMemo(
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
        disabled: isSavingQtn,
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
        title: "Save (Alt+S)",
      },
      {
        key: "close",
        label: "Close",
        Icon: LogOut,
        variant: "close",
        onClick: handleClose,
        showAlways: true,
        accessKey: "c",
        title: "Close (Alt+C)",
      },
    ],
    [handleDocument, handleSaveAndPrint, isSavingQtn, handleSave, handleClose]
  );

  return (
    <div className="workspace-page pq-page">
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
            onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
          />
        )}
      </section>

      <section className="pq-grid-section">
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {QTN_GRID_TABS.map((t) => (
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
                className="pq-tab-action-btn"
                onClick={handleSelectItem}
                disabled={!isEditMode}
                title="Pick items from list (Tab here after header fields)"
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
              className="pq-tab-delete-btn"
              onClick={handleDeleteSelected}
              disabled={!isEditMode || activeSelectionCount === 0}
              title="Delete selected rows"
            >
              <Trash2 size={12} strokeWidth={2} />
              Delete
            </button>
          </div>
        </div>

        <div className={`pq-tab-pane${activeTab === "items" ? " pq-tab-pane--active" : ""}`}>
          <EntryGrid
            ref={itemGridRef}
            config={itemGridConfig}
            title=""
            hideBottomPanel
            readOnly={isEditRoute && !isEditMode}
            emptyMessage="No items yet. Click Select Item above."
            onSelectionChange={setItemSelectionCount}
            onRowsChange={setGridRows}
            onCellEvent={handleCellEvent}
            eventColumns={eventColumns}
            existingRecordEdit={isEditRoute && isEditMode}
          />
        </div>

        {activeTab === "terms" && (
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
        )}
      </section>

      <EnterpriseSummaryPanel ref={summaryRef} fields={syncedSummaryFields} rows={gridRows} />

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        onCancel={handleCancel}
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={qtnExtraButtons}
      />

      <OrderItemModal
        isOpen={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        items={itemModalItems}
        columns={itemModalColumns}
        isLoading={itemModalLoading}
        error={itemModalError}
        onInsert={handleInsertItems}
      />
    </div>
  );
}
