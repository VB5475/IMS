/**
 * Canonical RB_MASTER codes — single source of truth for every form module.
 * Page `constants.js` files must import RB codes from here (do not hardcode).
 *
 * Frontend URLs stay human-readable (`RB_ROUTE_PATHS`). In the router, each
 * module route sets `id` to its RB code so `useCurrentRbCode()` / matches
 * can identify the module without exposing `rb_*` in the URL.
 */

export const RB_CODES = Object.freeze({
  // ── Admin / Master ──────────────────────────────────────────────
  USER_MASTER: "rb_genusermst",
  USER_GROUP: "rb_genusergroupmst",
  DIVISION_WISE_RIGHTS: "rb_divisionwsright",
  ITEM_MASTER: "rb_puritemmst",
  DEPARTMENT_MASTER: "rb_departmentmst",
  COMPANY: "rb_companymst",
  MAIN_GROUP_MASTER: "rb_purmaingroupmst",
  SUB_MAIN_GROUP_MASTER: "rb_submaingroupmst",
  SUB_GROUP_MASTER: "rb_subgroupmst",
  LOCATION_MASTER: "rb_genlocationmst",
  DIVISION_MASTER: "rb_divisionmst",
  SUPPLIER_MASTER: "rb_suppliermst",
  ASSET_ITEM_MASTER: "rb_astitemmst",
  ACCOUNT_GROUP_MASTER: "rb_acountgroupmst",
  ACCOUNT_MASTER: "rb_accountmst",
  // ⚠️ CONFIRM with DBA — MRD's Nav/Route labels say "Document Type Master"
  // but the embedded screen design & RB name ("wkf" = workflow, "dop" =
  // Delegation Of Power) both confirm this is DOP Master, an approval-
  // authority matrix (amount-band + approver assignment), not a document
  // type lookup. Using the screenshot as ground truth per MRD_Template4DMS_DOPMaster.docx.
  DOP_MASTER: "rb_wkf_dopmst",

  // DMS (Document Management System) module — three-level master hierarchy:
  // Department → Document Type (FK department) → Document SubType (FK both).
  DM_DEPARTMENT_MASTER: "rb_dmdepartmaster",
  DOCUMENT_TYPE_MASTER: "rb_dm_doctypemst",
  DOCUMENT_SUBTYPE_MASTER: "rb_dm_docsubtypemst",

  // ── Purchase ────────────────────────────────────────────────────
  PURCHASE_INDENT: "rb_purindtmst",
  PURCHASE_INQUIRY: "rb_purinquirymst",
  PURCHASE_QUOTATION: "rb_purqtnmst",
  PURCHASE_ORDER: "rb_purpomst",
  GOODS_RECEIVED_NOTE: "rb_purgrnmst",
  PURCHASE_VOUCHER: "rb_purpvmst",
  TXN_ENTRY: "rb_sampleinvmst",

  // ── Assets ──────────────────────────────────────────────────────
  CWIP_TO_FA: "rb_astcwip2famst",
  ASSETS_DEPRECIATION: "rb_astdepcamst",
  ASSET_DEPRECIATION_PERCENTAGE: "rb_astdepPerc",
  ASSETS_WRITE_OFF: "rb_astwriteoffmst",
  ASSETS_EMPLOYEE_ISSUE: "rb_astempissmst",
  ASSETS_EMPLOYEE_TRANSFER: "rb_astemptrfmst",
  ASSETS_EMPLOYEE_RETURN: "rb_astempretmst",
  ASSETS_DEPARTMENT_ISSUE: "rb_astdeptissmst",
  ASSETS_HEALTH_STATUS_UPDATION: "rb_asthealstamst",
  ASSETS_REVALUATION: "rb_astrevalmst",
  ASSETS_CLIENT_ALLOCATION: "rb_astcliallomst",
  ASSETS_RETURNABLE_GATE_PASS_OUT: "rb_astissrgomst",
  ASSETS_RETURNABLE_GATE_PASS_IN: "rb_astissrgimst",
  ASSETS_STOCK_TRANSFER: "rb_astissstktrmst",
  ASSETS_ITEM_OPENING: "rb_astitemopemst",
  /** Detail-only module (no RB_MASTER) — Asset Item Opening Excel */
  ASSETS_ITEM_OPENING_EXCEL: "rb_assetitmopnexl",
  /** Dashboard report-board stock detail columns */
  DASHBOARD_AST_STOCK_DETAIL: "rb_aststkadbdtl",

  // ── Maintenance ─────────────────────────────────────────────────
  MAINTENANCE_DASHBOARD: "rb_mntdashboard",
  COMPLAINT_REGISTER: "rb_mntcpnmst",
  CALL_ALLOCATION: "rb_mntallocation",
  CALL_FOLLOW_UP: "rb_mntfollowup",
});

/**
 * RB code → public frontend base path (human-readable, never exposes rb_*).
 * This is how routes stay identifiable by RB code without leaking it in the URL.
 */
export const RB_ROUTE_PATHS = Object.freeze({
  [RB_CODES.USER_MASTER]: "/admin/user-master",
  [RB_CODES.USER_GROUP]: "/admin/user-group",
  [RB_CODES.DIVISION_WISE_RIGHTS]: "/admin/division-wise-rights",
  [RB_CODES.ITEM_MASTER]: "/admin/item-master",
  [RB_CODES.DEPARTMENT_MASTER]: "/admin/department-master",
  [RB_CODES.COMPANY]: "/admin/company",
  [RB_CODES.MAIN_GROUP_MASTER]: "/admin/main-group-master",
  [RB_CODES.SUB_MAIN_GROUP_MASTER]: "/admin/master/item/sub-main-group-master",
  [RB_CODES.SUB_GROUP_MASTER]: "/admin/master/item/sub-group-master",
  [RB_CODES.LOCATION_MASTER]: "/admin/company/location-master",
  [RB_CODES.DIVISION_MASTER]: "/admin/company/division-master",
  [RB_CODES.SUPPLIER_MASTER]: "/admin/master/supplier-master",
  [RB_CODES.ASSET_ITEM_MASTER]: "/account/master/asset-item-master",
  [RB_CODES.ACCOUNT_GROUP_MASTER]: "/admin/account-group-master",
  [RB_CODES.ACCOUNT_MASTER]: "/admin/account-master",
  [RB_CODES.DOP_MASTER]: "/admin/dop-master",

  // DMS module — namespaced separately from RB_CODES.DEPARTMENT_MASTER's
  // "/admin/department-master" (a different RB: rb_departmentmst, the
  // org-wide department master) to avoid a route/nav collision.
  [RB_CODES.DM_DEPARTMENT_MASTER]: "/admin/dms/department-master",
  [RB_CODES.DOCUMENT_TYPE_MASTER]: "/admin/dms/document-type-master",
  [RB_CODES.DOCUMENT_SUBTYPE_MASTER]: "/admin/dms/document-subtype-master",

  [RB_CODES.PURCHASE_INDENT]: "/purchase-indent",
  [RB_CODES.PURCHASE_INQUIRY]: "/purchase-inquiry",
  [RB_CODES.PURCHASE_QUOTATION]: "/purchase-quotation",
  [RB_CODES.PURCHASE_ORDER]: "/purchase-order",
  [RB_CODES.GOODS_RECEIVED_NOTE]: "/goods-received-note",
  [RB_CODES.PURCHASE_VOUCHER]: "/purchase-voucher",
  [RB_CODES.TXN_ENTRY]: "/txn-entry",

  [RB_CODES.CWIP_TO_FA]: "/cwip-to-fa",
  [RB_CODES.ASSETS_DEPRECIATION]: "/assets-depreciation",
  [RB_CODES.ASSET_DEPRECIATION_PERCENTAGE]: "/asset-depreciation-percentage",
  [RB_CODES.ASSETS_WRITE_OFF]: "/assets-write-off",
  [RB_CODES.ASSETS_EMPLOYEE_ISSUE]: "/assets-employee-issue",
  [RB_CODES.ASSETS_EMPLOYEE_TRANSFER]: "/assets-employee-transfer",
  [RB_CODES.ASSETS_EMPLOYEE_RETURN]: "/assets-employee-return",
  [RB_CODES.ASSETS_DEPARTMENT_ISSUE]: "/assets-department-issue",
  [RB_CODES.ASSETS_HEALTH_STATUS_UPDATION]: "/assets-health-status-updation",
  [RB_CODES.ASSETS_REVALUATION]: "/assets-revaluation",
  [RB_CODES.ASSETS_CLIENT_ALLOCATION]: "/assets-client-allocation",
  [RB_CODES.ASSETS_RETURNABLE_GATE_PASS_OUT]: "/assets-returnable-gate-pass-out",
  [RB_CODES.ASSETS_RETURNABLE_GATE_PASS_IN]: "/assets-returnable-gate-pass-in",
  [RB_CODES.ASSETS_STOCK_TRANSFER]: "/assets-stock-transfer",
  [RB_CODES.ASSETS_ITEM_OPENING]: "/assets-item-opening",
  [RB_CODES.ASSETS_ITEM_OPENING_EXCEL]: "/account/master/asset-item-opening-excel",

  [RB_CODES.MAINTENANCE_DASHBOARD]: "/maintenance-dashboard",
  [RB_CODES.COMPLAINT_REGISTER]: "/complaint-register",
});

/** Absolute public base path for a module (e.g. `/purchase-indent`). */
export function rbRoutePath(rbCode) {
  const path = RB_ROUTE_PATHS[rbCode];
  if (!path) {
    throw new Error(`No public route path registered for RB code: ${rbCode}`);
  }
  return path;
}

/** React Router path segment (no leading slash). */
export function rbRouteSegment(rbCode) {
  return rbRoutePath(rbCode).replace(/^\//, "");
}

export function rbNewPath(rbCode) {
  return `${rbRoutePath(rbCode)}/new`;
}

export function rbEditPath(rbCode, id) {
  return `${rbRoutePath(rbCode)}/${id}/edit`;
}

export function rbViewPath(rbCode, id) {
  return `${rbRoutePath(rbCode)}/${id}`;
}

/** Lookup symbolic key for a raw RB string, if known. */
export function findRbCodeKey(rbCode) {
  const value = String(rbCode || "");
  return Object.keys(RB_CODES).find((key) => RB_CODES[key] === value) ?? null;
}

/** Resolve RB code from a frontend pathname (longest prefix match). */
export function findRbByPath(pathname) {
  const path = String(pathname || "").split("?")[0];
  let best = null;
  let bestLen = -1;
  for (const [rbCode, routePath] of Object.entries(RB_ROUTE_PATHS)) {
    if (path === routePath || path.startsWith(`${routePath}/`)) {
      if (routePath.length > bestLen) {
        best = rbCode;
        bestLen = routePath.length;
      }
    }
  }
  return best;
}

/**
 * Resolve the active module RB code from React Router `useMatches()`.
 * Module routes set `id` to the RB code (URL path stays human-readable).
 */
export function findRbFromMatches(matches = []) {
  const rbSet = new Set(Object.values(RB_CODES));
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const id = matches[i]?.id;
    if (id && rbSet.has(id)) return id;
  }
  return null;
}

/** @deprecated Use findRbByPath — kept as an alias for older imports. */
export const PATH_TO_RB = Object.freeze(
  Object.fromEntries(Object.entries(RB_ROUTE_PATHS).map(([rb, path]) => [path, rb]))
);
