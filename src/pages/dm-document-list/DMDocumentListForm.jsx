import React, { useState, useCallback, useRef } from "react";
import { AlertCircle, Plus, RefreshCw } from "lucide-react";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import { getColDefault } from "../../api/constants";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { useNotification } from "../../context/NotificationContext";
import "../division-wise-rights/DivisionWiseRightsPage.css";

let _docListTempId = -1;
const nextTempId = () => _docListTempId--;

// EntryGrid only renders `headerControls` inside its tab-bar branch, not the
// plain `title` branch — a single-tab array is the established way to get
// a headerControls slot without a real multi-tab UI (matches the 15
// transaction modules' own IND_GRID_TABS-style single-tab arrays).
const DOCS_GRID_TABS = [{ id: "docs", label: "Docs" }];

function buildBlankRow(columns) {
  const row = { id: nextTempId() };
  columns.forEach((col) => {
    if (col.key !== "cb") row[col.key] = getColDefault(col.colDataType);
  });
  return row;
}

export default function DMDocumentListForm({
  docsColumns = [],
  refColumns = [],
  metaFetching = false,
  metaError = null,
  onFetchReferenceDocs,
  onSaveDocs,
  isSaving = false,
}) {
  const notify = useNotification();
  const docGridRef = useRef(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [refRows, setRefRows] = useState([]);
  const [refLoading, setRefLoading] = useState(false);
  const [formErrors, setFormErrors] = useState([]);

  const loadReferenceDocs = useCallback(async () => {
    setRefLoading(true);
    try {
      const rows = await onFetchReferenceDocs?.();
      setRefRows(
        (rows || []).map((r, i) => ({ ...r, id: r.idnumber ?? r.IDNumber ?? `_ref_${i}` }))
      );
    } finally {
      setRefLoading(false);
    }
  }, [onFetchReferenceDocs]);

  // Both grids appear together as soon as Add is clicked — no separate
  // show/hide toggle (2026-07-29: "hide and unhide not needed").
  const handleAdd = useCallback(() => {
    setIsEditMode(true);
    setFormErrors([]);
    loadReferenceDocs();
  }, [loadReferenceDocs]);

  const handleCancel = useCallback(() => {
    setIsEditMode(false);
    setFormErrors([]);
    setRefRows([]);
    docGridRef.current?.clearRows();
  }, []);

  const handleAddRow = useCallback(() => {
    if (!docsColumns.length) return;
    docGridRef.current?.addRow(buildBlankRow(docsColumns));
  }, [docsColumns]);

  const handleDeleteSelected = useCallback(() => {
    const selected = docGridRef.current?.getSelectedRows?.() ?? [];
    if (!selected.length) return;
    docGridRef.current?.removeRows(selected.map((r) => r.id));
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isEditMode) await loadReferenceDocs();
  }, [isEditMode, loadReferenceDocs]);

  const handleSave = useCallback(async () => {
    const rows = docGridRef.current?.getRows?.() ?? [];
    if (rows.length === 0) {
      setFormErrors(["Please add at least one document row before saving."]);
      return;
    }
    setFormErrors([]);
    try {
      const result = await onSaveDocs?.(rows);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        notify.error(message);
        return;
      }
      notify.success(message || `Saved ${rows.length} document row(s).`);
      setIsEditMode(false);
      docGridRef.current?.clearRows();
    } catch (err) {
      console.error("[DMDocumentList] Save failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    }
  }, [onSaveDocs, notify]);

  const docsGridConfig = { columns: docsColumns, pagination: { pageSize: 25, pageSizeOptions: [10, 25, 50] } };
  const refGridConfig = { columns: refColumns, pagination: { pageSize: 25, pageSizeOptions: [10, 25, 50] } };

  const extraButtons = [
    {
      key: "refresh",
      label: "Refresh",
      onClick: handleRefresh,
      Icon: RefreshCw,
      disabled: metaFetching || refLoading,
    },
    {
      key: "save",
      label: isSaving ? "Saving…" : "Save",
      onClick: handleSave,
      loading: isSaving,
      variant: "primary",
      disabled: isSaving,
    },
  ];

  return (
    <div className="workspace-page dwr-page">
      <section className="dwr-panel dwr-panel--fill">
        {metaFetching ? (
          <div className="master-modal-loader">Loading…</div>
        ) : metaError ? (
          <div className="master-modal-error dwr-panel__error">
            <AlertCircle size={14} strokeWidth={2} /> {metaError}
          </div>
        ) : (
          <>
            <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />

            {isEditMode && (
              <>
                <section className="workspace-page__grid" style={{ marginBottom: 16 }}>
                  <EntryGrid
                    config={refGridConfig}
                    title="Reference Documents"
                    readOnly
                    initialRows={refRows}
                    hideBottomPanel
                    emptyMessage={refLoading ? "Loading…" : "No reference documents found."}
                  />
                </section>

                <section className="workspace-page__grid">
                  <EntryGrid
                    ref={docGridRef}
                    config={docsGridConfig}
                    tabs={DOCS_GRID_TABS}
                    activeTab="docs"
                    existingRecordEdit={false}
                    headerControls={
                      <>
                        <button
                          type="button"
                          className="eg-tab-btn"
                          onClick={handleAddRow}
                          title="Add a blank document row"
                        >
                          <Plus size={12} strokeWidth={2.5} />
                          Add Row
                        </button>
                        <button
                          type="button"
                          className="eg-tab-btn eg-tab-btn--danger"
                          onClick={handleDeleteSelected}
                          title="Delete selected rows"
                        >
                          Delete
                        </button>
                      </>
                    }
                    hideBottomPanel
                    emptyMessage="No document rows yet. Click Add Row above."
                  />
                </section>
              </>
            )}
          </>
        )}
      </section>

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={handleAdd}
        onCancel={handleCancel}
        addLabel="Add"
        cancelLabel="Close"
        extraButtons={extraButtons}
      />
    </div>
  );
}
