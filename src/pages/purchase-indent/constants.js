// constants.js — Purchase Indent page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE     = "Purchase Indent";
export const PAGE_TITLE_NEW = "New Purchase Indent";

// All RB codes, SP names, IDs, and request defaults for the Indent module.
// Values aligned to MRD_Template4Indent.docx (Richa, 08-Jun-2026).

import { PURCHASE_API } from "../../constants/purchaseCommon";
import { formatTranDate } from "../../utils/dateFormat";
import { getMissingItemPickerHeaderFields as getMissingPickerFields } from "../../utils/purchaseItemPicker";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { formatTranDate as formatIndentTranDate };

/** Item-grid column that supports multi-value paste (Serial Number replication). */
export const IND_MULTI_PASTE_COLUMNS = new Set(["assetsrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const IND_REMARK_COLUMNS = new Set(["remarks"]);

export const IND_CONFIG = {
  ...PURCHASE_API,
  SP_INDENT_TYPES: PURCHASE_API.SP_CONFIG_TYPES,

  RB_MASTER: RB_CODES.PURCHASE_INDENT,
  ROUTE_PATH: rbRoutePath(RB_CODES.PURCHASE_INDENT),
  DELETE_PROC_NAME: "pr_rb_purindtmst_delete",
  RB_DETAIL: "rb_purindtdet",
  RB_DETAIL_SELECT: "rb_purindtselitem",

  // ⚠️ CONFIRM with DBA — MRD Section 3 says pass "IND" in @PrmFormTag;
  //    MRD Section 7 constants table says "RB_PurIndtMst". Using "IND" per Section 3.
  FORM_TAG: "IND",
  TRAN_BOOK: "PURIND",

  SP_ITEM_PICKER: "fn_tbl_rb_purindtselitem",
  SP_GRID_EVENT: "fn_tbl_rb_purindtdet_event",
  SP_LOCATION: "fn_tbl_fetch_divwslocation",

  // Select Item popup filters (Based On = Direct only) — client instruction
  // 2026-07-28, not yet in the MRD. Both live-verified: return real Main
  // Group rows for this company/division; Sub Main Group call succeeds but
  // returned [] for every main group tried (no data seeded, not an error).
  // fn_tbl_rb_purindtselitem (SP_ITEM_PICKER) now accepts
  // @prmmaingroupid/@prmsubmaingroupid — live-confirmed 2026-07-28 (it used
  // to throw "Must declare the scalar variable ..." for both, now doesn't).
  // See handleApplyItemFilter in PurchaseIndentForm.jsx for the wiring.
  // ⚠️ DBA-CONFIRM: while re-verifying, a *different* division/config combo
  // that previously returned real item rows started returning
  // {"ErrCode":"-1","ErrMsg":"There is no row at position 9."} once
  // prmmaingroupid/prmsubmaingroupid were added — looks like a backend bug
  // in the new group-filter logic that only surfaces when rows actually
  // match (empty-result combos were fine). Flag to whoever owns this SP.
  SP_ITEM_MAIN_GROUP: "fn_fetch_itemmaingroup4popupfilter",
  SP_ITEM_SUB_MAIN_GROUP: "fn_fetch_itemsubmaingroup4popupfilter",

  SP_MASTER_FILL: "fn_tbl_rb_purindtmst",
  SP_DETAIL_FILL: "fn_tbl_rb_purindtdet",

  SAVE_ENDPOINT: "/API/PurINDSave/Post_RB_PurIndtMst_Save",

  STORAGE_HEADER_META: "indHeaderMeta",
  STORAGE_ENTRY_META: "indEntryMeta",

  SP_INDENT_LIST: "fn_tbl_rb_purindtmst_list",
  LIST_DIVISION_ID: 0,
};

export const IND_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const IND_FILTER_CASCADE_RESETS = {
  divisionid: ["configid", "locationid"],
};

export const IND_SHORTCUT_CONFIG = {
  a: { label: "Add", title: "Add (Alt+A)" },
  s: { label: "Save", title: "Save (Alt+S)" },
  n: { label: "Cancel", title: "Cancel (Alt+N)" },
};

// const MONTH_ABBR = [
//   "Jan", "Feb", "Mar", "Apr", "May", "Jun",
//   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
// ];

// export function formatIndentTranDate(dateVal) {
//   if (!dateVal) return "0";
//   const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
//   if (isNaN(d.getTime())) return "0";
//   return `${String(d.getDate()).padStart(2, "0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
// }

/** Header fields required before Select Item can be opened */
export const IND_ITEM_PICKER_JSON_FIELDS = [
  { headerKey: "divisionid", label: "Division" },
  { headerKey: "trandate",   label: "Tran Date", isDate: true },
  { headerKey: "configid",   label: "Indent Type" },
];

export function getMissingItemPickerHeaderFields(headerValues) {
  return getMissingPickerFields(headerValues, IND_ITEM_PICKER_JSON_FIELDS);
}
