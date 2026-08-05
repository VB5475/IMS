// AssetsEmployeeIssueForm.jsx — Assets Employee Issue entry form (Add / Edit)

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, Printer, Save, History, QrCode } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Modal from "../../components/ui/Modal";
import HardwareQrScanner from "../../components/txn/HardwareQrScanner";
import { useNotification } from "../../context/NotificationContext";
import { parseQrItemPayload } from "../../utils/qrScanJson";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import ItemPickerGroupFilterBar from "../../components/txn/ItemPickerGroupFilterBar";
import { useAstEmpIssue } from "../../hooks/useAstEmpIssue";
import { useItemPickerGroupFilter } from "../../hooks/useItemPickerGroupFilter";
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
  AEI_CONFIG,
  AEI_MULTI_PASTE_COLUMNS,
  AEI_REMARK_COLUMNS,
  AEI_GRID_TABS,
  AEI_FRM_TYPE_OPTIONS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  getMissingItemPickerHeaderFields,
  buildAeiItemPickerJsonPayload,
  normalizeAeiQrSearchJson,
  applyAeiHardcodedHeaderValues,
  buildAeiCascadeResets,
} from "./constants";
import "./AssetsEmployeeIssuePage.css";

let _aeiTempId = -1;
const nextTempId = () => _aeiTempId--;

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
    frmtype: str(headerValues.frmtype ?? AEI_CONFIG.FRM_TYPE),
    issuetypeid: str(headerValues.issuetypeid ?? AEI_CONFIG.ISSUE_TYPE_ID),
    expecteddays: headerValues.expecteddays ?? "",
    expecteddate: headerValues.expecteddate ?? "",
    includestockitems: headerValues.includestockitems ?? 0,
    totalprocessrate: headerValues.totalprocessrate ?? "",
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

function normQrKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

/** True if grid already has the same itemcode + assetsrno (or srno fallback). */
function gridHasScannedItem(rows, itemcode, srno) {
  const code = normQrKey(itemcode);
  const serial = normQrKey(srno);
  if (!code || !serial) return false;
  return (rows || []).some((row) => {
    const rowCode = normQrKey(row.itemcode ?? row.ItemCode);
    const rowSrno = normQrKey(
      row.assetsrno ?? row.Assetsrno ?? row.srno ?? row.SrNo
    );
    return rowCode === code && rowSrno === serial;
  });
}

export default function AssetsEmployeeIssueForm() {
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
  const headerScanRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);
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
  } = useAstEmpIssue(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  // trandate/issuedate default to today on a new record; existing records keep their loaded date.
  const headerValuesRef = useRef(applyAeiHardcodedHeaderValues({
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
    frmtype: AEI_CONFIG.FRM_TYPE,
    issuetypeid: AEI_CONFIG.ISSUE_TYPE_ID,
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: recordId,
    funccode: AEI_CONFIG.RB_MASTER,
  }));

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return {
      trandate: getTodayDateInputValue(),
      issuedate: getTodayDateInputValue(),
      expecteddate: getTodayDateInputValue(),
      frmtype: String(AEI_CONFIG.FRM_TYPE),
      issuetypeid: String(AEI_CONFIG.ISSUE_TYPE_ID),
    };
  }, [loadedFilterValues]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState("items");
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [gridRows, setGridRows] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);
  const [scanQrOpen, setScanQrOpen] = useState(false);
  const [scanQrLoading, setScanQrLoading] = useState(false);
  const [scanQrError, setScanQrError] = useState(null);
  const [lastQrItem, setLastQrItem] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [headerScanValue, setHeaderScanValue] = useState("");
  const scanHistoryIdRef = useRef(0);
  const groupFilter = useItemPickerGroupFilter({
    spMainGroup: AEI_CONFIG.SP_ITEM_MAIN_GROUP,
    spSubMainGroup: AEI_CONFIG.SP_ITEM_SUB_MAIN_GROUP,
    formTag: AEI_CONFIG.FORM_TAG,
  });

  const [isEditMode, setIsEditMode] = useState(false);

  const cascadeResets = useMemo(() => buildAeiCascadeResets(headerColumns), [headerColumns]);

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
    backTo: AEI_CONFIG.ROUTE_PATH,
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
      if (!master || !headerValues) throw new Error("Assets Employee Issue record not found.");

      headerValuesRef.current = applyAeiHardcodedHeaderValues({
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
      console.error("[AEI] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load Assets Employee Issue record.");
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
    frmtype: AEI_FRM_TYPE_OPTIONS,
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
      headerValuesRef.current = applyAeiHardcodedHeaderValues({
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

  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues, headerColumns);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);
    groupFilter.resetFilter();

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: AEI_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: AEI_CONFIG.RB_ITEM_PICKER }]),
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

      await groupFilter.fetchMainGroupOptions({
        divisionId: headerValues.fromdivisionid,
        configId: headerValues.configid,
      });
    } catch (err) {
      console.error("[AEI] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, headerColumns, groupFilter]);

  const handleApplyItemFilter = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    setItemModalError(null);
    try {
      await groupFilter.applyFilter(async (groupParams) => {
        const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: AEI_CONFIG.SP_ITEM_PICKER,
          JSon: JSON.stringify([{
            ...buildAeiItemPickerJsonPayload(headerValues),
            ...groupParams,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        setItemModalItems(rowRes || []);
      });
    } catch (err) {
      console.error("[AEI] Item filter fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    }
  }, [getLive, groupFilter]);

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

  const openScanHistory = useCallback(() => {
    setScanQrError(null);
    setScanQrOpen(true);
  }, []);

  const closeScanQr = useCallback(() => {
    if (scanQrLoading) return;
    setScanQrOpen(false);
    setScanQrError(null);
  }, [scanQrLoading]);

  const focusHeaderScanField = useCallback(() => {
    if (!isEditMode) return;
    setActiveTab("items");
    requestAnimationFrame(() => {
      headerScanRef.current?.focus();
      headerScanRef.current?.select?.();
    });
  }, [isEditMode]);

  const restoreHeaderScanFocus = useCallback(() => {
    // Deferred so it runs after loading unlocks the field / toast paint.
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!headerScanRef.current || headerScanRef.current.disabled) return;
        headerScanRef.current.focus();
      }, 0);
    });
  }, []);

  const handleScanQrSubmit = useCallback(async (rawText) => {
    console.log("[AEI QR] handleScanQrSubmit raw", rawText);
    const { searchText, error } = normalizeAeiQrSearchJson(rawText);
    console.log("[AEI QR] normalized", { searchText, error });
    if (error) {
      setScanQrError(scanQrOpen ? error : null);
      notify.toastError(error);
      restoreHeaderScanFocus();
      return;
    }

    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues, headerColumns);
    if (missingFields.length > 0) {
      setScanQrOpen(false);
      setFormErrors(missingFields);
      restoreHeaderScanFocus();
      return;
    }

    setScanQrError(null);

    let scannedMeta = {};
    try { scannedMeta = JSON.parse(searchText); } catch { /* keep empty */ }
    const existingRows = itemGridRef.current?.getRows?.() ?? [];
    if (gridHasScannedItem(existingRows, scannedMeta.itemcode, scannedMeta.srno)) {
      const msg = "Item is already added";
      setScanQrError(scanQrOpen ? msg : null);
      notify.toastError(msg);
      setHeaderScanValue("");
      restoreHeaderScanFocus();
      return;
    }

    setScanQrLoading(true);
    try {
      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) {
        notify.toastError("Item grid columns could not be loaded.");
        return;
      }

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: AEI_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([{
          ...buildAeiItemPickerJsonPayload(headerValues, {
            maGroupId: 0,
            subMaGroupId: 0,
            searchText,
          }),
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });

      const rows = rowRes || [];
      console.log("[AEI QR] picker response rows", rows.length, rows);
      if (rows.length === 0) {
        const msg = "No item found for this QR JSON.";
        setScanQrError(scanQrOpen ? msg : null);
        notify.toastError(msg);
        return;
      }

      const gridRowsNow = itemGridRef.current?.getRows?.() ?? [];
      const mappedRows = rows
        .map((item) => mapPickerToItemRow(item, allColumns))
        .filter((row) => !gridHasScannedItem(
          gridRowsNow,
          row.itemcode ?? row.ItemCode,
          row.assetsrno ?? row.Assetsrno ?? row.srno ?? row.SrNo
        ));

      if (mappedRows.length === 0) {
        const msg = "Item is already added";
        setScanQrError(scanQrOpen ? msg : null);
        notify.toastError(msg);
        setHeaderScanValue("");
        return;
      }

      setActiveTab("items");
      mappedRows.forEach((row) => addItemRow(row));

      const last = rows[rows.length - 1] || {};
      const itemName = String(
        last.itemname ?? last.ItemName ?? last.itemdesc ?? last.ItemDesc
        ?? last.description ?? last.Description ?? last.itemcode ?? last.ItemCode
        ?? scannedMeta.itemcode ?? "Item"
      ).trim();
      const qrItem = {
        id: ++scanHistoryIdRef.current,
        itemcode: String(
          last.itemcode ?? last.ItemCode ?? scannedMeta.itemcode ?? ""
        ).trim(),
        srno: String(
          last.assetsrno ?? last.Assetsrno ?? last.srno ?? last.SrNo ?? scannedMeta.srno ?? ""
        ).trim(),
        itemname: itemName,
        rowIds: mappedRows.map((r) => r.id),
      };
      setLastQrItem(qrItem);
      setScanHistory((prev) => [qrItem, ...prev]);
      setHeaderScanValue("");

      if (scanQrOpen) {
        setScanQrOpen(false);
        setScanQrError(null);
      }
      notify.toastSuccess(
        mappedRows.length === 1
          ? `Added: ${itemName}`
          : `Added ${mappedRows.length} items · ${itemName}`
      );
    } catch (err) {
      console.error("[AEI] Scan QR item fetch failed:", err);
      const msg = err?.message || "Failed to fetch item for QR JSON.";
      setScanQrError(scanQrOpen ? msg : null);
      notify.toastError(msg);
    } finally {
      setScanQrLoading(false);
      restoreHeaderScanFocus();
    }
  }, [
    scanQrOpen, headerColumns, ensureItemColumns, getLive,
    allColumns, addItemRow, notify, restoreHeaderScanFocus,
  ]);

  const commitHeaderScan = useCallback((raw) => {
    const value = String(raw ?? "").trim();
    console.log("[AEI QR] header scan commit", { value, length: value.length });
    if (!value) return;
    setHeaderScanValue("");
    const parsed = parseQrItemPayload(value);
    if (parsed) {
      handleScanQrSubmit(JSON.stringify(parsed));
      return;
    }
    handleScanQrSubmit(value);
  }, [handleScanQrSubmit]);

  const handleHeaderScanKeyDown = useCallback((e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    if (!isEditMode || scanQrLoading) return;
    commitHeaderScan(headerScanValue);
  }, [isEditMode, scanQrLoading, commitHeaderScan, headerScanValue]);

  const handleHeaderScanPaste = useCallback((e) => {
    if (!isEditMode || scanQrLoading) return;
    const text = e.clipboardData?.getData("text") ?? "";
    if (!String(text).trim()) return;
    e.preventDefault();
    commitHeaderScan(text);
  }, [isEditMode, scanQrLoading, commitHeaderScan]);

  const handleRemoveScanHistory = useCallback((entry) => {
    if (!entry) return;

    if (entry.rowIds?.length) {
      itemGridRef.current?.removeRows?.(entry.rowIds);
    } else {
      const code = String(entry.itemcode ?? "").trim().toLowerCase();
      const serial = String(entry.srno ?? "").trim().toLowerCase();
      const gridRows = itemGridRef.current?.getRows?.() ?? [];
      const matchIds = gridRows
        .filter((row) => {
          const rowCode = String(row.itemcode ?? row.ItemCode ?? "").trim().toLowerCase();
          const rowSrno = String(
            row.assetsrno ?? row.Assetsrno ?? row.srno ?? row.SrNo ?? ""
          ).trim().toLowerCase();
          return rowCode === code && rowSrno === serial;
        })
        .map((row) => row.id);
      if (matchIds.length) itemGridRef.current?.removeRows?.(matchIds);
    }

    setScanHistory((prev) => prev.filter((h) => h.id !== entry.id));
    setLastQrItem((current) => {
      if (!current || current.id !== entry.id) return current;
      const next = scanHistory.filter((h) => h.id !== entry.id);
      return next[0] ?? null;
    });
  }, [scanHistory]);

  const syncScanHistoryWithGridRows = useCallback((rows) => {
    const livingIds = new Set((rows || []).map((r) => r.id));

    setScanHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.filter((h) => {
        if (h.rowIds?.length) {
          return h.rowIds.some((id) => livingIds.has(id));
        }
        const code = String(h.itemcode ?? "").trim().toLowerCase();
        const serial = String(h.srno ?? "").trim().toLowerCase();
        if (!code && !serial) return false;
        return (rows || []).some((row) => {
          const rowCode = String(row.itemcode ?? row.ItemCode ?? "").trim().toLowerCase();
          const rowSrno = String(
            row.assetsrno ?? row.Assetsrno ?? row.srno ?? row.SrNo ?? ""
          ).trim().toLowerCase();
          return rowCode === code && rowSrno === serial;
        });
      });
      return next.length === prev.length ? prev : next;
    });

    setLastQrItem((current) => {
      if (!current) return current;
      if (current.rowIds?.length) {
        return current.rowIds.some((id) => livingIds.has(id)) ? current : null;
      }
      const code = String(current.itemcode ?? "").trim().toLowerCase();
      const serial = String(current.srno ?? "").trim().toLowerCase();
      const stillThere = (rows || []).some((row) => {
        const rowCode = String(row.itemcode ?? row.ItemCode ?? "").trim().toLowerCase();
        const rowSrno = String(
          row.assetsrno ?? row.Assetsrno ?? row.srno ?? row.SrNo ?? ""
        ).trim().toLowerCase();
        return rowCode === code && rowSrno === serial;
      });
      return stillThere ? current : null;
    });
  }, []);

  const handleGridRowsChange = useCallback((rows) => {
    setGridRows(rows);
    syncScanHistoryWithGridRows(rows);
  }, [syncScanHistoryWithGridRows]);

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "items") handleSelectItem();
  }, [activeTab, handleSelectItem]);

  const handleDeleteSelected = useCallback(() => {
    if (!itemGridRef.current) return;
    const selected = itemGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  const buildDefaultHeaderValues = useCallback(() => applyAeiHardcodedHeaderValues({
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
    frmtype: AEI_CONFIG.FRM_TYPE,
    issuetypeid: AEI_CONFIG.ISSUE_TYPE_ID,
    funccode: AEI_CONFIG.RB_MASTER,
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: 0,
  }), []);

  const { resetFormToInitialState, discardChanges } = useTransactionFormReset({
    storageKeys: [AEI_CONFIG.STORAGE_HEADER_META, AEI_CONFIG.STORAGE_ENTRY_META],
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
    extraClearFns: [clearFromEmpOptions, clearToEmpOptions],
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
    const detailErrors = validateGridRows(itemGridRef.current?.getRows?.() ?? [], columns, { requireAtLeastOne: true });
    const allErrors = [...headerBannerMsg, ...detailErrors];
    if (allErrors.length > 0) {
      setFormErrors(allErrors);
      return false;
    }

    const hv = applyAeiHardcodedHeaderValues(headerValuesRef.current);
    headerValuesRef.current = hv;
    const headerColDefs = headerColumns.map((col) => ({
      key: col.colname,
      colDataType: col.coldatatype,
    }));
    const mstRow = buildSaveRowFromColumns(hv, headerColDefs, {
      frmtype: AEI_CONFIG.FRM_TYPE,
      issuetypeid: AEI_CONFIG.ISSUE_TYPE_ID,
      loginid: getUserSession().loginId,
    });
    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, { loginid: getUserSession().loginId })
    );

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: AEI_CONFIG.FORM_TAG, mst: mstRow, det: detRows }),
      { divisionId: hv.fromdivisionid, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(AEI_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setFormErrors([message]);
        return false;
      }
      notify.success(message);
      if (!skipPostSave) resetFormToInitialState();
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
    blocked: itemModalOpen || scanQrOpen,
    isEditMode,
    isSaving,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onSavePrint: handleSaveAndPrint,
    onCancel: handleCancel,
    onSelectList: handleSelectListShortcut,
    onScanQr: focusHeaderScanField,
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
            title="Assets Employee Issue Detail"
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
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={AEI_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          headerControls={
            <>
              <label
                className={`aei-qr-search${!isEditMode ? " aei-qr-search--disabled" : ""}${scanQrLoading ? " aei-qr-search--busy" : ""}`}
                title={FORM_SHORTCUT_TITLES.scanQr}
              >
                <span className="aei-qr-search__icon" aria-hidden="true">
                  <QrCode size={16} strokeWidth={2.4} />
                </span>
                <input
                  id="aei-header-qr-scan"
                  ref={headerScanRef}
                  type="text"
                  className="aei-qr-search__input"
                  value={headerScanValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    console.log("[AEI QR] header scan onChange", { value, length: value.length });
                    setHeaderScanValue(value);
                  }}
                  onKeyDown={handleHeaderScanKeyDown}
                  onPaste={handleHeaderScanPaste}
                  placeholder={scanQrLoading ? "Fetching…" : "Scan QR code…"}
                  disabled={!isEditMode}
                  readOnly={scanQrLoading}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="Scan QR with hardware scanner"
                />
                <kbd className="aei-qr-search__kbd">Ctrl+Q</kbd>
              </label>

              {lastQrItem?.itemcode || lastQrItem?.srno ? (
                <span className="aei-last-qr" title="Last scanned item">
                  <span className="aei-last-qr__label">Last scan</span>
                  {lastQrItem.itemcode ? (
                    <span className="aei-last-qr__pair">
                      <span className="aei-last-qr__key">Item</span>
                      <strong>{lastQrItem.itemcode}</strong>
                    </span>
                  ) : null}
                  {lastQrItem.srno ? (
                    <span className="aei-last-qr__pair">
                      <span className="aei-last-qr__key">Sr No</span>
                      <strong>{lastQrItem.srno}</strong>
                    </span>
                  ) : null}
                </span>
              ) : null}

              <button
                ref={selectItemBtnRef}
                type="button"
                className="eg-tab-btn"
                onClick={handleSelectItem}
                disabled={!isEditMode}
                title="Pick issue items (Tab here after header fields)"
              >
                <Package size={12} strokeWidth={2.5} />
                Select Item
              </button>

              <button
                type="button"
                className="eg-tab-btn"
                onClick={openScanHistory}
                disabled={!isEditMode || scanQrLoading}
                title={FORM_SHORTCUT_TITLES.scanHistory}
              >
                <History size={12} strokeWidth={2.5} />
                Scan History
                {scanHistory.length > 0 ? (
                  <span className="aei-scan-history-count">{scanHistory.length}</span>
                ) : null}
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
          onRowsChange={handleGridRowsChange}
          onCellEvent={handleCellEvent}
          eventColumns={eventColumns}
          readOnly={isEditRoute && !isEditMode}
          existingRecordEdit={isEditRoute && isEditMode}
          loading={isGridLoading || isFetching}
          multiValuePasteColumns={AEI_MULTI_PASTE_COLUMNS}
          onMultiValuePaste={handleMultiValuePaste}
          remarkModalColumns={AEI_REMARK_COLUMNS}
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
              })}
              onSubMainGroupChange={groupFilter.setSubMainGroupFilter}
              onFilter={handleApplyItemFilter}
              filterLoading={groupFilter.filterLoading}
            />
          }
          awaitingFilter={!groupFilter.filterApplied}
        />
      </Suspense>

      <Modal
        isOpen={scanQrOpen}
        onClose={closeScanQr}
        title="Scan History"
        subtitle="Manual entry and scanned items"
        icon={<History size={16} strokeWidth={2.25} />}
        size="sm"
        variant="enterprise"
        dialogClassName="aei-scan-qr-modal"
        initialFocusSelector="#hw-qr-itemcode"
        footer={
          <div className="aei-scan-qr__footer">
            <button
              type="button"
              className="aei-scan-qr__btn aei-scan-qr__btn--cancel"
              onClick={closeScanQr}
              disabled={scanQrLoading}
            >
              Close
            </button>
          </div>
        }
      >
        <div className="aei-scan-qr">
          <HardwareQrScanner
            disabled={scanQrLoading}
            history={scanHistory}
            onRemoveHistory={handleRemoveScanHistory}
            onScan={handleScanQrSubmit}
            hint="Enter Item Code and Sr No manually. Hardware scanning uses the search box in the item grid header (Ctrl+Q)."
          />
          {(scanQrError || scanQrLoading) ? (
            <div className="aei-scan-qr__status">
              {scanQrError ? (
                <div className="aei-scan-qr__error" role="alert">
                  <AlertCircle size={14} strokeWidth={2} />
                  <span>{scanQrError}</span>
                </div>
              ) : null}
              {scanQrLoading ? (
                <div className="aei-scan-qr__loading" role="status">
                  Fetching item…
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
