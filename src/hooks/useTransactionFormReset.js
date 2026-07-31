// useTransactionFormReset.js — Shared "reset to blank" / "discard changes" logic
// for transaction entry forms (Purchase/Assets/CWIP).
// ─────────────────────────────────────────────────────────────────────
// Extracted from the near-identical resetFormToInitialState/handleDiscardConfirm
// bodies previously copy-pasted into every *Form.jsx.
//
// Two behaviors, deliberately kept separate:
//  - resetFormToInitialState(): always wipes to new-record defaults, in place.
//    Used after a successful save (Add or Edit) where the product decision is
//    to let the user keep entering records without leaving the page.
//  - discardChanges(): what "Cancel" should do. On a new record this is the
//    same blank wipe. On an existing record (isEditRoute) it must NOT wipe the
//    save payload to blanks while the on-screen values still show the loaded
//    record — instead it re-fetches the record from the server, undoing any
//    unsaved edits.
import { useCallback } from "react";

export function useTransactionFormReset({
  storageKeys = [],
  buildDefaultHeaderValues,
  headerValuesRef,
  queuedRowsRef,
  gridColumnsLoadedRef,
  itemGridRef,
  editRecordLoadedRef,
  isEditRoute,
  loadEditRecord,
  exitEditMode,
  clearSaveError,
  setActiveTab,
  setIsGridLoading,
  setItemSelectionCount,
  setItemModalOpen,
  setItemModalItems,
  setItemModalColumns,
  setItemModalLoading,
  setItemModalError,
  setFilterResetKey,
  setLoadedFilterValues,
  setGridRows,
  extraClearFns = [],
  extraReset,
}) {
  const resetFormToInitialState = useCallback(() => {
    storageKeys.forEach((key) => localStorage.removeItem(key));
    extraClearFns.forEach((fn) => fn?.());

    headerValuesRef.current = buildDefaultHeaderValues();
    queuedRowsRef.current = [];
    gridColumnsLoadedRef.current = false;

    clearSaveError?.();
    setActiveTab("items");
    setIsGridLoading(false);
    setGridRows?.([]);
    setItemSelectionCount?.(0);
    setItemModalOpen?.(false);
    setItemModalItems?.([]);
    setItemModalColumns?.([]);
    setItemModalLoading?.(false);
    setItemModalError?.(null);
    setLoadedFilterValues?.(null);
    itemGridRef.current?.clearRows?.();
    setFilterResetKey((k) => k + 1);
    exitEditMode();

    extraReset?.();
  }, [
    storageKeys,
    buildDefaultHeaderValues,
    extraClearFns,
    headerValuesRef,
    queuedRowsRef,
    gridColumnsLoadedRef,
    itemGridRef,
    clearSaveError,
    setActiveTab,
    setIsGridLoading,
    setGridRows,
    setItemSelectionCount,
    setItemModalOpen,
    setItemModalItems,
    setItemModalColumns,
    setItemModalLoading,
    setItemModalError,
    setLoadedFilterValues,
    setFilterResetKey,
    exitEditMode,
    extraReset,
  ]);

  const discardChanges = useCallback(() => {
    if (isEditRoute && loadEditRecord) {
      exitEditMode();
      if (editRecordLoadedRef) editRecordLoadedRef.current = false;
      loadEditRecord();
      return;
    }
    resetFormToInitialState();
  }, [isEditRoute, loadEditRecord, exitEditMode, editRecordLoadedRef, resetFormToInitialState]);

  return { resetFormToInitialState, discardChanges };
}
