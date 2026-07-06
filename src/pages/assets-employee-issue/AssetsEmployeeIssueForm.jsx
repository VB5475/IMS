// AssetsEmployeeIssueForm.jsx — Assets Employee Issue entry form (Add / Edit)

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
import { useAstEmpIssue } from "../../hooks/useAstEmpIssue";
import { useApi } from "../../api/useApi";
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
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  AEI_CONFIG,
  AEI_GRID_TABS,
  AEI_FRM_TYPE_OPTIONS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  getMissingItemPickerHeaderFields,
  buildAeiItemPickerJsonPayload,
  applyAeiHardcodedHeaderValues,
  buildAeiCascadeResets,
} from "./constants";
import "./AssetsEmployeeIssuePage.css";

let _aeiTempId = -1;
const nextTempId = () => _aeiTempId--;

function resolveEditLoadParams(recordId, listRecord) {
  const session = getUserSession();
  return {
    companyId: listRecord?.companyid ?? listRecord?.CompanyID ?? session.companyId ?? DEFAULT_COMPANY_ID,
    yearId: listRecord?.yearid ?? listRecord?.YearID ?? session.yearId ?? AEI_CONFIG.CONFIG_YEAR_ID,
    loginId: listRecord?.loginid ?? listRecord?.LoginID ?? session.loginId,
    sessionId: listRecord?.sessionid ?? listRecord?.SessionID ?? listRecord?.SessionId ?? DEFAULT_SESSION_ID,
    idNumber: listRecord?.astempissid ?? listRecord?.idnumber ?? listRecord?.IDNumber ?? recordId,
  };
}

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

export default function AssetsEmployeeIssueForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord = location.state?.record ?? null;
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);

  const itemGridRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);

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

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const headerValuesRef = useRef(applyAeiHardcodedHeaderValues({
    trancode: "",
    trandate: todayISO,
    issuedate: todayISO,
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
    expecteddate: null,
    includestockitems: 0,
    totalprocessrate: 0,
    frmtype: AEI_CONFIG.FRM_TYPE,
    issuetypeid: AEI_CONFIG.ISSUE_TYPE_ID,
    tranmstgenid: 0,
    companyid: DEFAULT_COMPANY_ID,
    yearid: AEI_CONFIG.CONFIG_YEAR_ID,
    loginid: DEFAULT_LOGIN_ID,
    idnumber: recordId,
    funccode: AEI_CONFIG.RB_MASTER,
  }));

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return {
      trandate: todayISO,
      issuedate: todayISO,
      frmtype: String(AEI_CONFIG.FRM_TYPE),
      issuetypeid: String(AEI_CONFIG.ISSUE_TYPE_ID),
    };
  }, [loadedFilterValues, todayISO]);

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
    backTo: "/assets-employee-issue",
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
      const params = resolveEditLoadParams(recordId, listRecord);
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
              fetches.push(fetchFromLocations());
            }
            if (hasVisibleCol(headerColumns, "tolocationid")) {
              fetches.push(fetchToLocations());
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
              requestAnimationFrame(() =>
                filterPanelRef.current
                  ?.querySelector("#efq-fromlocationid .search-select__trigger")
                  ?.focus()
              );
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
            if (hasVisibleCol(headerColumns, "tolocationid")) fetches.push(fetchToLocations());
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
    const key = String(colKey).toLowerCase();
    if (key === "qty" || key === "rate") {
      const qty = Number(rowData.qty ?? rowData.Qty) || 0;
      const rate = Number(rowData.rate ?? rowData.Rate) || 0;
      const patch = { amount: qty * rate };
      if ("Amount" in rowData) patch.Amount = qty * rate;
      itemGridRef.current?.updateRow?.(rowId, patch);
    }
  }, []);

  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: AEI_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: AEI_CONFIG.RB_ITEM_PICKER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.rbid,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const gridColumns = buildGridColumns(colRes || [], {}, {
        filterable: false,
        allEditable: false,
      });
      setItemModalColumns(gridColumns);

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: AEI_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([buildAeiItemPickerJsonPayload(headerValues)]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setItemModalItems(rowRes || []);
    } catch (err) {
      console.error("[AEI] Item picker fetch failed:", err);
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
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrors = validateApiColumns(headerValuesRef.current, headerColsToValidate);
    const detailErrors = validateGridRows(itemGridRef.current?.getRows?.() ?? [], columns);
    const allErrors = [...headerErrors, ...detailErrors];
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
      loginid: DEFAULT_LOGIN_ID,
    });
    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, { loginid: DEFAULT_LOGIN_ID })
    );

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: AEI_CONFIG.FORM_TAG, mst: mstRow, det: detRows }),
      { divisionId: hv.fromdivisionid, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL_IMS}${AEI_CONFIG.SAVE_ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setFormErrors([message]);
        return false;
      }
      notify.success(message);
      return true;
    } catch (err) {
      console.error("[AEI Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [headerColumns, allColumns, columns, isEditRoute, notify]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave();
    if (!saved) return;
    window.print();
  }, [handleSave]);

  const [discardOpen, setDiscardOpen] = useState(false);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    localStorage.removeItem(AEI_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(AEI_CONFIG.STORAGE_ENTRY_META);
    clearFromEmpOptions();
    clearToEmpOptions();
    headerValuesRef.current = applyAeiHardcodedHeaderValues({
      trancode: "",
      trandate: todayISO,
      issuedate: todayISO,
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
      expecteddate: null,
      includestockitems: 0,
      totalprocessrate: 0,
      frmtype: AEI_CONFIG.FRM_TYPE,
      issuetypeid: AEI_CONFIG.ISSUE_TYPE_ID,
      funccode: AEI_CONFIG.RB_MASTER,
      tranmstgenid: 0,
      companyid: DEFAULT_COMPANY_ID,
      yearid: AEI_CONFIG.CONFIG_YEAR_ID,
      loginid: DEFAULT_LOGIN_ID,
      idnumber: 0,
    });
    queuedRowsRef.current = [];
    gridColumnsLoadedRef.current = false;
    clearSaveError();
    setActiveTab("items");
    setIsGridLoading(false);
    setGridRows([]);
    setItemSelectionCount(0);
    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);
    itemGridRef.current?.clearRows?.();
    setFilterResetKey((k) => k + 1);
    exitEditMode();
  }, [clearFromEmpOptions, clearSaveError, exitEditMode, todayISO]);

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
    <div className="workspace-page aei-page">
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
            onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
          />
        )}
      </section>

      <section className="aei-grid-section">
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {AEI_GRID_TABS.map((t) => (
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
              onClick={handleSelectItem}
              disabled={!isEditMode}
              title="Pick issue items (Tab here after header fields)"
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
          </div>
        </div>

        <div className={`aei-tab-pane${activeTab === "items" ? " aei-tab-pane--active" : ""}`}>
          <EntryGrid
            ref={itemGridRef}
            config={itemGridConfig}
            title=""
            hideBottomPanel
            emptyMessage="No items yet. Click Select Item above."
            onSelectionChange={setItemSelectionCount}
            onRowsChange={setGridRows}
            onCellEvent={handleCellEvent}
            eventColumns={eventColumns}
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
          onInsert={handleInsertItems}
        />
      </Suspense>
    </div>
  );
}
