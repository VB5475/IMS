// PopupGrid.jsx
// Lightweight read-only picker grid for modal dialogs.
// Columns are derived from row object keys — pass [{ col1: v1, col2: v2 }, ...].
//
// Ref API (matches EntryGrid picker usage):
//   getSelectedRows() → selected row objects (original data, without internal _pgId)
//   clearSelection()

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import './PopupGrid.css';

const DEFAULT_EXCLUDE = ['id', '_pgId'];

function humanizeKey(key) {
  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
}

function resolveRowId(row, index, idKey) {
  if (idKey && row[idKey] != null) return String(row[idKey]);
  if (row.id != null) return String(row.id);
  if (row.ItemID != null) return String(row.ItemID);
  if (row.SupplierID != null) return String(row.SupplierID);
  return `_pg_${index}`;
}

function deriveColumns(rows, excludeKeys, columnOrder, columnLabels) {
  if (!rows?.length) return [];

  const excluded = new Set(excludeKeys);
  const keys = columnOrder?.length
    ? columnOrder.filter((k) => !excluded.has(k))
    : [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !excluded.has(k));

  return keys.map((key) => ({
    key,
    label: columnLabels?.[key] ?? humanizeKey(key),
  }));
}

const PopupGrid = forwardRef(function PopupGrid(
  {
    rows = [],
    excludeKeys = DEFAULT_EXCLUDE,
    columnOrder = null,
    columnLabels = null,
    idKey = null,
    pageSize: defaultPageSize = 50,
    pageSizeOptions = [25, 50, 100],
    emptyMessage = 'No records to display.',
    onSelectionChange = null,
  },
  ref,
) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const rowsRef = useRef([]);

  const normalizedRows = useMemo(
    () => rows.map((row, index) => ({
      ...row,
      _pgId: resolveRowId(row, index, idKey),
    })),
    [rows, idKey],
  );

  useEffect(() => {
    rowsRef.current = normalizedRows;
  }, [normalizedRows]);

  const columns = useMemo(
    () => deriveColumns(normalizedRows, excludeKeys, columnOrder, columnLabels),
    [normalizedRows, excludeKeys, columnOrder, columnLabels],
  );

  const processedRows = useMemo(() => {
    let data = [...normalizedRows];
    if (sortConfig.key) {
      const { key, direction } = sortConfig;
      data.sort((a, b) => {
        const aVal = a[key] ?? '';
        const bVal = b[key] ?? '';
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        let cmp = 0;
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aVal !== '' && bVal !== '') {
          cmp = aNum - bNum;
        } else {
          cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        }
        return direction === 'asc' ? cmp : -cmp;
      });
    }
    return data;
  }, [normalizedRows, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const displayRows = processedRows.slice(startIdx, startIdx + pageSize);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [rows]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, sortConfig]);

  useEffect(() => {
    onSelectionChange?.(selectedIds.size);
  }, [selectedIds, onSelectionChange]);

  useImperativeHandle(ref, () => ({
    getSelectedRows() {
      return rowsRef.current.filter((r) => selectedIds.has(String(r._pgId)));
    },
    clearSelection() {
      setSelectedIds(new Set());
    },
  }), [selectedIds]);

  const handleSelectAll = useCallback(() => {
    const pageIds = displayRows.map((r) => String(r._pgId));
    if (pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageIds));
    }
  }, [displayRows, selectedIds]);

  const handleSelectRow = useCallback((rowId) => {
    const sid = String(rowId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const formatCell = (value) => {
    if (value == null || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  const allPageSelected = displayRows.length > 0
    && displayRows.every((r) => selectedIds.has(String(r._pgId)));

  return (
    <div className="popup-grid">
      <div className="popup-grid__scroll">
        <table className="popup-grid__table">
          <thead>
            <tr>
              <th className="popup-grid__th popup-grid__th--cb">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={handleSelectAll}
                  aria-label="Select all on page"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="popup-grid__th popup-grid__th--sortable"
                  onClick={() => handleSort(col.key)}
                >
                  <span>{col.label}</span>
                  {sortConfig.key === col.key && (
                    <span className="popup-grid__sort" aria-hidden>
                      {sortConfig.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="popup-grid__empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayRows.map((row) => {
                const rowId = String(row._pgId);
                const isSelected = selectedIds.has(rowId);
                return (
                  <tr
                    key={rowId}
                    className={isSelected ? 'popup-grid__row--selected' : ''}
                    onClick={() => handleSelectRow(rowId)}
                  >
                    <td
                      className="popup-grid__td popup-grid__td--cb"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(rowId)}
                        aria-label="Select row"
                      />
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className="popup-grid__td">
                        {formatCell(row[col.key])}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {processedRows.length > 0 && (
        <div className="popup-grid__footer">
          <span className="popup-grid__info">
            Showing {startIdx + 1}–{Math.min(startIdx + pageSize, processedRows.length)} of {processedRows.length}
          </span>
          <div className="popup-grid__pager">
            <select
              className="popup-grid__page-size"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
            <button
              type="button"
              className="popup-grid__page-btn"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span className="popup-grid__page-num">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              className="popup-grid__page-btn"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default PopupGrid;
