// TxnEntryFilterPanel.jsx
// ─────────────────────────────────────────────────────────────────────
// Dedicated filter panel for TxnEntryForm.
// Static-only: no GET_FILTERS / GET_FILTER_DETAIL API calls.
// Always renders the caller-supplied `filters` array immediately.
//
// Props:
//   title         — header text
//   filters       — array of filter definition objects (required)
//                   Each: { FilterParameterID, FilterColName, FilterCaption,
//                            FilterColCtrlType, staticOptions? }
//   onAddNew      — () => void — called when "Add New" is clicked
//   isAdding      — boolean — disables button while a row is being added
//   onFilterChange — (colName, value) => void — live change notification

import React, { useState, useCallback, useEffect } from 'react';
import { controlTypeMap } from '../../data/dummyData';
import SearchSelect from '../ui/SearchSelect';
import { Plus, Table2, ShoppingCart } from 'lucide-react';
import './TxnHeaderPanel.css';
import '../filters/enterprise-filter-modern.css';

// ── Single filter control ─────────────────────────────────────────────
function FilterControl({ filter, value, options, onChange }) {
  const { FilterColCtrlType, FilterCaption, FilterColName } = filter;
  const handleChange = (e) => onChange(FilterColName, e.target.value);

  switch (FilterColCtrlType) {
    case controlTypeMap.LABEL:
      return (
        <div className="tef-control">
          <span className="tef-label">{FilterCaption}</span>
          <span className="tef-value">{value || '—'}</span>
        </div>
      );

    case controlTypeMap.TEXTBOX:
      return (
        <div className="tef-control">
          <label className="tef-label" htmlFor={`tef-${FilterColName}`}>
            {FilterCaption}
          </label>
          <input
            id={`tef-${FilterColName}`}
            type="text"
            value={value || ''}
            onChange={handleChange}
            placeholder={`Enter ${FilterCaption}…`}
          />
        </div>
      );

    case controlTypeMap.DATE:
      return (
        <div className="tef-control">
          <label className="tef-label" htmlFor={`tef-${FilterColName}`}>
            {FilterCaption}
          </label>
          <input
            id={`tef-${FilterColName}`}
            type="date"
            value={value || ''}
            onChange={handleChange}
          />
        </div>
      );

    case controlTypeMap.DROPDOWN:
      return (
        <div className="tef-control">
          <label className="tef-label" htmlFor={`tef-${FilterColName}`}>
            {FilterCaption}
          </label>
          <SearchSelect
            id={`tef-${FilterColName}`}
            value={value || ''}
            onChange={(val) => onChange(FilterColName, val)}
            options={(options || []).map((opt) => {
              if (opt.value !== undefined) return { value: String(opt.value), label: opt.label };
              const valKey = opt.FilterCtrlValueCol || 'IDNumber';
              const labelKey = opt.FilterCtrlDisplayCol || 'Name';
              return { value: String(opt[valKey]), label: opt[labelKey] };
            })}
            placeholder={`-- Select ${FilterCaption} --`}
            ariaLabel={FilterCaption}
          />
        </div>
      );

    case controlTypeMap.TEXTAREA:
      return (
        <div className="tef-control">
          <label className="tef-label" htmlFor={`tef-${FilterColName}`}>
            {FilterCaption}
          </label>
          <textarea
            id={`tef-${FilterColName}`}
            value={value || ''}
            onChange={handleChange}
            placeholder={`Enter ${FilterCaption}…`}
            rows={2}
          />
        </div>
      );

    default:
      return (
        <div className="tef-control">
          <span className="tef-label">{FilterCaption}</span>
          <span className="tef-value">{value || '—'}</span>
        </div>
      );
  }
}

// ── Main component ────────────────────────────────────────────────────
export default function TxnHeaderPanel({
  title = '',
  filters = [],
  onAddNew,
  onOrderItem,          // () => void — called when Order Item is clicked
  isAdding = false,
  onFilterChange = null,
}) {
  // Local controlled values for all header fields
  const [values, setValues] = useState({});

  // Build dropdown-options map from staticOptions on each filter definition
  const [dropdownOptions, setDropdownOptions] = useState({});
  useEffect(() => {
    const optMap = {};
    filters.forEach((f) => {
      if (f.FilterColCtrlType === controlTypeMap.DROPDOWN && f.staticOptions) {
        optMap[f.FilterParameterID] = f.staticOptions;
      }
    });
    setDropdownOptions(optMap);
  }, [filters]);

  const handleChange = useCallback((colName, value) => {
    console.log("see colName:", colName)
    console.log("see value:", value)
    setValues((prev) => ({ ...prev, [colName]: value }));
    onFilterChange?.(colName, value);
  }, [onFilterChange]);

  const handleAddNewClick = useCallback(() => {
    onAddNew?.(values);
  }, [onAddNew, values]);

  // Reusable action buttons
  const ActionButtons = (
    <div className="tef-control tef-action-wrap">
      <span className="tef-label">&nbsp;</span>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Order Item button */}
        {onOrderItem && (
          <button
            className="tef-order-btn"
            onClick={() => onOrderItem?.(values)}
            disabled={isAdding}
            title="Order Item"
            aria-label="Order Item"
          >
            <ShoppingCart size={14} strokeWidth={2.5} />
            <span>Order Item</span>
          </button>
        )}
        {/* Add New button */}
        <button
          className="tef-add-btn"
          onClick={handleAddNewClick}
          disabled={isAdding}
          title="Add New"
          aria-label="Add New"
        >
          {isAdding ? (
            <>
              <div className="tef-spinner" />
              <span>Adding…</span>
            </>
          ) : (
            <>
              <Plus size={14} strokeWidth={2.5} />
              <span>Add New</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  console.log("see filters:", filters)

  return (
    <div className="tef-panel">
      <div className="fp-toolbar">
        <div className="fp-toolbar__left">
          <span className="fp-toolbar__icon">
            <Table2 size={16} strokeWidth={2} />
          </span>
          <div>
            <h2 className="fp-toolbar__title">{title}</h2>
            <span className="fp-toolbar__meta">
              {filters.length} header field{filters.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {filters.length > 0 ? (
        <div className="fp-fields">
          {filters.map((filter) => (
            <FilterControl
              key={filter.FilterParameterID}
              filter={filter}
              value={values[filter.FilterColName]}
              options={
                filter.FilterColCtrlType === controlTypeMap.DROPDOWN
                  ? dropdownOptions[filter.FilterParameterID]
                  : undefined
              }
              onChange={handleChange}
            />
          ))}
          <div className="fp-fields__actions">{ActionButtons}</div>
        </div>
      ) : (
        <div className="fp-fields">
          <div className="fp-fields__actions">{ActionButtons}</div>
        </div>
      )}
    </div>
  );
}
