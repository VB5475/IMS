// constants.js — Assets Item Opening (AOP) module config
// Values aligned to MRD_Template4AssetsItemOpening.docx (Richa, 16-Jun-2026).
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE     = "Assets Item Opening";
export const PAGE_TITLE_NEW = "New Assets Item Opening";

export const AOP_CONFIG = {
  // RB board codes
  RB_MASTER: "RB_AstItemOpeMst",
  RB_DETAIL: "RB_AstItemOpeDet",

  // Form identifiers
  FORM_TAG:  "RB_AstItemOpeMst",
  TRAN_BOOK: "AOP",

  CONFIG_YEAR_ID:   2,   // ⚠️ DBA CONFIRM
  DIVISION_YEAR_ID: 2,   // ⚠️ DBA CONFIRM

  // SP names
  SP_RB_META:    "Fn_Fetch_RBDetailByRBCode",
  SP_DIVISIONS:  "Fn_tbl_FetchUserWsDivision",
  SP_ITEM_GROUP: "fn_tbl_Filter_MainGroup",       // params: prmItemTypeID
  SP_ITEM:       "FN_tbl_FetchDivisionWSItem",    // params: prmDivisionID, prmItemGroupID, prmLoginID
  SP_ASSETS_ACC: "Fn_tbl_Fetch_AssetsAccount",    // params: PrmDivisionID, PrmAcMainGroupID, PrmLoginID, PrmCompanyID, PrmYearID

  // Edit flow
  SP_MASTER_FILL: "fn_tbl_RB_AstItemOpeMst",
  SP_DETAIL_FILL: "fn_tbl_RB_AstItemOpeDet",

  // Save endpoint
  SAVE_ENDPOINT: "/API/AstItemOpeMst/Post_RB_AstItemOpeMst_Save",

  // Listing
  LIST_OBJ_TYPE:    2,
  SP_LIST:          "Fn_tbl_RB_AstItemOpeMst_List",  // ⚠️ DBA CONFIRM
  LIST_DIVISION_ID: 0,                                // ⚠️ DBA CONFIRM (MRD says 15)

  // localStorage keys for cached RB meta
  STORAGE_HEADER_META: "aopHeaderMeta",
  STORAGE_ENTRY_META:  "aopEntryMeta",
};

export const AOP_GRID_TABS = [{ id: "items", label: "Item Grid" }];

// Summary panel: sums from grid rows
// ⚠️ DBA CONFIRM — verify ColName keys match RB_AstItemOpeDet API response
export const AOP_SUMMARY_FIELDS = [
  { SummaryParameterID: "PurchaseTotalAmt", detKey: "PurchaseAmount", label: "Purchase Total Amount" },
  { SummaryParameterID: "CurrentTotalAmt",  detKey: "CurrentAmount",  label: "Current Total Amount"  },
];

// Cascade resets
export const AOP_FILTER_CASCADE_RESETS = {
  DivisionID:   ["ItemGroupID", "ItemID", "AccountID"],
  ItemGroupID:  ["ItemID"],
};

// Item Type ID for Item Group SP — ⚠️ DBA CONFIRM
export const AOP_ITEM_TYPE_ID = 1;

// Item picker required header fields (gate before opening item picker)
const AOP_ITEM_PICKER_REQUIRED_FIELDS = [
  { headerKey: "DivisionID",  label: "Division" },
  { headerKey: "ItemGroupID", label: "Item Group" },
];

function isMissingValue(field, value) {
  if (value == null || value === "") return true;
  return Number(value) === 0 || value === "0";
}

export function getMissingItemPickerHeaderFields(headerValues) {
  return AOP_ITEM_PICKER_REQUIRED_FIELDS
    .filter((f) => isMissingValue(f, headerValues?.[f.headerKey]))
    .map((f) => f.label);
}
