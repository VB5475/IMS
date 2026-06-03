// POTermsPanel.jsx
// Terms Conditions section for Purchase Order.
// Grid: Sr No | Terms Type | Code | Terms  (editable, + Add / Delete)

import React, { useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import './POTermsPanel.css';

let _rowId = 0;
const newId       = () => ++_rowId;
const blankRow    = () => ({ id: newId(), termsType: '', code: '', terms: '' });

function EditCell({ value, onChange, wide = false }) {
  return (
    <input
      type="text"
      className={`pot-cell-input${wide ? ' pot-cell-input--wide' : ''}`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function POTermsPanel() {
  const [rows,    setRows]    = useState([blankRow()]);
  const [selIds,  setSelIds]  = useState(new Set());

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, blankRow()]);
  }, []);

  const deleteRows = useCallback(() => {
    setRows((prev) => prev.filter((r) => !selIds.has(String(r.id))));
    setSelIds(new Set());
  }, [selIds]);

  const changeRow = useCallback((id, key, value) => {
    setRows((prev) => prev.map((r) => String(r.id) === String(id) ? { ...r, [key]: value } : r));
  }, []);

  const toggleRow = useCallback((id) => {
    const sid = String(id);
    setSelIds((prev) => { const n = new Set(prev); n.has(sid) ? n.delete(sid) : n.add(sid); return n; });
  }, []);

  const toggleAll = useCallback(() => {
    const all = rows.map((r) => String(r.id));
    setSelIds(all.every((id) => selIds.has(id)) ? new Set() : new Set(all));
  }, [rows, selIds]);

  const allSelected = rows.length > 0 && rows.every((r) => selIds.has(String(r.id)));

  return (
    <div className="pot-panel">
      <div className="pot-section__bar">
        <span className="pot-section__label">Terms Conditions</span>
        <div className="pot-section__actions">
          <button type="button" className="pot-btn pot-btn--primary" onClick={addRow} title="Add terms row">
            <Plus size={12} strokeWidth={2.5} />
            Add To Do List
          </button>
          <button type="button" className="pot-btn pot-btn--danger" onClick={deleteRows} disabled={selIds.size === 0} title="Delete selected">
            <Trash2 size={12} strokeWidth={2} />
            Delete
          </button>
        </div>
      </div>

      <div className="pot-grid-wrap">
        <table className="pot-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th style={{ width: 60 }}>Sr No</th>
              <th style={{ minWidth: 140 }}>Terms Type</th>
              <th style={{ minWidth: 90 }}>Code</th>
              <th>Terms</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className={selIds.has(String(row.id)) ? 'pot-row--selected' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={selIds.has(String(row.id))}
                    onChange={() => toggleRow(row.id)}
                    aria-label={`Select row ${row.id}`}
                  />
                </td>
                <td className="pot-cell--index">{idx + 1}</td>
                <td><EditCell value={row.termsType} onChange={(v) => changeRow(row.id, 'termsType', v)} /></td>
                <td><EditCell value={row.code}      onChange={(v) => changeRow(row.id, 'code', v)} /></td>
                <td><EditCell value={row.terms}     onChange={(v) => changeRow(row.id, 'terms', v)} wide /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
