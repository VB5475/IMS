// User Master — admin module config (MRD_Template4UserMaster.docx)

export const UM_CONFIG = {
  RB_MASTER: "RB_GenUserMst",
  FORM_TAG: "RB_GenUserMst",
  TRAN_BOOK: "UM",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_MASTER_FILL: "fn_tbl_RB_GenUserMst",
  SP_DESIGNATION: "Fn_tbl_Fetch_Designation",
  SP_GROUP: "Fn_tbl_Fetch_GroupMst",
  SP_DEPARTMENT: "Fn_tbl_Fetch_Department",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "Fn_tbl_GenUserMst_List",
  LIST_DIVISION_ID: 15,

  SAVE_ENDPOINT: "/API/GenUserMst/Post_RB_GenUserMst_Save",
  STORAGE_HEADER_META: "piHeaderMeta",
};
