// Field definitions driven dynamically from GetDetailColData via useSubGroupMaster hook.
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const MODAL_TITLE_ADD = "New Sub Group";
export const MODAL_TITLE_EDIT = "Edit Sub Group";
export const MODAL_SUBTITLE  = "Admin › Master › Item › Sub Group Master";


export const SGM_CONFIG = {
  RB_MASTER:           "rb_subgroupmst",
  SP_RB_META:          "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL:      "fn_tbl_rb_subgroupmst",
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "fn_tbl_pursubgroupmst_list",     // ⚠️ CONFIRM with DBA
  LIST_DIVISION_ID:    15,             // ⚠️ CONFIRM with DBA
  DELETE_PROC_NAME:    "pr_rb_subgroupmst_delete",
  SAVE_ENDPOINT:       "/API/PurSubGroup/Post_RB_SubGroupMst_Save",
  STORAGE_HEADER_META: "sgmHeaderMeta",
};
