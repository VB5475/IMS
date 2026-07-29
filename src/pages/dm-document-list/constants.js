// DM Document List — DMS module standalone master.
// MRD_Template4DMS_DocumentList.docx (Om, 29-Jul-2026).
//
// Two independently RB-driven grids, NOT embedded into any of the 15
// Purchase/Assets transaction forms (confirmed with user 2026-07-29 after an
// initial misread) — its own standalone master, closest in shape to
// dm-tt2doctype-master: a direct-form page, no separate list/new/edit routes
// despite the MRD listing them (matches the DMS suite's established
// precedent of dropping the list+modal shape in favor of one direct form).
//
// Grid 2 "Docs" (rb_dm_tranwisedocs, RBID 20200, live-confirmed) is the
// PRIMARY/editable grid — user adds document metadata rows here, saved via
// SAVE_ENDPOINT as prmStrMstJSON (confirmed: the MRD's own "Payload keys"
// line says exactly this, matching buildSaveJsonFields({ mst }) already used
// project-wide).
//
// Grid 1 "Reference Documents" (rb_dm_tranwiseredocs, RBID 20201) is
// READ-ONLY (its own RB columns are ALL textbox/ctrltype=1, confirmed live —
// no dropdowns at all, unlike Grid 2's ref_documenttypeid/ref_documentsubtypeid/
// ref_categoryid which are ctrltype=4). Toggled via the "Reference Documents"
// button (MRD section 5.1: "Reference Button's Click" -> SP_SHOW_DOC_LIST);
// user-confirmed 2026-07-29 this button just shows/hides Grid 1, it's not a
// picker.
//
// CONFIRMED live (2026-07-29):
// - RB_TRANDETAIL / RB_REFERENCEDETAIL RBIDs (20200 / 20201) + full column
//   sets for both.
// - SP_DOCUMENT_TYPE / SP_DOCUMENT_SUBTYPE (existing DMS list SPs, reused
//   from document-type-master / document-subtype-master) both take `[{}]`
//   (no params) and return their full catalog — no cascade filter exists
//   server-side.
// - SP_CATEGORY confirmed via the RB's own ctrlsqlsource on ref_categoryid:
//   returns a flat 5-row {category, categorytypeid} list.
//
// NOT CONFIRMED / open (flagged, not blocking):
// - SP_SHOW_DOC_LIST's exact param names. Every param combination tried live
//   returned "There is no row at position 1" (the underlying table appears
//   genuinely empty — brand-new feature, no prior saved data — so this is
//   inconclusive either way, consistent with this app's established
//   "permissive gateway" pattern for *selonly-style SPs — see
//   project_assets_item_picker_maingroup_rollout memory). Sending
//   prmtranid/prmreftrantypeid/prmrefdepartmentid (best-guess, matching the
//   RB's own hidden column names minus the "ref_" prefix) until DBA confirms.
// - Live saveprocname for RB_TRANDETAIL is `pr_rb_dm_tranwisedocs_save`, NOT
//   the name implied by the MRD's endpoint path; used the MRD's REST gateway
//   path anyway (SAVE_ENDPOINT is a route, not the underlying proc name —
//   same pattern as every other module in this app).
// - Sub Main Type's own list rows carry a `"document type"` field (the
//   matching Document Type's NAME, not id) that could cascade-filter Sub
//   Type by selected Document Type — NOT wired here: buildGridColumns'
//   dropdownOptions are per-COLUMN, not per-row, so a genuinely row-scoped
//   cascade isn't supported by the generic grid architecture used elsewhere
//   in this app. Sub Type shows the full unfiltered catalog for every row.
// - No file-upload endpoint exists anywhere in this codebase or the MRD —
//   per user direction 2026-07-29, built METADATA ONLY (Document
//   Type/SubType/Category/Title/Notes/Remarks); the Upload/View columns are
//   NOT wired to a real file transfer — flagged as a backend-dependent gap,
//   not built.

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const DM_DOCLIST_CONFIG = {
  RB_MASTER: RB_CODES.DM_DOCUMENT_LIST,
  ROUTE_PATH: rbRoutePath(RB_CODES.DM_DOCUMENT_LIST),
  FORM_TAG: RB_CODES.DM_DOCUMENT_LIST,

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  LIST_OBJ_TYPE: 2,

  /** Grid 2 — "Docs" — primary, editable, the only one that gets saved. */
  RB_TRANDETAIL: "rb_dm_tranwisedocs",
  /** Grid 1 — "Reference Documents" — read-only, shown via a toggle button. */
  RB_REFERENCEDETAIL: "rb_dm_tranwiseredocs",

  SP_DOCUMENT_TYPE: "fn_tbl_dm_documenttype_list",
  SP_DOCUMENT_SUBTYPE: "fn_tbl_dm_documentsubtype_list",
  /** Confirmed live via ref_categoryid's own ctrlsqlsource. */
  SP_CATEGORY: "fn_tbl_rb_dm_tranwisedocs_category",
  /** "Reference Button's Click" per MRD 5.1 — param names unconfirmed, see note above. */
  SP_SHOW_DOC_LIST: "fn_tbl_rb_dm_tranwisedocs_showdoclistwithid",

  SAVE_ENDPOINT: "/API/DM_Doc/Post_RB_DM_Doc_Save",
  STORAGE_HEADER_META: "dmDocListHeaderMeta",

  DOCTYPE_COL: "ref_documenttypeid",
  SUBTYPE_COL: "ref_documentsubtypeid",
  CATEGORY_COL: "ref_categoryid",
};
