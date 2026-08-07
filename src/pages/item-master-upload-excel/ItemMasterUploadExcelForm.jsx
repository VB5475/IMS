// ItemMasterUploadExcelForm.jsx — Item Master Upload Excel (Add)
//
// Same flow as Asset Item Opening Excel:
//   1. fetchDetailMeta  → rb_xluplditemmst → grid column metadata (read-only)
//   2. Upload Excel     → clears existing rows, loads parsed spreadsheet data
//   3. Save             → POST prmStrDetJSON only

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { AlertCircle, Trash2, FileSpreadsheet, Save, Upload, Download } from "lucide-react";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
import { useItemMasterUploadExcel } from "../../hooks/useItemMasterUploadExcel";
import { useApi } from "../../api/useApi";
import {
  API_BASE_URL,
  API_BASE_URL_IMS,
  getColDefault,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { parseExcelFileToGridRows } from "../../utils/excelImport";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import { isTruthyApiFlag } from "../../utils/gridUtils";
import { IMUE_CONFIG, IMUE_GRID_TABS, PAGE_TITLE } from "./constants";
import "./ItemMasterUploadExcelPage.css";

export default function ItemMasterUploadExcelForm() {
  const notify = useNotification();
  const fileInputRef = useRef(null);
  const uploadBtnRef = useRef(null);
  const itemGridRef = useRef(null);

  const [formErrors, setFormErrors] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState("items");
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    columns,
    allColumns,
    apiColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
  } = useItemMasterUploadExcel(API_BASE_URL);

  const { post: postSave } = useApi(API_BASE_URL_IMS);

  const enterEditModeWithFocus = useCallback(() => {
    setIsEditMode(true);
    window.requestAnimationFrame(() => {
      window.setTimeout(() => uploadBtnRef.current?.focus(), 80);
    });
  }, []);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  usePageHeader({
    title: PAGE_TITLE,
    subtitle: isEditMode
      ? "Upload an Excel file, review rows, then save."
      : "Click Add (Alt+A) to upload an Excel file and create entries.",
    showBack: false,
  });

  useEffect(() => {
    (async () => {
      await fetchDetailMeta();
      await fetchGridColumns();
    })();
  }, [fetchDetailMeta, fetchGridColumns]);

  const handleUploadClick = useCallback(() => {
    if (!isEditMode) return;
    fileInputRef.current?.click();
  }, [isEditMode]);

  const handleExcelFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!apiColumns.length) {
      setFormErrors(["Grid configuration is still loading. Please try again."]);
      return;
    }

    setIsUploading(true);
    setFormErrors([]);
    // Let React paint the loading overlay before heavy XLSX work blocks the thread.
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      itemGridRef.current?.clearRows?.();

      const rows = await parseExcelFileToGridRows(file, apiColumns);
      if (!rows.length) {
        setFormErrors(["No data rows found in the uploaded Excel file."]);
        return;
      }

      itemGridRef.current?.loadRows?.(rows);
      notify.success(`${rows.length} row(s) loaded from Excel.`);
    } catch (err) {
      console.error("[IMUE] Excel upload failed:", err);
      setFormErrors([err?.message || "Failed to read the Excel file."]);
    } finally {
      setIsUploading(false);
    }
  }, [apiColumns, notify]);

  const handleDeleteSelected = useCallback(() => {
    if (!itemGridRef.current) return;
    const selected = itemGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  const getExportHeaders = useCallback(() => (
    apiColumns
      .filter((col) => isTruthyApiFlag(col.isvisible ?? col.IsVisible))
      .map((col) => ({
        key: String(col.colname ?? "").trim(),
        header: String(col.displayname ?? "").trim(),
      }))
      .filter((col) => col.key && col.header)
  ), [apiColumns]);

  const handleExportExcel = useCallback(() => {
    const exportHeaders = getExportHeaders();

    if (!exportHeaders.length) {
      setFormErrors(["Grid configuration is still loading. Please try export again."]);
      return;
    }

    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    const exportRows = detailRows.length
      ? detailRows.map(({ id, ...rest }) =>
          Object.fromEntries(exportHeaders.map(({ key, header }) => [header, rest[key] ?? ""]))
        )
      : [Object.fromEntries(exportHeaders.map(({ header }) => [header, ""]))];

    const worksheet = XLSX.utils.json_to_sheet(exportRows, {
      header: exportHeaders.map(({ header }) => header),
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ItemMasterUpload");
    XLSX.writeFile(workbook, "item_master_upload_excel_export.xlsx");
  }, [getExportHeaders]);

  const handleDownloadTemplate = useCallback(() => {
    const exportHeaders = getExportHeaders();

    if (!exportHeaders.length) {
      setFormErrors(["Grid configuration is still loading. Please try download again."]);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(
      [Object.fromEntries(exportHeaders.map(({ header }) => [header, ""]))],
      { header: exportHeaders.map(({ header }) => header) }
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ItemMasterUpload");
    XLSX.writeFile(workbook, "item_master_upload_excel_template.xlsx");
  }, [getExportHeaders]);

  const handleSave = useCallback(async () => {
    setFormErrors([]);
    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    if (detailRows.length === 0) {
      setFormErrors(["Upload an Excel file with at least one row before saving."]);
      return false;
    }

    const detailErrors = validateGridRows(detailRows, columns);
    if (detailErrors.length > 0) {
      setFormErrors(detailErrors);
      return false;
    }

    // Save API takes prmStrMstJSON (not Det) — each Excel row is a master row.
    const mstRows = detailRows.map(({ id, __excelRowNo, ...rest }) => {
      const row = {};
      allColumns.forEach(({ key, colDataType }) => {
        row[key] = getColDefault(colDataType);
      });
      return { ...row, ...rest, loginid: getUserSession().loginId };
    });

    const payload = withSaveContextFields(
      buildSaveJsonFields({ label: IMUE_CONFIG.FORM_TAG, mst: mstRows }),
      { divisionId: IMUE_CONFIG.DIVISION_ID, isEdit: false },
    );

    setIsSaving(true);
    try {
      const result = await postSave(IMUE_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setFormErrors([message]);
        return false;
      }
      notify.success(message);
      localStorage.removeItem(IMUE_CONFIG.STORAGE_ENTRY_META);
      itemGridRef.current?.clearRows?.();
      setFormErrors([]);
      setItemSelectionCount(0);
      exitEditMode();
      return true;
    } catch (err) {
      console.error("[IMUE Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [allColumns, columns, exitEditMode, notify, postSave]);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    localStorage.removeItem(IMUE_CONFIG.STORAGE_ENTRY_META);
    itemGridRef.current?.clearRows?.();
    setFormErrors([]);
    setItemSelectionCount(0);
    exitEditMode();
  }, [exitEditMode]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  useEntryFormKeyboard({
    blocked: false,
    isEditMode,
    isSaving,
    addDisabled: isFetching,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onCancel: handleCancel,
  });

  const extraButtons = useMemo(() => [
    {
      key: "save",
      label: isSaving ? "Saving…" : "Save",
      Icon: Save,
      variant: "save",
      onClick: handleSave,
      disabled: isSaving || isUploading,
      loading: isSaving,
      accessKey: "s",
      title: FORM_SHORTCUT_TITLES.save,
    },
  ], [handleSave, isSaving, isUploading]);

  const itemGridConfig = {
    columns: [
      {
        id: "cb",
        name: "",
        key: "cb",
        controlType: -1,
        width: 48,
        filterable: false,
        isFixed: true,
        isEditAllow: false,
      },
      {
        id: "__excelRowNo",
        name: "Excel Row No",
        key: "__excelRowNo",
        controlType: 0,
        width: 120,
        filterable: false,
        isFixed: true,
        isEditAllow: false,
      },
      ...columns.filter((col) => col.key !== "cb"),
    ],
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50, 100] },
  };

  return (
    <div className="workspace-page workspace-page--fill imue-page">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="imue-file-input"
        onChange={handleExcelFileChange}
        aria-hidden
        tabIndex={-1}
      />

      <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
      <ConfirmDialog
        isOpen={discardOpen}
        message="Discard changes and reset the form?"
        onConfirm={handleDiscardConfirm}
        onCancel={() => setDiscardOpen(false)}
      />

      {metaError ? (
        <section className="workspace-page__filters">
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{metaError}</span>
            <button type="button" onClick={() => { fetchDetailMeta(); fetchGridColumns(); }}>
              Retry
            </button>
          </div>
        </section>
      ) : (
        <section className="imue-upload-bar">
          <div className="imue-upload-bar__title">
            <FileSpreadsheet size={16} strokeWidth={2} />
            <span>Item Master Upload Detail</span>
          </div>
          <div className="imue-upload-bar__actions">
            <button
              type="button"
              className="imue-upload-bar__btn imue-upload-bar__btn--secondary"
              onClick={handleExportExcel}
              disabled={isFetching}
              title="Export Excel with display name headers"
            >
              <Download size={14} strokeWidth={2.5} />
              Export Excel
            </button>
            <button
              type="button"
              className="imue-upload-bar__btn imue-upload-bar__btn--secondary"
              onClick={handleDownloadTemplate}
              disabled={isFetching}
              title="Download Excel template"
            >
              <Download size={14} strokeWidth={2.5} />
              Download Template
            </button>
            <button
              ref={uploadBtnRef}
              type="button"
              className="imue-upload-bar__btn"
              onClick={handleUploadClick}
              disabled={!isEditMode || isFetching || isUploading}
              title={isEditMode ? "Upload Excel file" : "Click Add below to enable upload"}
            >
              <Upload size={14} strokeWidth={2.5} />
              {isUploading ? "Reading Excel…" : "Upload Excel"}
            </button>
          </div>
        </section>
      )}

      <section className="imue-grid-section">
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={IMUE_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          headerControls={
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
          }
          hideBottomPanel
          emptyMessage={isEditMode ? "No rows yet. Click Upload Excel above." : "Click Add below to begin."}
          onSelectionChange={setItemSelectionCount}
          readOnly
          loading={isUploading}
          loaderText="Reading Excel…"
        />
      </section>

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        onCancel={handleCancel}
        addLabel="Add"
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={extraButtons}
      />
    </div>
  );
}
