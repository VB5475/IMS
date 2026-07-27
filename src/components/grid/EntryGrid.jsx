// TxnEntryGridForm.jsx
// ─────────────────────────────────────────────────────────────────────
// Dedicated data-entry grid for TxnEntryForm.
// Supports two modes:
//   mode="entry" (default / readOnly=false):
//     • Cells are editable (text, date, dropdown, textarea)
//     • Cell-event hooks fire on blur (Tab or mouse) for configured EVENT_COLUMNS
//     • Bottom panel: Export, Copy, Save
//     • Rows added imperatively via ref.addRow(blankRow)
//
//   mode="read" (readOnly=true):
//     • All cells render as plain labels — no editing
//     • No cell-event hooks, no bottom panel
//     • Checkbox selection still works (for picking rows)
//     • Accepts initialRows to pre-populate the grid
//
// EVENT_COLUMNS — ColNames that trigger onCellEvent when the user leaves the cell.

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  lazy,
  Suspense,
} from "react";
import { ChevronDown, ChevronRight, StickyNote } from "lucide-react";
import GridSearch from "./GridSearch";
const SearchSelect = lazy(() => import("../ui/SearchSelect"));
import TxnEntryBottomPanel from "./EntryGridBottomPanel";
const CollapsibleGrid = lazy(() => import("./CollapsibleGrid"));
const GridDatePicker = lazy(() => import("./GridDatePicker"));
const GridNumberInput = lazy(() => import("./GridNumberInput"));
import Loader from "../ui/Loader";
import Modal from "../ui/Modal";
import "./EntryGrid.css";

const gridCellLazyFallback = (
  <div className="eg-cell-lazy-fallback">
    <Loader text="" />
  </div>
);

const gridChildLazyFallback = <Loader text="Loading details…" />;
import {
  isColumnFixed,
  isColumnEditable,
  getColumnCellClass,
  getColumnHeaderThemeClass,
} from "./gridColumnClass";
import {
  mergeRowDropdownOptions,
  normalizeDropdownOptions,
  resolveDropdownLabel,
  resolveRowCellValue,
  syncEditGridDropdownValues,
} from "../../utils/gridUtils";
import { focusFirstGridCell, handleGridKeyboardEvent } from "../../utils/gridKeyboardNav";
import { selectInputText } from "../../utils/focusUtils";
import {
  formatColumnDisplayValue,
  getDateInputConstraints,
  isColumnMandatory,
  isNumericColumnDef,
  resolveColumnMeta,
  validateColumnValue,
} from "../../utils/columnValidation";
import { parseNumberInput } from "../../utils/numberFormat";
import { isDateColumnDef } from "../../utils/dateFormat";
import RequiredFieldMark from "../ui/RequiredFieldMark";
import { parseSerialNumbers } from "../../utils/parseSerialNumbers";
import { isCheckboxColCtrlType } from "../../data/dummyData";
import { useNotification } from "../../context/NotificationContext";

// ── Helper utils ───────────────────────────────────────────────────────
function toPixels(w) {
  if (typeof w === "number") return w;
  if (typeof w === "string") return parseInt(w, 10) || 0;
  return 0;
}

function downloadCSV(filename, csvContent) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ── Columns that fire onCellEvent when the user leaves the cell ───────
// These match the ColName values returned by GET_DETAIL_COL_DATA.
const EVENT_COLUMNS = new Set([
  "ItemID",
  "TranQty",
  "BaseQty",
  "BaseRate",
  "TranRate",
  "DiscPerc",
  "Expense",
  "GSTPerc",
]);

// Remark columns (remarkModalColumns) open the paste-friendly modal as soon
// as the user starts typing in the inline cell input, instead of requiring
// an explicit click on the note icon — a grid cell is too cramped for
// anything past a couple of characters, so this hands off to the bigger
// editing surface (with focus transferred) on the very first keystroke.

// ── Component ─────────────────────────────────────────────────────────
const TxnEntryGridForm = forwardRef(function TxnEntryGridForm(
  {
    config,
    title = "Invoice Line Items",
    onSave,
    onCellEvent,
    eventColumns: eventColumnsProp = null,
    readOnly = false, // true → read-only display mode (no editing)
    // Defaults to mirroring readOnly (view-mode grids can't select rows either)
    // — but pickers (OrderItemModal, SupplierPickerModal, TermsPickerModal) are
    // readOnly (cells are plain labels, not editable inputs) while still needing
    // checkbox selection to work, so they explicitly pass disableSelection={false}.
    disableSelection = readOnly,
    hideBottomPanel = false, // true → hide the Save/Export bottom toolbar (embedded grids)
    emptyMessage = null, // custom message shown when there are no rows
    tabs = null, // [{ id, label }] → renders a tab-bar header instead of the title
    activeTab = null, // currently selected tab id (controlled by parent)
    onTabChange = null, // (tabId: string) => void
    headerControls = null, // ReactNode rendered on the right side of the tab bar
    tabContentOverride = null, // ReactNode → replaces the grid body (used for other tabs)
    initialRows = null, // array → pre-populated rows (used in readOnly mode)
    onSelectionChange = null, // (count: number) => void — notifies parent of selection changes
    onRowsChange = null, // (rows: row[]) => void  — notifies parent when rows mutate
    // ── Collapsible children ─────────────────────────────────────────
    // When enableCollapsible=true each parent row that has an entry in
    // childRowsMap shows an expand toggle.  childColumns drives the sub-table.
    enableCollapsible = false,
    childRowsMap = null, // { [rowId: string]: rowData[] }
    childColumns = [], // column defs for the inline sub-table
    existingRecordEdit = false, // true → lock columns flagged IsLockOnEditModeAllow
    enableKeyboardNav = true, // Excel-like Tab / Enter / arrow / Space navigation
    containerClassName = "", // extra class on root container (nested / child grids)
    hidePagination = true, // false → opt back into a paged bar + row slicing (default: show every row, no pages)
    embedded = false, // true → nested in scroll host; parent owns overflow
    multiValuePasteColumns = null, // Set<string> | string[] — column keys that intercept multi-value paste
    onMultiValuePaste = null, // (sourceRow, colKey, values: string[]) => void
    remarkModalColumns = null, // Set<string> | string[] — column keys that open a paste-friendly remark modal
    searchable = true, // false → hide built-in search bar
  },
  ref
) {
  const notify = useNotification();
  const columnEditOpts = useMemo(
    () => ({ existingRecordEdit, viewMode: readOnly }),
    [existingRecordEdit, readOnly]
  );

  const multiValuePasteSet = useMemo(() => {
    if (!multiValuePasteColumns) return null;
    if (multiValuePasteColumns instanceof Set) return multiValuePasteColumns;
    return new Set(multiValuePasteColumns);
  }, [multiValuePasteColumns]);

  const remarkModalSet = useMemo(() => {
    if (!remarkModalColumns) return null;
    if (remarkModalColumns instanceof Set) return remarkModalColumns;
    return new Set(remarkModalColumns);
  }, [remarkModalColumns]);

  const [remarkEditor, setRemarkEditor] = useState(null); // { rowId, colKey, colName, value, readOnly }
  const remarkTextareaRef = useRef(null);

  // When the modal opens (manually or auto-opened on the first keystroke),
  // move the cursor to the end of any pre-filled text so continued typing
  // picks up where the inline cell input left off, instead of inserting at
  // the start (the default caret position autoFocus gives a filled textarea).
  useEffect(() => {
    if (!remarkEditor) return;
    const el = remarkTextareaRef.current;
    if (!el) return;
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [remarkEditor?.rowId, remarkEditor?.colKey]);

  const { columns, pagination } = config;
  const { pageSize: defaultPageSize = 25, pageSizeOptions = [10, 25, 50, 100] } = pagination || {};

  const [rows, setRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const [columnWidths, setColumnWidths] = useState(() => {
    const map = {};
    columns.forEach((c) => {
      map[c.id] = c.width;
    });
    return map;
  });
  const [resizing, setResizing] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleExpand = useCallback((id) => {
    const sid = String(id);
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  // Always-current snapshot of rows for cell-event handlers
  const rowsRef = useRef([]);
  const lastValidCellValuesRef = useRef(new Map());
  const tableWrapperRef = useRef(null);

  // Stable ref so onRowsChange never causes extra effect re-runs
  const onRowsChangeRef = useRef(onRowsChange);
  useEffect(() => {
    onRowsChangeRef.current = onRowsChange;
  }, [onRowsChange]);

  useEffect(() => {
    rowsRef.current = rows;
    onRowsChangeRef.current?.(rows);
  }, [rows]);

  const syncRowsForDropdowns = useCallback(
    (rawRows) => {
      const dataColumns = columns.filter((c) => c.key !== "cb");
      return syncEditGridDropdownValues(rawRows, dataColumns);
    },
    [columns]
  );

  // Load initialRows when provided (readOnly mode)
  useEffect(() => {
    if (initialRows && Array.isArray(initialRows) && initialRows.length > 0) {
      // Always use index-based id to guarantee uniqueness regardless of what
      // fields the API response contains (e.g. ItemID=0 on every row would
      // cause all rows to share the same id and appear selected together).
      const withIds = initialRows.map((r, i) => ({ ...r, id: `_row_${i}` }));
      setRows(syncRowsForDropdowns(withIds));
    }
  }, [initialRows, syncRowsForDropdowns]);

  // Re-sync dropdown cell values when column metadata / options arrive after rows.
  useEffect(() => {
    const hasDropdowns = columns.some((c) => c.controlType === 4 && c.key !== "cb");
    if (!hasDropdowns) return;
    setRows((prev) => {
      if (!prev.length) return prev;
      return syncEditGridDropdownValues(prev, columns);
    });
  }, [columns]);

  // ── Imperative handle ─────────────────────────────────────────
  useImperativeHandle(
    ref,
    () => ({
      addRow(blankRow) {
        setRows((prev) => [...prev, blankRow]);
      },
      getRows() {
        return rowsRef.current;
      },
      getSelectedRows() {
        return rowsRef.current.filter((r) => selectedIds.has(String(r.id)));
      },
      updateRow(rowId, fields) {
        setRows((prev) =>
          prev.map((r) => (String(r.id) === String(rowId) ? { ...r, ...fields } : r))
        );
      },
      updateAllRows(fields) {
        setRows((prev) => prev.map((r) => ({ ...r, ...fields })));
      },
      removeRows(rowIds) {
        const removeSet = new Set(rowIds.map(String));
        setRows((prev) => prev.filter((r) => !removeSet.has(String(r.id))));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          rowIds.forEach((id) => next.delete(String(id)));
          return next;
        });
      },
      clearRows() {
        setRows([]);
        setSelectedIds(new Set());
        setExpandedRows(new Set());
      },
      loadRows(newRows) {
        const withIds = (newRows || []).map((r, i) => ({
          ...r,
          id: String(r.id ?? r.CompUniqueKey ?? r.IDNumber ?? `_row_${i}`),
        }));
        setRows(syncRowsForDropdowns(withIds));
        setSelectedIds(new Set());
        setExpandedRows(new Set());
      },
      focusFirstInteractiveCell() {
        const root = tableWrapperRef.current;
        if (!root) return false;
        return focusFirstGridCell(root, readOnly, { includeHeaderRow: readOnly });
      },
      toggleFocusedRowCollapsible() {
        if (!enableCollapsible || !childRowsMap) return false;
        const active = document.activeElement;
        let rowId = active?.closest?.("tbody tr[data-eg-row-id]")?.getAttribute("data-eg-row-id");
        if (!rowId && selectedIds.size > 0) {
          rowId = [...selectedIds][0];
        }
        if (!rowId || !childRowsMap[rowId]?.length) return false;
        toggleExpand(rowId);
        return true;
      },
    }),
    [selectedIds, readOnly, enableCollapsible, childRowsMap, toggleExpand, syncRowsForDropdowns]
  );

  // Notify parent when selection changes
  useEffect(() => {
    onSelectionChange?.(selectedIds.size);
  }, [selectedIds, onSelectionChange]);

  // ── Column resize ─────────────────────────────────────────────────
  const handleResizeStart = useCallback(
    (e, colId) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = toPixels(
        columnWidths[colId] || columns.find((c) => c.id === colId)?.width || 120
      );
      setResizing({ colId, startX: e.clientX, startWidth });
    },
    [columnWidths, columns]
  );

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e) => {
      const diff = e.clientX - resizing.startX;
      setColumnWidths((prev) => ({
        ...prev,
        [resizing.colId]: Math.max(60, resizing.startWidth + diff),
      }));
    };
    const handleUp = () => setResizing(null);
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [resizing]);

  // ── Fixed column offsets ──────────────────────────────────────────
  const fixedLeftMap = useMemo(() => {
    const map = {};
    let left = 0;
    columns.forEach((col) => {
      if (isColumnFixed(col)) {
        map[col.id] = left;
        left += toPixels(columnWidths[col.id] || col.width) || 120;
      }
    });
    return map;
  }, [columns, columnWidths]);

  const lastFixedColId = useMemo(() => {
    const fixed = columns.filter((c) => isColumnFixed(c));
    return fixed.length > 0 ? fixed[fixed.length - 1].id : null;
  }, [columns]);

  // ── Dropdown label helper ─────────────────────────────────────────
  const getDropdownLabel = useCallback((col, rawValue, row = null) => {
    return resolveDropdownLabel(col, row, rawValue);
  }, []);

  // ── Remark modal context — identifies the row via its first frozen column ──
  const remarkContextCol = useMemo(() => columns.find((c) => isColumnFixed(c)) ?? null, [columns]);

  const getRemarkContextLabel = useCallback((row) => {
    if (!remarkContextCol) return null;
    const raw =
      remarkContextCol.controlType === 4
        ? resolveRowCellValue(row, remarkContextCol)
        : row[remarkContextCol.key];
    const label =
      remarkContextCol.controlType === 4 ? getDropdownLabel(remarkContextCol, raw, row) : raw;
    return label != null && label !== "" ? String(label) : null;
  }, [remarkContextCol, getDropdownLabel]);

  // ── Search ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");

  const searchedRows = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter((row) =>
      columns.some((col) => {
        if (col.key === "cb") return false;
        const val =
          col.controlType === 4
            ? resolveDropdownLabel(col, row, row[col.key])
            : row[col.key];
        return String(val ?? "").toLowerCase().includes(q);
      })
    );
  }, [rows, searchQuery, searchable, columns]);

  const handleSearchChange = useCallback((q) => {
    setSearchQuery(q);
    setPage(1);
  }, []);

  // ── Sort ──────────────────────────────────────────────────────────
  const processedRows = useMemo(() => {
    let data = [...searchedRows];
    if (sortConfig.key) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? "";
        const bVal = b[sortConfig.key] ?? "";
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        let cmp = 0;
        if (!isNaN(aNum) && !isNaN(bNum) && aVal !== "" && bVal !== "") {
          cmp = aNum - bNum;
        } else {
          cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        }
        return sortConfig.direction === "asc" ? cmp : -cmp;
      });
    }
    return data;
  }, [searchedRows, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  // hidePagination doesn't just hide the bar — it must also stop slicing,
  // or rows beyond page 1 would become unreachable with no control to page to them.
  const displayRows = hidePagination ? processedRows : processedRows.slice(startIdx, startIdx + pageSize);
  const isEmpty = displayRows.length === 0;
  const emptyStateContent =
    emptyMessage ??
    (readOnly ? (
      "No data available."
    ) : (
      <>
        Click <strong>Entry Form</strong> in the header panel to add a row.
      </>
    ));

  useEffect(() => {
    setPage(1);
  }, [pageSize, sortConfig]);

  // ── Selection ─────────────────────────────────────────────────────
  const handleSelectAll = useCallback(() => {
    const pageIds = displayRows.map((r) => String(r.id));
    if (pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageIds));
    }
  }, [selectedIds, displayRows]);

  const handleSelectRow = useCallback((id) => {
    const sid = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  // ── Cell change ───────────────────────────────────────────────────
  const handleCellChange = useCallback((rowId, colKey, value) => {
    setRows((prev) =>
      prev.map((r) => (String(r.id) === String(rowId) ? { ...r, [colKey]: value } : r))
    );
  }, []);

  const validateAndCommitCell = useCallback(
    (row, col, liveValue) => {
      const cellKey = `${row.id}:${col.key}`;
      const result = validateColumnValue(liveValue, col);
      if (!result.valid) {
        notify.error(result.message);
        const previous = lastValidCellValuesRef.current.get(cellKey);
        handleCellChange(row.id, col.key, previous ?? row[col.key]);
        return false;
      }
      lastValidCellValuesRef.current.set(cellKey, liveValue);
      handleCellChange(row.id, col.key, liveValue);
      return true;
    },
    [handleCellChange, notify]
  );

  const makeCellFocus = useCallback((row, col) => {
    return (e) => {
      const currentRow = rowsRef.current.find((r) => String(r.id) === String(row.id)) || row;
      lastValidCellValuesRef.current.set(`${row.id}:${col.key}`, currentRow[col.key]);
      selectInputText(e.target);
    };
  }, []);

  // ── Sort handler ──────────────────────────────────────────────────
  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  // ── Cell keyboard navigation (Enter = next focusable cell in row) ─
  const makeCellKeyDown = useCallback(
    (row, col) => (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const wrapper = e.currentTarget;
      const tableWrapper = tableWrapperRef.current;
      if (!tableWrapper) return;
      const allCells = [
        ...tableWrapper.querySelectorAll(
          "td .cell-wrapper input:not([disabled]):not([readonly]), td .cell-wrapper textarea:not([disabled]):not([readonly]), td .cell-wrapper .search-select__trigger:not([disabled])"
        ),
      ];
      const idx = allCells.findIndex((el) => wrapper.contains(el));
      const next = allCells[idx + 1];
      if (next) next.focus();
    },
    []
  );

  // ── Bottom panel actions ──────────────────────────────────────────
  const handleSave = useCallback(() => {
    // onSave is called without arguments — the parent reads rows
    // via gridRef.getRows() so ALL rows are saved (not just selected).
    if (onSave) onSave();
  }, [onSave]);

  const handleCopy = useCallback(() => {
    if (selectedIds.size === 0) return;
    const toCopy = rows.filter((r) => selectedIds.has(String(r.id)));
    let currentMinId = 0;
    rows.forEach((r) => {
      const n = Number(r.IDNumber);
      if (n < currentMinId) currentMinId = n;
    });
    const newRows = toCopy.map((r, idx) => {
      const newId = currentMinId - (idx + 1);
      return { ...r, id: newId, IDNumber: newId };
    });
    setRows((prev) => {
      const next = [...prev];
      for (let i = toCopy.length - 1; i >= 0; i--) {
        const idx = next.findIndex((r) => String(r.id) === String(toCopy[i].id));
        if (idx !== -1) next.splice(idx + 1, 0, newRows[i]);
        else next.push(newRows[i]);
      }
      return next;
    });
    setSelectedIds(new Set());
  }, [selectedIds, rows]);

  const handleExport = useCallback(() => {
    const headers = columns.map((c) => c.name).join(",");
    const csvRows = processedRows.map((r) =>
      columns.map((c) => `"${String(r[c.key] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    downloadCSV(`${title.replace(/\s+/g, "_")}_export.csv`, [headers, ...csvRows].join("\n"));
  }, [processedRows, columns, title]);

  const eventColumnSet = useMemo(
    () => (eventColumnsProp instanceof Set ? eventColumnsProp : new Set(eventColumnsProp || [])),
    [eventColumnsProp]
  );

  const activeEventColumns = useMemo(() => {
    if (eventColumnSet.size > 0) return eventColumnSet;
    return EVENT_COLUMNS;
  }, [eventColumnSet]);

  const fireCellEventForColumn = useCallback(
    (row, col, liveValue) => {
      if (!onCellEvent || !activeEventColumns.has(col.key)) return;
      const currentRow = rowsRef.current.find((r) => String(r.id) === String(row.id)) || row;
      onCellEvent({
        rowId: row.id,
        colKey: col.key,
        rowData: { ...currentRow, [col.key]: liveValue },
      });
    },
    [onCellEvent, activeEventColumns]
  );

  const makeCellBlur = useCallback(
    (row, col) => {
      const firesEvent = onCellEvent && activeEventColumns.has(col.key);
      return (e) => {
        const currentRow = rowsRef.current.find((r) => String(r.id) === String(row.id)) || row;
        const liveValue =
          col.controlType === 2
            ? currentRow[col.key]
            : isNumericColumnDef(col)
              ? parseNumberInput(e.target.value)
              : e.target.value;
        if (!validateAndCommitCell(currentRow, col, liveValue)) return;
        if (firesEvent) fireCellEventForColumn(currentRow, col, liveValue);
      };
    },
    [onCellEvent, activeEventColumns, fireCellEventForColumn, validateAndCommitCell]
  );

  const makeSearchSelectBlur = useCallback(
    (row, col) => {
      const firesEvent = onCellEvent && activeEventColumns.has(col.key);
      return () => {
        const currentRow = rowsRef.current.find((r) => String(r.id) === String(row.id)) || row;
        const liveValue = currentRow[col.key];
        if (!validateAndCommitCell(currentRow, col, liveValue)) return;
        if (firesEvent) fireCellEventForColumn(currentRow, col, liveValue);
      };
    },
    [onCellEvent, activeEventColumns, fireCellEventForColumn, validateAndCommitCell]
  );

  // ── Cell renderer ─────────────────────────────────────────────────
  const renderCell = (row, col) => {
    const value =
      col.controlType === 4 ? resolveRowCellValue(row, col) : (row[col.key] ?? "");
    const cellReadOnly = readOnly || !isColumnEditable(col, columnEditOpts);
    const columnMeta = resolveColumnMeta(col);
    const displayValue = formatColumnDisplayValue(value, col);

    // ── Remark columns: inline input (auto-opens the paste-friendly modal
    // at REMARK_AUTO_OPEN_LENGTH chars) + icon that opens it manually ──
    if (remarkModalSet?.has(col.key)) {
      const remarkText = value == null ? "" : String(value);
      const isEditorOpenForThisCell =
        remarkEditor?.rowId === row.id && remarkEditor?.colKey === col.key;
      const openRemarkEditor = (currentValue) =>
        setRemarkEditor({
          rowId: row.id,
          colKey: col.key,
          colName: col.name,
          value: currentValue,
          readOnly: cellReadOnly,
          contextLabel: getRemarkContextLabel(row),
          contextColLabel: remarkContextCol?.name ?? null,
          maxLen: columnMeta?.dataKind === "varchar" ? columnMeta?.maxLen : null,
        });
      return (
        <div className="cell-remark">
          {cellReadOnly ? (
            <span className="cell-remark__text" title={remarkText}>
              {remarkText || "—"}
            </span>
          ) : (
            <input
              type="text"
              className="cell-input cell-remark__input"
              value={remarkText}
              disabled={isEditorOpenForThisCell}
              placeholder="Type a remark…"
              aria-label={`${col.name} for row ${row.id}`}
              onChange={(e) => {
                const next = e.target.value;
                handleCellChange(row.id, col.key, next);
                // Hand off to the bigger modal on the very first keystroke —
                // a grid cell is too cramped for anything past a short tag.
                if (!isEditorOpenForThisCell) {
                  openRemarkEditor(next);
                }
              }}
            />
          )}
          <button
            type="button"
            className="cell-remark__icon"
            aria-label={`${cellReadOnly ? "View" : "Edit"} ${col.name} for row ${row.id}`}
            onClick={() => openRemarkEditor(remarkText)}
          >
            <StickyNote size={14} strokeWidth={2} />
          </button>
        </div>
      );
    }

    // ── Read-only mode: always render as label ──
    if (cellReadOnly) {
      if (col.controlType === 4) {
        const label = getDropdownLabel(col, value, row);
        return (
          <span className="cell-label" title={String(label)}>
            {label || "—"}
          </span>
        );
      }
      if (isCheckboxColCtrlType(col.controlType)) {
        const checked = Number(value) === 1;
        return (
          <span className="cell-label" title={checked ? "Yes" : "No"}>
            {checked ? "✓" : "—"}
          </span>
        );
      }
      if (isNumericColumnDef(col) || isDateColumnDef(col)) {
        return (
          <span className="cell-label" title={displayValue}>
            {displayValue || "—"}
          </span>
        );
      }
      return (
        <span className="cell-label" title={String(value)}>
          {value === "" || value == null ? "—" : value}
        </span>
      );
    }

    // ── Editable mode ──
    const commonProps = {
      value,
      onChange: (e) => handleCellChange(row.id, col.key, e.target.value),
      tabIndex: 0,
      "aria-label": `${col.name} for row ${row.id}`,
    };

    const dateConstraints =
      columnMeta?.dataKind === "date" ? getDateInputConstraints(columnMeta) : null;

    if (isCheckboxColCtrlType(col.controlType)) {
      const checked = Number(value) === 1;
      const firesEvent = onCellEvent && activeEventColumns.has(col.key);
      return (
        <div className="cell-checkbox">
          <input
            type="checkbox"
            className="row-checkbox"
            checked={checked}
            onChange={(e) => {
              const next = e.target.checked ? 1 : 0;
              handleCellChange(row.id, col.key, next);
              const currentRow = { ...row, [col.key]: next };
              if (!validateAndCommitCell(currentRow, col, next)) return;
              if (firesEvent) fireCellEventForColumn(currentRow, col, next);
            }}
            aria-label={`${col.name} for row ${row.id}`}
          />
        </div>
      );
    }

    switch (col.controlType) {
      case 0:
        return (
          <span className="cell-label" title={displayValue || String(value)}>
            {displayValue || value}
          </span>
        );

      case 1: {
        if (isNumericColumnDef(col)) {
          return (
            <Suspense fallback={gridCellLazyFallback}>
              <GridNumberInput
                value={value}
                columnMeta={columnMeta}
                onChange={(next) => handleCellChange(row.id, col.key, next)}
                onFocus={makeCellFocus(row, col)}
                onBlur={makeCellBlur(row, col)}
                ariaLabel={`${col.name} for row ${row.id}`}
              />
            </Suspense>
          );
        }

        const handleMultiPaste =
          multiValuePasteSet?.has(col.key) && onMultiValuePaste
            ? (e) => {
              const text = e.clipboardData?.getData("text") ?? "";
              const tokens = parseSerialNumbers(text);
              if (tokens.length < 2) return;
              e.preventDefault();
              const currentRow =
                rowsRef.current.find((r) => String(r.id) === String(row.id)) || row;
              onMultiValuePaste(currentRow, col.key, tokens);
            }
            : undefined;

        return (
          <input
            className="cell-input"
            type="text"
            {...commonProps}
            maxLength={columnMeta?.dataKind === "varchar" && columnMeta?.maxLen != null ? columnMeta.maxLen : undefined}
            onFocus={makeCellFocus(row, col)}
            onBlur={makeCellBlur(row, col)}
            onPaste={handleMultiPaste}
          />
        );
      }

      case 2:
        return (
          <Suspense fallback={gridCellLazyFallback}>
            <GridDatePicker
              value={value}
              inputFormat={columnMeta?.inputFormat ?? ""}
              minDate={dateConstraints?.min}
              maxDate={dateConstraints?.max}
              onChange={(stored) => handleCellChange(row.id, col.key, stored)}
              onFocus={makeCellFocus(row, col)}
              onBlur={makeCellBlur(row, col)}
              ariaLabel={`${col.name} for row ${row.id}`}
            />
          </Suspense>
        );

      case 4: {
        const baseOpts = normalizeDropdownOptions(col.dropdownOptions);
        const opts = mergeRowDropdownOptions(col, row, baseOpts);
        return (
          <Suspense fallback={gridCellLazyFallback}>
            <SearchSelect
              value={String(value)}
              onChange={(val) => {
                const coerced = isNumericColumnDef(col) ? (Number(val) || 0) : val;
                handleCellChange(row.id, col.key, coerced);
                const currentRow = { ...row, [col.key]: coerced };
                if (validateColumnValue(coerced, col).valid) {
                  fireCellEventForColumn(currentRow, col, coerced);
                }
              }}
              onBlur={makeSearchSelectBlur(row, col)}
              options={opts}
              placeholder="-- Select --"
              compact
              ariaLabel={`${col.name} for row ${row.id}`}
            />
          </Suspense>
        );
      }

      case 9: {
        const text = String(value ?? "");
        const lineCount = (text.match(/\n/g) || []).length + 1;
        return (
          <textarea
            className="cell-textarea"
            {...commonProps}
            rows={Math.max(1, Math.min(lineCount, 6))}
            maxLength={columnMeta?.dataKind === "varchar" && columnMeta?.maxLen != null ? columnMeta.maxLen : undefined}
            onFocus={makeCellFocus(row, col)}
            onBlur={makeCellBlur(row, col)}
          />
        );
      }

      default:
        return <span className="cell-label">{displayValue || value}</span>;
    }
  };

  // ── Cell style helpers ────────────────────────────────────────────
  const cellStyle = (col, rowType = "body") => {
    const w = `${toPixels(columnWidths[col.id] || col.width) || 120}px`;
    const base = { width: w, minWidth: w, maxWidth: w };
    if (isColumnFixed(col)) {
      base["--col-sticky-left"] = `${fixedLeftMap[col.id] ?? 0}px`;
    }
    return base;
  };

  const cellClass = (col) =>
    `${getColumnCellClass(col, lastFixedColId, columnEditOpts)} ${
      isNumericColumnDef(col) ? "numeric-col" : "text-col"
    }`;

  const getHeaderThemeClass = (col) => getColumnHeaderThemeClass(col, columnEditOpts);

  const focusCellControl = useCallback(
    (e, col) => {
      if (readOnly || col.key === "cb") return;
      if (
        e.target.closest("input, textarea, button, .search-select__trigger, .search-select__clear")
      )
        return;
      const focusable = e.currentTarget.querySelector(
        "input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), .search-select__trigger:not([disabled])"
      );
      if (focusable) {
        e.preventDefault();
        focusable.focus();
      }
    },
    [readOnly]
  );

  const handleGridKeyDown = useCallback(
    (e) => {
      if (!enableKeyboardNav || !tableWrapperRef.current) return;
      handleGridKeyboardEvent(e, {
        root: tableWrapperRef.current,
        readOnly,
        includeHeaderRow: readOnly,
        onToggleRow: handleSelectRow,
      });
    },
    [enableKeyboardNav, readOnly, handleSelectRow]
  );

  const handleScroll = useCallback((e) => {
    const el = e.target;
    setScrollState({
      left: el.scrollLeft > 5,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 5,
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={`erp-grid-container erp-grid-container--dense ${embedded ? "erp-grid-container--embedded" : "erp-grid-container--fill"} ${enableCollapsible ? "erp-grid-container--collapsible-parent" : ""} ${containerClassName} ${resizing ? "resizing" : ""}`.trim()}
    >
      {tabs && tabs.length > 0 ? (
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`grid-tab ${activeTab === t.id ? "grid-tab--active" : ""}`}
                onClick={() => onTabChange?.(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid-tabbar__controls">
            {searchable && (
              <GridSearch
                query={searchQuery}
                onChange={handleSearchChange}
                matchCount={searchedRows.length}
                totalCount={rows.length}
              />
            )}
            {headerControls}
          </div>
        </div>
      ) : title ? (
        <div className="grid-header">
          <h2 className="grid-title">{title}</h2>
          {searchable && (
            <GridSearch
              query={searchQuery}
              onChange={handleSearchChange}
              matchCount={searchedRows.length}
              totalCount={rows.length}
            />
          )}
        </div>
      ) : searchable ? (
        <div className="eg-search-bar">
          <GridSearch
            query={searchQuery}
            onChange={handleSearchChange}
            matchCount={searchedRows.length}
            totalCount={rows.length}
          />
        </div>
      ) : null}

      {tabContentOverride ? (
        <div className="grid-tab-content">{tabContentOverride}</div>
      ) : (
        <>
          {selectedIds.size > 0 && (
            <div className="selection-bar">
              <span>{selectedIds.size} row(s) selected</span>
              <button type="button" onClick={() => setSelectedIds(new Set())}>
                Clear selection
              </button>
            </div>
          )}

          <div
            className={`table-wrapper ${isEmpty ? "eg-table-wrapper--empty" : ""} ${scrollState.left ? "scrolled-left" : ""} ${scrollState.right ? "scrolled-right" : ""}`}
            ref={tableWrapperRef}
            onScroll={handleScroll}
            onKeyDown={handleGridKeyDown}
          >
            <table className="erp-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      className={`${cellClass(col) || ""} ${getHeaderThemeClass(col)}`}
                      style={cellStyle(col, "header")}
                    >
                      {col.key === "cb" ? (
                        <div className="header-cell-content" style={{ justifyContent: "center" }}>
                          <input
                            type="checkbox"
                            className="row-checkbox"
                            title={disableSelection ? "Enter Add/Edit mode to select rows" : "Select / deselect all visible rows"}
                            aria-label="Select all rows"
                            disabled={disableSelection}
                            checked={
                              displayRows.length > 0 &&
                              displayRows.every((r) => selectedIds.has(String(r.id)))
                            }
                            onChange={handleSelectAll}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      ) : (
                        <div className="header-cell-content">
                          <span
                            className="header-label"
                            onClick={() => handleSort(col.key)}
                            style={{ cursor: "pointer" }}
                          >
                            <span className="field-caption">
                              <span>{col.name}</span>
                              {isColumnMandatory(col) && <RequiredFieldMark />}
                            </span>
                            {sortConfig.key === col.key && (
                              <span className="sort-icon">
                                {sortConfig.direction === "asc" ? "▲" : "▼"}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      <div
                        className="resize-handle"
                        onMouseDown={(e) => handleResizeStart(e, col.id)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>

              {!isEmpty && (
                <tbody>
                  {displayRows.map((row) => {
                    const rowId = String(row.id);
                    const hasChildren =
                      enableCollapsible && childRowsMap && childRowsMap[rowId]?.length > 0;
                    const isExpanded = hasChildren && expandedRows.has(rowId);
                    return (
                      <React.Fragment key={row.id}>
                        <tr
                          className={selectedIds.has(rowId) ? "selected" : ""}
                          data-eg-row-id={rowId}
                        >
                          {columns.map((col) => (
                            <td
                              key={`${row.id}-${col.id}`}
                              className={cellClass(col)}
                              style={cellStyle(col, "body")}
                              onMouseDown={(e) => focusCellControl(e, col)}
                              onClick={() => {
                                if (col.key === "cb" && !disableSelection) handleSelectRow(row.id);
                              }}
                            >
                              <div className="cell-wrapper">
                                {col.key === "cb" ? (
                                  <div className="cell-checkbox">
                                    {hasChildren && (
                                      <button
                                        type="button"
                                        className="eg-expand-toggle"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleExpand(row.id);
                                        }}
                                        title={
                                          isExpanded
                                            ? "Collapse indent details"
                                            : "Expand indent details"
                                        }
                                        aria-expanded={isExpanded}
                                      >
                                        {isExpanded ? (
                                          <ChevronDown size={11} strokeWidth={2.5} />
                                        ) : (
                                          <ChevronRight size={11} strokeWidth={2.5} />
                                        )}
                                      </button>
                                    )}
                                    <input
                                      type="checkbox"
                                      className="row-checkbox"
                                      disabled={disableSelection}
                                      title={disableSelection ? "Enter Add/Edit mode to select rows" : undefined}
                                      checked={selectedIds.has(rowId)}
                                      onChange={() => handleSelectRow(row.id)}
                                      onClick={(e) => e.stopPropagation()}
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

                        {isExpanded && (
                          <tr className="eg-child-row">
                            <td colSpan={columns.length} className="eg-child-cell">
                              <Suspense fallback={gridChildLazyFallback}>
                                <CollapsibleGrid
                                  variant="inline"
                                  columns={childColumns.filter((c) => c.key !== "cb")}
                                  rows={childRowsMap[rowId]}
                                  defaultExpanded
                                  recordLabel="indent record"
                                />
                              </Suspense>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                </tbody>
              )}
            </table>
            {isEmpty && (
              <div className="eg-empty-state" role="status">
                {emptyStateContent}
              </div>
            )}
          </div>

          {!hidePagination && (
            <div className="pagination-bar">
              <div className="pagination-left">
                Showing <strong>{processedRows.length > 0 ? startIdx + 1 : 0}</strong> –{" "}
                <strong>{Math.min(startIdx + pageSize, processedRows.length)}</strong> of{" "}
                <strong>{processedRows.length}</strong> records
              </div>
              <div className="pagination-right">
                <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>Rows:</span>
                <select
                  className="page-size-select"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {pageSizeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="page-btn"
                  onClick={() => setPage(1)}
                  disabled={safePage <= 1}
                >
                  «
                </button>
                <button
                  type="button"
                  className="page-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) => p === 1 || p === totalPages || (p >= safePage - 2 && p <= safePage + 2)
                  )
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span style={{ color: "var(--text-muted)", padding: "0 4px" }}>…</span>
                      )}
                      <button
                        type="button"
                        className={`page-btn ${p === safePage ? "active" : ""}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
                <button
                  type="button"
                  className="page-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  ›
                </button>
                <button
                  type="button"
                  className="page-btn"
                  onClick={() => setPage(totalPages)}
                  disabled={safePage >= totalPages}
                >
                  »
                </button>
              </div>
            </div>
          )}

          {/* Bottom toolbar — hidden in readOnly / embedded mode */}
          {!readOnly && !hideBottomPanel && (
            <TxnEntryBottomPanel
              selectedCount={selectedIds.size}
              onExportExcel={handleExport}
              onCopy={handleCopy}
              onSave={handleSave}
            />
          )}
        </>
      )}

      {remarkEditor && (
        <Modal
          isOpen
          onClose={() => setRemarkEditor(null)}
          title={remarkEditor.readOnly ? remarkEditor.colName : `Edit ${remarkEditor.colName}`}
          subtitle={
            remarkEditor.contextLabel
              ? `${remarkEditor.contextColLabel ? `${remarkEditor.contextColLabel}: ` : ""}${remarkEditor.contextLabel}`
              : undefined
          }
          icon={<StickyNote size={16} strokeWidth={2} />}
          size="sm"
          variant="enterprise"
          footer={
            remarkEditor.readOnly ? null : (
              <div className="filter-actions cell-remark-modal__footer">
                <button type="button" onClick={() => setRemarkEditor(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary"
                  title="Save Remark (Alt+R)"
                  onClick={() => {
                    handleCellChange(remarkEditor.rowId, remarkEditor.colKey, remarkEditor.value);
                    setRemarkEditor(null);
                  }}
                >
                  Save
                </button>
              </div>
            )
          }
        >
          <textarea
            ref={remarkTextareaRef}
            className="cell-remark-modal__textarea"
            value={remarkEditor.value}
            readOnly={remarkEditor.readOnly}
            onChange={(e) => {
              const next = e.target.value;
              if (remarkEditor.maxLen != null && next.length > remarkEditor.maxLen) return;
              setRemarkEditor((prev) => ({ ...prev, value: next }));
            }}
            onKeyDown={(e) => {
              // Alt+S (Save whole form, shadowed here) and Alt+R (Save Remark)
              // both save the remark and close the modal — take priority over
              // the page's own Alt+S while this modal owns focus (see
              // shouldIgnoreKeyboardEvent's ".cell-remark-modal__textarea" check).
              const key = e.key.toLowerCase();
              if (e.altKey && !e.ctrlKey && !e.metaKey && (key === "s" || key === "r")) {
                e.preventDefault();
                if (!remarkEditor.readOnly) {
                  handleCellChange(remarkEditor.rowId, remarkEditor.colKey, remarkEditor.value);
                }
                setRemarkEditor(null);
              }
            }}
            placeholder="Type or paste a remark…"
            rows={5}
            maxLength={remarkEditor.maxLen ?? undefined}
            autoFocus
          />
          {!remarkEditor.readOnly && (
            <div className="cell-remark-modal__counter">
              {remarkEditor.maxLen != null
                ? `${remarkEditor.value.length}/${remarkEditor.maxLen}`
                : `${remarkEditor.value.length} characters`}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
});

export default TxnEntryGridForm;
