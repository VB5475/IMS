// approvalStatusConfig.js
// Per-module approval-status row rules for list-page grids (EnterpriseDataGrid).
//
// To enable approval-status row coloring/locking for a module's list page,
// add an entry here keyed by that module's registry key — no grid or hook
// changes needed. Consumed via useApprovalRowStatus (src/hooks/useApprovalRowStatus.js).
//
// Any statusId not listed in `rules`, or a row where `field` is missing/undefined,
// is a no-op: the row renders exactly as it does today (no color, not locked).
//
// rule shape:
//   statusKey   — drives the CSS class `ng-row--status-<statusKey>` (EnterpriseDataGrid.css)
//   locked      — true disables that row's Edit/Delete actions
//   selectable  — reserved for future bulk-select wiring; not yet consumed anywhere
import { resolveRowFieldValue } from "../utils/gridUtils";

export const APPROVAL_STATUS_CONFIG = {
  "purchase-order": {
    field: "appstatusid",
    rules: {
      1: { statusKey: "approved", locked: true, selectable: true },
      100: { statusKey: "inApproval", locked: true, selectable: true },
    },
  },
  "purchase-indent": {
    field: "appstatusid",
    rules: {
      1: { statusKey: "approved", locked: true, selectable: true },
      100: { statusKey: "inApproval", locked: true, selectable: true },
    },
  },
  "purchase-voucher": {
    field: "appstatusid",
    rules: {
      1: { statusKey: "approved", locked: true, selectable: true },
      100: { statusKey: "inApproval", locked: true, selectable: true },
    },
  },
  "goods-received-note": {
    field: "appstatusid",
    rules: {
      1: { statusKey: "approved", locked: true, selectable: true },
      100: { statusKey: "inApproval", locked: true, selectable: true },
    },
  },
  // 2026-08-25 /pm — WKF Approval Initiator rollout, same rule shape as the
  // four modules above (identical statusIds project-wide; no-op automatically
  // if a module's list SP doesn't return appstatusid, see NO_OP_STATE below).
  "purchase-quotation": {
    field: "appstatusid",
    rules: {
      1: { statusKey: "approved", locked: true, selectable: true },
      100: { statusKey: "inApproval", locked: true, selectable: true },
    },
  },
  "assets-employee-issue": {
    field: "appstatusid",
    rules: {
      1: { statusKey: "approved", locked: true, selectable: true },
      100: { statusKey: "inApproval", locked: true, selectable: true },
    },
  },
  "assets-employee-return": {
    field: "appstatusid",
    rules: {
      1: { statusKey: "approved", locked: true, selectable: true },
      100: { statusKey: "inApproval", locked: true, selectable: true },
    },
  },
  "assets-department-issue": {
    field: "appstatusid",
    rules: {
      1: { statusKey: "approved", locked: true, selectable: true },
      100: { statusKey: "inApproval", locked: true, selectable: true },
    },
  },
  "assets-returnable-gate-pass-out": {
    field: "appstatusid",
    rules: {
      1: { statusKey: "approved", locked: true, selectable: true },
      100: { statusKey: "inApproval", locked: true, selectable: true },
    },
  },
  "assets-returnable-gate-pass-in": {
    field: "appstatusid",
    rules: {
      1: { statusKey: "approved", locked: true, selectable: true },
      100: { statusKey: "inApproval", locked: true, selectable: true },
    },
  },
  "assets-employee-transfer": {
    field: "appstatusid",
    rules: {
      1: { statusKey: "approved", locked: true, selectable: true },
      100: { statusKey: "inApproval", locked: true, selectable: true },
    },
  },
  "assets-health-status-updation": {
    field: "appstatusid",
    rules: {
      1: { statusKey: "approved", locked: true, selectable: true },
      100: { statusKey: "inApproval", locked: true, selectable: true },
    },
  },
};

const NO_OP_STATE = { statusKey: null, locked: false, selectable: true };

/** (moduleKey, row) => { statusKey, locked, selectable } per APPROVAL_STATUS_CONFIG. */
export function getApprovalRowState(moduleKey, row) {
  const moduleConfig = APPROVAL_STATUS_CONFIG[moduleKey];
  if (!moduleConfig || !row) return NO_OP_STATE;
  const raw = resolveRowFieldValue(row, moduleConfig.field);
  if (raw === undefined || raw === null) return NO_OP_STATE;
  const rule = moduleConfig.rules[Number(raw)];
  if (!rule) return NO_OP_STATE;
  return {
    statusKey: rule.statusKey,
    locked: !!rule.locked,
    selectable: rule.selectable !== false,
  };
}
