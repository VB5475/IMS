// NormalGrid.jsx — updated to use shared ColumnFilter component
// Changes from original:
//   • Header filter dropdowns replaced with the shared ColumnFilter popup
//   • columnFilters state uses the same shape as GridForm (Set / range objects)
//   • applyColumnFilterValue + isFilterActive imported from ColumnFilter.jsx
//   • filterType on each column controls which filter UI renders
//     ('list' | 'date' | 'number' | 'text')

import React, { useState, useMemo, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { ChevronLeft, ChevronRight, Filter, Pencil, Trash2, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../api/useApi";
import { API_BASE_URL_IMS, ENDPOINTS } from "../../api/constants";
import { useNotification } from "../../context/NotificationContext";
import { useModuleRights } from "../../hooks/useModuleRights";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { formatListDate, isDateColumnDef } from "../../utils/dateFormat";
import { resolveRowFieldValue } from "../../utils/gridUtils";
import { inferListColumnFilterType } from "../../utils/listGridUtils";
import Loader from "../ui/Loader";
import ConfirmDialog from "../ui/ConfirmDialog";
import ColumnFilter, { applyColumnFilterValue, isFilterActive } from "./Columnfilter";
import GridSearch from "./GridSearch";
import "./EnterpriseDataGrid.css";

const ACTION_COLUMN_KEYS = new Set(["_actions", "_action_edit", "_action_delete", "_action_select"]);
const SELECT_COLUMN_KEY = "_action_select";

// Project-wide default sort — see the `defaultSort` prop doc below.
const DEFAULT_SORT = { key: "idnumber", direction: "desc" };

function isActionColumn(col) {
  return ACTION_COLUMN_KEYS.has(col.key) || col.isAction;
}

function isSelectColumn(col) {
  return col.key === SELECT_COLUMN_KEY || col.actionType === "select";
}

function findColumnSampleValue(rows, key) {
  if (!Array.isArray(rows)) return undefined;
  for (const row of rows) {
    const val = resolveRowFieldValue(row, key) ?? row?.[key];
    if (val != null && val !== "" && val !== "-") return val;
  }
  return undefined;
}

/** Ensure date columns use the date-range filter, not the checkbox list filter. */
function normalizeGridColumnFilter(col, rows) {
  if (!col?.filterable || isActionColumn(col) || isSelectColumn(col)) return col;

  const sample = findColumnSampleValue(rows, col.key);
  let filterType = col.filterType;
  if (filterType === "select") filterType = "list";

  const inferred = inferListColumnFilterType(col.key, sample);
  if (isDateColumnDef(col) || inferred === "date") {
    filterType = "date";
  } else if (!filterType) {
    filterType = col.dropdownOptions?.length ? "list" : inferred || "text";
  }

  const next = { ...col, filterType };
  if (filterType === "date" && !next.render) {
    next.render = (_value, row) => formatListDate(resolveRowFieldValue(row, col.key) ?? row?.[col.key]);
  }
  return next;
}

/**
 * Strips Edit / Delete affordances the login's module rights do not grant.
 * Every list page in the app renders through this grid, so gating here covers
 * them all regardless of which listGridUtils helper built the column.
 * See session/moduleRights.js — unlisted modules stay unrestricted.
 */
function applyRightsToActionColumns(columns, { canUpdate, canDelete }) {
  if (canUpdate && canDelete) return columns;
  if (!Array.isArray(columns) || columns.length === 0) return columns;

  const permitted = [];
  for (const col of columns) {
    if (col.actionType === "edit" && !canUpdate) continue;
    if (col.actionType === "delete" && !canDelete) continue;
    // Asset Depreciation, Asset Item Opening and CWIP To FA hand-roll an
    // edit-only "_actions" column with an inline render instead of going
    // through listGridUtils, so they carry no actionType to switch on.
    if (col.key === "_actions" && !col.actionType && !canUpdate) continue;
    if (col.actionType === "actions") {
      if (!canUpdate && !canDelete) continue;
      // Combined column keeps its header but renders only the allowed button,
      // so it narrows to the single-action width.
      permitted.push({
        ...col,
        hideEdit: !canUpdate,
        hideDelete: !canDelete,
        width: "44px",
        minWidth: 44,
      });
      continue;
    }
    permitted.push(col);
  }
  return permitted;
}

/** Place select + edit/action columns first; data columns keep their relative order. */
function orderColumnsWithActionsFirst(columns, selectable = false) {
  if (!Array.isArray(columns) || columns.length === 0) return columns;
  // Explicit width (not just minWidth) — without it, this column's actual
  // rendered width falls back to the general .ng-col--action CSS rule's 56px
  // instead of .ng-col--action-select's narrower 40px (2026-08-25 /pm,
  // confirmed live: removing this widened every selectable grid's checkbox
  // column from 40px to 56px). Applies to every selectable grid project-wide
  // — purely additive/narrowing, matches the width already intended by the
  // "-select" CSS class.
  const selectCol = selectable
    ? [{ key: SELECT_COLUMN_KEY, label: "", actionType: "select", width: "40px", minWidth: 40, isAction: true }]
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
 * paginationMode {'client'|'server'} Client slice (default) or server-driven pages
 * currentPage    {number}          Controlled page when paginationMode='server'
 * onPageChange   {(page) => void}  Page change callback for server pagination
 * totalRowCount  {number}          Total rows from API for server pagination
 * emptyMessage   {string}          Empty-state text (default: 'No records found.')
 * bottomPanelExtras {ReactNode}    Extra controls rendered in the pagination bar
 * searchable     {boolean}         Enable text search across visible columns
 * hideSearchBar  {boolean}         Suppress the grid's own search row — use when the
 *                                  page renders its own <GridSearch> elsewhere (e.g. title bar)
 * searchQuery    {string}          Controlled search value; pairs with onSearchChange +
 *                                  hideSearchBar to drive filtering from an external search box
 * onSearchChange {(q) => void}     Required alongside searchQuery for controlled search
 * onSearchStats  {(stats) => void} Called with { matchCount, totalCount } on every filter
 *                                  pass, so an external search box can show the same counts
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
  paginationMode = "client",
  currentPage: currentPageProp,
  onPageChange,
  totalRowCount = 0,
  emptyMessage = "No records found.",
  bottomPanelExtras = null,
  hideHeader = false,
  fill = false,
  variant = "",
  searchable = false,
  hideSearchBar = false,
  searchQuery: controlledSearchQuery,
  onSearchChange: controlledOnSearchChange,
  onSearchStats,
  deleteProcName = "",
  onDeleteSuccess,
  selectable = false,
  /** Radio-like selection — picking a row replaces the selection instead of adding to it, and hides the header "select all" checkbox. */
  singleSelect = false,
  selectedRowKeys = [],
  onSelectionChange,
  getRowKey = (row, index) =>
    String(row?.IDNUMBER ?? row?.idnumber ?? row?.IDNumber ?? row?.MasterID ?? index),
  // (row) => { statusKey, locked, selectable } — e.g. useApprovalRowStatus(moduleKey).
  // statusKey adds a `ng-row--status-<statusKey>` class and renders a small
  // glyph in the actions column next to Edit/Delete (checkmark for
  // "approved", filled amber dot for "inApproval" — project-wide since
  // 2026-08-31 /pm, piloted on Purchase Quotation first). `locked` disables
  // that row's Edit/Delete actions. Rows it returns a no-op state for (or
  // when this prop is omitted) render exactly as before — no flag needed to
  // opt in, every page already passing getRowState gets this automatically.
  // See src/config/approvalStatusConfig.js.
  getRowState = null,
  // Initial sort, applied once on mount — { key, direction: "asc"|"desc" }.
  // Project-wide default (2026-08-27 /pm, "newest first everywhere"): every
  // list page's own record id, descending. `key` is resolved the same
  // case-insensitive way as everything else in this grid (resolveRowFieldValue),
  // so this one default works regardless of a module's actual column casing
  // (idnumber / IDNumber / IDNUMBER all seen across real list SPs in this app)
  // — no per-page wiring needed for the blanket rule. A module that needs a
  // different rule can still override via this prop; see
  // src/config/defaultSortConfig.js for the (currently empty) per-module
  // override table and its `useDefaultSort(moduleKey)` hook.
  defaultSort = DEFAULT_SORT,
}, ref) {
  const navigate = useNavigate();
  const notify = useNotification();
  const moduleRights = useModuleRights();
  const { postDelete } = useApi(API_BASE_URL_IMS);
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [sortConfig, setSortConfig] = useState(defaultSort);
  const [currentPage, setCurrentPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const isSearchControlled = controlledSearchQuery !== undefined;
  const searchQuery = isSearchControlled ? controlledSearchQuery : internalSearchQuery;
  const [deletedRowIds, setDeletedRowIds] = useState(() => new Set());
  const [deletingRowIds, setDeletingRowIds] = useState(() => new Set());
  const [deleteConfirmState, setDeleteConfirmState] = useState({
    open: false,
    row: null,
    meta: null,
  });
  const itemsPerPage = pageSizeProp ?? internalPageSize;
  const isServerPagination = paginationMode === "server";
  const activePage = isServerPagination ? Math.max(1, currentPageProp ?? 1) : currentPage;

  const handleSearchChange = useCallback(
    (q) => {
      if (isSearchControlled) controlledOnSearchChange?.(q);
      else setInternalSearchQuery(q);
    },
    [isSearchControlled, controlledOnSearchChange]
  );

  // Reset to page 1 whenever the search query changes, whether it was
  // typed into the grid's own bar or an externally-rendered search box.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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

  const permittedColumns = useMemo(
    () => applyRightsToActionColumns(columns, moduleRights),
    [columns, moduleRights]
  );

  const displayColumns = useMemo(
    () =>
      orderColumnsWithActionsFirst(permittedColumns, selectable).map((col) =>
        normalizeGridColumnFilter(col, data)
      ),
    [permittedColumns, selectable, data]
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
      if (!isServerPagination) setCurrentPage(1);
    },
    [isServerPagination, itemsPerPage, onPageSizeChange]
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
        const raw = resolveRowFieldValue(row, col.key) ?? row[col.key];
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

  /* ── Sort (on top of filters) ─────────────────────────────────────── */
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    const col = displayColumns.find((c) => c.key === sortConfig.key);
    const data = [...filteredData];
    data.sort((a, b) => {
      // resolveRowFieldValue first — case-insensitive, same resolver getRowKey's
      // own default already relies on — so a config-driven key like "idnumber"
      // sorts correctly regardless of a module's real column casing
      // (idnumber / IDNumber / IDNUMBER all seen across real list SPs in this
      // app); raw property access stays as a fallback for anything it misses.
      const rawA = resolveRowFieldValue(a, sortConfig.key) ?? a[sortConfig.key];
      const rawB = resolveRowFieldValue(b, sortConfig.key) ?? b[sortConfig.key];
      const aVal = col?.dropdownOptions
        ? (col.dropdownOptions.find((o) => String(o.value) === String(rawA))?.label ?? rawA)
        : rawA;
      const bVal = col?.dropdownOptions
        ? (col.dropdownOptions.find((o) => String(o.value) === String(rawB))?.label ?? rawB)
        : rawB;
      const aStr = aVal ?? "";
      const bStr = bVal ?? "";
      const aNum = Number(aStr);
      const bNum = Number(bStr);
      let cmp;
      if (!isNaN(aNum) && !isNaN(bNum) && aStr !== "" && bStr !== "") {
        cmp = aNum - bNum;
      } else {
        cmp = String(aStr).localeCompare(String(bStr), undefined, { numeric: true });
      }
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
    return data;
  }, [filteredData, sortConfig, displayColumns]);

  // CSV Export (ListPanelHeader's onExportCsv, see project_csv_export_master_lists.md)
  // reads the fully search+filter+sort-applied dataset — sortedData is exactly
  // that, just not yet paginated — so the exported file matches what the user
  // is actually looking at, not merely the current page slice. Action/select
  // columns are stripped since they're UI affordances, not real data.
  useImperativeHandle(ref, () => ({
    getExportData: () => ({
      rows: sortedData,
      columns: displayColumns
        .filter((c) => !isActionColumn(c) && !isSelectColumn(c))
        .map((c) => ({ key: c.key, label: c.label })),
    }),
  }), [sortedData, displayColumns]);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  }, []);

  // Let an externally-rendered search box (e.g. one placed in the page's
  // title bar instead of this card's own header) show the same match count.
  useEffect(() => {
    onSearchStats?.({ matchCount: filteredData.length, totalCount: data.length });
  }, [filteredData.length, data.length, onSearchStats]);

  const paginationTotalRows = isServerPagination ? Math.max(0, totalRowCount) : sortedData.length;
  const totalPages = Math.max(1, Math.ceil(paginationTotalRows / itemsPerPage));

  const currentData = useMemo(() => {
    if (isServerPagination) return sortedData;
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [currentPage, isServerPagination, itemsPerPage, sortedData]);

  const goToPage = useCallback(
    (nextPage) => {
      const safePage = Math.max(1, Math.min(totalPages, nextPage));
      if (isServerPagination) onPageChange?.(safePage);
      else setCurrentPage(safePage);
    },
    [isServerPagination, onPageChange, totalPages]
  );

  const selectedKeySet = useMemo(
    () => new Set((selectedRowKeys || []).map(String)),
    [selectedRowKeys]
  );

  const toggleRowSelection = useCallback(
    (row, index) => {
      if (!selectable || !onSelectionChange) return;
      const key = String(getRowKey(row, index));
      if (singleSelect) {
        onSelectionChange(selectedKeySet.has(key) ? [] : [key]);
        return;
      }
      const next = new Set(selectedKeySet);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onSelectionChange(Array.from(next));
    },
    [getRowKey, onSelectionChange, selectable, selectedKeySet, singleSelect]
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
    const value = resolveRowFieldValue(row, col.key) ?? row[col.key];
    const rowLocked = Boolean(getRowState?.(row)?.locked);
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
          title={rowLocked ? "Locked — cannot edit while in this approval status" : meta.title ?? "Edit record"}
          aria-label={meta.ariaLabel ?? "Edit record"}
          onClick={(e) => {
            e.stopPropagation();
            if (meta.onClick) meta.onClick();
            else if (meta.navigateTo) navigate(meta.navigateTo, { state: meta.navigateState });
          }}
          disabled={rowLocked}
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
          title={rowLocked ? "Locked — cannot delete while in this approval status" : meta.title ?? "Delete record"}
          aria-label={meta.ariaLabel ?? "Delete record"}
          onClick={(e) => {
            e.stopPropagation();
            openDeleteConfirm(row, meta);
          }}
          disabled={isDeleting || !deleteProcName || rowLocked}
        >
          <Trash2 size={13} strokeWidth={2} />
        </button>
      );
    }
    if (col.actionType === "actions") {
      const editMeta = col.getEditMeta?.(row) ?? {};
      const deleteMeta = col.getDeleteMeta?.(row) ?? {};
      const rowId = deleteMeta.id ?? row?.IDNUMBER ?? row?.idnumber ?? row?.IDNumber ?? 0;
      const isDeleting = deletingRowIds.has(String(rowId));
      const statusKey = getRowState?.(row)?.statusKey;
      return (
        <div className="ng-action-btns">
          {statusKey === "approved" && (
            <span className="ng-status-marker ng-status-marker--approved" title="Approved" aria-label="Approved">
              <Check size={11} strokeWidth={3.5} />
            </span>
          )}
          {statusKey === "inApproval" && (
            <span className="ng-status-marker ng-status-marker--in-approval" title="Pending Approval" aria-label="Pending Approval" />
          )}
          {!col.hideEdit && (
            <button
              type="button"
              className={col.editClassName}
              title={rowLocked ? "Locked — cannot edit while in this approval status" : editMeta.title ?? "Edit record"}
              aria-label={editMeta.ariaLabel ?? "Edit record"}
              onClick={(e) => {
                e.stopPropagation();
                if (editMeta.onClick) editMeta.onClick();
                else if (editMeta.navigateTo) navigate(editMeta.navigateTo, { state: editMeta.navigateState });
              }}
              disabled={rowLocked}
            >
              <Pencil size={13} strokeWidth={2} />
            </button>
          )}
          {!col.hideDelete && (
            <button
              type="button"
              className={col.deleteClassName}
              title={rowLocked ? "Locked — cannot delete while in this approval status" : deleteMeta.title ?? "Delete record"}
              aria-label={deleteMeta.ariaLabel ?? "Delete record"}
              onClick={(e) => {
                e.stopPropagation();
                openDeleteConfirm(row, deleteMeta);
              }}
              disabled={isDeleting || !deleteProcName || rowLocked}
            >
              <Trash2 size={13} strokeWidth={2} />
            </button>
          )}
        </div>
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
  // Refreshes (filter changes) keep the current rows on screen behind a
  // translucent overlay — swapping the table for the loader collapses the
  // card height and flashes.
  const overlayLoad = loading && !error && data.length > 0;
  const blockingLoad = loading && !overlayLoad;
  const showPagination =
    !blockingLoad && !error && (isServerPagination ? paginationTotalRows > 0 : filteredData.length > 0);
  const paginationStart =
    paginationTotalRows === 0 ? 0 : (activePage - 1) * itemsPerPage + 1;
  const paginationEnd = isServerPagination
    ? Math.min(activePage * itemsPerPage, paginationTotalRows)
    : Math.min(activePage * itemsPerPage, filteredData.length);

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div
      className={`ng-card ${fill ? "ng-card--fill" : ""} ${variant ? `ng-card--${variant}` : ""
        }`.trim()}
    >
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
      {searchable && !hideSearchBar && (
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
        {blockingLoad ? (
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
                      className={
                        isActionColumn(col)
                          ? `ng-col--action${col.actionType === "actions" ? " ng-col--actions" : ""}`
                          : undefined
                      }
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
                              ? `ng-col--action${col.actionType === "delete" ? " ng-col--action-delete" : ""}${col.actionType === "actions" ? " ng-col--actions" : ""}${selectCol ? " ng-col--action-select" : ""}`
                              : undefined
                          }
                          style={{
                            textAlign: cellAlign(col, i),
                            ...getColStyle(col),
                            ...(actionCol ? { left: `${getActionOffset(i)}px` } : {}),
                          }}
                        >
                          {selectCol ? (
                            singleSelect ? null : (
                              <input
                                type="checkbox"
                                className="ng-row-select ng-row-select--header"
                                checked={allPageRowsSelected}
                                aria-label="Select all rows on this page"
                                title="Select all rows on this page"
                                onChange={togglePageSelection}
                              />
                            )
                          ) : (
                            <div className="ng-th-inner">
                              <span
                                className="ng-th-label"
                                onClick={actionCol || col.sortable === false ? undefined : () => handleSort(col.key)}
                                role={actionCol || col.sortable === false ? undefined : "button"}
                                style={actionCol || col.sortable === false ? undefined : { cursor: "pointer" }}
                                title={actionCol || col.sortable === false ? undefined : `Sort by ${col.label}`}
                              >
                                {col.label}
                                {!actionCol && col.sortable !== false && sortConfig.key === col.key && (
                                  <span className="ng-sort-icon">
                                    {sortConfig.direction === "asc" ? "▲" : "▼"}
                                  </span>
                                )}
                              </span>
                              {col.filterable && (
                                <span
                                  ref={filterRef}
                                  className={`ng-filter-icon${active ? " ng-filter-icon--active" : ""}`}
                                  onClick={() => toggleFilter(col.key)}
                                  role="button"
                                  aria-label={
                                    active
                                      ? `Filter applied on ${col.label}`
                                      : `Filter ${col.label}`
                                  }
                                  title={
                                    active
                                      ? `Filter applied on ${col.label}`
                                      : `Filter ${col.label}`
                                  }
                                  data-filter-active={active ? "true" : "false"}
                                >
                                  <Filter size={11} strokeWidth={active ? 2.5 : 2} />
                                  {active && (
                                    <span className="ng-filter-dot" aria-hidden="true" />
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {currentData.length > 0 ? (
                    currentData.map((row, ri) => {
                      const rowSelected = selectedKeySet.has(String(getRowKey(row, ri)));
                      const rowStatusKey = getRowState?.(row)?.statusKey;
                      const rowClasses = [
                        rowIsClickable ? "ng-row--clickable" : "",
                        rowSelected ? "ng-row--selected" : "",
                        rowStatusKey ? `ng-row--status-${rowStatusKey}` : "",
                      ].filter(Boolean).join(" ");
                      return (
                        <tr
                          key={ri}
                          className={rowClasses}
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
                      );
                    })
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

          </>
        )}

        {overlayLoad && (
          <div className="ng-refresh-overlay" aria-live="polite" aria-busy="true">
            <Loader text={loaderText} />
          </div>
        )}

        {/* ── pagination bar ── */}
        {(showPagination || bottomPanelExtras) && (
          <div className="ng-bottom-panel">
            {showPagination && (
              <p className="ng-pagination-info">
                Showing <strong>{paginationStart}</strong> –{" "}
                <strong>{paginationEnd}</strong> of{" "}
                <strong>{paginationTotalRows}</strong> entries
                {!isServerPagination && filteredData.length !== data.length && ` (filtered from ${data.length})`}
              </p>
            )}
            {bottomPanelExtras && (
              <div className="ng-bottom-panel__extras">{bottomPanelExtras}</div>
            )}
            {showPagination && (
              <div className="ng-pagination-controls">
                <button
                  className="ng-page-btn"
                  onClick={() => goToPage(activePage - 1)}
                  disabled={activePage === 1}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <button
                  className="ng-page-btn"
                  onClick={() => goToPage(activePage + 1)}
                  disabled={activePage >= totalPages}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
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

export default forwardRef(EnterpriseDataGrid);
