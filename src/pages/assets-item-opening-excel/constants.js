// constants.js — Asset Item Opening Excel (AIME) module config
// Values aligned to MRD_Template4AssetItemOpeningExcel.docx (Om, 24-Jun-2026).
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Asset Item Opening Excel";

export const AIME_CONFIG = {
  /** Detail-only RB (no RB_MASTER for this module). */
  RB_DETAIL: RB_CODES.ASSETS_ITEM_OPENING_EXCEL,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSETS_ITEM_OPENING_EXCEL),

  FORM_TAG: "rb_assetitmopnexl",
  TRAN_BOOK: "AI",

  CONFIG_YEAR_ID: 2, // ⚠️ DBA CONFIRM
  DIVISION_YEAR_ID: 2, // ⚠️ DBA CONFIRM

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_DIVISIONS: "fn_tbl_fetchuserwsdivision",

  SAVE_ENDPOINT: "/API/XLAssetItmOpnUpload/Post_XLUploadAstItemOpn_Save",

  STORAGE_ENTRY_META: "aimeEntryMeta",
};

export const AIME_GRID_TABS = [{ id: "items", label: "Asset Item Opening Detail" }];
