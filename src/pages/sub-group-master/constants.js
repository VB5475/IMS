// Field definitions driven dynamically from GetDetailColData via useSubGroupMaster hook.

export const SGM_CONFIG = {
  RB_MASTER:           "RB_SubGroupMst",
  CONFIG_YEAR_ID:      2,              // ⚠️ CONFIRM with DBA
  SP_RB_META:          "Fn_Fetch_RBDetailByRBCode",
  SP_MASTER_FILL:      "fn_tbl_RB_SubGroupMst",
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "Fn_tbl_PurSubGroupMst_List",     // ⚠️ CONFIRM with DBA
  LIST_DIVISION_ID:    15,             // ⚠️ CONFIRM with DBA
  SAVE_ENDPOINT:       "/API/PurSubGroup/Post_RB_SubGroupMst_Save",
  STORAGE_HEADER_META: "sgmHeaderMeta",
};
