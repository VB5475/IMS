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
import { AlertCircle, Plus, FolderSearch, RefreshCw, Save as SaveIcon, FileText } from "lucide-react";
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

// Document Type isn't in EntryGrid's default EVENT_COLUMNS set (that's built
// for transaction line-item grids, e.g. ItemID/TranQty) — opt in explicitly
// so changing it fires onCellEvent and drives the Sub Type cascade.
const DOCTYPE_EVENT_COLUMNS = [CFG.DOCTYPE_COL];

// "View" — extensions the browser can render inline in a new tab. Anything
// else gets a forced, properly-named download instead (see handleView).
const PREVIEWABLE_EXTS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".txt",".docx"]);

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
    fetchUploadedDocs,
    fetchDocSubTypeOptions,
    saveDocs,
    viewDoc,
    isSaving,
  } = useDocumentLog();

  const [refRows, setRefRows] = useState([]);
  const [refLoading, setRefLoading] = useState(false);
  const [refFetched, setRefFetched] = useState(false);
  const [uploadedLoading, setUploadedLoading] = useState(false);
  const [formErrors, setFormErrors] = useState([]);

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
    fetchHeaderMeta({ refTranTypeId: tranTypeId, refDepartmentId: CFG.DEFAULT_REF_DEPARTMENT_ID });
  }, [isOpen, tranId, tranTypeId, fetchHeaderMeta]);

  const handleAddRow = useCallback(() => {
    if (!docsColumns.length) return;
    docGridRef.current?.addRow(buildBlankRow(docsColumns));
  }, [docsColumns]);

  const handleDeleteSelected = useCallback(() => {
    const selected = docGridRef.current?.getSelectedRows?.() ?? [];
    if (!selected.length) return;
    docGridRef.current?.removeRows(selected.map((r) => r.id));
  }, []);

  // "Refresh" (Docs section) — appends documents already uploaded for this
  // transaction straight into the SAME Docs grid (one grid only, per
  // explicit user correction — an earlier separate "Uploaded Documents"
  // grid was reverted). Each appended row is tagged `_isUploaded: true` so
  // it can be told apart from a genuine new draft row: handleSave filters
  // these out before building the save payload (still never resubmitted/
  // duplicated). Per explicit user correction 2026-07-30, these rows are
  // otherwise fully NORMAL/editable/selectable — the earlier isRowDisabled
  // greyed-out treatment was removed.
  const handleFetchUploadedDocs = useCallback(async () => {
    setUploadedLoading(true);
    try {
      const rows = await fetchUploadedDocs({ refTranTypeId: tranTypeId, tranId, guid });
      (rows || []).forEach((r, i) => {
        const rowId = r.idnumber ?? r.IDNumber ?? `_uploaded_${i}`;
        docGridRef.current?.addRow({
          ...r,
          id: rowId,
          _isUploaded: true,
        });
        // These rows already carry a real Document Type from the backend —
        // proactively fetch its Sub Type cascade so the dropdown isn't stuck
        // empty until the user re-touches Document Type themselves (these
        // rows are fully editable now, per the earlier isRowDisabled removal).
        const existingDocTypeId = Number(r[CFG.DOCTYPE_COL]) || 0;
        if (existingDocTypeId) {
          fetchDocSubTypeOptions({
            refTranTypeId: tranTypeId,
            refDepartmentId: CFG.DEFAULT_REF_DEPARTMENT_ID,
            documentTypeId: existingDocTypeId,
          }).then((opts) => {
            docGridRef.current?.updateRow(rowId, { [CFG.SUBTYPE_ROW_OPTIONS_KEY]: opts });
          });
        }
      });
      notify.success(`Found ${rows?.length ?? 0} already-uploaded document(s).`);
    } finally {
      setUploadedLoading(false);
    }
  }, [fetchUploadedDocs, fetchDocSubTypeOptions, tranTypeId, tranId, guid, notify]);

  // Docs grid — Document Type cascades Sub Type per row (see
  // documentLogConfig.js's SP_DOCUMENT_SUBTYPE note + the "Live per-row
  // cascade" choice confirmed via AskUserQuestion 2026-07-31). Fires
  // immediately on selection (EntryGrid's dropdown onChange calls
  // onCellEvent right away, not on blur), not just on the configured
  // EVENT_COLUMNS default set — explicitly opted in via `eventColumns` below.
  const handleDocTypeCellEvent = useCallback(
    async ({ rowId, colKey, rowData }) => {
      if (colKey !== CFG.DOCTYPE_COL) return;
      const documentTypeId = Number(rowData[CFG.DOCTYPE_COL]) || 0;
      // The previously-selected Sub Type may no longer be valid under the
      // new Document Type (each type has its own distinct subtype set) —
      // clear both the selection and the stale option list immediately,
      // then swap in the freshly scoped list once it arrives.
      docGridRef.current?.updateRow(rowId, {
        [CFG.SUBTYPE_COL]: "",
        [CFG.SUBTYPE_ROW_OPTIONS_KEY]: [],
      });
      if (!documentTypeId) return;
      const opts = await fetchDocSubTypeOptions({
        refTranTypeId: tranTypeId,
        refDepartmentId: CFG.DEFAULT_REF_DEPARTMENT_ID,
        documentTypeId,
      });
      docGridRef.current?.updateRow(rowId, { [CFG.SUBTYPE_ROW_OPTIONS_KEY]: opts });
    },
    [fetchDocSubTypeOptions, tranTypeId]
  );

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
        // Success is the raw file itself (per the DM API doc). A blob: URL
        // carries no filename on its own — if the browser can't render the
        // type inline, it silently downloads a nameless file with nothing
        // tying it back to the document. Use the row's own fileext (known
        // from the real uploaded File, staged via handleFileSelected below)
        // to decide: previewable types keep opening in a tab as before;
        // anything else gets a forced download under its REAL name instead.
        const url = URL.createObjectURL(result.blob);
        const ext = String(row.fileext || "").toLowerCase();
        if (PREVIEWABLE_EXTS.has(ext)) {
          window.open(url, "_blank", "noopener,noreferrer");
        } else {
          // documentname/filename already carry the real, complete file name
          // — provided as-is, no extension guessing/appending needed here.
          const fileName = String(row.documentname || row.filename || `document_${docId}`).trim();
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (err) {
        console.error("[DocumentLogModal] View failed:", err);
        notify.error(err?.message || "Failed to load document.");
      }
    },
    [notify, viewDoc]
  );

  // Upload — opens the native file picker for the clicked row. REVERSED
  // 2026-07-31 (explicit user instruction): Upload no longer calls the save
  // API immediately by itself — it only STAGES the file locally on the row
  // (via the internal `_file` field, leading-underscore convention already
  // used for `_isUploaded`/`_docSubTypeOptions` — see buildSaveRowFromColumns'
  // guard in api/constants.js, which strips any `_`-prefixed field before it
  // ever reaches a save payload). The actual API call now only happens when
  // the user clicks the modal's own "Save" button — handleSave collects
  // every row (JSON metadata + whichever rows carry a staged `_file`) and
  // saveDocs loops through them, attaching each row's own file if present.
  const handleUploadClick = useCallback((row) => {
    pendingUploadRowRef.current = row;
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      const row = pendingUploadRowRef.current;
      pendingUploadRowRef.current = null;
      e.target.value = ""; // allow re-picking the same file later
      if (!file || !row) return;

      const fileExt = file.name?.includes(".") ? file.name.split(".").pop() : "";
      docGridRef.current?.updateRow(row.id, {
        documentname: file.name ?? "",
        filename: file.name ?? "",
        fileext: fileExt ? `.${fileExt}` : "",
        filesize: file.size ?? 0,
        _file: file,
      });
      notify.success(`"${file.name}" attached — click Save to upload.`);
    },
    [notify]
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
    // Exclude already-uploaded rows appended by "Refresh" — those are
    // display-only, never resubmitted (see handleFetchUploadedDocs).
    const rows = (docGridRef.current?.getRows?.() ?? []).filter((r) => !r._isUploaded);
    if (rows.length === 0) {
      setFormErrors(["Please add at least one document row before saving."]);
      return;
    }
    setFormErrors([]);
    try {
      const results = await saveDocs(rows, tranId, divisionId, tranTypeId, guid);
      const parsed = results.map((r) => parseApiErrMsg(r));
      const failed = parsed.filter((p) => !p.success);
      if (failed.length > 0) {
        notify.error(failed.map((p) => p.message).join(" | "));
        return;
      }
      notify.success(`Saved ${rows.length} document row(s).`);
      // Remove only the just-saved rows, NOT clearRows() — that would also
      // wipe any already-uploaded rows the user brought in via Refresh.
      docGridRef.current?.removeRows(rows.map((r) => r.id));
    } catch (err) {
      console.error("[DocumentLogModal] Save failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    }
  }, [saveDocs, tranId, divisionId, tranTypeId, guid, notify]);

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
              eventColumns={DOCTYPE_EVENT_COLUMNS}
              onCellEvent={handleDocTypeCellEvent}
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
                  <button
                    type="button"
                    className="eg-tab-btn"
                    onClick={handleFetchUploadedDocs}
                    disabled={uploadedLoading}
                    title="Refresh the list of documents already uploaded for this transaction"
                  >
                    <RefreshCw size={12} strokeWidth={2.5} />
                    {uploadedLoading ? "Loading…" : "Refresh"}
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
