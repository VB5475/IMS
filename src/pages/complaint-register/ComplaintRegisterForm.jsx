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
import { useMntComplaint } from "../../hooks/useMntComplaint";
import { useItemPickerGroupFilter } from "../../hooks/useItemPickerGroupFilter";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
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
import { getTodayDateInputValue } from "../../utils/dateFormat";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { focusFieldAfterCascade } from "../../utils/focusUtils";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { completeTransactionSave } from "../../hooks/useTransactionFormReset";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  MCR_CONFIG,
  MCR_GRID_TABS,
  MCR_FRM_TYPE_OPTIONS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  buildMcrItemPickerJsonPayload,
  applyMcrHardcodedHeaderValues,
  buildMcrCascadeResets,
  validateMcrBusinessRules,
} from "./constants";
import "./ComplaintRegisterPage.css";

let _mcrTempId = -1;
const nextTempId = () => _mcrTempId--;

function resolveEditLoadParams(recordId, listRecord) {
  const session = getUserSession();
  return {
    companyId: listRecord?.companyid ?? listRecord?.CompanyID ?? session.companyId ?? DEFAULT_COMPANY_ID,
    yearId: listRecord?.yearid ?? listRecord?.YearID ?? session.yearId ?? MCR_CONFIG.CONFIG_YEAR_ID,
    loginId: listRecord?.loginid ?? listRecord?.LoginID ?? session.loginId,
    sessionId: listRecord?.sessionid ?? listRecord?.SessionID ?? listRecord?.SessionId ?? DEFAULT_SESSION_ID,
    idNumber:
      listRecord?.mntcpnmstid
      ?? listRecord?.MntCpnMstID
      ?? listRecord?.idnumber
      ?? listRecord?.IDNumber
      ?? recordId,
  };
}

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  const str = (v) => (v == null || v === "" ? "" : String(v));
  return {
    trancode: str(headerValues.trancode),
    trandate: headerValues.trandate ?? "",
    divisionid: str(headerValues.divisionid),
    fromlocationid: str(headerValues.fromlocationid),
    fromdeptid: str(headerValues.fromdeptid),
    remarks: headerValues.remarks ?? "",
    configid: str(headerValues.configid),
    callgenbyuser: headerValues.callgenbyuser ?? "",
    frmtype: str(headerValues.frmtype ?? MCR_CONFIG.FRM_TYPE),
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

function buildGridRow(source, allColumns) {
  const row = { id: nextTempId() };
  allColumns.forEach(({ key, colDataType }) => {
    row[key] = getColDefault(colDataType);
  });
  Object.entries(source || {}).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (lk !== "id" && v != null && Object.prototype.hasOwnProperty.call(row, lk)) row[lk] = v;
  });
  return row;
}

export default function ComplaintRegisterForm() {
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
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: rawGetLive } = useApi(API_BASE_URL);
  const getLive = useMemo(() => withGetRetry(rawGetLive), [rawGetLive]);
  const { post: postSave } = useApi(API_BASE_URL_IMS);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, locationOptions, departmentOptions, configOptions,
    fetchLocations, fetchDepartments, fetchConfigOptions,
    columns, allColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    clearSaveError,
  } = useMntComplaint(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  const callGenByUser = useMemo(() => {
    const session = getUserSession();
    return String(session.userName || session.userId || "");
  }, []);

  const headerValuesRef = useRef(applyMcrHardcodedHeaderValues({
    trancode: "",
    trandate: getTodayDateInputValue(),
    divisionid: 0,
    fromlocationid: 0,
    fromdeptid: 0,
    remarks: "",
    configid: 0,
    callgenbyuser: callGenByUser,
    frmtype: MCR_CONFIG.FRM_TYPE,
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: recordId,
    funccode: MCR_CONFIG.RB_MASTER,
  }));

  // trandate defaults to today on a new record; existing records keep their loaded date.
  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return {
      trandate: getTodayDateInputValue(),
      callgenbyuser: callGenByUser,
      frmtype: String(MCR_CONFIG.FRM_TYPE),
    };
  }, [loadedFilterValues, callGenByUser]);

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
  const [itemNameFilter, setItemNameFilter] = useState("");
  const groupFilter = useItemPickerGroupFilter({
    spMainGroup: MCR_CONFIG.SP_ITEM_MAIN_GROUP,
    spSubMainGroup: MCR_CONFIG.SP_ITEM_SUB_MAIN_GROUP,
    formTag: MCR_CONFIG.FORM_TAG,
  });

  const [isEditMode, setIsEditMode] = useState(false);

  const cascadeResets = useMemo(() => buildMcrCascadeResets(headerColumns), [headerColumns]);

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
          : `Complaint #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: MCR_CONFIG.ROUTE_PATH,
    backLabel: "MCR",
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
      const params = resolveEditLoadParams(recordId, listRecord);
      const { master, headerValues, details } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("Complaint Register record not found.");

      headerValuesRef.current = applyMcrHardcodedHeaderValues({
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
    } catch (err) {
      console.error("[MCR] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load Complaint Register record.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, listRecord, fetchEditRecord, seedOptionsFromMaster, fetchGridColumns]);

  const resetNewEntry = useCallback(() => {
    localStorage.removeItem(MCR_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(MCR_CONFIG.STORAGE_ENTRY_META);
    headerValuesRef.current = applyMcrHardcodedHeaderValues({
      trancode: "",
      trandate: getTodayDateInputValue(),
      divisionid: 0,
      fromlocationid: 0,
      fromdeptid: 0,
      remarks: "",
      configid: 0,
      callgenbyuser: callGenByUser,
      frmtype: MCR_CONFIG.FRM_TYPE,
      funccode: MCR_CONFIG.RB_MASTER,
      tranmstgenid: 0,
      companyid: getUserSession().companyId,
      yearid: getUserSession().yearId,
      loginid: getUserSession().loginId,
      idnumber: 0,
    });
    queuedRowsRef.current = [];
    gridColumnsLoadedRef.current = false;
    clearSaveError();
    setActiveTab("items");
    setIsGridLoading(false);
    setItemSelectionCount(0);
    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);
    itemGridRef.current?.clearRows?.();
    setFilterResetKey((k) => k + 1);
    exitEditMode();
    setFieldErrors({});
    setDetailCellErrors(null);
  }, [callGenByUser, clearSaveError, exitEditMode]);

  const completeSuccessfulSave = useCallback(() => {
    completeTransactionSave({
      isEditRoute,
      loadEditRecord,
      exitEditMode,
      editRecordLoadedRef,
      resetNewEntry,
    });
  }, [isEditRoute, loadEditRecord, exitEditMode, resetNewEntry]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || allColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, allColumns.length, loadEditRecord]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode || !loadedMasterRow) return;
    fetchUnlockedHeaderDropdowns(headerValuesRef.current);
    fetchGridColumns(headerValuesRef.current?.divisionid ?? loadedMasterRow?.divisionid ?? 0, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
  }, [isEditRoute, isEditMode, loadedMasterRow, fetchUnlockedHeaderDropdowns, fetchGridColumns]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  const dropdownSources = useMemo(() => ({
    divisionid: divisionOptions,
    fromlocationid: locationOptions,
    fromdeptid: departmentOptions,
    configid: configOptions,
    frmtype: MCR_FRM_TYPE_OPTIONS,
  }), [divisionOptions, locationOptions, departmentOptions, configOptions]);

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
      .sort((a, b) => Number(a.colseqno) - Number(b.colseqno))
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
    headerValuesRef.current = applyMcrHardcodedHeaderValues({
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

    if (col === "divisionid") {
      requestGridClear("Division", async () => {
        hv.fromlocationid = 0;
        hv.fromdeptid = 0;
        hv.configid = 0;
        itemGridRef.current?.clearRows?.();
        if (Number(val) > 0) {
          const fetches = [];
          if (hasVisibleCol(headerColumns, "fromlocationid")) fetches.push(fetchLocations(val));
          if (hasVisibleCol(headerColumns, "fromdeptid")) fetches.push(fetchDepartments());
          if (hasVisibleCol(headerColumns, "configid")) fetches.push(fetchConfigOptions(val));
          if (fetches.length) await Promise.all(fetches);
          if (hasVisibleCol(headerColumns, "fromlocationid")) {
            focusFieldAfterCascade(filterPanelRef, "fromlocationid");
          }
        }
      });
      return;
    }

    if (col === "fromlocationid") {
      requestGridClear("Location", async () => {
        hv.configid = 0;
        itemGridRef.current?.clearRows?.();
        if (Number(hv.divisionid) > 0 && hasVisibleCol(headerColumns, "configid")) {
          await fetchConfigOptions(hv.divisionid);
        }
      });
    }
  }, [
    requestGridClear,
    headerColumns,
    fetchLocations,
    fetchDepartments,
    fetchConfigOptions,
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
    setItemNameFilter("");
    groupFilter.resetFilter();

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: MCR_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: MCR_CONFIG.RB_ITEM_PICKER }]),
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

      const divisionId = headerValues.divisionid;
      const configId = headerValues.configid;
      await groupFilter.fetchMainGroupOptions({ divisionId, configId });
      await groupFilter.fetchSubMainGroupOptions({
        divisionId,
        configId,
        mainGroupId: 0,
      });
    } catch (err) {
      console.error("[MCR] Item picker fetch failed:", err);
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
          const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: OBJ_TYPE.FUNCTION,
            ObjName: MCR_CONFIG.SP_ITEM_PICKER,
            JSon: JSON.stringify([{
              ...buildMcrItemPickerJsonPayload(headerValues, {
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
      console.error("[MCR] Item filter fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    }
  }, [getLive, groupFilter, itemNameFilter]);

  const handleInsertItems = useCallback(async (selectedItems) => {
    if (!selectedItems?.length) return;
    setActiveTab("items");
    const activeCols = await ensureItemColumns();
    if (!activeCols?.length) return;
    selectedItems.forEach((item) => addItemRow(buildGridRow(item, allColumns)));
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

  const handleSave = useCallback(async () => {
    setFormErrors([]);
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValuesRef.current, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    const headerBannerMsg =
      Object.keys(headerErrorMap).length > 0 ? ["Please fix the highlighted field(s) below."] : [];
    const businessErrors = validateMcrBusinessRules(headerValuesRef.current);
    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    const { errors: detailErrors, cellErrors: detailCellErrs } = validateGridRowsDetailed(detailRows, columns, { requireAtLeastOne: true });
    setDetailCellErrors(detailCellErrs);
    const allErrors = [...headerBannerMsg, ...businessErrors, ...(detailRows.length === 0 ? detailErrors : [])];
    if (Object.keys(headerErrorMap).length > 0 || businessErrors.length > 0 || detailCellErrs.size > 0 || detailRows.length === 0) {
      setFormErrors(allErrors);
      return false;
    }

    const hv = applyMcrHardcodedHeaderValues(headerValuesRef.current);
    headerValuesRef.current = hv;
    const headerColDefs = headerColumns.map((col) => ({
      key: col.colname,
      colDataType: col.coldatatype,
    }));
    const mstRow = buildSaveRowFromColumns(hv, headerColDefs, {
      frmtype: MCR_CONFIG.FRM_TYPE,
      loginid: getUserSession().loginId,
    });

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, { loginid: getUserSession().loginId })
    );

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: MCR_CONFIG.FORM_TAG, mst: mstRow, det: detRows }),
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(MCR_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setFormErrors([message]);
        return false;
      }
      notify.success(message);
      completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[MCR Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [headerColumns, columns, allColumns, isEditRoute, notify, postSave, completeSuccessfulSave]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave();
    if (!saved) return;
    window.print();
  }, [handleSave]);

  const [discardOpen, setDiscardOpen] = useState(false);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    completeSuccessfulSave();
  }, [completeSuccessfulSave]);

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
    <div className="workspace-page workspace-page--fill mcr-page">
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
            title="Complaint Register Detail"
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

      <section className="mcr-grid-section">
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={MCR_GRID_TABS}
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
                title="Pick items for complaint register"
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
          readOnly={isEditRoute && !isEditMode}
          existingRecordEdit={isEditRoute && isEditMode}
          cellErrors={detailCellErrors}
          loading={isGridLoading || isFetching}
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
          }
          awaitingFilter={!groupFilter.filterApplied}
        />
      </Suspense>
    </div>
  );
}
