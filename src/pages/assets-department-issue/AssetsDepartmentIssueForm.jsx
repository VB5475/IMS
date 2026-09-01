import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, Printer, Save, Search, QrCode } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
import { parseQrItemPayload } from "../../utils/qrScanJson";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import ItemPickerGroupFilterBar from "../../components/txn/ItemPickerGroupFilterBar";
import { useAstDepIssue } from "../../hooks/useAstDepIssue";
import { useItemPickerGroupFilter } from "../../hooks/useItemPickerGroupFilter";
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
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  ADI_CONFIG,
  ADI_MULTI_PASTE_COLUMNS,
  ADI_REMARK_COLUMNS,
  ADI_GRID_TABS,
  ADI_FRM_TYPE_OPTIONS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  buildAdiItemPickerJsonPayload,
  applyAdiHardcodedHeaderValues,
  buildAdiCascadeResets,
  validateAdiBusinessRules,
  normalizeAdiQrSearchJson,
} from "./constants";
import "./AssetsDepartmentIssuePage.css";

let _adiTempId = -1;
const nextTempId = () => _adiTempId--;

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  const str = (v) => (v == null || v === "" ? "" : String(v));
  return {
    trancode: str(headerValues.trancode),
    trandate: headerValues.trandate ?? "",
    issuedate: headerValues.issuedate ?? "",
    fromdivisionid: str(headerValues.fromdivisionid),
    fromlocationid: str(headerValues.fromlocationid),
    tolocationid: str(headerValues.tolocationid),
    fromdeptid: str(headerValues.fromdeptid),
    todeptid: str(headerValues.todeptid),
    configid: str(headerValues.configid),
    expecteddays: headerValues.expecteddays ?? "",
    expecteddate: headerValues.expecteddate ?? "",
    includestockitems: headerValues.includestockitems ?? 0,
    remarks: headerValues.remarks ?? "",
    frmtype: str(headerValues.frmtype ?? ADI_CONFIG.FRM_TYPE),
    issuetypeid: str(headerValues.issuetypeid ?? ADI_CONFIG.ISSUE_TYPE_ID),
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

export default function AssetsDepartmentIssueForm() {
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
  const headerScanRef = useRef(null);
  const srSearchRef = useRef(null);
  const pendingScanSrNoRef = useRef("");
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: rawGetLive } = useApi(API_BASE_URL);
  const getLive = useMemo(() => withGetRetry(rawGetLive), [rawGetLive]);
  const { post: postSave } = useApi(API_BASE_URL_IMS);
  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    fromDivisionOptions, fromLocationOptions, toLocationOptions,
    fromDepartmentOptions, toDepartmentOptions,
    configOptions,
    fetchFromLocations, fetchToLocations,
    fetchFromDepartments, fetchToDepartments,
    fetchConfigOptions,
    columns, allColumns, eventColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    clearSaveError,
  } = useAstDepIssue(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  // trandate/issuedate default to today on a new record; existing records keep their loaded date.
  const headerValuesRef = useRef(applyAdiHardcodedHeaderValues({
    trancode: "",
    trandate: getTodayDateInputValue(),
    issuedate: getTodayDateInputValue(),
    fromdivisionid: 0,
    fromlocationid: 0,
    tolocationid: 0,
    fromdeptid: 0,
    todeptid: 0,
    configid: 0,
    expecteddays: 0,
    expecteddate: getTodayDateInputValue(),
    includestockitems: 0,
    remarks: "",
    frmtype: ADI_CONFIG.FRM_TYPE,
    issuetypeid: ADI_CONFIG.ISSUE_TYPE_ID,
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: recordId,
    funccode: ADI_CONFIG.RB_MASTER,
  }));

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return {
      trandate: getTodayDateInputValue(),
      issuedate: getTodayDateInputValue(),
      expecteddate: getTodayDateInputValue(),
      frmtype: String(ADI_CONFIG.FRM_TYPE),
      issuetypeid: String(ADI_CONFIG.ISSUE_TYPE_ID),
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
  const [itemModalScanMode, setItemModalScanMode] = useState(false);
  const [scanQrLoading, setScanQrLoading] = useState(false);
  const [scanQrError, setScanQrError] = useState(null);
  const [lastQrItem, setLastQrItem] = useState(null);
  const [headerScanValue, setHeaderScanValue] = useState("");
  const [srSearchValue, setSrSearchValue] = useState("");
  const groupFilter = useItemPickerGroupFilter({
    spMainGroup: ADI_CONFIG.SP_ITEM_MAIN_GROUP,
    spSubMainGroup: ADI_CONFIG.SP_ITEM_SUB_MAIN_GROUP,
    formTag: ADI_CONFIG.FORM_TAG,
  });

  const [itemNameFilter, setItemNameFilter] = useState("");

  const [isEditMode, setIsEditMode] = useState(false);

  const cascadeResets = useMemo(() => buildAdiCascadeResets(headerColumns), [headerColumns]);

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
          : `Department Issue #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: ADI_CONFIG.ROUTE_PATH,
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
        idFields: ["astdeptissid", "AstDeptIssID"],
      });
      const { master, headerValues, details } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("Assets Department Issue record not found.");

      headerValuesRef.current = applyAdiHardcodedHeaderValues({
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
      console.error("[ADI] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load Assets Department Issue record.");
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
    todeptid: toDepartmentOptions,
    configid: configOptions,
    frmtype: ADI_FRM_TYPE_OPTIONS,
  }), [
    fromDivisionOptions,
    fromLocationOptions,
    toLocationOptions,
    fromDepartmentOptions,
    toDepartmentOptions,
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
    headerValuesRef.current = applyAdiHardcodedHeaderValues({
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
        hv.todeptid = 0;
        hv.configid = 0;
        itemGridRef.current?.clearRows?.();
        if (Number(val) > 0) {
          const fetches = [];
          if (hasVisibleCol(headerColumns, "fromlocationid")) {
            fetches.push(fetchFromLocations(val));
          }
          if (hasVisibleCol(headerColumns, "tolocationid")) {
            fetches.push(fetchToLocations(val));
          }
          if (hasVisibleCol(headerColumns, "configid")) {
            fetches.push(fetchConfigOptions(val));
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

  const fetchItemPickerColumns = useCallback(async () => {
    const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: OBJ_TYPE.FUNCTION,
      ObjName: ADI_CONFIG.SP_RB_META,
      JSon: JSON.stringify([{ prmrbcode: ADI_CONFIG.RB_ITEM_PICKER }]),
      p_ErrCode: -1,
      p_ErrMsg: "",
    });
    const rbRow = rbRes?.[0];
    if (!rbRow) throw new Error("Could not load item picker configuration.");

    const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
      prmMasterID: rbRow.rbid,
      prmLoginID: getUserSession().loginId,
    });
    return buildGridColumns(colRes || [], {}, {
      filterable: false,
      allEditable: false,
    });
  }, [getLive]);

  const recordLastScannedItem = useCallback((srNo, mappedRows, sourceRows = []) => {
    const last = sourceRows[sourceRows.length - 1] || mappedRows[mappedRows.length - 1] || {};
    const itemName = String(
      last.itemname ?? last.ItemName ?? last.itemdesc ?? last.ItemDesc
      ?? last.description ?? last.Description ?? last.itemcode ?? last.ItemCode
      ?? "Item"
    ).trim();
    const qrItem = {
      itemcode: String(last.itemcode ?? last.ItemCode ?? "").trim(),
      srno: String(srNo ?? "").trim(),
      itemname: itemName,
      rowIds: mappedRows.map((r) => r.id),
    };
    setLastQrItem(qrItem);
    return qrItem;
  }, []);

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
    setItemModalScanMode(false);
    setItemNameFilter("");
    groupFilter.resetFilter();

    try {
      const gridColumns = await fetchItemPickerColumns();
      setItemModalColumns(gridColumns);

      const divisionId = headerValues.fromdivisionid;
      const configId = headerValues.configid;
      await groupFilter.fetchMainGroupOptions({ divisionId, configId });
      await groupFilter.fetchSubMainGroupOptions({
        divisionId,
        configId,
        mainGroupId: 0,
      });
    } catch (err) {
      console.error("[ADI] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [fetchItemPickerColumns, headerColumns, groupFilter]);

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
            ObjName: ADI_CONFIG.SP_ITEM_PICKER,
            JSon: JSON.stringify([{
              ...buildAdiItemPickerJsonPayload(headerValues, {
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
      console.error("[ADI] Item filter fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    }
  }, [getLive, groupFilter, itemNameFilter]);

  const handleInsertItems = useCallback(async (selectedItems) => {
    if (!selectedItems?.length) return;
    setActiveTab("items");
    const activeCols = await ensureItemColumns();
    if (!activeCols?.length) return;
    const mappedRows = selectedItems.map((item) => mapPickerToItemRow(item, allColumns));
    mappedRows.forEach((row) => addItemRow(row));

    const pendingSrNo = pendingScanSrNoRef.current;
    if (pendingSrNo) {
      const entry = recordLastScannedItem(pendingSrNo, mappedRows, selectedItems);
      pendingScanSrNoRef.current = "";
      setItemModalScanMode(false);
      notify.toastSuccess(
        mappedRows.length === 1
          ? `Added: ${entry.itemname || pendingSrNo}`
          : `Added ${mappedRows.length} items · ${entry.itemname || pendingSrNo}`
      );
    }
  }, [ensureItemColumns, allColumns, addItemRow, recordLastScannedItem, notify]);

  const closeItemModal = useCallback(() => {
    setItemModalOpen(false);
    if (itemModalScanMode) {
      pendingScanSrNoRef.current = "";
      setItemModalScanMode(false);
    }
  }, [itemModalScanMode]);

  const isScanPickerRowDisabled = useCallback((row) => {
    return gridHasScannedItem(
      itemGridRef.current?.getRows?.() ?? [],
      row.itemcode ?? row.ItemCode,
      row.assetsrno ?? row.Assetsrno ?? row.srno ?? row.SrNo
    );
  }, []);

  const restoreSrSearchFocus = useCallback(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!srSearchRef.current || srSearchRef.current.disabled) return;
        srSearchRef.current.focus();
      }, 0);
    });
  }, []);

  const focusHeaderScanField = useCallback(() => {
    if (!isEditMode) return;
    setActiveTab("items");
    requestAnimationFrame(() => {
      headerScanRef.current?.focus();
      headerScanRef.current?.select?.();
    });
  }, [isEditMode]);

  const restoreHeaderScanFocus = useCallback(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!headerScanRef.current || headerScanRef.current.disabled) return;
        headerScanRef.current.focus();
      }, 0);
    });
  }, []);

  const handleScanHistorySubmit = useCallback(async (rawSrNo) => {
    const srNo = String(rawSrNo ?? "").trim();
    if (!srNo) {
      const msg = "Enter Sr No.";
      setScanQrError(msg);
      notify.toastError(msg);
      return;
    }

    const headerValues = headerValuesRef.current;
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValues, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    if (Object.keys(headerErrorMap).length > 0) {
      setFormErrors(["Please fix the highlighted field(s) below."]);
      return;
    }
    setFormErrors([]);
    setScanQrError(null);
    setScanQrLoading(true);

    try {
      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) {
        notify.toastError("Item grid columns could not be loaded.");
        return;
      }

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: ADI_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([{
          ...buildAdiItemPickerJsonPayload(headerValues, {
            maGroupId: 0,
            subMaGroupId: 0,
            itemNameSearch: "",
            qrJson: "",
            otherStr: srNo,
          }),
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });

      const rows = rowRes || [];
      if (rows.length === 0) {
        const msg = "No item found for this Sr No.";
        setScanQrError(msg);
        notify.toastError(msg);
        return;
      }

      const pickerColumns = itemModalColumns.length > 0
        ? itemModalColumns
        : await fetchItemPickerColumns();

      if (rows.length === 1) {
        const mappedRow = mapPickerToItemRow(rows[0], allColumns);
        const gridRowsNow = itemGridRef.current?.getRows?.() ?? [];
        if (gridHasScannedItem(
          gridRowsNow,
          mappedRow.itemcode ?? mappedRow.ItemCode,
          mappedRow.assetsrno ?? mappedRow.Assetsrno ?? mappedRow.srno ?? mappedRow.SrNo
        )) {
          const msg = "Item is already added";
          setScanQrError(msg);
          notify.toastError(msg);
          return;
        }

        setActiveTab("items");
        addItemRow(mappedRow);
        const entry = recordLastScannedItem(srNo, [mappedRow], rows);
        setSrSearchValue("");
        setScanQrError(null);
        notify.toastSuccess(`Added: ${entry.itemname || srNo}`);
        return;
      }

      pendingScanSrNoRef.current = srNo;
      setItemModalScanMode(true);
      setItemModalColumns(pickerColumns);
      setItemModalItems(rows);
      setItemModalError(null);
      setItemModalOpen(true);
      setSrSearchValue("");
      setScanQrError(null);
    } catch (err) {
      console.error("[ADI] Manual search item fetch failed:", err);
      const msg = err?.message || "Failed to fetch item for Sr No.";
      setScanQrError(msg);
      notify.toastError(msg);
    } finally {
      setScanQrLoading(false);
      restoreSrSearchFocus();
    }
  }, [
    headerColumns,
    ensureItemColumns,
    getLive,
    allColumns,
    addItemRow,
    recordLastScannedItem,
    fetchItemPickerColumns,
    itemModalColumns,
    notify,
    restoreSrSearchFocus,
  ]);

  const handleScanQrSubmit = useCallback(async (rawText) => {
    const { qrJson, error } = normalizeAdiQrSearchJson(rawText);
    if (error) {
      notify.toastError(error);
      restoreHeaderScanFocus();
      return;
    }

    const headerValues = headerValuesRef.current;
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValues, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    if (Object.keys(headerErrorMap).length > 0) {
      setFormErrors(["Please fix the highlighted field(s) below."]);
      restoreHeaderScanFocus();
      return;
    }
    setFormErrors([]);

    setScanQrError(null);

    let scannedMeta = {};
    try { scannedMeta = JSON.parse(qrJson); } catch { /* keep empty */ }
    const existingRows = itemGridRef.current?.getRows?.() ?? [];
    if (gridHasScannedItem(existingRows, scannedMeta.itemcode, scannedMeta.srno)) {
      const msg = "Item is already added";
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
        ObjName: ADI_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([{
          ...buildAdiItemPickerJsonPayload(headerValues, {
            maGroupId: 0,
            subMaGroupId: 0,
            itemNameSearch: "",
            qrJson,
          }),
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });

      const rows = rowRes || [];
      if (rows.length === 0) {
        const msg = "No item found for this QR JSON.";
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
      recordLastScannedItem(
        scannedMeta.srno ?? last.assetsrno ?? last.Assetsrno ?? last.srno ?? last.SrNo ?? "",
        mappedRows,
        rows
      );
      setHeaderScanValue("");

      notify.toastSuccess(
        mappedRows.length === 1
          ? `Added: ${itemName}`
          : `Added ${mappedRows.length} items · ${itemName}`
      );
    } catch (err) {
      console.error("[ADI] Scan QR item fetch failed:", err);
      const msg = err?.message || "Failed to fetch item for QR JSON.";
      notify.toastError(msg);
    } finally {
      setScanQrLoading(false);
      restoreHeaderScanFocus();
    }
  }, [
    headerColumns, ensureItemColumns, getLive,
    allColumns, addItemRow, notify, restoreHeaderScanFocus, recordLastScannedItem,
  ]);

  const commitSrSearch = useCallback((raw) => {
    const value = String(raw ?? "").trim();
    if (!value) return;
    setSrSearchValue("");
    handleScanHistorySubmit(value);
  }, [handleScanHistorySubmit]);

  const handleSrSearchKeyDown = useCallback((e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    if (!isEditMode || scanQrLoading) return;
    commitSrSearch(srSearchValue);
  }, [isEditMode, scanQrLoading, commitSrSearch, srSearchValue]);

  const handleSrSearchPaste = useCallback((e) => {
    if (!isEditMode || scanQrLoading) return;
    const text = e.clipboardData?.getData("text") ?? "";
    if (!String(text).trim()) return;
    e.preventDefault();
    commitSrSearch(text);
  }, [isEditMode, scanQrLoading, commitSrSearch]);

  const commitHeaderScan = useCallback((raw) => {
    const value = String(raw ?? "").trim();
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

  const syncLastQrItemWithGridRows = useCallback((rows) => {
    const livingIds = new Set((rows || []).map((r) => r.id));

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
    syncLastQrItemWithGridRows(rows);
  }, [syncLastQrItemWithGridRows]);

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "items") handleSelectItem();
  }, [activeTab, handleSelectItem]);

  const handleDeleteSelected = useCallback(() => {
    if (!itemGridRef.current) return;
    const selected = itemGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  const buildDefaultHeaderValues = useCallback(() => applyAdiHardcodedHeaderValues({
    trancode: "",
    trandate: getTodayDateInputValue(),
    issuedate: getTodayDateInputValue(),
    fromdivisionid: 0,
    fromlocationid: 0,
    tolocationid: 0,
    fromdeptid: 0,
    todeptid: 0,
    configid: 0,
    expecteddays: 0,
    expecteddate: getTodayDateInputValue(),
    includestockitems: 0,
    remarks: "",
    frmtype: ADI_CONFIG.FRM_TYPE,
    issuetypeid: ADI_CONFIG.ISSUE_TYPE_ID,
    funccode: ADI_CONFIG.RB_MASTER,
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: 0,
  }), []);

  const { resetFormToInitialState, discardChanges, completeSuccessfulSave } = useTransactionFormReset({
    storageKeys: [ADI_CONFIG.STORAGE_HEADER_META, ADI_CONFIG.STORAGE_ENTRY_META],
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
    const businessErrors = validateAdiBusinessRules(headerValuesRef.current);
    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    const { errors: detailErrors, cellErrors: detailCellErrs } = validateGridRowsDetailed(detailRows, columns, { requireAtLeastOne: true });
    setDetailCellErrors(detailCellErrs);
    const allErrors = [...headerBannerMsg, ...businessErrors, ...(detailRows.length === 0 ? detailErrors : [])];
    if (Object.keys(headerErrorMap).length > 0 || businessErrors.length > 0 || detailCellErrs.size > 0 || detailRows.length === 0) {
      setFormErrors(allErrors);
      return false;
    }

    const hv = applyAdiHardcodedHeaderValues(headerValuesRef.current);
    headerValuesRef.current = hv;
    const headerColDefs = headerColumns.map((col) => ({
      key: col.colname,
      colDataType: col.coldatatype,
    }));
    const mstRow = buildSaveRowFromColumns(hv, headerColDefs, {
      frmtype: ADI_CONFIG.FRM_TYPE,
      issuetypeid: ADI_CONFIG.ISSUE_TYPE_ID,
      loginid: getUserSession().loginId,
    });

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, { loginid: getUserSession().loginId })
    );

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: ADI_CONFIG.FORM_TAG, mst: mstRow, det: detRows }),
      { divisionId: hv.fromdivisionid, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(ADI_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setFormErrors([message]);
        return false;
      }
      notify.success(message);
      if (!skipPostSave) completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[ADI Save] Failed:", err);
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
    blocked: itemModalOpen,
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
    <div className="workspace-page workspace-page--fill adi-page">
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
            title="Assets Department Issue Detail"
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

      <section className="adi-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={ADI_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          headerControls={
            <>
              <label
                className={`adi-qr-search${!isEditMode ? " adi-qr-search--disabled" : ""}${scanQrLoading ? " adi-qr-search--busy" : ""}`}
                title={FORM_SHORTCUT_TITLES.scanQr}
              >
                <span className="adi-qr-search__icon" aria-hidden="true">
                  <QrCode size={16} strokeWidth={2.4} />
                </span>
                <input
                  id="adi-header-qr-scan"
                  ref={headerScanRef}
                  type="text"
                  className="adi-qr-search__input"
                  value={headerScanValue}
                  onChange={(e) => setHeaderScanValue(e.target.value)}
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
                <kbd className="adi-qr-search__kbd">Ctrl+Q</kbd>
              </label>

              <label
                className={`adi-qr-search adi-sr-search${!isEditMode ? " adi-qr-search--disabled" : ""}${scanQrLoading ? " adi-qr-search--busy" : ""}`}
                title="Search by serial number"
              >
                <span className="adi-qr-search__icon" aria-hidden="true">
                  <Search size={16} strokeWidth={2.4} />
                </span>
                <input
                  id="adi-header-sr-search"
                  ref={srSearchRef}
                  type="text"
                  className="adi-qr-search__input"
                  value={srSearchValue}
                  onChange={(e) => {
                    setSrSearchValue(e.target.value);
                    if (scanQrError) setScanQrError(null);
                  }}
                  onKeyDown={handleSrSearchKeyDown}
                  onPaste={handleSrSearchPaste}
                  placeholder={scanQrLoading ? "Fetching…" : "Search by serial number"}
                  disabled={!isEditMode}
                  readOnly={scanQrLoading}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="Search by serial number"
                  aria-invalid={Boolean(scanQrError)}
                />
              </label>
              {scanQrError ? (
                <span className="adi-sr-search__error" role="alert">{scanQrError}</span>
              ) : null}

              {lastQrItem?.itemcode || lastQrItem?.srno ? (
                <span className="adi-last-qr" title="Last scanned item">
                  <span className="adi-last-qr__label">Last scan</span>
                  {lastQrItem.itemcode ? (
                    <span className="adi-last-qr__pair">
                      <span className="adi-last-qr__key">Item</span>
                      <strong>{lastQrItem.itemcode}</strong>
                    </span>
                  ) : null}
                  {lastQrItem.srno ? (
                    <span className="adi-last-qr__pair">
                      <span className="adi-last-qr__key">Sr No</span>
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
          onRowsChange={handleGridRowsChange}
          onCellEvent={handleCellEvent}
          eventColumns={eventColumns}
          readOnly={isEditRoute && !isEditMode}
          existingRecordEdit={isEditRoute && isEditMode}
          cellErrors={detailCellErrors}
          loading={isGridLoading || isFetching}
          multiValuePasteColumns={ADI_MULTI_PASTE_COLUMNS}
          onMultiValuePaste={handleMultiValuePaste}
          remarkModalColumns={ADI_REMARK_COLUMNS}
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
          onClose={closeItemModal}
          items={itemModalItems}
          columns={itemModalColumns}
          isLoading={itemModalLoading || groupFilter.filterLoading}
          error={itemModalError}
          onInsert={handleInsertItems}
          filterBar={itemModalScanMode ? null : (
            <ItemPickerGroupFilterBar
              mainGroupOptions={groupFilter.mainGroupOptions}
              subMainGroupOptions={groupFilter.subMainGroupOptions}
              mainGroupValue={groupFilter.mainGroupFilter}
              subMainGroupValue={groupFilter.subMainGroupFilter}
              onMainGroupChange={(value) => groupFilter.handleMainGroupChange(value, {
                divisionId: headerValuesRef.current.fromdivisionid,
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
          )}
          awaitingFilter={itemModalScanMode ? false : !groupFilter.filterApplied}
          isRowDisabled={itemModalScanMode ? isScanPickerRowDisabled : null}
        />
      </Suspense>
    </div>
  );
}
