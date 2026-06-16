// CollapsibleGrid.jsx
// Collapsible panel wrapping EntryGrid — full grid API with Horizon Enterprise
// child styling (enterprise.css tokens). Distinct from parent EntryGrid chrome.
//
// Variants:
//   panel  — standalone section with title / subtitle toggle (default)
//   inline — embedded under a parent EntryGrid row (accent stripe + compact grid)

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import EntryGrid from "./EntryGrid";
import "./CollapsibleGrid.css";

const DEFAULT_PAGINATION = { pageSize: 50, pageSizeOptions: [10, 25, 50, 100] };
const INLINE_PAGINATION = { pageSize: 100, pageSizeOptions: [25, 50, 100] };

/** Accept legacy { key, label, width } or full EntryGrid column defs. */
function normalizeColumns(columns = []) {
  return columns.map((col, index) => {
    if (col.key && (col.name || col.controlType != null)) {
      return {
        isEditAllow: false,
        isFixed: false,
        controlType: 0,
        ...col,
        id: col.id ?? col.key,
        name: col.name ?? col.label ?? col.key,
      };
    }
    return {
      id: col.key ?? col.id ?? `col_${index}`,
      key: col.key ?? col.id ?? `col_${index}`,
      name: col.label ?? col.name ?? col.key ?? `Col ${index + 1}`,
      width: col.width ?? 120,
      controlType: col.controlType ?? 0,
      isEditAllow: col.isEditAllow ?? false,
      isFixed: col.isFixed ?? false,
    };
  });
}

const CollapsibleGrid = forwardRef(function CollapsibleGrid(
  {
    // Panel chrome
    title = "Details",
    subtitle = "",
    recordLabel = "record",
    variant = "panel", // "panel" | "inline"
    defaultExpanded = false,
    expanded: expandedProp,
    onExpandedChange,

    // Data — legacy flat props or full EntryGrid config
    columns = [],
    rows = [],
    config = null,

    // EntryGrid passthrough (all standard props supported)
    readOnly = true,
    hideBottomPanel = true,
    hidePagination = null,
    emptyMessage = null,
    pagination,
    onSave,
    onCellEvent,
    eventColumns,
    onSelectionChange,
    onRowsChange,
    initialRows,
    existingRecordEdit = false,
    enableKeyboardNav = false,
    enableCollapsible = false,
    childRowsMap = null,
    childColumns = [],
    ...entryGridRest
  },
  ref
) {
  const isInline = variant === "inline";
  const gridRef = useRef(null);
  const scrollHostRef = useRef(null);
  const wrapRef = useRef(null);

  const [expandedInternal, setExpandedInternal] = useState(isInline ? true : defaultExpanded);
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const expanded = expandedProp ?? expandedInternal;

  const setExpanded = useCallback(
    (next) => {
      const value = typeof next === "function" ? next(expanded) : next;
      if (expandedProp === undefined) setExpandedInternal(value);
      onExpandedChange?.(value);
    },
    [expanded, expandedProp, onExpandedChange]
  );

  const gridColumns = useMemo(() => {
    const raw = config?.columns ?? columns;
    return normalizeColumns(raw);
  }, [config, columns]);

  const gridConfig = useMemo(
    () => ({
      columns: gridColumns,
      pagination: pagination ?? config?.pagination ?? (isInline ? INLINE_PAGINATION : DEFAULT_PAGINATION),
    }),
    [gridColumns, pagination, config, isInline]
  );

  const resolvedHidePagination = hidePagination ?? isInline;
  const resolvedEmptyMessage =
    emptyMessage ?? (isInline ? "No child records." : "No data available.");

  // Sync rows into EntryGrid when the rows prop changes.
  useEffect(() => {
    if (!gridRef.current?.loadRows) return;
    if (rows?.length) {
      gridRef.current.loadRows(rows);
    } else {
      gridRef.current.clearRows?.();
    }
  }, [rows]);

  // Forward all EntryGrid imperative methods to parent refs.
  useImperativeHandle(ref, () => ({
    addRow: (...args) => gridRef.current?.addRow?.(...args),
    getRows: () => gridRef.current?.getRows?.() ?? [],
    getSelectedRows: () => gridRef.current?.getSelectedRows?.() ?? [],
    updateRow: (...args) => gridRef.current?.updateRow?.(...args),
    removeRows: (...args) => gridRef.current?.removeRows?.(...args),
    clearRows: () => gridRef.current?.clearRows?.(),
    loadRows: (...args) => gridRef.current?.loadRows?.(...args),
    focusFirstInteractiveCell: () => gridRef.current?.focusFirstInteractiveCell?.(),
    expand: () => setExpanded(true),
    collapse: () => setExpanded(false),
    toggle: () => setExpanded((e) => !e),
    isExpanded: () => expanded,
  }));

  // Inline mode: pin width to parent grid viewport and isolate horizontal scroll.
  useEffect(() => {
    if (!isInline) return;
    const wrapEl = wrapRef.current;
    const scrollEl = scrollHostRef.current;
    if (!wrapEl || !scrollEl) return;

    const tableWrapper = wrapEl.closest(".table-wrapper");
    if (!tableWrapper) return;

    const syncViewport = () => {
      requestAnimationFrame(() => {
        const viewportW = tableWrapper.clientWidth;
        if (!viewportW) return;
        wrapEl.style.setProperty("--cg-viewport-width", `${viewportW}px`);
      });
    };

    syncViewport();
    const ro = new ResizeObserver(syncViewport);
    ro.observe(tableWrapper);
    window.addEventListener("resize", syncViewport);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncViewport);
    };
  }, [isInline, expanded, rows?.length]);

  const handleScroll = useCallback((e) => {
    const el = e.target;
    setScrollState({
      left: el.scrollLeft > 5,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 5,
    });
  }, []);

  const handleWheel = useCallback((e) => {
    const el = scrollHostRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;

    const { deltaX, deltaY, shiftKey } = e;
    const horizontalDelta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : shiftKey ? deltaY : 0;
    if (!horizontalDelta) return;

    const atLeft = el.scrollLeft <= 0;
    const atRight = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;

    if ((horizontalDelta < 0 && !atLeft) || (horizontalDelta > 0 && !atRight)) {
      el.scrollLeft += horizontalDelta;
      e.preventDefault();
      e.stopPropagation();
    } else if ((horizontalDelta < 0 && atLeft) || (horizontalDelta > 0 && atRight)) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  const rowCount = rows?.length ?? 0;
  const showBody = isInline || expanded;

  const gridNode = (
    <div
      className={`cg-scroll-host${scrollState.left ? " scrolled-left" : ""}${scrollState.right ? " scrolled-right" : ""}`}
      ref={scrollHostRef}
      onScroll={handleScroll}
      onWheel={handleWheel}
    >
      <EntryGrid
        ref={gridRef}
        config={gridConfig}
        title=""
        readOnly={readOnly}
        hideBottomPanel={hideBottomPanel}
        hidePagination={resolvedHidePagination}
        emptyMessage={resolvedEmptyMessage}
        initialRows={initialRows}
        onSave={onSave}
        onCellEvent={onCellEvent}
        eventColumns={eventColumns}
        onSelectionChange={onSelectionChange}
        onRowsChange={onRowsChange}
        enableCollapsible={enableCollapsible}
        childRowsMap={childRowsMap}
        childColumns={childColumns}
        existingRecordEdit={existingRecordEdit}
        enableKeyboardNav={enableKeyboardNav}
        containerClassName="cg-entry-grid"
        embedded={isInline}
        {...entryGridRest}
      />
    </div>
  );

  if (isInline) {
    return (
      <div className="cg-panel cg-panel--inline" ref={wrapRef}>
        <div className="cg-inline-marker" aria-hidden="true" />
        <div className="cg-inline-content">
          <div className="cg-inline-meta">
            <span className="cg-inline-badge">
              {rowCount} {recordLabel}
              {rowCount !== 1 ? "s" : ""}
            </span>
          </div>
          {showBody && gridNode}
        </div>
      </div>
    );
  }

  return (
    <div className="cg-panel cg-panel--standalone">
      <button
        type="button"
        className="cg-header"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="cg-header__chevron">
          {expanded ? (
            <ChevronDown size={13} strokeWidth={2.5} />
          ) : (
            <ChevronRight size={13} strokeWidth={2.5} />
          )}
        </span>
        <span className="cg-header__title">{title}</span>
        {subtitle && <span className="cg-header__sub">{subtitle}</span>}
        <span className="cg-header__badge">{rowCount}</span>
      </button>

      {showBody && <div className="cg-body">{gridNode}</div>}
    </div>
  );
});

export default CollapsibleGrid;
