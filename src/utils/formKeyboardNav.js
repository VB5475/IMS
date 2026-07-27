/**
 * Excel-like keyboard navigation for filter / header form panels.
 *
 * Tab / Shift+Tab  → native browser order
 * Enter            → next field (Shift+Enter → previous field)
 *
 * Native <input type="date">: Tab normally walks year → month → day.
 * handleDateInputTabKey / bindFormKeyboardNav force Tab to the next control instead.
 */

import { focusAndSelect } from "./focusUtils";

export const FORM_FOCUSABLE_SELECTOR = [
  'input:not([disabled]):not([readonly]):not([type="hidden"])',
  "textarea:not([disabled]):not([readonly])",
  "select:not([disabled])",
  ".search-select__trigger:not([disabled])",
  "button.efq-btn-run:not([disabled])",
].join(", ");

function isDropdownOpen(target) {
  return Boolean(
    target?.closest?.(".search-select--open") || target?.closest?.(".search-select__dropdown")
  );
}

function isNativeDateInput(el) {
  return el instanceof HTMLInputElement && el.type === "date";
}

function getVisibleFields(root) {
  if (!root?.querySelectorAll) return [];
  return [...root.querySelectorAll(FORM_FOCUSABLE_SELECTOR)].filter(
    (el) => el.offsetParent !== null && el.tabIndex !== -1
  );
}

function resolveFieldElement(target) {
  if (!target) return null;
  if (target.matches?.(FORM_FOCUSABLE_SELECTOR)) return target;
  return target.closest?.(FORM_FOCUSABLE_SELECTOR) ?? null;
}

function resolveNavRoot(fromEl, root = null) {
  if (root) return root;
  return (
    fromEl.closest?.("[data-form-keyboard-nav]") ||
    fromEl.closest?.(".efq") ||
    fromEl.closest?.("form") ||
    fromEl.closest?.(".master-form") ||
    fromEl.closest?.(".workspace-page") ||
    document.body
  );
}

/**
 * Move focus to the adjacent form field. Used so Tab on <input type="date">
 * leaves the control instead of cycling year / month / day segments.
 * @returns {boolean} true when focus was moved (caller should preventDefault)
 */
export function focusAdjacentFormField(fromEl, { shiftKey = false, root = null } = {}) {
  if (!fromEl) return false;

  let scope = resolveNavRoot(fromEl, root);
  let fields = getVisibleFields(scope);
  const current = resolveFieldElement(fromEl);
  if (!current) return false;

  // If the local scope only has this control, walk the whole page.
  if (fields.length <= 1 || fields.indexOf(current) === -1) {
    scope = document.body;
    fields = getVisibleFields(scope);
  }

  const index = fields.indexOf(current);
  if (index === -1) return false;

  const nextIndex = shiftKey ? index - 1 : index + 1;
  // At the edge of the panel: do not steal Tab — last-field hooks / browser handle exit.
  if (nextIndex < 0 || nextIndex >= fields.length) return false;

  const next = fields[nextIndex];
  next.focus();
  if (
    next instanceof HTMLInputElement &&
    (next.type === "text" || next.type === "number")
  ) {
    next.select();
  }
  return true;
}

/**
 * Tab / Shift+Tab on a native date input → next / previous control (not segments).
 * @returns {boolean} true when handled
 */
export function handleDateInputTabKey(e, root = null) {
  if (e.key !== "Tab") return false;
  if (e.defaultPrevented) return false;
  if (!isNativeDateInput(e.target)) return false;
  if (focusAdjacentFormField(e.target, { shiftKey: e.shiftKey, root })) {
    e.preventDefault();
    return true;
  }
  return false;
}

/**
 * Bind Enter / Shift+Enter field navigation on a form panel root.
 * Also forces Tab on date inputs to leave the field (skip y/m/d segments).
 * Returns a cleanup function.
 */
export function bindFormKeyboardNav(root, { enabled = true } = {}) {
  if (!root || !enabled) return () => { };

  const onKeyDown = (e) => {
    if (e.key === "Tab" && isNativeDateInput(e.target)) {
      if (!e.defaultPrevented) handleDateInputTabKey(e, root);
      return;
    }

    // Ctrl+Z/Cmd+Z (undo) is not reversible for most header fields — remarks/
    // notes fields (rendered as <textarea>) are the sole exception.
    if (
      (e.ctrlKey || e.metaKey) &&
      !e.shiftKey &&
      e.key.toLowerCase() === "z" &&
      !(e.target instanceof HTMLTextAreaElement)
    ) {
      e.preventDefault();
      return;
    }

    if (e.key !== "Enter" || e.altKey || e.ctrlKey || e.metaKey) return;
    if (isDropdownOpen(e.target)) return;
    if (e.target instanceof HTMLTextAreaElement && !e.shiftKey) return;

    const fields = getVisibleFields(root);
    const current = resolveFieldElement(e.target);
    if (!current) return;

    const index = fields.indexOf(current);
    if (index === -1) return;

    const nextIndex = e.shiftKey ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= fields.length) return;

    e.preventDefault();
    focusAndSelect(fields[nextIndex]);
  };

  root.addEventListener("keydown", onKeyDown);
  return () => root.removeEventListener("keydown", onKeyDown);
}
