// User Master — admin module config (MRD_Template4UserMaster.docx)

export const UM_CONFIG = {
  RB_MASTER: "rb_genusermst",
  FORM_TAG: "rb_genusermst",
  TRAN_BOOK: "UM",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_genusermst",
  SP_DESIGNATION: "fn_tbl_fetch_designation",
  SP_GROUP: "fn_tbl_fetch_groupmst",
  SP_DEPARTMENT: "fn_tbl_fetch_department",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_genusermst_list",
  LIST_DIVISION_ID: 15,

  SAVE_ENDPOINT: "/API/GenUserMst/Post_RB_GenUserMst_Save",
  STORAGE_HEADER_META: "piHeaderMeta",
};
