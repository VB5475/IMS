// Document SubType Master — DMS module config (MRD_Template4DMS_DocumentSubType.docx, Om, 24-Jun-2026)
//
// ⚠️ MRD gaps — CONFIRM with DBA/Om:
//   - Department dropdown: same issue/fix as Document Type Master — MRD names
//     fn_tbl_fetch_department (org-wide list), but DM's own list
//     (fn_tbl_dm_department_list) is what matches live saved records. Using
//     the DM list per the user's 2026-07-27 confirmation for Document Type
//     Master, applied consistently here.
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
//
// ── 2026-08-04: Document Type switched to a live Department cascade ──
// Previously used Document Type Master's own unparameterized list
// (fn_tbl_dm_documenttype_list, ~180 real rows e.g. "Purchase Order"). Per
// explicit user request, switched to the MRD's originally-named
// fn_tbl_fetch_documenttype(prmdepartmentid) instead, cascading off the
// selected Department — confirmed live it accepts the parameter and filters
// correctly (curled against all 4 real DMS department ids). Flagged
// live-data caveat: the data behind this SP is sparse per department (e.g.
// 3 rows for PURCHASE — "DEMOOO"/"purdoc"/"purdoc2" — 0 rows for MAST3),
// test/junk-looking rather than the rich real list the old SP had. User
// confirmed proceeding as-is despite this (2026-08-04); DBA should confirm
// whether that table needs real data populated. The old SP does NOT itself
// accept a department parameter (confirmed live — errors on every dept id),
// so this wasn't a simple add-a-param fix; it required switching SPs.

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
  /** Document Type dropdown — cascades off selected Department, takes prmdepartmentid (see 2026-08-04 header note). */
  SP_DOCUMENT_TYPE: "fn_tbl_fetch_documenttype",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_dm_documentsubtype_list",
  LIST_DIVISION_ID: 0,

  SAVE_ENDPOINT: "/API/DM_DocSubType/Post_rb_dm_docsubtypemst_Save",
  STORAGE_HEADER_META: "docSubTypeHeaderMeta",
};
