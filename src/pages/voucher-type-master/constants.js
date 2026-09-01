// Field definitions driven dynamically from GetDetailColData via useVoucherTypeMaster
// hook. MRD_TemplateVoucherTypeMst (1).docx (Aditya, 20-Aug-2026, module code
// "Account") — flat master, no detail grid: Module + Levy Formula are both
// static (non-cascading) dropdowns, Voucher Type / Voucher Type Prefix are
// textboxes, Is Conversion is a checkbox. NOTE: Section 5.1's RB Structure
// Detail table mentions a "Consignee Detail gride" row and Section 7's
// STORAGE_HEADER_META/SUPPLIER_PARTY_TYPE rows are stale copy-paste leftovers
// from the Purchase Inquiry template this MRD was cloned from (this module has
// no detail grid and no supplier picker at all, per Section 2's screen notes
// and Section 3's header-only field list) — same kind of leftover seen in
// State Master's MRD, ignored the same way.
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const MODAL_TITLE_ADD = "New Voucher Type";
export const MODAL_TITLE_EDIT = "Edit Voucher Type";
export const MODAL_SUBTITLE = "Admin › Master › Account › Voucher Type Master";

export const VTM_CONFIG = {
  RB_MASTER: RB_CODES.VOUCHER_TYPE_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.VOUCHER_TYPE_MASTER),
  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_vouchertypemst",
  SP_MODULE: "fn_tbl_module_fetch", // → zero params, per MRD §2 screen notes
  SP_LEVY_FORMULA: "fn_tbl_levy_fetch", // → zero params, per MRD §2 screen notes
  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_vouchertypemst_list",
  LIST_DIVISION_ID: 15, // ⚠️ CONFIRM with DBA — MRD marks this CONFIRM
  DELETE_PROC_NAME: "pr_rb_vouchertypemst_delete", // ⚠️ CONFIRM with DBA — MRD didn't list a delete SP; following State/Country Master's pr_rb_<rb>_delete naming
  // Exactly as given in MRD §5 ("Save endpoint") and §5.1 ("RB Save API") —
  // both list this identical path, including the "pr_" segment that other
  // modules' save endpoints don't have (e.g. StateMst's Post_RB_StateMst_Save).
  SAVE_ENDPOINT: "/API/VoucherTypeMst/Post_pr_RB_VoucherTypeMst_Save",
  STORAGE_HEADER_META: "vtmHeaderMeta",
};
