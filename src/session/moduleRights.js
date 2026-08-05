// moduleRights.js — per-login form rights, fetched once at login from
// fn_tbl_fetchloginusermenudetail and read from anywhere (hooks, plain utils,
// route guards).
//
// The SP returns one row per function the login can reach:
//   { funcid, funccode, funname, allowinsert, allowupdate, allowview,
//     allowdelete, allowapproval, isform, isreport }
//
// `funccode` is the backend's spelling of our RB code, but the casing is
// inconsistent and some rows carry a `pr_` prefix — the live list mixes
// "pr_RB_AstMntPartCost", "RB_PurIndtMst" and "rb_astempissmst" — so both
// sides go through normalizeFuncCode before matching. One of our own codes
// (rb_astdepPerc) is mixed-case too, which is why the RB side is normalized
// as well rather than compared verbatim.

import { getUserSession } from "./userSession";
import { findRbByPath } from "../constants/rbCodes";

/** SP behind ENDPOINTS.FN_FETCH_DATA (ObjType FUNCTION) that returns the rows above. */
export const MENU_RIGHTS_SP = "fn_tbl_fetchloginusermenudetail";

/**
 * Rights assumed for a module the response says nothing about.
 *
 * Fail-open is deliberate (confirmed 2026-08-05): the backing data is still
 * incomplete. Only login 1 currently returns any rows at all, and 13 of our
 * modules — every DMS screen, DOP Master, both maintenance contracts, Call
 * Reporting, Txn Entry, Asset Depreciation Percentage and User Wise Group
 * Rights — have no row even for login 1. Defaulting to deny would lock users
 * out of screens they are supposed to reach. A module is only ever restricted
 * by an explicit row that says so.
 */
const UNRESTRICTED = Object.freeze({
  canView: true,
  canInsert: true,
  canUpdate: true,
  canDelete: true,
  canApprove: true,
  known: false,
});

/** "pr_RB_AstMntPartCost" → "rb_astmntpartcost" */
export function normalizeFuncCode(code) {
  return String(code ?? "")
    .trim()
    .replace(/^pr_/i, "")
    .toLowerCase();
}

function readFlag(row, key) {
  const value = row?.[key] ?? row?.[key.toUpperCase()];
  return Number(value) === 1;
}

function toRights(row) {
  return {
    canView: readFlag(row, "allowview"),
    canInsert: readFlag(row, "allowinsert"),
    canUpdate: readFlag(row, "allowupdate"),
    canDelete: readFlag(row, "allowdelete"),
    canApprove: readFlag(row, "allowapproval"),
    known: true,
  };
}

/**
 * The response carries legacy aliases that collapse onto the same RB code
 * once normalized (three spellings of asset write-off, two of purchase
 * indent). Merging permissively avoids one stale alias row revoking a right
 * that a current row grants.
 */
function mergeRights(a, b) {
  if (!a) return b;
  return {
    canView: a.canView || b.canView,
    canInsert: a.canInsert || b.canInsert,
    canUpdate: a.canUpdate || b.canUpdate,
    canDelete: a.canDelete || b.canDelete,
    canApprove: a.canApprove || b.canApprove,
    known: true,
  };
}

function buildIndex(rows) {
  const index = new Map();
  for (const row of rows || []) {
    const key = normalizeFuncCode(row?.funccode ?? row?.FuncCode);
    if (!key) continue;
    index.set(key, mergeRights(index.get(key), toRights(row)));
  }
  return index;
}

// Derived from the session rather than held independently, so a page reload
// (which rehydrates the session from localStorage) needs no re-fetch, and
// logout clears the rights along with everything else.
let indexedRows = null;
let index = new Map();

function rightsIndex() {
  const rows = getUserSession().menuRights;
  if (rows !== indexedRows) {
    indexedRows = rows;
    index = buildIndex(rows);
  }
  return index;
}

/**
 * Keeps only the fields we act on, so a large SP response does not bloat the
 * persisted session. Returns [] for an error envelope or a non-array body —
 * which fail-open treats the same as "no restrictions known".
 */
export function extractMenuRights(res) {
  if (!Array.isArray(res)) return [];
  return res
    .filter((row) => row && typeof row === "object" && (row.funccode ?? row.FuncCode))
    .map((row) => ({
      funccode: String(row.funccode ?? row.FuncCode),
      allowview: Number(row.allowview ?? row.AllowView) === 1 ? 1 : 0,
      allowinsert: Number(row.allowinsert ?? row.AllowInsert) === 1 ? 1 : 0,
      allowupdate: Number(row.allowupdate ?? row.AllowUpdate) === 1 ? 1 : 0,
      allowdelete: Number(row.allowdelete ?? row.AllowDelete) === 1 ? 1 : 0,
      allowapproval: Number(row.allowapproval ?? row.AllowApproval) === 1 ? 1 : 0,
    }));
}

/** Rights for an RB code. Unlisted modules come back unrestricted — see UNRESTRICTED. */
export function getModuleRights(rbCode) {
  const key = normalizeFuncCode(rbCode);
  if (!key) return UNRESTRICTED;
  return rightsIndex().get(key) ?? UNRESTRICTED;
}

/** Rights for a frontend pathname, e.g. "/purchase-indent/12/edit". */
export function getRightsForPath(pathname) {
  return getModuleRights(findRbByPath(pathname));
}

export { UNRESTRICTED as UNRESTRICTED_RIGHTS };
