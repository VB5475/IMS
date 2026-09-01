// useDefaultSort.js
import { useMemo } from "react";
import { getDefaultSort } from "../config/defaultSortConfig";

/**
 * Returns { key, direction } for passing straight into EnterpriseDataGrid's
 * `defaultSort` prop, per src/config/defaultSortConfig.js. Optional — the
 * grid already applies the same project-wide "newest first" default on its
 * own; only reach for this when a module's list page needs a DIFFERENT
 * default and has an override entry in that config.
 */
export function useDefaultSort(moduleKey) {
  return useMemo(() => getDefaultSort(moduleKey), [moduleKey]);
}
