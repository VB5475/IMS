// constants.js — Assets Depreciation (DPC) page config
// Values aligned to MRD_Template4Depriciation.docx (Richa, 16-Jun-2026).

export const DPC_CONFIG = {
  // RB board codes (MRD § 5.1)
  RB_MASTER:      "RB_AstDepCAMst",
  RB_DETAIL:      "RB_AstDepCADet",
  RB_ITEM_PICKER: "RB_AstDepCADetSelOnl",

  // Form identifiers (MRD § 7)
  FORM_TAG:            "RB_AstDepCAMst",
  TRAN_BOOK:           "C2F",
  SUPPLIER_PARTY_TYPE: "S",

  // Year IDs (MRD § 7)
  CONFIG_YEAR_ID:   2,
  DIVISION_YEAR_ID: 2,

  // SP names (MRD § 5 / § 5.1)
  SP_RB_META:     "Fn_Fetch_RBDetailByRBCode",
  SP_DIVISIONS:   "Fn_tbl_FetchUserWsDivision",
  SP_ASSETS_ACC:  "Fn_tbl_Fetch_AssetsAccount",
  SP_ITEM_PICKER: "fn_tbl_RB_AstDepCADetSelOnl",

  // Edit flow (MRD § 5.1)
  SP_MASTER_FILL: "fn_tbl_RB_AstDepCAMst",
  SP_DETAIL_FILL: "fn_tbl_RB_AstDepCADet",

  // Save endpoint (MRD § 7)
  SAVE_ENDPOINT: "/API/AstDepCAMstSave/Post_RB_AstDepCAMst_Save",

  // Listing (MRD § 7)
  LIST_OBJ_TYPE:    2,
  SP_LIST:          "Fn_tbl_RB_AstDepCAMst_List",
  LIST_DIVISION_ID: 15,

  // localStorage key for cached header RB metadata (MRD § 7)
  STORAGE_HEADER_META: "piHeaderMeta",
};

export const DPC_GRID_TABS = [{ id: "items", label: "Item Grid" }];

// ── Summary panel fields ──────────────────────────────────────────────────────
// detKey = grid column to sum; SummaryParameterID = master save payload key
export const DPC_SUMMARY_FIELDS = [
  { SummaryParameterID: "TotalDepAmount", detKey: "Amount" },
];

// ── Cascade resets (MRD § 3) ─────────────────────────────────────────────────
// DivisionID → clear FixedAstAcID + reload; FixedAstAcID → clear grid only
export const DPC_FILTER_CASCADE_RESETS = {
  DivisionID: ["FixedAstAcID"],
};

// ── Item picker required header fields (MRD § 3) ─────────────────────────────
const DPC_ITEM_PICKER_REQUIRED_FIELDS = [
  { headerKey: "DivisionID",   label: "Division" },
  { headerKey: "TranDate",     label: "Tran Date", isDate: true },
  { headerKey: "FixedAstAcID", label: "Fixed Asset A/C" },
];

function isMissingValue(field, value) {
  if (field.isDate) return value == null || value === "";
  if (value == null || value === "") return true;
  return Number(value) === 0 || value === "0";
}

export function getMissingItemPickerHeaderFields(headerValues) {
  return DPC_ITEM_PICKER_REQUIRED_FIELDS
    .filter((f) => isMissingValue(f, headerValues?.[f.headerKey]))
    .map((f) => f.label);
}
