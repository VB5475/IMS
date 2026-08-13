// constants.js — Customer Master page config
//
// Previously shared Supplier Master's backend table/RB/SPs wholesale (only
// the "prmentrytype" discriminator, "C" vs "S", told records apart). Per
// MRD_Template4Customer Master.docx (Section 5/5.1, dev-confirmed 2026-08-08),
// Customer Master now has its own dedicated RB + list/edit-fill/save SPs —
// only RB_DETAIL (Consignee grid, rb_consigneedet) and the field-layout/
// dropdown-SP config still come from SM_CONFIG (MRD confirms these are
// unchanged/shared). No UI changes — flow/object-name only, per user instruction.
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
import { RB_CODES } from "../../constants/rbCodes";
import { SM_CONFIG } from "../supplier-master/constants";
export {
  SM_FORM_LAYOUT as CM_FORM_LAYOUT,
  SM_CHECKBOX_OVERRIDE_FIELDS as CM_CHECKBOX_OVERRIDE_FIELDS,
  resolveSmLayoutField as resolveCmLayoutField,
  getSmLayoutFieldNames as getCmLayoutFieldNames,
  controlTypeMap,
} from "../supplier-master/constants";

export const PAGE_TITLE     = "Customer Master";
export const PAGE_TITLE_NEW = "New Customer";
export const MODAL_TITLE_ADD  = "New Customer";
export const MODAL_TITLE_EDIT = "Edit Customer";
export const MODAL_SUBTITLE   = "Admin › Master › Customer";

export const CM_CONFIG = {
  ...SM_CONFIG,

  // Own RB — MRD Section 5.1 "Master Data RB": rb_customermst (was inherited
  // rb_suppliermst). ROUTE_PATH deliberately NOT changed — still derives from
  // SM_CONFIG's, this is a URL/navigation concern, not an API flow one.
  SP_CATEGORY: "fn_tbl_lookupmst_fetchcustomer",        
  SP_ACCOUNT_GROUP: "fn_tbl_accountgroup_fatchCustomer",     // → {idnumber, grpname}
  RB_MASTER: RB_CODES.CUSTOMER_MASTER,

  FORM_TAG: "CM",
  TRAN_BOOK: "CM",
  ENTRY_TYPE: "C",

  // MRD Section 5.1 "List side Data fill" / "Edit Mode - Master" — dedicated
  // SPs, no longer shared with Supplier Master's fn_tbl_suppliermst_list /
  // fn_tbl_rb_suppliermst.
  SP_LIST: "fn_tbl_customer_list",
  SP_MASTER_FILL: "fn_tbl_rb_customermst",
  // SP_DETAIL_FILL stays SM_CONFIG's "fn_tbl_rb_consigneedet" — MRD's own
  // "Edit Mode - Detail" row names the identical SP, so no override needed.

  // MRD Section 5 "Save endpoint (REST POST)" — the doc's own Section 7
  // constants table still says "/API/ SupplierMst /Post_Rb_customermst_Save"
  // (stray spaces, wrong module name) — clearly an uncorrected copy-paste
  // leftover from the Supplier Master MRD template; Section 5's clean value
  // used instead. Live-confirmed 2026-08-08: endpoint is reachable but the
  // DB-side proc it calls (pr_rb_customermst_postsave) doesn't exist yet —
  // DBA-pending, not a frontend gap.
  SAVE_ENDPOINT: "/API/CustomerMst/Post_RB_CustomerMst_Save",

  // Not listed in the MRD's API Reference at all — extrapolated from the same
  // "own RB → own SPs" pattern the doc establishes for list/fill/save
  // (pr_rb_<rbcode>_delete matches every other module's convention in this
  // app, e.g. SM_CONFIG's own "pr_rb_suppliermst_delete"). Was previously
  // inherited from SM_CONFIG unchanged (reused Supplier's delete proc) —
  // that would delete through the wrong RB now that Customer has its own.
  // Unverified against the live backend — likely also DBA-pending, same as
  // SAVE_ENDPOINT above; confirm/create with DBA alongside it.
  DELETE_PROC_NAME: "pr_rb_customermst_delete",

  // Own storage keys — must not collide with Supplier Master's cached RB meta.
  STORAGE_HEADER_META: "cmHeaderMeta",
  STORAGE_ENTRY_META: "cmEntryMeta",

  // Document Log ("Documents" button, 2026-08-13 /pm) — own trantype id,
  // overriding the one inherited via ...SM_CONFIG above (Supplier Master's
  // is 64). Same DM Department Master scope though (ADMIN=6, see
  // DOCUMENT_LOG_CONFIG.ADMIN_REF_DEPARTMENT_ID) — Customer Master is an
  // admin/setup master too, not a Purchase-department transaction.
  DM_TRAN_TYPE_ID: 65,
};
