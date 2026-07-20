// TermsPickerModal — Terms & Conditions picker for Purchase Inquiry (Tab-3).
// Same pattern as OrderItemModal: columns come from GetDetailColData for the
// picker RB (rb_purinqtncselonly), rows from its row-fetch SP — both fetched
// dynamically by the parent form, not hardcoded here.

import React, { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from "react";
import Modal from "../ui/Modal";
const EntryGrid = lazy(() => import("../grid/EntryGrid"));
import Loader from "../ui/Loader";
import { usePickerModalKeyboard } from "../../hooks/useEntryFormKeyboard";
import { normalizePickerGridColumns } from "../../utils/dateFormat";
import { FileText, CheckCheck, ClipboardList, AlertCircle } from "lucide-react";
import "../txn/OrderItemModal.css";

function lowercaseRowKeys(row) {
  const out = {};
  Object.entries(row).forEach(([k, v]) => { out[k.toLowerCase()] = v; });
  return out;
}

export default function TermsPickerModal({
  isOpen = false,
  onClose,
  items = [],
  columns = [],
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

  const handleInsert = useCallback(() => {
    if (!gridRef.current) return;
    const selectedRows = gridRef.current.getSelectedRows?.() ?? [];
    if (selectedRows.length > 0) {
      onInsert?.(selectedRows);
      onClose?.();
    }
  }, [onInsert, onClose]);

  const gridConfig = useMemo(
    () => ({
      columns: normalizePickerGridColumns(columns),
      pagination: { pageSize: 50, pageSizeOptions: [25, 50, 100] },
    }),
    [columns]
  );

  const normalizedItems = useMemo(() => items.map(lowercaseRowKeys), [items]);

  const hasColumns = columns.length > 0;
  const showGrid = !isLoading && !error && hasColumns;

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
            <span>term{selectedCount !== 1 ? "s" : ""} selected for insert</span>
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
              ? `Insert ${selectedCount} term(s) (Alt+I)`
              : "Select at least one term"
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
      title="Select Terms & Conditions"
      subtitle="Choose terms & conditions for this purchase inquiry"
      icon={<FileText size={16} strokeWidth={2} />}
      size="xl"
      variant="enterprise"
      footer={footer}
    >
      <div className="oim">
        {isLoading && (
          <div className="oim-state">
            <Loader text="Loading terms & conditions…" />
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
            <ClipboardList size={32} strokeWidth={1.5} />
            <p>No terms & conditions found for the selected division.</p>
          </div>
        )}

        {showGrid && (
          <div className="oim-grid-wrap">
            <div className="oim-toolbar">
              <div className="oim-toolbar__left">
                <span className="oim-toolbar__label">Available Terms & Conditions</span>
                <span className="oim-toolbar__count">
                  {items.length} record{items.length !== 1 ? "s" : ""}
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
                initialRows={normalizedItems}
                hideBottomPanel
                emptyMessage="No terms & conditions found for the selected criteria."
                onSelectionChange={setSelectedCount}
              />
            </Suspense>
          </div>
        )}
      </div>
    </Modal>
  );
}
