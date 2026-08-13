// ExportCsvButton.jsx — Shared "Export CSV" toolbar button for list pages.
// Same conventions as RefreshButton/PrintReportButton (identical size/shape,
// sits next to them in the toolbar) — only the onClick (the page's own
// export handler, see ListPanelHeader's onExportCsv prop) differs per page.

import React from "react";
import { Download } from "lucide-react";
import "./ExportCsvButton.css";

export default function ExportCsvButton({ onClick, disabled = false, label = "Export CSV" }) {
  return (
    <button
      type="button"
      className="export-csv-btn"
      onClick={onClick}
      disabled={disabled}
      title="Export all matching records as CSV"
    >
      <Download size={14} strokeWidth={2} />
      <span>{label}</span>
    </button>
  );
}
