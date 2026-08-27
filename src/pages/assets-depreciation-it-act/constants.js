// constants.js — Assets Calculate Depreciation IT Act (DPC) page config
//
// Source: docs/module-requirements/24-08-2026/MRD_Template4DepriciationITAct.docx.
//
// Closest existing precedent in this codebase: src/pages/assets-depreciation/
// (RB rb_astdepcamst, "Company Act Depreciation") — same header shape
// (Division → Fixed Asset A/C cascade, same fn_tbl_fetch_assetsaccount SP),
// same item-picker pattern (RB *detselonl popup), same save-payload shape.
// This module is that module's "IT Act" sibling per the MRD's own field/SP
// tables — modeled directly on it (see useAstDepIT.js / AssetsDepreciationITActForm.jsx),
// with Transporter Master's constants.js used as the style guide for how
// this project documents MRD gaps below.
//
// ⚠️ MRD gaps / decisions — CONFIRM every one of these with BA/DBA:
//
//   - Module-code / identifier collision (not flagged by the MRD itself):
//     this MRD's own "Module Code" is "DPC" — but "DPC" is ALREADY this
//     codebase's established shorthand for the unrelated, pre-existing
//     src/pages/assets-depreciation/ module ("Company Act Depreciation":
//     DPC_CONFIG, "dpc-" CSS class prefix, useAstDepCA.js's own [DPC] log
//     tags, "dpcEntryMeta" storage key). Reusing "DPC" as THIS module's own
//     code-level identifier prefix would not cause a runtime collision (JS
//     module scope keeps the two DPC_CONFIG exports apart), but would be
//     seriously confusing to grep/maintain — two different modules both
//     informally called "DPC" in source. Using "DIT" ("Depreciation IT Act",
//     matches TRAN_BOOK below) as this module's own identifier/CSS-class
//     prefix instead (DIT_CONFIG, "dit-" classes, useAstDepIT.js, [DIT] log
//     tags). FORM_TAG's runtime *value* is still the literal "DPC" string
//     below, exactly as instructed — that's a save-payload string, not a
//     code identifier, and carries no collision risk (verified no existing
//     save payload in this app sends FORM_TAG "DPC" — the sibling module's
//     own FORM_TAG was never fixed off the full RB name, see its constants.js).
//   - FORM_TAG: MRD literally repeats RB_MASTER ("rb_astdepitmst") but its own
//     row description calls it a "short module tag" — every real module in
//     this app uses a short 2-4 letter tag (PO, IND, PV, TM, DOP). Using the
//     MRD's own top-of-doc Module Code, "DPC", as instructed (see collision
//     note above for why the surrounding code still uses "DIT" as its prefix).
//   - CONFIG_YEAR_ID / DIVISION_YEAR_ID: MRD flags both CONFIRM but never wires
//     either to any field or API call (same as DOP Master's and Transporter
//     Master's own MRDs, which flagged the identical pair) — dropped as dead
//     code rather than kept as meaningless static placeholders, matching TM.
//   - SUPPLIER_PARTY_TYPE="S": no supplier picker anywhere in this MRD's
//     screen design (same as Transporter Master's own MRD) — kept in case
//     some backend SP consumes it, but not wired to anything. CONFIRM with
//     BA/DBA what (if anything) actually reads this.
//   - SP_LIST: MRD gives the SP in PascalCase
//     ("Fn_tbl_rb_astdepitmst_List") — lowercased per this app's SP-naming
//     convention (every other SP_LIST in this codebase is lowercase, e.g.
//     fn_tbl_rb_transportermst_list, fn_tbl_rb_astdepcamst_list). Its full
//     signature takes 7 params (company/division/login/year/fromdate/
//     todate/accountid) — buildListParams() below sends all 7. Transporter
//     Master's own constants.js documents a real, DBA-confirmed bug where an
//     MRD-implied SP_LIST call only sent half its params; not repeating that
//     mistake here.
//   - LIST_DIVISION_ID: MRD leaves this unset ("-"). No session field exists
//     to source a single "list" division from dynamically — following the
//     same static-value convention Transporter Master (and ~55 other list
//     pages, including the sibling assets-depreciation module) already use:
//     hardcoded 15.
//   - STORAGE_HEADER_META: MRD says "piHeaderMeta" — an unedited leftover
//     from the Purchase Indent MRD template example (Purchase Indent's own
//     constants.js really does use "piHeaderMeta" — reusing it here would
//     collide with Purchase Indent's cached header metadata in localStorage
//     across the whole app). Renamed to "dpcHeaderMeta" / "dpcDetailMeta" as
//     instructed — see the identifier-collision note above for why these two
//     storage-key STRINGS use the literal "dpc" spelling while every JS
//     identifier around them uses "DIT": these are plain localStorage key
//     strings (not code identifiers), verified via grep to not collide with
//     any key currently in use (the sibling assets-depreciation module never
//     got its own STORAGE_HEADER_META fixed off "piHeaderMeta", and its
//     detail meta key, "dpcEntryMeta", is spelled differently from
//     "dpcDetailMeta" here) — same class of MRD-template-leftover mistake
//     DOP Master and Transporter Master's own constants.js both already
//     document for their own STORAGE_HEADER_META.
//   - SAVE_ENDPOINT: MRD gives one consistent path throughout
//     ("/API/AstDepItMstSave/Post_RB_AstDepItMst_Save") — used verbatim.
//   - Save payload detail-rows key: MRD explicitly says prmStrDetJSON (this
//     app's usual default, unlike Transporter Master's non-standard
//     prmStrConsigneeJSON) — buildSaveJsonFields' plain `det:` param already
//     produces this key, no override needed.
//   - Total Dep Amount (totaldepamount): MRD's header field table marks this
//     Required=Yes, ReadOnly=No — a plain user-editable field, unlike the
//     sibling assets-depreciation module where the equivalent field is a
//     read-only EnterpriseSummaryPanel-computed sum (excluded from the
//     header filter list entirely, see DPC_SUMMARY_FIELDS there). This MRD
//     never describes a formula for it (the Business Rules section is an
//     empty template placeholder) — rendered here as an ordinary RB-driven
//     header field like Remarks, not wired to any grid-sum. CONFIRM with
//     BA/DBA whether a running total was actually intended and just never
//     made it into this MRD's (empty) Business Rules section.
//   - Item grid Amount = Qty × Rate: MRD states this explicitly as a formula
//     (unlike Total Dep Amount above) but gives no SP_GRID_EVENT — computed
//     purely client-side via EntryGrid's onCellEvent, the same pattern
//     already used by every other Assets module with a Qty/Rate/Amount grid
//     (AssetsWriteOffForm.jsx, AssetsEmployeeIssueForm.jsx, etc. — see
//     DIT_EVENT_COLUMNS below). Assumes the live RB's Qty/Rate/Amount
//     colnames are lowercase "qty"/"rate"/"amount", matching this app's
//     established colname casing convention (every other module's columns
//     are lowercase, e.g. divisionid, fixedastacid) — CONFIRM live once the
//     real RB metadata is available.
//   - Item grid "Remarks" colname: MRD's field table gives the Key as
//     "Remarks" (capitalized) but this grid is fully RB-driven/dynamic — its
//     real colname is whatever rb_astdepitdet's live metadata returns.
//     Assumed lowercase "remarks" for the same reason as Qty/Rate/Amount
//     above; no special handling needed either way since the grid renders
//     purely from live column metadata.

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Calculate Depreciation IT Act";
export const PAGE_TITLE_NEW = "New Depreciation IT Act";

export const DIT_CONFIG = {
  RB_MASTER: RB_CODES.ASSETS_DEPRECIATION_IT_ACT,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSETS_DEPRECIATION_IT_ACT),

  RB_DETAIL: "rb_astdepitdet",
  RB_ITEM_PICKER: "rb_astdepitdetselonl",

  FORM_TAG: "DPC", // Per MRD's top-of-doc Module Code, as instructed — see collision note above
  TRAN_BOOK: "DIT",

  // Unused for now — no corresponding field in this MRD's screen design.
  // CONFIRM with BA/DBA what (if anything) consumes this.
  SUPPLIER_PARTY_TYPE: "S",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_DIVISIONS: "fn_tbl_fetchuserwsdivision",
  SP_ASSETS_ACC: "fn_tbl_fetch_assetsaccount",
  SP_ITEM_PICKER: "fn_tbl_rb_astdepitdetselonl",

  // Edit flow
  SP_MASTER_FILL: "fn_tbl_rb_astdepitmst",
  SP_DETAIL_FILL: "fn_tbl_rb_astdepitdet",

  SAVE_ENDPOINT: "/API/AstDepItMstSave/Post_RB_AstDepItMst_Save",

  // localStorage keys for cached RB metadata — see STORAGE_HEADER_META note above.
  STORAGE_HEADER_META: "dpcHeaderMeta",
  STORAGE_DETAIL_META: "dpcDetailMeta",

  LIST_OBJ_TYPE: 2, // OBJ_TYPE.FUNCTION
  SP_LIST: "fn_tbl_rb_astdepitmst_list", // CONFIRM — MRD gave PascalCase, lowercased per convention
  LIST_DIVISION_ID: 15, // CONFIRM — MRD left this unset ("-"), static value per this app's convention
};

// Cleared when Division changes (Fixed Account cascades from it); the item
// grid is cleared/reloaded on EITHER field changing, per the MRD's cascade
// notes — handled directly in AssetsDepreciationITActForm's handleFilterChange
// (mirrors the sibling assets-depreciation module's DPC_FILTER_CASCADE_RESETS).
export const DIT_FILTER_CASCADE_RESETS = {
  divisionid: ["fixedastacid"],
};

// Item-grid columns that fire EntryGrid's onCellEvent on blur — client-side
// Amount = Qty × Rate (no SP_GRID_EVENT in the MRD). See constants.js header
// note above for the lowercase-colname assumption.
export const DIT_EVENT_COLUMNS = new Set(["qty", "rate"]);

export const DIT_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const DIT_SHORTCUT_CONFIG = {
  a: { label: "Add", title: "Add (Alt+A)" },
  s: { label: "Save", title: "Save (Alt+S)" },
  n: { label: "Cancel", title: "Cancel (Alt+N)" },
};
