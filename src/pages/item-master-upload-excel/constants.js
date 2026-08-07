// constants.js — Item Master Upload Excel (IMUE) module config.
// Same shape as Asset Item Opening Excel; RB code rb_xluplditemmst.
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Item Master Upload Excel";
export const PAGE_TITLE_NEW = "New Item Master Upload Excel";

export const IMUE_CONFIG = {
  /** Detail-only RB (no RB_MASTER for this module). */
  RB_DETAIL: RB_CODES.ITEM_MASTER_UPLOAD_EXCEL,
  ROUTE_PATH: rbRoutePath(RB_CODES.ITEM_MASTER_UPLOAD_EXCEL),

  FORM_TAG: "rb_xluplditemmst",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",

  // Gateway path follows the RB / sibling Asset Item Opening Excel convention.
  SAVE_ENDPOINT: "/API/xluplditemmst/Post_RB_xluplditemmst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_xluplditemmst_list", // ⚠️ DBA CONFIRM
  LIST_DIVISION_ID: 0,

  // ⚠️ DBA CONFIRM — guessed from RB_DETAIL naming pending DBA sign-off.
  DELETE_PROC_NAME: "pr_rb_xluplditemmst_delete",

  STORAGE_ENTRY_META: "imueEntryMeta",
};

export const IMUE_GRID_TABS = [{ id: "items", label: "Item Master Upload Detail" }];
