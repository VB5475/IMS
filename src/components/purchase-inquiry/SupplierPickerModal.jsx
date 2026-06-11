// SupplierPickerModal — supplier picker for Purchase Inquiry (IMS_LIVE API)
// Modal + EntryGrid (readOnly) for Fn_tbl_FetchCustomerSupplierTranWs4Web rows.

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Modal from '../ui/Modal';
import EntryGrid from '../grid/EntryGrid';
import Loader from '../ui/Loader';
import { usePickerModalKeyboard } from '../../hooks/useEntryFormKeyboard';
import { Truck, CheckCheck, Users, AlertCircle } from 'lucide-react';
import '../txn/OrderItemModal.css';

const SUPPLIER_COLUMNS = [
  { id: 'cb', name: '', key: 'cb', controlType: -1, width: 48, isFixed: true, isEditAllow: false },
  { id: 'SupplierCode', name: 'Supplier Code', key: 'SupplierCode', controlType: 0, width: 120, isFixed: true, isEditAllow: false },
  { id: 'SupplierName', name: 'Supplier Name', key: 'SupplierName', controlType: 0, width: 200, isFixed: false, isEditAllow: false },
  { id: 'GstRegNo', name: 'GST Reg No.', key: 'GstRegNo', controlType: 0, width: 140, isFixed: false, isEditAllow: false },
  { id: 'SuppAddress', name: 'Address', key: 'SuppAddress', controlType: 0, width: 220, isFixed: false, isEditAllow: false },
  { id: 'City', name: 'City', key: 'City', controlType: 0, width: 120, isFixed: false, isEditAllow: false },
  { id: 'ContactNo', name: 'Contact No.', key: 'ContactNo', controlType: 0, width: 110, isFixed: false, isEditAllow: false },
];

export default function SupplierPickerModal({
  isOpen = false,
  onClose,
  items = [],
  isLoading = false,
  error = null,
  onInsert,
}) {
  const gridRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const insertBtnRef = useRef(null);
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    if (isOpen) setSelectedCount(0);
  }, [isOpen]);

  const gridConfig = useMemo(() => ({
    columns: SUPPLIER_COLUMNS,
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

  const {
    handleInsertKeyDown,
    handleCancelKeyDown,
  } = usePickerModalKeyboard({
    isOpen,
    showActions: showGrid,
    onClose,
    onInsert: handleInsert,
    canInsert: selectedCount > 0,
    gridRef,
    cancelBtnRef,
    insertBtnRef,
  });

  useEffect(() => {
    if (!isOpen || !showGrid) return undefined;
    const timer = window.setTimeout(() => {
      if (!gridRef.current?.focusFirstInteractiveCell?.()) {
        cancelBtnRef.current?.focus();
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [isOpen, showGrid, items.length]);

  const footer = showGrid ? (
    <div className="oim-footer">
      <div className="oim-footer__meta">
        {selectedCount > 0 ? (
          <>
            <span className="oim-footer__badge">{selectedCount}</span>
            <span>
              supplier{selectedCount !== 1 ? 's' : ''} selected for insert
            </span>
          </>
        ) : (
          <span className="oim-footer__hint">Select rows (↑ to header checkbox) · Insert Alt+I</span>
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
          title={selectedCount > 0 ? `Insert ${selectedCount} supplier(s) (Alt+I)` : 'Select at least one supplier'}
          accessKey="i"
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
      title="Select Suppliers"
      subtitle="Choose suppliers for this purchase inquiry"
      icon={<Truck size={16} strokeWidth={2} />}
      size="xl"
      variant="enterprise"
      footer={footer}
    >
      <div className="oim">
        {isLoading && (
          <div className="oim-state">
            <Loader text="Fetching suppliers…" />
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
            <Users size={32} strokeWidth={1.5} />
            <p>No suppliers found for the selected division.</p>
          </div>
        )}

        {showGrid && (
          <div className="oim-grid-wrap">
            <div className="oim-toolbar">
              <div className="oim-toolbar__left">
                <span className="oim-toolbar__label">Available Suppliers</span>
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
