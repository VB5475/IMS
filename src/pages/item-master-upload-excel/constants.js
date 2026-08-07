// constants.js — Item Master Upload Excel (IMUE) module config.
// Same shape as Asset Item Opening Excel; RB code rb_xluplditemmst.
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Item Master Upload Excel";

export const IMUE_CONFIG = {
  /** Detail-only RB (no RB_MASTER for this module). */
  RB_DETAIL: RB_CODES.ITEM_MASTER_UPLOAD_EXCEL,
  ROUTE_PATH: rbRoutePath(RB_CODES.ITEM_MASTER_UPLOAD_EXCEL),

  FORM_TAG: "rb_xluplditemmst",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",

  // Confirmed 2026-08-07 — body: prmYearID, prmLoginID, prmDivisionID,
  // prmMode, prmStrMstJSON (uploaded rows as the master JSON array).
  SAVE_ENDPOINT: "/API/XLItmMstUpload/Post_XLUploadItemMst_Save",

  DIVISION_ID: 0,

  STORAGE_ENTRY_META: "imueEntryMeta",
};

export const IMUE_GRID_TABS = [{ id: "items", label: "Item Master Upload Detail" }];
