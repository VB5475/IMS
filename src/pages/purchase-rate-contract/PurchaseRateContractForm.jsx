// PurchaseRateContractForm.jsx — Purchase Rate Contract (add / edit)
// MRD_Template4PurchaseRateContract.docx (Richa, 03-Jul-2026).
//
// Layout:
//   1. EnterpriseFilterPanel — header (Contract No, Date, Division, Supplier,
//      Currency, Currency Rate, Expiry Date, Remarks) from rb_purratecontmst
//   2. Tabs — Contract Item Detail | Terms And Conditions
//   3. ActionBar — Add / Save / Cancel

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, Save, FileText, Plus } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import TermsPickerModal from "../../components/purchase-inquiry/TermsPickerModal";
import { useNotification } from "../../context/NotificationContext";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import { usePurchaseRateContract } from "../../hooks/usePurchaseRateContract";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  getColDefault,
  buildSaveRowFromColumns,
  OBJ_TYPE,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import {
  buildGridColumns,
  isLockOnEditModeCol,
  isTruthyApiFlag,
  syncHeaderFilterWithApiCol,
  editRecordGridColumnOpts,
  syncEditGridDropdownValues,
} from "../../utils/gridUtils";
import { validateApiColumnsByField, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { queryEditableFilterFields, resolveEditLoadParams } from "../../utils/txnFormUtils";
import { dateToStoredValue, getTodayDateInputValue, isDateColumnDef } from "../../utils/dateFormat";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { useTransactionFormReset } from "../../hooks/useTransactionFormReset";
import { usePendingCellEventFlush } from "../../hooks/usePendingCellEventFlush";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  PRC_CONFIG,
  PRC_REMARK_COLUMNS,
  PRC_GRID_TABS,
  PRC_FILTER_CASCADE_RESETS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  buildItemPickerJsonPayload,
  buildTermsPickerJsonPayload,
} from "./constants";
import "./PurchaseRateContractPage.css";

let _prcTempId = -1;
const nextTempId = () => _prcTempId--;

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    trancode: headerValues.trancode ?? "",
    trandate: headerValues.trandate ?? "",
    divisionid: headerValues.divisionid ?? 0,
    supplierid: headerValues.supplierid ?? 0,
    currencyid: headerValues.currencyid ?? 0,
    currencyname: headerValues.currencyname ?? "",
    currencyrate: headerValues.currencyrate ?? "",
    expirydate: headerValues.expirydate ?? "",
    remarks: headerValues.remarks ?? "",
    configid: headerValues.configid ?? 0,
  };
}

function mapPickerToItemRow(item, allColumns, dateColKeys = new Set()) {
  const row = { id: nextTempId() };
  const today = dateToStoredValue(new Date());
  allColumns.forEach(({ key, colDataType }) => {
    row[key] = dateColKeys.has(key) ? today : getColDefault(colDataType);
  });
  Object.entries(item).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (lk === "id" || dateColKeys.has(lk)) return;
    if (v != null && Object.prototype.hasOwnProperty.call(row, lk)) row[lk] = v;
  });
  return row;
}

function mapPickerRowToGridRow(item, allColumns, extras = {}) {
  const row = { id: nextTempId(), ...extras };
  allColumns.forEach(({ key, colDataType }) => {
    if (!(key in row)) row[key] = getColDefault(colDataType);
  });
  Object.entries(item).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (lk === "id") return;
    if (v != null && Object.prototype.hasOwnProperty.call(row, lk)) row[lk] = v;
  });
  return row;
}

/** MRD: Amount = Qty × Rate (client-side fallback when event SP is unavailable). */
function applyQtyRateAmount(row) {
  const qty = Number(row.qty ?? row.tranqty ?? 0);
  const rate = Number(row.rate ?? row.tranrate ?? 0);
  if (!Number.isFinite(qty) || !Number.isFinite(rate)) return row;
  const amount = qty * rate;
  if ("amount" in row) return { ...row, amount };
  return row;
}

function validateExpiryDate(headerValues) {
  const expiry = headerValues.expirydate;
  const contract = headerValues.trandate;
  if (!expiry) return null;
  const expiryDay = String(expiry).slice(0, 10);
  const today = getTodayDateInputValue();
  if (expiryDay < today) return "Expiry Date cannot be earlier than today.";
  if (contract && expiryDay < String(contract).slice(0, 10)) {
    return "Expiry Date cannot be earlier than Contract Date.";
  }
  return null;
}

export default function PurchaseRateContractForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord = location.state?.record ?? null;
  const notify = useNotification();
  const navigate = useNavigate();

  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const itemGridRef = useRef(null);
  const termsGridRef = useRef(null);
  const itemGridSectionRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const termsColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const queuedTermsRowsRef = useRef([]);
  const editRecordLoadedRef = useRef(false);
  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();
  const { get: getLive } = useApi(API_BASE_URL);
  const { post: postSave } = useApi(API_BASE_URL_IMS);

  const {
    headerColumns,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    divisionOptions,
    supplierOptions,
    isLoadingSuppliers,
    fetchSupplierInfo,
    getSupplierCurrency,
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    termsColumns,
    allTermsColumns,
    fetchTermsDetailMeta,
    fetchTermsGridColumns,
    fetchEditRecord,
    seedOptionsFromMaster,
    fetchUnlockedHeaderDropdowns,
    fireCellEvent,
  } = usePurchaseRateContract(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [currencyExternalValues, setCurrencyExternalValues] = useState({
    currencyname: "",
    currencyrate: "",
  });

  const headerValuesRef = useRef({
    trancode: "",
    trandate: getTodayDateInputValue(),
    divisionid: 0,
    supplierid: 0,
    currencyid: 0,
    currencyname: "",
    currencyrate: 0,
    expirydate: "",
    remarks: "",
    configid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: recordId,
    funccode: PRC_CONFIG.RB_MASTER,
  });

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) {
      return {
        ...loadedFilterValues,
        ...currencyExternalValues,
      };
    }
    return {
      trandate: getTodayDateInputValue(),
      ...currencyExternalValues,
    };
  }, [loadedFilterValues, currencyExternalValues]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState("items");
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [termsSelectionCount, setTermsSelectionCount] = useState(0);
  const [isGridLoading, setIsGridLoading] = useState(false);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);

  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [termsModalItems, setTermsModalItems] = useState([]);
  const [termsModalColumns, setTermsModalColumns] = useState([]);
  const [termsModalLoading, setTermsModalLoading] = useState(false);
  const [termsModalError, setTermsModalError] = useState(null);

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
      ? "Fill in the header fields, then add contract items and terms."
      : recordLoading
        ? "Loading purchase rate contract…"
        : recordLoadError
          ? recordLoadError
          : `Contract #${recordId || routeId || "—"} — click Edit (Alt+A) to modify.`,
    showBack: true,
    backTo: PRC_CONFIG.ROUTE_PATH,
  });

  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
    fetchTermsDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta, fetchTermsDetailMeta, isEditRoute]);

  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(headerValuesRef.current?.divisionid ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns, fetchGridColumns, isEditRoute]);

  useEffect(() => {
    if (allTermsColumns.length === 0 || termsColumnsLoadedRef.current || isEditRoute) return;
    fetchTermsGridColumns(headerValuesRef.current?.divisionid ?? 0).then((cols) => {
      if (cols?.length > 0) termsColumnsLoadedRef.current = true;
    });
  }, [allTermsColumns, fetchTermsGridColumns, isEditRoute]);

  useEffect(() => {
    if (columns.length > 0 && itemGridRef.current && queuedRowsRef.current.length > 0) {
      if (itemGridRef.current.loadRows) itemGridRef.current.loadRows(queuedRowsRef.current);
      else queuedRowsRef.current.forEach((r) => itemGridRef.current.addRow(r));
      queuedRowsRef.current = [];
    }
  }, [columns]);

  useEffect(() => {
    if (termsColumns.length > 0 && termsGridRef.current && queuedTermsRowsRef.current.length > 0) {
      if (termsGridRef.current.loadRows) termsGridRef.current.loadRows(queuedTermsRowsRef.current);
      else queuedTermsRowsRef.current.forEach((r) => termsGridRef.current.addRow(r));
      queuedTermsRowsRef.current = [];
    }
  }, [termsColumns]);

  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const params = resolveEditLoadParams(recordId, listRecord, {
        idFields: ["contractid", "idnumber"],
      });
      const { master, headerValues, details, termsDetails } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("Purchase Rate Contract record not found.");

      headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;
      seedOptionsFromMaster(master);
      setCurrencyExternalValues({
        currencyname: String(headerValues.currencyname ?? ""),
        currencyrate: String(headerValues.currencyrate ?? ""),
      });
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      const activeCols = await fetchGridColumns(
        headerValues.divisionid ?? 0,
        editRecordGridColumnOpts(master)
      );
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;
      const syncedDetails = syncEditGridDropdownValues(details, activeCols || []);
      if (itemGridRef.current?.loadRows) itemGridRef.current.loadRows(syncedDetails);
      else queuedRowsRef.current = syncedDetails;

      const activeTermsCols = await fetchTermsGridColumns(
        headerValues.divisionid ?? 0,
        editRecordGridColumnOpts(master)
      );
      if (activeTermsCols?.length > 0) termsColumnsLoadedRef.current = true;
      const syncedTerms = syncEditGridDropdownValues(termsDetails, activeTermsCols || []);
      if (termsGridRef.current?.loadRows) termsGridRef.current.loadRows(syncedTerms);
      else queuedTermsRowsRef.current = syncedTerms;
    } catch (err) {
      console.error("[PRC] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load purchase rate contract.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, listRecord, fetchEditRecord, seedOptionsFromMaster, fetchGridColumns, fetchTermsGridColumns]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || allColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, allColumns.length, loadEditRecord]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode || !loadedMasterRow) return;
    const divisionId = headerValuesRef.current?.divisionid ?? loadedMasterRow?.divisionid ?? 0;
    fetchUnlockedHeaderDropdowns();
    fetchGridColumns(divisionId, {
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
    fetchTermsGridColumns,
  ]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  const DROPDOWN_OPTIONS_BY_COL = useMemo(
    () => ({
      divisionid: divisionOptions,
      supplierid: supplierOptions,
    }),
    [divisionOptions, supplierOptions]
  );

  const syncedFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];
    return headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible))
      .sort((a, b) => Number(a.colseqno) - Number(b.colseqno))
      .map((col) => {
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
      });
  }, [headerColumns, DROPDOWN_OPTIONS_BY_COL]);

  const filterFieldTones = useMemo(() => {
    const tones = {};
    syncedFilters.forEach((f) => {
      let tone = "editable";
      if (!isEditMode) tone = "view";
      else if (isEditRoute && f.lockOnEditMode) tone = "frozen";
      // Currency fields are autofilled from supplier — keep them frozen in edit mode.
      if (["currencyid", "currencyname", "currencyrate"].includes(f.FilterColName)) {
        tone = isEditMode ? "frozen" : "view";
      }
      tones[f.FilterColName] = tone;
      if (f.FilterParameterID) tones[f.FilterParameterID] = tone;
    });
    return tones;
  }, [syncedFilters, isEditMode, isEditRoute]);

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
        // MRD cascade: division change clears item grid + supplier/currency.
        headerValuesRef.current.supplierid = 0;
        headerValuesRef.current.currencyid = 0;
        headerValuesRef.current.currencyname = "";
        headerValuesRef.current.currencyrate = 0;
        setCurrencyExternalValues({ currencyname: "", currencyrate: "" });
        itemGridRef.current?.clearRows?.();
        return;
      }

      if (colName === "supplierid") {
        itemGridRef.current?.clearRows?.();
        if (val && val !== "0") {
          const cached = getSupplierCurrency(val);
          if (cached) {
            headerValuesRef.current.currencyid = cached.currencyid;
            headerValuesRef.current.currencyname = cached.currencyname;
            headerValuesRef.current.currencyrate = cached.currencyrate;
            setCurrencyExternalValues({
              currencyname: cached.currencyname,
              currencyrate: String(cached.currencyrate),
            });
          } else {
            const info = await fetchSupplierInfo(val);
            if (info) {
              headerValuesRef.current.currencyid = info.currencyid;
              headerValuesRef.current.currencyname = info.currencyname ?? "";
              headerValuesRef.current.currencyrate = info.currencyrate;
              setCurrencyExternalValues({
                currencyname: info.currencyname ?? "",
                currencyrate: String(info.currencyrate),
              });
            }
          }
        } else {
          headerValuesRef.current.currencyid = 0;
          headerValuesRef.current.currencyname = "";
          headerValuesRef.current.currencyrate = 0;
          setCurrencyExternalValues({ currencyname: "", currencyrate: "" });
        }
      }
    },
    [fetchSupplierInfo, getSupplierCurrency]
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

  const ensureTermsColumns = useCallback(async () => {
    if (termsColumnsLoadedRef.current && termsColumns.length > 0) return termsColumns;
    if (allTermsColumns.length === 0) return [];
    const activeCols = await fetchTermsGridColumns(headerValuesRef.current?.divisionid ?? 0);
    if (activeCols?.length > 0) termsColumnsLoadedRef.current = true;
    return activeCols;
  }, [termsColumns, allTermsColumns, fetchTermsGridColumns]);

  const handleCellEvent = useCallback(
    ({ rowId, colKey, rowData }) =>
      trackCellEvent(async () => {
        const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
        if (result && itemGridRef.current) {
          const responseRow = result?.[0];
          if (responseRow) {
            const errCode = responseRow.errcode;
            if (errCode === 1 || errCode === 1.0) {
              const { errcode, errmsg, ...updatedFields } = responseRow;
              itemGridRef.current.updateRow?.(rowId, updatedFields);
              return;
            }
          }
        }
        // Client-side Amount = Qty × Rate fallback (MRD §4).
        if (["qty", "rate", "tranqty", "tranrate"].includes(String(colKey).toLowerCase())) {
          const next = applyQtyRateAmount(rowData);
          if (next !== rowData) itemGridRef.current?.updateRow?.(rowId, next);
        }
      }),
    [fireCellEvent, trackCellEvent]
  );

  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValues, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    if (Object.keys(headerErrorMap).length > 0) {
      setFormErrors(["Please fix the highlighted field(s) below."]);
      return;
    }
    setFormErrors([]);

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PRC_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: PRC_CONFIG.RB_ITEM_PICKER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.rbid,
        prmLoginID: getUserSession().loginId,
      });
      setItemModalColumns(
        buildGridColumns(colRes || [], {}, { filterable: false, allEditable: false })
      );

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PRC_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([
          buildItemPickerJsonPayload(headerValues, getUserSession().loginId),
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setItemModalItems(rowRes || []);
    } catch (err) {
      console.error("[PRC] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, headerColumns]);

  const handleInsertItems = useCallback(
    async (selectedItems) => {
      if (!selectedItems?.length) return;
      setActiveTab("items");
      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) return;
      const dateColKeys = new Set(activeCols.filter(isDateColumnDef).map((col) => col.key));
      const rows = selectedItems.map((item) =>
        applyQtyRateAmount(mapPickerToItemRow(item, allColumns, dateColKeys))
      );
      rows.forEach((row) => addItemRow(row));
      await Promise.all(
        rows.map((row) => handleCellEvent({ rowId: row.id, colKey: "qty", rowData: row }))
      );
    },
    [ensureItemColumns, allColumns, addItemRow, handleCellEvent]
  );

  const handleSelectTerms = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    if (!headerValues.divisionid || headerValues.divisionid === "0") {
      setFormErrors(["Please select Division before selecting terms."]);
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
        ObjName: PRC_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: PRC_CONFIG.RB_TERMS_PICKER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load terms & conditions picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.rbid,
        prmLoginID: getUserSession().loginId,
      });
      setTermsModalColumns(
        buildGridColumns(colRes || [], {}, { filterable: false, allEditable: false })
      );

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PRC_CONFIG.SP_TERMS_PICKER,
        JSon: JSON.stringify([
          buildTermsPickerJsonPayload(headerValues, getUserSession().loginId),
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setTermsModalItems(rowRes || []);
    } catch (err) {
      console.error("[PRC] Terms picker fetch failed:", err);
      setTermsModalError(err?.message || "Failed to fetch terms & conditions.");
    } finally {
      setTermsModalLoading(false);
    }
  }, [getLive]);

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
          mapPickerRowToGridRow(item, allTermsColumns, { divisionid: divisionId })
        );
      });
    },
    [ensureTermsColumns, allTermsColumns]
  );

  const handleAddBlankRow = useCallback(async () => {
    if (activeTab === "terms") {
      const activeCols = await ensureTermsColumns();
      if (!activeCols?.length) return;
      const row = { id: nextTempId() };
      allTermsColumns.forEach(({ key, colDataType }) => {
        row[key] = getColDefault(colDataType);
      });
      termsGridRef.current?.addRow?.(row);
      return;
    }
    const activeCols = await ensureItemColumns();
    if (!activeCols?.length) return;
    const row = { id: nextTempId() };
    allColumns.forEach(({ key, colDataType }) => {
      row[key] = getColDefault(colDataType);
    });
    addItemRow(row);
  }, [activeTab, ensureTermsColumns, ensureItemColumns, allTermsColumns, allColumns, addItemRow]);

  const handleDeleteSelected = useCallback(() => {
    const ref = activeTab === "terms" ? termsGridRef : itemGridRef;
    if (!ref.current) return;
    const selected = ref.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    ref.current.removeRows?.(selected.map((r) => r.id));
  }, [activeTab]);

  const buildDefaultHeaderValues = useCallback(
    () => ({
      trancode: "",
      trandate: getTodayDateInputValue(),
      divisionid: 0,
      supplierid: 0,
      currencyid: 0,
      currencyname: "",
      currencyrate: 0,
      expirydate: "",
      remarks: "",
      configid: 0,
      companyid: getUserSession().companyId,
      yearid: getUserSession().yearId,
      loginid: getUserSession().loginId,
      idnumber: 0,
      funccode: PRC_CONFIG.RB_MASTER,
    }),
    []
  );

  const { resetFormToInitialState, discardChanges } = useTransactionFormReset({
    storageKeys: [
      PRC_CONFIG.STORAGE_HEADER_META,
      PRC_CONFIG.STORAGE_ENTRY_META,
      PRC_CONFIG.STORAGE_TERMS_META,
    ],
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
    extraClearFns: [
      () => {
        termsGridRef.current?.clearRows?.();
        queuedTermsRowsRef.current = [];
        termsColumnsLoadedRef.current = false;
        setTermsSelectionCount(0);
        setCurrencyExternalValues({ currencyname: "", currencyrate: "" });
        setFieldErrors({});
      },
    ],
  });

  const completeSuccessfulSave = useCallback(() => {
    if (isEditRoute) navigate(PRC_CONFIG.ROUTE_PATH);
    else resetFormToInitialState();
  }, [isEditRoute, navigate, resetFormToInitialState]);

  const handleSave = useCallback(async () => {
    await flushPendingCellEvents(itemGridSectionRef);
    setFormErrors([]);

    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValuesRef.current, headerColsToValidate);
    const expiryError = validateExpiryDate(headerValuesRef.current);
    if (expiryError) headerErrorMap.expirydate = expiryError;
    setFieldErrors(headerErrorMap);

    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    const detailErrors = validateGridRows(detailRows, columns, { requireAtLeastOne: true });
    const termsRows = termsGridRef.current?.getRows?.() ?? [];
    const termsErrors = validateGridRows(termsRows, termsColumns);

    const headerBannerMsg =
      Object.keys(headerErrorMap).length > 0 ? ["Please fix the highlighted field(s) below."] : [];
    const allErrors = [...headerBannerMsg, ...detailErrors, ...termsErrors];
    if (allErrors.length > 0) {
      setFormErrors(allErrors);
      return false;
    }

    const hv = headerValuesRef.current;
    const masterColumnDefs = headerColumns.map((col) => ({
      key: col.colname,
      colDataType: col.coldatatype,
    }));
    const mstRow = buildSaveRowFromColumns(hv, masterColumnDefs, {
      loginid: getUserSession().loginId,
    });

    const sessionFields = { loginid: getUserSession().loginId };
    const detRows = detailRows.map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, sessionFields)
    );
    const termsDetailRows = termsRows.map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allTermsColumns, sessionFields)
    );

    const payload = await withSaveContextFields(
      buildSaveJsonFields({
        label: "PRC",
        mst: mstRow,
        det: detRows,
        termsDet: termsDetailRows,
        termsDetKey: PRC_CONFIG.TERMS_SAVE_JSON_KEY,
      }),
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(PRC_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setFormErrors([message]);
        return false;
      }
      notify.success(message);
      completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[PRC Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    headerColumns,
    allColumns,
    allTermsColumns,
    columns,
    termsColumns,
    isEditRoute,
    postSave,
    notify,
    completeSuccessfulSave,
    flushPendingCellEvents,
  ]);

  const [discardOpen, setDiscardOpen] = useState(false);
  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    discardChanges();
  }, [discardChanges]);
  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = headerFetching || isLoadingSuppliers;

  useEntryFormKeyboard({
    blocked: itemModalOpen || termsModalOpen,
    isEditMode,
    isSaving,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onCancel: handleCancel,
    onSelectList: () => {
      if (activeTab === "terms") handleSelectTerms();
      else handleSelectItem();
    },
  });

  const extraButtons = useMemo(
    () => [
      {
        key: "save",
        label: isSaving ? "Saving…" : "Save",
        Icon: Save,
        variant: "save",
        onClick: handleSave,
        disabled: isSaving || isGridLoading,
        loading: isSaving,
        accessKey: "s",
        title: FORM_SHORTCUT_TITLES.save,
      },
    ],
    [handleSave, isSaving, isGridLoading]
  );

  const itemGridConfig = {
    columns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const termsGridConfig = {
    columns: termsColumns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const combinedError = metaError || headerError;
  const selectionCount = activeTab === "terms" ? termsSelectionCount : itemSelectionCount;

  return (
    <div className="workspace-page workspace-page--fill prc-page">
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
                fetchTermsDetailMeta();
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            panelRef={filterPanelRef}
            title="Purchase Rate Contract Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={PRC_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            isSearching={filterBusy || recordLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterBusy || !headerMetaReady}
            fieldTones={filterFieldTones}
            fieldErrors={fieldErrors}
            onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
          />
        )}
      </section>

      <section className="prc-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={PRC_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          headerControls={
            <>
              {activeTab === "items" && (
                <button
                  ref={selectItemBtnRef}
                  type="button"
                  className="eg-tab-btn"
                  onClick={handleSelectItem}
                  disabled={!isEditMode}
                  title="Pick contract items from list"
                >
                  <Package size={12} strokeWidth={2.5} />
                  Select Item
                </button>
              )}
              {activeTab === "terms" && (
                <button
                  type="button"
                  className="eg-tab-btn"
                  onClick={handleSelectTerms}
                  disabled={!isEditMode}
                  title="Pick terms & conditions"
                >
                  <FileText size={12} strokeWidth={2.5} />
                  Select Item
                </button>
              )}
              <button
                type="button"
                className="eg-tab-btn"
                onClick={handleAddBlankRow}
                disabled={!isEditMode}
                title="Add a blank row"
              >
                <Plus size={12} strokeWidth={2.5} />
                Add New
              </button>
              <button
                type="button"
                className="eg-tab-btn eg-tab-btn--danger"
                onClick={handleDeleteSelected}
                disabled={!isEditMode || selectionCount === 0}
                title="Delete selected rows"
              >
                <Trash2 size={12} strokeWidth={2} />
                Delete
              </button>
            </>
          }
          tabPanes={{
            terms: (
              <EntryGrid
                ref={termsGridRef}
                config={termsGridConfig}
                title=""
                hideBottomPanel
                readOnly={isEditRoute && !isEditMode}
                existingRecordEdit={isEditRoute && isEditMode}
                emptyMessage="No terms yet. Click Select Item or Add New above."
                onSelectionChange={setTermsSelectionCount}
              />
            ),
          }}
          hideBottomPanel
          emptyMessage="No items yet. Click Select Item or Add New above."
          onSelectionChange={setItemSelectionCount}
          onCellEvent={handleCellEvent}
          eventColumns={eventColumns}
          readOnly={isEditRoute && !isEditMode}
          existingRecordEdit={isEditRoute && isEditMode}
          remarkModalColumns={PRC_REMARK_COLUMNS}
          loading={isGridLoading || isFetching || recordLoading}
          loaderText={recordLoading ? "Loading contract…" : "Loading…"}
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
        extraButtons={extraButtons}
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

      <TermsPickerModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        items={termsModalItems}
        columns={termsModalColumns}
        isLoading={termsModalLoading}
        error={termsModalError}
        onInsert={handleInsertTerms}
      />
    </div>
  );
}
