// constants.js — CWIP To FA (C2F) page config
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import { getMissingMandatoryHeaderLabels } from "../../utils/columnValidation";

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

  // Asset Item dropdown (Item Master, only relevant when ConvTypeID = Single
  // Asset) — /pm 2026-08-27. DBA-confirmed signature (2026-08-27):
  // (prmcompanyid, prmdivisionid, prmyearid, prmloginid, prmmaingroupid,
  // prmsubmaingroupid) — no Location/CWIP A/C/date params, so the dropdown
  // is Division-scoped only. This form has no Main Group/Sub Main Group
  // selector; live-verified prmmaingroupid=0/prmsubmaingroupid=0 returns the
  // full division-wide item list ("no filter"), not an error.
  SP_ASSET_ITEM:   "fn_fetch_assetitem",

  // Edit flow
  SP_MASTER_FILL: "fn_tbl_rb_astcwip2famst",
  SP_DETAIL_FILL: "fn_tbl_rb_astcwip2fadet",

  // Save endpoint (REST POST)
  SAVE_ENDPOINT: "/API/AccCWIP2FASave/Post_RB_AstCWIP2FAMst_Save",

  // Listing — SP and params confirmed by DBA
  LIST_OBJ_TYPE:    2,
  SP_LIST:          "fn_tbl_rb_astcwip2famst_list",
  LIST_DIVISION_ID: 0,

  DELETE_PROC_NAME: "pr_rb_astcwip2famst_delete",

  // localStorage keys for cached RB meta
  STORAGE_HEADER_META: "c2fHeaderMeta",
  STORAGE_ENTRY_META:  "c2fEntryMeta",

  // NOT a UI default — ConvTypeID has 2+ real options (C2F_CONVERSION_TYPE_OPTIONS)
  // so per this app's rule it starts unselected, same as Division/Location.
  // Used only as a graceful-degradation fallback ("Each Line Item to Asset")
  // in a couple of edit-mode/save-payload spots that shouldn't ever actually
  // hit it in practice (the field is mandatory, so it's always real by then).
  CONV_TYPE_ID: 1,
};

// ── ConversionType static options (2026-08-27 /pm — RB now renders ConvTypeID
// as a real, mandatory header dropdown; the old ConversionFactor field this
// used to describe no longer exists in the RB response) ─────────────────────
export const C2F_CONVERSION_TYPE_OPTIONS = [
  { value: "1", label: "Each Line Item to Asset" },
  { value: "2", label: "Single Asset from all Line Items" },
];

/** ConvTypeID value that enables the Asset Item dropdown (sourced from Item Master). */
export const C2F_SINGLE_ASSET_CONV_TYPE = "2";

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

/** Select Item gate — mandatory fields come only from GET_DETAIL_COL_DATA (IsMandatory + IsVisible). */
export function getMissingItemPickerHeaderFields(headerValues, headerColumns = null) {
  return getMissingMandatoryHeaderLabels(headerValues, headerColumns);
}
