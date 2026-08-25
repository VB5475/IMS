// constants.js — Asset Part Indent module config.
//
// 2026-08-25 /pm — brand-new, two-grid browse-then-select page (not the
// standard RB-driven Add/Edit pattern used elsewhere in this app): no RB
// code, no GetDetailColData were given for this module. Both fetch functions
// below return their FULL dataset for the selected filters up front — there
// is no per-row server "drill down" call. Selecting a Master grid row
// filters the already-loaded Detail grid rows client-side by matching BOTH
// masteritemid AND detailitemid (see masterRowKey/filteredDetailRows in
// AssetPartIndentPage.jsx). Save posts the currently-selected (checkbox)
// Detail rows only — prmStrDetJSON is "selected rows array objects" per the
// user's own API spec, not the full filtered set.
//
// Route is a plain, non-RB path (same pattern as "wkfmain" in App.jsx) since
// there is no RB_CODES entry to key off — flagged to the user as a deviation
// from this project's usual RB-driven routing convention.

export const APIN_CONFIG = {
  ROUTE_PATH: "/assets-part-indent",
  PAGE_TITLE: "Asset Part Indent",

  LIST_OBJ_TYPE: 2, // OBJ_TYPE.FUNCTION

  SP_MASTER_FETCH: "fn_tbl_AssetPartMst_fetch",
  SP_DETAIL_FETCH: "fn_tbl_AssetPartDet_fetch",

  // User-confirmed 2026-08-25 — takes prmYearID/prmLoginID/prmDivisionID/
  // prmMode/prmStrDetJSON only (no prmStrMstJSON — this module has no
  // separate master save, only the selected transaction rows).
  SAVE_ENDPOINT: "/API/GenIndt4PartIndt/Post_GenIndt4PartIndt_Save",
};

export const APIN_MASTER_KEY_FIELDS = ["masteritemid", "detailitemid"];
