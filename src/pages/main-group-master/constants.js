// Field definitions are driven dynamically from GetDetailColData via useMainGroupMaster hook.
// No hardcoded field array needed here.
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const MODAL_TITLE_ADD = "New Main Group";
export const MODAL_TITLE_EDIT = "Edit Main Group";
export const MODAL_SUBTITLE  = "Admin › Master › Item › Main Group Master";


export const MGM_CONFIG = {
  RB_MASTER:           RB_CODES.MAIN_GROUP_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.MAIN_GROUP_MASTER),
  SP_RB_META:          "fn_fetch_rbdetailbyrbcode",
  SP_ITEM_TYPE:        "fn_tbl_pur_itemtypemst_fetch",
  SP_FIXED_ASSET_ACC:  "fn_tbl_fixedastacc_fetch",
  SP_MASTER_FILL:      "fn_tbl_rb_purmaingroupmst",
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "fn_tbl_purmaingroupmst_list",
  LIST_DIVISION_ID:    15,            // ⚠️ CONFIRM with DBA
  DELETE_PROC_NAME:    "pr_rb_purmaingroupmst_delete",
  SAVE_ENDPOINT:       "/API/PurMainGroup/pr_RB_PurMainGroupMst_Save",
  STORAGE_HEADER_META: "mgmHeaderMeta",
};
