// constants.js — Transaction Entry (Sample Invoice) page config
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

// All RB codes, SP names, IDs, and request defaults used by this page in one place.

export const TXN_CONFIG = {
  // RB board codes
  RB_MASTER: RB_CODES.TXN_ENTRY,
  ROUTE_PATH: rbRoutePath(RB_CODES.TXN_ENTRY),
  RB_DETAIL: "rb_sampleinvdet",

  // SP / function names used in API calls
  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_DIVISIONS: "fn_tbl_fetchuserwsdivision",
  SP_DEPARTMENTS: "pr_fetch_departmentdata_ims",
  SP_SUPPLIERS: "pr_fetch_supplierdata_ims",
  SP_INVOICE_TYPES: "fn_tbl_ddl_sal_configuration",
  SP_ORDER_ITEMS: "pr_tbd_fetchitemdetail",
  SP_GRID_EVENT: "fn_tbl_rb_sampleinvdet_event",

  // Form identifier
  FORM_TAG: "SI",

  // Year / config IDs
  DIVISION_YEAR_ID: 14,
  INVOICE_TYPE_YEAR_ID: 14,
  ORDER_ITEM_YEAR_ID: 14,
  ORDER_ITEM_CONFIG_ID: 34,

  // Request defaults
  LOGIN_ID: 1,
  COMPANY_ID: 1,

  // localStorage keys for cached RB meta
  STORAGE_HEADER_META: "txnHeaderMeta",
  STORAGE_ENTRY_META: "txnEntryMeta",
};
