// OrderItemModal — Item picker for Purchase Inquiry.
// Displays an EntryGrid in read-only mode populated with API-fetched columns
// (from GetDetailColData) and rows (from SP_ITEM_PICKER).
// The user selects rows and clicks "Insert" to add them to the main item grid.

import React, { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from "react";
import Modal from "../ui/Modal";
const EntryGrid = lazy(() => import("../grid/EntryGrid"));
import Loader from "../ui/Loader";
import AlertPanel from "../ui/AlertPanel";
import { usePickerModalKeyboard } from "../../hooks/useEntryFormKeyboard";
import { normalizePickerGridColumns } from "../../utils/dateFormat";
import { ShoppingCart, CheckCheck, Package } from "lucide-react";
import "./OrderItemModal.css";

// SP_ITEM_PICKER row field-name casing isn't guaranteed to match the lowercase
// `colname` keys EntryGrid columns use (from GetDetailColData) — normalize so
// every column resolves regardless of how the picker proc cased its output.
function lowercaseRowKeys(row) {
  const out = {};
  Object.entries(row).forEach(([k, v]) => { out[k.toLowerCase()] = v; });
  return out;
}

export default function OrderItemModal({
  isOpen = false,
  onClose,
  items = [], // row data from SP_ITEM_PICKER
  columns = [], // EntryGrid column definitions from GetDetailColData
  isLoading = false,
  error = null,
  onInsert,
  // Optional pre-grid filter UI (e.g. Purchase Indent's Main/Sub Main Group
  // dropdowns) — when provided, rendered above the grid. Every other caller
  // omits this and gets the original always-fetch-on-open behavior unchanged.
  filterBar = null,
  // True until the caller has run its own "Filter" action at least once —
  // suppresses the normal "no items found" empty state (which would be a
  // false "nothing matches" claim before the user has actually searched)
  // in favor of a neutral prompt to use the filters above.
  awaitingFilter = false,
  // (row) => boolean — passed straight through to EntryGrid. Used by e.g.
  // Purchase Voucher's GRN-Base picker to grey out + block re-selecting a
  // GRN detail line that's already been inserted into the PV's item grid.
  isRowDisabled = null,
}) {
  const gridRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const insertBtnRef = useRef(null);
  const [selectedCount, setSelectedCount] = useState(0);
  // Same dismissible-banner pattern the Save button's validation already
  // uses (AlertPanel) instead of this modal's own bespoke single-string
  // strip. Dismiss state is local/self-contained here (not lifted to the
  // ~24 parent forms that pass `error` in) — it resets whenever a NEW error
  // arrives or the modal reopens, so a stale dismiss can't hide a fresh one.
  const [errorDismissed, setErrorDismissed] = useState(false);

  useEffect(() => {
    if (isOpen) setSelectedCount(0);
  }, [isOpen]);

  useEffect(() => {
    setErrorDismissed(false);
  }, [isOpen, error]);

  const normalizedItems = useMemo(() => items.map(lowercaseRowKeys), [items]);

  const handleInsert = useCallback(() => {
    if (!gridRef.current) return;
    const selectedRows = gridRef.current.getSelectedRows?.() ?? [];
    if (selectedRows.length === 0) return;
    onInsert?.(selectedRows);
    onClose?.();
  }, [onInsert, onClose]);

  const gridConfig = useMemo(
    () => ({
      columns: normalizePickerGridColumns(columns),
      pagination: { pageSize: 50, pageSizeOptions: [25, 50, 100] },
    }),
    [columns]
  );

  const hasColumns = columns.length > 0;
  const hasItems = normalizedItems.length > 0;
  const showAwaitingFilterPrompt = !isLoading && !error && hasColumns && awaitingFilter && !hasItems;
  const showGrid = !isLoading && !error && hasColumns && !showAwaitingFilterPrompt;

  const { handleInsertKeyDown, handleCancelKeyDown } = usePickerModalKeyboard({
    isOpen,
    showActions: showGrid,
    onClose,
    onInsert: handleInsert,
    canInsert: selectedCount > 0,
    gridRef,
    cancelBtnRef,
    insertBtnRef,
  });

  // Focus first grid row when data is ready — keyboard flow starts in the grid.
  useEffect(() => {
    if (!isOpen || !showGrid) return undefined;
    const timer = window.setTimeout(() => {
      if (!gridRef.current?.focusFirstInteractiveCell?.()) {
        cancelBtnRef.current?.focus();
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [isOpen, showGrid, normalizedItems.length]);

  const footer = showGrid ? (
    <div className="oim-footer">
      <div className="oim-footer__meta">
        {selectedCount > 0 ? (
          <>
            <span className="oim-footer__badge">{selectedCount}</span>
            <span>item{selectedCount !== 1 ? "s" : ""} selected for insert</span>
          </>
        ) : (
          <span className="oim-footer__hint">
            Select rows (↑ to header checkbox) · Insert Alt+I
          </span>
        )}
      </div>
      <div className="oim-footer__actions">
        <button
          ref={cancelBtnRef}
          type="button"
          className="oim-btn oim-btn--ghost"
          onClick={onClose}
          onKeyDown={handleCancelKeyDown}
          title="Cancel (Esc)"
        >
          Cancel
        </button>
        <button
          ref={insertBtnRef}
          type="button"
          className="oim-btn oim-btn--primary"
          onClick={handleInsert}
          onKeyDown={handleInsertKeyDown}
          disabled={selectedCount === 0}
          title={
            selectedCount > 0
              ? `Insert ${selectedCount} row(s) (Alt+I)`
              : "Select at least one item"
          }
          accessKey="i"
        >
          <CheckCheck size={14} strokeWidth={2.5} />
          Insert{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Items"
      subtitle="Choose items to add to the inquiry"
      icon={<ShoppingCart size={16} strokeWidth={2} />}
      size="xl"
      variant="enterprise"
      footer={footer}
    >
      <div className="oim">
        {filterBar}

        {isLoading && (
          <div className="oim-state">
            <Loader text="Loading items…" />
          </div>
        )}

        {!isLoading && error && !errorDismissed && (
          <AlertPanel errors={[error]} onDismiss={() => setErrorDismissed(true)} />
        )}

        {showAwaitingFilterPrompt && (
          <div className="oim-empty">
            <Package size={32} strokeWidth={1.5} />
            <p>Pick a filter above, then click Filter to load items.</p>
          </div>
        )}

        {!isLoading && !error && !hasColumns && (
          <div className="oim-empty">
            <Package size={32} strokeWidth={1.5} />
            <p>No items found for the selected filter values.</p>
          </div>
        )}

        {showGrid && (
          <div className="oim-grid-wrap">
            <div className="oim-toolbar">
              <div className="oim-toolbar__left">
                <span className="oim-toolbar__label">Available Items</span>
                <span className="oim-toolbar__count">
                  {normalizedItems.length} record{normalizedItems.length !== 1 ? "s" : ""}
                </span>
              </div>
              {selectedCount > 0 && (
                <span className="oim-toolbar__selected">{selectedCount} selected</span>
              )}
            </div>

            <Suspense
              fallback={
                <div className="oim-state">
                  <Loader text="Loading grid…" />
                </div>
              }
            >
              <EntryGrid
                key={String(isOpen)}
                ref={gridRef}
                config={gridConfig}
                title=""
                readOnly
                disableSelection={false}
                initialRows={normalizedItems}
                hideBottomPanel
                emptyMessage="No items found for the selected criteria."
                onSelectionChange={setSelectedCount}
                isRowDisabled={isRowDisabled}
                disabledRowTitle="Already added to this voucher — cannot be selected again."
              />
            </Suspense>
          </div>
        )}
      </div>
    </Modal>
  );
}
