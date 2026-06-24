// User Group — admin module config (MRD_Template4UserGroup.docx)

export const UG_CONFIG = {
  RB_MASTER: "RB_GenUserGroupMst",
  FORM_TAG: "RB_GenUserGroupMst",
  TRAN_BOOK: "GRP",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_MASTER_FILL: "fn_tbl_RB_GenUserGroupMst",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "Fn_tbl_Gen_GroupMaster_List",
  LIST_DIVISION_ID: 15,

  SAVE_ENDPOINT: "/API/GenUserGroupMst/Post_RB_GenUserGroupMst_Save",
  STORAGE_HEADER_META: "ugHeaderMeta",
};
