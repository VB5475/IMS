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
const DocumentLogModal = lazy(() => import("../../components/txn/DocumentLogModal"));
import { DOCUMENT_LOG_CONFIG as DOC_LOG_CFG } from "../../components/txn/documentLogConfig";
import ItemPickerGroupFilterBar from "../../components/txn/ItemPickerGroupFilterBar";
import { useAstRgo } from "../../hooks/useAstRgo";
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
import {
  buildGridColumns,
  isLockOnEditModeCol,
  isTruthyApiFlag,
  hasVisibleCol,
  syncHeaderFilterWithApiCol,
  editRecordGridColumnOpts,
  syncEditGridDropdownValues,
} from "../../utils/gridUtils";
import { validateApiColumnsByField, validateGridRowsDetailed } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { focusFieldAfterCascade } from "../../utils/focusUtils";
import { queryEditableFilterFields, resolveEditLoadParams } from "../../utils/txnFormUtils";
import { getTodayDateInputValue } from "../../utils/dateFormat";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { useTransactionFormReset } from "../../hooks/useTransactionFormReset";
import { usePendingCellEventFlush } from "../../hooks/usePendingCellEventFlush";
import { useAssetTxnItemScan } from "../../hooks/useAssetTxnItemScan";
import AssetTxnScanControls from "../../components/txn/AssetTxnScanControls";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  ARGO_CONFIG,
  ARGO_MULTI_PASTE_COLUMNS,
  ARGO_REMARK_COLUMNS,
  ARGO_GRID_TABS,
  ARGO_FRM_TYPE_OPTIONS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  buildArgoItemPickerJsonPayload,
  applyArgoHardcodedHeaderValues,
  buildArgoCascadeResets,
  validateArgoBusinessRules,
} from "./constants";
import "./AssetsReturnableGatePassOutPage.css";

let _argoTempId = -1;
const nextTempId = () => _argoTempId--;

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  const str = (v) => (v == null || v === "" ? "" : String(v));
  const intStr = (v) => (v == null || v === "" ? 0 : String(v));
  return {
    trancode: str(headerValues.trancode),
    trandate: headerValues.trandate ?? "",
    issuedate: headerValues.issuedate ?? "",
    fromdivisionid: str(headerValues.fromdivisionid),
    fromlocationid: str(headerValues.fromlocationid),
    tolocationid: intStr(headerValues.tolocationid),
    fromdeptid: str(headerValues.fromdeptid),
    tovendorid: str(headerValues.tovendorid),
    configid: str(headerValues.configid),
    includestockitems: headerValues.includestockitems ?? 0,
    remarks: headerValues.remarks ?? "",
    frmtype: str(headerValues.frmtype ?? ARGO_CONFIG.FRM_TYPE),
    issuetypeid: str(headerValues.issuetypeid ?? ARGO_CONFIG.ISSUE_TYPE_ID),
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

export default function AssetsReturnableGatePassOutForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
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

  const itemGridRef = useRef(null);
  const itemGridSectionRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const resetScanStateRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);
  const { post: postSave } = useApi(API_BASE_URL_IMS);
  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    fromDivisionOptions, fromLocationOptions, toLocationOptions,
    fromDepartmentOptions, toVendorOptions,
    configOptions,
    fetchFromLocations, fetchToLocations,
    fetchToVendors,
    fetchConfigOptions,
    columns, allColumns, eventColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    clearSaveError,
  } = useAstRgo(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  // trandate/issuedate default to today on a new record; existing records keep their loaded date.
  const headerValuesRef = useRef(applyArgoHardcodedHeaderValues({
    trancode: "",
    trandate: getTodayDateInputValue(),
    issuedate: getTodayDateInputValue(),
    fromdivisionid: 0,
    fromlocationid: 0,
    tolocationid: 0,
    fromdeptid: 0,
    tovendorid: 0,
    configid: 0,
    includestockitems: 0,
    remarks: "",
    frmtype: ARGO_CONFIG.FRM_TYPE,
    issuetypeid: ARGO_CONFIG.ISSUE_TYPE_ID,
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: recordId,
    funccode: ARGO_CONFIG.RB_MASTER,
  }));

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return {
      trandate: getTodayDateInputValue(),
      issuedate: getTodayDateInputValue(),
      frmtype: String(ARGO_CONFIG.FRM_TYPE),
      issuetypeid: String(ARGO_CONFIG.ISSUE_TYPE_ID),
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
    spMainGroup: ARGO_CONFIG.SP_ITEM_MAIN_GROUP,
    spSubMainGroup: ARGO_CONFIG.SP_ITEM_SUB_MAIN_GROUP,
    formTag: ARGO_CONFIG.FORM_TAG,
  });

  const [itemNameFilter, setItemNameFilter] = useState("");

  const [isEditMode, setIsEditMode] = useState(false);

  // Document Log modal (F6) — scoped to this record's id, gated on the
  // session's Document Log permission flags (set at login). Module-wise
  // department id (2026-08-14, /pm) — DM Department Master id=12 for this
  // module, no longer the shared ADMIN_REF_DEPARTMENT_ID — see
  // useDocumentLogAccess.js for the full permission-gate/GUID/button-
  // visibility/post-save-linking logic (shared, ported from Purchase Indent).
  const docLog = useDocumentLogAccess({
    tranTypeId: ARGO_CONFIG.DM_TRAN_TYPE_ID,
    refDepartmentId: DOC_LOG_CFG.REF_DEPARTMENT_ID.ASSETS_RETURNABLE_GATE_PASS_OUT,
    recordId,
    getDivisionId: () => headerValuesRef.current?.fromdivisionid,
    isEditMode,
    postSave,
    logLabel: "[ARGO]",
  });

  const cascadeResets = useMemo(() => buildArgoCascadeResets(headerColumns), [headerColumns]);

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
          : `Gate Pass Out #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: ARGO_CONFIG.ROUTE_PATH,
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
        idFields: ["astissrgoid", "AstIssRGOID"],
      });
      const { master, headerValues, details } = await fetchEditRecord(params);
      if (!master || !headerValues) {
        throw new Error("Assets Returnable Gate Pass Out record not found.");
      }

      headerValuesRef.current = applyArgoHardcodedHeaderValues({
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
      console.error("[ARGO] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load Assets Returnable Gate Pass Out record.");
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
    fromlocationid: fromLocationOptions,
    tolocationid: toLocationOptions,
    fromdeptid: fromDepartmentOptions,
    tovendorid: toVendorOptions,
    configid: configOptions,
    frmtype: ARGO_FRM_TYPE_OPTIONS,
  }), [
    fromDivisionOptions,
    fromLocationOptions,
    toLocationOptions,
    fromDepartmentOptions,
    toVendorOptions,
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
    headerValuesRef.current = applyArgoHardcodedHeaderValues({
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

    if (col === "fromdivisionid") {
      requestGridClear("Division", async () => {
        hv.fromlocationid = 0;
        hv.tolocationid = 0;
        hv.fromdeptid = 0;
        hv.tovendorid = 0;
        hv.configid = 0;
        itemGridRef.current?.clearRows?.();
        if (Number(val) > 0) {
          const fetches = [];
          if (hasVisibleCol(headerColumns, "fromlocationid")) fetches.push(fetchFromLocations(val));
          if (hasVisibleCol(headerColumns, "tolocationid")) fetches.push(fetchToLocations(val));
          if (hasVisibleCol(headerColumns, "configid")) fetches.push(fetchConfigOptions(val));
          if (hasVisibleCol(headerColumns, "tovendorid")) fetches.push(fetchToVendors(val));
          if (fetches.length) await Promise.all(fetches);
          if (hasVisibleCol(headerColumns, "fromlocationid")) {
            focusFieldAfterCascade(filterPanelRef, "fromlocationid");
          }
        }
      });
      return;
    }

    if (col === "fromlocationid") {
      requestGridClear("From Location", async () => {
        itemGridRef.current?.clearRows?.();
      });
      return;
    }

    if (col === "fromdeptid") {
      requestGridClear("From Department", async () => {
        itemGridRef.current?.clearRows?.();
      });
    }
  }, [
    requestGridClear,
    headerColumns,
    fetchConfigOptions,
    fetchFromLocations,
    fetchToLocations,
    fetchToVendors,
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

  const scan = useAssetTxnItemScan({
    logTag: "ARGO",
    spItemPicker: ARGO_CONFIG.SP_ITEM_PICKER,
    spRbMeta: ARGO_CONFIG.SP_RB_META,
    rbItemPickerCode: ARGO_CONFIG.RB_ITEM_PICKER,
    rbMetaParamKey: "prmrbcode",
    buildItemPickerJsonPayload: buildArgoItemPickerJsonPayload,
    headerColumns,
    headerValuesRef,
    allColumns,
    itemGridRef,
    ensureItemColumns,
    addItemRow,
    setActiveTab,
    isEditMode,
    getLive,
    notify,
    setFieldErrors,
    setFormErrors,
    mapPickerToItemRow,
    itemModalColumns,
    setItemModalOpen,
    setItemModalItems,
    setItemModalColumns,
    setItemModalError,
  });
  resetScanStateRef.current = scan.resetScanState;

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
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValues, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    if (Object.keys(headerErrorMap).length > 0) {
      setFormErrors(["Please fix the highlighted field(s) below."]);
      return;
    }
    setFormErrors([]);

    scan.onSelectItemOpen();
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
        ObjName: ARGO_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: ARGO_CONFIG.RB_ITEM_PICKER }]),
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
      console.error("[ARGO] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, headerColumns, groupFilter, scan.onSelectItemOpen]);

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
            ObjName: ARGO_CONFIG.SP_ITEM_PICKER,
            JSon: JSON.stringify([{
              ...buildArgoItemPickerJsonPayload(headerValues, {
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
      console.error("[ARGO] Item filter fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    }
  }, [getLive, groupFilter, itemNameFilter]);

  const handleInsertItems = useCallback(async (selectedItems) => {
    if (!selectedItems?.length) return;
    await scan.wrapInsertItems(selectedItems, async (items) => {
      setActiveTab("items");
      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) return;
      items.forEach((item) => addItemRow(mapPickerToItemRow(item, allColumns)));
    });
  }, [ensureItemColumns, allColumns, addItemRow, scan.wrapInsertItems]);

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "items") handleSelectItem();
  }, [activeTab, handleSelectItem]);

  const handleDeleteSelected = useCallback(() => {
    if (!itemGridRef.current) return;
    const selected = itemGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  const buildDefaultHeaderValues = useCallback(() => applyArgoHardcodedHeaderValues({
    trancode: "",
    trandate: getTodayDateInputValue(),
    issuedate: getTodayDateInputValue(),
    fromdivisionid: 0,
    fromlocationid: 0,
    tolocationid: 0,
    fromdeptid: 0,
    tovendorid: 0,
    configid: 0,
    includestockitems: 0,
    remarks: "",
    frmtype: ARGO_CONFIG.FRM_TYPE,
    issuetypeid: ARGO_CONFIG.ISSUE_TYPE_ID,
    funccode: ARGO_CONFIG.RB_MASTER,
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: 0,
  }), []);

  const { resetFormToInitialState, discardChanges, completeSuccessfulSave } = useTransactionFormReset({
    storageKeys: [ARGO_CONFIG.STORAGE_HEADER_META, ARGO_CONFIG.STORAGE_ENTRY_META],
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
    extraClearFns: [docLog.resetDocGuid],
    // Back to a blank new-entry state (post-save, or Cancel on a new record)
    // — re-issue a fresh GUID for whatever the user enters next, same as the
    // initial mount fetch. No-op on an edit route (isNewRoute is false there).
    extraReset: () => {
      if (isNewRoute) docLog.fetchDocGuid();
      resetScanStateRef.current?.();
      setFieldErrors({});
      setDetailCellErrors(null);
    },
  });

  const handleSave = useCallback(async ({ skipPostSave = false } = {}) => {
    await flushPendingCellEvents(itemGridSectionRef);
    setFormErrors([]);
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValuesRef.current, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    const headerBannerMsg =
      Object.keys(headerErrorMap).length > 0 ? ["Please fix the highlighted field(s) below."] : [];
    const businessErrors = validateArgoBusinessRules(headerValuesRef.current);
    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    const { errors: detailErrors, cellErrors: detailCellErrs } = validateGridRowsDetailed(detailRows, columns, { requireAtLeastOne: true });
    setDetailCellErrors(detailCellErrs);
    const allErrors = [...headerBannerMsg, ...businessErrors, ...(detailRows.length === 0 ? detailErrors : [])];
    if (Object.keys(headerErrorMap).length > 0 || businessErrors.length > 0 || detailCellErrs.size > 0 || detailRows.length === 0) {
      setFormErrors(allErrors);
      return false;
    }

    const hv = applyArgoHardcodedHeaderValues(headerValuesRef.current);
    headerValuesRef.current = hv;
    const headerColDefs = headerColumns.map((col) => ({
      key: col.colname,
      colDataType: col.coldatatype,
    }));
    const mstRow = buildSaveRowFromColumns(hv, headerColDefs, {
      frmtype: ARGO_CONFIG.FRM_TYPE,
      issuetypeid: ARGO_CONFIG.ISSUE_TYPE_ID,
      loginid: getUserSession().loginId,
    });

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, { loginid: getUserSession().loginId })
    );

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: ARGO_CONFIG.FORM_TAG, mst: mstRow, det: detRows }),
      { divisionId: hv.fromdivisionid, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(ARGO_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message, newId } = parseApiErrMsg(result);
      if (!success) {
        setFormErrors([message]);
        return false;
      }
      notify.success(message);
      // newId carries the real tranid from the save response's own message
      // (see extractSavedIdFromMessage in utils/apiResponse.js) — recordId is
      // only the real tranid on an EDIT save (Add is always 0, route hasn't
      // changed), but newId is the real tranid either way. Falls back to
      // recordId so an Edit save still works if the message wording changes.
      const savedTranId = newId ?? (isEditRoute ? recordId : null);
      // Saves any document rows staged in the Documents modal but never
      // explicitly submitted via ITS OWN Save button, then links any docs
      // staged under docGuid (before this transaction existed) to the
      // now-saved transaction — see useDocumentLogAccess.finalizeSave.
      // Best-effort: a failure here must never be treated as this form's own
      // save having failed — it already succeeded by this point.
      await docLog.finalizeSave(savedTranId);
      if (!skipPostSave) completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[ARGO Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [headerColumns, columns, allColumns, isEditRoute, recordId, notify, resetFormToInitialState, docLog.finalizeSave, flushPendingCellEvents]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave({ skipPostSave: true });
    if (!saved) return;
    window.print();
    completeSuccessfulSave();
  }, [handleSave, completeSuccessfulSave]);

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
    blocked: itemModalOpen || docLog.docModalOpen,
    isEditMode,
    isSaving,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onSavePrint: handleSaveAndPrint,
    onCancel: handleCancel,
    onSelectList: handleSelectListShortcut,
    onDocuments: docLog.handleOpenDocuments,
    onScanQr: scan.focusHeaderScanField,
  });

  const extraButtons = useMemo(() => [
    // Show/hide only, never a disabled state (matches Purchase Indent's
    // convention) — docLog.documentsButtonEntry already encodes this (null
    // when permission gates say no), spread in/out of the array so
    // ActionBar's own `showAlways || isEditMode` filter hides/shows it with
    // Add/Edit mode the same way every other extra button does.
    ...(docLog.documentsButtonEntry ? [docLog.documentsButtonEntry] : []),
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
  ], [docLog.documentsButtonEntry, handleSaveAndPrint, handleSave, isSaving]);

  const itemGridConfig = { columns, pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] } };
  const combinedError = metaError || headerError;

  return (
    <div className="workspace-page workspace-page--fill argo-page">
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
            title="Assets Returnable Gate Pass Out Detail"
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

      <section className="argo-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={ARGO_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          headerControls={
            <>
              <AssetTxnScanControls
                idPrefix="argo"
                isEditMode={isEditMode}
                scanQrLoading={scan.scanQrLoading}
                scanQrError={scan.scanQrError}
                headerScanValue={scan.headerScanValue}
                srSearchValue={scan.srSearchValue}
                lastQrItem={scan.lastQrItem}
                headerScanRef={scan.headerScanRef}
                srSearchRef={scan.srSearchRef}
                onHeaderScanChange={(e) => scan.setHeaderScanValue(e.target.value)}
                onSrSearchChange={(e) => {
                  scan.setSrSearchValue(e.target.value);
                  if (scan.scanQrError) scan.setScanQrError(null);
                }}
                onHeaderScanKeyDown={scan.handleHeaderScanKeyDown}
                onHeaderScanPaste={scan.handleHeaderScanPaste}
                onSrSearchKeyDown={scan.handleSrSearchKeyDown}
                onSrSearchPaste={scan.handleSrSearchPaste}
              />

              <button
                ref={selectItemBtnRef}
                type="button"
                className="eg-tab-btn"
                onClick={handleSelectItem}
                disabled={!isEditMode}
                title="Pick issue items"
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
          onRowsChange={scan.handleGridRowsChange}
          onCellEvent={handleCellEvent}
          eventColumns={eventColumns}
          readOnly={isEditRoute && !isEditMode}
          existingRecordEdit={isEditRoute && isEditMode}
          cellErrors={detailCellErrors}
          loading={isGridLoading || isFetching}
          multiValuePasteColumns={ARGO_MULTI_PASTE_COLUMNS}
          onMultiValuePaste={handleMultiValuePaste}
          remarkModalColumns={ARGO_REMARK_COLUMNS}
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
          onClose={scan.closeItemModal}
          items={itemModalItems}
          columns={itemModalColumns}
          isLoading={itemModalLoading || groupFilter.filterLoading}
          error={itemModalError}
          onInsert={handleInsertItems}
          filterBar={scan.itemModalScanMode ? null : (
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
          )}
          awaitingFilter={scan.itemModalScanMode ? false : !groupFilter.filterApplied}
          isRowDisabled={scan.itemModalScanMode ? scan.isScanPickerRowDisabled : null}
        />
      </Suspense>

      <Suspense fallback={null}>
        <DocumentLogModal
          ref={docLog.docModalRef}
          isOpen={docLog.docModalOpen}
          onClose={() => docLog.setDocModalOpen(false)}
          tranId={recordId}
          divisionId={headerValuesRef.current?.fromdivisionid}
          tranTypeId={ARGO_CONFIG.DM_TRAN_TYPE_ID}
          refDepartmentId={DOC_LOG_CFG.REF_DEPARTMENT_ID.ASSETS_RETURNABLE_GATE_PASS_OUT}
          guid={docLog.docGuid}
        />
      </Suspense>
    </div>
  );
}
