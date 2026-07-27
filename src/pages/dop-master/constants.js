// constants.js — DOP Master (Delegation Of Power) page config
//
// Source: docs/module-requirements/MRD_Template4DMS_DOPMaster.docx (Om, 24-Jun-2026).
//
// ⚠️ MRD gaps — proceeding with the assumptions below (client chose "proceed
// now" over sending the MRD back). CONFIRM every one of these with DBA/Om:
//   - Module identity: MRD's Section 1 Nav Label / Routes say "Document Type
//     Master", but the embedded screen design is titled "DOP Master" and the
//     RB name ("wkf" = workflow, "dop" = Delegation Of Power) matches that,
//     not a document-type lookup. Using the screenshot as ground truth.
//   - SP_LIST: MRD gives two conflicting names — fn_tbl_dm_documentsubtype_list
//     (§5.1, looks copy-pasted from an unrelated module) vs
//     fn_tbl_rb_wkf_dopmst_list (§7). Using the latter — matches the
//     "<RB_MASTER>_list" naming convention every other module's SP_LIST follows.
//   - FORM_TAG: MRD sets it to the full RB code; every other module uses a
//     short 2-4 letter tag (IND, PV, PI). Using "DOP".
//   - STORAGE_HEADER_META: MRD value "piHeaderMeta" is a leftover from the
//     Purchase Indent template — renamed to "dopHeaderMeta".
//   - LIST_DIVISION_ID: MRD value is a function name, not a division ID
//     (table misalignment) — defaulting to 0 (all divisions) like most
//     other admin/master modules.
//   - SAVE_ENDPOINT: MRD gives two different base paths for the same action
//     (§4 "/API/WKF/..." vs §5.1 "/API/DmDoctypeMst/...") — using §4's.
//   - Detail save payload keys: MRD never specifies prmStr*JSON key names for
//     the two detail grids. CONFIRMED live 2026-07-27 from a working payload
//     sample: prmStrAmountDetJSON / prmStrUserDetailJSON (note "UserDetail",
//     not "UserDet").
//   - SP_USER (Employee Detail grid's "User" dropdown, "auto fill from
//     Gen_UserMaster" per MRD): exact SP name not given — using
//     "fn_tbl_genusermst", matching RB_CODES.USER_MASTER's RB name.
//   - Status options ("R And A dropdown" on Employee Detail): CONFIRMED live
//     2026-07-27 the real column is `userstatusid` (numeric FK into
//     wkf_userstatus), not a hardcoded "R"/"A" string. The grid resolves real
//     dropdown options for it via GET_DETAIL_COL_DATA + GET_FILTER_DETAIL, so
//     Approve/Recommend are matched by option label at save time — no static
//     value list needed.

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "DOP Master";
export const PAGE_TITLE_NEW = "New DOP Master";

export const DOP_CONFIG = {
  RB_MASTER: RB_CODES.DOP_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.DOP_MASTER),

  RB_AMOUNT_DETAIL: "rb_wkf_dopamountdet",
  RB_USER_DETAIL: "rb_wkf_dopuserdet",

  FORM_TAG: "DOP", // CONFIRM — MRD gives the full RB code, using a short tag per convention
  TRAN_BOOK: "DM",

  CONFIG_YEAR_ID: 2, // CONFIRM per MRD §7
  DIVISION_YEAR_ID: 2, // CONFIRM per MRD §7

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_TRAN_TYPE: "fn_tbl_fetch_rb_wkf_dopmst_trantype",
  SP_ENTITY: "fn_tbl_fetch_rb_wkf_dopmst_entity",
  SP_DEPARTMENT: "fn_tbl_fetch_department",
  SP_COMPANY: "fn_tbl_fetch_rb_wkf_dopmst_company",
  SP_USER: "fn_tbl_genusermst", // CONFIRM — MRD only says "auto fill from Gen_UserMaster"

  SP_MASTER_FILL: "fn_tbl_rb_wkf_dopmst",
  SP_AMOUNT_DETAIL_FILL: "fn_tbl_rb_wkf_dopamountdet",
  SP_USER_DETAIL_FILL: "fn_tbl_rb_wkf_dopuserdet", // CONFIRM — MRD gave "rb_wkf_dopuserdet" (looks like the RB name, not the fill SP)

  SAVE_ENDPOINT: "/API/WKF_DOP/Post_RB_WKF_DOPMst_Save",

  STORAGE_HEADER_META: "dopHeaderMeta",
  STORAGE_AMOUNT_META: "dopAmountMeta",
  STORAGE_USER_META: "dopUserMeta",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_wkf_dopmst_list", // CONFIRM — MRD conflict, see note above
  LIST_DIVISION_ID: 0, // CONFIRM — MRD value was invalid (a function name)
};

// ⚠️ CONFIRMED live 2026-07-25 — the MRD's field-ID table said "Trantypeid" /
// "entityid", but the actual RB columns are named differently:
//   Tran Type → tranid (not trantypeid)
//   Entity    → configurationid (not entityid)
// Department (departmentid) and Company (companyid) matched the MRD as given.

/** Cleared when Tran Type changes (Entity cascades from it per MRD's SP note). */
export const DOP_FILTER_CASCADE_RESETS = {
  tranid: ["configurationid"],
};

export const DOP_SHORTCUT_CONFIG = {
  a: { label: "Add", title: "Add (Alt+A)" },
  s: { label: "Save", title: "Save (Alt+S)" },
  n: { label: "Cancel", title: "Cancel (Alt+N)" },
};
