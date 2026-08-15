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
// UPDATE 2026-08-14 (/pm): the Document Type checklist source was replaced
// with a genuinely scoped function, fn_tbl_fetch_documenttypett2doc(@prmdeptid,
// @prmreftrantypeid) — the client-side department-label filter this comment
// used to describe (against fn_tbl_dm_documenttype_list's flat ~180-row list)
// is gone; the backend now does the scoping.
//
// GAP ABOVE NOW CLOSED (live-confirmed via curl against IMS_LIVE the same
// day): fn_tbl_fetch_documenttypett2doc's rows carry a THIRD field,
// `ischecked` (1/0), alongside `ref_documenttypeid`/`ref_documenttypename` —
// this genuinely IS the already-mapped flag for the given department+trantype
// (e.g. deptid=1/trantypeid=1 returned "Purchase Indent" with ischecked:1
// among ~40 other rows at 0). useDMTT2DocTypeMaster's fetchDocumentTypeRows
// now maps this straight into each row's `checked` — reselecting a
// Department + Tran Type that already has saved mappings correctly
// pre-checks them instead of always starting blank.

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const TT2DOCTYPE_CONFIG = {
  RB_MASTER: RB_CODES.DM_TT2DOCTYPE_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.DM_TT2DOCTYPE_MASTER),
  FORM_TAG: RB_CODES.DM_TT2DOCTYPE_MASTER,

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  LIST_OBJ_TYPE: 2,

  /** Department picker — fn_tbl_dm_department_list (9 rows), confirmed live. */
  SP_DEPARTMENT: "fn_tbl_rb_dm_tt2doctype_department",
  /** Tran Type — genuinely department-scoped. Signature: fn_tbl_fetch_trantype(@prmdepartmentid). */
  SP_TRAN_TYPE: "fn_tbl_fetch_trantype",
  // REPLACED 2026-08-14 (/pm) — was fn_tbl_dm_documenttype_list, a flat
  // ~180-row list filtered client-side by the row's own denormalized
  // `department` name string (see the module header comment above). Now a
  // real, genuinely department+trantype-scoped function:
  // fn_tbl_fetch_documenttypett2doc(@prmdeptid, @prmreftrantypeid). Needs
  // BOTH params, so the checklist fetch now fires on Tran Type selection
  // (not Department selection) — see useDMTT2DocTypeMaster's
  // fetchDocumentTypeRows and DMTT2DocTypeMasterForm's handleTranTypeChange.
  SP_DOCUMENT_TYPE: "fn_tbl_fetch_documenttypett2doc",

  // "DM_DM" is intentional, not a typo — used verbatim per prior Om confirmation.
  SAVE_ENDPOINT: "/API/DM_TT2DocType/Post_RB_DM_TT2DocType_Save",
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
  // 2026-08-14 (/pm) — the RB's own GetDetailColData includes a
  // `ref_documenttypename` column (hidden, not part of the visible header
  // fields, but still merged into the save row by finalizeMasterHeaderSaveRow's
  // includeHidden:true default) — confirmed live via curl: it was being sent
  // as `0` on every save because DMTT2DocTypeMasterForm.jsx's handleSave never
  // populated it, so buildSaveRowFromColumns fell through to the type-based
  // default. Each checklist row already carries the real label as
  // `row.documenttype` (see useDMTT2DocTypeMaster's fetchDocumentTypeRows) —
  // now explicitly threaded through to this column at save time.
  GRID_DOCTYPE_NAME_COL: "ref_documenttypename",
};
