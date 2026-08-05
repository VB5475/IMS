// PurchaseIndentForm.jsx
// Purchase Indent entry form (add / edit).
// Mirrors PurchaseOrderForm.jsx — same three-phase load, edit-mode gate, item grid.
//
// Simplified vs PO (removed): Amend strip, Supplier, Currency, CreditDays,
//   BasedOnID, Terms tab, EnterpriseSummaryPanel, cell-event, 3rd detail table.
// Added vs PO: ExpDate (Expiry Date), LocationID (pending SP from DBA).
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — header fields (Indent No, Date, Division, Indent Type,
//                               Expiry Date, Department, Location, Remarks)
//   2. ind-grid-section       — single-tab wrapper
//        • Item Grid tab  → EntryGrid (API columns, RB_PurIndentDet)
//                           buttons: Add New | Select Item | Delete
//   3. ActionBar              — Add / Save / Cancel / Close (Alt shortcuts)

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, Printer, Save, FileText } from "lucide-react";
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
import { usePurchaseIndent } from "../../hooks/usePurchaseIndent";
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
import { buildGridColumns, isLockOnEditModeCol, isTruthyApiFlag, syncHeaderFilterWithApiCol, editRecordGridColumnOpts, syncEditGridDropdownValues } from "../../utils/gridUtils";
import { validateApiColumnsByField, validateGridRows } from "../../utils/columnValidation";
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
  IND_CONFIG,
  IND_MULTI_PASTE_COLUMNS,
  IND_REMARK_COLUMNS,
  IND_GRID_TABS,
  IND_FILTER_CASCADE_RESETS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  formatIndentTranDate,
  getMissingItemPickerHeaderFields,
} from "./constants";
import "./PurchaseIndentPage.css";

// ── Temp-ID generator (negative → never clash with real IDs) ──────────
let _indTempId = -1;
const nextTempId = () => _indTempId--;

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    trancode: headerValues.trancode ?? "",
    trandate: headerValues.trandate ?? "",
    divisionid: headerValues.divisionid ?? 0,
    configid: headerValues.configid ?? 0,
    expecteddate: headerValues.expecteddate ?? "",
    deptid: headerValues.deptid ?? 0,
    locationid: headerValues.locationid ?? 0,
    costcenterid: headerValues.costcenterid ?? 0,
    remarks: headerValues.remarks ?? "",
    indentrefrenceno: headerValues.indentrefrenceno ?? "",
    enteredby: headerValues.enteredby ?? "",
  };
}

// The item picker SP echoes the header params it was called with back on every
// row — prmexpdeldate returns as "expecteddeliverydate", which is also the
// detail RB's own date column — so overlaying it made each row inherit the
// master's Expected Date. Grid date cells are seeded with today and kept out
// of the overlay instead (getColDefault leaves date columns null).
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

// ── Component ──────────────────────────────────────────────────────────

export default function PurchaseIndentForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord = location.state?.record ?? null;
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const navigate = useNavigate();

  const itemGridRef = useRef(null);
  const itemGridSectionRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();
  const { get: getLive } = useApi(API_BASE_URL);
  const { post: postSave } = useApi(API_BASE_URL_IMS);

  const {
    headerColumns,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    divisionOptions,
    indentTypeOptions,
    departmentOptions,
    locationOptions,
    fetchIndentTypes,
    clearIndentTypes,
    fetchLocations,
    // fetchLocations,
    isLoadingIndentTypes,
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    fetchEditRecord,
    seedOptionsFromMaster,
    fetchUnlockedHeaderDropdowns,
    fireCellEvent,
    saveTxn,
    isSaving,
    saveError,
    clearSaveError,
  } = usePurchaseIndent(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  const headerValuesRef = useRef({
    trancode: "",
    trandate: getTodayDateInputValue(),
    divisionid: 0,
    configid: 0,
    expecteddate: getTodayDateInputValue(),
    deptid: 0,
    locationid: 0,
    costcenterid: 0,
    remarks: "",
    indentrefrenceno: "",
    enteredby: "",
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: recordId,
    funccode: IND_CONFIG.RB_MASTER,
  });

  // trandate/expecteddate default to today on a new record; existing records keep their loaded date.
  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { trandate: getTodayDateInputValue(), expecteddate: getTodayDateInputValue() };
  }, [loadedFilterValues]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState("items");
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [isGridLoading, setIsGridLoading] = useState(false);

  // Document Log modal (F6) — scoped to this indent's record id, gated on
  // the session's Document Log permission flags (set at login — see
  // extractDmConfigPermissions in session/userSession.js). Read once here;
  // dmConfig only changes on a fresh login, which remounts the whole tree.
  // User-confirmed rule 2026-07-30: BOTH flags must be "Y" — isdmdbbased is
  // only meaningful once isdmrequired is already "Y" (short-circuit AND).
  const dmConfig = getUserSession().dmConfig;
  const dmConfigAllows = dmConfig?.isdmrequired === "Y" && dmConfig?.isdmdbbased === "Y";

  // Document Log button visibility — a 3rd, ADDITIVE gate on top of
  // dmConfigAllows above, from ENDPOINTS.DM_HANDLE_BUTTON_VISIBILITY
  // (per-trantype, not per-user like dmConfig). Defaults to "NO" (safe
  // default-deny) until the fetch resolves or if it fails.
  const [docBtnVisible, setDocBtnVisible] = useState("NO");
  // isEditMode is declared here (hoisted up from its original spot further
  // down, see "Edit-mode gate" below) purely so isDocumentLogEnabled can read
  // it — the state itself is unchanged, still the single flag driven by
  // clicking either "Add" (new record) or "Edit" (existing record), via
  // enterEditModeWithFocus.
  const [isEditMode, setIsEditMode] = useState(false);
  // REVERSED 2026-07-31 (explicit user instruction, 2nd correction same day):
  // gated on isEditRoute (existing-record-only) a moment ago — corrected to
  // isEditMode instead: "before Add OR Edit mode active the button will be
  // disabled." So the button is disabled while merely VIEWING a record (or
  // before "Add" is clicked on a new one), and becomes active as soon as
  // Add/Edit mode is entered — including on a brand-new, still-unsaved
  // record (tranid=0), since documents can be staged against the temporary
  // docGuid before the transaction itself is saved. NOTE: this REOPENS the
  // "Add-mode linking gap" documented on linkDocsToTransaction below — an
  // Add-mode session can now stage documents, but linking them still only
  // fires on Edit-mode saves (no known tranid to link against after an Add
  // save) — flagged there again, not silently resolved.
  const isDocumentLogEnabled = dmConfigAllows && docBtnVisible === "YES" && isEditMode;

  const [docModalOpen, setDocModalOpen] = useState(false);
  const handleOpenDocuments = useCallback(() => {
    if (!isDocumentLogEnabled) return;
    setDocModalOpen(true);
  }, [isDocumentLogEnabled]);

  // Document-log GUID — issued so documents can be associated with this
  // transaction before/regardless of it having been saved. Per-form state,
  // not session (see ENDPOINTS.DM_HANDLE_GUID). Best-effort: a failure here
  // must never block the page or the form. **Live-confirmed 2026-07-30**:
  // the endpoint is deployed on IMS_LIVE, but expects LOWERCASE field names
  // (prmguid/prmref_trantypeid/prmtranid) — the DM API doc's own example
  // used mixed case (prmGUID/prmRef_TranTypeID/prmTranID), which 500s; only
  // the lowercase shape actually works and returns a real GUID + success
  // message. Confirmed via direct curl re-test the same day the doc's other
  // endpoints went live — the doc's casing was simply wrong here, don't
  // "fix" it back to match the doc without re-testing first.
  const [docGuid, setDocGuid] = useState("");
  // tranId: the real recordId in edit mode, 0 for a new/unsaved record —
  // fires on every Indent page load (Add and Edit both), not just Add.
  const fetchDocGuid = useCallback(async (tranId = 0) => {
    try {
      const res = await postSave(ENDPOINTS.DM_HANDLE_GUID, {
        prmguid: "1",
        prmref_trantypeid: IND_CONFIG.DM_TRAN_TYPE_ID,
        prmtranid: Number(tranId) || 0,
      });
      const row = Array.isArray(res) ? res[0] : res;
      const guid = row?.guid ?? row?.Guid ?? row?.GUID ?? row?.guId;
      if (guid) setDocGuid(String(guid));
    } catch (err) {
      console.warn("[Indent] DM HandleGUID fetch failed:", err);
    }
  }, [postSave]);

  // Live-confirmed 2026-07-30: plain JSON object body (not array, despite
  // the reference screenshot) — same gotcha as DM_HANDLE_GUID. Response is
  // an array of one row: [{ isdmbtnvisible: "YES"|"NO", ... }].
  const fetchDocBtnVisible = useCallback(async () => {
    try {
      const res = await postSave(ENDPOINTS.DM_HANDLE_BUTTON_VISIBILITY, {
        prmref_trantypeid: IND_CONFIG.DM_TRAN_TYPE_ID,
        prmloginid: getUserSession().loginId,
      });
      const row = Array.isArray(res) ? res[0] : res;
      const visible = row?.isdmbtnvisible ?? row?.IsDMBtnVisible;
      setDocBtnVisible(visible === "YES" ? "YES" : "NO");
    } catch (err) {
      console.warn("[Indent] DM HandleButtonVisibility fetch failed:", err);
      setDocBtnVisible("NO");
    }
  }, [postSave]);

  // Links any documents uploaded/saved against docGuid (before this
  // transaction had a real TranID) to the now-real, just-saved tranid — per
  // explicit user spec 2026-07-30: "on save GUID to be passed in save and at
  // the end we need to store and pass that guid in relevant module to link."
  // Live-confirmed body shape (real Indent values): {prmtrantypeid,
  // prmguid, prmtranid, prmyearid, prmloginid, prmdivisionid} →
  // {"ErrCode":"1","ErrMsg":"Document(s) saved with Transaction Successfully !"}.
  // Best-effort: a failure here must never block the Indent's own save
  // success (the transaction itself already saved fine by this point).
  //
  // KNOWN GAP — Add-mode only (REOPENED 2026-07-31, 2nd correction same day):
  // isDocumentLogEnabled was briefly gated on isEditRoute, which made the
  // Documents modal unreachable during Add mode and incidentally closed this
  // gap — then corrected to gate on isEditMode instead ("before Add OR Edit
  // mode active the button will be disabled"), which means a brand-new,
  // still-unsaved record CAN now open Documents and stage files against the
  // temporary docGuid. This function still only fires for EDIT saves, where
  // recordId is already the real tranid — there is still no established way
  // in this codebase to learn a newly-created Indent's tranid from an Add
  // save's response (grepped every module, none exists), so documents staged
  // during an Add-mode session are NOT currently linked once that Add save
  // completes. Left unresolved rather than guessed — needs either a backend
  // change (return the new ID) or a different flow.
  const linkDocsToTransaction = useCallback(
    async (realTranId) => {
      if (!docGuid || !realTranId) return;
      try {
        const session = getUserSession();
        const result = await postSave(DOC_LOG_CFG.UPDATE_ON_TRAN_SAVE_ENDPOINT, {
          prmtrantypeid: IND_CONFIG.DM_TRAN_TYPE_ID,
          prmguid: docGuid,
          prmtranid: Number(realTranId) || 0,
          prmyearid: session.yearId,
          prmloginid: session.loginId,
          prmdivisionid: Number(headerValuesRef.current?.divisionid) || 0,
        });
        const { success, message } = parseApiErrMsg(result);
        if (!success) console.warn("[Indent] DM_Doc_UpdateOnTranSave failed:", message);
      } catch (err) {
        console.warn("[Indent] DM_Doc_UpdateOnTranSave failed:", err);
      }
    },
    [postSave, docGuid]
  );

  // Item picker modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);
  // Select Item popup filters (Direct mode only) — items are only fetched
  // once the user clicks Filter, not automatically when the modal opens.
  const groupFilter = useItemPickerGroupFilter({
    spMainGroup: IND_CONFIG.SP_ITEM_MAIN_GROUP,
    spSubMainGroup: IND_CONFIG.SP_ITEM_SUB_MAIN_GROUP,
    formTag: IND_CONFIG.FORM_TAG,
  });

  // ── Edit-mode gate ─────────────────────────────────────────────────
  // isEditMode itself now lives up near dmConfig/docBtnVisible (see there) —
  // declared early so isDocumentLogEnabled can read it.

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
      ? "Fill in the header fields, then add items via the grid."
      : recordLoading
        ? "Loading purchase indent…"
        : recordLoadError
          ? recordLoadError
          : `Indent #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: IND_CONFIG.ROUTE_PATH,
  });

  // ── Mount: load metadata ───────────────────────────────────────────
  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
    // Both Add and Edit — recordId is 0 for a new/unsaved record, the real
    // id for an existing one (available immediately from the route param,
    // no need to wait for loadEditRecord to finish).
    fetchDocGuid(recordId);
    fetchDocBtnVisible();
  }, [fetchHeaderMeta, fetchDetailMeta, isEditRoute, recordId, fetchDocGuid, fetchDocBtnVisible]);

  // Phase 3 (new route only): pre-load grid columns after detail meta loads
  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(headerValuesRef.current?.divisionid ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns, fetchGridColumns, isEditRoute]);

  // Flush any queued rows once columns are ready
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

  // ── Edit flow: load existing record ───────────────────────────────
  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const params = resolveEditLoadParams(recordId, listRecord, {
        idFields: ["indentid"],
      });
      const { master, headerValues, details } = await fetchEditRecord(params);

      if (!master || !headerValues) {
        throw new Error("Purchase Indent record not found.");
      }

      headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      seedOptionsFromMaster(master);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      const activeCols = await fetchGridColumns(headerValues.divisionid ?? 0, editRecordGridColumnOpts(master));
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;

      const syncedDetails = syncEditGridDropdownValues(details, activeCols || []);

      if (itemGridRef.current?.loadRows) {
        itemGridRef.current.loadRows(syncedDetails);
      } else {
        queuedRowsRef.current = syncedDetails;
      }
    } catch (err) {
      console.error("[Indent] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load purchase indent record.");
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
    const divisionId = headerValuesRef.current?.divisionid ?? loadedMasterRow?.divisionid ?? 0;
    fetchUnlockedHeaderDropdowns(divisionId);
    fetchGridColumns(divisionId, {
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

  // ── syncedFilters — built purely from API headerColumns (fully dynamic) ────
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    divisionid: divisionOptions,
    configid: indentTypeOptions,
    deptid: departmentOptions,
    locationid: locationOptions,
  }), [divisionOptions, indentTypeOptions, departmentOptions, locationOptions]);

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

  // ── filterFieldTones — per-field visual state ──────────────────────
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

  // ── Filter change / cascade ────────────────────────────────────────
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
        headerValuesRef.current.configid = 0;
        headerValuesRef.current.locationid = 0;
        clearIndentTypes();
        itemGridRef.current?.clearRows?.();
        // Location is division-wise (fn_tbl_fetch_divwslocation) — always refetch,
        // even back to the "no division selected" (0) case, so stale options don't linger.
        await fetchLocations(val && val !== "0" ? val : 0);
        if (val && val !== "0") {
          await Promise.all([
            fetchIndentTypes(val),
            fetchLocations(val),
          ]);
          focusFieldAfterCascade(filterPanelRef, "configid");
        }
        return;
      }

      if (colName === "configid") {
        itemGridRef.current?.clearRows?.();
      }
    },
    [fetchIndentTypes, clearIndentTypes, fetchLocations]
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

  // ── Cell event — Qty / Rate recalculation ─────────────────────────
  const handleCellEvent = useCallback(
    ({ rowId, colKey, rowData }) =>
      trackCellEvent(async () => {
        const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
        if (!result || !itemGridRef.current) return;
        const responseRow = result?.[0];
        if (!responseRow) return;
        const errCode = responseRow.errcode;
        if (errCode !== 1 && errCode !== 1.0) {
          console.warn("[Indent] Cell-event error:", responseRow.errmsg ?? `ErrCode ${errCode}`);
          return;
        }
        const { errcode, errmsg, ...updatedFields } = responseRow;
        itemGridRef.current.updateRow?.(rowId, updatedFields);
      }),
    [fireCellEvent, trackCellEvent]
  );

  // ── Select Item ────────────────────────────────────────────────────
  // Direct mode only (Indent has no Indent-wise variant — BasedOnID = 0 /
  // prmFrmOption = 0 per MRD). Opening the modal loads the picker's grid
  // columns and the Main Group filter options, but NOT items — items are
  // only fetched once the user picks filters and clicks Filter (see
  // handleApplyItemFilter below). Client instruction 2026-07-28.
  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues, headerColumns);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }
    const { divisionid, configid } = headerValues;
    const divisionID = divisionid ?? 0;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);
    groupFilter.resetFilter();

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: IND_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: IND_CONFIG.RB_DETAIL_SELECT }]),
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

      await groupFilter.fetchMainGroupOptions({ divisionId: divisionID, configId: configid });
    } catch (err) {
      console.error("[Indent] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, headerColumns, groupFilter]);

  // Actual item fetch — deferred until the user clicks Filter. Main/Sub Main
  // Group ARE now sent to SP_ITEM_PICKER — live-confirmed 2026-07-28 that
  // fn_tbl_rb_purindtselitem accepts prmmaingroupid/prmsubmaingroupid
  // (previously threw "Must declare the scalar variable ..."; that's gone).
  // prmsubmaingroupid sends 0 when no sub group is picked (matches this
  // app's usual "unfiltered" sentinel for id params). Only these 2 filter
  // params are sent here (not the Assets modules' full 5-param signature) —
  // preserved as-is, this shape was live-verified 2026-07-28.
  const handleApplyItemFilter = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const { divisionid, configid, trandate, expecteddate } = headerValues;
    const divisionID = divisionid ?? 0;
    const expectedDate = expecteddate ?? "";

    setItemModalError(null);
    try {
      await groupFilter.applyFilter(async () => {
        const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: IND_CONFIG.SP_ITEM_PICKER,
          JSon: JSON.stringify([
            {
              prmdivisionid: Number(divisionID),
              prmyearid: getUserSession().yearId,
              prmloginid: getUserSession().loginId,
              prmtrandate: formatIndentTranDate(trandate),
              prmconfigid: Number(configid ?? 0),
              prmsupplierid: 0,
              prmexpdeldate: expectedDate,
              prmtranbook: IND_CONFIG.TRAN_BOOK,
              prmfrmoption: 0,
              prmmaingroupid: Number(groupFilter.mainGroupFilter) || 0,
              prmsubmaingroupid: Number(groupFilter.subMainGroupFilter) || 0,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        setItemModalItems(rowRes || []);
      });
    } catch (err) {
      console.error("[Indent] Item filter fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    }
  }, [getLive, groupFilter]);

  const handleInsertItems = useCallback(
    async (selectedItems) => {
      if (!selectedItems?.length) return;
      setActiveTab("items");
      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) return;
      const dateColKeys = new Set(activeCols.filter(isDateColumnDef).map((col) => col.key));
      const rows = selectedItems.map((item) => mapPickerToItemRow(item, allColumns, dateColKeys));
      rows.forEach((row) => addItemRow(row));
      // Fire the same qty/rate recalc a manual blur would trigger, so a
      // picker-inserted row's calculated amounts are correct immediately
      // instead of staying 0.00 until the user touches the cell (client-
      // confirmed 2026-07-24, same fix as Purchase Voucher/Order/Quotation/Inquiry).
      await Promise.all(rows.map((row) => handleCellEvent({ rowId: row.id, colKey: "tranqty", rowData: row })));
    },
    [ensureItemColumns, allColumns, addItemRow, handleCellEvent]
  );

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "items") handleSelectItem();
  }, [activeTab, handleSelectItem]);

  const handleToggleCollapsible = useCallback(() => {
    itemGridRef.current?.toggleFocusedRowCollapsible?.();
  }, []);

  // ── Delete selected rows ───────────────────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    if (!itemGridRef.current) return;
    const selected = itemGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  // ── Save ───────────────────────────────────────────────────────────
  const [isSavingIndent, setIsSavingIndent] = useState(false);

  const buildDefaultHeaderValues = useCallback(() => ({
    trancode: "",
    trandate: getTodayDateInputValue(),
    divisionid: 0,
    configid: 0,
    expecteddate: getTodayDateInputValue(),
    deptid: 0,
    locationid: 0,
    costcenterid: 0,
    remarks: "",
    indentrefrenceno: "",
    enteredby: "",
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: 0,
    funccode: IND_CONFIG.RB_MASTER,
  }), []);

  const { resetFormToInitialState, discardChanges } = useTransactionFormReset({
    storageKeys: [IND_CONFIG.STORAGE_HEADER_META, IND_CONFIG.STORAGE_ENTRY_META],
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
    extraClearFns: [clearIndentTypes, () => setDocGuid("")],
    // Back to a blank new-entry state (post-save, or Cancel on a new record)
    // — re-issue a fresh GUID for whatever the user enters next, same as the
    // initial mount fetch. No-op on an edit route (isNewRoute is false there).
    extraReset: () => {
      if (isNewRoute) fetchDocGuid();
      setFieldErrors({});
    },
  });

  const completeSuccessfulSave = useCallback(() => {
    if (isEditRoute) navigate(IND_CONFIG.ROUTE_PATH);
    else resetFormToInitialState();
  }, [isEditRoute, navigate, resetFormToInitialState]);

  const handleSave = useCallback(async ({ skipPostSave = false } = {}) => {
    await flushPendingCellEvents(itemGridSectionRef);

    setFormErrors([]);
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValuesRef.current, headerColsToValidate);
    setFieldErrors(headerErrorMap);

    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    const detailErrors = validateGridRows(detailRows, columns, { requireAtLeastOne: true });

    const headerBannerMsg =
      Object.keys(headerErrorMap).length > 0 ? ["Please fix the highlighted field(s) below."] : [];
    const allErrors = [...headerBannerMsg, ...detailErrors];
    if (allErrors.length > 0) {
      setFormErrors(allErrors);
      return false;
    }

    const mstRow = {};
    headerColumns.forEach((col) => {
      mstRow[col.colname] = getColDefault(col.coldatatype);
    });
    const hv = headerValuesRef.current;
    Object.entries(hv).forEach(([k, v]) => {
      if (k !== "id") mstRow[k] = v;
    });
    mstRow.loginid = getUserSession().loginId;

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, { loginid: getUserSession().loginId })
    );

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: "Indent", mst: mstRow, det: detRows }),
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSavingIndent(true);
    try {
      const result = await postSave(IND_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
      // Link any documents uploaded/saved under docGuid to this now-saved
      // transaction. Edit-mode only for now — recordId is the real tranid
      // here; see linkDocsToTransaction's own comment for why Add-mode
      // (where the new tranid isn't known client-side) isn't covered yet.
      if (isEditRoute) linkDocsToTransaction(recordId);
      if (!skipPostSave) completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[Indent Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSavingIndent(false);
    }
  }, [headerColumns, allColumns, columns, isEditRoute, recordId, linkDocsToTransaction, completeSuccessfulSave, flushPendingCellEvents]);

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

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = headerFetching || isLoadingIndentTypes;

  useEntryFormKeyboard({
    blocked: itemModalOpen || docModalOpen,
    isEditMode,
    isSaving: isSavingIndent,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onSavePrint: handleSaveAndPrint,
    onCancel: handleCancel,
    onSelectList: handleSelectListShortcut,
    onToggleCollapsible: handleToggleCollapsible,
    onDocuments: handleOpenDocuments,
  });

  // ── Extra ActionBar buttons ────────────────────────────────────────
  const indExtraButtons = useMemo(
    () => [
      {
        key: "documents",
        label: "Documents",
        Icon: FileText,
        variant: "secondary",
        onClick: handleOpenDocuments,
        // Enabled only when dmConfig AND the per-trantype
        // DM_HandleButtonVisibility flag both allow it AND Add/Edit mode is
        // actually active (2026-07-31, 2nd correction same day — gated on
        // isEditMode, not isEditRoute, see isDocumentLogEnabled above).
        disabled: !isDocumentLogEnabled,
        showAlways: true,
        title: !isEditMode
          ? "Click Add/Edit first to manage documents."
          : isDocumentLogEnabled
            ? FORM_SHORTCUT_TITLES.documents
            : "Document rights are not enabled for your account.",
      },
      {
        key: "saveprint",
        label: "Save & Print",
        Icon: Printer,
        variant: "print",
        onClick: handleSaveAndPrint,
        disabled: isSavingIndent,
        title: FORM_SHORTCUT_TITLES.savePrint,
      },
      {
        key: "save",
        label: isSavingIndent ? "Saving…" : "Save",
        Icon: Save,
        variant: "save",
        onClick: handleSave,
        disabled: isSavingIndent,
        loading: isSavingIndent,
        accessKey: "s",
        title: FORM_SHORTCUT_TITLES.save,
      },
    ],
    [handleOpenDocuments, isDocumentLogEnabled, isEditMode, handleSaveAndPrint, isSavingIndent, handleSave]
  );

  const itemGridConfig = {
    columns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const combinedError = metaError || headerError;

  const itemFilterBar = (
    <ItemPickerGroupFilterBar
      mainGroupOptions={groupFilter.mainGroupOptions}
      subMainGroupOptions={groupFilter.subMainGroupOptions}
      mainGroupValue={groupFilter.mainGroupFilter}
      subMainGroupValue={groupFilter.subMainGroupFilter}
      onMainGroupChange={(value) => groupFilter.handleMainGroupChange(value, {
        divisionId: headerValuesRef.current.divisionid,
        configId: headerValuesRef.current.configid,
      })}
      onSubMainGroupChange={groupFilter.setSubMainGroupFilter}
      onFilter={handleApplyItemFilter}
      filterLoading={groupFilter.filterLoading}
    />
  );

  return (
    <div className="workspace-page workspace-page--fill ind-page">
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
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            panelRef={filterPanelRef}
            title="Purchase Indent Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={IND_FILTER_CASCADE_RESETS}
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

      {/* ── Single-tab grid section ───────────────────────────────────── */}
      <section className="ind-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={IND_GRID_TABS}
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
                title="Pick items from list (Tab here after header fields)"
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
          multiValuePasteColumns={IND_MULTI_PASTE_COLUMNS}
          onMultiValuePaste={handleMultiValuePaste}
          remarkModalColumns={IND_REMARK_COLUMNS}
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
        extraButtons={indExtraButtons}
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
          filterBar={itemFilterBar}
          awaitingFilter={!groupFilter.filterApplied}
        />
      </Suspense>

      <Suspense fallback={null}>
        <DocumentLogModal
          isOpen={docModalOpen}
          onClose={() => setDocModalOpen(false)}
          tranId={recordId}
          divisionId={headerValuesRef.current?.divisionid}
          tranTypeId={IND_CONFIG.DM_TRAN_TYPE_ID}
          guid={docGuid}
        />
      </Suspense>
    </div>
  );
}
