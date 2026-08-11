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
  // Per-Group rights matrix: Group + Module + Type pick a function list, then
  // two grids grant Insert/Update/Delete/View on transaction forms and
  // Approval on reports. MRD_Template4UserWsGroupRights.docx (Om, 19-Jun-2026)
  // — see src/pages/user-wise-group-rights/constants.js for the open items.
  USER_WISE_GROUP_RIGHTS: "rb_userwsgrprights",
  ITEM_MASTER: "rb_puritemmst",
  DEPARTMENT_MASTER: "rb_departmentmst",
  COMPANY: "rb_companymst",
  MAIN_GROUP_MASTER: "rb_purmaingroupmst",
  SUB_MAIN_GROUP_MASTER: "rb_submaingroupmst",
  SUB_GROUP_MASTER: "rb_subgroupmst",
  LOCATION_MASTER: "rb_genlocationmst",
  DIVISION_MASTER: "rb_divisionmst",
  SUPPLIER_MASTER: "rb_suppliermst",
  // Own RB per MRD_Template4Customer Master.docx (2026-08-08) — previously
  // shared rb_suppliermst with Supplier Master (see customer-master/constants.js).
  CUSTOMER_MASTER: "rb_customermst",
  ACCOUNT_GROUP_MASTER: "rb_acountgroupmst",
  ACCOUNT_MASTER: "rb_accountmst",
  TRANSPORTER_MASTER: "rb_transportermst",
  // ⚠️ CONFIRM with DBA — MRD's Nav/Route labels say "Document Type Master"
  // but the embedded screen design & RB name ("wkf" = workflow, "dop" =
  // Delegation Of Power) both confirm this is DOP Master, an approval-
  // authority matrix (amount-band + approver assignment), not a document
  // type lookup. Using the screenshot as ground truth per MRD_Template4DMS_DOPMaster.docx.
  DOP_MASTER: "rb_wkf_dopmst",

  // DMS (Document Management System) module — three-level master hierarchy:
  // Department → Document Type (FK department) → Document SubType (FK both).
  DM_DEPARTMENT_MASTER: "rb_dm_deptmst",
  DOCUMENT_TYPE_MASTER: "rb_dm_doctypemst",
  DOCUMENT_SUBTYPE_MASTER: "rb_dm_docsubtypemst",
  // 4th DMS module — maps Department + Tran Type to a Document Type.
  // MRD_Template4DMS_DocumentTransactionToDocument.docx (Om, 24-Jun-2026,
  // clarified live with Om 2026-07-28 — see constants.js for the resolved gaps).
  DM_TT2DOCTYPE_MASTER: "rb_dm_tt2doctype",
  // Document Log — transaction-level document logging, NOT a standalone
  // master (scope corrected 2026-07-30). Surfaced via an F6 button + large
  // modal inside transaction forms (Indent first; PO/PV/etc. later). Still
  // 2 independently RB-driven grids (Docs + Reference Documents) under the
  // hood — see components/txn/documentLogConfig.js.
  DM_DOCUMENT_LIST: "rb_dm_tranwisedocs",
  // 6th DMS module — Group Rights: per-Group, per-Department Upload/View/
  // Delete rights matrix, scoped to Document Type/SubType combinations.
  // MRD_Template4DMS_Grouprights.docx (28-Jul-2026) — its own "Module
  // Overview" section is stale boilerplate copied from the TT2DocType MRD
  // ("Purpose: Create Department for DMS") and does NOT describe this
  // feature; the real spec is Section 3/5.1 + the embedded screenshot.
  // See src/pages/dm-group-rights/constants.js for the full architecture
  // notes and confirmed/excluded fields.
  DM_GROUP_RIGHTS: "rb_dm_groupright",
  // 7th DMS module — Tran Type Link: links a "From" Transaction Type to one
  // or more "To" Transaction Types (idnumber-scoped grid fetch confirmed
  // live). MRD_Template4DMS_Trantypelink.docx (Om, 24-Jun-2026) is largely
  // unreliable for this module (screen design + one field row are
  // copy-pasted from Document Log's MRD; "Department" dropdown described in
  // the text doesn't exist as an RB column at all) — see
  // src/pages/dm-tran-type-link/constants.js for the full live-RB
  // investigation this module was built from instead.
  DM_TRAN_TYPE_LINK: "rb_dm_ttmstreln",

  // ── Purchase ────────────────────────────────────────────────────
  PURCHASE_INDENT: "rb_purindtmst",
  PURCHASE_INQUIRY: "rb_purinquirymst",
  PURCHASE_QUOTATION: "rb_purqtnmst",
  PURCHASE_ORDER: "rb_purpomst",
  /** Purchase Rate Contract — MRD_Template4PurchaseRateContract.docx (Richa, 03-Jul-2026) */
  PURCHASE_RATE_CONTRACT: "rb_purratecontmst",
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
  /** Detail-only module (no RB_MASTER) — Item Master Upload Excel */
  ITEM_MASTER_UPLOAD_EXCEL: "rb_xluplditemmst",
  /** Dashboard report-board stock detail columns */
  DASHBOARD_AST_STOCK_DETAIL: "rb_aststkadbdtl",

  // ── Maintenance ─────────────────────────────────────────────────
  MAINTENANCE_DASHBOARD: "rb_mntdashboard",
  COMPLAINT_REGISTER: "rb_mntcpnmst",
  CALL_ALLOCATION: "rb_mntallocation",
  CALL_FOLLOW_UP: "rb_mntfollowup",
  CALL_REPORTING: "rb_mnt_clrpt",
  MAINTENANCE_CONTRACT_RENEWAL: "rb_mntamcrnwmst",
  MAINTENANCE_NEW_CONTRACT: "rb_mntamcnewmst",
});

/**
 * RB code → public frontend base path (human-readable, never exposes rb_*).
 * This is how routes stay identifiable by RB code without leaking it in the URL.
 */
export const RB_ROUTE_PATHS = Object.freeze({
  [RB_CODES.USER_MASTER]: "/admin/user-master",
  [RB_CODES.USER_GROUP]: "/admin/user-group",
  [RB_CODES.DIVISION_WISE_RIGHTS]: "/admin/division-wise-rights",
  [RB_CODES.USER_WISE_GROUP_RIGHTS]: "/admin/user-wise-group-rights",
  [RB_CODES.ITEM_MASTER]: "/admin/item-master",
  [RB_CODES.DEPARTMENT_MASTER]: "/admin/department-master",
  [RB_CODES.COMPANY]: "/admin/company",
  [RB_CODES.MAIN_GROUP_MASTER]: "/admin/main-group-master",
  [RB_CODES.SUB_MAIN_GROUP_MASTER]: "/admin/master/item/sub-main-group-master",
  [RB_CODES.SUB_GROUP_MASTER]: "/admin/master/item/sub-group-master",
  [RB_CODES.LOCATION_MASTER]: "/admin/company/location-master",
  [RB_CODES.DIVISION_MASTER]: "/admin/company/division-master",
  [RB_CODES.SUPPLIER_MASTER]: "/admin/master/supplier-master",
  [RB_CODES.ACCOUNT_GROUP_MASTER]: "/admin/account-group-master",
  [RB_CODES.ACCOUNT_MASTER]: "/admin/account-master",
  // MRD's own routes are malformed ("/Admin/Master/Supplier – Transporter
  // Master" — literal en-dash, duplicated "Supplier") — using the sibling
  // Supplier/Customer Master route shape instead.
  [RB_CODES.TRANSPORTER_MASTER]: "/admin/master/transporter-master",
  [RB_CODES.DOP_MASTER]: "/admin/dop-master",

  // DMS module — namespaced separately from RB_CODES.DEPARTMENT_MASTER's
  // "/admin/department-master" (a different RB: rb_departmentmst, the
  // org-wide department master) to avoid a route/nav collision.
  [RB_CODES.DM_DEPARTMENT_MASTER]: "/admin/dms/department-master",
  [RB_CODES.DOCUMENT_TYPE_MASTER]: "/admin/dms/document-type-master",
  [RB_CODES.DOCUMENT_SUBTYPE_MASTER]: "/admin/dms/document-subtype-master",
  [RB_CODES.DM_TT2DOCTYPE_MASTER]: "/admin/dms/tt2doctype-master",
  // DM_DOCUMENT_LIST has no route — it's a modal (see RB_CODES comment above).
  [RB_CODES.DM_GROUP_RIGHTS]: "/admin/dms/group-rights",
  [RB_CODES.DM_TRAN_TYPE_LINK]: "/admin/dms/tran-type-link",

  [RB_CODES.PURCHASE_INDENT]: "/purchase-indent",
  [RB_CODES.PURCHASE_INQUIRY]: "/purchase-inquiry",
  [RB_CODES.PURCHASE_QUOTATION]: "/purchase-quotation",
  [RB_CODES.PURCHASE_ORDER]: "/purchase-order",
  [RB_CODES.PURCHASE_RATE_CONTRACT]: "/purchase-rate-contract",
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
  [RB_CODES.ITEM_MASTER_UPLOAD_EXCEL]: "/admin/master/item-master-upload-excel",

  [RB_CODES.MAINTENANCE_DASHBOARD]: "/maintenance-dashboard",
  [RB_CODES.COMPLAINT_REGISTER]: "/complaint-register",
  [RB_CODES.MAINTENANCE_CONTRACT_RENEWAL]: "/maintenance-contract-renewal",
  [RB_CODES.MAINTENANCE_NEW_CONTRACT]: "/maintenance-new-contract",
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
