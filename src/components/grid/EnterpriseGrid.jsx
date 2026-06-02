import React, { useState, useMemo, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import SearchSelect from '../ui/SearchSelect';
import BottomControlPanel from './GridBottomPanel';
import { Filter, X, ChevronDown } from 'lucide-react';

import './EnterpriseGrid.css';
import { isColumnFixed, getColumnCellClass, getColumnHeaderThemeClass } from './gridColumnClass';

const generateId = () => Math.random().toString(36).substr(2, 9);

const operatorsByType = {
  text: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts', label: 'Starts With' },
    { value: 'ends', label: 'Ends With' },
    { value: 'empty', label: 'Is Empty' },
    { value: 'notempty', label: 'Is Not Empty' }
  ],
  number: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not Equals' },
    { value: 'gt', label: 'Greater Than' },
    { value: 'lt', label: 'Less Than' },
    { value: 'gte', label: 'Greater Than or Equal' },
    { value: 'lte', label: 'Less Than or Equal' },
    { value: 'empty', label: 'Is Empty' },
    { value: 'notempty', label: 'Is Not Empty' }
  ],
  date: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not Equals' },
    { value: 'gt', label: 'After' },
    { value: 'lt', label: 'Before' },
    { value: 'gte', label: 'On or After' },
    { value: 'lte', label: 'On or Before' },
    { value: 'empty', label: 'Is Empty' },
    { value: 'notempty', label: 'Is Not Empty' }
  ],
  select: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not Equals' },
    { value: 'empty', label: 'Is Empty' },
    { value: 'notempty', label: 'Is Not Empty' }
  ]
};

function evaluateFilter(rowValue, operator, filterValue) {
  const val = rowValue == null ? '' : String(rowValue).toLowerCase();
  const fVal = filterValue == null ? '' : String(filterValue).toLowerCase();
  const numVal = Number(rowValue);
  const fNum = Number(filterValue);
  switch (operator) {
    case 'eq': return val === fVal;
    case 'ne': return val !== fVal;
    case 'contains': return val.includes(fVal);
    case 'starts': return val.startsWith(fVal);
    case 'ends': return val.endsWith(fVal);
    case 'gt': return !isNaN(numVal) && !isNaN(fNum) && numVal > fNum;
    case 'lt': return !isNaN(numVal) && !isNaN(fNum) && numVal < fNum;
    case 'gte': return !isNaN(numVal) && !isNaN(fNum) && numVal >= fNum;
    case 'lte': return !isNaN(numVal) && !isNaN(fNum) && numVal <= fNum;
    case 'empty': return val === '';
    case 'notempty': return val !== '';
    default: return true;
  }
}

function downloadCSV(filename, csvContent) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function toPixels(w) {
  if (typeof w === 'number') return w;
  if (typeof w === 'string') return parseInt(w, 10) || 0;
  return 0;
}

// ─── Date Helpers ─────────────────────────────────────────────────────────
function formatDateForInput(isoString) {
  if (!isoString) return '';
  if (typeof isoString === 'string' && isoString.includes('T')) {
    return isoString.split('T')[0];
  }
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function parseDateFromInput(dateString) {
  if (!dateString) return '';
  return `${dateString}T00:00:00`;
}

// ── Columns that trigger onCellEvent on Tab key ────────────────────────────
const EVENT_COLUMNS = new Set([
  'ItemID', 'TranQty', 'BaseQty', 'BaseRate', 'TranRate',
  'DiscPerc', 'Expense', 'GSTPerc',
]);

const GridForm = forwardRef(function GridForm(
  { config, initialData, title = 'Grid Form', onSave, mode = 'view', onCellEvent },
  ref
) {
  // mode: 'view' (default) — read/edit existing data with filter row
  //        'entry'         — blank grid, no filter row, rows added via Add New
  const { columns, pagination } = config;
  const { pageSize: defaultPageSize = 10, pageSizeOptions = [10, 25, 50, 100] } = pagination || {};

  const [rows, setRows] = useState(initialData);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [columnFilters, setColumnFilters] = useState({});
  const [headerFilters, setHeaderFilters] = useState({});
  const [customFilters, setCustomFilters] = useState([]);
  const [showCustomFilter, setShowCustomFilter] = useState(false);
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const [columnWidths, setColumnWidths] = useState(() => {
    const map = {};
    columns.forEach(c => { map[c.id] = c.width; });
    return map;
  });
  const [resizing, setResizing] = useState(null);

  const rowsRef = useRef(initialData);
  const tableWrapperRef = useRef(null);
  const popupRef = useRef(null);

  // Keep rowsRef current so Tab-key closures always read the latest row data
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // In 'view' mode: reset whenever parent pushes new data (e.g. after search).
  // In 'entry' mode: only seed once on mount; rows are managed internally.
  useEffect(() => {
    if (mode !== 'entry') {
      setRows(initialData || []);
      setPage(1);
      setSelectedIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]); // intentionally exclude mode — entry never re-seeds

  // ── Imperative handle: expose addRow() to parent refs (entry mode) ──
  useImperativeHandle(ref, () => ({
    /** Append a pre-built blank row object to the grid */
    addRow(blankRow) {
      setRows(prev => [...prev, blankRow]);
    },
    /** Expose current rows so parent can read them for save */
    getRows() {
      return rows;
    },
    /** Merge updated fields into a specific row (used after cell-event API) */
    updateRow(rowId, updatedFields) {
      setRows(prev =>
        prev.map(r =>
          String(r.id) === String(rowId) ? { ...r, ...updatedFields } : r
        )
      );
    },
  }), [rows]);

  // ─── Column Resize Logic ─────────────────────────────────────────────────
  const handleResizeStart = useCallback((e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = toPixels(columnWidths[colId] || columns.find(c => c.id === colId)?.width || 120);
    setResizing({ colId, startX: e.clientX, startWidth });
  }, [columnWidths, columns]);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e) => {
      const diff = e.clientX - resizing.startX;
      const newWidth = Math.max(60, resizing.startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [resizing.colId]: newWidth }));
    };
    const handleUp = () => setResizing(null);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

  // ─── Fixed column left offsets (recalculates on resize) ───────────────────
  const fixedLeftMap = useMemo(() => {
    const map = {};
    let left = 0;
    columns.forEach(col => {
      if (isColumnFixed(col)) {
        map[col.id] = left;
        left += toPixels(columnWidths[col.id] || col.width) || 120;
      }
    });
    return map;
  }, [columns, columnWidths]);

  const lastFixedColId = useMemo(() => {
    const fixed = columns.filter(c => isColumnFixed(c));
    return fixed.length > 0 ? fixed[fixed.length - 1].id : null;
  }, [columns]);

  // ─── Helper: map raw dropdown value to its display label ─────────────────
  const getDropdownLabel = useCallback((col, rawValue) => {
    if (col.controlType !== 4 || !col.dropdownOptions) return rawValue;
    const opts = col.dropdownOptions.map(opt => {
      if (typeof opt === 'string') return { value: opt, label: opt };
      if (opt && typeof opt === 'object') {
        if (opt.value !== undefined) return { value: String(opt.value), label: opt.label || String(opt.value) };
        return { value: String(opt.ObjDetID ?? opt), label: opt.Name ?? String(opt) };
      }
      return { value: String(opt), label: String(opt) };
    });
    const found = opts.find(o => String(o.value) === String(rawValue));
    return found ? found.label : rawValue;
  }, []);

  const processedRows = useMemo(() => {
    let data = [...rows];
    Object.entries(headerFilters).forEach(([key, text]) => {
      if (!text) return;
      const lower = text.toLowerCase();
      data = data.filter(r => String(r[key] ?? '').toLowerCase().includes(lower));
    });
    Object.entries(columnFilters).forEach(([key, filter]) => {
      if (!filter) return;
      if (filter instanceof Set) {
        if (filter.size === 0) return;
        data = data.filter(r => filter.has(String(r[key] ?? '')));
      } else if (filter.type === 'range') {
        const { from, to } = filter;
        if (!from && !to) return;
        data = data.filter(r => {
          const val = r[key];
          if (val == null || val === '') return false;
          const dateStr = typeof val === 'string' && val.includes('T') ? val.split('T')[0] : val;
          const dateVal = new Date(dateStr);
          if (isNaN(dateVal)) return false;
          if (from && dateVal < new Date(from)) return false;
          if (to) {
            const endOfDay = new Date(to);
            endOfDay.setHours(23, 59, 59, 999);
            if (dateVal > endOfDay) return false;
          }
          return true;
        });
      }
    });
    customFilters.forEach(cf => {
      if (!cf.column) return;
      data = data.filter(r => evaluateFilter(r[cf.column], cf.operator, cf.value));
    });
    if (sortConfig.key) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? '';
        const bVal = b[sortConfig.key] ?? '';
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        let cmp = 0;
        if (!isNaN(aNum) && !isNaN(bNum) && aVal !== '' && bVal !== '') {
          cmp = aNum - bNum;
        } else {
          cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        }
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      });
    }
    return data;
  }, [rows, headerFilters, columnFilters, customFilters, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const displayRows = processedRows.slice(startIdx, startIdx + pageSize);

  useEffect(() => { setPage(1); }, [pageSize, columnFilters, customFilters, headerFilters, sortConfig]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setActiveFilterCol(null);
      }
    }
    if (activeFilterCol) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeFilterCol]);

  const handleSelectAll = useCallback(() => {
    const pageIds = displayRows.map(r => String(r.id));
    if (pageIds.length > 0 && pageIds.every(id => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageIds));
    }
  }, [selectedIds, displayRows]);

  const handleSelectRow = useCallback((id) => {
    const sid = String(id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  const handleCellChange = useCallback((rowId, colKey, value) => {
    setRows(prev => prev.map(r => String(r.id) === String(rowId) ? { ...r, [colKey]: value } : r));
  }, []);

  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleSaveSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (onSave) {
      const selectedRows = rows.filter(r => selectedIds.has(String(r.id)));
      onSave(selectedRows);
    }
  }, [selectedIds, rows, onSave]);

  const handleCopySelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const toCopy = rows.filter(r => selectedIds.has(String(r.id)));

    let currentMinId = 0;
    rows.forEach(r => {
      const idNum = Number(r.ObjDetID);
      if (idNum < currentMinId) currentMinId = idNum;
    });

    const newRows = toCopy.map((r, idx) => {
      const newId = currentMinId - (idx + 1);
      return { ...r, id: newId, IDNumber: newId };
    });

    setRows(prev => {
      const nextRows = [...prev];
      for (let i = toCopy.length - 1; i >= 0; i--) {
        const origRow = toCopy[i];
        const newRow = newRows[i];
        const idx = nextRows.findIndex(r => String(r.id) === String(origRow.id));
        if (idx !== -1) {
          nextRows.splice(idx + 1, 0, newRow);
        } else {
          nextRows.push(newRow);
        }
      }
      return nextRows;
    });

    setSelectedIds(new Set());

    if (toCopy.length > 0) {
      const firstOrig = toCopy[0];
      const firstOrigIndex = processedRows.findIndex(r => String(r.id) === String(firstOrig.id));
      if (firstOrigIndex !== -1) {
        const firstNewRowIndex = firstOrigIndex + 1;
        const targetPage = Math.floor(firstNewRowIndex / pageSize) + 1;
        if (targetPage !== page) {
          setPage(targetPage);
        }
      }
    }
  }, [selectedIds, rows, processedRows, pageSize, page]);

  const handleExportExcel = useCallback(() => {
    const headers = columns.map(c => c.name).join(',');
    const csvRows = processedRows.map(r =>
      columns.map(c => {
        const val = r[c.key] ?? '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    );
    downloadCSV(`${title.replace(/\s+/g, '_')}_export.csv`, [headers, ...csvRows].join('\n'));
  }, [processedRows, columns, title]);

  const handleResetFilters = useCallback(() => {
    setColumnFilters({});
    setHeaderFilters({});
    setCustomFilters([]);
    setSortConfig({ key: null, direction: 'asc' });
    setFilterSearch('');
  }, []);

  const toggleColumnFilter = useCallback((colKey) => {
    if (activeFilterCol === colKey) {
      setActiveFilterCol(null);
    } else {
      setActiveFilterCol(colKey);
      setFilterSearch('');
    }
  }, [activeFilterCol]);

  const applyColumnFilter = useCallback((colKey, selectedValues) => {
    setColumnFilters(prev => ({ ...prev, [colKey]: selectedValues }));
    setActiveFilterCol(null);
  }, []);

  const clearColumnFilter = useCallback((colKey) => {
    setColumnFilters(prev => { const n = { ...prev }; delete n[colKey]; return n; });
    setActiveFilterCol(null);
  }, []);

  const addCustomFilter = useCallback(() => {
    setCustomFilters(prev => [...prev, { id: generateId(), column: columns.find(c => c.filterable)?.key || '', operator: 'eq', value: '' }]);
  }, [columns]);

  const updateCustomFilter = useCallback((id, field, value) => {
    setCustomFilters(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  }, []);

  const removeCustomFilter = useCallback((id) => {
    setCustomFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const applyCustomFilters = useCallback(() => {
    setShowCustomFilter(false);
  }, []);

  const handleScroll = useCallback((e) => {
    const el = e.target;
    const left = el.scrollLeft > 5;
    const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 5;
    setScrollState({ left, right });
  }, []);

  // ── Cell-event helper: fires onCellEvent on Tab when col is in EVENT_COLUMNS ──
  // Returns an onKeyDown handler for the cell-wrapper <div>.
  // Keyboard events from ANY child (text input, date input, SearchSelect trigger)
  // bubble up to the wrapper, so this works for all control types.
  const makeCellKeyDown = useCallback((row, col) => {
    if (!onCellEvent || !EVENT_COLUMNS.has(col.key)) return undefined;
    return (e) => {
      if (e.key === 'Tab') {
        // rowsRef.current is always the latest snapshot — no stale closure issue
        const currentRow = rowsRef.current.find(r => String(r.id) === String(row.id)) || row;

        // For textbox/date inputs the browser fires onChange → onKeyDown in the
        // same flush, but React may not have committed the state update yet.
        // e.target.value gives us the in-flight typed value directly.
        const liveValue =
          e.target && (col.controlType === 1 || col.controlType === 2)
            ? e.target.value
            : currentRow[col.key];

        onCellEvent({
          rowId: row.id,
          colKey: col.key,
          rowData: { ...currentRow, [col.key]: liveValue },
        });
      }
    };
  }, [onCellEvent]); // rowsRef is a ref — no need to list it as a dependency

  const renderCellControl = (row, col) => {
    const value = row[col.key] ?? '';
    const commonProps = {
      value,
      onChange: (e) => handleCellChange(row.id, col.key, e.target.value),
      className: col.controlType === 0 ? 'cell-label' : col.controlType === 4 ? 'cell-select' : col.controlType === 9 ? 'cell-textarea' : 'cell-input',
      tabIndex: 0,
      'aria-label': `${col.name} for row ${row.id}`,
    };
    switch (col.controlType) {
      case 0: return <span className="cell-label" title={value}>{value}</span>;
      case 1: return <input type="text" {...commonProps} />;
      case 2: {
        const dateValue = formatDateForInput(value);
        return (
          <input
            type="date"
            {...commonProps}
            value={dateValue}
            onChange={(e) => handleCellChange(row.id, col.key, parseDateFromInput(e.target.value))}
          />
        );
      }
      case 4: {
        const opts = (col.dropdownOptions || []).map(opt => {
          if (typeof opt === 'string') return { value: opt, label: opt };
          if (opt.value !== undefined) return opt;
          return { value: String(opt.ObjDetID ?? opt), label: opt.Name ?? String(opt) };
        });
        return (
          <SearchSelect
            value={String(value)}
            onChange={(val) => handleCellChange(row.id, col.key, val)}
            options={opts}
            placeholder="-- Select --"
            compact
            ariaLabel={`${col.name} for row ${row.id}`}
          />
        );
      }
      case 9: {
        const text = String(value ?? '');
        const lineCount = (text.match(/\n/g) || []).length + 1;
        const rows = Math.max(1, Math.min(lineCount, 6));
        return (
          <textarea
            {...commonProps}
            rows={rows}
            style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', resize: 'none' }}
          />
        );
      }
      default: return <span className="cell-label">{value}</span>;
    }
  };

  const getUniqueValues = (colKey) => {
    const vals = new Set(rows.map(r => String(r[colKey] ?? '')).filter(v => v !== ''));
    return Array.from(vals).sort();
  };

  const isColFiltered = (colKey) => {
    const filter = columnFilters[colKey];
    if (!filter) return false;
    if (filter instanceof Set) return filter.size > 0;
    if (typeof filter === 'object' && filter.type === 'range') {
      return !!(filter.from || filter.to);
    }
    return false;
  };

  const cellStyle = (col, rowType = 'body') => {
    const w = `${toPixels(columnWidths[col.id] || col.width) || 120}px`;
    const base = { width: w, minWidth: w, maxWidth: w };

    if (isColumnFixed(col)) {
      base['--col-sticky-left'] = `${fixedLeftMap[col.id] ?? 0}px`;
    }

    return base;
  };

  /**
   * CSS classes from API flags: IsFreezeReq → fixed, IsEditAllow → editable, else read-only.
   */
  const cellClass = (col) => getColumnCellClass(col, lastFixedColId);

  const getHeaderThemeClass = (col) => getColumnHeaderThemeClass(col);

  const isDateColumn = (col) => col.controlType === 2 || col.filterType === 'date';

  return (
    <div className={`erp-grid-container erp-grid-container--dense erp-grid-container--fill ${resizing ? 'resizing' : ''}`}>
      <div className="grid-header">
        <h2 className="grid-title">{title}</h2>
      </div>

      {selectedIds.size > 0 && (
        <div className="selection-bar">
          <span>{selectedIds.size} row(s) selected</span>
          <button onClick={() => setSelectedIds(new Set())}>Clear selection</button>
        </div>
      )}

      {showCustomFilter && (
        <div className="custom-filter-panel">
          <div className="custom-filter-header">
            <div className="custom-filter-title">
              <Filter size={16} />
              Custom Filter Builder
            </div>
          </div>
          <div className="custom-filter-body">
            {customFilters.length === 0 && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                No custom filters applied. Click "Add Condition" to create one.
              </div>
            )}
            {customFilters.map((cf, idx) => {
              const col = columns.find(c => c.key === cf.column);
              const ops = operatorsByType[col?.filterType || 'text'] || operatorsByType.text;
              return (
                <div key={cf.id} className="filter-condition">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 20 }}>{idx + 1}.</span>
                  <select className="col-select" value={cf.column} onChange={e => updateCustomFilter(cf.id, 'column', e.target.value)}>
                    {columns.filter(c => c.filterable).map(c => (
                      <option key={c.key} value={c.key}>{c.name}</option>
                    ))}
                  </select>
                  <select className="op-select" value={cf.operator} onChange={e => updateCustomFilter(cf.id, 'operator', e.target.value)}>
                    {ops.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                  </select>
                  {!['empty', 'notempty'].includes(cf.operator) && (
                    col?.filterType === 'select' ? (
                      <select
                        className="val-input"
                        value={cf.value}
                        onChange={e => updateCustomFilter(cf.id, 'value', e.target.value)}
                      >
                        <option value="">-- Select --</option>
                        {(col.dropdownOptions || getUniqueValues(col.key)).map(opt => {
                          const val = typeof opt === 'object' ? opt.value : opt;
                          const label = typeof opt === 'object' ? opt.label : opt;
                          return <option key={val} value={val}>{label}</option>;
                        })}
                      </select>
                    ) : (
                      <input
                        className="val-input"
                        type={col?.filterType === 'date' ? 'date' : col?.filterType === 'number' ? 'number' : 'text'}
                        value={cf.value}
                        onChange={e => updateCustomFilter(cf.id, 'value', e.target.value)}
                        placeholder="Value..."
                      />
                    )
                  )}
                  <button className="filter-remove-btn" onClick={() => removeCustomFilter(cf.id)} title="Remove">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="filter-actions">
            <button onClick={addCustomFilter}>+ Add Condition</button>
            <button className="primary" onClick={applyCustomFilters}>Apply Filters</button>
            <button onClick={() => { setCustomFilters([]); setShowCustomFilter(false); }}>Clear All</button>
          </div>
        </div>
      )}

      <div
        className={`table-wrapper ${scrollState.left ? 'scrolled-left' : ''} ${scrollState.right ? 'scrolled-right' : ''}`}
        ref={tableWrapperRef}
        onScroll={handleScroll}
      >
        <table className="erp-table">
          <thead>
            {/* ── Header row ── */}
            <tr>
              {columns.map(col => (
                <th
                  key={col.id}
                  className={`${cellClass(col) || ''} ${getHeaderThemeClass(col)}`}
                  style={cellStyle(col, 'header')}
                >
                  <div className="header-cell-content">
                    <span
                      className="header-label"
                      onClick={() => col.key !== 'cb' && handleSort(col.key)}
                      style={{ cursor: col.key !== 'cb' ? 'pointer' : 'default' }}
                    >
                      {col.name}
                      {sortConfig.key === col.key && (
                        <span className="sort-icon" title="Sorted">
                          {sortConfig.direction === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </span>
                    {col.filterable && col.key !== 'cb' && (
                      <div className="header-actions">
                        <button
                          className={`filter-icon ${isColFiltered(col.key) ? 'active' : ''}`}
                          onClick={() => toggleColumnFilter(col.key)}
                          title="Column Filter"
                          aria-label={`Filter ${col.name}`}
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                    )}
                    {activeFilterCol === col.key && (
                      <div className="column-filter-popup" ref={popupRef}>
                        <div className="popup-header">Filter: {col.name}</div>

                        {isDateColumn(col) ? (
                          <div className="popup-date-range">
                            <div className="date-field">
                              <label>From</label>
                              <input
                                type="date"
                                value={columnFilters[col.key]?.from || ''}
                                onChange={e => {
                                  const current = columnFilters[col.key] || { type: 'range', from: '', to: '' };
                                  setColumnFilters(prev => ({ ...prev, [col.key]: { ...current, from: e.target.value } }));
                                }}
                              />
                            </div>
                            <div className="date-field">
                              <label>To</label>
                              <input
                                type="date"
                                value={columnFilters[col.key]?.to || ''}
                                onChange={e => {
                                  const current = columnFilters[col.key] || { type: 'range', from: '', to: '' };
                                  setColumnFilters(prev => ({ ...prev, [col.key]: { ...current, to: e.target.value } }));
                                }}
                              />
                            </div>
                            <div className="popup-footer">
                              <button className="popup-btn" onClick={() => clearColumnFilter(col.key)}>Clear</button>
                              <button className="popup-btn primary" onClick={() => setActiveFilterCol(null)}>Close</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="popup-search">
                              <input type="text" placeholder="Search..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} autoFocus />
                            </div>
                            <div className="popup-list">
                              {(() => {
                                const allValues = getUniqueValues(col.key);
                                const filtered = filterSearch
                                  ? allValues.filter(v => getDropdownLabel(col, v).toLowerCase().includes(filterSearch.toLowerCase()))
                                  : allValues;
                                const currentSet = columnFilters[col.key] || new Set();
                                const allSelected = filtered.length > 0 && filtered.every(v => currentSet.has(v));
                                return (
                                  <>
                                    <div className="popup-item" onClick={() => {
                                      const newSet = new Set(currentSet);
                                      if (allSelected) { filtered.forEach(v => newSet.delete(v)); }
                                      else { filtered.forEach(v => newSet.add(v)); }
                                      applyColumnFilter(col.key, newSet);
                                    }}>
                                      <input type="checkbox" checked={allSelected} readOnly />
                                      <label>(Select All)</label>
                                    </div>
                                    {filtered.map(val => (
                                      <div key={val} className="popup-item" onClick={() => {
                                        const newSet = new Set(currentSet);
                                        if (newSet.has(val)) newSet.delete(val);
                                        else newSet.add(val);
                                        applyColumnFilter(col.key, newSet);
                                      }}>
                                        <input type="checkbox" checked={currentSet.has(val)} readOnly />
                                        <label title={getDropdownLabel(col, val)}>{getDropdownLabel(col, val)}</label>
                                      </div>
                                    ))}
                                    {filtered.length === 0 && (
                                      <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>No values found</div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            <div className="popup-footer">
                              <button className="popup-btn" onClick={() => clearColumnFilter(col.key)}>Clear</button>
                              <button className="popup-btn primary" onClick={() => setActiveFilterCol(null)}>Close</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, col.id)} />
                </th>
              ))}
            </tr>

            {/* ── Filter row — hidden in entry mode ── */}
            {mode !== 'entry' && (
              <tr className="filter-row">
                {columns.map(col => (
                  <td
                    key={`filter-${col.id}`}
                    className={cellClass(col)}
                    style={cellStyle(col, 'filter')}
                  >
                    {col.key === 'cb' ? (
                      <div className="cell-checkbox">
                        <input
                          type="checkbox"
                          className="row-checkbox"
                          checked={displayRows.length > 0 && displayRows.every(r => selectedIds.has(String(r.id)))}
                          onChange={handleSelectAll}
                          aria-label="Select all visible rows"
                        />
                      </div>
                    ) : col.filterable ? (
                      <input
                        className="filter-input"
                        type={col.filterType === 'date' ? 'date' : col.filterType === 'number' ? 'number' : 'text'}
                        placeholder={`Filter ${col.name}...`}
                        value={headerFilters[col.key] || ''}
                        onChange={e => setHeaderFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Escape') setHeaderFilters(prev => { const n = { ...prev }; delete n[col.key]; return n; }); }}
                      />
                    ) : null}
                  </td>
                ))}
              </tr>
            )}
          </thead>

          <tbody>
            {displayRows.map(row => (
              <tr key={row.id} className={selectedIds.has(String(row.id)) ? 'selected' : ''}>
                {columns.map(col => (
                  <td
                    key={`${row.id}-${col.id}`}
                    className={cellClass(col)}
                    style={cellStyle(col, 'body')}
                    onClick={() => { if (col.key === 'cb') handleSelectRow(row.id); }}
                  >
                    <div className="cell-wrapper" onKeyDown={col.key !== 'cb' ? makeCellKeyDown(row, col) : undefined}>
                      {col.key === 'cb' ? (
                        <div className="cell-checkbox">
                          <input
                            type="checkbox"
                            className="row-checkbox"
                            checked={selectedIds.has(String(row.id))}
                            onChange={() => handleSelectRow(row.id)}
                            onClick={e => e.stopPropagation()}
                            aria-label={`Select row ${row.id}`}
                          />
                        </div>
                      ) : (
                        renderCellControl(row, col)
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            {displayRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {mode === 'entry' ? (
                    <>Click <strong>Add New</strong> in the header panel to add a row.</>
                  ) : (
                    <>
                      No records match the current filters.
                      <br />
                      <button className="toolbar-btn" style={{ marginTop: 12, color: 'var(--text)' }} onClick={handleResetFilters}>Reset Filters</button>
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <div className="pagination-left">
          Showing <strong>{processedRows.length > 0 ? startIdx + 1 : 0}</strong> – <strong>{Math.min(startIdx + pageSize, processedRows.length)}</strong> of <strong>{processedRows.length}</strong> records
          {processedRows.length !== rows.length && ` (filtered from ${rows.length})`}
        </div>
        <div className="pagination-right">
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Rows:</span>
          <select className="page-size-select" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
            {pageSizeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>

          <button className="page-btn" onClick={() => setPage(1)} disabled={safePage <= 1}>«</button>
          <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>‹</button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || (p >= safePage - 2 && p <= safePage + 2))
            .map((p, idx, arr) => (
              <React.Fragment key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ color: 'var(--text-muted)', padding: '0 4px' }}>...</span>}
                <button className={`page-btn ${p === safePage ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              </React.Fragment>
            ))}

          <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>›</button>
          <button className="page-btn" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>»</button>
        </div>
      </div>

      <BottomControlPanel
        selectedCount={selectedIds.size}
        showCustomFilter={showCustomFilter}
        onToggleCustomFilter={() => setShowCustomFilter(v => !v)}
        onResetFilters={handleResetFilters}
        onExportExcel={handleExportExcel}
        onCopy={handleCopySelected}
        onSave={handleSaveSelected}
      />
    </div>
  );
});

export default GridForm;
