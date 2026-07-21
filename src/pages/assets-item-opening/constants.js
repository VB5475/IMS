// constants.js — Assets Item Opening (AOP) module config
// Values aligned to MRD_Template4AssetsItemOpening.docx (Richa, 16-Jun-2026).
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE     = "Assets Item Opening";
export const PAGE_TITLE_NEW = "New Assets Item Opening";

/** Item-grid column that supports multi-value paste (Serial Number replication). */
export const AOP_MULTI_PASTE_COLUMNS = new Set(["batchsrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const AOP_REMARK_COLUMNS = new Set(["remark"]);

export const AOP_CONFIG = {
  // RB board codes
  RB_MASTER: "rb_astitemopemst",
  RB_DETAIL: "rb_astitemopedet",

  // Form identifiers
  FORM_TAG:  "rb_astitemopemst",
  TRAN_BOOK: "AOP",

  // SP names
  SP_RB_META:    "fn_fetch_rbdetailbyrbcode",
  SP_DIVISIONS:  "fn_tbl_fetchuserwsdivision",
  SP_ITEM_GROUP: "fn_tbl_filter_maingroup",       // params: prmItemTypeID
  SP_ITEM:       "fn_tbl_fetchdivisionwsitem",    // params: prmDivisionID, prmItemGroupID, prmLoginID
  SP_ASSETS_ACC: "fn_tbl_fetch_assetsaccount",    // params: PrmDivisionID, PrmAcMainGroupID, PrmLoginID, PrmCompanyID, PrmYearID

  // Edit flow
  SP_MASTER_FILL: "fn_tbl_rb_astitemopemst",
  SP_DETAIL_FILL: "fn_tbl_rb_astitemopedet",

  // Save endpoint
  SAVE_ENDPOINT: "/API/AstItemOpeMst/Post_RB_AstItemOpeMst_Save",

  // Listing
  LIST_OBJ_TYPE:    2,
  SP_LIST:          "fn_tbl_rb_astitemopemst_list",  // ⚠️ DBA CONFIRM
  LIST_DIVISION_ID: 0,                                // ⚠️ DBA CONFIRM (MRD says 15)

  DELETE_PROC_NAME: "pr_rb_astitemopemst_delete",

  // localStorage keys for cached RB meta
  STORAGE_HEADER_META: "aopHeaderMeta",
  STORAGE_ENTRY_META:  "aopEntryMeta",
};

export const AOP_GRID_TABS = [{ id: "items", label: "Item Grid" }];

// Summary panel: sums from grid rows
// detKey verified against live RB_AstItemOpeDet API response (puramount/curramount).
// ⚠️ DBA CONFIRM — RB_AstItemOpeMst has no matching master column for either total today
// (PurchaseTotalAmt/CurrentTotalAmt are not real columns), so these totals display but
// are not persisted on save until the master schema adds them.
export const AOP_SUMMARY_FIELDS = [
  { SummaryParameterID: "PurchaseTotalAmt", detKey: "puramount", label: "Purchase Total Amount" },
  { SummaryParameterID: "CurrentTotalAmt",  detKey: "curramount",  label: "Current Total Amount"  },
];

// Cascade resets
export const AOP_FILTER_CASCADE_RESETS = {
  DivisionID:   ["ItemGroupID", "ItemID", "AccountID"],
  ItemGroupID:  ["ItemID"],
};

// Item Type ID for Item Group SP — ⚠️ DBA CONFIRM
export const AOP_ITEM_TYPE_ID = 7;

// Item picker required header fields (gate before opening item picker)
const AOP_ITEM_PICKER_REQUIRED_FIELDS = [
  { headerKey: "divisionid",  label: "Division" },
  { headerKey: "itemgroupid", label: "Item Group" },
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
