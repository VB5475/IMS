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
// payload sends TWO FLAT parallel arrays (prmStrAmountDetJSON /
// prmStrUserDetailJSON), not nested employees-inside-amount objects. New
// (unsaved) employee rows carry a blank `amountid` — the backend does the
// band correlation itself, not the client.
//
// See ./constants.js for the full list of other MRD gaps/assumptions.

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Save, PlusCircle, X } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import CollapsibleGrid from "../../components/grid/CollapsibleGrid";
const GridNumberInput = lazy(() => import("../../components/grid/GridNumberInput"));
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
import { useDopMaster } from "../../hooks/useDopMaster";
import { useApi } from "../../api/useApi";
import { API_BASE_URL, API_BASE_URL_IMS, getColDefault } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { isLockOnEditModeCol, isTruthyApiFlag, syncHeaderFilterWithApiCol } from "../../utils/gridUtils";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { focusFieldAfterCascade } from "../../utils/focusUtils";
import { queryEditableFilterFields, resolveEditLoadParams } from "../../utils/txnFormUtils";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  DOP_CONFIG,
  DOP_FILTER_CASCADE_RESETS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
} from "./constants";
// .eg-tab-btn (Add Amount Band / Add Employee / Delete) lives in EntryGrid.css,
// which normally loads for free via a direct <EntryGrid> import — but here
// EntryGrid is only reached lazily, through CollapsibleGrid, so with zero
// bands mounted (or before a band's grid finishes loading) that CSS chunk
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
  const [formErrors, setFormErrors] = useState([]);
  const navigate = useNavigate();

  const filterPanelRef = useRef(null);
  const addAmountBandBtnRef = useRef(null);
  const amountColumnsLoadedRef = useRef(false);
  const userColumnsLoadedRef = useRef(false);
  // bandId -> CollapsibleGrid ref (imperative addRow/getRows/removeRows/loadRows)
  const employeeGridRefsRef = useRef({});
  // bandId -> employee rows waiting for their card's grid ref to mount (edit load)
  const queuedEmployeesByBandRef = useRef({});

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    tranTypeOptions, entityOptions, departmentOptions, companyOptions,
    fetchEntityOptions, clearEntityOptions,
    amountColumns, amountAllColumns, amountFetching, amountMetaError,
    fetchAmountDetailMeta, fetchAmountGridColumns,
    userColumns, userAllColumns, userFetching, userMetaError,
    fetchUserDetailMeta, fetchUserGridColumns,
    fetchEditRecord, clearSaveError,
  } = useDopMaster(API_BASE_URL);

  const { post: postSave } = useApi(API_BASE_URL_IMS);

  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  const buildDefaultHeaderValues = useCallback(() => ({
    trancode: "",
    tranid: 0,
    configurationid: 0,
    departmentid: 0,
    companyid: 0,
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
  // whether amount bands can be added at all.
  const [isAmountEnabled, setIsAmountEnabled] = useState(false);
  // Amount bands themselves — each { id, minamount, maxamount, ...defaults }.
  const [amountBands, setAmountBands] = useState([]);
  // bandId -> employee row count, for each card's badge (the actual row DATA
  // lives uncontrolled inside that band's CollapsibleGrid, not in this state).
  const [employeeCounts, setEmployeeCounts] = useState({});

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
    fetchUserGridColumns(0).then((cols) => {
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
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const params = resolveEditLoadParams(recordId, listRecord, { idFields: ["dopid"] });
      const { master, headerValues, amountDetails, userDetails } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("DOP Master record not found.");

      headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };
      editRecordLoadedRef.current = true;

      if (headerValues.tranid) {
        const tranTypeCode = tranTypeOptions.find((o) => o.value === String(headerValues.tranid))?.code;
        await fetchEntityOptions(tranTypeCode);
      }
      setIsAmountEnabled(Number(headerValues.dopisamountbased) === 1);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      const [amountCols, userCols] = await Promise.all([
        fetchAmountGridColumns(0, { existingRecordEdit: true, masterRow: master, fetchUnlockedDropdowns: false }),
        fetchUserGridColumns(0, { existingRecordEdit: true, masterRow: master, fetchUnlockedDropdowns: false }),
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
      (amountDetails || []).forEach((band) => {
        const rows = employeesByAmountId[String(band.idnumber ?? band.id)] ?? [];
        queuedEmployeesByBandRef.current[band.id] = rows;
        counts[band.id] = rows.length;
      });
      setEmployeeCounts(counts);
      setAmountBands(amountDetails || []);
      // registerEmployeeGridRef flushes queued rows as each band's grid mounts.
    } catch (err) {
      console.error("[DOP] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load DOP Master record.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, listRecord, fetchEditRecord, fetchEntityOptions, fetchAmountGridColumns, fetchUserGridColumns, tranTypeOptions]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || headerColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, headerColumns.length, loadEditRecord]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode) return;
    fetchAmountGridColumns(0, { existingRecordEdit: true, fetchUnlockedDropdowns: true });
    fetchUserGridColumns(0, { existingRecordEdit: true, fetchUnlockedDropdowns: true });
  }, [isEditRoute, isEditMode, fetchAmountGridColumns, fetchUserGridColumns]);

  // ── syncedFilters (fully dynamic from API, colseqno-sorted) ───────────────
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    tranid: tranTypeOptions,
    configurationid: entityOptions,
    departmentid: departmentOptions,
    companyid: companyOptions,
  }), [tranTypeOptions, entityOptions, departmentOptions, companyOptions]);

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

  // ── Cascade: Tran Type → Entity ────────────────────────────────────────────
  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

    if (colName === "tranid") {
      headerValuesRef.current.configurationid = 0;
      clearEntityOptions();
      if (val && val !== "0") {
        // Entity fetch keys off the Tran Type's code (e.g. "PUR_IND"), not its id.
        const tranTypeCode = tranTypeOptions.find((o) => o.value === String(val))?.code;
        await fetchEntityOptions(tranTypeCode);
        focusFieldAfterCascade(filterPanelRef, "configurationid");
      }
      return;
    }

    if (colName === "dopisamountbased") {
      setIsAmountEnabled(Number(val) === 1);
    }
  }, [clearEntityOptions, fetchEntityOptions, tranTypeOptions]);

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
      const activeCols = await fetchUserGridColumns(0);
      if (activeCols?.length > 0) userColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [userColumns, userAllColumns, fetchUserGridColumns]);

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
  }, []);

  const handleAmountFieldChange = useCallback((bandId, key, value) => {
    setAmountBands((prev) => prev.map((b) => (b.id === bandId ? { ...b, [key]: value } : b)));
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

    clearSaveError?.();
    setIsGridLoading(false);
    setIsAmountEnabled(false);
    setAmountBands([]);
    setEmployeeCounts({});
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
    if (isEditRoute) navigate(DOP_CONFIG.ROUTE_PATH);
    else resetFormToInitialState();
  }, [isEditRoute, navigate, resetFormToInitialState]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setFormErrors([]);
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrors = validateApiColumns(headerValuesRef.current, headerColsToValidate);

    const bandsWithEmployees = amountBands.map((band) => ({
      band,
      employees: employeeGridRefsRef.current[band.id]?.getRows?.() ?? [],
    }));

    const amountErrors = validateGridRows(amountBands, amountColumns);
    const employeeErrors = bandsWithEmployees.flatMap(({ employees }) => validateGridRows(employees, userColumns));

    // Business rule (not in MRD §6, which was left empty — reasonable default):
    // Min Amount must be less than Max Amount on every Amount Detail row.
    const rangeErrors = amountBands
      .filter((r) => Number(r.minamount) >= Number(r.maxamount) && r.maxamount !== "" && r.maxamount != null)
      .map(() => "Min Amount must be less than Max Amount on every Amount Detail row.");

    // Employee Detail: Recommend can repeat within a band, but Approve may
    // appear on at most one row PER BAND, and that row must be the LAST one
    // (highest Sr.No) — recommenders precede the approver in the chain.
    // (colname confirmed live: userstatusid — numeric FK into wkf_userstatus,
    // NOT a hardcoded "R"/"A" string. The actual Approve value is read off
    // the column's own live dropdown options by label, so it stays correct
    // even if the numeric codes differ across environments.)
    const userStatusApproveValue = userColumns
      .find((c) => c.key === "userstatusid")
      ?.dropdownOptions?.find((o) => /approve/i.test(o.label))?.value;
    const statusErrors = bandsWithEmployees.flatMap(({ employees }) => {
      const approveRows = userStatusApproveValue
        ? employees.filter((r) => String(r.userstatusid ?? "") === userStatusApproveValue)
        : [];
      if (approveRows.length === 0) return [];
      if (approveRows.length > 1) {
        return ["Only one employee can have Approve status per amount band — use Recommend for the others."];
      }
      const lastRow = [...employees].sort((a, b) => Number(a.srno) - Number(b.srno)).at(-1);
      if (lastRow && lastRow.id !== approveRows[0].id) {
        return ["The Approve status must be on the last employee row (highest Sr.No) in each amount band."];
      }
      return [];
    });

    const allErrors = [...headerErrors, ...amountErrors, ...employeeErrors, ...rangeErrors, ...statusErrors];
    if (allErrors.length > 0) { setFormErrors(allErrors); return false; }

    const mstRow = {};
    headerColumns.forEach((col) => { mstRow[col.colname] = getColDefault(col.coldatatype); });
    const hv = headerValuesRef.current;
    Object.entries(hv).forEach(([k, v]) => { if (k !== "id") mstRow[k] = v; });
    mstRow.loginid = getUserSession().loginId;

    const buildRow = (row, cols, funccode) => {
      const { id, ...rest } = row;
      const out = {};
      cols.forEach(({ key, colDataType }) => { out[key] = getColDefault(colDataType); });
      return { ...out, ...rest, funccode, loginid: getUserSession().loginId };
    };

    // Two flat parallel arrays — confirmed live 2026-07-27. New employee rows
    // carry a blank amountid; the backend does the band correlation itself.
    const amountDetRows = amountBands.map((band) => buildRow(band, amountAllColumns, DOP_CONFIG.RB_AMOUNT_DETAIL));
    const userDetRows = bandsWithEmployees.flatMap(({ employees }) =>
      employees.map((emp) => buildRow(emp, userAllColumns, DOP_CONFIG.RB_USER_DETAIL))
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
      { divisionId: 0, isEdit: isEditRoute }
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
  }, [headerColumns, amountBands, amountColumns, userColumns, amountAllColumns, userAllColumns, isEditRoute, completeSuccessfulSave, postSave, notify]);

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
    <div className="workspace-page workspace-page--fill dop-page">
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
            <button type="button" onClick={() => { fetchHeaderMeta(); fetchAmountDetailMeta(); fetchUserDetailMeta(); }}>Retry</button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            panelRef={filterPanelRef}
            title="DOP Master Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={DOP_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            isSearching={filterBusy || recordLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterBusy || !headerMetaReady}
            fieldTones={filterFieldTones}
            onLastFieldTabForward={isEditMode ? focusAddAmountBandButton : null}
          />
        )}
      </section>

      {/* ── Amount bands, each with its own nested Employee Detail ─────────── */}
      <section className="dop-bands-section">
        <div className="dop-bands-section__header">
          <span className="dop-bands-section__title">Amount Detail</span>
          <button
            ref={addAmountBandBtnRef}
            type="button"
            className="eg-tab-btn"
            onClick={handleAddAmountBand}
            disabled={!isEditMode || isGridLoading || !isAmountEnabled}
            title={isAmountEnabled ? "Add a new amount band" : "Enable “Is DOP Amount” to add amount bands"}
          >
            <PlusCircle size={12} strokeWidth={2.5} />
            Add Amount Band
          </button>
        </div>

        {amountBands.length === 0 ? (
          <div className="dop-bands-empty">No amount bands yet. Click Add Amount Band above.</div>
        ) : (
          amountBands.map((band) => (
            <div key={band.id} className="dop-band-card">
              <div className="dop-band-card__fields">
                <label className="dop-band-card__field">
                  <span>{minAmountLabel}</span>
                  <Suspense fallback={<input className="dop-band-card__field-input" disabled />}>
                    <GridNumberInput
                      className="dop-band-card__field-input"
                      value={band.minamount}
                      columnMeta={minAmountColumnMeta}
                      disabled={rowReadOnly || !isEditMode}
                      ariaLabel={minAmountLabel}
                      onChange={(val) => handleAmountFieldChange(band.id, "minamount", val)}
                    />
                  </Suspense>
                </label>
                <label className="dop-band-card__field">
                  <span>{maxAmountLabel}</span>
                  <Suspense fallback={<input className="dop-band-card__field-input" disabled />}>
                    <GridNumberInput
                      className="dop-band-card__field-input"
                      value={band.maxamount}
                      columnMeta={maxAmountColumnMeta}
                      disabled={rowReadOnly || !isEditMode}
                      ariaLabel={maxAmountLabel}
                      onChange={(val) => handleAmountFieldChange(band.id, "maxamount", val)}
                    />
                  </Suspense>
                </label>
                {isEditMode && !rowReadOnly && (
                  <button
                    type="button"
                    className="dop-band-card__remove"
                    onClick={() => handleRemoveAmountBand(band.id)}
                    title="Remove this amount band"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                )}
              </div>

              <div className="dop-band-card__employees">
                <CollapsibleGrid
                  ref={(el) => registerEmployeeGridRef(band.id, el)}
                  variant="panel"
                  title="Employee Detail"
                  recordLabel="employee"
                  defaultExpanded
                  columns={employeeCardColumns}
                  rows={EMPTY_ROWS}
                  hidePagination
                  hideBottomPanel
                  emptyMessage="No employees yet. Click Add Employee below."
                  readOnly={rowReadOnly}
                  existingRecordEdit={isEditRoute && isEditMode}
                />
                <div className="dop-band-card__employee-actions">
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
                </div>
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
