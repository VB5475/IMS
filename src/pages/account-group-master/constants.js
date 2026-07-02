// Account Group Master — admin module config (MRD_Template4AccountGroupMaster.docx)

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
  RB_MASTER: "RB_AcountGroupMst",
  FORM_TAG: "RB_AcountGroupMst",
  TRAN_BOOK: "ACC",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  /** Edit mode fill — fn_tbl_RB_AcountGroupMst */
  SP_MASTER_FILL: "fn_tbl_RB_AcountGroupMst",
  /** Main Group dropdown (New Account Group form) — FN_Fetch_Data, no parameters */
  SP_MAIN_GROUP: "Fn_tbl_AccountGroup",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "Fn_tbl_ACC_GroupMaster_List",
  LIST_DIVISION_ID: 0,

  MAIN_GROUP_COL: AGM_FIELDS.MAIN_GROUP,

  SAVE_ENDPOINT: "/API/AcountGroupMst/Post_RB_AcountGroupMst_Save",
  STORAGE_HEADER_META: "agmHeaderMeta",
};
