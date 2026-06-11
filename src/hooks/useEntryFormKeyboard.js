import { useEffect, useCallback } from 'react';

/** Skip shortcuts while a SearchSelect dropdown is open. */
export function shouldIgnoreKeyboardEvent(e) {
  return Boolean(
    e.target.closest('.search-select--open')
    || e.target.closest('.search-select__dropdown'),
  );
}

const DEFAULT_KEYS = {
  add: 'a',
  save: 's',
  cancel: 'n',
  close: 'c',
};

/**
 * Entry-page keyboard shortcuts (Purchase Inquiry, Purchase Quotation, etc.)
 *
 * Alt+A  → Add / enter edit mode
 * Alt+S  → Save
 * Alt+N  → Cancel
 * Alt+C  → Close
 * Esc    → Cancel (edit mode only)
 */
export function useEntryFormKeyboard({
  enabled = true,
  blocked = false,
  isEditMode = false,
  isSaving = false,
  addDisabled = false,
  onAdd,
  onSave,
  onCancel,
  onClose,
  keys = DEFAULT_KEYS,
} = {}) {
  useEffect(() => {
    if (!enabled || blocked) return undefined;

    const onKeyDown = (e) => {
      if (shouldIgnoreKeyboardEvent(e)) return;

      const key = e.key.toLowerCase();

      if (key === 'escape') {
        if (isEditMode && onCancel) {
          e.preventDefault();
          onCancel();
        }
        return;
      }

      if (!e.altKey || e.ctrlKey || e.metaKey) return;

      switch (key) {
        case keys.add:
          if (!isEditMode && !addDisabled && onAdd) {
            e.preventDefault();
            onAdd();
          }
          break;
        case keys.save:
          if (isEditMode && !isSaving && onSave) {
            e.preventDefault();
            onSave();
          }
          break;
        case keys.cancel:
          if (isEditMode && onCancel) {
            e.preventDefault();
            onCancel();
          }
          break;
        case keys.close:
          if (onClose) {
            e.preventDefault();
            onClose();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    enabled,
    blocked,
    isEditMode,
    isSaving,
    addDisabled,
    onAdd,
    onSave,
    onCancel,
    onClose,
    keys.add,
    keys.save,
    keys.cancel,
    keys.close,
  ]);
}

/**
 * Picker modal shortcuts (Select Items / Select Suppliers).
 *
 * Alt+I       → insert selected rows
 * Ctrl+Enter  → insert selected rows
 */
export function usePickerModalKeyboard({
  isOpen = false,
  showActions = false,
  onInsert,
  canInsert = false,
  gridRef,
  cancelBtnRef,
  insertBtnRef,
}) {
  const focusGrid = useCallback(() => {
    gridRef.current?.focusFirstInteractiveCell?.();
  }, [gridRef]);

  useEffect(() => {
    if (!isOpen || !showActions) return undefined;

    const onKeyDown = (e) => {
      if (shouldIgnoreKeyboardEvent(e)) return;

      const key = e.key.toLowerCase();
      const insertShortcut = (e.altKey && key === 'i' && !e.ctrlKey && !e.metaKey)
        || (key === 'enter' && (e.ctrlKey || e.metaKey) && !e.altKey);

      if (insertShortcut && canInsert) {
        e.preventDefault();
        onInsert?.();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, showActions, onInsert, canInsert]);

  const handleInsertKeyDown = useCallback((e) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      focusGrid();
    }
  }, [focusGrid]);

  const handleCancelKeyDown = useCallback((e) => {
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      focusGrid();
    }
  }, [focusGrid]);

  return {
    cancelBtnRef,
    insertBtnRef,
    handleInsertKeyDown,
    handleCancelKeyDown,
  };
}
