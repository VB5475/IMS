// constants.js — Transporter Master page config
//
// Source: docs/module-requirements/28-07-2026/MRD_TransporterMaster.docx.
// First master module in this app with BOTH a header panel AND a detail
// grid (every other master built so far — Location/Division/Supplier/
// Company — is header-only); modeled on DOP Master's header+detail
// pipeline (src/pages/dop-master/), the closest existing precedent.
//
// ⚠️ MRD gaps — scaffolding now with the assumptions below (client chose
// "proceed now, flag TODOs" over blocking on DBA). CONFIRM every one of
// these:
//   - SP_LIST: MRD gives two conflicting names — "Fn_tbl_SupplierMst_List"
//     (§5.1) vs "Fn_tbl_rb_transportermst_List" (§7). Using the latter —
//     "SupplierMst" is a different real module in this app (Supplier
//     Master's own list SP); reusing it here would be wrong. Matches the
//     "<RB_MASTER>_list" convention every other module's SP_LIST follows.
//   - FORM_TAG: MRD sets it to a full SP name ("fn_tbl_rb_transportermst"),
//     contradicting its own row description ("short module tag"). Using
//     "TM" per this app's convention (LM, DV, SM).
//   - STORAGE_HEADER_META: MRD value "piHeaderMeta" is an unedited leftover
//     from the Purchase Inquiry template example — renamed to
//     "tmHeaderMeta" (same reasoning DOP Master used for the same MRD-
//     template artifact, see dop-master/constants.js).
//   - Detail save payload key: MRD explicitly states prmStrConsigneeJSON
//     (not this app's usual prmStrDetJSON) — used verbatim since it's
//     explicitly given, not silently swapped. CONFIRM live once wired up
//     (safe to check via Playwright page.route() interception before a
//     real save, see project_location_master memory for the technique).
//   - SAVE_ENDPOINT casing: MRD has two different casings across sections
//     (§5 "Post_rb_transportermst_Save" vs §5.1/§7 "Post_Rb_..._Save") —
//     using the §7 constants version verbatim.
//   - "Code" field's ColName: MRD literally says "Tran Code" (with a stray
//     space) — used as "TranCode" (no space) below; CONFIRMED live 2026-08-03
//     the real colname is "trancode" (lowercase, no space, matches this app's
//     usual convention).
//   - "Code" renders as a read-only label, not a textbox, in Add mode too —
//     CONFIRMED live 2026-08-03 this is NOT an IsEditAllow/lock issue (ruled
//     out — first suspected the same Add-mode-lock bug already found+fixed on
//     Location Master, but verified this field's real ColCtrlType is 0
//     ("Label" — MasterFormField renders that unconditionally regardless of
//     locked state), not 1 ("Textbox") as the MRD's field table claims. Also
//     live ismandatory=0, contradicting the MRD's "Required: Yes". Both
//     point the same direction: Tran Code is most likely meant to be a
//     system/auto-generated code (common ERP pattern, like PO/PV/Indent
//     numbers elsewhere in this app), not user-typed — CONFIRM with BA/DBA
//     whether the save SP auto-populates it, since as scaffolded the form
//     has no way to set it and it isn't required, so this may be correct
//     as-is rather than a bug to fix.
//   - SUPPLIER_PARTY_TYPE="S": no corresponding field in this MRD's screen
//     design (no "party type" field anywhere) — copied in as instructed but
//     not wired to anything; CONFIRM with BA/DBA what consumes it. Its
//     presence in a Transporter module's constants, alongside RB_MASTER
//     using a plain "rb_transportermst" code, is also worth confirming
//     doesn't mean Transporter records share Supplier Master's backend
//     table (PartyType-filtered) rather than being a fully separate table.
//   - Detail grid's "Default" checkbox: mentioned in the MRD's §2 screen-
//     notes prose but absent from the formal §3.1 field table — NOT built;
//     confirm with BA whether it's a real field or a leftover.
//   - LIST_DIVISION_ID: MRD's own author already flagged this CONFIRM in §7 —
//     kept as given (static 15, matches the ~55 other modules in this app
//     that hardcode the same value; no session field exists to source it
//     from dynamically — see project_transporter_master memory).
//   - CONFIG_YEAR_ID / DIVISION_YEAR_ID: MRD §7 also flagged these CONFIRM,
//     but they were never wired to any field or API call — removed as dead
//     code 2026-08-04 rather than kept as meaningless static placeholders.

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Transporter Master";
export const PAGE_TITLE_NEW = "New Transporter Master";

export const TM_CONFIG = {
  RB_MASTER: RB_CODES.TRANSPORTER_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.TRANSPORTER_MASTER),

  RB_DETAIL: "rb_transporterdet",

  FORM_TAG: "TM", // CONFIRM — MRD gives a full SP name instead of a short tag
  TRAN_BOOK: "Transporter Master",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",

  SP_MASTER_FILL: "fn_tbl_rb_transportermst",
  SP_DETAIL_FILL: "fn_tbl_rb_transporterdet",

  SAVE_ENDPOINT: "/API/SupplierMst/Post_Rb_transportermst_Save", // CONFIRM — casing differs across MRD sections

  // Save payload's detail-rows key — MRD-specified, non-standard for this
  // app (most modules use prmStrDetJSON) — CONFIRM live once wired up.
  SAVE_DETAIL_JSON_KEY: "prmStrConsigneeJSON",

  STORAGE_HEADER_META: "tmHeaderMeta",
  STORAGE_DETAIL_META: "tmDetailMeta",

  LIST_OBJ_TYPE: 2,
  // CONFIRMED 2026-08-04 (DBA): fn_tbl_rb_transportermst_list(@prmcompanyid,
  // @prmdivisionid, @prmyearid, @prmfromdate, @prmtodate, @prmloginid) — name
  // matches the MRD §7 guess, but the call was only sending 3 of the 6 params;
  // see TransporterMasterPage.jsx's buildListParams for the fixed call.
  SP_LIST: "fn_tbl_rb_transportermst_list",
  LIST_DIVISION_ID: 15, // CONFIRM per MRD §7

  // Unused for now — no corresponding field in this MRD's screen design.
  // CONFIRM with BA/DBA what this drives before wiring it to anything.
  SUPPLIER_PARTY_TYPE: "S",
};

export const TM_SHORTCUT_CONFIG = {
  a: { label: "Add", title: "Add (Alt+A)" },
  s: { label: "Save", title: "Save (Alt+S)" },
  n: { label: "Cancel", title: "Cancel (Alt+N)" },
};
