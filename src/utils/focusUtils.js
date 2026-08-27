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
  // Native focus() scroll-into-view is unreliable across browsers once a
  // grid has sticky/fixed-left columns (the sticky columns can make part of
  // the row register as "already visible" even when the actual target cell
  // is off-screen behind them) — confirmed live: Shift+Tab moved focus
  // correctly but the grid's horizontal scroll didn't follow it. Explicit
  // scrollIntoView with "nearest" fixes both Tab directions without
  // over-scrolling cells that are already fully in view.
  el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  selectInputText(el);
  return true;
}

/**
 * After an async cascade (e.g. Division -> a dependent dropdown's options)
 * resolves, move focus to that field once its options are in the DOM.
 * rootRef      — ref to the panel/form container; scopes the query.
 * fieldColName — filter column name; targets #efq-{fieldColName} .search-select__trigger.
 * suppressOpen — set when the caller already knows this field resolved to
 *   exactly one option (SearchSelect will otherwise pop its dropdown open on
 *   focus for the ~200ms before EnterpriseFilterPanel's own single-option
 *   auto-advance carries focus past it again — a flash that, mid-transition,
 *   reads as the form being stuck rather than settling correctly). Leave
 *   false/omitted for the normal case (2+ options): landing here with the
 *   dropdown open for the user to browse is the whole point.
 */
export function focusFieldAfterCascade(rootRef, fieldColName, suppressOpen = false) {
  requestAnimationFrame(() => {
    const el = rootRef?.current?.querySelector(`#efq-${fieldColName} .search-select__trigger`);
    if (el && suppressOpen) el.dataset.suppressAutoOpen = "1";
    el?.focus();
  });
}
