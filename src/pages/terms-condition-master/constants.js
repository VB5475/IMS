// constants.js — Terms and Condition Master config.
//
// 2026-09-07 /pm — new flat master under the "Master" sidebar section,
// requested by Vinay (client). RB code confirmed registered on IMS_LIVE
// (RBID 20208, saveprocname pr_rb_termnconditionmst_save) — verified live
// before building, same discipline as the last two modules.
//
// Fields per live GetDetailColData: termstypeid (dropdown, ctrlsqlsource
// pur_termstype, objdetid 144969 — resolved via the SAME generic
// fetchDropdownOptions/GET_FILTER_DETAIL mechanism every transaction form
// uses, live-tested, returns 31 real Terms Type options), code (textbox,
// varchar(10)), description (textbox, varchar(750)).
//
// ⚠️ Flag, don't silently build around: "description" has iseditallow=false
// on the live RB. isMasterFieldLocked() (masterFormUtils.js) locks a field
// with iseditallow=false in BOTH Add and Edit mode — so as configured today,
// a brand-new Terms & Condition record cannot have its description typed in
// through this form at all; it saves blank/default every time. Built exactly
// per the RB's own flag (not overridden) — this needs a call on whether the
// RB config is a mistake, same class of finding as PO Short Close Qty's
// shortcloseqty column.
//
// 2026-09-08 /tl — corrected SP names/params per confirmed contract (this
// superseded the original build's assumption of a single list-only fetch
// function with no per-record lookup):
//  - List:   fn_tbl_rb_termnconditionmst_list(prmcompanyid, prmdivisionid,
//            prmyearid, prmloginid) — no session param.
//  - Edit:   fn_tbl_rb_termnconditionmst(prmcompanyid, prmyearid,
//            prmloginid, prmsessionid, prmmasterid) — per-record fetch by
//            the row's idnumber, same FN_FETCH_DATA/JSon call shape as the
//            list, not the GET_MASTER_DATA_FILL/prmProcedure shape Voucher
//            Type Master and Country Master use. Edit now fetches fresh via
//            this call instead of seeding from the grid row (see
//            TermsConditionMasterForm.jsx).
//
// DELETE_PROC_NAME is still NOT confirmed — RB metadata's deleteprocname is
// empty (delete genuinely isn't configured server-side yet). Unlike prior
// masters, this file deliberately does NOT guess a pr_rb_<rb>_delete name
// and wire Delete, since guessing wrong on a destructive action is a real
// risk, not just a routing inconvenience. Delete is left off the grid
// entirely.
//
// SAVE_ENDPOINT confirmed 2026-09-09 /pm:
// API/TermnConditionMst/Post_RB_TermnConditionMst_Save — wired into
// TermsConditionMasterForm.jsx's handleSave, same buildSaveRowFromColumns +
// useApi().post shape as every other RB master (Voucher Type Master's, this
// form's own stated template).
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import { PURCHASE_API } from "../../constants/purchaseCommon";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const MODAL_TITLE_ADD = "New Terms and Condition";
export const MODAL_TITLE_EDIT = "Edit Terms and Condition";
export const MODAL_SUBTITLE = "Admin › Master › Terms and Condition Master";

export const TCM_CONFIG = {
  RB_MASTER: RB_CODES.TERMS_CONDITION_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.TERMS_CONDITION_MASTER),
  SP_RB_META: PURCHASE_API.SP_RB_META, // fn_fetch_rbdetailbyrbcode
  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_termnconditionmst_list",
  SP_EDIT: "fn_tbl_rb_termnconditionmst",
  // No division filter/MRD exists for this master yet — 0 kept as the
  // permissive default other unconfirmed masters use (e.g. Account Group,
  // BOM, Company). ⚠️ CONFIRM with DBA.
  LIST_DIVISION_ID: 0,
  // Confirmed 2026-09-09 /pm.
  SAVE_ENDPOINT: "/API/TermnConditionMst/Post_RB_TermnConditionMst_Save",
  STORAGE_HEADER_META: "tcmHeaderMeta",
};
