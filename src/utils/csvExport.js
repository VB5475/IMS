// csvExport.js — shared CSV builder + download for list pages' Export button.
// Same quote-escaping/BOM/Blob-download approach as EntryGrid.jsx's internal
// handleExport/downloadCSV (transaction forms) — kept as a separate copy
// rather than importing from EntryGrid, since that file is wired into 36
// live transaction forms and shouldn't be touched for this list-page-only
// feature (see project_csv_export_master_lists.md).

/** columns: [{ key, label }] — label falls back to key when omitted. */
export function buildCsvContent(rows, columns) {
  const headers = columns.map((c) => c.label ?? c.key).join(",");
  const csvRows = rows.map((row) =>
    columns.map((c) => `"${String(row[c.key] ?? "").replace(/"/g, '""')}"`).join(",")
  );
  return [headers, ...csvRows].join("\n");
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/** rows/columns as returned by EnterpriseDataGrid's getExportData() ref method. */
export function exportRowsToCsv(rows, columns, filename) {
  if (!rows || rows.length === 0 || !columns || columns.length === 0) return;
  downloadCsv(filename, buildCsvContent(rows, columns));
}
