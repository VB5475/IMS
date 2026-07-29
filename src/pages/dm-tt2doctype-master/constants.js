// Transaction To Document Type Master — DMS module config
// (MRD_Template4DMS_DocumentTransactionToDocument.docx, Om, 24-Jun-2026).
//
// Rebuilt 2026-07-29 as a direct-form module (Department -> Tran Type header,
// Document Type checklist body) — same shape as [[project_division_master]]-
// adjacent Division Wise User Rights (src/pages/division-wise-rights/).
// Supersedes the original list+modal build (commit e0d89b4) per user-shared
// screen mockup + sign-off, 2026-07-29. See project_dms_module_suite memory
// for full history including the 2026-07-28 live-verification addendum this
// file used to carry.
//
// CONFIRMED GAP (live-probed against IMS_LIVE, 2026-07-29 — 12 SP name
// variants tried across two rounds, every one "Invalid object name"):
// there is no backend SP that looks up which Document Types are ALREADY
// mapped for a given Department + Tran Type. The only fill SP that exists
// for this RB, fn_tbl_rb_dm_tt2doctype, fetches exactly ONE saved mapping
// row by its own idnumber (confirmed live: idnumber=1/2/3 each return a
// single {departmentid, ref_trantypeid, ref_documenttypeid} row) — it is
// not department/trantype-scoped. So reselecting a Department + Tran Type
// that already has saved mappings will NOT show prior checks; the checklist
// always starts blank. Flagged for DBA/Om — needs a new SP before this can
// round-trip correctly. Not a blocker for shipping the compose/save flow.
//
// Also confirmed live: fn_tbl_dm_documenttype_list rows carry a `department`
// field (denormalized department name, e.g. "PURCHASE") — used here to scope
// the checklist to the selected department client-side, no separate filter
// SP needed for that part.

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const TT2DOCTYPE_CONFIG = {
  RB_MASTER: RB_CODES.DM_TT2DOCTYPE_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.DM_TT2DOCTYPE_MASTER),
  FORM_TAG: RB_CODES.DM_TT2DOCTYPE_MASTER,

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  LIST_OBJ_TYPE: 2,

  /** Department picker — fn_tbl_dm_department_list (9 rows), confirmed live. */
  SP_DEPARTMENT: "fn_tbl_dm_department_list",
  /** Tran Type — genuinely department-scoped. Signature: fn_tbl_fetch_trantype(@prmdepartmentid). */
  SP_TRAN_TYPE: "fn_tbl_fetch_trantype",
  /** Document Type checklist source — DMS module's own list SP (~180 rows), filtered client-side by `department`. */
  SP_DOCUMENT_TYPE: "fn_tbl_dm_documenttype_list",

  // "DM_DM" is intentional, not a typo — used verbatim per prior Om confirmation.
  SAVE_ENDPOINT: "/API/DM_TT2DocType/Post_RB_DM_DM_TT2DocType_Save",
  STORAGE_HEADER_META: "piHeaderMeta",

  /** Live RB colname `departmentid` (ColCtrlType=4 Dropdown) — DisplayName is
   *  mislabeled "Is active" in RB metadata (open DBA ticket); label is
   *  overridden to "Department" client-side, confirmed correct by the
   *  2026-07-29 screen mockup. Control type/edit-ability still trusted from
   *  live RB, only the display text is overridden. */
  HEADER_DEPARTMENT_COL: "departmentid",
  /** Live RB colname `ref_trantypeid` (ColCtrlType=4 Dropdown, DisplayName "Tran Type"). */
  HEADER_TRANTYPE_COL: "ref_trantypeid",
  /** Live RB colname `ref_documenttypeid` — not rendered as its own header
   *  field anymore; reused per-row when building each checklist save row. */
  GRID_DOCTYPE_COL: "ref_documenttypeid",
};
