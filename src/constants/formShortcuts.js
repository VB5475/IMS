/** Shared keyboard shortcut keys for entry forms (Purchase Inquiry, Quotation, Order). */
export const FORM_SHORTCUT_KEYS = {
  add: "a",
  save: "s",
  cancel: "n",
  savePrint: "p",
  selectList: "l",
  toggleCollapsible: "c",
};

/** Human-readable titles for ActionBar buttons and tooltips. */
export const FORM_SHORTCUT_TITLES = {
  add: "Add (Alt+A)",
  save: "Save (Alt+S)",
  cancel: "Cancel (Alt+N)",
  savePrint: "Save & Print (Alt+P)",
  selectList: "Select from list (Alt+L)",
  toggleCollapsible: "Expand / collapse details (Alt+C)",
  close: "Close",
};

export function shortcutTitle(key, fallback) {
  return FORM_SHORTCUT_TITLES[key] ?? fallback;
}
