// Document Type Master — DMS module config (MRD_Template4DMS_DocumentType.docx, Om, 24-Jun-2026)
//
// ⚠️ MRD gaps — CONFIRM with DBA/Om:
//   - Department dropdown SP: MRD names fn_tbl_fetch_department, but that SP
//     returns the org-wide department list (Production, Admin, PPC, Design…)
//     which does NOT match the values already stored on live Document Type
//     records (fn_tbl_dm_documenttype_list shows Department values like
//     "PURCHASE", "SALES", "PROD" — matching DM Department Master's OWN
//     9-row list instead). User confirmed 2026-07-27: use DM's own list
//     (fn_tbl_dm_department_list) rather than the MRD's literal SP name.
//   - GetFilterDetail (the generic RB-driven dropdown resolver used by
//     Account Group Master etc.) FAILS for this column live (SQL error:
//     "Incorrect syntax near ','.") — confirming a manual fn_tbl_* fetch is
//     required, same pattern as DOP Master's header dropdowns.
//   - DELETE_PROC_NAME: RB's own deleteprocname is blank live — omitted.
//   - LIST_DIVISION_ID: MRD value is a function name, not a division ID —
//     defaulting to 0.

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const DOCTYPE_CONFIG = {
  RB_MASTER: RB_CODES.DOCUMENT_TYPE_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.DOCUMENT_TYPE_MASTER),
  FORM_TAG: RB_CODES.DOCUMENT_TYPE_MASTER, // MRD §7: FORM_TAG = full RB code, "No" (not CONFIRM)
  TRAN_BOOK: "DM",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_dm_doctypemst",
  /** Department dropdown — DM's own list, not the org-wide fn_tbl_fetch_department (see note above). */
  SP_DEPARTMENT: "fn_tbl_dm_department_list",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_dm_documenttype_list",
  LIST_DIVISION_ID: 0,

  SAVE_ENDPOINT: "/API/DM_DocType/Post_rb_dm_doctypemst_Save",
  STORAGE_HEADER_META: "docTypeHeaderMeta",
};
