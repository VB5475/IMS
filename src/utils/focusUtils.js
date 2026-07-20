// focusUtils.js — shared focus/select helpers.
// Keeps keyboard nav (Tab/Enter/Arrow/F2), mouse-click focus, and async
// cascade-focus all landing on a field the same way: whole value selected,
// ready to overwrite (Excel-style).

/** Selects the full value of a text/number input — no-op for other element types. */
export function selectInputText(el) {
  if (el instanceof HTMLInputElement && (el.type === "text" || el.type === "number")) {
    el.select();
  }
}

/** Focuses el, then selects its text if it's a text/number input. Returns true if focused. */
export function focusAndSelect(el) {
  if (!el) return false;
  el.focus();
  selectInputText(el);
  return true;
}

/**
 * After an async cascade (e.g. Division -> a dependent dropdown's options)
 * resolves, move focus to that field once its options are in the DOM.
 * rootRef      — ref to the panel/form container; scopes the query.
 * fieldColName — filter column name; targets #efq-{fieldColName} .search-select__trigger.
 */
export function focusFieldAfterCascade(rootRef, fieldColName) {
  requestAnimationFrame(() => {
    rootRef?.current
      ?.querySelector(`#efq-${fieldColName} .search-select__trigger`)
      ?.focus();
  });
}
