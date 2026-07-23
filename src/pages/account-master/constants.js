// Account Master — admin module config (MRD_Template4AccountMaster.docx)

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const AM_CONFIG = {
  RB_MASTER: RB_CODES.ACCOUNT_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.ACCOUNT_MASTER),
  FORM_TAG: "rb_accountmst",
  TRAN_BOOK: "ACM",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  /** Edit mode fill — fn_tbl_rb_accountmst */
  SP_MASTER_FILL: "fn_tbl_rb_accountmst",

  // Dropdown SPs
  /** Group Code dropdown — fn_tbl_acgroup_list, No Parameter */
  SP_GROUP_LIST: "fn_tbl_acgroup_list",
  /** ColName for account group dropdown (excluded from GET_FILTER_DETAIL) */
  GROUP_COL: "group_id",
  /** A/C Classification — fn_tbl_acClassification_list, No Parameter */
  SP_AC_CLASS_LIST: "fn_tbl_acclassification_list",
  /** Country — fn_tbl_countrymaster_list, No Parameter */
  SP_COUNTRY_LIST: "fn_tbl_countrymaster_list",
  /** State — fn_tbl_statemaster_list, prmcountryid numeric */
  SP_STATE_LIST: "fn_tbl_statemaster_list",
  /** City — fn_tbl_citymaster_list, prmcountryid numeric, prmstateid numeric */
  SP_CITY_LIST: "fn_tbl_citymaster_list",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_acc_accountmaster_list",
  LIST_DIVISION_ID: 0,

  SAVE_ENDPOINT: "/API/accountmst/Post_rb_accountmst_Save",
  STORAGE_HEADER_META: "amHeaderMeta",
};
