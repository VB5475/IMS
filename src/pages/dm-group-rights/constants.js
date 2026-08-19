// constants.js — DMS Group Rights module config.
// MRD_Template4DMS_Grouprights.docx (28-Jul-2026).
//
// Its own "Module Overview" section is stale boilerplate copied from the
// TT2DocType MRD template ("Module Name DMS Group Master", "Purpose: Create
// Department for DMS", route "/Master – Transaction To Document Type
// Master") — none of that describes this feature. The real spec is
// Section 3 (Form Fields), Section 5.1 (RB Structure), and the embedded
// screenshot. This module: for a Group + Department, define whether
// document rights are System Defined or User Define, then grant/revoke
// Upload/View/Delete per Document Type × Document SubType combination.
//
// Architecture confirmed live 2026-07-30 (RBID 20198, single RB
// "rb_dm_groupright" drives BOTH header fields and grid-row columns —
// same one-RB-covers-everything pattern already used by the existing
// Division Wise Rights module, which this was modeled on):
//
// - Header: Group dropdown (ref_gen_groupmasterid ← fn_tbl_gen_groupmaster_list,
//   live-confirmed), Department dropdown (ref_dm_departmentid ←
//   fn_tbl_dm_department_list, live-confirmed, reused from the DMS
//   Department Master), System Defined / User Define (issystemdefine /
//   isuserdefine — two independent boolean columns; rendered as a mutually-
//   exclusive checkbox pair to match the screenshot's radio-button look,
//   enforced in the form component since the RB metadata doesn't encode
//   that exclusivity itself), and a "Get Detail" button.
// - Grid ("Get Detail" result): Document Type / Document SubType (read-only
//   display) + Upload / View / Delete (checkboxes) + a single blanket
//   "Select all" (matches the screenshot's one checkbox, not per-column).
// - Save: SAME single save endpoint as every other row — no separate
//   master/detail split. Each grid row carries the header context inline
//   (group/department/systemdefine/userdefine), same shape as Division Wise
//   Rights' own save (`prmStrMstJSON` = JSON array of rows, no `det` wrapper).
//
// CONFIRMED live (2026-07-30):
// - RBID 20198, saveprocname pr_rb_dm_groupright_save.
// - fn_tbl_gen_groupmaster_list / fn_tbl_dm_department_list both return real
//   data with no params (`[{}]`).
// - "Get Detail" REPLACED 2026-07-30 (user-supplied real signature): now
//   fn_tbl_rb_dm_groupright_getdata(@prmdepartmentid numeric(18,0),
//   @prmgroupid numeric(18,0)) — a plain 2-named-arg FUNCTION, called via
//   FN_Fetch_Data (ObjType=FUNCTION) with JSon=[{prmdepartmentid, prmgroupid}],
//   NOT GetMasterDataFill's positional-parameter mechanism the old 5-arg SP
//   used. Live-confirmed via arg-count probing on IMS_LIVE: 1 arg → "There is
//   no row at position 1." (missing binding), 3 args → "Must declare the
//   scalar variable "@prmextra"." (only 2 named params exist), exactly 2 args
//   (real department + group ids) → executes cleanly, returns `[ ]` (table is
//   still empty — brand-new feature, same as Document List's early state, not
//   a shape problem). This CORRECTS the prior conclusion below that Get Detail
//   was Group-scoped only — it's actually Department+Group scoped, matching
//   what the form's own `canGetDetail` gate already required. IMS_PGLIVE 42703
//   "column prmdepartmentid does not exist" — not deployed/synced there yet,
//   same "IMS_LIVE ahead of IMS_PGLIVE" pattern as several other DM_* additions
//   this session; non-blocking since PROD_BASE_PROJECT defaults to IMS_LIVE.
//
// Prior (now-replaced) note, kept for history: the old fn_tbl_rb_dm_groupright
// took exactly 5 positional args (companyid, yearid, loginid, sessionid,
// groupid) via GetMasterDataFill — this was believed Group-only because there
// was no room for a 6th (Department) arg. That SP is no longer called.
//
// EXCLUDED per explicit user decision 2026-07-30 (both are real, live
// columns on RBID 20198 that appear NOWHERE in the MRD's text or
// screenshot — flagged and confirmed excluded rather than guessed):
// - ref_dm_trantypeid (ColSeqNo 5, Toggle switch, visible=true)
// - ref_dm_categoryid (ColSeqNo 8, hidden)
//
// NOT YET CONFIRMED (flagged, not blocking): the exact display-name fields
// (e.g. a possible `documenttypename`/`documentsubtypename`) that
// fn_tbl_rb_dm_groupright's actual row shape returns alongside the
// doctype/subtype ids — inconclusive from live testing since the table has
// zero rows today. useDMGroupRights.js falls back defensively (id string if
// no name field is present); revisit once real saved data exists to verify.

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const DMGR_CONFIG = {
  RB_MASTER: RB_CODES.DM_GROUP_RIGHTS,
  ROUTE_PATH: rbRoutePath(RB_CODES.DM_GROUP_RIGHTS),
  FORM_TAG: RB_CODES.DM_GROUP_RIGHTS,

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  LIST_OBJ_TYPE: 2,

  SP_GROUP_LIST: "fn_tbl_gen_groupmaster_list",
  SP_DEPARTMENT_LIST: "fn_tbl_dm_department_list",

  // NEW 2026-07-30 — the System Defined / User Define checkboxes swap the
  // Department dropdown's data source (confirmed via AskUserQuestion, since
  // the two candidate functions' live responses made this the only sensible
  // reading: SystemDefined() with ZERO args returns a real, stable
  // department-shaped list — {idnumber,name}, matching fn_tbl_dm_department_
  // list's own department names minus the `code` field — while userDefined()
  // with zero args returns `[ ]` (no user-defined departments exist yet,
  // same "brand-new feature, empty table" pattern as every other DM_*
  // addition this session). Both are confirmed EXACTLY zero-arg — passing
  // prmdepartmentid/prmgroupid errors "Must declare the scalar variable"
  // regardless of which one is supplied, meaning neither param exists on
  // either function's signature.
  SP_DEPARTMENT_LIST_SYSTEM_DEFINED: "fn_tbl_fetch_rb_grouprights_SystemDefined",
  SP_DEPARTMENT_LIST_USER_DEFINED: "fn_tbl_fetch_rb_grouprights_userDefined",

  /** "Get Detail" — fetches this Department+Group's existing rights rows.
   *  UPDATED 2026-08-14 (/pm) — now a 3-named-arg FUNCTION: (prmdepartmentid,
   *  prmgroupid, prmishardcoded). prmishardcoded is the System Defined / User
   *  Define checkbox pair's selected value (System Defined=1, User Define=0)
   *  — see useDMGroupRights.js's fetchGridRows. Live-verified 2026-08-14:
   *  Group=1/Department=PURCHASE(1)/System Defined returned a full, real,
   *  populated grid (Purchase Order/Inward/QC/Indent/... rows) — the
   *  "table is still empty" note elsewhere in this file is now stale for at
   *  least this combination. */
  SP_GET_DETAIL: "fn_tbl_rb_dm_groupright_getdata",

  SAVE_ENDPOINT: "/API/DM_GroupRight/Post_RB_DM_GroupRight_Save",
  STORAGE_HEADER_META: "dmGroupRightsHeaderMeta",

  HEADER_GROUP_COL: "ref_gen_groupmasterid",
  HEADER_DEPARTMENT_COL: "ref_dm_departmentid",
  HEADER_SYSTEM_DEFINE_COL: "issystemdefine",
  HEADER_USER_DEFINE_COL: "isuserdefine",

  GRID_DOCTYPE_COL: "ref_dm_documenttypeid",
  GRID_SUBTYPE_COL: "ref_dm_documentsubtypeid",
  GRID_UPLOAD_COL: "uploaddoc",
  GRID_VIEW_COL: "viewdoc",
  GRID_DELETE_COL: "deletedoc",

  /** Header fields to render, in order — excludes ref_dm_trantypeid (see note above). */
  HEADER_COLS: ["ref_gen_groupmasterid", "ref_dm_departmentid", "issystemdefine", "isuserdefine"],
  /** Grid row fields to render, in order — excludes ref_dm_categoryid (see note above). */
  GRID_ROW_COLS: [
    "ref_dm_documenttypeid",
    "ref_dm_documentsubtypeid",
    "uploaddoc",
    "viewdoc",
    "deletedoc",
  ],
};
