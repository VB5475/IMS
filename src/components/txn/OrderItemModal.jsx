// OrderItemModal — Item picker for Purchase Inquiry.
// Displays an EntryGrid in read-only mode populated with API-fetched columns
// (from GetDetailColData) and rows (from SP_ITEM_PICKER).
// The user selects rows and clicks "Insert" to add them to the main item grid.

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import EntryGrid from '../grid/EntryGrid';
import Loader from '../ui/Loader';
import { ShoppingCart, CheckCheck, Package, AlertCircle } from 'lucide-react';
import './OrderItemModal.css';

export default function OrderItemModal({
  isOpen    = false,
  onClose,
  items     = [],       // row data from SP_ITEM_PICKER
  columns   = [],       // EntryGrid column definitions from GetDetailColData
  isLoading = false,
  error     = null,
  onInsert,
}) {
  const gridRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const insertBtnRef = useRef(null);
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    if (isOpen) setSelectedCount(0);
  }, [isOpen]);

  const handleInsert = useCallback(() => {
    if (!gridRef.current) return;
    const selectedRows = gridRef.current.getSelectedRows?.() ?? [];
    if (selectedRows.length > 0) {
      onInsert?.(selectedRows);
      onClose?.();
    }
  }, [onInsert, onClose]);

  const gridConfig = useMemo(() => ({
    columns,
    pagination: { pageSize: 50, pageSizeOptions: [25, 50, 100] },
  }), [columns]);

  const hasColumns = columns.length > 0;
  const showGrid   = !isLoading && !error && hasColumns;

  // Focus first grid row when data is ready — keyboard flow starts in the grid.
  useEffect(() => {
    if (!isOpen || !showGrid) return undefined;
    const timer = window.setTimeout(() => {
      if (!gridRef.current?.focusFirstInteractiveCell?.()) {
        cancelBtnRef.current?.focus();
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [isOpen, showGrid, items.length]);

  const handleInsertKeyDown = useCallback((e) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      gridRef.current?.focusFirstInteractiveCell?.();
    }
  }, []);

  const handleCancelKeyDown = useCallback((e) => {
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      gridRef.current?.focusFirstInteractiveCell?.();
    }
  }, []);

  const footer = showGrid ? (
    <div className="oim-footer">
      <div className="oim-footer__meta">
        {selectedCount > 0 ? (
          <>
            <span className="oim-footer__badge">{selectedCount}</span>
            <span>item{selectedCount !== 1 ? 's' : ''} selected for insert</span>
          </>
        ) : (
          <span className="oim-footer__hint">Select one or more rows to insert</span>
        )}
      </div>
      <div className="oim-footer__actions">
        <button
          ref={cancelBtnRef}
          type="button"
          className="oim-btn oim-btn--ghost"
          onClick={onClose}
          onKeyDown={handleCancelKeyDown}
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
          title={selectedCount > 0 ? `Insert ${selectedCount} row(s)` : 'Select at least one item'}
        >
          <CheckCheck size={14} strokeWidth={2.5} />
          Insert{selectedCount > 0 ? ` (${selectedCount})` : ''}
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
        {isLoading && (
          <div className="oim-state">
            <Loader text="Loading items…" />
          </div>
        )}

        {!isLoading && error && (
          <div className="oim-error" role="alert">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{error}</span>
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
                  {items.length} record{items.length !== 1 ? 's' : ''}
                </span>
              </div>
              {selectedCount > 0 && (
                <span className="oim-toolbar__selected">{selectedCount} selected</span>
              )}
            </div>

            <EntryGrid
              key={String(isOpen)}
              ref={gridRef}
              config={gridConfig}
              title=""
              readOnly
              initialRows={items}
              hideBottomPanel
              emptyMessage="No items found for the selected criteria."
              onSelectionChange={setSelectedCount}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
