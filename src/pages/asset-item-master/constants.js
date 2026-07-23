// Field definitions are driven dynamically from GetDetailColData via useAssetItemMaster hook.
// No hardcoded field array needed here.
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const MODAL_TITLE_ADD = "New Asset Item";
export const MODAL_TITLE_EDIT = "Edit Asset Item";
export const MODAL_SUBTITLE  = "Account › Master › Asset Item Master";

// Live-verified 2026-06-30 against rb_astitemmst (RBID 10108): SP_RB_META,
// SP_ITEM_GROUP, SP_ACCOUNT, SP_TRAN_UNIT, SP_MASTER_FILL all confirmed live.
// SP_LIST has no live equivalent yet (every guessed name returns "Invalid
// object name") — RB save proc itself was returned as pr_rb_astitemmst_save.
export const AIM_CONFIG = {
  RB_MASTER:           RB_CODES.ASSET_ITEM_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSET_ITEM_MASTER),
  SP_RB_META:          "fn_fetch_rbdetailbyrbcode",
  SP_ITEM_GROUP:       "fn_tbl_fetch_itemgroup",
  SP_ACCOUNT:          "fn_tbl_fetch_account",
  SP_TRAN_UNIT:        "fn_tbl_fetch_tranunit",
  SP_MASTER_FILL:      "fn_tbl_rb_astitemmst",
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "fn_tbl_rb_astitemmst_list", // ⚠️ CONFIRM with DBA — not live yet
  LIST_DIVISION_ID:    15,             // ⚠️ CONFIRM with DBA
  SAVE_ENDPOINT:       "/API/AstItemMst/Post_RB_AstItemMst_Save",
  STORAGE_HEADER_META: "piHeaderMeta",
};
