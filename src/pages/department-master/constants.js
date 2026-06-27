// Department Master — admin module config (MRD_Template4DepartmentMaster.docx)

export const DM_CONFIG = {
  RB_MASTER: "RB_DepartmentMst",
  FORM_TAG: "RB_DepartmentMst",
  TRAN_BOOK: "DEPT",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_MASTER_FILL: "fn_tbl_RB_DepartmentMst",
  /** Dept Head Name dropdown — MRD user list. */
  SP_USER_FETCH: "Fn_tbl_GenUserMst_Fetch",
  DEPT_HEAD_COL: "DeptHeadID",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "Fn_tbl_DepartmentMst_List",
  LIST_DIVISION_ID: 0,

  SAVE_ENDPOINT: "/API/PurDepartmentMst/Post_RB_DepartmentMst_Save",
  STORAGE_HEADER_META: "dmHeaderMeta",
};
