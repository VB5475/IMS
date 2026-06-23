// constants.js — CWIP To FA (C2F) page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE     = "CWIP To FA";
export const PAGE_TITLE_NEW = "New CWIP To FA";

// All RB codes, SP names, IDs, and request defaults for the C2F module.
// Values aligned to MRD_Template4CWIPToFA.docx (Richa, 16-Jun-2026).

export const C2F_CONFIG = {
  // RB board codes
  RB_MASTER:      "RB_AstCWIP2FAMst",
  RB_DETAIL:      "RB_AstCWIP2FADet",
  RB_ITEM_PICKER: "RB_AstCWIP2FADetSelO",

  // Form identifiers
  FORM_TAG:   "C2F",
  TRAN_BOOK:  "C2F",

  
  CONFIG_YEAR_ID:   2,
  DIVISION_YEAR_ID: 2,

  // SP names
  SP_RB_META:      "Fn_Fetch_RBDetailByRBCode",
  SP_DIVISIONS:    "Fn_tbl_FetchUserWsDivision",
  SP_LOCATION:     "Fn_Gen_FetchLocationMaster",
  SP_CWIP_ACC:     "Fn_tbl_Fetch_AssetsAccount",
  SP_COST_CENTER:  "Fn_tbl_Fas_FetchCostCenterAc",
  SP_ITEM_PICKER:  "fn_tbl_RB_AstCWIP2FADetSel",
  SP_GRID_EVENT:   null, 
  SP_UNIQUE_ID:    "Pr_Gen_FetchLevyUniqueNo4Web",

  // Edit flow
  SP_MASTER_FILL: "fn_tbl_RB_AstCWIP2FAMst",
  SP_DETAIL_FILL: "fn_tbl_RB_AstCWIP2FADet",

  // Save endpoint (REST POST)
  SAVE_ENDPOINT: "/API/AccCWIP2FASave/Post_RB_AstCWIP2FAMst_Save",

  // Listing — SP and params confirmed by DBA
  LIST_OBJ_TYPE:    2,
  SP_LIST:          "Fn_tbl_RB_AstCWIP2FAMst_List",
  LIST_DIVISION_ID: 0,

  // localStorage keys for cached RB meta
  STORAGE_HEADER_META: "c2fHeaderMeta",
  STORAGE_ENTRY_META:  "c2fEntryMeta",

  // ConvTypeID is an internal field (API: IsVisible=false, IsEditAllow=false).
  // Sent in save payload as a fixed constant — not shown in UI.
  CONV_TYPE_ID: 1,
};

// ── ConversionFactor static options (only static dropdown in C2F header) ─────
export const C2F_CONV_FACTOR_OPTIONS = [
  { value: "1", label: "Purchase" },
  { value: "2", label: "Inventory" },
];

export const C2F_GRID_TABS = [{ id: "items", label: "Item Grid" }];

// ── Summary panel fields ──────────────────────────────────────────────────────
// detKey  — grid column key to sum across all item rows
// SummaryParameterID — master save payload key the value is written to
export const C2F_SUMMARY_FIELDS = [
  { SummaryParameterID: "NetTotal", detKey: "Amount" },
];

// Cascade resets — DivisionID clears LocationID + CWIPAccID (grid cleared in form handler)
export const C2F_FILTER_CASCADE_RESETS = {
  DivisionID: ["LocationID", "CWIPAccID"],
};

// ── Item picker required fields ───────────────────────────────────────────────
const C2F_ITEM_PICKER_REQUIRED_FIELDS = [
  { headerKey: "DivisionID",       label: "Division" },
  { headerKey: "TranDate",         label: "Tran Date",       isDate: true },
  { headerKey: "PutToUseInstDate", label: "Put To Use Date", isDate: true },
  { headerKey: "LocationID",       label: "Location" },
  { headerKey: "CWIPAccID",        label: "CWIP A/C" },
];

const MONTH_ABBR = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

export function formatC2FTranDate(dateVal) {
  if (!dateVal) return "0";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return "0";
  return `${String(d.getDate()).padStart(2,"0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

function isMissingValue(field, value) {
  if (field.isDate) return value == null || value === "" || formatC2FTranDate(value) === "0";
  if (value == null || value === "") return true;
  return Number(value) === 0 || value === "0";
}

export function getMissingItemPickerHeaderFields(headerValues) {
  return C2F_ITEM_PICKER_REQUIRED_FIELDS
    .filter((f) => isMissingValue(f, headerValues?.[f.headerKey]))
    .map((f) => f.label);
}
