import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import ItemPickerGroupFilterBar from "../../components/txn/ItemPickerGroupFilterBar";
import { useAstStktr } from "../../hooks/useAstStktr";
import { useItemPickerGroupFilter } from "../../hooks/useItemPickerGroupFilter";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
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
  AST_CONFIG,
  AST_MULTI_PASTE_COLUMNS,
  AST_REMARK_COLUMNS,
  AST_GRID_TABS,
  AST_FRM_TYPE_OPTIONS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  getMissingItemPickerHeaderFields,
  buildAstItemPickerJsonPayload,
  applyAstHardcodedHeaderValues,
  buildAstCascadeResets,
  validateAstBusinessRules,
} from "./constants";
import "./AssetsStockTransferPage.css";

let _astTempId = -1;
const nextTempId = () => _astTempId--;

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  const str = (v) => (v == null || v === "" ? "" : String(v));
  return {
    trancode: str(headerValues.trancode),
    trandate: headerValues.trandate ?? "",
    issuedate: headerValues.issuedate ?? "",
    fromdivisionid: str(headerValues.fromdivisionid),
    todivisionid: str(headerValues.todivisionid),
    fromlocationid: str(headerValues.fromlocationid),
    tolocationid: str(headerValues.tolocationid),
    configid: str(headerValues.configid),
    includestockitems: headerValues.includestockitems ?? 0,
    remarks: headerValues.remarks ?? "",
    frmtype: str(headerValues.frmtype ?? AST_CONFIG.FRM_TYPE),
    issuetypeid: str(headerValues.issuetypeid ?? AST_CONFIG.ISSUE_TYPE_ID),
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

export default function AssetsStockTransferForm() {
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
  const itemGridSectionRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);
  const { post: postSave } = useApi(API_BASE_URL_IMS);
  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    fromDivisionOptions, toDivisionOptions, fromLocationOptions, toLocationOptions,
    configOptions,
    fetchFromLocations, fetchToLocations, fetchConfigOptions,
    columns, allColumns, eventColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    clearSaveError,
  } = useAstStktr(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  // trandate/issuedate default to today on a new record; existing records keep their loaded date.
  const headerValuesRef = useRef(applyAstHardcodedHeaderValues({
    trancode: "",
    trandate: getTodayDateInputValue(),
    issuedate: getTodayDateInputValue(),
    fromdivisionid: 0,
    todivisionid: 0,
    fromlocationid: 0,
    tolocationid: 0,
    configid: 0,
    includestockitems: 0,
    remarks: "",
    frmtype: AST_CONFIG.FRM_TYPE,
    issuetypeid: AST_CONFIG.ISSUE_TYPE_ID,
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: recordId,
    funccode: AST_CONFIG.RB_MASTER,
  }));

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return {
      trandate: getTodayDateInputValue(),
      issuedate: getTodayDateInputValue(),
      frmtype: String(AST_CONFIG.FRM_TYPE),
      issuetypeid: String(AST_CONFIG.ISSUE_TYPE_ID),
      includestockitems: 0,
    };
  }, [loadedFilterValues]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState("items");
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);
  const groupFilter = useItemPickerGroupFilter({
    spMainGroup: AST_CONFIG.SP_ITEM_MAIN_GROUP,
    spSubMainGroup: AST_CONFIG.SP_ITEM_SUB_MAIN_GROUP,
    formTag: AST_CONFIG.FORM_TAG,
  });

  const [itemNameFilter, setItemNameFilter] = useState("");

  const [isEditMode, setIsEditMode] = useState(false);

  const cascadeResets = useMemo(() => buildAstCascadeResets(headerColumns), [headerColumns]);

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
      ? "Fill in the header fields, then add items via the grid."
      : recordLoading
        ? "Loading record…"
        : recordLoadError
          ? recordLoadError
          : `Stock Transfer #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: AST_CONFIG.ROUTE_PATH,
  });

  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta, isEditRoute]);

  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(headerValuesRef.current?.fromdivisionid ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns, fetchGridColumns, isEditRoute]);

  useEffect(() => {
    if (columns.length > 0 && itemGridRef.current && queuedRowsRef.current.length > 0) {
      if (itemGridRef.current.loadRows) itemGridRef.current.loadRows(queuedRowsRef.current);
      else queuedRowsRef.current.forEach((r) => itemGridRef.current.addRow(r));
      queuedRowsRef.current = [];
    }
  }, [columns]);

  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const params = resolveEditLoadParams(recordId, listRecord, {
        idFields: ["astissstktrid", "AstIssStktrID"],
      });
      const { master, headerValues, details } = await fetchEditRecord(params);
      if (!master || !headerValues) {
        throw new Error("Assets Stock Transfer record not found.");
      }

      headerValuesRef.current = applyAstHardcodedHeaderValues({
        ...headerValuesRef.current,
        ...headerValues,
      });
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      seedOptionsFromMaster(master);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      const divId = headerValues.fromdivisionid ?? 0;
      const activeCols = await fetchGridColumns(divId, editRecordGridColumnOpts(master));
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;

      const syncedDetails = syncEditGridDropdownValues(details, activeCols || []);
      if (itemGridRef.current?.loadRows) itemGridRef.current.loadRows(syncedDetails);
      else queuedRowsRef.current = syncedDetails;
    } catch (err) {
      console.error("[AST] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load Assets Stock Transfer record.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, listRecord, fetchEditRecord, seedOptionsFromMaster, fetchGridColumns]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || allColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, allColumns.length, loadEditRecord]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode || !loadedMasterRow) return;
    fetchUnlockedHeaderDropdowns(headerValuesRef.current);
    fetchGridColumns(headerValuesRef.current?.fromdivisionid ?? loadedMasterRow?.fromdivisionid ?? 0, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
  }, [isEditRoute, isEditMode, loadedMasterRow, fetchUnlockedHeaderDropdowns, fetchGridColumns]);

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

  const dropdownSources = useMemo(() => ({
    fromdivisionid: fromDivisionOptions,
    todivisionid: toDivisionOptions,
    fromlocationid: fromLocationOptions,
    tolocationid: toLocationOptions,
    configid: configOptions,
    frmtype: AST_FRM_TYPE_OPTIONS,
  }), [
    fromDivisionOptions,
    toDivisionOptions,
    fromLocationOptions,
    toLocationOptions,
    configOptions,
  ]);

  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => {
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
      tones[f.FilterColName] = tone;
      if (f.FilterParameterID) tones[f.FilterParameterID] = tone;
    });
    return tones;
  }, [syncedFilters, isEditMode, isEditRoute]);

  const [clearRowsOpen, setClearRowsOpen] = useState(false);
  const [clearRowsLabel, setClearRowsLabel] = useState("");
  const pendingClearActionRef = useRef(null);

  const requestGridClear = useCallback((fieldLabel, action) => {
    const rows = itemGridRef.current?.getRows?.() ?? [];
    if (rows.length === 0) {
      action();
      return;
    }
    pendingClearActionRef.current = action;
    setClearRowsLabel(fieldLabel);
    setClearRowsOpen(true);
  }, []);

  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = applyAstHardcodedHeaderValues({
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

    // MRD: FromDivisionID → clear From Location, Grid; reload options
    if (col === "fromdivisionid") {
      requestGridClear("From Division", async () => {
        hv.fromlocationid = 0;
        hv.configid = 0;
        itemGridRef.current?.clearRows?.();
        if (Number(val) > 0) {
          const fetches = [];
          if (hasVisibleCol(headerColumns, "fromlocationid")) fetches.push(fetchFromLocations(val));
          if (hasVisibleCol(headerColumns, "configid")) fetches.push(fetchConfigOptions(val));
          if (fetches.length) await Promise.all(fetches);
          if (hasVisibleCol(headerColumns, "fromlocationid")) {
            focusFieldAfterCascade(filterPanelRef, "fromlocationid");
          }
        }
      });
      return;
    }

    // MRD: ToDivisionID → clear To Location, Grid; reload options
    if (col === "todivisionid") {
      requestGridClear("To Division", async () => {
        hv.tolocationid = 0;
        itemGridRef.current?.clearRows?.();
        if (Number(val) > 0 && hasVisibleCol(headerColumns, "tolocationid")) {
          await fetchToLocations(val);
          focusFieldAfterCascade(filterPanelRef, "tolocationid");
        }
      });
      return;
    }

    // MRD: From Location → clear Grid
    if (col === "fromlocationid") {
      requestGridClear("From Location", async () => {
        itemGridRef.current?.clearRows?.();
      });
    }
  }, [
    requestGridClear,
    headerColumns,
    fetchConfigOptions,
    fetchFromLocations,
    fetchToLocations,
  ]);

  const ensureItemColumns = useCallback(async () => {
    if (gridColumnsLoadedRef.current && columns.length > 0) return columns;
    if (allColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const divId = headerValuesRef.current?.fromdivisionid ?? 0;
      const activeCols = await fetchGridColumns(divId);
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [columns, allColumns, fetchGridColumns]);

  const handleCellEvent = useCallback(({ rowId, colKey, rowData }) => {
    return trackCellEvent(async () => {
      const key = String(colKey).toLowerCase();
      if (key === "qty" || key === "rate") {
        const qty = Number(rowData.qty ?? rowData.Qty) || 0;
        const rate = Number(rowData.rate ?? rowData.Rate) || 0;
        const patch = { amount: qty * rate };
        if ("Amount" in rowData) patch.Amount = qty * rate;
        itemGridRef.current?.updateRow?.(rowId, patch);
      }
    });
  }, [trackCellEvent]);

  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues, headerColumns);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }

    const businessErrors = validateAstBusinessRules(headerValues);
    if (businessErrors.length > 0) {
      setFormErrors(businessErrors);
      return;
    }

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);
    setItemNameFilter("");
    groupFilter.resetFilter();

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: AST_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: AST_CONFIG.RB_ITEM_PICKER }]),
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

      const divisionId = headerValues.fromdivisionid;
      const configId = headerValues.configid;
      await groupFilter.fetchMainGroupOptions({ divisionId, configId });
      // Keep Sub Main Group active on first load — fetch with default magroupid=0.
      await groupFilter.fetchSubMainGroupOptions({
        divisionId,
        configId,
        mainGroupId: 0,
      });
    } catch (err) {
      console.error("[AST] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, headerColumns, groupFilter]);

  const handleApplyItemFilter = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const itemName = String(itemNameFilter ?? "").trim();
    setItemModalError(null);
    try {
      await groupFilter.applyFilter(
        async (groupParams) => {
          const hasMain = Boolean(groupFilter.mainGroupFilter);
          const hasSub = Boolean(groupFilter.subMainGroupFilter);
          const hasItemName = itemName.length >= 3;
          // Only the chosen filter(s) are sent; others go as defaults (0 / "").
          const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: OBJ_TYPE.FUNCTION,
            ObjName: AST_CONFIG.SP_ITEM_PICKER,
            JSon: JSON.stringify([{
              ...buildAstItemPickerJsonPayload(headerValues, {
                maGroupId: hasMain ? groupParams.prmmaingroupid : 0,
                subMaGroupId: hasSub ? groupParams.prmsubmaingroupid : 0,
                itemNameSearch: hasItemName ? itemName : "",
                qrJson: "",
              }),
            }]),
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
      console.error("[AST] Item filter fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    }
  }, [getLive, groupFilter, itemNameFilter]);

  const handleInsertItems = useCallback(async (selectedItems) => {
    if (!selectedItems?.length) return;
    setActiveTab("items");
    const activeCols = await ensureItemColumns();
    if (!activeCols?.length) return;
    selectedItems.forEach((item) => addItemRow(mapPickerToItemRow(item, allColumns)));
  }, [ensureItemColumns, allColumns, addItemRow]);

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "items") handleSelectItem();
  }, [activeTab, handleSelectItem]);

  const handleDeleteSelected = useCallback(() => {
    if (!itemGridRef.current) return;
    const selected = itemGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  const buildDefaultHeaderValues = useCallback(() => applyAstHardcodedHeaderValues({
    trancode: "",
    trandate: getTodayDateInputValue(),
    issuedate: getTodayDateInputValue(),
    fromdivisionid: 0,
    todivisionid: 0,
    fromlocationid: 0,
    tolocationid: 0,
    configid: 0,
    includestockitems: 0,
    remarks: "",
    frmtype: AST_CONFIG.FRM_TYPE,
    issuetypeid: AST_CONFIG.ISSUE_TYPE_ID,
    funccode: AST_CONFIG.RB_MASTER,
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: 0,
  }), []);

  const { resetFormToInitialState, discardChanges } = useTransactionFormReset({
    storageKeys: [AST_CONFIG.STORAGE_HEADER_META, AST_CONFIG.STORAGE_ENTRY_META],
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
    extraReset: () => setFieldErrors({}),
  });

  const handleSave = useCallback(async ({ skipPostSave = false } = {}) => {
    await flushPendingCellEvents(itemGridSectionRef);
    setFormErrors([]);
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValuesRef.current, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    const headerBannerMsg =
      Object.keys(headerErrorMap).length > 0 ? ["Please fix the highlighted field(s) below."] : [];
    const businessErrors = validateAstBusinessRules(headerValuesRef.current);
    const detailErrors = validateGridRows(itemGridRef.current?.getRows?.() ?? [], columns, { requireAtLeastOne: true });
    const allErrors = [...headerBannerMsg, ...businessErrors, ...detailErrors];
    if (allErrors.length > 0) {
      setFormErrors(allErrors);
      return false;
    }

    const mstRow = {};
    headerColumns.forEach((col) => {
      mstRow[col.colname] = getColDefault(col.coldatatype);
    });
    const hv = applyAstHardcodedHeaderValues(headerValuesRef.current);
    headerValuesRef.current = hv;
    Object.entries(hv).forEach(([k, v]) => {
      if (k !== "id") mstRow[k] = v;
    });
    mstRow.frmtype = AST_CONFIG.FRM_TYPE;
    mstRow.issuetypeid = AST_CONFIG.ISSUE_TYPE_ID;
    mstRow.loginid = getUserSession().loginId;

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) => {
      const row = {};
      allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
      return { ...row, ...rest, loginid: getUserSession().loginId };
    });

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: AST_CONFIG.FORM_TAG, mst: mstRow, det: detRows }),
      { divisionId: hv.fromdivisionid, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(AST_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setFormErrors([message]);
        return false;
      }
      notify.success(message);
      if (!skipPostSave) resetFormToInitialState();
      return true;
    } catch (err) {
      console.error("[AST Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [headerColumns, columns, allColumns, isEditRoute, notify, resetFormToInitialState, flushPendingCellEvents]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave({ skipPostSave: true });
    if (!saved) return;
    window.print();
    resetFormToInitialState();
  }, [handleSave, resetFormToInitialState]);

  const [discardOpen, setDiscardOpen] = useState(false);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    discardChanges();
  }, [discardChanges]);

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
  const combinedError = metaError || headerError;

  return (
    <div className="workspace-page workspace-page--fill ast-page">
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
        message={`Changing ${clearRowsLabel} will clear all item rows. Proceed?`}
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
            title="Assets Stock Transfer Detail"
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

      <section className="ast-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={AST_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          headerControls={
            <>
              <button
                ref={selectItemBtnRef}
                type="button"
                className="eg-tab-btn"
                onClick={handleSelectItem}
                disabled={!isEditMode}
                title="Pick transfer items"
              >
                <Package size={12} strokeWidth={2.5} />
                Select Item
              </button>

              <button
                type="button"
                className="eg-tab-btn eg-tab-btn--danger"
                onClick={handleDeleteSelected}
                disabled={!isEditMode || itemSelectionCount === 0}
                title="Delete selected rows"
              >
                <Trash2 size={12} strokeWidth={2} />
                Delete
              </button>
            </>
          }
          hideBottomPanel
          emptyMessage="No items yet. Click Select Item above."
          onSelectionChange={setItemSelectionCount}
          onCellEvent={handleCellEvent}
          eventColumns={eventColumns}
          readOnly={isEditRoute && !isEditMode}
          existingRecordEdit={isEditRoute && isEditMode}
          loading={isGridLoading || isFetching}
          multiValuePasteColumns={AST_MULTI_PASTE_COLUMNS}
          onMultiValuePaste={handleMultiValuePaste}
          remarkModalColumns={AST_REMARK_COLUMNS}
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
          isLoading={itemModalLoading || groupFilter.filterLoading}
          error={itemModalError}
          onInsert={handleInsertItems}
          filterBar={
            <ItemPickerGroupFilterBar
              mainGroupOptions={groupFilter.mainGroupOptions}
              subMainGroupOptions={groupFilter.subMainGroupOptions}
              mainGroupValue={groupFilter.mainGroupFilter}
              subMainGroupValue={groupFilter.subMainGroupFilter}
              onMainGroupChange={(value) => groupFilter.handleMainGroupChange(value, {
                divisionId: headerValuesRef.current.fromdivisionid,
                configId: headerValuesRef.current.configid,
                // Cleared Main Group → keep Sub Main loaded with default magroupid=0.
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
          }
          awaitingFilter={!groupFilter.filterApplied}
        />
      </Suspense>
    </div>
  );
}
