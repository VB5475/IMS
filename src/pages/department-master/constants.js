// Department Master — admin module config (MRD_Template4DepartmentMaster.docx)

export const DM_CONFIG = {
  RB_MASTER: "rb_departmentmst",
  FORM_TAG: "rb_departmentmst",
  TRAN_BOOK: "DEPT",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_RB_DepartmentMst",
  /** Dept Head Name dropdown — MRD user list. */
  SP_USER_FETCH: "fn_tbl_genusermst_fetch",
  DEPT_HEAD_COL: "deptheadid",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_departmentmst_list",
  LIST_DIVISION_ID: 0,

  SAVE_ENDPOINT: "/API/PurDepartmentMst/Post_RB_DepartmentMst_Save",
  STORAGE_HEADER_META: "dmHeaderMeta",
};
