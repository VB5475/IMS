// User Master — admin module config (MRD_Template4UserMaster.docx)

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const UM_CONFIG = {
  RB_MASTER: RB_CODES.USER_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.USER_MASTER),
  FORM_TAG: "rb_genusermst",
  TRAN_BOOK: "UM",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_genusermst",
  SP_DESIGNATION: "fn_tbl_fetch_designation",
  SP_GROUP: "fn_tbl_fetch_groupmst",
  SP_DEPARTMENT: "fn_tbl_fetch_department",
  // Takes real params (company/login/type), unlike the no-arg SPs above —
  // fetched separately in useUserMaster.js, not via the generic UM_DROPDOWN_SP map.
  SP_LOCATION: "fn_gen_fetchlocationmaster",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_genusermst_list",
  LIST_DIVISION_ID: 15,

  DELETE_PROC_NAME: "pr_rb_genusermst_delete",

  SAVE_ENDPOINT: "/API/GenUserMst/Post_RB_GenUserMst_Save",
  STORAGE_HEADER_META: "piHeaderMeta",
};
