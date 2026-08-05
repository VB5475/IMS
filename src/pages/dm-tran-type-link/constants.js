// DM Tran Type Link — 7th DMS module config
// (MRD_Template4DMS_Trantypelink.docx, Om, 24-Jun-2026).
//
// ⚠️ The MRD is largely unusable for this module and was NOT followed
// literally — see the 2026-08-03 live-RB investigation below.
//
// What the MRD claims: Section 2's screen notes say "Form panel —
// Department (Dropdown), Tran Type (Dropdown)"; Section 3's one filled-in
// field row is "Doc Upload On" / colname "Idnumber" / source
// fn_tbl_fetch_groupdata; the embedded screenshot shows a "Doc Uploaded On"
// dropdown above a Sr No/Doc Viewed By/Ref No/Subject/Status grid. None of
// this agrees with itself or with the live RB — it reads like several rows
// were copy-pasted from Document Log's MRD and never edited (same failure
// mode flagged on DM Group Rights' MRD, see RB_CODES.DM_GROUP_RIGHTS).
//
// What's actually live (rb_dm_ttmstreln, rbid 20199, confirmed via
// FN_Fetch_Data + GetDetailColData 2026-08-03):
//   idnumber                hidden, numeric — PK
//   ref_trantypeidfrom      DisplayName "Doc Upload On" (wrong) — Textbox
//   ref_trantypeidto        DisplayName "Doc Viewed By" (wrong) — Textbox
//   ref_trantypepartsid1    DisplayName "Ref No" (wrong)        — Textbox
//   ref_trantypepartsid2    DisplayName "Subject" (wrong)       — Textbox
//   status                  DisplayName "Status" (correct)      — Textbox
//   + standard hidden housekeeping (yearid, sessionid, logdate, loginid,
//     compuniquekey, entrystatus, funccode)
// There is NO departmentid column on this RB at all — the MRD's "Department
// (Dropdown)" field cannot be built as described. Every DisplayName above
// matches Document Log's own field labels exactly (its grid is literally
// Sr No/Doc Viewed By/Ref No/Subject/Status) — confirming the backend RB's
// DisplayName metadata itself was misconfigured from that other RB, not
// just a doc typo. All 5 editable columns are typed Textbox (ColCtrlType 1)
// live, though ref_trantypeidfrom/ref_trantypeidto are clearly ID
// references (see below) — DBA-pending: ask for DisplayNames to be
// corrected and the two Tran Type columns retyped to Dropdown (4) so this
// override isn't needed.
//
// The colnames themselves — ref_trantypeidFROM / ref_trantypeidTO — fit the
// module's actual name ("Tran Type Link") far better than "Department +
// Tran Type" does, and this reading is confirmed by real, populated data:
// fn_tbl_fetch_rb_dm_ttmstreln_gridData(@prmIdnumber) — the SP the MRD's
// leftover cascade note names — returns, for prmIdnumber=1 ("Purchase
// Order"), 16 real existing links to other Tran Types (Purchase Inward,
// Direct Purchase Voucher, Bank Payment, CWIP Asset, …), each row carrying
// its own idnumber + Ref_TranTypePartsID1/2 + Status. So this module is:
// pick a "From" Tran Type → manage a grid of existing "To" Tran Type link
// rows for it (add/edit/delete), not a 2-dropdown single-record form.
// User confirmed this shape (and to proceed without a corrected MRD) after
// being shown both contradictions, 2026-08-03.
//
// No unscoped "list all Tran Types" SP was found (fn_tbl_fetch_trantype
// requires @prmdepartmentid and returns [] for 0; several guessed SP names
// all came back "Invalid object name"). Tran Type ids are shared across
// departments (id=1 "Purchase Order" appears identically whether queried
// under department 1 or read back from the link grid), so the picker for
// both the header "From" field and the grid's "To" column is built by
// calling fn_tbl_fetch_trantype once per DM_DEPARTMENT_MASTER department
// (9 calls) and merging/deduping by idnumber — a workaround, not a real
// unscoped source; flagged for DBA (a proper fn_tbl_fetch_alltrantype-style
// SP would replace this).
//
// Save endpoint/payload key are MRD-confirmed static values (not tied to
// the parts above): SAVE_ENDPOINT below, payload key prmStrMstJSON. Never
// live-fired (would create/edit real Tran Type link records) — built
// exactly to the same buildSaveRowFromColumns/withSaveContextFields shape
// every other RB-driven master here uses, but flagged unverified same as
// Transporter Master's save was.
//
// ── 2026-08-04: grid columns extended + a live isvisible-flip bug fixed ──
// Live RB metadata for this rbid has kept drifting (see conversation
// history / project memory) — as of today ref_trantypeidto/
// ref_trantypepartsid1/ref_trantypepartsid2 are flagged `isvisible:false`,
// even though this grid still needs them (real data confirmed live via
// fn_tbl_fetch_rb_dm_ttmstreln_gridData). buildGridColumns() filters out
// any column whose isvisible flag isn't true, so those 3 columns had
// silently disappeared from the grid, leaving only Status — the fix is to
// force `isvisible: true` on this module's hand-picked grid column
// whitelist in useDMTranTypeLink.js, since RB's isvisible flag has already
// proven unreliable for this table twice today and this whitelist is
// itself the real visibility decision for this grid.
//
// Also cross-checking real grid data (fn_tbl_fetch_rb_dm_ttmstreln_gridData)
// against a live-known anchor ("Purchase Order" = id 1) established that
// `docuploadon` is actually a backend-computed, read-only DISPLAY NAME for
// `ref_trantypeidto` (varies per row, matches the "To" tran type's real
// name), and `docviewedby` is the same for `ref_trantypeidfrom` (constant
// per screen, since From is fixed by the header dropdown) — despite RB's
// own DisplayNames still calling them "Doc Upload On"/"Doc Viewed By".
// `refno`/`subject` are genuine RB columns too, just empty on every real
// link row seen so far except one odd template-looking record. All 4 are
// now shown in the grid as read-only columns (GRID_TO_NAME_COL/
// GRID_FROM_NAME_COL/GRID_REFNO_COL/GRID_SUBJECT_COL below) alongside the
// existing editable ones, per explicit user request.
//
// ── 2026-08-04: "To Tran Type" grid column dropped + Add Row removed ──
// Per explicit instruction, following DBA ticket RB-20199-001 (filed same
// day): stopped overriding ref_trantypeidto's isvisible/ColCtrlType and
// instead went by RB as it stands — it's flagged isvisible:false live, so
// it's no longer rendered as a grid column at all (see GRID_WHITELIST_COLS
// in useDMTranTypeLink.js). GRID_TO_COL is kept defined here and fetchLinkRows
// still populates it in each row's underlying data — it's just not shown —
// because Save still needs the real value seeded, not silently zeroed out.
// Its human-readable equivalent remains visible via GRID_TO_NAME_COL. Add
// Row was removed alongside this (no functioning way to pick a "To Tran
// Type" for a brand-new row without that column); existing rows can still
// have Status edited and saved, and Delete still works. The header "From
// Tran Type" picker (ref_trantypeidfrom) is intentionally NOT treated the
// same way — RB doesn't mark it as a usable column at all, so overriding it
// stays in place, or nothing in this module works.
//
// ── 2026-08-04, later same day: ref_trantypeidto re-added, RB drifted AGAIN ──
// A fresh pull minutes later showed a 3rd distinct live shape for this same
// column (ObjDetID changed again): isvisible:true now (was false), but
// iseditallow:false and ColCtrlType:1 (Textbox) unchanged. Per user
// instruction, re-added to the grid rendered exactly as RB says right
// now — read-only, no ColCtrlType override — rather than restoring the
// original editable-Dropdown design. See GRID_READ_ONLY_COLS in
// useDMTranTypeLink.js. This column's RB state has now changed 3 times in
// one day; treat any future read of it as provisional until DBA confirms
// stability (ticket RB-20199-001).
//
// ── 2026-08-04, final decision for this column: LOCKED IN, no longer RB-reactive ──
// Per explicit instruction: stop re-deriving ref_trantypeidto's rendering
// from live RB pulls — it cannot be sustainably managed one flip at a time.
// Restored to the original, functional design (visible, editable Dropdown,
// options from the merged per-department Tran Type list) and this is now a
// PERMANENT client-side override, independent of whatever GetDetailColData
// reports for this column going forward. If this needs to change again, it
// should be a deliberate new decision, not a reaction to another live-RB
// read — the actual fix is DBA ticket RB-20199-001 stabilizing the RB
// itself, not further frontend chasing.

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const TTLINK_CONFIG = {
  RB_MASTER: RB_CODES.DM_TRAN_TYPE_LINK,
  ROUTE_PATH: rbRoutePath(RB_CODES.DM_TRAN_TYPE_LINK),
  FORM_TAG: RB_CODES.DM_TRAN_TYPE_LINK,

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  LIST_OBJ_TYPE: 2,

  /** Department list — only used to enumerate departments for the merged Tran Type picker below, this RB has no departmentid column of its own. */
  SP_DEPARTMENT: "fn_tbl_dm_department_list",
  /** Department-scoped Tran Type list — called once per department, results merged/deduped by idnumber. See file header note. */
  SP_TRAN_TYPE: "fn_tbl_fetch_trantype",
  /** Existing link rows for a given "From" Tran Type id — confirmed live, real populated data. */
  SP_GRID_DATA: "fn_tbl_fetch_rb_dm_ttmstreln_gridData",

  SAVE_ENDPOINT: "/API/dm_ttmstreln/Post_RB_dm_ttmstreln_Save",
  SAVE_JSON_KEY: "prmStrMstJSON",
  STORAGE_HEADER_META: "ttLinkHeaderMeta",

  /** Header field — "From" Tran Type. Live DisplayName "Doc Upload On" is wrong, overridden client-side. */
  HEADER_FROM_COL: "ref_trantypeidfrom",
  /** Grid column — "To" Tran Type. PERMANENTLY overridden client-side (visible, editable Dropdown) regardless of live RB, which has flip-flopped 3x in one day. See file header "LOCKED IN" note — do not re-sync to a fresh RB pull without a new explicit decision. */
  GRID_TO_COL: "ref_trantypeidto",
  // GRID_PARTS1_COL: "ref_trantypepartsid1",
  // GRID_PARTS2_COL: "ref_trantypepartsid2",
  GRID_STATUS_COL: "status",
  /** Read-only — backend-computed display name of ref_trantypeidto (see 2026-08-04 header note). */
  GRID_TO_NAME_COL: "docuploadon",
  /** Read-only — backend-computed display name of ref_trantypeidfrom (see 2026-08-04 header note). */
  // GRID_FROM_NAME_COL: "docviewedby",
  GRID_REFNO_COL: "refno",
  GRID_SUBJECT_COL: "subject",

  /** Corrected labels for the live-mislabeled columns (see file header). */
  LABEL_OVERRIDES: {
    ref_trantypeidfrom: "Doc Uploaded On",
    ref_trantypeidto: "To Tran Type",
    // ref_trantypepartsid1: "Ref Parts 1",
    // ref_trantypepartsid2: "Ref Parts 2",
    docuploadon: "Doc Viewed By",
    // docviewedby: "Doc Viewed By",
  },
};
