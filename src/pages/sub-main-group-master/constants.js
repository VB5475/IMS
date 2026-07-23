// Field definitions driven dynamically from GetDetailColData via useSubMainGroupMaster hook.
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const MODAL_TITLE_ADD = "New Sub Main Group";
export const MODAL_TITLE_EDIT = "Edit Sub Main Group";
export const MODAL_SUBTITLE  = "Admin › Master › Item › Sub Main Group Master";


export const SMGM_CONFIG = {
  RB_MASTER:           RB_CODES.SUB_MAIN_GROUP_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.SUB_MAIN_GROUP_MASTER),
  SP_RB_META:          "fn_fetch_rbdetailbyrbcode",
  SP_ITEM_TYPE:        "fn_tbl_pur_itemtypemst_fetch",
  SP_MAIN_GROUP:       "fn_tbl_filter_maingroup",        // dynamic — takes @prmItemTypeID
  SP_FIXED_ASSET_ACC:  "fn_tbl_fixedastacc_fetch",
  SP_MASTER_FILL:      "fn_tbl_rb_submaingroupmst",
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "fn_tbl_pursubmaingroupmst_list", // ⚠️ CONFIRM with DBA
  LIST_DIVISION_ID:    15,             // ⚠️ CONFIRM with DBA
  DELETE_PROC_NAME:    "pr_rb_submaingroupmst_delete",
  SAVE_ENDPOINT:       "/API/PurSubMainGroup/Post_RB_SubMainGroupMst_Save",
  STORAGE_HEADER_META: "smgmHeaderMeta",
};
