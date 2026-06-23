// Field definitions are driven dynamically from GetDetailColData via useMainGroupMaster hook.
// No hardcoded field array needed here.
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const MODAL_TITLE_ADD = "New Main Group";
export const MODAL_TITLE_EDIT = "Edit Main Group";
export const MODAL_SUBTITLE  = "Admin › Master › Item › Main Group Master";


export const MGM_CONFIG = {
  RB_MASTER:           "RB_PurMainGroupMst",
  CONFIG_YEAR_ID:      2,             // ⚠️ CONFIRM with DBA
  SP_RB_META:          "Fn_Fetch_RBDetailByRBCode",
  SP_ITEM_TYPE:        "Fn_tbl_PUR_ITEMTYPEMST_Fetch",
  SP_FIXED_ASSET_ACC:  "Fn_tbl_FixedAstAcc_Fetch",
  SP_MASTER_FILL:      "fn_tbl_RB_PurMainGroupMst",
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "Fn_tbl_PurMainGroupMst_List",
  LIST_DIVISION_ID:    15,            // ⚠️ CONFIRM with DBA
  SAVE_ENDPOINT:       "/API/PurMainGroup/pr_RB_PurMainGroupMst_Save",
  STORAGE_HEADER_META: "mgmHeaderMeta",
};
