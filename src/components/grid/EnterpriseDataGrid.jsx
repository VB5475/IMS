// NormalGrid.jsx — updated to use shared ColumnFilter component
// Changes from original:
//   • Header filter dropdowns replaced with the shared ColumnFilter popup
//   • columnFilters state uses the same shape as GridForm (Set / range objects)
//   • applyColumnFilterValue + isFilterActive imported from ColumnFilter.jsx
//   • filterType on each column controls which filter UI renders
//     ('list' | 'date' | 'number' | 'text')

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import Loader from '../ui/Loader';
import ColumnFilter, { applyColumnFilterValue, isFilterActive } from './Columnfilter';
import './EnterpriseDataGrid.css';

/**
 * NormalGrid — a reusable paginated data-grid card.
 *
 * Props
 * ─────
 * title          {string}          Card header title
 * icon           {ReactNode}       Icon rendered beside the title
 * columns        {Column[]}        Column definitions (see shape below)
 * data           {object[]}        Raw row data
 * loading        {boolean}         Show loader overlay
 * error          {string|null}     Error message to display
 * onRowClick     {(row) => void}   Called when a row or link-cell is clicked
 * loaderText     {string}          Loader label  (default: 'Loading…')
 * defaultPageSize{number}          Initial rows per page (default: 10)
 * pageSizeOptions{number[]}        Rows-per-page choices (default: [5,10,20,50,99])
 * emptyMessage   {string}          Empty-state text (default: 'No records found.')
 *
 * Column shape
 * ────────────
 * {
 *   key         : string,
 *   label       : string,
 *   width?      : string,              // CSS width, e.g. '36%'
 *   filterable? : boolean,             // show filter icon in header
 *   filterType? : 'list'|'date'|'number'|'text',  // default 'list'
 *   dropdownOptions?: array,           // for 'list' type — same shape as GridForm
 *   align?      : 'left'|'center'|'right',
 *   isLink?     : boolean,
 *   badge?      : (value, row) => 'danger'|'warning'|'success'|'neutral',
 *   render?     : (value, row) => ReactNode,
 * }
 */
function EnterpriseDataGrid({
  title,
  icon,
  columns = [],
  data = [],
  loading = false,
  error = null,
  onRowClick,
  loaderText = 'Loading…',
  defaultPageSize = 10,
  pageSizeOptions = [5, 10, 20, 50, 99],
  pageSize: pageSizeProp,
  onPageSizeChange,
  emptyMessage = 'No records found.',
  hideHeader = false,
  fill = false,
}) {
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);
  const itemsPerPage = pageSizeProp ?? internalPageSize;

  const setItemsPerPage = useCallback((next) => {
    const value = typeof next === 'function' ? next(itemsPerPage) : next;
    if (onPageSizeChange) onPageSizeChange(value);
    else setInternalPageSize(value);
    setCurrentPage(1);
  }, [itemsPerPage, onPageSizeChange]);

  // One ref per column for anchor positioning — keyed by col.key
  const filterButtonRefs = useRef({});
  const getFilterRef = useCallback((key) => {
    if (!filterButtonRefs.current[key]) {
      filterButtonRefs.current[key] = React.createRef();
    }
    return filterButtonRefs.current[key];
  }, []);

  /* ── Filter toggle ────────────────────────────────────────────────── */
  const toggleFilter = useCallback((colKey) => {
    setActiveFilterCol(prev => (prev === colKey ? null : colKey));
  }, []);

  const handleFilterChange = useCallback((colKey, value) => {
    setColumnFilters(prev => ({ ...prev, [colKey]: value }));
    setCurrentPage(1);
  }, []);

  const handleFilterClear = useCallback((colKey) => {
    setColumnFilters(prev => { const n = { ...prev }; delete n[colKey]; return n; });
    setCurrentPage(1);
  }, []);

  /* ── Apply all column filters ─────────────────────────────────────── */
  const filteredData = useMemo(() => {
    let result = [...data];
    Object.entries(columnFilters).forEach(([key, filterValue]) => {
      const col = columns.find(c => c.key === key);
      result = applyColumnFilterValue(result, key, filterValue, col);
    });
    return result;
  }, [data, columnFilters, columns]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));

  const currentData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  /* ── Cell renderer ────────────────────────────────────────────────── */
  const renderCell = (col, row) => {
    const value = row[col.key];
    if (col.render) return col.render(value, row);
    if (col.badge) {
      const variant = col.badge(value, row);
      return <span className={`ng-badge ng-badge--${variant}`}>{value}</span>;
    }
    if (col.isLink) {
      return (
        <span className="ng-link" onClick={e => { e.stopPropagation(); onRowClick?.(row); }}>
          {value}
        </span>
      );
    }
    return value ?? '—';
  };

  const rowIsClickable = onRowClick && !columns.some(c => c.isLink);
  const cellAlign = (col, colIndex) => col.align ?? (colIndex === 0 ? 'left' : 'center');

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className={`ng-card ${fill ? 'ng-card--fill' : ''}`}>
      {/* ── header ── */}
      {!hideHeader && (
      <div className="ng-card-header">
        <h2 className="ng-card-title">
          {icon && <span className="ng-card-icon">{icon}</span>}
          {title}
        </h2>
        <div className="ng-pagesize-wrapper">
          <label htmlFor="ng-pagesize-select">Show</label>
          <select
            id="ng-pagesize-select"
            className="ng-select"
            value={itemsPerPage}
            onChange={e => setItemsPerPage(Number(e.target.value))}
          >
            {pageSizeOptions.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <label htmlFor="ng-pagesize-select">entries</label>
        </div>
      </div>
      )}

      {/* ── body ── */}
      <div className="ng-card-content">
        {loading ? (
          <Loader text={loaderText} />
        ) : error ? (
          <div className="ng-error">{error}</div>
        ) : (
          <>
            <div className="ng-table-wrapper">
              <table className="ng-table">
                <colgroup>
                  {columns.map((col, i) => (
                    <col key={i} style={col.width ? { width: col.width } : undefined} />
                  ))}
                </colgroup>

                <thead>
                  <tr>
                    {columns.map((col, i) => {
                      const active = isFilterActive(columnFilters[col.key]);
                      const filterRef = col.filterable ? getFilterRef(col.key) : null;
                      return (
                        <th key={i} style={{ textAlign: cellAlign(col, i) }}>
                          <div className="ng-th-inner">
                            <span className="ng-th-label">{col.label}</span>
                            {col.filterable && (
                              <span
                                ref={filterRef}
                                className={`ng-filter-icon ${active ? 'ng-filter-icon--active' : ''}`}
                                onClick={() => toggleFilter(col.key)}
                                role="button"
                                aria-label={`Filter ${col.label}`}
                                title={`Filter ${col.label}`}
                              >
                                <Filter size={11} color='#162d5c' />
                              </span>
                            )}
                          </div>
                          {/* Active filter indicator */}
                          {active && <span className="ng-filter-dot" aria-label="Filter active" />}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {currentData.length > 0 ? (
                    currentData.map((row, ri) => (
                      <tr
                        key={ri}
                        className={rowIsClickable ? 'ng-row--clickable' : ''}
                        onClick={rowIsClickable ? () => onRowClick(row) : undefined}
                      >
                        {columns.map((col, ci) => (
                          <td
                            key={ci}
                            style={{ textAlign: cellAlign(col, ci) }}
                            data-col={col.key}
                          >
                            {renderCell(col, row)}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columns.length} className="ng-empty-cell">
                        {emptyMessage}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── pagination bar ── */}
            {filteredData.length > 0 && (
              <div className="ng-bottom-panel">
                <p className="ng-pagination-info">
                  Showing{' '}
                  <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> –{' '}
                  <strong>{Math.min(currentPage * itemsPerPage, filteredData.length)}</strong>{' '}
                  of <strong>{filteredData.length}</strong> entries
                  {filteredData.length !== data.length && ` (filtered from ${data.length})`}
                </p>
                <div className="ng-pagination-controls">
                  <button
                    className="ng-page-btn"
                    onClick={() => setCurrentPage(p => p - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <button
                    className="ng-page-btn"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Filter popup (portaled to body) ── */}
      {activeFilterCol && (() => {
        const col = columns.find(c => c.key === activeFilterCol);
        if (!col) return null;
        return (
          <ColumnFilter
            col={col}
            allRows={data}
            value={columnFilters[activeFilterCol]}
            onChange={handleFilterChange}
            onClear={handleFilterClear}
            onClose={() => setActiveFilterCol(null)}
            anchorRef={getFilterRef(activeFilterCol)}
          />
        );
      })()}
    </div>
  );
}

export default EnterpriseDataGrid;