// constants.js — Company Act Depreciation (DPC) page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE     = "Company Act Depreciation";
export const PAGE_TITLE_NEW = "New Company Act Depreciation";

// Values aligned to MRD_Template4Depriciation.docx (Richa, 16-Jun-2026).

export const DPC_CONFIG = {
  // RB board codes (MRD § 5.1)
  RB_MASTER:      "rb_astdepcamst",
  RB_DETAIL:      "rb_astdepcadet",
  RB_ITEM_PICKER: "rb_astdepcadetselonl",

  // Form identifiers (MRD § 7)
  FORM_TAG:            "rb_astdepcamst",
  TRAN_BOOK:           "C2F",
  SUPPLIER_PARTY_TYPE: "S",

  // SP names (MRD § 5 / § 5.1)
  SP_RB_META:     "fn_fetch_rbdetailbyrbcode",
  SP_DIVISIONS:   "fn_tbl_fetchuserwsdivision",
  SP_ASSETS_ACC:  "fn_tbl_fetch_assetsaccount",
  SP_ITEM_PICKER: "fn_tbl_rb_astdepcadetselonl",

  // Edit flow (MRD § 5.1)
  SP_MASTER_FILL: "fn_tbl_rb_astdepcamst",
  SP_DETAIL_FILL: "fn_tbl_rb_astdepcadet",

  // Save endpoint (MRD § 7)
  SAVE_ENDPOINT: "/API/AstDepCAMstSave/Post_RB_AstDepCAMst_Save",

  // Listing (MRD § 7)
  LIST_OBJ_TYPE:    2,
  SP_LIST:          "fn_tbl_rb_astdepcamst_list",
  LIST_DIVISION_ID: 15,

  // localStorage key for cached header RB metadata (MRD § 7)
  STORAGE_HEADER_META: "piHeaderMeta",
};

export const DPC_GRID_TABS = [{ id: "items", label: "Item Grid" }];

// ── Summary panel fields ──────────────────────────────────────────────────────
// detKey = grid column to sum; SummaryParameterID = master save payload key
export const DPC_SUMMARY_FIELDS = [
  { SummaryParameterID: "totaldepamount", detKey: "depreciationvalue" },
];

// ── Cascade resets (MRD § 3) ─────────────────────────────────────────────────
// DivisionID → clear FixedAstAcID + reload; FixedAstAcID → clear grid only
export const DPC_FILTER_CASCADE_RESETS = {
  DivisionID: ["FixedAstAcID"],
};

// ── Item picker required header fields (MRD § 3) ─────────────────────────────
const DPC_ITEM_PICKER_REQUIRED_FIELDS = [
  { headerKey: "divisionid",   label: "Division" },
  { headerKey: "trandate",     label: "Tran Date", isDate: true },
  { headerKey: "fixedastacid", label: "Fixed Asset A/C" },
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
