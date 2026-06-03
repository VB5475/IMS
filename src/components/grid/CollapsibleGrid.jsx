// CollapsibleGrid.jsx
// Generic collapsible table grid — shared across any page that needs
// an expandable/collapsible data section (e.g. Levy Details, Indent Details).
//
// Props:
//   title    {string}  — main heading (e.g. "Levy Details")
//   subtitle {string}  — italic sub-label (e.g. "(Collapsible Grid Of Item Grid)")
//   columns  {Array}   — [{ key, label, width? }]
//   rows     {Array}   — data rows; each row must have a field per column key
//   defaultExpanded {boolean} — whether to start open (default false)

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import './CollapsibleGrid.css';

export default function CollapsibleGrid({
  title = 'Details',
  subtitle = '',
  columns = [],
  rows = [],
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="cg-panel">
      <button
        type="button"
        className="cg-header"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="cg-header__chevron">
          {expanded
            ? <ChevronDown  size={13} strokeWidth={2.5} />
            : <ChevronRight size={13} strokeWidth={2.5} />}
        </span>
        <span className="cg-header__title">{title}</span>
        {subtitle && <span className="cg-header__sub">{subtitle}</span>}
        <span className="cg-header__badge">{rows.length}</span>
      </button>

      {expanded && (
        <div className="cg-body">
          <div className="cg-grid-wrap">
            <table className="cg-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} style={col.width ? { minWidth: col.width } : undefined}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="cg-empty">
                      No data available.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr key={row.id ?? idx}>
                      {columns.map((col) => (
                        <td key={col.key}>{row[col.key] ?? '—'}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
