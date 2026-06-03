// CollapsibleGrid.jsx
// Generic collapsible table grid — shared across any page that needs
// an expandable/collapsible data section.
//
// Props:
//   title             {string}   — main heading
//   subtitle          {string}   — italic sub-label
//   columns           {Array}    — [{ key, label, width? }]
//   rows              {Array}    — data rows; each row needs a unique `id` field
//   defaultExpanded   {boolean}  — start open (default false)
//   selectable        {boolean}  — adds a checkbox column for row selection
//   onDeleteSelected  {Function} — (ids: string[]) => void; shows Delete button when provided

import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import './CollapsibleGrid.css';

export default function CollapsibleGrid({
  title = 'Details',
  subtitle = '',
  columns = [],
  rows = [],
  defaultExpanded = false,
  selectable = false,
  onDeleteSelected = null,
}) {
  const [expanded,    setExpanded]    = useState(defaultExpanded);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const handleSelect = useCallback((id) => {
    const sid = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = rows.map((r) => String(r.id ?? r));
    if (allIds.length > 0 && allIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [rows, selectedIds]);

  const handleDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    onDeleteSelected?.(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, onDeleteSelected]);

  const showCheckbox = selectable || !!onDeleteSelected;
  const allSelected  = rows.length > 0 && rows.every((r) => selectedIds.has(String(r.id ?? r)));

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
                  {showCheckbox && (
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </th>
                  )}
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
                    <td colSpan={columns.length + (showCheckbox ? 1 : 0)} className="cg-empty">
                      No data available.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => {
                    const rowId = String(row.id ?? idx);
                    return (
                      <tr
                        key={rowId}
                        className={selectedIds.has(rowId) ? 'cg-row--selected' : ''}
                      >
                        {showCheckbox && (
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(rowId)}
                              onChange={() => handleSelect(rowId)}
                              aria-label={`Select row ${rowId}`}
                            />
                          </td>
                        )}
                        {columns.map((col) => (
                          <td key={col.key}>{row[col.key] ?? '—'}</td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Delete bar — shown only when onDeleteSelected is provided */}
          {onDeleteSelected && (
            <div className="cg-delete-bar">
              <button
                type="button"
                className="cg-delete-btn"
                onClick={handleDelete}
                disabled={selectedIds.size === 0}
                title="Delete selected rows"
              >
                <Trash2 size={12} strokeWidth={2} />
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
