// documentLogConfig.js — Document Log (F6 modal inside transaction forms).
//
// SCOPE CORRECTION (2026-07-30, /pm): the "DM Document List" module built
// 2026-07-29 was originally shipped as a standalone master with its own
// route/nav entry. That was wrong — it's a transaction-level document
// logging feature: an F6 button inside transaction forms (Indent first,
// PO/PV/etc. later) opening a large modal, no standalone screen. The old
// route (/admin/dms/document-list) and nav entry are removed; this config
// + DocumentLogModal.jsx replace src/pages/dm-document-list/*.
//
// Two independently RB-driven grids, same as before:
// - Grid 2 "Docs" (rb_dm_tranwisedocs, RBID 20200) — PRIMARY, editable,
//   the only one saved.
// - Grid 1 "Reference Documents" (rb_dm_tranwiseredocs, RBID 20201) —
//   READ-ONLY, fetched for the current transaction's tranid.
//
// Reference Documents' data source was REPLACED 2026-07-30 (later same day,
// see below the "REFERENCE DOCUMENT BUTTON" note) — no longer auto-fetched
// on modal open via SP_SHOW_DOC_LIST; now fetched only on explicit button
// click via SP_FETCH_DOC_DATA.
//
// REAL API CONTRACT CONFIRMED 2026-07-30 via an actual written spec doc
// (docs/module-requirements/30-07-2026/IMS ERPWS - DM API.docx) — a huge
// upgrade in confidence over the Postman-screenshot guessing this whole
// feature was built on. Live-checked every endpoint against IMS_LIVE the
// same day the doc arrived:
// - DM_Config: NOW WORKS live (it 404'd earlier this same session — the
//   backend team is deploying these progressively, mid-session).
// - DM_HandleButtonVisibility: confirmed working (already was).
// - DM_HandleGUID, the REAL DM_DocSave/DM_DocView paths below, and the new
//   DM_Doc_UpdateOnTranSave endpoint: all 404/500'd as of this doc's initial
//   arrival — NOT deployed yet at that point.
//
// FOLLOW-UP 2026-07-30 (later same day) — all 4 are now deployed on
// IMS_LIVE, re-verified via direct curl:
// - DM_HandleGUID: WORKS, but only with LOWERCASE field names
//   (prmguid/prmref_trantypeid/prmtranid) — the doc's own mixed-case example
//   (prmGUID/prmRef_TranTypeID/prmTranID) still 500s. See
//   PurchaseIndentForm.jsx's fetchDocGuid + api/constants.js's DM_HANDLE_GUID.
// - DM_DocView: WORKS — a nonexistent docid now returns a proper JSON error
//   envelope ({"ErrCode":"-1","ErrMsg":"No Rows returned in tableset !"})
//   instead of a 404, exactly matching the blob-vs-JSON-error branching
//   useDocumentLog.js's viewDoc already implements. No code change needed.
// - DM_Doc_UpdateOnTranSave: WORKS — returns
//   {"ErrCode":"1","ErrMsg":"Document(s) saved with Transaction Successfully!"}.
//   Still deliberately NOT wired into any transaction's save flow (separate,
//   explicit ask — see updateDocsOnTranSave in useDocumentLog.js).
// - DM_DocSave: reaches the real backend now (multipart jsonstring/file
//   contract is confirmed correct — the request gets past parsing into the
//   actual stored procedure), but the underlying `pr_rb_dm_tranwisedocs_save`
//   SP itself currently errors: {"ErrCode":"-1","ErrMsg":"The formal
//   parameter \"@prmSrNo\" was not declared as an OUTPUT parameter, but the
//   actual parameter passed in requested output. ..."}. This is a genuine
//   backend/SP-level bug (an OUTPUT-parameter mismatch inside the stored
//   procedure), NOT a client request-shape problem — nothing to fix here;
//   flag to the backend/DBA team.
//
// REFERENCE DOCUMENT BUTTON (2026-07-30, later same day): per explicit user
// spec, Reference Documents no longer auto-loads when the modal opens — the
// grid starts empty, and a "Reference Document" button fetches + fills it
// on click, via `fn_tbl_rb_dm_trnwisedocs_fetch_DocData` (the SAME function
// briefly used — then reverted — for a Docs "Add Row" picker earlier this
// session; this is a DIFFERENT, intentional reuse: same function, no popup,
// output goes straight into the existing Reference Documents grid). This
// REPLACES the old SP_SHOW_DOC_LIST-based auto-fetch entirely (that
// function/constant is gone — nothing else referenced it).
//
// RB CHANGED UPSTREAM (2026-07-30, later same day) — rb_dm_tranwisedocs
// (20200) and rb_dm_tranwiseredocs (20201) both got EVERY column flipped to
// isvisible=true + ismandatory=1, live-reconfirmed via GetDetailColData —
// including pure system/audit columns (idnumber, guid, tranid,
// ref_trantypeid, ref_departmentid, status, tranidstatus, sessionid, yearid,
// compuniquekey, entrystatus, funccode, logdate, loginid) and even the
// View/Upload BUTTON columns (ctrltype 10 marked "mandatory", which makes no
// sense for a button) — strong evidence this was a blanket flag flip on the
// backend, not a deliberate per-field redesign. Confirmed via AskUserQuestion:
// keep rendering only the genuine content fields (whitelisted below via
// GRID_ROW_COLS, same pattern as project_dm_group_rights' HEADER_COLS/
// GRID_ROW_COLS), and silently populate the newly-mandatory system columns
// via the save context instead — the same treatment tranid/guid/companyid/
// yearid/loginid/funccode already got. `ref_trantypeid` now comes from the
// caller's `tranTypeId` prop; `ref_departmentid` defaults to
// DEFAULT_REF_DEPARTMENT_ID (see below) — user-confirmed value, not guessed.

import { RB_CODES } from "../../constants/rbCodes";

export const DOCUMENT_LOG_CONFIG = {
  RB_MASTER: RB_CODES.DM_DOCUMENT_LIST,
  FORM_TAG: RB_CODES.DM_DOCUMENT_LIST,

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  LIST_OBJ_TYPE: 2,

  /** Grid 2 — "Docs" — primary, editable, the only one that gets saved. */
  RB_TRANDETAIL: "rb_dm_tranwisedocs",
  /** Grid 1 — "Reference Documents" — read-only, fetched only on the
   *  "Reference Document" button click (no auto-load on open). */
  RB_REFERENCEDETAIL: "rb_dm_tranwiseredocs",

  SP_DOCUMENT_TYPE: "fn_tbl_dm_documenttype_list",
  SP_DOCUMENT_SUBTYPE: "fn_tbl_dm_documentsubtype_list",
  SP_CATEGORY: "fn_tbl_rb_dm_tranwisedocs_category",

  /** "Reference Document" button — fills the Reference Documents grid
   *  directly (no popup). Plain 4-named-arg FUNCTION, called via
   *  FN_Fetch_Data: JSon=[{prmloginid, prmref_trantypeid, prmguid, prmtranid}].
   *  Live-confirmed on IMS_LIVE (executes cleanly, returns `[ ]` — table is
   *  empty, brand-new feature); 42703 "column \"prmloginid\" does not
   *  exist" on IMS_PGLIVE — not deployed there yet. */
  SP_FETCH_DOC_DATA: "fn_tbl_rb_dm_trnwisedocs_fetch_DocData",

  // Real path per the DM API doc — was wrongly /API/DM_Doc/Post_RB_DM_Doc_Save
  // (a DIFFERENT, seemingly leftover/unrelated route that also exists on
  // IMS_LIVE and responds, just not to the real contract — see
  // useDocumentLog.js for how the multipart body is actually built).
  // Multipart form-data: a `jsonstring` field (JSON-encoded STRING, not a
  // JSON body) containing { prmmode, prmyearid, prmloginid, prmdivisionid,
  // prmstrmstjson } where prmstrmstjson is ITSELF a JSON-encoded string of
  // the dm_Tranwisedocs row(s) — plus an optional `file` field for the
  // actual upload. One file per call (multipart semantics), so multi-row
  // saves loop this endpoint once per row.
  SAVE_ENDPOINT: "/API/DM_DocSave/Post_RB_DM_Doc_Save",

  // Real path per the doc — was wrongly /API/DM_Doc/Post_RB_DM_Doc_Fetch.
  // Body: plain JSON object { prmdocid, prmloginid } (this part was already
  // guessed correctly). Success response is the RAW FILE itself ("Document
  // sent to response" per the doc), not JSON — only a failure returns the
  // familiar {ErrCode,ErrMsg} envelope. See useDocumentLog.js's viewDoc for
  // how the blob-vs-JSON-error branching works.
  VIEW_ENDPOINT: "/API/DM_DocView/Post_RB_DM_Doc_View",

  // NEW 2026-07-30, per the doc: "After transaction is saved successfully,
  // call this to update link to uploaded docs to this new saved
  // transaction." Ties the DM_HandleGUID mechanism together — documents
  // uploaded against a temporary GUID (before the parent transaction has a
  // real TranID) get linked to the real TranID here once it exists. Body:
  // { prmtrantypeid, prmguid, prmtranid, prmyearid, prmloginid,
  // prmdivisionid }. Function built (useDocumentLog.js's
  // updateDocsOnTranSave) but NOT wired into any transaction's save flow
  // yet — that's a real behavior change to core Save (when this fires
  // matters), left for an explicit follow-up ask rather than done silently.
  UPDATE_ON_TRAN_SAVE_ENDPOINT: "/API/DM_Doc_UpdateOnTranSave/Post_RB_DM_Doc_Upd",

  DOCTYPE_COL: "ref_documenttypeid",
  SUBTYPE_COL: "ref_documentsubtypeid",
  CATEGORY_COL: "ref_categoryid",

  /** Docs grid ("Get Detail"-equivalent render list) — whitelist of the
   *  genuine content fields to actually show, regardless of how many other
   *  columns the RB marks visible (see the "RB CHANGED UPSTREAM" note
   *  above). Matches this module's original 2026-07-29 MRD scope
   *  (Type/SubType/Category/Title/Notes/Remarks + View/Upload) plus
   *  `subject`, itself a real content field the RB has always carried. */
  GRID_ROW_COLS: [
    "ref_documenttypeid",
    "ref_documentsubtypeid",
    "ref_categoryid",
    "documenttitle",
    "subject",
    "notes",
    "remarks",
    "uploaddoc",
    "viewdoc",
  ],

  // Newly-mandatory system columns (see "RB CHANGED UPSTREAM" above) that
  // this app must now supply explicitly in the save context, since they're
  // no longer optional/defaultable server-side. ref_trantypeid comes from
  // the caller's own tranTypeId prop (already threaded through for the
  // Reference Document button) — only the department needs a constant here.
  // Purchase Indent is a Purchase-department transaction, confirmed via
  // AskUserQuestion 2026-07-30 (matches the DMS Department Master's
  // "PURCHASE" id=1, already used to confirm IND_CONFIG.DM_TRAN_TYPE_ID via
  // fn_tbl_fetch_trantype(@prmdepartmentid=1) earlier this session). Revisit
  // this constant (or make it a caller-supplied prop like tranTypeId) once
  // PO/PV/etc. get their own Document Log wiring — they may not all be
  // Purchase-department transactions.
  DEFAULT_REF_DEPARTMENT_ID: 1,

  // Real RB columns, ColCtrlType 10 ("button" — live-confirmed 2026-07-30 on
  // BOTH rb_dm_tranwisedocs and rb_dm_tranwiseredocs), rendered natively by
  // EntryGrid as clickable buttons — not a synthetic UI addition. Reference
  // Documents is read-only by design, so its RB-flagged "Upload" column is
  // deliberately dropped before rendering (see DocumentLogModal.jsx) even
  // though the RB itself marks it visible there too — uploading to a
  // reference-only row doesn't make sense.
  VIEW_COL: "viewdoc",
  UPLOAD_COL: "uploaddoc",
};
