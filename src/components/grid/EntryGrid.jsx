// TxnEntryGridForm.jsx
// ─────────────────────────────────────────────────────────────────────
// Dedicated data-entry grid for TxnEntryForm.
// Supports two modes:
//   mode="entry" (default / readOnly=false):
//     • Cells are editable (text, date, dropdown, textarea)
//     • Cell-event hooks fire on Tab for configured EVENT_COLUMNS
//     • Bottom panel: Export, Copy, Save
//     • Rows added imperatively via ref.addRow(blankRow)
//
//   mode="read" (readOnly=true):
//     • All cells render as plain labels — no editing
//     • No cell-event hooks, no bottom panel
//     • Checkbox selection still works (for picking rows)
//     • Accepts initialRows to pre-populate the grid
//
// EVENT_COLUMNS — the ColNames that trigger onCellEvent when the user
// presses Tab.  Update this set if the stored procedure changes.

import React, {
  useState, useMemo, useCallback, useRef, useEffect,
  useImperativeHandle, forwardRef,
} from 'react';
import { Plus, ShoppingCart } from 'lucide-react';
import SearchSelect from '../ui/SearchSelect';
import TxnEntryBottomPanel from './EntryGridBottomPanel';
import './EnterpriseGrid.css';
import { isColumnFixed, getColumnCellClass, getColumnHeaderThemeClass } from './gridColumnClass';

// ── Helper utils ───────────────────────────────────────────────────────
function toPixels(w) {
  if (typeof w === 'number') return w;
  if (typeof w === 'string') return parseInt(w, 10) || 0;
  return 0;
}

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

function downloadCSV(filename, csvContent) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ── Columns that fire onCellEvent when user presses Tab ───────────────
// These match the ColName values returned by GET_DETAIL_COL_DATA.
const EVENT_COLUMNS = new Set([
  'ItemID', 'TranQty', 'BaseQty', 'BaseRate', 'TranRate',
  'DiscPerc', 'Expense', 'GSTPerc',
]);

// ── Component ─────────────────────────────────────────────────────────
const TxnEntryGridForm = forwardRef(function TxnEntryGridForm(
  {
    config,
    title = 'Invoice Line Items',
    onSave,
    onCellEvent,
    readOnly = false,
    initialRows = null,
    onSelectionChange = null,
    onAddItem = null,        // () => void — "Add Item" button in grid header
    addItemLabel = 'Add Item',
    onGetItem = null,        // () => void — "Get Item" button in grid header
    getItemLabel = 'Get Item',
  },
  ref,
) {
  const { columns, pagination } = config;
  const { pageSize: defaultPageSize = 25, pageSizeOptions = [10, 25, 50, 100] } = pagination || {};

  const [rows, setRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const [columnWidths, setColumnWidths] = useState(() => {
    const map = {};
    columns.forEach(c => { map[c.id] = c.width; });
    return map;
  });
  const [resizing, setResizing] = useState(null);

  // Always-current snapshot of rows for Tab-key event closures
  const rowsRef = useRef([]);
  const tableWrapperRef = useRef(null);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Load initialRows when provided (readOnly mode)
  useEffect(() => {
    if (initialRows && Array.isArray(initialRows) && initialRows.length > 0) {
      // Ensure each row has an 'id' field for internal tracking
      const withIds = initialRows.map((r, i) => ({
        ...r,
        id: r.id ?? r.ItemID ?? `_init_${i}`,
      }));
      setRows(withIds);
    }
  }, [initialRows]);

  // ── Imperative handle ─────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    addRow(blankRow) { setRows(prev => [...prev, blankRow]); },
    getRows() { return rowsRef.current; },
    getSelectedRows() {
      return rowsRef.current.filter(r => selectedIds.has(String(r.id)));
    },
    updateRow(rowId, fields) {
      setRows(prev =>
        prev.map(r => String(r.id) === String(rowId) ? { ...r, ...fields } : r)
      );
    },
  }), [selectedIds]);

  // Notify parent when selection changes
  useEffect(() => {
    onSelectionChange?.(selectedIds.size);
  }, [selectedIds, onSelectionChange]);

  // ── Column resize ─────────────────────────────────────────────────
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
      setColumnWidths(prev => ({ ...prev, [resizing.colId]: Math.max(60, resizing.startWidth + diff) }));
    };
    const handleUp = () => setResizing(null);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

  // ── Fixed column offsets ──────────────────────────────────────────
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

  // ── Dropdown label helper ─────────────────────────────────────────
  const getDropdownLabel = useCallback((col, rawValue) => {
    if (col.controlType !== 4 || !col.dropdownOptions) return rawValue;
    const opts = col.dropdownOptions.map(opt => {
      if (typeof opt === 'string') return { value: opt, label: opt };
      if (opt && typeof opt === 'object') {
        if (opt.value !== undefined) return { value: String(opt.value), label: opt.label || String(opt.value) };
        return { value: String(opt.IDNumber ?? opt), label: opt.Name ?? String(opt) };
      }
      return { value: String(opt), label: String(opt) };
    });
    const found = opts.find(o => String(o.value) === String(rawValue));
    return found ? found.label : rawValue;
  }, []);

  // ── Sort ──────────────────────────────────────────────────────────
  const processedRows = useMemo(() => {
    let data = [...rows];
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
  }, [rows, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const displayRows = processedRows.slice(startIdx, startIdx + pageSize);

  useEffect(() => { setPage(1); }, [pageSize, sortConfig]);

  // ── Selection ─────────────────────────────────────────────────────
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
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  }, []);

  // ── Cell change ───────────────────────────────────────────────────
  const handleCellChange = useCallback((rowId, colKey, value) => {
    setRows(prev => prev.map(r => String(r.id) === String(rowId) ? { ...r, [colKey]: value } : r));
  }, []);

  // ── Sort handler ──────────────────────────────────────────────────
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // ── Bottom panel actions ──────────────────────────────────────────
  const handleSave = useCallback(() => {
    // onSave is called without arguments — the parent reads rows
    // via gridRef.getRows() so ALL rows are saved (not just selected).
    if (onSave) onSave();
  }, [onSave]);

  const handleCopy = useCallback(() => {
    if (selectedIds.size === 0) return;
    const toCopy = rows.filter(r => selectedIds.has(String(r.id)));
    let currentMinId = 0;
    rows.forEach(r => {
      const n = Number(r.IDNumber);
      if (n < currentMinId) currentMinId = n;
    });
    const newRows = toCopy.map((r, idx) => {
      const newId = currentMinId - (idx + 1);
      return { ...r, id: newId, IDNumber: newId };
    });
    setRows(prev => {
      const next = [...prev];
      for (let i = toCopy.length - 1; i >= 0; i--) {
        const idx = next.findIndex(r => String(r.id) === String(toCopy[i].id));
        if (idx !== -1) next.splice(idx + 1, 0, newRows[i]);
        else next.push(newRows[i]);
      }
      return next;
    });
    setSelectedIds(new Set());
  }, [selectedIds, rows]);

  const handleExport = useCallback(() => {
    const headers = columns.map(c => c.name).join(',');
    const csvRows = processedRows.map(r =>
      columns.map(c => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    downloadCSV(`${title.replace(/\s+/g, '_')}_export.csv`, [headers, ...csvRows].join('\n'));
  }, [processedRows, columns, title]);

  // ── Cell-event key handler ────────────────────────────────────────
  const makeCellKeyDown = useCallback((row, col) => {
    if (!onCellEvent || !EVENT_COLUMNS.has(col.key)) return undefined;
    return (e) => {
      if (e.key === 'Tab') {
        const currentRow = rowsRef.current.find(r => String(r.id) === String(row.id)) || row;
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
  }, [onCellEvent]);

  // ── Cell renderer ─────────────────────────────────────────────────
  const renderCell = (row, col) => {
    const value = row[col.key] ?? '';

    // ── Read-only mode: always render as label ──
    if (readOnly) {
      if (col.controlType === 4) {
        // Show the display label for dropdown values
        return <span className="cell-label" title={String(getDropdownLabel(col, value))}>{getDropdownLabel(col, value)}</span>;
      }
      if (col.controlType === 2) {
        return <span className="cell-label" title={formatDateForInput(value)}>{formatDateForInput(value) || '—'}</span>;
      }
      return <span className="cell-label" title={String(value)}>{value === '' || value == null ? '—' : value}</span>;
    }

    // ── Editable mode ──
    const commonProps = {
      value,
      onChange: (e) => handleCellChange(row.id, col.key, e.target.value),
      tabIndex: 0,
      'aria-label': `${col.name} for row ${row.id}`,
    };

    switch (col.controlType) {
      case 0: return <span className="cell-label" title={String(value)}>{value}</span>;

      case 1: return (
        <input className="cell-input" type="text" {...commonProps} />
      );

      case 2: return (
        <input
          className="cell-input"
          type="date"
          {...commonProps}
          value={formatDateForInput(value)}
          onChange={(e) => handleCellChange(row.id, col.key, parseDateFromInput(e.target.value))}
        />
      );

      case 4: {
        const opts = (col.dropdownOptions || []).map(opt => {
          if (typeof opt === 'string') return { value: opt, label: opt };
          if (opt.value !== undefined) return opt;
          return { value: String(opt.IDNumber ?? opt), label: opt.Name ?? String(opt) };
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
        return (
          <textarea
            className="cell-textarea"
            {...commonProps}
            rows={Math.max(1, Math.min(lineCount, 6))}
          />
        );
      }

      default: return <span className="cell-label">{value}</span>;
    }
  };

  // ── Cell style helpers ────────────────────────────────────────────
  const cellStyle = (col, rowType = 'body') => {
    const w = `${toPixels(columnWidths[col.id] || col.width) || 120}px`;
    const base = { width: w, minWidth: w, maxWidth: w };
    if (isColumnFixed(col)) {
      base['--col-sticky-left'] = `${fixedLeftMap[col.id] ?? 0}px`;
    }
    return base;
  };

  const cellClass = (col) => getColumnCellClass(col, lastFixedColId);

  const getHeaderThemeClass = (col) => getColumnHeaderThemeClass(col);

  const handleScroll = useCallback((e) => {
    const el = e.target;
    setScrollState({
      left: el.scrollLeft > 5,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 5,
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className={`erp-grid-container erp-grid-container--dense erp-grid-container--fill ${resizing ? 'resizing' : ''}`}>

      {(title || onAddItem || onGetItem) ? (
        <div className="grid-header">
          <div className="grid-header__inner">
            {title && <h2 className="grid-title">{title}</h2>}
            {(onGetItem || onAddItem) && (
              <div className="grid-header__actions">
                {onGetItem && (
                  <button type="button" className="toolbar-btn" onClick={onGetItem}>
                    <ShoppingCart size={13} strokeWidth={2.5} />
                    {getItemLabel}
                  </button>
                )}
                {onAddItem && (
                  <button type="button" className="toolbar-btn primary" onClick={onAddItem}>
                    <Plus size={13} strokeWidth={2.5} />
                    {addItemLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {selectedIds.size > 0 && (
        <div className="selection-bar">
          <span>{selectedIds.size} row(s) selected</span>
          <button type="button" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
        </div>
      )}

      <div
        className={`table-wrapper ${scrollState.left ? 'scrolled-left' : ''} ${scrollState.right ? 'scrolled-right' : ''}`}
        ref={tableWrapperRef}
        onScroll={handleScroll}
      >
        <table className="erp-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.id}
                  className={`${cellClass(col) || ''} ${getHeaderThemeClass(col)}`}
                  style={cellStyle(col, 'header')}
                >
                  {col.key === 'cb' ? (
                    <div className="header-cell-content" style={{ justifyContent: 'center' }}>
                      <input
                        type="checkbox"
                        className="row-checkbox"
                        title="Select / deselect all visible rows"
                        aria-label="Select all rows"
                        checked={
                          displayRows.length > 0 &&
                          displayRows.every(r => selectedIds.has(String(r.id)))
                        }
                        onChange={handleSelectAll}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <div className="header-cell-content">
                      <span
                        className="header-label"
                        onClick={() => handleSort(col.key)}
                        style={{ cursor: 'pointer' }}
                      >
                        {col.name}
                        {sortConfig.key === col.key && (
                          <span className="sort-icon">
                            {sortConfig.direction === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, col.id)} />
                </th>
              ))}
            </tr>
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
                    <div
                      className="cell-wrapper"
                      onKeyDown={(!readOnly && col.key !== 'cb') ? makeCellKeyDown(row, col) : undefined}
                    >
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
                        renderCell(row, col)
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            ))}

            {displayRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {readOnly
                    ? 'No data available.'
                    : (onGetItem || onAddItem)
                      ? <>
                          {onGetItem && <>Click <strong>{getItemLabel}</strong> to pick items</>}
                          {onGetItem && onAddItem && <>, or </>}
                          {onAddItem && <>click <strong>{addItemLabel}</strong> to add a new row</>}.
                        </>
                      : <>Click <strong>Add Item</strong> to add a row.</>
                  }
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <div className="pagination-left">
          Showing <strong>{processedRows.length > 0 ? startIdx + 1 : 0}</strong> – <strong>{Math.min(startIdx + pageSize, processedRows.length)}</strong> of <strong>{processedRows.length}</strong> records
        </div>
        <div className="pagination-right">
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Rows:</span>
          <select className="page-size-select" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
            {pageSizeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <button type="button" className="page-btn" onClick={() => setPage(1)} disabled={safePage <= 1}>«</button>
          <button type="button" className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || (p >= safePage - 2 && p <= safePage + 2))
            .map((p, idx, arr) => (
              <React.Fragment key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ color: 'var(--text-muted)', padding: '0 4px' }}>…</span>}
                <button
                  type="button"
                  className={`page-btn ${p === safePage ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >{p}</button>
              </React.Fragment>
            ))}
          <button type="button" className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>›</button>
          <button type="button" className="page-btn" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>»</button>
        </div>
      </div>

      {/* Bottom toolbar — hidden in readOnly mode */}
      {!readOnly && (
        <TxnEntryBottomPanel
          selectedCount={selectedIds.size}
          onExportExcel={handleExport}
          onCopy={handleCopy}
          onSave={handleSave}
        />
      )}

    </div>
  );
});

export default TxnEntryGridForm;
