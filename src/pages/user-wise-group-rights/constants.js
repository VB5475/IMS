// constants.js — User Wise Group Rights module config.
// MRD_Template4UserWsGroupRights.docx (Om, 19-Jun-2026).
//
// What the module does: pick a Group, Module and Type, hit Search, and the
// screen loads two rights grids for that group —
//   Grid 1 (Transaction Rights) — one row per function/form, with
//     Allow Insert / Allow Update / Allow Delete / Allow View checkboxes.
//     The Add / Edit / Delete / View checkboxes in the header are blanket
//     select-all toggles for those four columns (per the MRD screenshot they
//     sit directly above them).
//   Grid 2 (Report Rights) — one row per report, with a single Allow Approval
//     checkbox, plus an "Approval" select-all above the grid.
// Both grids save together through one endpoint (prmStrMstJSON), same
// single-array shape as Division Wise Rights and DMS Group Rights.
//
// Header dropdown sources (all three take NO parameters, per MRD Section 3):
//   Group  → fn_tbl_fetch_rb_userwsgrprights_Groupdata
//   Module → fn_tbl_fetch_rb_userwsgrprights_modulename
//   Type   → fn_tbl_fetch_rb_userwsgrprights_typedata
//
// Both grid functions take prmgroupid + prmgroupcode (2026-08-25 — the param
// KEY stays "prmgroupcode" per the actual SP signature, but the VALUE sent
// is the selected Module's name, not the Group's — a deliberate backend
// naming quirk, not a bug. Revises the same-day prmmodulename revision,
// which renamed the key when only the value should have changed). See
// buildGridParams at the bottom.
//
// Row shape — confirmed 2026-08-04 against both grid functions, which return
// the SAME columns as each other (that uniformity is what lets both grids
// share one prmStrMstJSON array on save):
//   funname        display name shown in each grid's first column
//   idnumber       rights row PK (0-ish/echoes funcidnumber when no rights
//                  row exists yet, so rows are keyed by funcidnumber instead)
//   funcidnumber   the function this row grants rights on
//   funccode       that function's own code, e.g. "CurrRate" — NOT this
//                  module's form tag, so save must not overwrite it
//   groupidnumber  selected group's id, echoed back per row
//   groupcode      selected group's name — spelled "gruopcode" (sic) by the
//                  Functiongrid function and "groupcode" by Appovalgrid;
//                  rows are passed through untouched so either survives
//   allowinsert / allowupdate / allowdelete / allowview / allowapproval
//                  all five present on both grids — each grid edits only its
//                  own subset and passes the rest through unchanged
//
// ⚠️ CONFIRM with DBA:
//
// 1. Module and Type appear in neither grid function's signature nor its row
//    shape, so neither can filter the grids — both are header-only values
//    carried into the save payload. The MRD's "Auto Filled Base On Group
//    Name, Module, Type, Function Name" implies they should narrow the list;
//    if that is wanted, the grid functions need the extra parameters (add
//    them to buildGridParams) or the extra row columns (filter locally).
//    Function Name does filter Grid 1, client-side, off `funname`.
// 2. SAVE_CONTEXT_KEYS — the only header values stamped onto each saved row.
//    Group id/name and funccode are deliberately absent: every row already
//    carries the server's own values for those. MRD Section 3 gives the Type
//    field's ColName as "Idnumber", which collides with the row PK, so Type
//    is sent as `typeid`. Confirm both key names against the save proc.

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const UWGR_CONFIG = {
  RB_MASTER: RB_CODES.USER_WISE_GROUP_RIGHTS,
  ROUTE_PATH: rbRoutePath(RB_CODES.USER_WISE_GROUP_RIGHTS),
  FORM_TAG: RB_CODES.USER_WISE_GROUP_RIGHTS,

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  LIST_OBJ_TYPE: 2,

  SP_GROUP_LIST: "fn_tbl_fetch_rb_userwsgrprights_Groupdata",
  SP_MODULE_LIST: "fn_tbl_fetch_rb_userwsgrprights_modulename",
  SP_TYPE_LIST: "fn_tbl_fetch_rb_userwsgrprights_typedata",

  /** Grid 1 — transaction/form rights. (prmgroupid) */
  SP_FUNCTION_GRID: "fn_tbl_fetch_rb_userwsgrprights_Functiongrid",
  /** Grid 2 — report approval rights. (prmgroupid) */
  SP_APPROVAL_GRID: "fn_tbl_fetch_rb_userwsgrprights_Appovalgrid",

  // Real gateway path (2026-08-05) — the MRD's
  // /API/rb_userwsgrprights/Post_rb_userwsgrprights_Save was a placeholder.
  SAVE_ENDPOINT: "/API/PurUserWSRight/Post_RB_Userwsgrprights_Save",
  STORAGE_HEADER_META: "userWiseGroupRightsHeaderMeta",

  HEADER_GROUP_COL: "groupid",
  HEADER_MODULE_COL: "moduleid",
  HEADER_TYPE_COL: "idnumber",

  /** Header fields to render, in MRD Section 3 order. */
  HEADER_COLS: ["groupid", "moduleid", "idnumber"],

  /** Header values stamped onto every saved row — see CONFIRM note 2. */
  SAVE_CONTEXT_KEYS: {
    module: "moduleid",
    type: "typeid",
  },
};

/** Grid row keys used for display and identity. */
export const UWGR_ROW_KEYS = Object.freeze({
  functionName: "funname",
  functionId: "funcidnumber",
});

// 2026-09-09 /pm — View leads the column order and gates the other three:
// a row's Insert/Update/Delete can't be granted (checkboxes disabled) until
// its own View is checked, and unchecking View on a row clears whatever else
// was granted there. See the "view gates the rest" handling in
// UserWiseGroupRightsForm.jsx (makeToggleRow/makeToggleAll).
//
// 2026-09-09 /pm — these are now only the FALLBACK shown before the RB's own
// column metadata has loaded (or if that fetch fails). The real columns/order
// come from GetDetailColData for this RB (rbid 20205), same as every other
// RB-driven form — see buildRightDefsFromRb below and its use in
// useUserWiseGroupRights.js. That RB response also declares an "Allow Print"
// column (colseqno 22, right after Approval), but the two grid-fetch SPs
// (Functiongrid / Appovalgrid) do not return an `allowprint` field on their
// rows at all (confirmed live, 2026-09-09) — so it's deliberately left out of
// both COLUMN sets below. Wiring it up needs that on the backend first;
// adding a checkbox for a field the row data never carries would just be a
// checkbox that can never reflect or save a real value.
/** Grid 1 columns — header select-all label ↔ per-row column label. Fallback
 *  only; see the note above. */
export const UWGR_TRANSACTION_RIGHTS = Object.freeze([
  { key: "view", column: "allowview", toggleLabel: "View", columnLabel: "Allow View" },
  { key: "insert", column: "allowinsert", toggleLabel: "Insert", columnLabel: "Allow Insert" },
  { key: "update", column: "allowupdate", toggleLabel: "Update", columnLabel: "Allow Update" },
  { key: "delete", column: "allowdelete", toggleLabel: "Delete", columnLabel: "Allow Delete" },
]);

/** The right key that gates the others in a rights grid — present only on
 *  Grid 1 (Report Rights' single Approval column has nothing to gate). */
export const UWGR_VIEW_GATE_KEY = "view";

/** Grid 2 columns. Fallback only; see the note above. */
export const UWGR_REPORT_RIGHTS = Object.freeze([
  { key: "approval", column: "allowapproval", toggleLabel: "Approval", columnLabel: "Allow Approval" },
]);

/** `colname`s each grid's fetch SP actually returns on its rows (confirmed
 *  live, 2026-09-09) — the allowlist buildRightDefsFromRb filters the RB's
 *  column metadata down to, per grid. Keep in sync with the SP row shape
 *  note above, not with what GetDetailColData merely declares. */
export const UWGR_TRANSACTION_RIGHT_COLUMNS = ["allowview", "allowinsert", "allowupdate", "allowdelete"];
export const UWGR_REPORT_RIGHT_COLUMNS = ["allowapproval"];

/**
 * Turn this RB's real column metadata (GetDetailColData rows) into rights
 * column defs for one grid — key/label/order genuinely sourced from the RB
 * instead of hand-maintained, filtered to `allowedColumns` (what that grid's
 * own fetch SP returns) and ordered by the RB's own colseqno.
 */
export function buildRightDefsFromRb(rbColumns, allowedColumns) {
  const wanted = new Set(allowedColumns.map((c) => c.toLowerCase()));
  return (rbColumns || [])
    .filter((col) => wanted.has(String(col.colname ?? col.ColName ?? "").toLowerCase()))
    .slice()
    .sort((a, b) => (Number(a.colseqno ?? a.ColSeqNo) || 0) - (Number(b.colseqno ?? b.ColSeqNo) || 0))
    .map((col) => {
      const colname = String(col.colname ?? col.ColName ?? "").toLowerCase();
      const label = String(col.displayname ?? col.DisplayName ?? "").trim() || colname;
      return {
        key: colname.replace(/^allow/, ""),
        column: colname,
        columnLabel: label,
        toggleLabel: label.replace(/^Allow\s+/i, "").trim() || label,
      };
    });
}

/** Grid function parameters — shared by both grid calls (2026-08-25 /pm:
 *  the param key is "prmgroupcode" per the actual SP signature, but its
 *  value is the selected Module's name, not the Group's — deliberate). */
export function buildGridParams({ groupId, moduleName }) {
  return {
    prmgroupid: Number(groupId) || 0,
    prmgroupcode: moduleName ?? "",
  };
}
