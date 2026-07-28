// constants.js — CWIP To FA (C2F) page config
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE     = "CWIP To FA";
export const PAGE_TITLE_NEW = "New CWIP To FA";

// All RB codes, SP names, IDs, and request defaults for the C2F module.
// Values aligned to MRD_Template4CWIPToFA.docx (Richa, 16-Jun-2026).

/** Item-grid column that supports multi-value paste (Serial Number replication). */
export const C2F_MULTI_PASTE_COLUMNS = new Set(["batchsrno"]);

export const C2F_CONFIG = {
  // RB board codes
  RB_MASTER:      RB_CODES.CWIP_TO_FA,
  ROUTE_PATH: rbRoutePath(RB_CODES.CWIP_TO_FA),
  RB_DETAIL:      "rb_astcwip2fadet",
  RB_ITEM_PICKER: "rb_astcwip2fadetselo",

  // Form identifiers
  FORM_TAG:   "C2F",
  TRAN_BOOK:  "C2F",
  FRM_TYPE:   "C2F",

  // SP names
  SP_RB_META:      "fn_fetch_rbdetailbyrbcode",
  SP_DIVISIONS:    "fn_tbl_fetchuserwsdivision",
  SP_LOCATION:     "fn_gen_fetchastisslocationmaster",
  SP_CWIP_ACC:     "fn_tbl_fetch_assetsaccount",
  SP_COST_CENTER:  "fn_tbl_fas_fetchcostcenterac",
  SP_ITEM_PICKER:  "fn_tbl_rb_astcwip2fadetsel",
  SP_GRID_EVENT:   null,
  SP_UNIQUE_ID:    "pr_gen_fetchlevyuniqueno4web",

  // Edit flow
  SP_MASTER_FILL: "fn_tbl_rb_astcwip2famst",
  SP_DETAIL_FILL: "fn_tbl_rb_astcwip2fadet",

  // Save endpoint (REST POST)
  SAVE_ENDPOINT: "/API/AccCWIP2FASave/Post_RB_AstCWIP2FAMst_Save",

  // Listing — SP and params confirmed by DBA
  LIST_OBJ_TYPE:    2,
  SP_LIST:          "fn_tbl_rb_astcwip2famst_list",
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
  { SummaryParameterID: "nettotal", detKey: "netamount" },
];

// Cascade resets — DivisionID clears LocationID + CWIPAccID (grid cleared in form handler)
export const C2F_FILTER_CASCADE_RESETS = {
  DivisionID: ["LocationID", "CWIPAccID"],
};

// ── Item picker required fields ───────────────────────────────────────────────
const C2F_ITEM_PICKER_REQUIRED_FIELDS = [
  { headerKey: "divisionid",       label: "Division" },
  { headerKey: "trandate",         label: "Tran Date",       isDate: true },
  { headerKey: "puttouseinstdate", label: "Put To Use Date", isDate: true },
  { headerKey: "locationid",       label: "Location" },
  { headerKey: "cwipaccid",        label: "CWIP A/C" },
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
