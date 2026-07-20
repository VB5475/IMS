// PrintReportButton.jsx — Shared "Print" toolbar button for list pages.
// Wraps useReportPrint so every list page (Item Master, Main Group Master,
// Gate Pass In/Out, etc.) gets identical behaviour from one implementation —
// only reportTitle / reportFileName / buildParams differ per page.

import React, { useCallback } from "react";
import { Printer } from "lucide-react";
import { useReportPrint } from "../../hooks/useReportPrint";
import { useNotification } from "../../context/NotificationContext";
import "./PrintReportButton.css";

export default function PrintReportButton({
  reportTitle,
  reportFileName,
  buildParams,
  label = "Print",
  className = "",
  disabled = false,
}) {
  const { printReport, printing } = useReportPrint();
  const notify = useNotification();

  const handleClick = useCallback(async () => {
    try {
      await printReport({
        reportTitle,
        reportFileName,
        jsonParameters: buildParams?.() ?? [],
      });
    } catch (err) {
      notify.error(err?.message || "Failed to generate report.");
    }
  }, [printReport, reportTitle, reportFileName, buildParams, notify]);

  return (
    <button
      type="button"
      className={`print-report-btn ${className}`.trim()}
      onClick={handleClick}
      disabled={disabled || printing}
      title={printing ? "Generating report…" : `Print ${reportTitle}`}
    >
      <Printer size={14} strokeWidth={2} />
      <span>{printing ? "Printing…" : label}</span>
    </button>
  );
}
