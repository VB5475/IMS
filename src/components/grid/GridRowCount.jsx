import React from "react";
import "./GridRowCount.css";

/** Row count badge — shown beside search, not inside the search field. */
export default function GridRowCount({ matchCount = 0, totalCount = 0, label = "rows" }) {
  const isNarrowed = matchCount !== totalCount;
  const countText = isNarrowed ? `${matchCount} / ${totalCount}` : String(totalCount);

  return (
    <span className="grid-row-count" aria-live="polite" title={`${countText} ${label}`}>
      <strong>{countText}</strong>
      <span className="grid-row-count__label">{label}</span>
    </span>
  );
}
