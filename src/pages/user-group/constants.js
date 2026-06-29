// User Group — admin module config (MRD_Template4UserGroup.docx)

export const UG_CONFIG = {
  RB_MASTER: "rb_genusergropmst",
  FORM_TAG: "rb_genusergropmst",
  TRAN_BOOK: "GRP",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_genusergropmst",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_gen_groupmaster_list",
  LIST_DIVISION_ID: 15,

  SAVE_ENDPOINT: "/API/GenUserGroupMst/Post_RB_GenUserGroupMst_Save",
  STORAGE_HEADER_META: "ugHeaderMeta",
};
