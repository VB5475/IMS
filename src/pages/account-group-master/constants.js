// Account Group Master — admin module config (MRD_Template4AccountGroupMaster.docx)

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

/** Form field ColNames from MRD Section 3 */
export const AGM_FIELDS = {
  GROUP_CODE: "grpcode",
  SEQUENCE: "seq",
  MAIN_GROUP: "maingroupid",
  ACCOUNT_NAME: "acname",
  REGIONAL_NAME: "regname",
  IS_CONTROL_GROUP: "iscontrolgroup",
};

export const AGM_CONFIG = {
  RB_MASTER: RB_CODES.ACCOUNT_GROUP_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.ACCOUNT_GROUP_MASTER),
  FORM_TAG: "rb_acountgroupmst",
  TRAN_BOOK: "ACC",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  /** Edit mode fill — fn_tbl_RB_AcountGroupMst */
  SP_MASTER_FILL: "fn_tbl_rb_acountgroupmst",
  /** Main Group dropdown (New Account Group form) — FN_Fetch_Data, no parameters */
  SP_MAIN_GROUP: "fn_tbl_accountgroup",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_acc_groupmaster_list",
  LIST_DIVISION_ID: 0,

  DELETE_PROC_NAME: "pr_rb_acgroupmst_delete",

  MAIN_GROUP_COL: AGM_FIELDS.MAIN_GROUP,

  SAVE_ENDPOINT: "/API/AcountGroupMst/Post_RB_AcountGroupMst_Save",
  STORAGE_HEADER_META: "agmHeaderMeta",
};
