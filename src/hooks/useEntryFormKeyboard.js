import { useEffect, useCallback } from "react";
import { FORM_SHORTCUT_KEYS } from "../constants/formShortcuts";

/** Skip shortcuts while a SearchSelect dropdown or the grid's remark modal is open. */
export function shouldIgnoreKeyboardEvent(e) {
  return Boolean(
    e.target.closest(".search-select--open") ||
    e.target.closest(".search-select__dropdown") ||
    e.target.closest(".cell-remark-modal__textarea")
  );
}

/**
 * Entry-page keyboard shortcuts (Purchase Inquiry, Purchase Quotation, etc.)
 *
 * Alt+A  → Add / enter edit mode
 * Alt+S  → Save
 * Alt+N  → Cancel
 * Alt+P  → Save & Print
 * Alt+L  → Select item / supplier list (active tab)
 * Alt+C  → Toggle collapsible row details
 * F6     → Open Document Log modal (no Alt — plain function key)
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
  onSavePrint,
  onCancel,
  onSelectList,
  onToggleCollapsible,
  onDocuments,
  keys = FORM_SHORTCUT_KEYS,
} = {}) {
  useEffect(() => {
    if (!enabled || blocked) return undefined;

    const onKeyDown = (e) => {
      if (shouldIgnoreKeyboardEvent(e)) return;

      const key = e.key.toLowerCase();

      if (key === "escape") {
        if (isEditMode && onCancel) {
          e.preventDefault();
          onCancel();
        }
        return;
      }

      if (key === "f6") {
        if (onDocuments) {
          e.preventDefault();
          onDocuments();
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
        case keys.savePrint:
          if (isEditMode && !isSaving && onSavePrint) {
            e.preventDefault();
            onSavePrint();
          }
          break;
        case keys.selectList:
          if (isEditMode && onSelectList) {
            e.preventDefault();
            onSelectList();
          }
          break;
        case keys.toggleCollapsible:
          if (onToggleCollapsible) {
            e.preventDefault();
            onToggleCollapsible();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    enabled,
    blocked,
    isEditMode,
    isSaving,
    addDisabled,
    onAdd,
    onSave,
    onSavePrint,
    onCancel,
    onSelectList,
    onToggleCollapsible,
    onDocuments,
    keys.add,
    keys.save,
    keys.cancel,
    keys.savePrint,
    keys.selectList,
    keys.toggleCollapsible,
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
      const insertShortcut =
        (e.altKey && key === "i" && !e.ctrlKey && !e.metaKey) ||
        (key === "enter" && (e.ctrlKey || e.metaKey) && !e.altKey);

      if (insertShortcut && canInsert) {
        e.preventDefault();
        onInsert?.();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, showActions, onInsert, canInsert]);

  const handleInsertKeyDown = useCallback(
    (e) => {
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        focusGrid();
      }
    },
    [focusGrid]
  );

  const handleCancelKeyDown = useCallback(
    (e) => {
      if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        focusGrid();
      }
    },
    [focusGrid]
  );

  return {
    cancelBtnRef,
    insertBtnRef,
    handleInsertKeyDown,
    handleCancelKeyDown,
  };
}
