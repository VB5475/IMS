// constants.js — Asset Item Opening Excel (AIME) module config
// Values aligned to MRD_Template4AssetItemOpeningExcel.docx (Om, 24-Jun-2026).
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Asset Item Opening Excel";
export const PAGE_TITLE_NEW = "New Asset Item Opening Excel";

export const AIME_CONFIG = {
  RB_DETAIL: "rb_assetitmopnexl",

  FORM_TAG: "rb_assetitmopnexl",
  TRAN_BOOK: "AI",

  CONFIG_YEAR_ID: 2, // ⚠️ DBA CONFIRM
  DIVISION_YEAR_ID: 2, // ⚠️ DBA CONFIRM

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_DIVISIONS: "fn_tbl_fetchuserwsdivision",

  SAVE_ENDPOINT: "/API/assetitmopnexl/Post_RB_assetitmopnexl_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_assetitmopnexl_list", // ⚠️ DBA CONFIRM
  LIST_DIVISION_ID: 0,

  // ⚠️ DBA CONFIRM — no confirmed delete proc in the backend registry for this
  // module; guessed from the RB_DETAIL naming convention pending DBA sign-off.
  DELETE_PROC_NAME: "pr_rb_assetitmopnexl_delete",

  STORAGE_ENTRY_META: "aimeEntryMeta",
};

export const AIME_GRID_TABS = [{ id: "items", label: "Asset Item Opening Detail" }];
