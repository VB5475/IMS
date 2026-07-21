// User Group — admin module config (MRD_Template4UserGroup.docx)

export const UG_CONFIG = {
  RB_MASTER: "rb_genusergroupmst",
  FORM_TAG: "rb_genusergroupmst",
  TRAN_BOOK: "GRP",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_genusergroupmst",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_gen_groupmaster_list",
  LIST_DIVISION_ID: 15,

  DELETE_PROC_NAME: "pr_rb_usergroupmst_Delete",

  SAVE_ENDPOINT: "/API/GenUserGroupMst/Post_RB_GenUserGroupMst_Save",
  STORAGE_HEADER_META: "ugHeaderMeta",
};
