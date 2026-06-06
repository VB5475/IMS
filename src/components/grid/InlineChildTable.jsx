// InlineChildTable.jsx
// Compact read-only sub-table rendered inline below a parent row in EntryGrid
// when the collapsible feature is enabled (enableCollapsible prop).
//
// Columns accept either EntryGrid format { key, name, width } or simple
// { key, label, width } — whichever field exists is used as the header text.

import React from 'react';
import './InlineChildTable.css';

export default function InlineChildTable({ columns = [], rows = [] }) {
  return (
    <div className="ict-wrap">
      <div className="ict-indent-marker" aria-hidden="true" />
      <div className="ict-content">
        <div className="ict-header-row">
          <span className="ict-badge">{rows.length} indent record{rows.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="ict-scroll">
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
                      <td key={col.key}>{row[col.key] ?? '—'}</td>
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
