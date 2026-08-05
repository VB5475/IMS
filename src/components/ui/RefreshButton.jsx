// RefreshButton.jsx — Shared "Refresh" toolbar button for list pages.
// Same conventions as PrintReportButton (identical size/shape, sits next to
// it in the toolbar) so every list page gets consistent refresh behaviour
// from one implementation — only the onClick (the page's own list refetch)
// differs per page.

import React from "react";
import { RefreshCw } from "lucide-react";
import "./RefreshButton.css";

export default function RefreshButton({
  onClick,
  loading = false,
  label = "Refresh",
  className = "",
  disabled = false,
  title,
}) {
  return (
    <button
      type="button"
      className={`refresh-btn ${className}`.trim()}
      onClick={onClick}
      disabled={disabled || loading}
      title={title ?? (loading ? "Refreshing…" : "Refresh list")}
    >
      <RefreshCw size={14} strokeWidth={2} className={loading ? "refresh-btn__icon--spin" : ""} />
      <span>{loading ? "Refreshing…" : label}</span>
    </button>
  );
}
