// Transaction To Document Type Master — DMS module config
// (MRD_Template4DMS_DocumentTransactionToDocument.docx, Om, 24-Jun-2026).
// Maps a Tran Type to a Document Type. Header fields per LIVE RB metadata
// (rb_dm_tt2doctype, RBID 20195), verified against IMS_LIVE 2026-07-28.
//
// All open MRD gaps resolved live with Om, 2026-07-28 (items 1/4/5/7/8 hold;
// items 2/3/6 were SUPERSEDED by what the live RB metadata actually returned
// — see the 2026-07-28 live-verification addendum below):
//   1. Document Type IS a Textbox (per Form Fields table) — confirmed: live
//      RB has it as ColCtrlType=1 (Textbox).
//   2. SUPERSEDED — see addendum #A below. There is no Department dropdown
//      column in the live RB at all.
//   3. SUPERSEDED — see addendum #B below. LIST_DIVISION_ID is moot until
//      the list SP itself is confirmed (addendum #C).
//   4. STORAGE_HEADER_META kept verbatim as "piHeaderMeta" per Om's explicit
//      instruction ("use own as it is"), despite the collision risk with
//      Purchase Inquiry's own key of the same name — both only hold
//      transient {RBID, SaveProcName} metadata re-fetched on every mount,
//      so a same-tab collision just means whichever module loaded last
//      "wins" briefly until the other re-fetches — low practical risk.
//   5. No additional business rules beyond RB-driven validation.
//   6. SUPERSEDED — see addendum #A below. Field id is ref_documenttypeid,
//      not doctypeid.
//   7. SAVE_ENDPOINT's "DM_DM" is intentional, not a typo — used verbatim.
//   8. No extra fields beyond what the live RB returns (3 real columns).
//
// ── 2026-07-28 live-verification addendum (⚠️ CONFIRM with Om/DBA) ──
//   A. Live RB (GetDetailColData, RBID 20195) returns exactly 3 visible
//      columns, and neither matches the MRD's "Department dropdown ->
//      Document Type textbox -> Check" shape:
//        - departmentid   ColCtrlType=4 (Dropdown), but DisplayName="Is active"
//        - ref_documenttypeid  ColCtrlType=1 (Textbox), DisplayName="Document Type"
//        - ref_trantypeid ColCtrlType=4 (Dropdown), DisplayName="Tran Type"
//      There is no column whose live displayname is "Department" — the
//      column literally named `departmentid` is configured/labeled as an
//      "Is active" toggle-style dropdown instead. This looks like an RB
//      config defect (mislabeled/rewired column), not an intentional
//      design change, but per user direction (2026-07-28) we build strictly
//      to what live RB renders rather than the MRD's assumed shape. The
//      field is rendered here as "Is active" with a static Yes/No option
//      list (no ctrlsqlsource given in RB — DBA should confirm whether this
//      should instead resolve to fn_tbl_dm_department_list once the RB
//      config is fixed).
//   B. fn_tbl_fetch_trantype(@prmdepartmentid) DOES genuinely filter by real
//      department (tested against all 10 live fn_tbl_dm_department_list
//      department ids — each returns a distinct, department-relevant tran
//      type set; @prmdepartmentid=0 or -1 returns an empty list; there is
//      no unscoped "all tran types" SP variant). Since the live RB has no
//      real Department selector (see addendum A), Tran Type options are
//      populated here by fetching once per known department and merging +
//      de-duping the results (see useDMTT2DocTypeMaster.fetchAllTranTypeOptions).
//      This keeps the dropdown genuinely populated without inventing a new
//      backend endpoint, but it's a workaround, not a true fix — once Om/DBA
//      restores a real Department column to this RB, Tran Type should go
//      back to cascading off it directly instead of being pre-merged.
//   C. SP_LIST ("fn_tbl_dm_tt2doctype_list") is UNCONFIRMED — probed 6 name
//      variants against IMS_LIVE (fn_tbl_dm_tt2doctype_list,
//      fn_tbl_dm_trantype2doctype_list, fn_tbl_dm_tran2doctype_list,
//      fn_tbl_dm_transactiontodoctype_list, fn_tbl_dm_dm_tt2doctype_list,
//      fn_tbl_dm_doctypemapping_list) — all return "Invalid object name".
//      The list page will show a clean error banner (not a fake data row —
//      see normalizeListRows) until Om/DBA supplies the real SP name.

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const TT2DOCTYPE_CONFIG = {
  RB_MASTER: RB_CODES.DM_TT2DOCTYPE_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.DM_TT2DOCTYPE_MASTER),
  FORM_TAG: RB_CODES.DM_TT2DOCTYPE_MASTER, // matches sibling DMS masters' FORM_TAG = full RB code
  TRAN_BOOK: "DM",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_dm_tt2doctype",

  /** Used only to enumerate known department ids for the Tran Type merge-fetch
   *  (addendum #B) — not a Department form field (none exists live, addendum #A). */
  SP_DEPARTMENT: "fn_tbl_dm_department_list",
  /** Tran Type dropdown source — genuinely department-scoped, see addendum #B.
   *  Signature: fn_tbl_fetch_trantype(@prmdepartmentid numeric(18,0)). */
  SP_TRAN_TYPE: "fn_tbl_fetch_trantype",

  LIST_OBJ_TYPE: 2,
  /** ⚠️ UNCONFIRMED — see addendum #C. Placeholder pending Om/DBA. */
  SP_LIST: "fn_tbl_dm_tt2doctype_list",

  SAVE_ENDPOINT: "/API/DM_TT2DocType/Post_RB_DM_DM_TT2DocType_Save",
  STORAGE_HEADER_META: "piHeaderMeta",
};

/** Static Yes/No source for the "Is active" dropdown (live RB colname
 *  `departmentid`, DisplayName "Is active", ColCtrlType=4) — no
 *  ctrlsqlsource given in RB metadata. See addendum #A. */
export const IS_ACTIVE_OPTIONS = [
  { value: "1", label: "Yes" },
  { value: "0", label: "No" },
];
