// AssetsEmployeeTransferForm.jsx — Assets Employee Transfer entry form (Add / Edit)

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import { AlertCircle, ListPlus, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
import { useAstEmpTrf } from "../../hooks/useAstEmpTrf";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
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
import { dateToStoredValue, getTodayDateInputValue, isDateColumnDef } from "../../utils/dateFormat";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { useTransactionFormReset } from "../../hooks/useTransactionFormReset";
import { usePendingCellEventFlush } from "../../hooks/usePendingCellEventFlush";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  AET_CONFIG,
  AET_MULTI_PASTE_COLUMNS,
  AET_REMARK_COLUMNS,
  AET_GRID_TABS,
  AET_FRM_TYPE_OPTIONS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  buildAetItemPickerJsonPayload,
  applyAetHardcodedHeaderValues,
  buildAetCascadeResets,
} from "./constants";
import "./AssetsEmployeeTransferPage.css";

let _aetTempId = -1;
const nextTempId = () => _aetTempId--;

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
    fromdeptid: str(headerValues.fromdeptid),
    todeptid: str(headerValues.todeptid),
    fromempuserid: str(headerValues.fromempuserid),
    toempuserid: str(headerValues.toempuserid),
    fromworkingclientid: str(headerValues.fromworkingclientid),
    toworkingclientid: str(headerValues.toworkingclientid),
    fromvendorid: str(headerValues.fromvendorid),
    tovendorid: str(headerValues.tovendorid),
    configid: str(headerValues.configid),
    frmtype: str(headerValues.frmtype ?? AET_CONFIG.FRM_TYPE),
    issuetypeid: str(headerValues.issuetypeid ?? AET_CONFIG.ISSUE_TYPE_ID),
    expecteddays: headerValues.expecteddays ?? "",
    expecteddate: headerValues.expecteddate ?? "",
    includestockitems: headerValues.includestockitems ?? 0,
    totalprocessrate: headerValues.totalprocessrate ?? "",
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

export default function AssetsEmployeeTransferForm() {
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
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: rawGetLive } = useApi(API_BASE_URL);
  const getLive = useMemo(() => withGetRetry(rawGetLive), [rawGetLive]);
  const { post: postSave } = useApi(API_BASE_URL_IMS);
  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    fromDivisionOptions, toDivisionOptions,
    fromLocationOptions, toLocationOptions,
    fromDepartmentOptions, toDepartmentOptions,
    fromEmpOptions, toEmpOptions,
    fromVendorOptions, toVendorOptions,
    fromClientOptions, toClientOptions,
    configOptions,
    fetchFromLocations, fetchToLocations,
    fetchFromDepartments, fetchToDepartments,
    fetchFromVendors, fetchToVendors,
    fetchFromWorkingClients, fetchToWorkingClients,
    fetchConfigOptions,
    fetchFromEmployees, fetchToEmployees, clearFromEmpOptions, clearToEmpOptions,
    columns, allColumns, eventColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    clearSaveError,
  } = useAstEmpTrf(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  // trandate/issuedate default to today on a new record; existing records keep their loaded date.
  const headerValuesRef = useRef(applyAetHardcodedHeaderValues({
    trancode: "",
    trandate: getTodayDateInputValue(),
    issuedate: getTodayDateInputValue(),
    fromdivisionid: 0,
    todivisionid: 0,
    fromlocationid: 0,
    tolocationid: 0,
    fromdeptid: 0,
    todeptid: 0,
    fromempuserid: 0,
    toempuserid: 0,
    fromworkingclientid: 0,
    toworkingclientid: 0,
    fromvendorid: 0,
    tovendorid: 0,
    configid: 0,
    expecteddays: 0,
    expecteddate: getTodayDateInputValue(),
    includestockitems: 0,
    totalprocessrate: 0,
    frmtype: AET_CONFIG.FRM_TYPE,
    issuetypeid: AET_CONFIG.ISSUE_TYPE_ID,
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: recordId,
    funccode: AET_CONFIG.RB_MASTER,
  }));

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return {
      trandate: getTodayDateInputValue(),
      issuedate: getTodayDateInputValue(),
      expecteddate: getTodayDateInputValue(),
      frmtype: String(AET_CONFIG.FRM_TYPE),
      issuetypeid: String(AET_CONFIG.ISSUE_TYPE_ID),
    };
  }, [loadedFilterValues]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState("items");
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [gridRows, setGridRows] = useState([]);
  const handleItemGridRowsChange = useCallback((rows) => {
    setGridRows(rows);
    setDetailCellErrors((prev) => (
      prev && prev.size > 0 ? validateGridRowsDetailed(rows, columns).cellErrors : prev
    ));
  }, [columns]);
  const [isSaving, setIsSaving] = useState(false);
  const [isFillingDetail, setIsFillingDetail] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);

  const cascadeResets = useMemo(() => buildAetCascadeResets(headerColumns), [headerColumns]);

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
          : `Issue #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: AET_CONFIG.ROUTE_PATH,
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
      if (itemGridRef.current.loadRows) {
        itemGridRef.current.loadRows(queuedRowsRef.current);
      } else {
        queuedRowsRef.current.forEach((r) => itemGridRef.current.addRow(r));
      }
      queuedRowsRef.current = [];
    }
  }, [columns]);

  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const params = resolveEditLoadParams(recordId, listRecord, {
        idFields: ["astempissid"],
      });
      const { master, headerValues, details } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("Employee Location Transfer record not found.");

      headerValuesRef.current = applyAetHardcodedHeaderValues({
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

      if (itemGridRef.current?.loadRows) {
        itemGridRef.current.loadRows(syncedDetails);
      } else {
        queuedRowsRef.current = syncedDetails;
      }
    } catch (err) {
      console.error("[AET] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load Employee Location Transfer record.");
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
    fromdeptid: fromDepartmentOptions,
    todeptid: toDepartmentOptions,
    fromempuserid: fromEmpOptions,
    toempuserid: toEmpOptions,
    fromvendorid: fromVendorOptions,
    tovendorid: toVendorOptions,
    fromworkingclientid: fromClientOptions,
    toworkingclientid: toClientOptions,
    configid: configOptions,
    frmtype: AET_FRM_TYPE_OPTIONS,
  }), [
    fromDivisionOptions, toDivisionOptions,
    fromLocationOptions, toLocationOptions,
    fromDepartmentOptions, toDepartmentOptions,
    fromEmpOptions, toEmpOptions,
    fromVendorOptions, toVendorOptions,
    fromClientOptions, toClientOptions,
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

  const fetchToEmployeesIfVisible = useCallback(
    (hv) => {
      if (!hasVisibleCol(headerColumns, "toempuserid")) return Promise.resolve();
      const divId = hv.todivisionid ?? hv.fromdivisionid ?? 0;
      if (!divId || divId === "0" || Number(divId) === 0) return Promise.resolve();
      return fetchToEmployees(divId, hv.tolocationid, hv.todeptid);
    },
    [headerColumns, fetchToEmployees]
  );

  const handleFilterChange = useCallback(
    async (colName, val) => {
      headerValuesRef.current = applyAetHardcodedHeaderValues({
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
        requestGridClear("From Division", async () => {
          hv.fromlocationid = 0;
          hv.fromempuserid = 0;
          hv.fromvendorid = 0;
          hv.fromworkingclientid = 0;
          hv.todivisionid = val;
          hv.toempuserid = 0;
          clearFromEmpOptions();
          clearToEmpOptions();
          itemGridRef.current?.clearRows?.();
          if (val && val !== "0") {
            const fetches = [];
            if (hasVisibleCol(headerColumns, "fromlocationid")) {
              fetches.push(fetchFromLocations(val));
            }
            if (hasVisibleCol(headerColumns, "tolocationid")) {
              fetches.push(fetchToLocations(val));
            }
            if (hasVisibleCol(headerColumns, "fromdeptid")) {
              fetches.push(fetchFromDepartments());
            }
            if (hasVisibleCol(headerColumns, "todeptid")) {
              fetches.push(fetchToDepartments());
            }
            if (hasVisibleCol(headerColumns, "configid")) {
              fetches.push(fetchConfigOptions(val));
            }
            if (hasVisibleCol(headerColumns, "fromempuserid")) {
              fetches.push(fetchFromEmployees(val, hv.fromlocationid, hv.fromdeptid));
            }
            if (hasVisibleCol(headerColumns, "toempuserid")) {
              fetches.push(fetchToEmployeesIfVisible(hv));
            }
            if (hasVisibleCol(headerColumns, "fromvendorid")) {
              fetches.push(fetchFromVendors(val, hv.fromlocationid));
            }
            if (hasVisibleCol(headerColumns, "tovendorid")) {
              fetches.push(fetchToVendors(val, hv.tolocationid));
            }
            if (hasVisibleCol(headerColumns, "fromworkingclientid")) {
              fetches.push(fetchFromWorkingClients(val));
            }
            if (hasVisibleCol(headerColumns, "toworkingclientid")) {
              fetches.push(fetchToWorkingClients(val));
            }
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
          hv.fromempuserid = 0;
          hv.tolocationid = val;
          hv.toempuserid = 0;
          clearFromEmpOptions();
          clearToEmpOptions();
          itemGridRef.current?.clearRows?.();
          if (hasVisibleCol(headerColumns, "fromempuserid")) {
            await fetchFromEmployees(hv.fromdivisionid, val, hv.fromdeptid);
          }
          const vendorFetches = [];
          if (hasVisibleCol(headerColumns, "fromvendorid")) {
            vendorFetches.push(fetchFromVendors(hv.fromdivisionid, val));
          }
          if (hasVisibleCol(headerColumns, "tovendorid")) {
            vendorFetches.push(fetchToVendors(hv.todivisionid, val));
          }
          if (vendorFetches.length) await Promise.all(vendorFetches);
          await fetchToEmployeesIfVisible(hv);
        });
        return;
      }

      if (col === "fromdeptid") {
        requestGridClear("From Department", async () => {
          hv.fromempuserid = 0;
          clearFromEmpOptions();
          itemGridRef.current?.clearRows?.();
          if (hasVisibleCol(headerColumns, "fromempuserid")) {
            await fetchFromEmployees(hv.fromdivisionid, hv.fromlocationid, val);
          }
        });
        return;
      }

      if (col === "todivisionid") {
        requestGridClear("To Division", async () => {
          hv.tolocationid = 0;
          hv.toempuserid = 0;
          hv.tovendorid = 0;
          hv.toworkingclientid = 0;
          clearToEmpOptions();
          itemGridRef.current?.clearRows?.();
          if (val && val !== "0") {
            const fetches = [];
            if (hasVisibleCol(headerColumns, "tolocationid")) fetches.push(fetchToLocations(val));
            if (hasVisibleCol(headerColumns, "todeptid")) fetches.push(fetchToDepartments());
            if (hasVisibleCol(headerColumns, "tovendorid")) {
              fetches.push(fetchToVendors(val, hv.tolocationid));
            }
            if (hasVisibleCol(headerColumns, "toworkingclientid")) {
              fetches.push(fetchToWorkingClients(val));
            }
            if (fetches.length) await Promise.all(fetches);
            await fetchToEmployeesIfVisible(hv);
          }
        });
        return;
      }

      if (col === "tolocationid") {
        requestGridClear("To Location", async () => {
          hv.toempuserid = 0;
          hv.tovendorid = 0;
          clearToEmpOptions();
          itemGridRef.current?.clearRows?.();
          if (hasVisibleCol(headerColumns, "tovendorid")) {
            await fetchToVendors(hv.todivisionid, val);
          }
          await fetchToEmployeesIfVisible(hv);
        });
        return;
      }

      if (col === "todeptid") {
        requestGridClear("To Department", async () => {
          hv.toempuserid = 0;
          clearToEmpOptions();
          itemGridRef.current?.clearRows?.();
          await fetchToEmployeesIfVisible(hv);
        });
      }
    },
    [
      headerColumns,
      requestGridClear,
      clearFromEmpOptions,
      clearToEmpOptions,
      fetchFromLocations,
      fetchToLocations,
      fetchFromDepartments,
      fetchToDepartments,
      fetchFromVendors,
      fetchToVendors,
      fetchFromWorkingClients,
      fetchToWorkingClients,
      fetchConfigOptions,
      fetchFromEmployees,
      fetchToEmployeesIfVisible,
    ]
  );

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

  const handleFillDetail = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValues, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    if (Object.keys(headerErrorMap).length > 0) {
      setFormErrors(["Please fix the highlighted field(s) below."]);
      return;
    }

    setFormErrors([]);
    setActiveTab("items");
    setIsFillingDetail(true);
    setIsGridLoading(true);

    try {
      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) {
        notify.error("Item grid columns could not be loaded.");
        return;
      }

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: AET_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([buildAetItemPickerJsonPayload(headerValues)]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const items = Array.isArray(rowRes) ? rowRes : [];
      if (items.length === 0) {
        itemGridRef.current?.clearRows?.();
        notify.info("No items found for the selected header filters.");
        return;
      }

      const dateColKeys = new Set(activeCols.filter(isDateColumnDef).map((col) => col.key));
      itemGridRef.current?.clearRows?.();
      items.forEach((item) => addItemRow(mapPickerToItemRow(item, allColumns, dateColKeys)));
      notify.success(`${items.length} item${items.length === 1 ? "" : "s"} loaded into the grid.`);
    } catch (err) {
      console.error("[AET] Fill Detail failed:", err);
      notify.error(err?.message || "Failed to fill detail items.");
    } finally {
      setIsFillingDetail(false);
      setIsGridLoading(false);
    }
  }, [getLive, headerColumns, ensureItemColumns, allColumns, addItemRow, notify]);

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "items") handleFillDetail();
  }, [activeTab, handleFillDetail]);

  const buildDefaultHeaderValues = useCallback(() => applyAetHardcodedHeaderValues({
    trancode: "",
    trandate: getTodayDateInputValue(),
    issuedate: getTodayDateInputValue(),
    fromdivisionid: 0,
    todivisionid: 0,
    fromlocationid: 0,
    tolocationid: 0,
    fromdeptid: 0,
    todeptid: 0,
    fromempuserid: 0,
    toempuserid: 0,
    fromworkingclientid: 0,
    toworkingclientid: 0,
    fromvendorid: 0,
    tovendorid: 0,
    configid: 0,
    expecteddays: 0,
    expecteddate: getTodayDateInputValue(),
    includestockitems: 0,
    totalprocessrate: 0,
    frmtype: AET_CONFIG.FRM_TYPE,
    issuetypeid: AET_CONFIG.ISSUE_TYPE_ID,
    funccode: AET_CONFIG.RB_MASTER,
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: 0,
  }), []);

  const { resetFormToInitialState, discardChanges, completeSuccessfulSave } = useTransactionFormReset({
    storageKeys: [AET_CONFIG.STORAGE_HEADER_META, AET_CONFIG.STORAGE_ENTRY_META],
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
    setFilterResetKey,
    setLoadedFilterValues,
    setGridRows,
    extraClearFns: [clearFromEmpOptions, clearToEmpOptions],
    extraReset: () => { setFieldErrors({}); setDetailCellErrors(null); },
  });

  const handleSave = useCallback(async ({ skipPostSave = false } = {}) => {
    await flushPendingCellEvents(itemGridSectionRef);
    setFormErrors([]);
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValuesRef.current, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    const headerBannerMsg =
      Object.keys(headerErrorMap).length > 0 ? ["Please fix the highlighted field(s) below."] : [];
    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    const { errors: detailErrors, cellErrors: detailCellErrs } = validateGridRowsDetailed(detailRows, columns, { requireAtLeastOne: true });
    setDetailCellErrors(detailCellErrs);
    const allErrors = [...headerBannerMsg, ...(detailRows.length === 0 ? detailErrors : [])];
    if (Object.keys(headerErrorMap).length > 0 || detailCellErrs.size > 0 || detailRows.length === 0) {
      setFormErrors(allErrors);
      return false;
    }

    const hv = applyAetHardcodedHeaderValues(headerValuesRef.current);
    headerValuesRef.current = hv;
    const headerColDefs = headerColumns.map((col) => ({
      key: col.colname,
      colDataType: col.coldatatype,
    }));
    const mstRow = buildSaveRowFromColumns(hv, headerColDefs, {
      frmtype: AET_CONFIG.FRM_TYPE,
      issuetypeid: AET_CONFIG.ISSUE_TYPE_ID,
      loginid: getUserSession().loginId,
    });
    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, { loginid: getUserSession().loginId })
    );

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: AET_CONFIG.FORM_TAG, mst: mstRow, det: detRows }),
      { divisionId: hv.fromdivisionid, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(AET_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setFormErrors([message]);
        return false;
      }
      notify.success(message);
      if (!skipPostSave) completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[AEI Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [headerColumns, allColumns, columns, isEditRoute, notify, resetFormToInitialState, flushPendingCellEvents]);

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
    blocked: false,
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
    <div className="workspace-page workspace-page--fill aei-page">
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
            title="Employee Location Transfer Detail"
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

      <section className="aei-grid-section" ref={itemGridSectionRef}>
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {AET_GRID_TABS.map((t) => (
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
              ref={selectItemBtnRef}
              type="button"
              className="eg-tab-btn"
              onClick={handleFillDetail}
              disabled={!isEditMode || isFillingDetail}
              title="Fill detail items from header filters (Tab here after header fields)"
            >
              <ListPlus size={12} strokeWidth={2.5} />
              {isFillingDetail ? "Filling…" : "Fill Detail"}
            </button>
          </div>
        </div>

        <div className={`aei-tab-pane${activeTab === "items" ? " aei-tab-pane--active" : ""}`}>
          <EntryGrid
            ref={itemGridRef}
            config={itemGridConfig}
            title=""
            hideBottomPanel
            emptyMessage="No items yet. Click Fill Detail above."
            onRowsChange={handleItemGridRowsChange}
            cellErrors={detailCellErrors}
            onCellEvent={handleCellEvent}
            eventColumns={eventColumns}
            readOnly={isEditRoute && !isEditMode}
            existingRecordEdit={isEditRoute && isEditMode}
            loading={isGridLoading || isFetching || isFillingDetail}
            multiValuePasteColumns={AET_MULTI_PASTE_COLUMNS}
            onMultiValuePaste={handleMultiValuePaste}
            remarkModalColumns={AET_REMARK_COLUMNS}
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

    </div>
  );
}
