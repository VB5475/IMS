// POItemDetailPanel.jsx
// Item-wise collapsible panel with 3 tabbed sub-grids for Purchase Order.
// Sits directly below the Item Grid. Auto-expands when exactly one item row
// is checked above; clears when selection is removed.
//
// Tabs:
//   1. Levy Details       — 10 columns
//   2. Delivery Schedule  — 4 columns
//   3. Indent Detail      — 9 columns + selectable rows + Delete

import React, { useState, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import './POItemDetailPanel.css';

// ── Column definitions ────────────────────────────────────────────────

const LEVY_COLS = [
  { key: 'LevyType',          label: 'Levy Type',           width: 110 },
  { key: 'LevyName',          label: 'Levy Name',           width: 120 },
  { key: 'ValueType',         label: 'Value Type',          width: 95  },
  { key: 'AscAmountBase',     label: 'Asc Amount (Base)',   width: 130 },
  { key: 'Total',             label: 'Total',               width: 80  },
  { key: 'BaseTotal',         label: 'Base Total',          width: 90  },
  { key: 'PaidBySupplier',    label: 'Paid By Supplier',    width: 115 },
  { key: 'CreditNotRequired', label: 'Credit Not Required', width: 135 },
  { key: 'BifercationAmount', label: 'Bifercation Amount',  width: 135 },
  { key: 'Remarks',           label: 'Remarks',             width: 110 },
];

const DELIVERY_COLS = [
  { key: 'DeliveryAt', label: 'Delivery At', width: 150 },
  { key: 'Quantity',   label: 'Quantity',    width: 95  },
  { key: 'Date',       label: 'Date',        width: 105 },
  { key: 'Remarks',    label: 'Remarks',     width: 150 },
];

const INDENT_COLS = [
  { key: 'IndentNo',        label: 'Indent No',         width: 100 },
  { key: 'Department',      label: 'Department',         width: 120 },
  { key: 'IndentDate',      label: 'Indent Date',        width: 100 },
  { key: 'ItemName',        label: 'Item Name',          width: 160 },
  { key: 'IndentQty',       label: 'Indent Qty',         width: 90  },
  { key: 'ExecutedQty',     label: 'Executed Qty',       width: 100 },
  { key: 'Quantity',        label: 'Quantity',           width: 85  },
  { key: 'Unit',            label: 'Unit',               width: 75  },
  { key: 'ExpDeliveryDate', label: 'Exp Delivery Date',  width: 125 },
];

const TABS = [
  { id: 'levy',     label: 'Levy Details'      },
  { id: 'delivery', label: 'Delivery Schedule' },
  { id: 'indent',   label: 'Indent Detail'     },
];

// ── Generic read-only sub-grid ────────────────────────────────────────
function SubGrid({ cols, rows, emptyMsg }) {
  return (
    <div className="pod-grid-wrap">
      <table className="pod-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} style={{ minWidth: c.width }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className="pod-empty">{emptyMsg}</td>
            </tr>
          ) : rows.map((row, idx) => (
            <tr key={row.id ?? idx}>
              {cols.map((c) => <td key={c.key}>{row[c.key] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Indent Detail tab — selectable rows + Delete ──────────────────────
function IndentTab({ rows, onDeleteSelected }) {
  const [selIds, setSelIds] = useState(new Set());

  const toggle = useCallback((id) => {
    const sid = String(id);
    setSelIds((prev) => {
      const n = new Set(prev);
      n.has(sid) ? n.delete(sid) : n.add(sid);
      return n;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const all = rows.map((r) => String(r.id ?? r));
    setSelIds(all.every((id) => selIds.has(id)) ? new Set() : new Set(all));
  }, [rows, selIds]);

  const handleDelete = useCallback(() => {
    onDeleteSelected?.(Array.from(selIds));
    setSelIds(new Set());
  }, [selIds, onDeleteSelected]);

  const allSelected = rows.length > 0 && rows.every((r) => selIds.has(String(r.id ?? r)));

  return (
    <>
      <div className="pod-grid-wrap">
        <table className="pod-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              {INDENT_COLS.map((c) => (
                <th key={c.key} style={{ minWidth: c.width }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={INDENT_COLS.length + 1} className="pod-empty">
                  No indent detail records for this item.
                </td>
              </tr>
            ) : rows.map((row, idx) => {
              const sid = String(row.id ?? idx);
              return (
                <tr key={sid} className={selIds.has(sid) ? 'pod-row--selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selIds.has(sid)}
                      onChange={() => toggle(sid)}
                      aria-label={`Select row ${sid}`}
                    />
                  </td>
                  {INDENT_COLS.map((c) => <td key={c.key}>{row[c.key] ?? '—'}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pod-tab-footer">
        <button
          type="button"
          className="pod-delete-btn"
          onClick={handleDelete}
          disabled={selIds.size === 0}
          title="Delete selected indent rows"
        >
          <Trash2 size={12} strokeWidth={2} />
          Delete
        </button>
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function POItemDetailPanel({
  selectedItem   = null,
  levyRows       = [],
  deliveryRows   = [],
  indentRows     = [],
  onDeleteIndentRows,
}) {
  const [expanded,  setExpanded]  = useState(false);
  const [activeTab, setActiveTab] = useState('levy');

  // Auto-expand when an item is selected; collapse when cleared
  useEffect(() => {
    if (selectedItem) setExpanded(true);
    else setExpanded(false);
  }, [selectedItem]);

  const itemLabel = selectedItem
    ? `${selectedItem.ItemCode || ''} ${selectedItem.ItemName ? `— ${selectedItem.ItemName}` : ''}`.trim()
    : null;

  return (
    <div className={`pod-panel${expanded ? ' pod-panel--open' : ''}`}>

      {/* ── Collapse header ── */}
      <button
        type="button"
        className="pod-header"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        disabled={!selectedItem}
        title={selectedItem ? 'Toggle item detail' : 'Select one item row above'}
      >
        <span className="pod-header__chevron">
          {expanded
            ? <ChevronDown  size={13} strokeWidth={2.5} />
            : <ChevronRight size={13} strokeWidth={2.5} />}
        </span>
        <span className="pod-header__title">Item Details</span>
        {itemLabel
          ? <span className="pod-header__item">{itemLabel}</span>
          : <span className="pod-header__hint">Select one item row above to view linked details</span>}
      </button>

      {/* ── Expanded body ── */}
      {expanded && selectedItem && (
        <div className="pod-body">

          {/* Tab bar */}
          <div className="pod-tab-bar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`pod-tab-btn${activeTab === tab.id ? ' pod-tab-btn--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="pod-tab-content">
            {activeTab === 'levy' && (
              <SubGrid
                cols={LEVY_COLS}
                rows={levyRows}
                emptyMsg="No levy details for this item."
              />
            )}
            {activeTab === 'delivery' && (
              <SubGrid
                cols={DELIVERY_COLS}
                rows={deliveryRows}
                emptyMsg="No delivery schedule for this item."
              />
            )}
            {activeTab === 'indent' && (
              <IndentTab
                rows={indentRows}
                onDeleteSelected={onDeleteIndentRows}
              />
            )}
          </div>

        </div>
      )}
    </div>
  );
}
