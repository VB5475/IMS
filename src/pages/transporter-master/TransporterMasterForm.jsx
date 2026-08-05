// TransporterMasterForm.jsx — Transporter Master entry form (Add / Edit).
//
// First master module in this app with BOTH a header panel AND a detail
// grid — modeled on DOP Master's structure (the only other master with a
// detail grid, src/pages/dop-master/DopMasterForm.jsx), including its
// header pattern: EnterpriseFilterPanel driven by an uncontrolled
// headerValuesRef, not the MasterFormField-row pattern Location/Division
// Master use for their compact Add/Edit modals. User-confirmed 2026-08-03:
// a full-page form with a detail grid belongs with the transaction-form/DOP
// pattern, not the modal-master pattern (an earlier pass here wrongly used
// the modal-master "frozen label" row styling before this correction).
//
// See ./constants.js for the full list of MRD gaps/assumptions this form
// proceeds on (SP_LIST name conflict, non-standard save payload key, etc.)
// — all flagged CONFIRM, not silently guessed past.

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Save, PlusCircle, Trash2, AlertCircle } from "lucide-react";
import EntryGrid from "../../components/grid/EntryGrid";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
import { useTransporterMaster } from "../../hooks/useTransporterMaster";
import { useApi } from "../../api/useApi";
import { API_BASE_URL, API_BASE_URL_IMS, DEFAULT_SESSION_ID, getColDefault, buildSaveRowFromColumns } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { isLockOnEditModeCol, isTruthyApiFlag, syncHeaderFilterWithApiCol } from "../../utils/gridUtils";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { TM_CONFIG, PAGE_TITLE, PAGE_TITLE_NEW } from "./constants";
// EntryGrid.css normally loads for free via a direct <EntryGrid> import —
// imported explicitly here too since it's reached directly, not lazily.
import "../../components/grid/EntryGrid.css";
import "./TransporterMasterPage.css";

let _tmTempId = -1;
const nextTempId = () => _tmTempId--;

/** headerValues (real colname keys) → EnterpriseFilterPanel's flat values
 *  shape. No cascades/dropdowns on this header (unlike DOP's Tran Type →
 *  Entity), so this is a generic per-column pass rather than DOP's
 *  hand-written per-field mapper. */
function mapHeaderValuesToFilterValues(headerValues, allColumns) {
  if (!headerValues) return null;
  const out = {};
  allColumns.forEach(({ key, colDataType }) => {
    const raw = headerValues[key];
    const isNumeric = colDataType && /numeric|int|float|decimal/i.test(colDataType);
    out[key] = isNumeric ? Number(raw) || 0 : (raw ?? "");
  });
  return out;
}

export default function TransporterMasterForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const notify = useNotification();
  const navigate = useNavigate();

  const [formErrors, setFormErrors] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [detailRowCount, setDetailRowCount] = useState(0);

  // Header values are uncontrolled (like DOP Master) — EnterpriseFilterPanel
  // owns its own input state internally and reports changes via
  // onFilterChange; loadedFilterValues/filterResetKey below is how we push
  // real defaults/edit-loaded values INTO it (remount via key).
  const headerValuesRef = useRef({});
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [filterResetKey, setFilterResetKey] = useState(0);

  const detailGridRef = useRef(null);
  const detailColumnsLoadedRef = useRef(false);
  const editRecordLoadedRef = useRef(false);
  const queuedDetailRowsRef = useRef(null);
  const addDetailBtnRef = useRef(null);

  const {
    headerColumns, headerAllColumns, headerFetching, headerError, fetchHeaderMeta,
    detailColumns, detailAllColumns, detailFetching, detailMetaError,
    fetchDetailMeta, fetchGridColumns,
    fetchEditRecord,
  } = useTransporterMaster(API_BASE_URL);

  const { post: postSave } = useApi(API_BASE_URL_IMS);

  const buildDefaultHeaderValues = useCallback(() => {
    const session = getUserSession();
    const row = {};
    headerAllColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
    return {
      ...row,
      companyid: session.companyId,
      yearid: session.yearId,
      loginid: session.loginId,
      funccode: TM_CONFIG.RB_MASTER,
    };
  }, [headerAllColumns]);

  usePageHeader({
    title: isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then add Transporter Detail rows."
      : recordLoading
        ? "Loading record…"
        : recordLoadError
          ? recordLoadError
          : `Transporter #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: TM_CONFIG.ROUTE_PATH,
  });

  // ── Mount: load metadata ────────────────────────────────────────────────
  useEffect(() => {
    fetchHeaderMeta();
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta]);

  // Seed defaults once header metadata is ready (Add mode only — Edit mode
  // overlays real values on top once the record loads, below). Bumping
  // filterResetKey remounts EnterpriseFilterPanel so it picks up the real
  // defaults instead of the empty {} it mounted with before metadata arrived.
  useEffect(() => {
    if (isEditRoute || headerAllColumns.length === 0) return;
    headerValuesRef.current = buildDefaultHeaderValues();
    setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValuesRef.current, headerAllColumns));
    setFilterResetKey((k) => k + 1);
  }, [isEditRoute, headerAllColumns, buildDefaultHeaderValues]);

  // Eager detail-grid column load for new records (Edit records load columns
  // as part of loadEditRecord below, with existingRecordEdit lock context).
  useEffect(() => {
    if (detailAllColumns.length === 0 || detailColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(0).then((cols) => {
      if (cols?.length > 0) detailColumnsLoadedRef.current = true;
    });
  }, [detailAllColumns, fetchGridColumns, isEditRoute]);

  // ── Edit flow ────────────────────────────────────────────────────────────
  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const session = getUserSession();
      const { master, headerValues, detailRows } = await fetchEditRecord({
        companyId: session.companyId,
        yearId: session.yearId,
        loginId: session.loginId,
        sessionId: DEFAULT_SESSION_ID,
        idNumber: recordId,
      });
      if (!master || !headerValues) throw new Error("Transporter Master record not found.");

      editRecordLoadedRef.current = true;
      headerValuesRef.current = { ...buildDefaultHeaderValues(), ...headerValues };
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValuesRef.current, headerAllColumns));
      setFilterResetKey((k) => k + 1);

      const cols = await fetchGridColumns(0, { existingRecordEdit: true, masterRow: master, fetchUnlockedDropdowns: false });
      if (cols?.length > 0) detailColumnsLoadedRef.current = true;

      if (detailGridRef.current) {
        detailGridRef.current.loadRows(detailRows);
        setDetailRowCount(detailRows.length);
      } else {
        queuedDetailRowsRef.current = detailRows;
      }
    } catch (err) {
      console.error("[TM] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load Transporter Master record.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, fetchEditRecord, fetchGridColumns, buildDefaultHeaderValues, headerAllColumns]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || headerColumns.length === 0 || detailAllColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, headerColumns.length, detailAllColumns.length, loadEditRecord]);

  // Flush detail rows queued while waiting for the grid to mount.
  const registerDetailGridRef = useCallback((el) => {
    detailGridRef.current = el;
    if (el && queuedDetailRowsRef.current) {
      el.loadRows(queuedDetailRowsRef.current);
      setDetailRowCount(queuedDetailRowsRef.current.length);
      queuedDetailRowsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isEditRoute || !isEditMode) return;
    fetchGridColumns(0, { existingRecordEdit: true, fetchUnlockedDropdowns: true });
  }, [isEditRoute, isEditMode, fetchGridColumns]);

  // ── Header field change (uncontrolled — EnterpriseFilterPanel reports,
  // we just record it) ────────────────────────────────────────────────────
  const handleFilterChange = useCallback((colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };
  }, []);

  const visibleHeaderFields = useMemo(() =>
    headerColumns
      .filter((f) => f.isvisible)
      .sort((a, b) => Number(a.colseqno) - Number(b.colseqno)),
  [headerColumns]);

  // syncedFilters/filterFieldTones — same pattern as DOP Master's header.
  // No dropdowns/cascades on this header (all 9 fields are Text/Checkbox
  // per the MRD), so this is simpler than DOP's Tran Type → Entity setup.
  const syncedFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];
    return headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible))
      .sort((a, b) => Number(a.colseqno) - Number(b.colseqno))
      .map((col) => {
        const lockOnEditMode = isLockOnEditModeCol(col);
        const base = {
          FilterParameterID: col.colname,
          FilterColName: col.colname,
          FilterCaption: col.displayname ?? col.colname,
          FilterColCtrlType: col.colctrltype ?? 0,
        };
        return syncHeaderFilterWithApiCol(base, col, { lockOnEditMode });
      });
  }, [headerColumns]);

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

  const filterInitialValues = useMemo(() => loadedFilterValues ?? {}, [loadedFilterValues]);

  // ── Detail grid rows ─────────────────────────────────────────────────────
  const ensureDetailColumns = useCallback(async () => {
    if (detailColumnsLoadedRef.current && detailColumns.length > 0) return detailColumns;
    if (detailAllColumns.length === 0) return [];
    const cols = await fetchGridColumns(0);
    if (cols?.length > 0) detailColumnsLoadedRef.current = true;
    return cols;
  }, [detailColumns, detailAllColumns, fetchGridColumns]);

  const handleAddDetailRow = useCallback(async () => {
    const cols = await ensureDetailColumns();
    if (!cols?.length) return;
    const row = { id: nextTempId() };
    detailAllColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
    detailGridRef.current?.addRow(row);
    setDetailRowCount((n) => n + 1);
  }, [ensureDetailColumns, detailAllColumns]);

  const handleDeleteDetailRows = useCallback(() => {
    const selected = detailGridRef.current?.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    detailGridRef.current.removeRows(selected.map((r) => r.id));
    setDetailRowCount((n) => Math.max(0, n - selected.length));
  }, []);

  // ── Reset / discard ──────────────────────────────────────────────────────
  const resetFormToInitialState = useCallback(() => {
    headerValuesRef.current = buildDefaultHeaderValues();
    setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValuesRef.current, headerAllColumns));
    setFilterResetKey((k) => k + 1);
    detailGridRef.current?.clearRows();
    setDetailRowCount(0);
    setFormErrors([]);
    setIsEditMode(false);
  }, [buildDefaultHeaderValues, headerAllColumns]);

  const discardChanges = useCallback(() => {
    if (isEditRoute) {
      setIsEditMode(false);
      editRecordLoadedRef.current = false;
      loadEditRecord();
      return;
    }
    resetFormToInitialState();
  }, [isEditRoute, loadEditRecord, resetFormToInitialState]);

  const completeSuccessfulSave = useCallback(() => {
    if (isEditRoute) navigate(TM_CONFIG.ROUTE_PATH);
    else resetFormToInitialState();
  }, [isEditRoute, navigate, resetFormToInitialState]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setFormErrors([]);
    const headerErrors = validateApiColumns(headerValuesRef.current, visibleHeaderFields);
    const detailRows = detailGridRef.current?.getRows?.() ?? [];
    const detailErrors = validateGridRows(detailRows, detailColumns);

    const allErrors = [...headerErrors, ...detailErrors];
    if (allErrors.length > 0) { setFormErrors(allErrors); return; }

    const mstRow = buildSaveRowFromColumns(headerValuesRef.current, headerAllColumns);

    // buildSaveRowFromColumns strips the internal `id` field itself.
    const detRows = detailRows.map((row) =>
      buildSaveRowFromColumns(row, detailAllColumns, { funccode: TM_CONFIG.RB_DETAIL })
    );

    const payload = withSaveContextFields(
      buildSaveJsonFields({
        label: TM_CONFIG.FORM_TAG,
        mst: mstRow,
        extra: { [TM_CONFIG.SAVE_DETAIL_JSON_KEY]: JSON.stringify(detRows) },
      }),
      { divisionId: 0, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(TM_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return; }
      notify.success(message || "Transporter saved successfully.");
      completeSuccessfulSave();
    } catch (err) {
      console.error("[TM Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [visibleHeaderFields, detailColumns, headerAllColumns, detailAllColumns, isEditRoute, postSave, notify, completeSuccessfulSave]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);
  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    discardChanges();
  }, [discardChanges]);

  const enterEditMode = useCallback(() => setIsEditMode(true), []);

  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const combinedError = headerError || detailMetaError;
  const rowReadOnly = isEditRoute && !isEditMode;

  useEntryFormKeyboard({
    blocked: false,
    isEditMode,
    isSaving,
    addDisabled: !headerMetaReady,
    onAdd: enterEditMode,
    onSave: handleSave,
    onCancel: handleCancel,
    onSelectList: handleAddDetailRow,
  });

  const extraButtons = useMemo(() => [
    {
      key: "save", label: isSaving ? "Saving…" : "Save", Icon: Save, variant: "save",
      onClick: handleSave, disabled: isSaving, loading: isSaving,
      accessKey: "s", title: "Save (Alt+S)",
    },
  ], [handleSave, isSaving]);

  return (
    <div className="workspace-page tm-page">
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
            <button type="button" onClick={() => { fetchHeaderMeta(); fetchDetailMeta(); }}>Retry</button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            title="Transporter Master Details"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            onFilterChange={handleFilterChange}
            isSearching={headerFetching || recordLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={headerFetching || !headerMetaReady}
            fieldTones={filterFieldTones}
          />
        )}
      </section>

      <section className="tm-detail-section">
        <div className="tm-detail-section__header">
          <span className="tm-detail-section__title">Transporter Detail ({detailRowCount})</span>
          {/* EntryGrid only renders headerControls inside its tab-bar layout
              (requires a non-empty `tabs` prop) — with a plain `title` (no
              tabs, our case) that slot is silently dropped. Rendering these
              buttons here instead, same pattern DOP Master's
              .dop-band-card__employee-actions uses for its Add/Delete pair.
              Grouped in their own wrapper so the header's space-between only
              ever has 2 items ([title], [actions]) — 3 direct flex children
              here left "Add Row" floating centered instead of next to Delete. */}
          <div className="tm-detail-section__actions">
            <button
              ref={addDetailBtnRef}
              type="button"
              className="eg-tab-btn"
              onClick={handleAddDetailRow}
              disabled={!isEditMode || detailFetching}
              title="Add a new Transporter Detail row"
            >
              <PlusCircle size={12} strokeWidth={2.5} />
              Add Row
            </button>
            <button
              type="button"
              className="eg-tab-btn eg-tab-btn--danger"
              onClick={handleDeleteDetailRows}
              disabled={!isEditMode}
              title="Delete selected rows"
            >
              <Trash2 size={12} strokeWidth={2} />
              Delete
            </button>
          </div>
        </div>
        {/* title="" (not omitted) — EntryGrid's `title` prop defaults to
            "Invoice Line Items" when absent, so simply not passing it still
            rendered a title bar, just with unrelated boilerplate text
            instead of a duplicate. An explicit empty string is falsy, which
            drops to the plain search-bar-only branch — the section header
            above already covers title + row count + Add/Delete actions. */}
        <EntryGrid
          ref={registerDetailGridRef}
          config={{ columns: detailColumns, pagination: { pageSize: 25 } }}
          title=""
          hideBottomPanel
          hidePagination={false}
          readOnly={rowReadOnly}
          existingRecordEdit={isEditRoute && isEditMode}
          emptyMessage="No detail rows yet. Click Add Row above."
        />
      </section>

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditMode}
        onCancel={handleCancel}
        addLabel={isEditRoute ? "Edit" : "Add"}
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={extraButtons}
      />
    </div>
  );
}
