import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useLocation } from "react-router-dom";
import { AlertCircle, Plus, Trash2, Package, ClipboardList, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import { useMntNewContractGeneration } from "../../hooks/useMntNewContractGeneration";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
  getColDefault,
  OBJ_TYPE,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import {
  buildGridColumns,
  isLockOnEditModeCol,
  isTruthyApiFlag,
  hasVisibleCol,
  syncHeaderFilterWithApiCol,
  editRecordGridColumnOpts,
  syncEditGridDropdownValues,
} from "../../utils/gridUtils";
import { validateApiColumnsByField, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { focusFieldAfterCascade } from "../../utils/focusUtils";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { usePendingCellEventFlush } from "../../hooks/usePendingCellEventFlush";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  MACNG_CONFIG,
  MACNG_GRID_TABS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  getMissingItemPickerHeaderFields,
  getMissingTermsPickerHeaderFields,
  buildMacngItemPickerJsonPayload,
  buildMacngTermsPickerJsonPayload,
  applyMacngHardcodedHeaderValues,
  buildMacngCascadeResets,
  validateMacngBusinessRules,
} from "./constants";
import "./MaintenanceNewContractPage.css";

let _macngTempId = -1;
const nextTempId = () => _macngTempId--;

const QTY_RATE_EVENT_COLUMNS = new Set(["qty", "rate", "Qty", "Rate"]);

function resolveEditLoadParams(recordId, listRecord) {
  const session = getUserSession();
  return {
    companyId: listRecord?.companyid ?? listRecord?.CompanyID ?? session.companyId ?? DEFAULT_COMPANY_ID,
    yearId: listRecord?.yearid ?? listRecord?.YearID ?? session.yearId ?? MACNG_CONFIG.CONFIG_YEAR_ID,
    loginId: listRecord?.loginid ?? listRecord?.LoginID ?? session.loginId,
    sessionId: listRecord?.sessionid ?? listRecord?.SessionID ?? listRecord?.SessionId ?? DEFAULT_SESSION_ID,
    idNumber:
      listRecord?.mntamcnewmstid
      ?? listRecord?.MntAmcNewMstID
      ?? listRecord?.idnumber
      ?? listRecord?.IDNumber
      ?? recordId,
  };
}

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  const str = (v) => (v == null || v === "" ? "" : String(v));
  return {
    contractno: headerValues.contractno ?? "",
    contractdate: headerValues.contractdate ?? "",
    issuedate: headerValues.issuedate ?? "",
    divisionid: str(headerValues.divisionid),
    configtypeid: str(headerValues.configtypeid ?? headerValues.configid),
    configid: str(headerValues.configid ?? headerValues.configtypeid),
    contractfromdate: headerValues.contractfromdate ?? "",
    contracttodate: headerValues.contracttodate ?? "",
    supplierid: str(headerValues.supplierid),
    contracttypeid: str(headerValues.contracttypeid),
    frequencyid: str(headerValues.frequencyid),
    remarks: headerValues.remarks ?? "",
    companyid: str(headerValues.companyid),
    yearid: str(headerValues.yearid),
    loginid: str(headerValues.loginid),
    idnumber: str(headerValues.idnumber),
    funccode: headerValues.funccode ?? MACNG_CONFIG.RB_MASTER,
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

function buildGridRow(source, allGridColumns) {
  const row = { id: nextTempId() };
  allGridColumns.forEach(({ key, colDataType }) => {
    row[key] = getColDefault(colDataType);
  });
  Object.entries(source || {}).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (lk !== "id" && v != null && Object.prototype.hasOwnProperty.call(row, lk)) row[lk] = v;
  });
  return row;
}

function stripRowId(row) {
  const { id, ...rest } = row || {};
  return rest;
}

export default function MaintenanceNewContractForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord = location.state?.record ?? null;
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});

  const itemGridRef = useRef(null);
  const termsGridRef = useRef(null);
  const itemGridSectionRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const termsColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const queuedTermsRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);
  const { post: postSave } = useApi(API_BASE_URL_IMS);
  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, configOptions, supplierOptions, contractTypeOptions, frequencyOptions,
    fetchConfigOptions, fetchSuppliers,
    columns, allColumns, termsColumns, allTermsColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns, fetchTermsGridColumns,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    clearSaveError,
  } = useMntNewContractGeneration(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const headerValuesRef = useRef(applyMacngHardcodedHeaderValues({
    contractno: "",
    contractdate: todayISO,
    issuedate: todayISO,
    divisionid: 0,
    configtypeid: 0,
    configid: 0,
    contractfromdate: todayISO,
    contracttodate: todayISO,
    supplierid: 0,
    contracttypeid: 0,
    frequencyid: 0,
    remarks: "",
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: recordId,
    funccode: MACNG_CONFIG.RB_MASTER,
  }));

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return {
      contractdate: todayISO,
      issuedate: todayISO,
      contractfromdate: todayISO,
      contracttodate: todayISO,
    };
  }, [loadedFilterValues, todayISO]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState("items");
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [termsSelectionCount, setTermsSelectionCount] = useState(0);
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [pickerMode, setPickerMode] = useState("items");
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);

  const [isEditMode, setIsEditMode] = useState(false);

  const cascadeResets = useMemo(() => buildMacngCascadeResets(headerColumns), [headerColumns]);

  const activeSelectionCount = activeTab === "terms" ? termsSelectionCount : itemSelectionCount;

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
      ? "Fill in the header fields, then add contract items and terms via the grids."
      : recordLoading
        ? "Loading record…"
        : recordLoadError
          ? recordLoadError
          : `Maintenance Contract (New) #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: MACNG_CONFIG.ROUTE_PATH,
  });

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
      const params = resolveEditLoadParams(recordId, listRecord);
      const { master, headerValues, details, termsDetails } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("Maintenance Contract (New) record not found.");

      headerValuesRef.current = applyMacngHardcodedHeaderValues({
        ...headerValuesRef.current,
        ...headerValues,
      });
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      seedOptionsFromMaster(master);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      const divId = headerValues.divisionid ?? 0;
      const activeCols = await fetchGridColumns(divId, editRecordGridColumnOpts(master));
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;

      const syncedDetails = syncEditGridDropdownValues(details, activeCols || []);
      if (itemGridRef.current?.loadRows) itemGridRef.current.loadRows(syncedDetails);
      else queuedRowsRef.current = syncedDetails;

      const activeTermsCols = await fetchTermsGridColumns(divId, editRecordGridColumnOpts(master));
      if (activeTermsCols?.length > 0) termsColumnsLoadedRef.current = true;

      const syncedTerms = syncEditGridDropdownValues(termsDetails, activeTermsCols || []);
      if (termsGridRef.current?.loadRows) termsGridRef.current.loadRows(syncedTerms);
      else queuedTermsRowsRef.current = syncedTerms;
    } catch (err) {
      console.error("[MACNG] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load Maintenance Contract (New) record.");
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
    fetchUnlockedHeaderDropdowns(headerValuesRef.current);
    const divId = headerValuesRef.current?.divisionid ?? loadedMasterRow?.divisionid ?? 0;
    fetchGridColumns(divId, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
    fetchTermsGridColumns(divId, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
  }, [isEditRoute, isEditMode, loadedMasterRow, fetchUnlockedHeaderDropdowns, fetchGridColumns, fetchTermsGridColumns]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  const addTermsRow = useCallback((row) => {
    if (termsGridRef.current) termsGridRef.current.addRow(row);
    else queuedTermsRowsRef.current.push(row);
  }, []);

  const dropdownSources = useMemo(() => ({
    divisionid: divisionOptions,
    configtypeid: configOptions,
    configid: configOptions,
    supplierid: supplierOptions,
    contracttypeid: contractTypeOptions,
    frequencyid: frequencyOptions,
  }), [divisionOptions, configOptions, supplierOptions, contractTypeOptions, frequencyOptions]);

  const dropdownOptionsByCol = useMemo(() => {
    const map = { ...dropdownSources };
    headerColumns.forEach((col) => {
      const key = col.colname;
      if (!key) return;
      const opts = dropdownSources[String(key).toLowerCase()];
      if (opts) map[key] = opts;
    });
    return map;
  }, [headerColumns, dropdownSources]);

  const syncedFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];
    return headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible))
      .map((col) => {
        const lockOnEditMode = isLockOnEditModeCol(col);
        const staticOptions = dropdownOptionsByCol[col.colname];
        const base = {
          FilterParameterID: col.colname,
          FilterColName: col.colname,
          FilterCaption: col.displayname ?? col.colname,
          FilterColCtrlType: col.colctrltype ?? 0,
          ...(staticOptions ? { staticOptions } : {}),
        };
        return syncHeaderFilterWithApiCol(base, col, { lockOnEditMode });
      });
  }, [headerColumns, dropdownOptionsByCol]);

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

  const [clearRowsOpen, setClearRowsOpen] = useState(false);
  const [clearRowsLabel, setClearRowsLabel] = useState("");
  const pendingClearActionRef = useRef(null);

  const requestGridClear = useCallback((fieldLabel, action, { includeTerms = false } = {}) => {
    const itemRows = itemGridRef.current?.getRows?.() ?? [];
    const termsRows = includeTerms ? (termsGridRef.current?.getRows?.() ?? []) : [];
    if (itemRows.length === 0 && termsRows.length === 0) {
      action();
      return;
    }
    pendingClearActionRef.current = action;
    setClearRowsLabel(fieldLabel);
    setClearRowsOpen(true);
  }, []);

  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = applyMacngHardcodedHeaderValues({
      ...headerValuesRef.current,
      [colName]: val,
    });
    setFieldErrors((prev) => {
      if (!prev[colName]) return prev;
      const next = { ...prev };
      delete next[colName];
      return next;
    });
    const hv = headerValuesRef.current;
    const col = String(colName).toLowerCase();

    if (col === "configid" || col === "configtypeid") {
      hv.configtypeid = val;
      hv.configid = val;
    }

    if (col === "divisionid") {
      requestGridClear("Division", async () => {
        hv.configtypeid = 0;
        hv.configid = 0;
        hv.supplierid = 0;
        itemGridRef.current?.clearRows?.();
        setItemSelectionCount(0);
        if (Number(val) > 0) {
          const fetches = [];
          if (hasVisibleCol(headerColumns, "configtypeid") || hasVisibleCol(headerColumns, "configid")) {
            fetches.push(fetchConfigOptions(val));
          }
          if (hasVisibleCol(headerColumns, "supplierid")) {
            fetches.push(fetchSuppliers(val));
          }
          if (fetches.length) await Promise.all(fetches);
          if (hasVisibleCol(headerColumns, "configtypeid")) {
            focusFieldAfterCascade(filterPanelRef, "configtypeid");
          } else if (hasVisibleCol(headerColumns, "configid")) {
            focusFieldAfterCascade(filterPanelRef, "configid");
          } else if (hasVisibleCol(headerColumns, "supplierid")) {
            focusFieldAfterCascade(filterPanelRef, "supplierid");
          }
        }
      }, { includeTerms: false });
      return;
    }
  }, [
    requestGridClear,
    headerColumns,
    fetchConfigOptions,
    fetchSuppliers,
  ]);

  const ensureItemColumns = useCallback(async () => {
    if (gridColumnsLoadedRef.current && columns.length > 0) return columns;
    if (allColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const divId = headerValuesRef.current?.divisionid ?? 0;
      const activeCols = await fetchGridColumns(divId);
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [columns, allColumns, fetchGridColumns]);

  const ensureTermsColumns = useCallback(async () => {
    if (termsColumnsLoadedRef.current && termsColumns.length > 0) return termsColumns;
    if (allTermsColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const divId = headerValuesRef.current?.divisionid ?? 0;
      const activeCols = await fetchTermsGridColumns(divId);
      if (activeCols?.length > 0) termsColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [termsColumns, allTermsColumns, fetchTermsGridColumns]);

  const handleAddNewItem = useCallback(async () => {
    if (activeTab === "terms") {
      const activeCols = await ensureTermsColumns();
      if (!activeCols?.length) return;
      addTermsRow(buildGridRow({}, allTermsColumns));
      return;
    }
    const activeCols = await ensureItemColumns();
    if (!activeCols?.length) return;
    addItemRow(buildGridRow({}, allColumns));
  }, [activeTab, ensureItemColumns, ensureTermsColumns, addItemRow, addTermsRow, allColumns, allTermsColumns]);

  const openPickerModal = useCallback(() => {
    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);
  }, []);

  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues, headerColumns);
    if (missingFields.length > 0) {
      setFormErrors(missingFields.map((label) => `${label} is required before selecting items.`));
      return;
    }

    setPickerMode("items");
    openPickerModal();

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: MACNG_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: MACNG_CONFIG.RB_ITEM_PICKER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.rbid,
        prmLoginID: getUserSession().loginId,
      });
      const gridColumns = buildGridColumns(colRes || [], {}, {
        filterable: false,
        allEditable: false,
      });
      setItemModalColumns(gridColumns);

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: MACNG_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([buildMacngItemPickerJsonPayload(headerValues)]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setItemModalItems(rowRes || []);
    } catch (err) {
      console.error("[MACNG] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, openPickerModal, headerColumns]);

  const handleSelectTerms = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingTermsPickerHeaderFields(headerValues, headerColumns);
    if (missingFields.length > 0) {
      setFormErrors(missingFields.map((label) => `${label} is required before selecting terms.`));
      return;
    }

    setPickerMode("terms");
    openPickerModal();

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: MACNG_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: MACNG_CONFIG.RB_TERMS_PICKER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load terms & conditions picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.rbid,
        prmLoginID: getUserSession().loginId,
      });
      const gridColumns = buildGridColumns(colRes || [], {}, {
        filterable: false,
        allEditable: false,
      });
      setItemModalColumns(gridColumns);

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: MACNG_CONFIG.SP_TERMS_PICKER,
        JSon: JSON.stringify([
          buildMacngTermsPickerJsonPayload(headerValues, getUserSession().loginId),
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setItemModalItems(rowRes || []);
    } catch (err) {
      console.error("[MACNG] Terms picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch terms & conditions.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, openPickerModal, headerColumns]);

  const handleInsertPickerRows = useCallback(async (selectedItems) => {
    if (!selectedItems?.length) return;

    if (pickerMode === "terms") {
      setActiveTab("terms");
      const activeCols = await ensureTermsColumns();
      if (!activeCols?.length) return;
      selectedItems.forEach((item) => addTermsRow(buildGridRow(item, allTermsColumns)));
      return;
    }

    setActiveTab("items");
    const activeCols = await ensureItemColumns();
    if (!activeCols?.length) return;
    selectedItems.forEach((item) => addItemRow(buildGridRow(item, allColumns)));
  }, [
    pickerMode,
    ensureItemColumns,
    ensureTermsColumns,
    allColumns,
    allTermsColumns,
    addItemRow,
    addTermsRow,
  ]);

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "terms") handleSelectTerms();
    else handleSelectItem();
  }, [activeTab, handleSelectItem, handleSelectTerms]);

  const handleDeleteSelected = useCallback(() => {
    const gridRef = activeTab === "terms" ? termsGridRef : itemGridRef;
    if (!gridRef.current) return;
    const selected = gridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    gridRef.current.removeRows?.(selected.map((r) => r.id));
  }, [activeTab]);

  const handleCellEvent = useCallback(({ rowId, colKey, rowData, gridRef }) => {
    return trackCellEvent(async () => {
      const key = String(colKey).toLowerCase();
      if (key !== "qty" && key !== "rate") return;
      const qty = Number(rowData?.qty ?? rowData?.Qty) || 0;
      const rate = Number(rowData?.rate ?? rowData?.Rate) || 0;
      const amount = qty * rate;
      const patch = { amount };
      if ("Amount" in (rowData || {})) patch.Amount = amount;
      gridRef?.current?.updateRow?.(rowId, patch);
    });
  }, [trackCellEvent]);

  const handleSave = useCallback(async () => {
    await flushPendingCellEvents(itemGridSectionRef);

    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValuesRef.current, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    const headerBannerMsg =
      Object.keys(headerErrorMap).length > 0 ? ["Please fix the highlighted field(s) below."] : [];
    const businessErrors = validateMacngBusinessRules(headerValuesRef.current);
    const detailErrors = validateGridRows(itemGridRef.current?.getRows?.() ?? [], columns, { requireAtLeastOne: true });
    const termsErrors = validateGridRows(termsGridRef.current?.getRows?.() ?? [], termsColumns);
    const allErrors = [...headerBannerMsg, ...businessErrors, ...detailErrors, ...termsErrors];
    if (allErrors.length > 0) {
      setFormErrors(allErrors);
      return false;
    }

    const mstRow = {};
    headerColumns.forEach((col) => {
      mstRow[col.colname] = getColDefault(col.coldatatype);
    });
    const hv = applyMacngHardcodedHeaderValues(headerValuesRef.current);
    headerValuesRef.current = hv;
    Object.entries(hv).forEach(([k, v]) => {
      if (k !== "id") mstRow[k] = v;
    });
    mstRow.loginid = getUserSession().loginId;

    const itemRowsWithoutId = (itemGridRef.current?.getRows?.() ?? []).map((row) => {
      const rest = stripRowId(row);
      const seeded = {};
      allColumns.forEach(({ key, colDataType }) => { seeded[key] = getColDefault(colDataType); });
      return { ...seeded, ...rest, loginid: getUserSession().loginId };
    });

    const termsRowsWithoutId = (termsGridRef.current?.getRows?.() ?? []).map((row) => {
      const rest = stripRowId(row);
      const seeded = {};
      allTermsColumns.forEach(({ key, colDataType }) => { seeded[key] = getColDefault(colDataType); });
      return { ...seeded, ...rest, loginid: getUserSession().loginId };
    });

    const payload = await withSaveContextFields(
      {
        prmStrMstJSON: JSON.stringify([mstRow]),
        prmStrContractItemDetail: JSON.stringify(itemRowsWithoutId),
        prmTermsNConditionDetail: JSON.stringify(termsRowsWithoutId),
      },
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(MACNG_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setFormErrors([message]);
        return false;
      }
      notify.success(message);
      return true;
    } catch (err) {
      console.error("[MACNG Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    headerColumns,
    columns,
    termsColumns,
    allColumns,
    allTermsColumns,
    isEditRoute,
    notify,
    postSave,
    flushPendingCellEvents,
  ]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave();
    if (!saved) return;
    window.print();
  }, [handleSave]);

  const [discardOpen, setDiscardOpen] = useState(false);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    localStorage.removeItem(MACNG_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(MACNG_CONFIG.STORAGE_ENTRY_META);
    localStorage.removeItem(MACNG_CONFIG.STORAGE_TERMS_META);
    headerValuesRef.current = applyMacngHardcodedHeaderValues({
      contractno: "",
      contractdate: todayISO,
      issuedate: todayISO,
      divisionid: 0,
      configtypeid: 0,
      configid: 0,
      contractfromdate: todayISO,
      contracttodate: todayISO,
      supplierid: 0,
      contracttypeid: 0,
      frequencyid: 0,
      remarks: "",
      funccode: MACNG_CONFIG.RB_MASTER,
      companyid: getUserSession().companyId,
      yearid: getUserSession().yearId,
      loginid: getUserSession().loginId,
      idnumber: 0,
    });
    queuedRowsRef.current = [];
    queuedTermsRowsRef.current = [];
    gridColumnsLoadedRef.current = false;
    termsColumnsLoadedRef.current = false;
    clearSaveError();
    setActiveTab("items");
    setIsGridLoading(false);
    setItemSelectionCount(0);
    setTermsSelectionCount(0);
    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);
    setPickerMode("items");
    itemGridRef.current?.clearRows?.();
    termsGridRef.current?.clearRows?.();
    setFilterResetKey((k) => k + 1);
    exitEditMode();
    setFieldErrors({});
  }, [clearSaveError, exitEditMode, todayISO]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  const handleClearRowsConfirm = useCallback(() => {
    setClearRowsOpen(false);
    const fn = pendingClearActionRef.current;
    pendingClearActionRef.current = null;
    fn?.();
  }, []);

  const handleClearRowsCancel = useCallback(() => {
    setClearRowsOpen(false);
    pendingClearActionRef.current = null;
  }, []);

  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = headerFetching;

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
  });

  const extraButtons = useMemo(() => [
    {
      key: "saveprint", label: "Save & Print", Icon: Printer, variant: "print",
      onClick: handleSaveAndPrint, disabled: isSaving,
      title: FORM_SHORTCUT_TITLES.savePrint,
    },
    {
      key: "save", label: isSaving ? "Saving…" : "Save", Icon: Save, variant: "save",
      onClick: handleSave, disabled: isSaving, loading: isSaving,
      accessKey: "s", title: FORM_SHORTCUT_TITLES.save,
    },
  ], [handleSaveAndPrint, handleSave, isSaving]);

  const itemGridConfig = { columns, pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] } };
  const termsGridConfig = {
    columns: termsColumns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const combinedError = metaError || headerError;

  return (
    <div className="workspace-page workspace-page--fill macng-page">
      <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
      <ConfirmDialog
        isOpen={discardOpen}
        message="Discard changes and reset the form?"
        onConfirm={handleDiscardConfirm}
        onCancel={() => setDiscardOpen(false)}
      />
      <ConfirmDialog
        isOpen={clearRowsOpen}
        type="warning"
        message={`Changing ${clearRowsLabel} will clear related grid rows. Proceed?`}
        confirmLabel="Continue"
        cancelLabel="Cancel"
        onConfirm={handleClearRowsConfirm}
        onCancel={handleClearRowsCancel}
      />

      <section className="workspace-page__filters">
        {combinedError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{combinedError}</span>
            <button type="button" onClick={() => { fetchHeaderMeta(); fetchDetailMeta(); }}>Retry</button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            panelRef={filterPanelRef}
            title="Maintenance Contract (New) Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={cascadeResets}
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

      <section className="macng-grid-section" ref={itemGridSectionRef}>
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {MACNG_GRID_TABS.map((t) => (
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
            <button
              type="button"
              className="eg-tab-btn"
              onClick={handleAddNewItem}
              disabled={!isEditMode}
              title={activeTab === "terms" ? "Add a blank terms row" : "Add a blank contract item row"}
            >
              <Plus size={12} strokeWidth={2.5} />
              Add New
            </button>

            {activeTab === "items" ? (
              <button
                ref={selectItemBtnRef}
                type="button"
                className="eg-tab-btn"
                onClick={handleSelectItem}
                disabled={!isEditMode}
                title="Pick items for contract renewal"
              >
                <Package size={12} strokeWidth={2.5} />
                Select Item
              </button>
            ) : (
              <button
                type="button"
                className="eg-tab-btn"
                onClick={handleSelectTerms}
                disabled={!isEditMode}
                title="Pick terms & conditions"
              >
                <ClipboardList size={12} strokeWidth={2.5} />
                Select Item
              </button>
            )}

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

        <div className={`macng-tab-pane${activeTab === "items" ? " macng-tab-pane--active" : ""}`}>
          <EntryGrid
            ref={itemGridRef}
            config={itemGridConfig}
            title=""
            hideBottomPanel
            emptyMessage="No items yet. Click Add New or Select Item above."
            onSelectionChange={setItemSelectionCount}
            onCellEvent={(evt) => handleCellEvent({ ...evt, gridRef: itemGridRef })}
            eventColumns={QTY_RATE_EVENT_COLUMNS}
            readOnly={isEditRoute && !isEditMode}
            existingRecordEdit={isEditRoute && isEditMode}
            loading={isGridLoading || isFetching}
          />
        </div>

        <div className={`macng-tab-pane${activeTab === "terms" ? " macng-tab-pane--active" : ""}`}>
          <EntryGrid
            ref={termsGridRef}
            config={termsGridConfig}
            title=""
            hideBottomPanel
            emptyMessage="No terms & conditions yet. Click Add New or Select Item above."
            onSelectionChange={setTermsSelectionCount}
            onCellEvent={(evt) => handleCellEvent({ ...evt, gridRef: termsGridRef })}
            eventColumns={QTY_RATE_EVENT_COLUMNS}
            readOnly={isEditRoute && !isEditMode}
            existingRecordEdit={isEditRoute && isEditMode}
            loading={isGridLoading || isFetching}
          />
        </div>
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
          onInsert={handleInsertPickerRows}
        />
      </Suspense>
    </div>
  );
}
