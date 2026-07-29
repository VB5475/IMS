// Document SubType Master — DMS module config (MRD_Template4DMS_DocumentSubType.docx, Om, 24-Jun-2026)
//
// ⚠️ MRD gaps — CONFIRM with DBA/Om:
//   - Department dropdown: same issue/fix as Document Type Master — MRD names
//     fn_tbl_fetch_department (org-wide list), but DM's own list
//     (fn_tbl_dm_department_list) is what matches live saved records. Using
//     the DM list per the user's 2026-07-27 confirmation for Document Type
//     Master, applied consistently here.
//   - Document Type dropdown: MRD names fn_tbl_fetch_documenttype, a huge
//     (~190-row) pre-existing generic screen/document list unrelated to this
//     DMS suite. Given documentsubtypeid is architecturally a child of the
//     Document Type Master being built alongside this module, and given the
//     same department-list precedent, using Document Type Master's OWN list
//     (fn_tbl_dm_documenttype_list) instead — NOT independently re-confirmed
//     with the user (unlike the department case), flagging for explicit
//     sign-off. Data content is nearly identical either way (both lists
//     mirror the same ~180-190 row taxonomy), so the practical risk is low.
//   - No cascade between Department and Document Type is specified in the
//     MRD (both fields listed as independent dropdowns) — implemented as
//     independent, uncoupled dropdowns.
//   - DELETE_PROC_NAME: RB's own deleteprocname is blank live — omitted.
//   - LIST_DIVISION_ID: MRD value is a function name, not a division ID —
//     defaulting to 0.
//   - SAVE_ENDPOINT: MRD §7 has a typo (references …doctypemst_Save instead
//     of …docsubtypemst_Save) that contradicts its OWN §4 (correct) and its
//     OWN §5.1 RB Save API row (correct) — used the value that matches this
//     module's own RB name, consistent with the DOP MRD's SP_LIST conflict
//     resolution.

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const DOCSUBTYPE_CONFIG = {
  RB_MASTER: RB_CODES.DOCUMENT_SUBTYPE_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.DOCUMENT_SUBTYPE_MASTER),
  FORM_TAG: RB_CODES.DOCUMENT_SUBTYPE_MASTER, // MRD §7: FORM_TAG = full RB code, "No" (not CONFIRM)
  TRAN_BOOK: "DM",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_dm_docsubtypemst",
  /** Department dropdown — DM's own list (see note above). */
  SP_DEPARTMENT: "fn_tbl_dm_department_list",
  /** Document Type dropdown — Document Type Master's own list (see note above). */
  SP_DOCUMENT_TYPE: "fn_tbl_dm_documenttype_list",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_dm_documentsubtype_list",
  LIST_DIVISION_ID: 0,

  SAVE_ENDPOINT: "/API/DM_DocSubType/Post_rb_dm_docsubtypemst_Save",
  STORAGE_HEADER_META: "docSubTypeHeaderMeta",
};
