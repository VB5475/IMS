// PIBottomTabPanel.jsx
// Two-tab panel below the Item Detail grid:
//   Suppliers | Term And Conditions
// Indent Details is a separate CollapsibleGrid (child grid of the item row).
// Suppliers tab has an "Approved" dropdown filter + Delete button.

import React, { useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import SearchSelect from '../ui/SearchSelect';
import './PIBottomTabPanel.css';

const TABS = [
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'terms',     label: 'Term And Conditions' },
];

const APPROVED_OPTS = [
  { value: 'all',      label: 'All' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending',  label: 'Pending' },
];

// ── Suppliers sub-grid ────────────────────────────────────────────────
function SuppliersGrid({ rows, selectedIds, onSelect, onSelectAll }) {
  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => selectedIds.has(String(r.id)));

  return (
    <div className="pi-tab-grid-wrap">
      <table className="pi-tab-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={onSelectAll}
                aria-label="Select all suppliers"
              />
            </th>
            <th>Sr.No</th>
            <th>Supplier Name</th>
            <th>Address</th>
            <th>City</th>
            <th>Mobile NO.</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="pi-tab-empty">No suppliers added.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className={selectedIds.has(String(row.id)) ? 'pi-tab-row--selected' : ''}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(String(row.id))}
                    onChange={() => onSelect(row.id)}
                    aria-label={`Select supplier ${row.id}`}
                  />
                </td>
                <td>{row.SrNo}</td>
                <td>{row.SupplierName}</td>
                <td>{row.Address}</td>
                <td>{row.City}</td>
                <td>{row.MobileNo}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Terms sub-grid ────────────────────────────────────────────────────
function TermsGrid({ rows }) {
  return (
    <div className="pi-tab-grid-wrap">
      <table className="pi-tab-table">
        <thead>
          <tr>
            <th>Sr.No</th>
            <th>Terms Type</th>
            <th>Code</th>
            <th>Terms &amp; Conditions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="pi-tab-empty">No terms &amp; conditions added.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>{row.SrNo}</td>
                <td>{row.TermsType}</td>
                <td>{row.Code}</td>
                <td>{row.TermsConditions}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function PIBottomTabPanel({
  supplierRows = [],
  termsRows = [],
  onDeleteSuppliers,
}) {
  const [activeTab, setActiveTab]   = useState('suppliers');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [approvedFilter, setApprovedFilter] = useState('all');

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setSelectedIds(new Set());
  }, []);

  const handleSelect = useCallback((id) => {
    const sid = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const currentRows = activeTab === 'suppliers' ? supplierRows : [];
    const allIds = currentRows.map((r) => String(r.id));
    if (allIds.length > 0 && allIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [activeTab, supplierRows, selectedIds]);

  const handleDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    onDeleteSuppliers?.(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, onDeleteSuppliers]);

  return (
    <div className="pi-tab-panel">
      {/* Tab bar + Suppliers controls */}
      <div className="pi-tab-bar">
        <div className="pi-tab-bar__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`pi-tab-btn ${activeTab === tab.id ? 'pi-tab-btn--active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Suppliers controls — only shown on Suppliers tab */}
        {activeTab === 'suppliers' && (
          <div className="pi-tab-bar__controls">
            <div className="pi-tab-filter">
              <span className="pi-tab-filter__label">Approved</span>
              <SearchSelect
                value={approvedFilter}
                onChange={setApprovedFilter}
                options={APPROVED_OPTS}
                compact
                ariaLabel="Approved filter"
              />
            </div>
            <button
              type="button"
              className="pi-tab-delete-btn"
              onClick={handleDelete}
              disabled={selectedIds.size === 0}
              title="Delete selected suppliers"
            >
              <Trash2 size={12} strokeWidth={2} />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="pi-tab-content">
        {activeTab === 'suppliers' && (
          <SuppliersGrid
            rows={supplierRows}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
          />
        )}
        {activeTab === 'terms' && <TermsGrid rows={termsRows} />}
      </div>
    </div>
  );
}
