// DocumentLogModal.jsx — Document Log (F6), large modal inside transaction
// forms. Currently wired into Purchase Indent only (2026-07-30 scope
// correction, /pm + /tl); PO/PV/etc. to follow the same pattern later.
//
// Reuses the Docs + Reference Documents grids from the original DM Document
// List build (2026-07-29) — see documentLogConfig.js for what changed and
// why. Unlike that standalone-master version, there's no separate "Add" gate
// before the grids render: opening the modal via F6 already signals intent,
// so both grids load immediately.

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { AlertCircle, Plus, FolderSearch, Save as SaveIcon, FileText } from "lucide-react";
import Modal from "../ui/Modal";
import EntryGrid from "../grid/EntryGrid";
import AlertPanel from "../ui/AlertPanel";
import Loader from "../ui/Loader";
import { getColDefault } from "../../api/constants";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { useNotification } from "../../context/NotificationContext";
import { useDocumentLog } from "../../hooks/useDocumentLog";
import { DOCUMENT_LOG_CONFIG as CFG } from "./documentLogConfig";
import "./DocumentLogModal.css";

let _docLogTempId = -1;
const nextTempId = () => _docLogTempId--;

// EntryGrid only renders `headerControls` inside its tab-bar branch, not the
// plain `title` branch — see original DM Document List gotcha, still true here.
const DOCS_GRID_TABS = [{ id: "docs", label: "Docs" }];
const REF_GRID_TABS = [{ id: "reference", label: "Reference Documents" }];

function buildBlankRow(columns) {
  const row = { id: nextTempId() };
  columns.forEach((col) => {
    if (col.key !== "cb") row[col.key] = getColDefault(col.colDataType);
  });
  return row;
}

// Reference Documents is read-only by design — its RB-flagged "Upload"
// button column doesn't belong there even though the RB marks it visible
// (uploading to a reference-only row makes no sense). Docs keeps both.
function withoutUploadColumn(columns) {
  return columns.filter((c) => c.key !== CFG.UPLOAD_COL);
}

export default function DocumentLogModal({
  isOpen = false,
  onClose,
  tranId = 0,
  divisionId = 0,
  // Ref_TranTypeID (e.g. Purchase Indent = 5) + the per-transaction GUID
  // fetched via DM_HandleGUID (see PurchaseIndentForm.jsx) — both scope the
  // "Reference Document" button's fetch (fn_tbl_rb_dm_trnwisedocs_fetch_DocData).
  tranTypeId = 0,
  guid = "",
}) {
  const notify = useNotification();
  const docGridRef = useRef(null);
  const loadedForTranRef = useRef(null);
  const fileInputRef = useRef(null);
  const pendingUploadRowRef = useRef(null);

  const {
    fetchHeaderMeta,
    docsColumns,
    refColumns,
    metaFetching,
    metaError,
    fetchReferenceDocs,
    saveDocs,
    uploadDoc,
    viewDoc,
    isSaving,
  } = useDocumentLog();

  const [refRows, setRefRows] = useState([]);
  const [refLoading, setRefLoading] = useState(false);
  const [refFetched, setRefFetched] = useState(false);
  const [formErrors, setFormErrors] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Load once per (modal-open, tranId) pair — not on every re-render while
  // open. Only fetches column metadata (needed to render both grids at all)
  // — Reference Documents' actual ROWS are no longer auto-loaded here; they
  // stay empty until the "Reference Document" button is clicked (see
  // handleFetchReferenceDocs below), per explicit user spec.
  useEffect(() => {
    if (!isOpen) {
      loadedForTranRef.current = null;
      return;
    }
    if (loadedForTranRef.current === tranId) return;
    loadedForTranRef.current = tranId;
    fetchHeaderMeta();
  }, [isOpen, tranId, fetchHeaderMeta]);

  const handleAddRow = useCallback(() => {
    if (!docsColumns.length) return;
    docGridRef.current?.addRow(buildBlankRow(docsColumns));
  }, [docsColumns]);

  const handleDeleteSelected = useCallback(() => {
    const selected = docGridRef.current?.getSelectedRows?.() ?? [];
    if (!selected.length) return;
    docGridRef.current?.removeRows(selected.map((r) => r.id));
  }, []);

  // "Reference Document" — the ONLY way this grid ever gets data; no popup,
  // fetched rows go straight into the grid in place.
  const handleFetchReferenceDocs = useCallback(async () => {
    setRefLoading(true);
    try {
      const rows = await fetchReferenceDocs({ refTranTypeId: tranTypeId, guid, tranId });
      setRefRows((rows || []).map((r, i) => ({ ...r, id: r.idnumber ?? r.IDNumber ?? `_ref_${i}` })));
      setRefFetched(true);
    } finally {
      setRefLoading(false);
    }
  }, [fetchReferenceDocs, tranTypeId, guid, tranId]);

  const handleView = useCallback(
    async (row) => {
      const docId = Number(row.idnumber ?? row.IDNumber ?? row.id);
      if (!Number.isFinite(docId) || docId <= 0) {
        notify.warning("Save this document row first before viewing it.");
        return;
      }
      try {
        const result = await viewDoc(docId);
        if (result.isError) {
          notify.warning(result.message);
          return;
        }
        // Success is the raw file itself (per the DM API doc) — open it in
        // a new tab, the browser renders/downloads based on its own type.
        const url = URL.createObjectURL(result.blob);
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (err) {
        console.error("[DocumentLogModal] View failed:", err);
        notify.error(err?.message || "Failed to load document.");
      }
    },
    [notify, viewDoc]
  );

  // Upload — opens the native file picker for the clicked row, then saves
  // that row + the selected file together via the real SAVE_ENDPOINT
  // (per the DM API doc: one multipart call per row, `file` field attached).
  const handleUploadClick = useCallback((row) => {
    pendingUploadRowRef.current = row;
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      const row = pendingUploadRowRef.current;
      pendingUploadRowRef.current = null;
      e.target.value = ""; // allow re-picking the same file later
      if (!file || !row) return;

      setIsUploading(true);
      try {
        const result = await uploadDoc(row, file, tranId, divisionId, tranTypeId);
        const { success, message } = parseApiErrMsg(result);
        if (!success) {
          notify.error(message);
          return;
        }
        notify.success(message || `Uploaded "${file.name}".`);
        docGridRef.current?.removeRows([row.id]);
      } catch (err) {
        console.error("[DocumentLogModal] Upload failed:", err);
        notify.error(err?.message || "Upload failed. Please try again.");
      } finally {
        setIsUploading(false);
      }
    },
    [uploadDoc, tranId, divisionId, tranTypeId, notify]
  );

  const handleGridButtonClick = useCallback(
    (row, col) => {
      if (col.key === CFG.UPLOAD_COL) {
        handleUploadClick(row);
      } else if (col.key === CFG.VIEW_COL) {
        handleView(row);
      }
    },
    [handleUploadClick, handleView]
  );

  const handleSave = useCallback(async () => {
    const rows = docGridRef.current?.getRows?.() ?? [];
    if (rows.length === 0) {
      setFormErrors(["Please add at least one document row before saving."]);
      return;
    }
    setFormErrors([]);
    try {
      const results = await saveDocs(rows, tranId, divisionId, tranTypeId);
      const parsed = results.map((r) => parseApiErrMsg(r));
      const failed = parsed.filter((p) => !p.success);
      if (failed.length > 0) {
        notify.error(failed.map((p) => p.message).join(" | "));
        return;
      }
      notify.success(`Saved ${rows.length} document row(s).`);
      docGridRef.current?.clearRows();
    } catch (err) {
      console.error("[DocumentLogModal] Save failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    }
  }, [saveDocs, tranId, divisionId, tranTypeId, notify]);

  const docsGridConfig = useMemo(
    () => ({ columns: docsColumns, pagination: { pageSize: 25, pageSizeOptions: [10, 25, 50] } }),
    [docsColumns]
  );
  const refGridConfig = useMemo(
    () => ({ columns: withoutUploadColumn(refColumns), pagination: { pageSize: 25, pageSizeOptions: [10, 25, 50] } }),
    [refColumns]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Document Log"
      subtitle="Add document metadata rows, then Save. Click Reference Document to load related entries."
      icon={<FileText size={16} strokeWidth={2} />}
      size="xl"
      footer={
        <>
          <button type="button" className="action-btn action-btn--secondary" onClick={onClose}>
            <span>Cancel</span>
          </button>
          <button
            type="button"
            className="action-btn action-btn--save"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <div className="action-spinner" /> : <SaveIcon size={13} strokeWidth={2} />}
            <span>{isSaving ? "Saving…" : "Save"}</span>
          </button>
        </>
      }
    >
      {/* Hidden native file picker, shared by every row's Upload button —
          pendingUploadRowRef tracks which row triggered it. */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleFileSelected}
        aria-hidden="true"
        tabIndex={-1}
      />

      {metaFetching ? (
        <Loader text="Loading document log configuration…" />
      ) : metaError ? (
        <div className="doclog-modal__error">
          <AlertCircle size={14} strokeWidth={2} /> {metaError}
        </div>
      ) : (
        <>
          <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
          {isUploading && (
            <div className="doclog-modal__uploading" role="status">
              Uploading…
            </div>
          )}

          <section className="workspace-page__grid" style={{ marginBottom: 16 }}>
            <EntryGrid
              config={refGridConfig}
              tabs={REF_GRID_TABS}
              activeTab="reference"
              readOnly
              initialRows={refRows}
              headerControls={
                <>
                  {refFetched && (
                    <span className="doclog-modal__count">
                      {refRows.length} record{refRows.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  <button
                    type="button"
                    className="eg-tab-btn"
                    onClick={handleFetchReferenceDocs}
                    disabled={refLoading}
                    title="Fetch reference documents for this transaction"
                  >
                    <FolderSearch size={12} strokeWidth={2.5} />
                    {refLoading ? "Loading…" : "Reference Document"}
                  </button>
                </>
              }
              hideBottomPanel
              emptyMessage={refLoading ? "Loading…" : "No reference documents found. Click Reference Document above."}
              onButtonClick={handleGridButtonClick}
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
              onButtonClick={handleGridButtonClick}
            />
          </section>
        </>
      )}
    </Modal>
  );
}
