// DM Department Master — DMS module config (MRD_Template4DMS_Department.docx, Om, 24-Jun-2026)
//
// ⚠️ NOT the same module as RB_CODES.DEPARTMENT_MASTER ("/admin/department-master",
// rb_departmentmst) — that is the org-wide department master used elsewhere in
// the app (PV/PO/DOP department dropdowns). This is a separate, DMS-specific
// department taxonomy (rb_dmdepartmaster) with its own small hardcoded row set
// (PURCHASE, SALES, PROD, QC, FAS, ADMIN, MAINT, INV, OMS — confirmed live via
// fn_tbl_dm_department_list). Document Type Master and Document SubType Master
// both FK into THIS table, not the org-wide one.
//
// ⚠️ MRD gaps — CONFIRM with DBA/Om:
//   - "Is Active" is described as a checkbox in the MRD, but the live RB column
//     (GetDetailColData) reports ColCtrlType=1 (TextBox), not 3/11 (Checkbox).
//     Rendering follows the live RB metadata (textbox) per this project's
//     "trust the RB over the MRD" convention — flag for DBA to fix RB config
//     if a real checkbox is wanted.
//   - DELETE_PROC_NAME: the RB's own deleteprocname (fn_fetch_rbdetailbyrbcode)
//     is blank live — no delete SP is configured server-side yet. Omitted here
//     rather than guessed; the list grid's delete action will not work until
//     DBA adds one.
//   - LIST_DIVISION_ID: MRD value is a function name ("Fn_tbl_FetchUserwsDivision"),
//     not a division ID (same table-misalignment error seen in the DOP MRD) —
//     defaulting to 0 (all divisions).

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const DMDEPT_CONFIG = {
  RB_MASTER: RB_CODES.DM_DEPARTMENT_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.DM_DEPARTMENT_MASTER),
  FORM_TAG: RB_CODES.DM_DEPARTMENT_MASTER, // MRD §7: FORM_TAG = full RB code, "No" (not CONFIRM) — matches AGM_CONFIG's own convention
  TRAN_BOOK: "DM",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_dmdepartmaster",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_dm_department_list",
  LIST_DIVISION_ID: 0,

  SAVE_ENDPOINT: "/API/DM_DeptMst/Post_rb_dmdepartmaster_Save",
  STORAGE_HEADER_META: "dmDeptHeaderMeta",
};
