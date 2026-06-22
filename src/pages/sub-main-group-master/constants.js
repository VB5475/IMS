// Field definitions driven dynamically from GetDetailColData via useSubMainGroupMaster hook.

export const SMGM_CONFIG = {
  RB_MASTER:           "RB_SubMainGroupMst",
  CONFIG_YEAR_ID:      2,              // ⚠️ CONFIRM with DBA
  SP_RB_META:          "Fn_Fetch_RBDetailByRBCode",
  SP_ITEM_TYPE:        "Fn_tbl_PUR_ITEMTYPEMST_Fetch",
  SP_MAIN_GROUP:       "fn_tbl_Filter_MainGroup",        // dynamic — takes @prmItemTypeID
  SP_FIXED_ASSET_ACC:  "Fn_tbl_FixedAstAcc_Fetch",
  SP_MASTER_FILL:      "fn_tbl_RB_SubMainGroupMst",
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "Fn_tbl_PurSubMainGroupMst_List", // ⚠️ CONFIRM with DBA
  LIST_DIVISION_ID:    15,             // ⚠️ CONFIRM with DBA
  SAVE_ENDPOINT:       "/API/PurSubMainGroup/Post_RB_SubMainGroupMst_Save",
  STORAGE_HEADER_META: "smgmHeaderMeta",
};
