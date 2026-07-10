// NormalGrid.jsx — updated to use shared ColumnFilter component
// Changes from original:
//   • Header filter dropdowns replaced with the shared ColumnFilter popup
//   • columnFilters state uses the same shape as GridForm (Set / range objects)
//   • applyColumnFilterValue + isFilterActive imported from ColumnFilter.jsx
//   • filterType on each column controls which filter UI renders
//     ('list' | 'date' | 'number' | 'text')

import React, { useState, useMemo, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Filter, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../api/useApi";
import { API_BASE_URL_IMS, ENDPOINTS } from "../../api/constants";
import { useNotification } from "../../context/NotificationContext";
import { parseApiErrMsg } from "../../utils/apiResponse";
import Loader from "../ui/Loader";
import ConfirmDialog from "../ui/ConfirmDialog";
import ColumnFilter, { applyColumnFilterValue, isFilterActive } from "./Columnfilter";
import GridSearch from "./GridSearch";
import "./EnterpriseDataGrid.css";

const ACTION_COLUMN_KEYS = new Set(["_actions", "_action_edit", "_action_delete", "_action_select"]);
const SELECT_COLUMN_KEY = "_action_select";

function isActionColumn(col) {
  return ACTION_COLUMN_KEYS.has(col.key) || col.isAction;
}

function isSelectColumn(col) {
  return col.key === SELECT_COLUMN_KEY || col.actionType === "select";
}

/** Place select + edit/action columns first; data columns keep their relative order. */
function orderColumnsWithActionsFirst(columns, selectable = false) {
  if (!Array.isArray(columns) || columns.length === 0) return columns;
  const selectCol = selectable
    ? [{ key: SELECT_COLUMN_KEY, label: "", actionType: "select", minWidth: 40, isAction: true }]
    : [];
  const actionCols = columns.filter((c) => ACTION_COLUMN_KEYS.has(c.key) || c.isAction);
  const dataCols = columns.filter((c) => !ACTION_COLUMN_KEYS.has(c.key) && !c.isAction);
  if (selectCol.length === 0 && actionCols.length === 0) return columns;
  return [...selectCol, ...actionCols, ...dataCols];
}

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
 *   isAction?   : boolean,             // action column (e.g. Edit); rendered first by default
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
  loaderText = "Loading…",
  defaultPageSize = 10,
  pageSizeOptions = [5, 10, 20, 50, 99],
  pageSize: pageSizeProp,
  onPageSizeChange,
  emptyMessage = "No records found.",
  hideHeader = false,
  fill = false,
  searchable = false,
  deleteProcName = "",
  onDeleteSuccess,
  selectable = false,
  selectedRowKeys = [],
  onSelectionChange,
  getRowKey = (row, index) =>
    String(row?.IDNUMBER ?? row?.idnumber ?? row?.IDNumber ?? row?.MasterID ?? index),
}) {
  const navigate = useNavigate();
  const notify = useNotification();
  const { postDelete } = useApi(API_BASE_URL_IMS);
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletedRowIds, setDeletedRowIds] = useState(() => new Set());
  const [deletingRowIds, setDeletingRowIds] = useState(() => new Set());
  const [deleteConfirmState, setDeleteConfirmState] = useState({
    open: false,
    row: null,
    meta: null,
  });
  const itemsPerPage = pageSizeProp ?? internalPageSize;

  const handleSearchChange = useCallback((q) => { setSearchQuery(q); setCurrentPage(1); }, []);

  const markRowDeleting = useCallback((id, active) => {
    setDeletingRowIds((prev) => {
      const next = new Set(prev);
      if (active) next.add(String(id));
      else next.delete(String(id));
      return next;
    });
  }, []);

  const hideDeletedRow = useCallback((id) => {
    setDeletedRowIds((prev) => {
      const next = new Set(prev);
      next.add(String(id));
      return next;
    });
  }, []);

  const handleDeleteRow = useCallback(async (row, meta = {}) => {
    const rowId = meta.id ?? row?.IDNUMBER ?? row?.idnumber ?? row?.IDNumber ?? 0;
    if (!deleteProcName || !rowId) {
      notify.error("Delete configuration is missing for this list.");
      return;
    }

    markRowDeleting(rowId, true);
    try {
      const result = await postDelete(ENDPOINTS.TRAN_FORM_DELETE, {
        deleteProcName,
        idNumber: rowId,
      });
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        notify.error(message);
        return;
      }
      hideDeletedRow(rowId);
      notify.success(message);
      await onDeleteSuccess?.(row, rowId);
    } catch (err) {
      notify.error(err?.message || "Delete failed. Please try again.");
    } finally {
      markRowDeleting(rowId, false);
    }
  }, [deleteProcName, hideDeletedRow, markRowDeleting, notify, onDeleteSuccess, postDelete]);

  const openDeleteConfirm = useCallback((row, meta = {}) => {
    setDeleteConfirmState({ open: true, row, meta });
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setDeleteConfirmState({ open: false, row: null, meta: null });
  }, []);

  const confirmDelete = useCallback(async () => {
    const { row, meta } = deleteConfirmState;
    closeDeleteConfirm();
    if (!row) return;
    await handleDeleteRow(row, meta ?? {});
  }, [closeDeleteConfirm, deleteConfirmState, handleDeleteRow]);

  const displayColumns = useMemo(
    () => orderColumnsWithActionsFirst(columns, selectable),
    [columns, selectable]
  );

  const hasPinnedActions = useMemo(
    () => displayColumns.some(isActionColumn),
    [displayColumns]
  );

  const getActionOffset = useCallback((colIndex) => {
    let offset = 0;
    for (let i = 0; i < colIndex; i += 1) {
      if (isActionColumn(displayColumns[i])) {
        const col = displayColumns[i];
        offset += Number(col.minWidth ?? (isSelectColumn(col) ? 40 : 56));
      }
    }
    return offset;
  }, [displayColumns]);

  const getColStyle = useCallback((col) => {
    const style = {};
    if (col.width) style.width = col.width;
    if (col.minWidth) style.minWidth = typeof col.minWidth === "number" ? `${col.minWidth}px` : col.minWidth;
    return style;
  }, []);

  const setItemsPerPage = useCallback(
    (next) => {
      const value = typeof next === "function" ? next(itemsPerPage) : next;
      if (onPageSizeChange) onPageSizeChange(value);
      else setInternalPageSize(value);
      setCurrentPage(1);
    },
    [itemsPerPage, onPageSizeChange]
  );

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
    setActiveFilterCol((prev) => (prev === colKey ? null : colKey));
  }, []);

  const handleFilterChange = useCallback((colKey, value) => {
    setColumnFilters((prev) => ({ ...prev, [colKey]: value }));
    setCurrentPage(1);
  }, []);

  const handleFilterClear = useCallback((colKey) => {
    setColumnFilters((prev) => {
      const n = { ...prev };
      delete n[colKey];
      return n;
    });
    setCurrentPage(1);
  }, []);

  /* ── Global text search ───────────────────────────────────────────── */
  const textSearchedData = useMemo(() => {
    const visibleData = data.filter((row) => {
      const rowId = row?.IDNUMBER ?? row?.idnumber ?? row?.IDNumber ?? row?.MasterID;
      return rowId == null || !deletedRowIds.has(String(rowId));
    });
    if (!searchable || !searchQuery.trim()) return visibleData;
    const q = searchQuery.toLowerCase().trim();
    return visibleData.filter((row) =>
      displayColumns.some((col) => {
        if (isActionColumn(col)) return false;
        const raw = row[col.key];
        const val = col.dropdownOptions
          ? (col.dropdownOptions.find((o) => String(o.value) === String(raw))?.label ?? raw)
          : raw;
        return String(val ?? "").toLowerCase().includes(q);
      })
    );
  }, [data, deletedRowIds, searchQuery, searchable, displayColumns]);

  /* ── Apply all column filters (on top of text search) ────────────── */
  const filteredData = useMemo(() => {
    let result = [...textSearchedData];
    Object.entries(columnFilters).forEach(([key, filterValue]) => {
      const col = displayColumns.find((c) => c.key === key);
      result = applyColumnFilterValue(result, key, filterValue, col);
    });
    return result;
  }, [textSearchedData, columnFilters, displayColumns]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));

  const currentData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const selectedKeySet = useMemo(
    () => new Set((selectedRowKeys || []).map(String)),
    [selectedRowKeys]
  );

  const toggleRowSelection = useCallback(
    (row, index) => {
      if (!selectable || !onSelectionChange) return;
      const key = String(getRowKey(row, index));
      const next = new Set(selectedKeySet);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onSelectionChange(Array.from(next));
    },
    [getRowKey, onSelectionChange, selectable, selectedKeySet]
  );

  const pageRowKeys = useMemo(
    () => currentData.map((row, index) => String(getRowKey(row, index))),
    [currentData, getRowKey]
  );

  const allPageRowsSelected =
    pageRowKeys.length > 0 && pageRowKeys.every((key) => selectedKeySet.has(key));

  const togglePageSelection = useCallback(() => {
    if (!selectable || !onSelectionChange) return;
    const next = new Set(selectedKeySet);
    if (allPageRowsSelected) pageRowKeys.forEach((key) => next.delete(key));
    else pageRowKeys.forEach((key) => next.add(key));
    onSelectionChange(Array.from(next));
  }, [allPageRowsSelected, onSelectionChange, pageRowKeys, selectable, selectedKeySet]);

  /* ── Cell renderer ────────────────────────────────────────────────── */
  const renderCell = (col, row, rowIndex) => {
    const value = row[col.key];
    if (col.actionType === "select") {
      const key = String(getRowKey(row, rowIndex));
      return (
        <input
          type="checkbox"
          className="ng-row-select"
          checked={selectedKeySet.has(key)}
          aria-label={`Select row ${key}`}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleRowSelection(row, rowIndex)}
        />
      );
    }
    if (col.actionType === "edit") {
      const meta = col.getActionMeta?.(row) ?? {};
      return (
        <button
          type="button"
          className={col.actionClassName}
          title={meta.title ?? "Edit record"}
          aria-label={meta.ariaLabel ?? "Edit record"}
          onClick={(e) => {
            e.stopPropagation();
            if (meta.navigateTo) navigate(meta.navigateTo, { state: meta.navigateState });
          }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      );
    }
    if (col.actionType === "delete") {
      const meta = col.getActionMeta?.(row) ?? {};
      const rowId = meta.id ?? row?.IDNUMBER ?? row?.idnumber ?? row?.IDNumber ?? 0;
      const isDeleting = deletingRowIds.has(String(rowId));
      return (
        <button
          type="button"
          className={col.actionClassName}
          title={meta.title ?? "Delete record"}
          aria-label={meta.ariaLabel ?? "Delete record"}
          onClick={(e) => {
            e.stopPropagation();
            openDeleteConfirm(row, meta);
          }}
          disabled={isDeleting || !deleteProcName}
        >
          <Trash2 size={13} strokeWidth={2} />
        </button>
      );
    }
    if (col.render) return col.render(value, row);
    if (col.badge) {
      const variant = col.badge(value, row);
      return <span className={`ng-badge ng-badge--${variant}`}>{value}</span>;
    }
    if (col.isLink) {
      return (
        <span
          className="ng-link"
          onClick={(e) => {
            e.stopPropagation();
            onRowClick?.(row);
          }}
        >
          {value}
        </span>
      );
    }
    return value ?? "—";
  };

  const rowIsClickable = onRowClick && !displayColumns.some((c) => c.isLink);
  const cellAlign = (col, colIndex) => col.align ?? (colIndex === 0 ? "left" : "center");

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className={`ng-card ${fill ? "ng-card--fill" : ""}`}>
      <ConfirmDialog
        isOpen={deleteConfirmState.open}
        type="danger"
        message={`Delete record ${deleteConfirmState.meta?.id ?? ""}?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={closeDeleteConfirm}
      />

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
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <label htmlFor="ng-pagesize-select">entries</label>
          </div>
        </div>
      )}

      {/* ── search bar ── */}
      {searchable && (
        <div className="eg-search-bar">
          <GridSearch
            query={searchQuery}
            onChange={handleSearchChange}
            matchCount={filteredData.length}
            totalCount={data.length}
          />
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
              <table
                className={`ng-table${hasPinnedActions ? " ng-table--pinned-actions" : ""}`}
              >
                <colgroup>
                  {displayColumns.map((col, i) => (
                    <col
                      key={i}
                      className={isActionColumn(col) ? "ng-col--action" : undefined}
                      style={getColStyle(col)}
                    />
                  ))}
                </colgroup>

                <thead>
                  <tr>
                    {displayColumns.map((col, i) => {
                      const active = isFilterActive(columnFilters[col.key]);
                      const filterRef = col.filterable ? getFilterRef(col.key) : null;
                      const actionCol = isActionColumn(col);
                      const selectCol = isSelectColumn(col);
                      return (
                        <th
                          key={i}
                          className={
                            actionCol
                              ? `ng-col--action${col.actionType === "delete" ? " ng-col--action-delete" : ""}${selectCol ? " ng-col--action-select" : ""}`
                              : undefined
                          }
                          style={{
                            textAlign: cellAlign(col, i),
                            ...getColStyle(col),
                            ...(actionCol ? { left: `${getActionOffset(i)}px` } : {}),
                          }}
                        >
                          {selectCol ? (
                            <input
                              type="checkbox"
                              className="ng-row-select ng-row-select--header"
                              checked={allPageRowsSelected}
                              aria-label="Select all rows on this page"
                              title="Select all rows on this page"
                              onChange={togglePageSelection}
                            />
                          ) : (
                            <div className="ng-th-inner">
                              <span className="ng-th-label">{col.label}</span>
                              {col.filterable && (
                                <span
                                  ref={filterRef}
                                  className={`ng-filter-icon ${active ? "ng-filter-icon--active" : ""}`}
                                  onClick={() => toggleFilter(col.key)}
                                  role="button"
                                  aria-label={`Filter ${col.label}`}
                                  title={`Filter ${col.label}`}
                                >
                                  <Filter size={11} color="#162d5c" />
                                </span>
                              )}
                            </div>
                          )}
                          {/* Active filter indicator */}
                          {!selectCol && active && (
                            <span className="ng-filter-dot" aria-label="Filter active" />
                          )}
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
                        className={rowIsClickable ? "ng-row--clickable" : ""}
                        onClick={rowIsClickable ? () => onRowClick(row) : undefined}
                      >
                        {displayColumns.map((col, ci) => (
                          <td
                            key={ci}
                            className={
                              isActionColumn(col)
                                ? `ng-col--action${isSelectColumn(col) ? " ng-col--action-select" : ""}${col.actionType === "delete" ? " ng-col--action-delete" : ""}`
                                : undefined
                            }
                            style={{
                              textAlign: cellAlign(col, ci),
                              ...getColStyle(col),
                              ...(isActionColumn(col) ? { left: `${getActionOffset(ci)}px` } : {}),
                            }}
                            data-col={col.key}
                          >
                            {renderCell(col, row, ri)}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={displayColumns.length} className="ng-empty-cell">
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
                  Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> –{" "}
                  <strong>{Math.min(currentPage * itemsPerPage, filteredData.length)}</strong> of{" "}
                  <strong>{filteredData.length}</strong> entries
                  {filteredData.length !== data.length && ` (filtered from ${data.length})`}
                </p>
                <div className="ng-pagination-controls">
                  <button
                    className="ng-page-btn"
                    onClick={() => setCurrentPage((p) => p - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <button
                    className="ng-page-btn"
                    onClick={() => setCurrentPage((p) => p + 1)}
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
      {activeFilterCol &&
        (() => {
          const col = displayColumns.find((c) => c.key === activeFilterCol);
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
