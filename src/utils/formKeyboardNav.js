/**
 * Excel-like keyboard navigation for filter / header form panels.
 *
 * Tab / Shift+Tab  → native browser order
 * Enter            → next field (Shift+Enter → previous field)
 */

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

function getVisibleFields(root) {
  return [...root.querySelectorAll(FORM_FOCUSABLE_SELECTOR)].filter(
    (el) => el.offsetParent !== null && el.tabIndex !== -1
  );
}

function resolveFieldElement(target) {
  if (!target) return null;
  if (target.matches?.(FORM_FOCUSABLE_SELECTOR)) return target;
  return target.closest?.(FORM_FOCUSABLE_SELECTOR) ?? null;
}

/**
 * Bind Enter / Shift+Enter field navigation on a form panel root.
 * Returns a cleanup function.
 */
export function bindFormKeyboardNav(root, { enabled = true } = {}) {
  if (!root || !enabled) return () => {};

  const onKeyDown = (e) => {
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
    fields[nextIndex].focus();
    if (
      fields[nextIndex] instanceof HTMLInputElement &&
      (fields[nextIndex].type === "text" || fields[nextIndex].type === "number")
    ) {
      fields[nextIndex].select();
    }
  };

  root.addEventListener("keydown", onKeyDown);
  return () => root.removeEventListener("keydown", onKeyDown);
}
