// constants.js — PO Short Close Qty module config.
//
// 2026-09-07 /pm — brand-new, single-grid browse page under Purchase, built
// on the /assets-part-indent read-only-page precedent but with a real
// server-side filter (Division + Supplier) instead of a full-dataset client
// filter, since fn_tbl_rb_poshortcloseqty takes prmdivisionid/prmsupplierid
// as real params (unlike Asset Part Indent's two fetch functions, which took
// none). RB code confirmed registered on IMS_LIVE (RBID 20263) by /dba,
// live-tested 2026-09-07 — NOT registered on IMS_PGLIVE yet (branch is
// feat-pg-changes-phase-2), so this module only works against IMS_LIVE for
// now, same as several other modules built ahead of PG parity.
//
// Division/Supplier fill reuse the exact same shared functions already wired
// into 37 other Purchase files (see PURCHASE_API in purchaseCommon.js) — no
// new plumbing there, only the Get Details function is new.
//
// 2026-09-07 /pm (correction) — Get Details grid is EntryGrid, not the ad-hoc
// EnterpriseDataGrid + row-key column inference (that pattern only existed
// for Assets Part Indent because it had zero RB code to key off). This
// module HAS a real RB code, so columns come from the standard RB pipeline:
// RB_CODE -> SP_RB_META (fn_fetch_rbdetailbyrbcode) -> RBID -> GetDetailColData
// -> buildGridColumns — same as every other RB-driven module (see
// usePurchaseOrder.js's loadRbDetailGridMeta).
//
// Live-checked GetDetailColData for RBID 20263: only one column comes back
// with iseditallow=true — "shortcloseqty" ("Short Close Qty.", colseqno 9).
// Every other visible column (pono, podate, itemcode, itemname, qty, unit,
// plus divisionid/supplierid which also appear as row columns here) is
// locked. Passing allEditable:false into buildGridColumns (i.e. NOT the
// PO detail grid's allEditable:true override) respects those flags exactly
// as the RB defines them, so shortcloseqty comes out naturally editable
// with no bespoke per-column logic needed.
//
// 2026-09-08 /tl — Save endpoint confirmed by the user
// (API/POShortclose/Post_RB_POShortcloseQty_Save) and wired (see
// usePOShortCloseQty.js's saveRows / POShortCloseQtyPage.jsx's handleSave) —
// single-RB save, rows bound to prmStrMstJSON (not prmStrDetJSON — the user
// confirmed the latter comes through blank server-side on this endpoint),
// not a master+detail RB pair like PO.
import { PURCHASE_API } from "../../constants/purchaseCommon";

export const POSCQ_CONFIG = {
  ROUTE_PATH: "/po-short-close-qty",
  PAGE_TITLE: "PO Short Close Qty",

  LIST_OBJ_TYPE: 2, // OBJ_TYPE.FUNCTION

  SP_DIVISIONS: PURCHASE_API.SP_DIVISIONS, // fn_tbl_fetchuserwsdivision
  SP_SUPPLIERS: PURCHASE_API.SUPPLIER_SP, // fn_tbl_fetchcustomersuppliertranws4web
  SUPPLIER_PARTY_TYPE: PURCHASE_API.SUPPLIER_PARTY_TYPE, // "S"
  SP_GET_DETAILS: "fn_tbl_rb_poshortcloseqty",

  RB_CODE: "RB_POShortCloseQty",
  SP_RB_META: PURCHASE_API.SP_RB_META, // fn_fetch_rbdetailbyrbcode

  // 2026-09-08 /tl — confirmed by the user. Single-RB save, rows bound to
  // prmStrMstJSON (not prmStrDetJSON — the user confirmed the latter comes
  // through blank server-side on this endpoint), not a master+detail pair.
  SAVE_ENDPOINT: "/API/POShortclose/Post_RB_POShortcloseQty_Save",
};
