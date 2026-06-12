// InlineChildTable.jsx
// Compact read-only sub-table rendered inline below a parent row in EntryGrid
// when the collapsible feature is enabled (enableCollapsible prop).
//
// Horizontal scroll is isolated from the parent EntryGrid: the scroll container
// is sized to the parent .table-wrapper viewport, not the full table width.

import React, { useRef, useEffect, useCallback } from "react";
import "./InlineChildTable.css";

export default function InlineChildTable({ columns = [], rows = [] }) {
  const wrapRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const wrapEl = wrapRef.current;
    const scrollEl = scrollRef.current;
    if (!wrapEl || !scrollEl) return;

    const tableWrapper = wrapEl.closest(".table-wrapper");
    if (!tableWrapper) return;

    const syncViewport = () => {
      const viewportW = tableWrapper.clientWidth;
      wrapEl.style.setProperty("--ict-viewport-width", `${viewportW}px`);
      scrollEl.style.maxWidth = `${viewportW}px`;
    };

    syncViewport();
    const ro = new ResizeObserver(syncViewport);
    ro.observe(tableWrapper);
    window.addEventListener("resize", syncViewport);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  const handleWheel = useCallback((e) => {
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;

    const { deltaX, deltaY } = e;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

    const atLeft = el.scrollLeft <= 0;
    const atRight = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;

    if ((deltaX < 0 && !atLeft) || (deltaX > 0 && !atRight)) {
      e.stopPropagation();
    } else if ((deltaX < 0 && atLeft) || (deltaX > 0 && atRight)) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  return (
    <div className="ict-wrap" ref={wrapRef}>
      <div className="ict-indent-marker" aria-hidden="true" />
      <div className="ict-content">
        <div className="ict-header-row">
          <span className="ict-badge">
            {rows.length} indent record{rows.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="ict-scroll" ref={scrollRef} onWheel={handleWheel}>
          <table className="ict-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} style={col.width ? { minWidth: col.width } : undefined}>
                    {col.name ?? col.label ?? col.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="ict-empty">
                    No child records.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row.id ?? idx}>
                    {columns.map((col) => (
                      <td key={col.key}>{row[col.key] ?? "—"}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
