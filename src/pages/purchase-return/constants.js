// constants.js — Purchase Return page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE     = "Purchase Return";
export const PAGE_TITLE_NEW = "New Purchase Return";

// All RB codes, SP names, IDs, and request defaults for the PR module.
// Values aligned to MRD_Template4PurchaseReturn.docx (Richa, 12-Aug-2026).
//
// Gaps resolved against the template while porting (documented here instead
// of a round-trip "Dev Confirmed" sign-off, matching this codebase's existing
// practice — see DOP_MASTER / DM_GROUP_RIGHTS notes in rbCodes.js):
//   - FORM_TAG: MRD's own table sets this to "rb_purprmst" (= RB_MASTER) —
//     clearly a copy-paste leftover from the "add RB code" row above it in the
//     template. Every sibling module uses a short 3-5 char tag instead
//     (PI="INQ", PV="PV", Indent="IND"); using "PR" here, matching the
//     MRD's own Module Code (Section 1) and TRAN_BOOK value below.
//   - CONFIG_YEAR_ID / DIVISION_YEAR_ID: MRD lists these as separate
//     constants (marked CONFIRM, one with no value at all). No sibling
//     module keys a "year ID for config/division fetch" separately — every
//     one just uses getUserSession().yearId directly. Doing the same here;
//     these two constants are omitted.
//   - STORAGE_HEADER_META: MRD says "piHeaderMeta" — that's Purchase
//     Inquiry's key, copied from the template's own PI example column.
//     Using "prHeaderMeta"/"prEntryMeta" (this module's own prefix, matching
//     every other module's pvHeaderMeta/piHeaderMeta/... pattern).
//   - SP_GRID_EVENT: not listed anywhere in the MRD's API Reference table.
//     Every sibling module's cell-recalc SP is "fn_tbl_" + RB_DETAIL +
//     "_event" (fn_tbl_rb_purpvdet_event, fn_tbl_rb_purinquirydet_event, ...)
//     — applying the same convention: fn_tbl_rb_purprdet_event.
//     ⚠️ CONFIRM with DBA — inferred, not MRD-stated.
//   - "Buttons: Add New | Select Item" (Section 2 screen notes): every
//     sibling purchase module (Indent/Inquiry/PV/PO/GRN) only offers
//     "Select Item" + "Delete" on the item grid — rows are always
//     picker-sourced, never manually blank-added. Treating "Add New" here
//     as the same generic template wording those other MRDs also carry
//     (not a real extra control) and matching the established Select
//     Item + Delete pattern.
//   - returnaccountid's source SP (fn_tbl_fetchexpenseacdetail) takes a
//     @prmdeptid param, but the MRD's header field table has no Department
//     field at all for this module. Passing prmdeptid: 0 (see
//     usePurchaseReturn.js's fetchReturnAccountOptions) — ⚠️ CONFIRM with
//     DBA whether Return Account should actually be department-scoped.
//   - resolveEditLoadParams idFields: MRD never states the master-fill row's
//     primary-key column name. Using "PRID", matching the PVID/POID/INQID
//     naming convention of every sibling module.

import { PURCHASE_API, PURCHASE_GST_SUMMARY_FIELDS } from "../../constants/purchaseCommon";
import { formatTranDate } from "../../utils/dateFormat";
import { getMissingItemPickerHeaderFields as getMissingPickerFields } from "../../utils/purchaseItemPicker";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { formatTranDate as formatPRTranDate };

export const PR_CONFIG = {
  ...PURCHASE_API,
  SP_PR_TYPES: PURCHASE_API.SP_CONFIG_TYPES,

  RB_MASTER: RB_CODES.PURCHASE_RETURN,
  ROUTE_PATH: rbRoutePath(RB_CODES.PURCHASE_RETURN),
  DELETE_PROC_NAME: "pr_rb_purprmst_delete",
  RB_DETAIL: "rb_purprdet",

  FORM_TAG: "PR",
  TRAN_BOOK: "PR",
  // "Pass 'PURRET' in @PrmFormTag parameter" — Purchase Return's own PR-Type
  // configuration lookup uses a DIFFERENT tag than FORM_TAG/TRAN_BOOK above
  // (MRD Section 3, "PR Type" row). Kept separate on purpose.
  CONFIG_FORM_TAG: "PURRET",

  // Supplier picker — shared SP, same as every other purchase module.
  SUPPLIER_PARTY_TYPE: "S",
  SUPPLIER_SP: "fn_tbl_fetchcustomersuppliertranws4web",

  // RB codes for item picker modal — 2 modes based on BasedOnID.
  // MRD: "Hardcode options(1-PV Base,2-Direct)" — see rbCodes.js note on
  // RB_CODES.PURCHASE_RETURN for why this deliberately doesn't follow the
  // "0=Direct" convention used by every other purchase module.
  RB_ITEM_PICKER_PV: "rb_purprselpvdet",       // BasedOn = '1' (PV Base)
  RB_ITEM_PICKER_DIRECT: "rb_purprselonlyitem", // BasedOn = '2' (Direct)

  // SP / function names
  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_DIVISIONS: "fn_tbl_fetchuserwsdivision",
  SP_ITEM_PICKER_PV: "fn_tbl_rb_purprselpvdet",
  SP_ITEM_PICKER_DIRECT: "fn_tbl_rb_purprselonlyitem",

  // Return Account dropdown — fn_tbl_fetchexpenseacdetail(@prmdivisionid,
  // @prmloginid, @prmdeptid, @prmrbcode). See file header note re: prmdeptid.
  SP_RETURN_ACCOUNT: "fn_tbl_fetchexpenseacdetail",

  // Transporter/driver logistics cascade — this module's own SPs (distinct
  // signature from GRN/PV's division-scoped transporter fetchers): City has
  // no params at all, Transporter cascades from City only, Destination
  // cascades from Transporter only. Driver State also has no params.
  SP_TRANSPORTER_CITY: "fn_tbl_rb_purprmst_city_fetch",
  SP_TRANSPORTER: "fn_tbl_rb_purprmst_transporter_fetch",
  // Verbatim MRD spelling ("transpoter", missing the second "s") — this is a
  // live backend SP name, not a typo to silently fix client-side.
  SP_TRANSPORTER_DESTINATION: "fn_tbl_rb_purprmst_transpoterdestination_fetch",
  SP_DRIVER_STATE: "fn_tbl_rb_purprmst_state_fetch",

  // Grid cell-event SP (fires on qty / rate column blur) — see file header note.
  SP_GRID_EVENT: "fn_tbl_rb_purprdet_event",

  SP_MASTER_FILL: "fn_tbl_rb_purprmst",
  SP_DETAIL_FILL: "fn_tbl_rb_purprdet",

  // Select Item popup filters (Direct mode only) — same rollout as every
  // other purchase module's Direct picker.
  SP_ITEM_MAIN_GROUP: "fn_fetch_itemmaingroup4popupfilter",
  SP_ITEM_SUB_MAIN_GROUP: "fn_fetch_itemsubmaingroup4popupfilter",

  SAVE_ENDPOINT: "/API/PurPurchaseReturnSave/Post_RB_PurPRMst_Save",

  STORAGE_HEADER_META: "prHeaderMeta",
  STORAGE_ENTRY_META: "prEntryMeta",

  // Purchase Return listing
  LIST_OBJ_TYPE: 2,
  SP_PR_LIST: "fn_tbl_rb_purprmst_list",
  // ⚠️ CONFIRM with DBA — MRD marks this CONFIRM with no value; using 0 (all
  // divisions) pending confirmation, same default every sibling module uses.
  LIST_DIVISION_ID: 0,

  // "Based On" dropdown — MRD Section 3, hardcoded (not RB-driven).
  BASED_ON_OPTIONS: [
    { value: "1", label: "PV Base" },
    { value: "2", label: "Direct" },
  ],
};

export const PR_GRID_TABS = [{ id: "items", label: "Item Grid" }];

// Division change clears PR Type + Supplier + grid (MRD Section 3 cascade
// notes). No Location field exists on this module's header at all.
export const PR_FILTER_CASCADE_RESETS = {
  divisionid: ["configid", "supplierid"],
};

// Header amount fields (Item Amount / Expense / Taxable Value / CGST / SGST /
// IGST / Round Off / Net Amount) match the shared GST summary panel shape
// used by PO/PQ/PV verbatim — reusing it rather than redefining.
export const PR_SUMMARY_FIELDS = PURCHASE_GST_SUMMARY_FIELDS;
export const PR_SUMMARY_FIELD_NAMES = new Set(PR_SUMMARY_FIELDS.map((f) => f.SummaryParameterID));

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const PR_REMARK_COLUMNS = new Set(["remarks"]);

/** Header fields required before Select Item can be opened */
export const PR_ITEM_PICKER_JSON_FIELDS = [
  { headerKey: "divisionid", label: "Division" },
  { headerKey: "trandate", label: "PR Date", isDate: true },
  { headerKey: "configid", label: "PR Type" },
  { headerKey: "supplierid", label: "Supplier" },
  { headerKey: "basedonid", label: "Based On" },
];

export function getMissingItemPickerHeaderFields(headerValues, headerColumns = null) {
  return getMissingPickerFields(headerValues, headerColumns, {
    zeroValidFields: new Set(),
  });
}
