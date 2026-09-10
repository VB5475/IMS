// constants.js — Asset Part Indent module config.
//
// 2026-08-25 /pm — brand-new, three-grid pure browse page (not the standard
// RB-driven Add/Edit pattern used elsewhere in this app): no RB code, no
// GetDetailColData were given for this module. All three fetch functions
// below return their FULL dataset for the selected filters up front — there
// is no per-row server "drill down" call, and (2026-09-09 /pm) no
// client-side selection/filtering between grids either — each grid just
// displays everything it fetched. Save posts the full currently-loaded
// Detail rows.
//
// Route is a plain, non-RB path (same pattern as "wkfmain" in App.jsx) since
// there is no RB_CODES entry to key off — flagged to the user as a deviation
// from this project's usual RB-driven routing convention.

export const APIN_CONFIG = {
  ROUTE_PATH: "/assets-part-indent",
  PAGE_TITLE: "Asset Part Indent",

  LIST_OBJ_TYPE: 2, // OBJ_TYPE.FUNCTION

  // 2026-09-09 — the original two SP names above were placeholders and don't
  // exist on the backend ("Invalid object name" live). Replaced with the
  // real SPs the user confirmed; all three take the identical 5-param
  // payload (see buildFetchParams in useAssetPartIndent.js) — item-level
  // fetch, serial-number-level detail fetch, and a location-wise part count.
  SP_MASTER_FETCH: "fn_tbl_AstItemWsPartDetail",
  SP_DETAIL_FETCH: "fn_tbl_AstSrNoWsPartDetail",
  SP_LOC_COUNT_FETCH: "fn_tbl_AstLocWsPartCount",
  // 2026-09-09 /pm — Tab 2 ("Date Group Wise Part Detail"), same 5-param
  // contract as the three above (confirmed live: errors on prmloginid same
  // as its siblings, errors on missing from/to same as its siblings). Live
  // data for it is currently empty across every division/date range tried —
  // a genuinely empty dataset in this environment, not a wiring issue.
  SP_DATE_GROUP_FETCH: "fn_tbl_AstDateGroupWsPartDetail",
  // 2026-09-10 /pm — Tab 3 ("Per chair Repairing Cost"), same 5-param
  // contract, confirmed live. Real row shape: SrNo, "PO Date", "PO Month",
  // "Asset Count", "Total Cost", "Per Asset Repairing Cost" — the "Actual/
  // Utilized/Balance Budget" columns in the user's reference are NOT part of
  // this SP's response at all (confirmed live), so they're not in the list/
  // export; that's a separate budget-tracking data source this SP doesn't
  // carry, not something this fetch is missing by mistake.
  SP_PER_CHAIR_COST_FETCH: "fn_tbl_AstDatePerAssetRepairingCost",

  // User-confirmed 2026-08-25 — takes prmYearID/prmLoginID/prmDivisionID/
  // prmMode/prmStrDetJSON only (no prmStrMstJSON — this module has no
  // separate master save). 2026-09-09 /pm — prmStrDetJSON is now the full
  // currently-loaded Matching Transactions dataset, not a checkbox subset.
  SAVE_ENDPOINT: "/API/GenIndt4PartIndt/Post_GenIndt4PartIndt_Save",
};
