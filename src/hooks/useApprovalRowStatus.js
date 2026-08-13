// useApprovalRowStatus.js
import { useCallback } from "react";
import { getApprovalRowState } from "../config/approvalStatusConfig";

/**
 * Returns a (row) => { statusKey, locked, selectable } resolver for moduleKey,
 * for passing straight into EnterpriseDataGrid's `getRowState` prop.
 * Rules live in src/config/approvalStatusConfig.js.
 */
export function useApprovalRowStatus(moduleKey) {
  return useCallback((row) => getApprovalRowState(moduleKey, row), [moduleKey]);
}
