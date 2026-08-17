// WKFMainPage.jsx — Workflow approval detail page ("wkfmain").
// Source: MRD_Template4WKFMain.docx. Reached only via a row click on
// /workflow-dashboard (WorkflowDashboard.jsx) — see constants.js for the
// full module overview, the no-RB header-panel note, and the documented
// gaps this file's request shapes fill in (useWKFMain.js).
//
// Previous/Next (top corners in the MRD's own wireframe screenshot) are
// NOT described anywhere in the MRD's text sections (Sections 1-7) — only
// visible in the wireframe images, with no backend endpoint/param
// documented for them. Implemented here using the row list the dashboard
// already has fully loaded client-side (passed forward via router state on
// the row click) rather than inventing a new "fetch row at index N" API —
// self-contained, no extra network calls. Degrades gracefully (buttons
// hidden) if that state isn't present, e.g. a direct/bookmarked link to
// this URL after a hard reload.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, StickyNote, Send, RotateCcw, ArrowLeftCircle } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import Loader from "../../components/ui/Loader";
import { useNotification } from "../../context/NotificationContext";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useWKFMain } from "../../hooks/useWKFMain";
import { resolveRowFieldValue } from "../../utils/gridUtils";
import { buildListColumnsFromRows } from "../../utils/listGridUtils";
import { WKF_DASHBOARD_CONFIG } from "../workflow-dashboard/constants";
import {
  WKF_MAIN_CONFIG,
  WKF_HEADER_FIELDS,
  WKF_ACTION_BUTTONS,
  WKF_TABS,
  buildWkfMainSearch,
} from "./constants";
import "./WKFMainPage.css";

function readField(row, key) {
  const val = resolveRowFieldValue(row, key);
  return val == null || val === "" ? "—" : String(val);
}

function dynamicRowKey(row, index) {
  return String(row?.idnumber ?? row?.IDNumber ?? row?.srno ?? row?.SrNo ?? `wkf-row-${index}`);
}

export default function WKFMainPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const notify = useNotification();

  const wkfdashkey = searchParams.get(WKF_MAIN_CONFIG.PARAM_DASHKEY) ?? "";
  const wkfdashkeystatus = searchParams.get(WKF_MAIN_CONFIG.PARAM_DASHKEY_STATUS) ?? "";
  const wkfrowindx = Number(searchParams.get(WKF_MAIN_CONFIG.PARAM_ROWINDX)) || 0;
  const keys = useMemo(
    () => ({ wkfdashkey, wkfdashkeystatus, wkfrowindx }),
    [wkfdashkey, wkfdashkeystatus, wkfrowindx]
  );

  // Forwarded from the dashboard's row click (see WorkflowDashboard.jsx) —
  // powers Previous/Next and hands the same filters back for "return to
  // dashboard, auto-refresh" after a successful action.
  const navRows = location.state?.rows ?? null;
  const navFilterValues = location.state?.filterValues ?? null;
  const navActiveStatus = location.state?.activeStatus ?? null;

  const {
    fetchHeader,
    fetchDetail,
    fetchTrackList,
    fetchPathList,
    fetchNotesList,
    fetchButtonVisibility,
    saveNote,
    postAction,
  } = useWKFMain();

  const [activeTab, setActiveTab] = useState("main");

  const [header, setHeader] = useState(null);
  const [headerLoading, setHeaderLoading] = useState(true);
  const [headerError, setHeaderError] = useState(null);

  const [detailRows, setDetailRows] = useState([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [trackRows, setTrackRows] = useState([]);
  const [trackLoading, setTrackLoading] = useState(true);
  const [pathRows, setPathRows] = useState([]);
  const [pathLoading, setPathLoading] = useState(true);

  const [notesRows, setNotesRows] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [buttonVisibility, setButtonVisibility] = useState(null);
  const [actingKey, setActingKey] = useState(null);

  const pageTitle = header ? readField(header, "pagetitle") : "Workflow Approval";

  usePageHeader({
    title: pageTitle !== "—" ? pageTitle : "Workflow Approval",
    subtitle: wkfdashkey ? `Ref: ${wkfdashkey}` : undefined,
    showBack: true,
    backTo: WKF_DASHBOARD_CONFIG.ROUTE_PATH,
  });

  // All 6 APIs fire on page load (MRD: "Page Load (one time called)" for
  // every one of them) — best-effort per section, one section's failure
  // doesn't block the others from rendering.
  useEffect(() => {
    if (!wkfdashkey) return undefined;
    let cancelled = false;

    setHeaderLoading(true);
    setHeaderError(null);
    fetchHeader(keys)
      .then((row) => { if (!cancelled) setHeader(row); })
      .catch((err) => {
        console.error("[WKFMain] header fetch failed:", err);
        if (!cancelled) setHeaderError(err?.message || "Failed to load header.");
      })
      .finally(() => { if (!cancelled) setHeaderLoading(false); });

    setDetailLoading(true);
    fetchDetail(keys)
      .then((rows) => { if (!cancelled) setDetailRows(rows); })
      .catch((err) => {
        console.error("[WKFMain] detail fetch failed:", err);
        if (!cancelled) setDetailRows([]);
      })
      .finally(() => { if (!cancelled) setDetailLoading(false); });

    setTrackLoading(true);
    fetchTrackList(keys)
      .then((rows) => { if (!cancelled) setTrackRows(rows); })
      .catch((err) => {
        console.error("[WKFMain] track list fetch failed:", err);
        if (!cancelled) setTrackRows([]);
      })
      .finally(() => { if (!cancelled) setTrackLoading(false); });

    setPathLoading(true);
    fetchPathList(keys)
      .then((rows) => { if (!cancelled) setPathRows(rows); })
      .catch((err) => {
        console.error("[WKFMain] path list fetch failed:", err);
        if (!cancelled) setPathRows([]);
      })
      .finally(() => { if (!cancelled) setPathLoading(false); });

    setNotesLoading(true);
    fetchNotesList(keys)
      .then((rows) => { if (!cancelled) setNotesRows(rows); })
      .catch((err) => {
        console.error("[WKFMain] notes list fetch failed:", err);
        if (!cancelled) setNotesRows([]);
      })
      .finally(() => { if (!cancelled) setNotesLoading(false); });

    setButtonVisibility(null);
    fetchButtonVisibility(keys)
      .then((flags) => { if (!cancelled) setButtonVisibility(flags); })
      .catch((err) => {
        console.error("[WKFMain] button visibility fetch failed:", err);
        if (!cancelled) setButtonVisibility(null);
      });

    return () => { cancelled = true; };
  }, [wkfdashkey, keys, fetchHeader, fetchDetail, fetchTrackList, fetchPathList, fetchNotesList, fetchButtonVisibility]);

  const detailColumns = useMemo(() => buildListColumnsFromRows(detailRows), [detailRows]);
  const trackColumns = useMemo(() => buildListColumnsFromRows(trackRows), [trackRows]);
  const pathColumns = useMemo(() => buildListColumnsFromRows(pathRows), [pathRows]);

  const handleSaveNote = useCallback(async () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    setSavingNote(true);
    try {
      const { success, message } = await saveNote(keys, trimmed);
      if (!success) {
        notify.error(message || "Failed to save note.");
        return;
      }
      notify.success(message || "Note saved.");
      setNoteText("");
      const rows = await fetchNotesList(keys);
      setNotesRows(rows);
    } catch (err) {
      console.error("[WKFMain] note save failed:", err);
      notify.error(err?.message || "Failed to save note.");
    } finally {
      setSavingNote(false);
    }
  }, [noteText, keys, saveNote, fetchNotesList, notify]);

  const handleCancelNote = useCallback(() => setNoteText(""), []);

  // Successful action -> back to dashboard with the same filters, and ask
  // it to auto-refresh (2026-08-14 /pm, confirmed via AskUserQuestion —
  // the MRD itself only says "hide the buttons", not what happens next).
  const handleAction = useCallback(async (btn) => {
    setActingKey(btn.key);
    try {
      const currSrno = readField(header, "curr_srno");
      const { success, message } = await postAction(keys, btn.actionCode, currSrno === "—" ? "" : currSrno);
      if (!success) {
        notify.error(message || `${btn.label} failed.`);
        return;
      }
      notify.success(message || `${btn.label} completed.`);
      navigate(WKF_DASHBOARD_CONFIG.ROUTE_PATH, {
        state: { autoRefresh: true, filterValues: navFilterValues, activeStatus: navActiveStatus },
      });
    } catch (err) {
      console.error(`[WKFMain] ${btn.actionCode} action failed:`, err);
      notify.error(err?.message || `${btn.label} failed.`);
    } finally {
      setActingKey(null);
    }
  }, [keys, header, postAction, notify, navigate, navFilterValues, navActiveStatus]);

  const prevRow = navRows && wkfrowindx > 0 ? navRows[wkfrowindx - 1] : null;
  const nextRow = navRows && wkfrowindx < navRows.length - 1 ? navRows[wkfrowindx + 1] : null;

  const goToRow = useCallback((row, index) => {
    navigate(buildWkfMainSearch(row, index), {
      state: { rows: navRows, filterValues: navFilterValues, activeStatus: navActiveStatus },
    });
  }, [navigate, navRows, navFilterValues, navActiveStatus]);

  const visibleActionButtons = WKF_ACTION_BUTTONS.filter(
    (btn) => buttonVisibility?.[btn.canFlag]
  );

  if (!wkfdashkey) {
    return (
      <div className="workspace-page wkf-main">
        <div className="wkf-main__error">
          <AlertBanner text="No transaction reference was provided. Open this page from the Workflow Dashboard." />
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-page workspace-page--fill wkf-main">
      <section className="wkf-main__topbar">
        <button
          type="button"
          className="wkf-main__nav-btn"
          onClick={() => prevRow && goToRow(prevRow, wkfrowindx - 1)}
          disabled={!prevRow}
          title="Previous record"
        >
          <ChevronLeft size={14} strokeWidth={2.5} />
          Previous
        </button>
        <h1 className="wkf-main__title">{pageTitle}</h1>
        <button
          type="button"
          className="wkf-main__nav-btn"
          onClick={() => nextRow && goToRow(nextRow, wkfrowindx + 1)}
          disabled={!nextRow}
          title="Next record"
        >
          Next
          <ChevronRight size={14} strokeWidth={2.5} />
        </button>
      </section>

      <section className="wkf-main__tabbar" aria-label="Workflow record sections">
        {WKF_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`wkf-main__tab${activeTab === tab.id ? " wkf-main__tab--active" : ""}`}
            aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </section>

      {headerError && <AlertBanner text={headerError} />}

      {activeTab === "main" && (
        <div className="wkf-main__panel">
          <section className="wkf-main__header-panel" aria-label="Header Section">
            {headerLoading ? (
              <Loader text="Loading header…" />
            ) : (
              <div className="wkf-main__header-grid">
                {WKF_HEADER_FIELDS.map((f) => (
                  <div key={f.key} className="wkf-main__field">
                    <span className="wkf-main__field-label">{f.label}</span>
                    <span className="wkf-main__field-value">{readField(header, f.key)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="wkf-main__grid-section">
            <EnterpriseDataGrid
              title="Detail Section"
              columns={detailColumns}
              data={detailRows}
              loading={detailLoading}
              emptyMessage="No detail rows returned for this transaction."
              getRowKey={dynamicRowKey}
              selectable={false}
              searchable={false}
              fill
            />
          </section>

          <section className="wkf-main__notes" aria-label="Noting Section">
            <h2 className="wkf-main__section-title">Noting Section</h2>
            {notesLoading ? (
              <Loader text="Loading notes…" />
            ) : notesRows.length === 0 ? (
              <p className="wkf-main__empty">No notes yet.</p>
            ) : (
              <div className="wkf-main__note-list">
                {notesRows.map((note, i) => (
                  <div key={dynamicRowKey(note, i)} className="wkf-main__note-card">
                    <div className="wkf-main__note-title">
                      Note No. {readField(note, "uniqueno") !== "—" ? readField(note, "uniqueno") : i + 1}
                    </div>
                    <div className="wkf-main__note-text">
                      {readField(note, "noting") !== "—"
                        ? readField(note, "noting")
                        : readField(note, "notetext") !== "—"
                          ? readField(note, "notetext")
                          : readField(note, "remarks")}
                    </div>
                    <div className="wkf-main__note-meta">
                      <span>
                        User Name:{" "}
                        {readField(note, "userinfo") !== "—" ? readField(note, "userinfo") : readField(note, "username")}
                      </span>
                      <span>
                        Note Date:{" "}
                        {readField(note, "notedt") !== "—" ? readField(note, "notedt") : readField(note, "notedate")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="wkf-main__note-entry">
              <label className="wkf-main__field-label" htmlFor="wkf-enter-note">Enter Note</label>
              <textarea
                id="wkf-enter-note"
                className="wkf-main__note-textarea"
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Type a note…"
              />
              <div className="wkf-main__note-actions">
                <button
                  type="button"
                  className="wkf-main__btn wkf-main__btn--ghost"
                  onClick={handleCancelNote}
                  disabled={savingNote || !noteText}
                >
                  <RotateCcw size={13} strokeWidth={2} />
                  Cancel Note
                </button>
                <button
                  type="button"
                  className="wkf-main__btn wkf-main__btn--primary"
                  onClick={handleSaveNote}
                  disabled={savingNote || !noteText.trim()}
                >
                  <StickyNote size={13} strokeWidth={2} />
                  {savingNote ? "Saving…" : "Save Note"}
                </button>
              </div>
            </div>
          </section>

          {visibleActionButtons.length > 0 && (
            <section className="wkf-main__actions" aria-label="Direct Stamping Keys">
              <h2 className="wkf-main__section-title">Direct Stamping Keys</h2>
              <div className="wkf-main__action-row">
                {visibleActionButtons.map((btn) => (
                  <button
                    key={btn.key}
                    type="button"
                    className="wkf-main__btn wkf-main__btn--action"
                    onClick={() => handleAction(btn)}
                    disabled={actingKey !== null}
                  >
                    <Send size={13} strokeWidth={2} />
                    {actingKey === btn.key ? `${btn.label}…` : btn.label}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === "track" && (
        <div className="wkf-main__panel">
          <section className="wkf-main__grid-section">
            <EnterpriseDataGrid
              title="Tracking List"
              columns={trackColumns}
              data={trackRows}
              loading={trackLoading}
              emptyMessage="No tracking history for this transaction."
              getRowKey={dynamicRowKey}
              selectable={false}
              searchable={false}
              fill
            />
          </section>
        </div>
      )}

      {activeTab === "path" && (
        <div className="wkf-main__panel">
          <section className="wkf-main__grid-section">
            <EnterpriseDataGrid
              title="User Path List"
              columns={pathColumns}
              data={pathRows}
              loading={pathLoading}
              emptyMessage="No user path history for this transaction."
              getRowKey={dynamicRowKey}
              selectable={false}
              searchable={false}
              fill
            />
          </section>
        </div>
      )}
    </div>
  );
}

function AlertBanner({ text }) {
  return (
    <div className="wkf-main__alert" role="alert">
      <ArrowLeftCircle size={14} strokeWidth={2} />
      <span>{text}</span>
    </div>
  );
}
