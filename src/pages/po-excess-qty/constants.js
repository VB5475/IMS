// constants.js — PO Excess Qty module config.
//
// 2026-09-07 /pm — sibling module to PO Short Close Qty, same architecture,
// requested by Vinay (client). RB code confirmed registered on IMS_LIVE
// (RBID 20264, saveprocname pr_rb_poexcessqty_Save) — NOT registered on
// IMS_PGLIVE (branch is feat-pg-changes-phase-2), same known gap as its
// sibling module. Get Details function confirmed callable on IMS_LIVE (no
// SQL error), empty result for the sample division/supplier tried — not
// re-tested exhaustively since PO Short Close Qty already established this
// combination is a normal "no data yet" outcome, not a bug signal.
//
// Get Details grid is EntryGrid, columns from the standard RB pipeline
// (RB_CODE -> SP_RB_META -> RBID -> GetDetailColData -> buildGridColumns).
// Live-checked GetDetailColData for RBID 20264: only "excessqty" ("Excess
// Qty.", colseqno 9) comes back iseditallow=true — same single-editable-
// column shape as PO Short Close Qty's "shortcloseqty". One real difference
// from that sibling: divisionid/supplierid are isvisible=false here (they
// were true there) — buildGridColumns already filters on isvisible, so this
// needs no special-casing, the columns just won't render, which is correct.
//
// Division/Supplier fill reuse PURCHASE_API — no new plumbing there.
import { PURCHASE_API } from "../../constants/purchaseCommon";

export const POEQ_CONFIG = {
  ROUTE_PATH: "/po-excess-qty",
  PAGE_TITLE: "PO Excess Qty",

  LIST_OBJ_TYPE: 2, // OBJ_TYPE.FUNCTION

  SP_DIVISIONS: PURCHASE_API.SP_DIVISIONS, // fn_tbl_fetchuserwsdivision
  SP_SUPPLIERS: PURCHASE_API.SUPPLIER_SP, // fn_tbl_fetchcustomersuppliertranws4web
  SUPPLIER_PARTY_TYPE: PURCHASE_API.SUPPLIER_PARTY_TYPE, // "S"
  SP_GET_DETAILS: "fn_tbl_rb_poexcessqty",

  RB_CODE: "RB_POExcessQty",
  SP_RB_META: PURCHASE_API.SP_RB_META, // fn_fetch_rbdetailbyrbcode

  // 2026-09-08 /tl — confirmed by the user. Single-RB save, rows bound to
  // prmStrMstJSON (not prmStrDetJSON — the user confirmed the latter comes
  // through blank server-side on this endpoint), not a master+detail pair.
  SAVE_ENDPOINT: "/API/POExcess/Post_RB_POExcessQty_Save",
};
