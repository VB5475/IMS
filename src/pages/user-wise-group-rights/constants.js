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

/** Grid 1 columns — header select-all label ↔ per-row column label. */
export const UWGR_TRANSACTION_RIGHTS = Object.freeze([
  { key: "insert", column: "allowinsert", toggleLabel: "Add", columnLabel: "Allow Insert" },
  { key: "update", column: "allowupdate", toggleLabel: "Edit", columnLabel: "Allow Update" },
  { key: "delete", column: "allowdelete", toggleLabel: "Delete", columnLabel: "Allow Delete" },
  { key: "view", column: "allowview", toggleLabel: "View", columnLabel: "Allow View" },
]);

/** Grid 2 columns. */
export const UWGR_REPORT_RIGHTS = Object.freeze([
  { key: "approval", column: "allowapproval", toggleLabel: "Approval", columnLabel: "Allow Approval" },
]);

/** Grid function parameters — shared by both grid calls (2026-08-25 /pm:
 *  the param key is "prmgroupcode" per the actual SP signature, but its
 *  value is the selected Module's name, not the Group's — deliberate). */
export function buildGridParams({ groupId, moduleName }) {
  return {
    prmgroupid: Number(groupId) || 0,
    prmgroupcode: moduleName ?? "",
  };
}
