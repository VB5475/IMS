// OrderItemModal — Enterprise order item picker
// Modal + EntryGrid (readOnly) for Pr_TBD_FetchItemDetail rows.

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Modal from '../ui/Modal';
import EntryGrid from '../grid/EntryGrid';
import Loader from '../ui/Loader';
import { ShoppingCart, CheckCheck, Package, AlertCircle } from 'lucide-react';
import './OrderItemModal.css';

const ORDER_ITEM_COLUMNS = [
  { id: 'cb', name: '', key: 'cb', controlType: -1, width: 48, isFixed: true, isEditAllow: false },
  { id: 'itemCode', name: 'Item Code', key: 'itemCode', controlType: 0, width: 130, isFixed: true, isEditAllow: false },
  { id: 'ItemName', name: 'Item Name', key: 'ItemName', controlType: 0, width: 260, isFixed: false, isEditAllow: false },
  { id: 'HSN', name: 'HSN', key: 'HSN', controlType: 0, width: 100, isFixed: false, isEditAllow: false },
  { id: 'BaseUnit', name: 'Base Unit', key: 'BaseUnit', controlType: 0, width: 90, isFixed: false, isEditAllow: false },
  { id: 'TranUnit', name: 'Tran Unit', key: 'TranUnit', controlType: 0, width: 90, isFixed: false, isEditAllow: false },
  { id: 'UnitConv', name: 'Unit Conv', key: 'UnitConv', controlType: 0, width: 90, isFixed: false, isEditAllow: false },
  { id: 'TranQty', name: 'Tran Qty', key: 'TranQty', controlType: 0, width: 90, isFixed: false, isEditAllow: false },
];

export default function OrderItemModal({
  isOpen = false,
  onClose,
  items = [],
  isLoading = false,
  error = null,
  onInsert,
}) {
  const gridRef = useRef(null);
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    if (isOpen) setSelectedCount(0);
  }, [isOpen]);

  const gridConfig = useMemo(() => ({
    columns: ORDER_ITEM_COLUMNS,
    pagination: { pageSize: 50, pageSizeOptions: [25, 50, 100] },
  }), []);

  const handleInsert = useCallback(() => {
    if (!gridRef.current) return;
    const selectedRows = gridRef.current.getSelectedRows?.() ?? [];
    if (selectedRows.length > 0) {
      onInsert?.(selectedRows);
      onClose?.();
    }
  }, [onInsert, onClose]);

  const showGrid = !isLoading && !error && items.length > 0;

  const footer = showGrid ? (
    <div className="oim-footer">
      <div className="oim-footer__meta">
        {selectedCount > 0 ? (
          <>
            <span className="oim-footer__badge">{selectedCount}</span>
            <span>
              item{selectedCount !== 1 ? 's' : ''} selected for insert
            </span>
          </>
        ) : (
          <span className="oim-footer__hint">Select one or more rows to insert</span>
        )}
      </div>
      <div className="oim-footer__actions">
        <button type="button" className="oim-btn oim-btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="oim-btn oim-btn--primary"
          onClick={handleInsert}
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
      title="Order Items"
      subtitle="Select items to insert into the invoice"
      icon={<ShoppingCart size={16} strokeWidth={2} />}
      size="xl"
      variant="enterprise"
      footer={footer}
    >
      <div className="oim">
        {isLoading && (
          <div className="oim-state">
            <Loader text="Fetching items…" />
          </div>
        )}

        {!isLoading && error && (
          <div className="oim-error" role="alert">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="oim-empty">
            <Package size={32} strokeWidth={1.5} />
            <p>No items found for the selected division.</p>
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
                <span className="oim-toolbar__selected">
                  {selectedCount} selected
                </span>
              )}
            </div>
            <EntryGrid
              ref={gridRef}
              config={gridConfig}
              title=""
              readOnly
              initialRows={items}
              onSelectionChange={setSelectedCount}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
