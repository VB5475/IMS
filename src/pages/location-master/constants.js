// Field definitions are driven dynamically from GetDetailColData via useLocationMaster hook.
// No hardcoded field array needed here.

export const LM_CONFIG = {
  RB_MASTER:           "RB_GenLocationMst",
  CONFIG_YEAR_ID:      2,              // ⚠️ CONFIRM with DBA
  SP_RB_META:          "Fn_Fetch_RBDetailByRBCode",
  SP_LOCATION_TYPE:    "Fn_tbl_Fetch_LocationType",
  SP_PREMISES:         "Fn_tbl_Fetch_Premises",
  SP_MASTER_FILL:      "fn_tbl_RB_GenLocationMst",
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "Fn_tbl_Gen_LocationMst_List", // ⚠️ CONFIRM with DBA
  LIST_DIVISION_ID:    15,             // ⚠️ CONFIRM with DBA
  SAVE_ENDPOINT:       "/API/Gen_LocationMst/Post_RB_GenLocationMst_Save",
  STORAGE_HEADER_META: "piHeaderMeta",
};
