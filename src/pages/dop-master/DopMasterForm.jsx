// DopMasterForm.jsx — DOP (Delegation Of Power) Master entry form (Add / Edit)
//
// Amount Detail is a list of "amount band" cards (Min/Max Amount), each with
// its OWN nested Employee Detail mini-grid — one amount row → its own set of
// employee rows (confirmed: Employee Detail's RB has a hidden `amountid`
// column linking each employee row back to its amount row). Cards use
// CollapsibleGrid (variant="panel"), a full independent EntryGrid wrapped in
// an expand/collapse panel — NOT EntryGrid's own childRowsMap/enableCollapsible
// feature, which is read-only display for pre-loaded picker data (e.g.
// Purchase Inquiry's indent-wise rows) and has no "add a row" workflow.
//
// Each band's employee mini-grid is uncontrolled (imperative ref — addRow /
// getRows / removeRows / loadRows), same pattern as every other grid in this
// app: no `rows` prop kept in sync with React state, to avoid the
// loadRows-on-every-keystroke jank that would cause. A small `employeeCounts`
// state map exists purely so each card's badge shows a live count.
//
// ⚠️ CONFIRMED live 2026-07-27 from a working payload sample — the save
// payload sends TWO FLAT parallel arrays (prmStrAmtJSON / prmStrUserJSON,
// re-confirmed 2026-07-28 — see constants.js note, which previously had this
// wrong), not nested employees-inside-amount objects. New (unsaved) employee
// rows carry a blank `amountid`; since 2026-07-28 each employee row also
// carries `amountwssrno` (its owning band's 1-based position) as an explicit
// correlation key, alongside the implicit array-order/amountid correlation.
//
// See ./constants.js for the full list of other MRD gaps/assumptions.

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Save, PlusCircle, X } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import CollapsibleGrid from "../../components/grid/CollapsibleGrid";
import GridSearch from "../../components/grid/GridSearch";
const GridNumberInput = lazy(() => import("../../components/grid/GridNumberInput"));
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
import { useDopMaster } from "../../hooks/useDopMaster";
import { useApi } from "../../api/useApi";
import { API_BASE_URL, API_BASE_URL_IMS, getColDefault, buildSaveRowFromColumns } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { isLockOnEditModeCol, isTruthyApiFlag, syncHeaderFilterWithApiCol } from "../../utils/gridUtils";
import { validateApiColumnsByField, validateGridRowsDetailed } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { focusFieldAfterCascade } from "../../utils/focusUtils";
import { queryEditableFilterFields, resolveEditLoadParams } from "../../utils/txnFormUtils";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { completeTransactionSave } from "../../hooks/useTransactionFormReset";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  DOP_CONFIG,
  DOP_FILTER_CASCADE_RESETS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
} from "./constants";
// .eg-tab-btn (Add Amount based / Add Employee / Delete) lives in EntryGrid.css,
// which normally loads for free via a direct <EntryGrid> import — but here
// EntryGrid is only reached lazily, through CollapsibleGrid, so with zero
// bands mounted (or before a based's grid finishes loading) that CSS chunk
// never arrives and the buttons render as unstyled browser defaults.
// Importing it directly guarantees it's always present.
import "../../components/grid/EntryGrid.css";
import "./DopMasterPage.css";

let _dopTempId = -1;
const nextTempId = () => _dopTempId--;

// Employee Detail Sr.No auto-numbers 50, 100, 150... PER BAND (colname
// confirmed live: srno).
const DOP_SRNO_STEP = 50;

// Stable reference (not a fresh `[]` literal per render) — each employee
// CollapsibleGrid is intentionally uncontrolled (rows live inside its own
// EntryGrid, mutated only via addRow/removeRows refs). CollapsibleGrid's own
// effect re-syncs from the `rows` prop by reference on every change, so a new
// `[]` each render would call clearRows() right after every addRow() call.
const EMPTY_ROWS = [];

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    trancode: headerValues.trancode ?? "",
    tranid: String(headerValues.tranid ?? ""),
    configurationid: String(headerValues.configurationid ?? ""),
    divisionid: String(headerValues.divisionid ?? ""),
    departmentid: String(headerValues.departmentid ?? ""),
    companyid: String(headerValues.companyid ?? ""),
    dopisamountbased: Number(headerValues.dopisamountbased) === 1 ? 1 : 0,
    funccode: headerValues.funccode ?? "",
  };
}

export default function DopMasterForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord = location.state?.record ?? null;
  const notify = useNotification();
  // formErrors (banner) is reserved for real save-time failures and cross-row
  // business rules that have no single field/cell to attach to (the Approving
  // status-chain checks below). Required/format checks on header fields, on
  // each employee grid row, and on each band's own Min/Max fields surface
  // inline instead — see fieldErrors/employeeCellErrors/amountCellErrors.
  // (2026-08-21 /pm — same "no duplicate modal validation" fix as Transporter
  // Master, applied here.)
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [employeeCellErrors, setEmployeeCellErrors] = useState(null);
  const [amountCellErrors, setAmountCellErrors] = useState(null);
  const navigate = useNavigate();

  const filterPanelRef = useRef(null);
  const addAmountBandBtnRef = useRef(null);
  const amountColumnsLoadedRef = useRef(false);
  const userColumnsLoadedRef = useRef(false);
  // bandId -> CollapsibleGrid ref (imperative addRow/getRows/removeRows/loadRows)
  const employeeGridRefsRef = useRef({});
  // bandId -> employee rows waiting for their card's grid ref to mount (edit load)
  const queuedEmployeesByBandRef = useRef({});
  // band ids that came from the API on edit-load — these bands' remove-X is
  // hidden (only bands added during THIS edit session, via Add Amount based,
  // are removable). Empty for a brand-new record, so every band there counts
  // as "added" and keeps its remove-X.
  const apiBandIdsRef = useRef(new Set());

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    tranTypeOptions, entityOptions, divisionOptions, departmentOptions, companyOptions,
    fetchEntityOptions, clearEntityOptions,
    amountColumns, amountAllColumns, amountFetching, amountMetaError,
    fetchAmountDetailMeta, fetchAmountGridColumns,
    userColumns, userAllColumns, userFetching, userMetaError,
    fetchUserDetailMeta, fetchUserGridColumns,
    fetchEditRecord, clearSaveError,
  } = useDopMaster(API_BASE_URL);

  // Employee Detail status values, resolved once from the live dropdown
  // (colname: userstatus — see the status-chain validation notes in
  // handleSave below for why this is read by label, not a hardcoded id).
  // Shared between handleSave's validation and the live auto-Sr.No-match
  // effect below, so both stay in sync with whatever the RB's real option
  // ids are on this environment.
  const userStatusValues = useMemo(() => {
    const opts = userColumns.find((c) => c.key === "userstatus")?.dropdownOptions ?? [];
    return {
      approve: opts.find((o) => /^approv/i.test(o.label) && !/other/i.test(o.label))?.value,
      approveOther: opts.find((o) => /approv.*other/i.test(o.label))?.value,
      recommend: opts.find((o) => /recommend/i.test(o.label))?.value,
    };
  }, [userColumns]);

  const { post: postSave } = useApi(API_BASE_URL_IMS);

  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  const buildDefaultHeaderValues = useCallback(() => ({
    trancode: "",
    tranid: 0,
    configurationid: 0,
    divisionid: 0,
    departmentid: 0,
    // Not a user-pick field — same non-selectable session default every other
    // module uses (e.g. CWIPToFAForm.jsx's headerValuesRef). Company IS
    // technically an RB header column with its own dropdown wiring (kept, in
    // case it's ever visible on a different environment/RB config), but it
    // isn't shown in the live UI (2026-08-12 bug report — payload was sending
    // 0 because nothing ever set it), so it must default from session.
    companyid: getUserSession().companyId,
    dopisamountbased: 0,
    funccode: DOP_CONFIG.RB_MASTER,
    tranmstgenid: 0,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: recordId,
  }), [recordId]);

  const headerValuesRef = useRef(buildDefaultHeaderValues());

  const filterInitialValues = useMemo(() => loadedFilterValues ?? {}, [loadedFilterValues]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  // "Is DOP Amount" toggle (colname confirmed live: dopisamountbased) gates
  // whether amount bands can be added at all. 2026-08-20 (/pm): Yes = normal
  // multi-band mode, -1 banned in Min/Max on every band. No = exactly ONE
  // locked band, Min/Max fixed at -1/-1 (the sentinel), no Add/Remove.
  const [isAmountEnabled, setIsAmountEnabled] = useState(false);
  // Confirmation gate for flipping the toggle when it would discard existing
  // Amount Detail data — see handleFilterChange's dopisamountbased branch.
  const [amountToggleConfirmOpen, setAmountToggleConfirmOpen] = useState(false);
  const pendingAmountToggleValueRef = useRef(null);
  // Pushed into EnterpriseFilterPanel's `externalValues` prop to force the
  // toggle's displayed position — used to snap it back to the pre-change
  // value while the confirm dialog is open, and to land it on the confirmed
  // value once the user accepts (the panel is otherwise uncontrolled after
  // its own initial mount, so this is the only way to move one field without
  // remounting — and losing unsaved edits on — the whole panel).
  const [filterExternalValues, setFilterExternalValues] = useState(null);
  // Amount bands themselves — each { id, minamount, maxamount, ...defaults }.
  const [amountBands, setAmountBands] = useState([]);
  // bandId -> employee row count, for each card's badge (the actual row DATA
  // lives uncontrolled inside that band's CollapsibleGrid, not in this state).
  const [employeeCounts, setEmployeeCounts] = useState({});
  // bandId -> the band's employees loaded on edit, fed to that band's grid as
  // its `rows`/initialRows so EntryGrid loads them in its own (lazy-mount-safe)
  // mount effect. Replaces a post-mount imperative flush that raced the grid's
  // lazy load and dropped the rows (grid showed empty despite a nonzero count).
  const [employeesByBand, setEmployeesByBand] = useState({});
  // bandId -> search query, for each band's own Employee Detail search box
  // (rendered in the shared header row via CollapsibleGrid's headerActions,
  // fed into the grid as an externalSearchQuery so it still filters).
  const [employeeSearch, setEmployeeSearch] = useState({});
  // bandId -> live post-filter row count, for that same search box's count badge.
  const [employeeMatchCounts, setEmployeeMatchCounts] = useState({});

  const focusFirstEditableFilterField = useCallback(() => {
    const fields = queryEditableFilterFields(filterPanelRef.current);
    if (fields.length === 0) return false;
    fields[0].focus();
    return true;
  }, []);

  const focusAddAmountBandButton = useCallback(() => {
    addAmountBandBtnRef.current?.focus();
  }, []);

  const enterEditModeWithFocus = useCallback(async () => {
    setIsEditMode(true);
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (!focusFirstEditableFilterField()) focusAddAmountBandButton();
      }, 80);
    });
  }, [focusFirstEditableFilterField, focusAddAmountBandButton]);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  usePageHeader({
    title: isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then add Amount bands and their employees."
      : recordLoading
        ? "Loading record…"
        : recordLoadError
          ? recordLoadError
          : `DOP #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: DOP_CONFIG.ROUTE_PATH,
    backLabel: "DOP",
  });

  // ── Mount: load metadata ───────────────────────────────────────────────────
  useEffect(() => {
    fetchHeaderMeta();
    fetchAmountDetailMeta();
    fetchUserDetailMeta();
  }, [fetchHeaderMeta, fetchAmountDetailMeta, fetchUserDetailMeta]);

  // Eager grid column load for new records
  useEffect(() => {
    if (amountAllColumns.length === 0 || amountColumnsLoadedRef.current || isEditRoute) return;
    fetchAmountGridColumns(0).then((cols) => {
      if (cols?.length > 0) amountColumnsLoadedRef.current = true;
    });
  }, [amountAllColumns, fetchAmountGridColumns, isEditRoute]);

  useEffect(() => {
    if (userAllColumns.length === 0 || userColumnsLoadedRef.current || isEditRoute) return;
    fetchUserGridColumns(headerValuesRef.current.divisionid).then((cols) => {
      if (cols?.length > 0) userColumnsLoadedRef.current = true;
    });
  }, [userAllColumns, fetchUserGridColumns, isEditRoute]);

  // Registers a band's employee-grid ref and flushes any rows queued for it
  // (edit load resolves before that band's CollapsibleGrid has mounted).
  const registerEmployeeGridRef = useCallback((bandId, el) => {
    employeeGridRefsRef.current[bandId] = el;
    const queued = queuedEmployeesByBandRef.current[bandId];
    if (el && queued?.length) {
      el.loadRows(queued);
      delete queuedEmployeesByBandRef.current[bandId];
      setEmployeeCounts((prev) => ({ ...prev, [bandId]: queued.length }));
    }
  }, []);

  // ── Edit flow ─────────────────────────────────────────────────────────────
  const loadEditRecord = useCallback(async () => {
    // Load-once mutex — set before the first await so a concurrent effect
    // re-run (e.g. a header dropdown resolving mid-load) can't start a second,
    // overlapping edit load.
    editRecordLoadedRef.current = true;
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const params = resolveEditLoadParams(recordId, listRecord, { idFields: ["dopid"] });
      const { master, headerValues, amountDetails, userDetails } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("DOP Master record not found.");

      headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };

      if (headerValues.tranid) {
        // ref_trantype is the tran-type CODE the Entity SP needs (e.g.
        // "PUR_IND"), carried on the master row itself — use it directly so
        // the Entity cascade no longer races the Tran Type dropdown load
        // (fetchHeaderMeta sets tranTypeOptions AFTER headerColumns, so it can
        // still be empty when this edit load runs). Was
        // tranTypeOptions.find(...).code, which silently produced an empty
        // Entity list whenever those options hadn't arrived yet.
        const tranTypeCode = master.ref_trantype ?? headerValues.ref_trantype ?? "";
        await fetchEntityOptions(tranTypeCode, headerValues.divisionid);
      }
      setIsAmountEnabled(Number(headerValues.dopisamountbased) === 1);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      const [amountCols, userCols] = await Promise.all([
        fetchAmountGridColumns(0, { existingRecordEdit: true, masterRow: master, fetchUnlockedDropdowns: false }),
        fetchUserGridColumns(headerValues.divisionid, { existingRecordEdit: true, masterRow: master, fetchUnlockedDropdowns: false }),
      ]);
      if (amountCols?.length > 0) amountColumnsLoadedRef.current = true;
      if (userCols?.length > 0) userColumnsLoadedRef.current = true;

      // Group the flat employee list by its amountid back into per-band lists.
      const employeesByAmountId = {};
      (userDetails || []).forEach((row) => {
        const key = String(row.amountid ?? "");
        (employeesByAmountId[key] ??= []).push(row);
      });

      queuedEmployeesByBandRef.current = {};
      const counts = {};
      const nextEmployeesByBand = {};
      (amountDetails || []).forEach((band) => {
        const rows = employeesByAmountId[String(band.idnumber ?? band.id)] ?? [];
        // Seed via the grid's rows/initialRows prop (below), not a post-mount
        // imperative flush — EntryGrid loads initialRows in its own mount
        // effect, which can't miss the lazy-load window the ref flush did.
        nextEmployeesByBand[band.id] = rows;
        counts[band.id] = rows.length;
      });
      setEmployeesByBand(nextEmployeesByBand);
      setEmployeeCounts(counts);
      setAmountBands(amountDetails || []);
      apiBandIdsRef.current = new Set((amountDetails || []).map((b) => String(b.id)));
    } catch (err) {
      console.error("[DOP] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load DOP Master record.");
    } finally {
      setRecordLoading(false);
    }
    // NB: no longer depends on tranTypeOptions — the Entity code now comes
    // from the master row (ref_trantype), so loadEditRecord stays stable after
    // mount and the edit effect fires exactly once instead of re-running (and
    // re-fetching the whole record) when the Tran Type dropdown resolves.
  }, [recordId, listRecord, fetchEditRecord, fetchEntityOptions, fetchAmountGridColumns, fetchUserGridColumns]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || headerColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, headerColumns.length, loadEditRecord]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode) return;
    fetchAmountGridColumns(0, { existingRecordEdit: true, fetchUnlockedDropdowns: true });
    fetchUserGridColumns(headerValuesRef.current.divisionid, { existingRecordEdit: true, fetchUnlockedDropdowns: true });
  }, [isEditRoute, isEditMode, fetchAmountGridColumns, fetchUserGridColumns]);

  // ── syncedFilters (fully dynamic from API, colseqno-sorted) ───────────────
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    tranid: tranTypeOptions,
    configurationid: entityOptions,
    divisionid: divisionOptions,
    departmentid: departmentOptions,
    companyid: companyOptions,
  }), [tranTypeOptions, entityOptions, divisionOptions, departmentOptions, companyOptions]);

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

  // ── Amount bands: add / remove / edit a field ─────────────────────────────
  const ensureAmountColumns = useCallback(async () => {
    if (amountColumnsLoadedRef.current && amountColumns.length > 0) return amountColumns;
    if (amountAllColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const activeCols = await fetchAmountGridColumns(0);
      if (activeCols?.length > 0) amountColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [amountColumns, amountAllColumns, fetchAmountGridColumns]);

  const ensureUserColumns = useCallback(async () => {
    if (userColumnsLoadedRef.current && userColumns.length > 0) return userColumns;
    if (userAllColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const activeCols = await fetchUserGridColumns(headerValuesRef.current.divisionid);
      if (activeCols?.length > 0) userColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [userColumns, userAllColumns, fetchUserGridColumns]);

  // Applies a confirmed (or confirmation-free) "Is DOP Amount" mode switch —
  // always replaces whatever Amount Detail data currently exists: Yes clears
  // back to empty (user adds bands manually), No provisions exactly ONE
  // locked band with Min/Max fixed at -1 (see handleFilterChange below for
  // the confirmation gate that runs before this when there's data to lose).
  const applyAmountModeChange = useCallback(async (newVal) => {
    headerValuesRef.current.dopisamountbased = newVal;
    setIsAmountEnabled(newVal === 1);

    employeeGridRefsRef.current = {};
    queuedEmployeesByBandRef.current = {};
    apiBandIdsRef.current = new Set();
    setEmployeesByBand({});
    setEmployeeCounts({});
    setEmployeeSearch({});
    setEmployeeMatchCounts({});
    setAmountCellErrors(null);
    setEmployeeCellErrors(null);

    if (newVal === 0) {
      const [activeAmountCols] = await Promise.all([ensureAmountColumns(), ensureUserColumns()]);
      if (!activeAmountCols?.length) { setAmountBands([]); return; }
      const band = { id: nextTempId() };
      amountAllColumns.forEach(({ key, colDataType }) => { band[key] = getColDefault(colDataType); });
      band.minamount = -1;
      band.maxamount = -1;
      setAmountBands([band]);
    } else {
      setAmountBands([]);
    }
  }, [ensureAmountColumns, ensureUserColumns, amountAllColumns]);

  // ── Cascade: Tran Type → Entity / Amount-mode toggle ───────────────────────
  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };
    setFieldErrors((prev) => {
      if (!prev[colName]) return prev;
      const next = { ...prev };
      delete next[colName];
      return next;
    });

    if (colName === "tranid") {
      headerValuesRef.current.configurationid = 0;
      clearEntityOptions();
      if (val && val !== "0") {
        // Entity fetch keys off the Tran Type's code (e.g. "PUR_IND"), not its id.
        const tranTypeCode = tranTypeOptions.find((o) => o.value === String(val))?.code;
        await fetchEntityOptions(tranTypeCode, headerValuesRef.current.divisionid);
        focusFieldAfterCascade(filterPanelRef, "configurationid");
      }
      return;
    }

    if (colName === "divisionid") {
      // Employee Detail's User Name dropdown is division-scoped (@prmDivisionID),
      // but its columns are fetched eagerly on mount — before Division has a
      // real value — and then cached (userColumnsLoadedRef). Without this,
      // ensureUserColumns() would keep serving that stale, divisionid=0
      // fetch forever no matter what the user later picks here. Invalidating
      // the cache on every Division change forces the next Add-Employee-time
      // ensureUserColumns() call to actually refetch with the real value.
      userColumnsLoadedRef.current = false;
      return;
    }

    if (colName === "dopisamountbased") {
      const newVal = Number(val) === 1 ? 1 : 0;
      const currentVal = isAmountEnabled ? 1 : 0;
      if (newVal === currentVal) return;

      // Anything MEANINGFUL on screen to lose? Confirm before discarding it
      // (/pm, 2026-08-20) — but the auto-provisioned pristine -1/-1 band
      // (untouched, no employees) doesn't count: the user never asked for
      // that specific band, it's just the "Is DOP Amount" = No default, so
      // silently replacing it isn't actually discarding anything of theirs.
      const hasMeaningfulAmountData = amountBands.some((band) => {
        const isPristineSentinelBand = Number(band.minamount) === -1 && Number(band.maxamount) === -1;
        const hasEmployees = (employeeGridRefsRef.current[band.id]?.getRows?.() ?? []).length > 0;
        return !isPristineSentinelBand || hasEmployees;
      });
      if (hasMeaningfulAmountData) {
        pendingAmountToggleValueRef.current = newVal;
        headerValuesRef.current.dopisamountbased = currentVal; // hold the ref at its confirmed value until the user decides
        setFilterExternalValues({ dopisamountbased: currentVal }); // snap the toggle back until confirmed
        setAmountToggleConfirmOpen(true);
        return;
      }

      await applyAmountModeChange(newVal);
    }
  }, [clearEntityOptions, fetchEntityOptions, tranTypeOptions, isAmountEnabled, amountBands, applyAmountModeChange]);

  const handleAmountToggleConfirm = useCallback(async () => {
    setAmountToggleConfirmOpen(false);
    const newVal = pendingAmountToggleValueRef.current;
    pendingAmountToggleValueRef.current = null;
    if (newVal == null) return;
    setFilterExternalValues({ dopisamountbased: newVal }); // let the toggle land on the confirmed value
    await applyAmountModeChange(newVal);
  }, [applyAmountModeChange]);

  const handleAmountToggleCancel = useCallback(() => {
    setAmountToggleConfirmOpen(false);
    pendingAmountToggleValueRef.current = null;
    // The toggle was already snapped back to its pre-change value when the
    // dialog opened (see handleFilterChange) — nothing else to revert.
  }, []);

  // A brand-new record starts at "Is DOP Amount" = No (buildDefaultHeaderValues)
  // with zero bands — that's the same state applyAmountModeChange(0) produces,
  // so provision the locked -1/-1 band once the grid columns are ready,
  // without waiting for the user to touch the toggle at all. Edit-loaded
  // records already have their real bands from the API and are excluded.
  useEffect(() => {
    if (isEditRoute || isAmountEnabled || amountBands.length > 0 || amountAllColumns.length === 0) return;
    applyAmountModeChange(0);
  }, [isEditRoute, isAmountEnabled, amountBands.length, amountAllColumns.length, applyAmountModeChange]);

  const handleAddAmountBand = useCallback(async () => {
    if (!isAmountEnabled) return; // "Is DOP Amount" must be Yes before adding amount bands
    const [activeAmountCols] = await Promise.all([ensureAmountColumns(), ensureUserColumns()]);
    if (!activeAmountCols?.length) return;
    const band = { id: nextTempId() };
    amountAllColumns.forEach(({ key, colDataType }) => { band[key] = getColDefault(colDataType); });
    setAmountBands((prev) => [...prev, band]);
  }, [isAmountEnabled, ensureAmountColumns, ensureUserColumns, amountAllColumns]);

  const handleRemoveAmountBand = useCallback((bandId) => {
    setAmountBands((prev) => prev.filter((b) => b.id !== bandId));
    delete employeeGridRefsRef.current[bandId];
    setEmployeeCounts((prev) => {
      const next = { ...prev };
      delete next[bandId];
      return next;
    });
    setEmployeeSearch((prev) => {
      const next = { ...prev };
      delete next[bandId];
      return next;
    });
    setEmployeeMatchCounts((prev) => {
      const next = { ...prev };
      delete next[bandId];
      return next;
    });
  }, []);

  const handleAmountFieldChange = useCallback((bandId, key, value) => {
    setAmountBands((prev) => prev.map((b) => (b.id === bandId ? { ...b, [key]: value } : b)));
    setAmountCellErrors((prev) => {
      if (!prev?.has(`${bandId}:${key}`)) return prev;
      const next = new Map(prev);
      next.delete(`${bandId}:${key}`);
      return next;
    });
  }, []);

  // ── Employee rows within a specific band ──────────────────────────────────
  const handleAddEmployeeToBand = useCallback(async (bandId) => {
    const activeCols = await ensureUserColumns();
    if (!activeCols?.length) return;
    const gridRef = employeeGridRefsRef.current[bandId];
    const row = { id: nextTempId() };
    userAllColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });

    const existingRows = gridRef?.getRows?.() ?? [];
    const maxSrNo = existingRows.reduce((max, r) => Math.max(max, Number(r.srno) || 0), 0);
    row.srno = maxSrNo + DOP_SRNO_STEP;

    if (gridRef) {
      gridRef.addRow(row);
      setEmployeeCounts((prev) => ({ ...prev, [bandId]: (prev[bandId] ?? 0) + 1 }));
    } else {
      (queuedEmployeesByBandRef.current[bandId] ??= []).push(row);
    }
  }, [ensureUserColumns, userAllColumns]);

  const handleDeleteEmployeesFromBand = useCallback((bandId) => {
    const gridRef = employeeGridRefsRef.current[bandId];
    const selected = gridRef?.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    gridRef.removeRows(selected.map((r) => r.id));
    setEmployeeCounts((prev) => ({ ...prev, [bandId]: Math.max(0, (prev[bandId] ?? 0) - selected.length) }));

    // Resequence remaining rows' Sr.No so a mid-list delete doesn't leave a
    // gap — e.g. 50,100,150,200 with 100 deleted becomes 50,100,150, not
    // 50,150,200 (removeRows mutates rowsRef synchronously, so getRows()
    // here already reflects the deletion). Ties are preserved as ties — an
    // "Approving (Other)" row deliberately shares its Sr.No with the
    // "Approving" row (see handleEmployeeRowsChange), so resequencing must
    // remap by Sr.No GROUP, not by row index, or a delete would silently
    // split that pairing apart.
    const remaining = [...(gridRef.getRows?.() ?? [])].sort((a, b) => Number(a.srno) - Number(b.srno));
    const uniqueSrNos = [...new Set(remaining.map((r) => Number(r.srno)))].sort((a, b) => a - b);
    const srNoRemap = new Map(uniqueSrNos.map((oldSrNo, index) => [oldSrNo, (index + 1) * DOP_SRNO_STEP]));
    remaining.forEach((row) => {
      const nextSrNo = srNoRemap.get(Number(row.srno));
      if (Number(row.srno) !== nextSrNo) {
        gridRef.updateRow(row.id, { srno: nextSrNo });
      }
    });
  }, []);

  // Keeps the Employee Detail status chain's invariant live, as the user
  // edits: any row set to "Approving (Other)" automatically takes on the
  // SAME Sr.No as whichever row currently holds "Approving" in this band —
  // Sr.No itself is read-only (DETAIL_GRID_READ_ONLY_COLS), so there's no
  // other way for a user to give two rows a matching Sr.No. If no row holds
  // "Approving" yet, the selection is rejected back to blank (there's
  // nothing valid to match Sr.No against) with a toast explaining why.
  const handleEmployeeRowsChange = useCallback((bandId, rows) => {
    if (isEditRoute && !isEditMode) return; // rowReadOnly — declared later in this component

    // Re-validate live once a failed Save has already flagged cell errors,
    // so fixing a row's cell clears its inline marker immediately instead of
    // only on the next Save click (row ids are unique across every band's
    // grid, so one shared map is safe — merging this band's fresh entries
    // over the previous map without disturbing other bands' entries).
    setEmployeeCellErrors((prev) => {
      if (!prev || prev.size === 0) return prev;
      const { cellErrors: bandCellErrors } = validateGridRowsDetailed(rows, userColumns);
      const next = new Map(prev);
      rows.forEach((row) => {
        userColumns.forEach((col) => {
          if (!col.key || col.key === "cb") return;
          const key = `${row.id}:${col.key}`;
          if (bandCellErrors.has(key)) next.set(key, bandCellErrors.get(key));
          else next.delete(key);
        });
      });
      return next;
    });

    const { approve, approveOther } = userStatusValues;
    if (!approve || !approveOther) return;
    const gridRef = employeeGridRefsRef.current[bandId];
    if (!gridRef) return;

    const approveRow = rows.find((r) => String(r.userstatus ?? "") === approve);
    rows.forEach((row) => {
      if (String(row.userstatus ?? "") !== approveOther) return;
      if (!approveRow) {
        gridRef.updateRow(row.id, { userstatus: "" });
        notify.toastError('Set one employee row to "Approving" first — "Approving (Other)" needs an Approving row to match Sr.No with.');
        return;
      }
      if (String(row.srno ?? "") !== String(approveRow.srno ?? "")) {
        gridRef.updateRow(row.id, { srno: approveRow.srno });
      }
    });
  }, [isEditRoute, isEditMode, userStatusValues, userColumns, notify]);

  const handleEmployeeSearchChange = useCallback((bandId, query) => {
    setEmployeeSearch((prev) => ({ ...prev, [bandId]: query }));
  }, []);

  const handleEmployeeFilteredCountChange = useCallback((bandId, count) => {
    setEmployeeMatchCounts((prev) => (prev[bandId] === count ? prev : { ...prev, [bandId]: count }));
  }, []);

  // ── Reset / discard ────────────────────────────────────────────────────────
  const resetFormToInitialState = useCallback(() => {
    localStorage.removeItem(DOP_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(DOP_CONFIG.STORAGE_AMOUNT_META);
    localStorage.removeItem(DOP_CONFIG.STORAGE_USER_META);
    clearEntityOptions();

    headerValuesRef.current = buildDefaultHeaderValues();
    amountColumnsLoadedRef.current = false;
    userColumnsLoadedRef.current = false;
    employeeGridRefsRef.current = {};
    queuedEmployeesByBandRef.current = {};
    apiBandIdsRef.current = new Set();

    clearSaveError?.();
    setIsGridLoading(false);
    setIsAmountEnabled(false);
    setAmountBands([]);
    setEmployeesByBand({});
    setEmployeeCounts({});
    setEmployeeSearch({});
    setEmployeeMatchCounts({});
    setFieldErrors({});
    setAmountCellErrors(null);
    setEmployeeCellErrors(null);
    setAmountToggleConfirmOpen(false);
    pendingAmountToggleValueRef.current = null;
    // filterResetKey below remounts the panel fresh from initialValues — a
    // stale externalValues object would otherwise still merge into that new
    // instance on its own mount and could override the reset toggle state.
    setFilterExternalValues(null);
    setLoadedFilterValues(null);
    setFilterResetKey((k) => k + 1);
    exitEditMode();
  }, [buildDefaultHeaderValues, clearEntityOptions, clearSaveError, exitEditMode]);

  const discardChanges = useCallback(() => {
    if (isEditRoute) {
      exitEditMode();
      editRecordLoadedRef.current = false;
      loadEditRecord();
      return;
    }
    resetFormToInitialState();
  }, [isEditRoute, exitEditMode, loadEditRecord, resetFormToInitialState]);

  const completeSuccessfulSave = useCallback(() => {
    completeTransactionSave({
      isEditRoute,
      loadEditRecord,
      exitEditMode,
      editRecordLoadedRef,
      resetNewEntry: resetFormToInitialState,
    });
  }, [isEditRoute, loadEditRecord, exitEditMode, resetFormToInitialState]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setFormErrors([]);
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerFieldErrors = validateApiColumnsByField(headerValuesRef.current, headerColsToValidate);

    // srno here is the band's own 1-based position among this record's amount
    // bands — NOT the employee row's own srno (50/100/150 step within a band,
    // see DOP_SRNO_STEP). Sent back to the backend per-employee-row as
    // amountwssrno so it can correlate a Employee Detail row to its Amount
    // Detail band explicitly, instead of relying on array order + blank
    // amountid (client instruction 2026-07-28 — not yet in the MRD; CONFIRM
    // with DBA that a 1-based band position, not a live RB srno column, is
    // what the save proc expects).
    const bandsWithEmployees = amountBands.map((band, index) => ({
      band,
      srno: index + 1,
      employees: employeeGridRefsRef.current[band.id]?.getRows?.() ?? [],
    }));

    // Min/Max Amount may legitimately be negative (business requirement); the
    // RB-configured ValueMinRange/ValueMaxRange on these two columns predates
    // that, so skip only the numeric-range check for them here — mandatory
    // and "must be a valid number" checks still apply.
    const amountColumnsForValidation = amountColumns.map((col) => (
      (col.key === "minamount" || col.key === "maxamount") && col.columnMeta
        ? { ...col, columnMeta: { ...col.columnMeta, valueMinRange: null, valueMaxRange: null } }
        : col
    ));
    const { cellErrors: amountFieldErrors } = validateGridRowsDetailed(amountBands, amountColumnsForValidation);
    const employeeFieldErrors = new Map();
    bandsWithEmployees.forEach(({ employees }) => {
      validateGridRowsDetailed(employees, userColumns).cellErrors.forEach((msg, key) => employeeFieldErrors.set(key, msg));
    });

    // Business rule (not in MRD §6, which was left empty — reasonable default):
    // Min Amount must be less than Max Amount on every Amount Detail row —
    // EXCEPT a Min=-1/Max=-1 band (sentinel for "no amount limit"), which is
    // exempt from this specific check only. All other validation (Employee
    // Detail's Recommend/Approve chain included) still applies to it same as
    // any other band. In practice the only band that ever legitimately has
    // -1/-1 is the single locked band applyAmountModeChange provisions when
    // "Is DOP Amount" = No — see negativeOneErrors just below, which bans -1
    // outright whenever "Is DOP Amount" = Yes.
    // Both checks compare minamount/maxamount against EACH OTHER, so they
    // can't reuse validateGridRowsDetailed's single-column cellErrors above —
    // attached to amountFieldErrors by hand instead, on both fields of the
    // offending band, so they still surface inline next to the Min/Max
    // inputs rather than in the banner (2026-08-21 /pm).
    amountBands
      .filter((r) => !(Number(r.minamount) === -1 && Number(r.maxamount) === -1))
      .filter((r) => Number(r.minamount) >= Number(r.maxamount) && r.maxamount !== "" && r.maxamount != null)
      .forEach((r) => {
        const msg = "Min Amount must be less than Max Amount.";
        amountFieldErrors.set(`${r.id}:minamount`, msg);
        amountFieldErrors.set(`${r.id}:maxamount`, msg);
      });

    // -1 is a reserved sentinel exclusively for the auto-provisioned single
    // band when "Is DOP Amount" = No (/pm, 2026-08-20) — it must never appear
    // in Min or Max Amount, individually, on a normal "Is DOP Amount" = Yes
    // band. (Negative amounts in general are still allowed there — see the
    // ValueMinRange/ValueMaxRange override above — this bans exactly -1.)
    if (isAmountEnabled) {
      amountBands
        .filter((r) => Number(r.minamount) === -1 || Number(r.maxamount) === -1)
        .forEach((r) => {
          const msg = 'Cannot be -1 while "Is DOP Amount" is Yes.';
          if (Number(r.minamount) === -1) amountFieldErrors.set(`${r.id}:minamount`, msg);
          if (Number(r.maxamount) === -1) amountFieldErrors.set(`${r.id}:maxamount`, msg);
        });
    }

    // Employee Detail status chain, enforced independently PER AMOUNT BAND
    // (each band has its own nested Employee Detail grid). Three statuses:
    //   - Recommending — every row that isn't one of the two below.
    //   - Approving — exactly one per band, mandatory, and it must sit on
    //     the band's highest Sr.No (the final approval wave).
    //   - Approving (Other) — zero or more, each sharing that SAME Sr.No —
    //     the "comes after Approving" requirement is expressed as "shares
    //     Approving's Sr.No, which is itself the band's highest" rather than
    //     as a literal grid-row-position check: with Sr.No read-only, a row's
    //     position in the array reflects when it was ADDED, not when its
    //     status was later set, so two employees added in one order can
    //     validly end up Approving/Approving (Other) in the other order once
    //     statuses are assigned (confirmed live — a real false-positive here
    //     during testing 2026-08-20 is why this reads Sr.No, not array index).
    // A band with no employee rows has nothing to validate.
    //
    // ⚠️ Live-verified 2026-08-20 (Playwright) this whole check was DEAD CODE
    // before an earlier fix, on two independent counts: (1) the column's
    // real key is `userstatus`, not `userstatusid` as an old comment here
    // claimed; (2) the live dropdown labels are "Approving"/"Recommending",
    // which `/approve/i` never matched (no "ve" substring in "Approving").
    // userStatusValues (component-level, above) resolves all three current
    // live labels once and is shared with the live auto-Sr.No-match effect.
    const statusErrors = bandsWithEmployees.flatMap(({ employees, srno }) => {
      const { approve, approveOther, recommend } = userStatusValues;
      if (employees.length === 0 || !approve || !approveOther || !recommend) return [];

      const errors = [];
      const approveRows = employees.filter((r) => String(r.userstatus ?? "") === approve);

      if (approveRows.length === 0) {
        errors.push(`Amount Band ${srno}: one employee row must have Approving status.`);
        return errors;
      }
      if (approveRows.length > 1) {
        errors.push(`Amount Band ${srno}: only one employee row can have Approving status — use Approving (Other) for the rest.`);
      }

      const approveSrNo = Number(approveRows[0].srno);
      const maxSrNo = Math.max(...employees.map((row) => Number(row.srno)));
      if (approveSrNo !== maxSrNo) {
        errors.push(`Amount Band ${srno}: the "Approving" row must have the highest Sr.No in the band.`);
      }

      const badApproveOther = employees.some(
        (row) => String(row.userstatus ?? "") === approveOther && Number(row.srno) !== approveSrNo
      );
      if (badApproveOther) {
        errors.push(`Amount Band ${srno}: every "Approving (Other)" row must share the "Approving" row's Sr.No.`);
      }

      const badOther = employees.some((row) => {
        const status = String(row.userstatus ?? "");
        if (status === approve || status === approveOther) return false;
        return status !== recommend || Number(row.srno) === approveSrNo;
      });
      if (badOther) {
        errors.push(`Amount Band ${srno}: every other employee row must have Recommending status.`);
      }

      return errors;
    });

    setFieldErrors(headerFieldErrors);
    setAmountCellErrors(amountFieldErrors);
    setEmployeeCellErrors(employeeFieldErrors);
    // statusErrors are the only genuine banner case left: each one is about
    // an entire band's collection of employee rows (e.g. "no row has
    // Approving status"), not a single field/row to attach an inline marker
    // to — real cross-row business rules, not duplicated required-field text.
    if (
      Object.keys(headerFieldErrors).length > 0
      || amountFieldErrors.size > 0
      || employeeFieldErrors.size > 0
      || statusErrors.length > 0
    ) {
      setFormErrors(statusErrors);
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

    const buildRow = (row, cols, funccode) => {
      const { id, ...rest } = row;
      return buildSaveRowFromColumns(rest, cols, {
        funccode,
        loginid: getUserSession().loginId,
      });
    };

    // Two flat parallel arrays — confirmed live 2026-07-27. New employee rows
    // carry a blank amountid; both sides also carry amountwssrno (the band's
    // own 1-based position — see bandsWithEmployees above): amountwssrno IS a
    // live rb_wkf_dopamountdet column (confirmed live 2026-07-28 — it comes
    // back from GetDetailColData and defaults to 0 via getColDefault if left
    // unset, which is what was happening before this fix), so the amount
    // band's own row needs its real srno, not just the employee rows that
    // reference it.
    const amountDetRows = bandsWithEmployees.map(({ band, srno }) => ({
      ...buildRow(band, amountAllColumns, DOP_CONFIG.RB_AMOUNT_DETAIL),
      amountwssrno: srno,
    }));
    const userDetRows = bandsWithEmployees.flatMap(({ employees, srno }) =>
      employees.map((emp) => ({
        ...buildRow(emp, userAllColumns, DOP_CONFIG.RB_USER_DETAIL),
        amountwssrno: srno,
      }))
    );

    const payload = withSaveContextFields(
      buildSaveJsonFields({
        label: DOP_CONFIG.FORM_TAG,
        mst: mstRow,
        extra: {
          prmStrAmtJSON: JSON.stringify(amountDetRows),
          prmStrUserJSON: JSON.stringify(userDetRows),
        },
      }),
      // hv.divisionid — the header's actual selected Division — not a
      // hardcoded 0 (2026-08-12 fix; same pattern as CWIPToFAForm.jsx's
      // `{ divisionId: hv.divisionid, isEdit }`).
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(DOP_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
      completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[DOP Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [headerColumns, amountBands, amountColumns, userColumns, userStatusValues, amountAllColumns, userAllColumns, isAmountEnabled, isEditRoute, completeSuccessfulSave, postSave, notify]);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    discardChanges();
  }, [discardChanges]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = headerFetching;

  useEntryFormKeyboard({
    blocked: false,
    isEditMode,
    isSaving,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onCancel: handleCancel,
    onSelectList: handleAddAmountBand,
  });

  const extraButtons = useMemo(() => [
    {
      key: "save", label: isSaving ? "Saving…" : "Save", Icon: Save, variant: "save",
      onClick: handleSave, disabled: isSaving, loading: isSaving,
      accessKey: "s", title: FORM_SHORTCUT_TITLES.save,
    },
  ], [handleSave, isSaving]);

  const minAmountLabel = amountColumns.find((c) => c.key === "minamount")?.name ?? "Min Amount";
  const maxAmountLabel = amountColumns.find((c) => c.key === "maxamount")?.name ?? "Max Amount";
  const minAmountColumnMeta = amountColumns.find((c) => c.key === "minamount")?.columnMeta ?? null;
  const maxAmountColumnMeta = amountColumns.find((c) => c.key === "maxamount")?.columnMeta ?? null;
  const employeeCardColumns = userColumns;
  const combinedError = amountMetaError || userMetaError || headerError;
  const rowReadOnly = isEditRoute && !isEditMode;

  return (
    <div className="workspace-page dop-page">
      <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
      <ConfirmDialog
        isOpen={discardOpen}
        message="Discard changes and reset the form?"
        onConfirm={handleDiscardConfirm}
        onCancel={() => setDiscardOpen(false)}
      />
      <ConfirmDialog
        isOpen={amountToggleConfirmOpen}
        message='Switching "Is DOP Amount" will discard the existing Amount Detail data (bands and employees) on screen. Continue?'
        onConfirm={handleAmountToggleConfirm}
        onCancel={handleAmountToggleCancel}
      />

      <section className="workspace-page__filters">
        {combinedError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{combinedError}</span>
            <button type="button" onClick={() => { fetchHeaderMeta(); fetchAmountDetailMeta(); fetchUserDetailMeta(); }}>Retry</button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            panelRef={filterPanelRef}
            title="DOP Master Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            externalValues={filterExternalValues}
            cascadeResets={DOP_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            isSearching={filterBusy || recordLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterBusy || !headerMetaReady}
            fieldTones={filterFieldTones}
            fieldErrors={fieldErrors}
            onLastFieldTabForward={isEditMode ? focusAddAmountBandButton : null}
          />
        )}
      </section>

      {/* ── Amount bands, each with its own nested Employee Detail ─────────── */}
      <section className="dop-bands-section">
        <div className="dop-bands-section__header">
          <span className="dop-bands-section__title">Amount Detail</span>
          {/* "Is DOP Amount" = No means exactly one locked band and nothing
              else to add — the button isn't just disabled, it's not needed
              at all (/pm, 2026-08-20). */}
          {isAmountEnabled && (
            <button
              ref={addAmountBandBtnRef}
              type="button"
              className="eg-tab-btn"
              onClick={handleAddAmountBand}
              disabled={!isEditMode || isGridLoading}
              title="Add a new amount based"
            >
              <PlusCircle size={12} strokeWidth={2.5} />
              Add Amount Based
            </button>
          )}
        </div>

        {amountBands.length === 0 ? (
          <div className="dop-bands-empty">
            {isAmountEnabled ? "No amount based yet. Click Add Amount based above." : "Loading…"}
          </div>
        ) : (
          amountBands.map((band) => (
            <div key={band.id} className="dop-band-card">
              <div className="dop-band-card__employees">
                <CollapsibleGrid
                  ref={(el) => registerEmployeeGridRef(band.id, el)}
                  variant="panel"
                  title="Employee Detail"
                  recordLabel="employee"
                  defaultExpanded
                  columns={employeeCardColumns}
                  rows={employeesByBand[band.id] ?? EMPTY_ROWS}
                  hidePagination
                  hideBottomPanel
                  searchable={false}
                  externalSearchQuery={employeeSearch[band.id] ?? ""}
                  onFilteredCountChange={(count) => handleEmployeeFilteredCountChange(band.id, count)}
                  onRowsChange={(rows) => handleEmployeeRowsChange(band.id, rows)}
                  emptyMessage="No employees yet. Click Add Employee below."
                  readOnly={rowReadOnly}
                  existingRecordEdit={isEditRoute && isEditMode}
                  cellErrors={employeeCellErrors}
                  headerActions={
                    <>
                      {(() => {
                        const minAmountError = amountCellErrors?.get(`${band.id}:minamount`);
                        const maxAmountError = amountCellErrors?.get(`${band.id}:maxamount`);
                        return (
                          <>
                            <label className="dop-band-card__field dop-band-card__field--compact">
                              <span>{minAmountLabel}</span>
                              <Suspense fallback={<input className="dop-band-card__field-input" disabled />}>
                                <GridNumberInput
                                  className={`dop-band-card__field-input${minAmountError ? " dop-band-card__field-input--error" : ""}`}
                                  value={band.minamount}
                                  columnMeta={minAmountColumnMeta}
                                  disabled={rowReadOnly || !isEditMode || !isAmountEnabled}
                                  ariaLabel={minAmountLabel}
                                  title={minAmountError || undefined}
                                  onChange={(val) => handleAmountFieldChange(band.id, "minamount", val)}
                                />
                              </Suspense>
                            </label>
                            <label className="dop-band-card__field dop-band-card__field--compact">
                              <span>{maxAmountLabel}</span>
                              <Suspense fallback={<input className="dop-band-card__field-input" disabled />}>
                                <GridNumberInput
                                  className={`dop-band-card__field-input${maxAmountError ? " dop-band-card__field-input--error" : ""}`}
                                  value={band.maxamount}
                                  columnMeta={maxAmountColumnMeta}
                                  disabled={rowReadOnly || !isEditMode || !isAmountEnabled}
                                  ariaLabel={maxAmountLabel}
                                  title={maxAmountError || undefined}
                                  onChange={(val) => handleAmountFieldChange(band.id, "maxamount", val)}
                                />
                              </Suspense>
                            </label>
                          </>
                        );
                      })()}
                      <GridSearch
                        query={employeeSearch[band.id] ?? ""}
                        onChange={(q) => handleEmployeeSearchChange(band.id, q)}
                        matchCount={employeeMatchCounts[band.id] ?? employeeCounts[band.id] ?? 0}
                        totalCount={employeeCounts[band.id] ?? 0}
                      />
                      <span className="dop-band-card__employee-count">
                        {employeeCounts[band.id] ?? 0} employee{(employeeCounts[band.id] ?? 0) === 1 ? "" : "s"}
                      </span>
                      <button
                        type="button"
                        className="eg-tab-btn"
                        onClick={() => handleAddEmployeeToBand(band.id)}
                        disabled={!isEditMode || isGridLoading}
                        title="Add a new employee row to this band"
                      >
                        <PlusCircle size={12} strokeWidth={2.5} />
                        Add Employee
                      </button>
                      <button
                        type="button"
                        className="eg-tab-btn eg-tab-btn--danger"
                        onClick={() => handleDeleteEmployeesFromBand(band.id)}
                        disabled={!isEditMode}
                        title="Delete selected employee rows"
                      >
                        <Trash2 size={12} strokeWidth={2} />
                        Delete
                      </button>
                      {/* Amount-band removal is only offered for bands added
                          during THIS session (temp id, not yet saved) — bands
                          loaded from the API on edit are locked from removal
                          here. Also hidden entirely when "Is DOP Amount" = No
                          — that single band is fixed, not user-removable. */}
                      {isAmountEnabled && isEditMode && !rowReadOnly && !apiBandIdsRef.current.has(String(band.id)) && (
                        <button
                          type="button"
                          className="dop-band-card__remove"
                          onClick={() => handleRemoveAmountBand(band.id)}
                          title="Remove this amount band"
                        >
                          <X size={14} strokeWidth={2.5} />
                        </button>
                      )}
                    </>
                  }
                />
              </div>
            </div>
          ))
        )}
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
