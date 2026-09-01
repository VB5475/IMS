// defaultSortConfig.js
// Per-module override table for EnterpriseDataGrid's default sort.
//
// Project-wide default (2026-08-27 /pm, user-confirmed "newest first
// everywhere"): every list page sorts by its own record id, descending —
// EnterpriseDataGrid.jsx's own `defaultSort` prop default already applies
// this to all ~45+ consumers with zero per-page wiring, so this table starts
// empty. Add an entry here (keyed by the module's route-name string, same
// convention as src/config/approvalStatusConfig.js and
// src/constants/printReportConfig.js) only for a module that genuinely needs
// a DIFFERENT default — e.g. a module without a real "newest first" meaning
// for idnumber, or one where a business rule calls for sorting by name/date
// instead. Consumed via useDefaultSort (src/hooks/useDefaultSort.js).
//
// entry shape: { key: <column key to sort by>, direction: "asc" | "desc" }
export const DEFAULT_SORT_CONFIG = {
  // (none yet — every module currently uses the built-in idnumber-desc default)
};

/** EnterpriseDataGrid's own built-in default — kept in sync with its DEFAULT_SORT constant. */
export const FALLBACK_DEFAULT_SORT = { key: "idnumber", direction: "desc" };

/** (moduleKey) => { key, direction } for passing straight into EnterpriseDataGrid's `defaultSort` prop. */
export function getDefaultSort(moduleKey) {
  return DEFAULT_SORT_CONFIG[moduleKey] ?? FALLBACK_DEFAULT_SORT;
}
