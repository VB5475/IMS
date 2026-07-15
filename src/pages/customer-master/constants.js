// constants.js — Customer Master page config
//
// Customer Master and Supplier Master share the exact same backend table,
// RB codes, and save/list/fill SPs (rb_suppliermst / rb_consigneedet) — the
// only functional difference is the "prmmode" discriminator ("C" vs "S")
// sent on save and on the list fetch. CM_CONFIG inherits SM_CONFIG wholesale
// rather than duplicating RB codes/SP names by hand, so the two modules
// can't drift out of sync if the shared backend ever changes.
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
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

  FORM_TAG: "CM",
  TRAN_BOOK: "CM",
  CUSTOMER_SUPPLIER_MODE: "C",

  // Own storage keys — must not collide with Supplier Master's cached RB meta.
  STORAGE_HEADER_META: "cmHeaderMeta",
  STORAGE_ENTRY_META: "cmEntryMeta",
};
