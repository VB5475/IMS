// constants.js — Purchase Order page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Purchase Order";
export const PAGE_TITLE_NEW = "New Purchase Order";

// All RB codes, SP names, IDs, and request defaults for the PO module.
// Values aligned to MRD_Template4PO.docx (Richa, 09-Jun-2026).

import {
  APPROVED_FILTER_OPTS,
  BASED_ON,
  INDENT_DETAILS_COLUMNS,
  PURCHASE_API,
  PURCHASE_SUPPLIER_GRID_COLUMNS,
  PURCHASE_SUPPLIER_GRID_CONFIG,
  TERMS_COLUMNS,
} from "../../constants/purchaseCommon";
import { formatTranDate } from "../../utils/dateFormat";
import { getMissingItemPickerHeaderFields as getMissingPickerFields } from "../../utils/purchaseItemPicker";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { formatTranDate };
export { APPROVED_FILTER_OPTS as APPROVED_OPTS };
export { TERMS_COLUMNS };
export { INDENT_DETAILS_COLUMNS };
export const PO_SUMMARY_FIELDS = [
  { SummaryParameterID: "mstbaseamount", detKey: "baseamount" },
  { SummaryParameterID: "mstexpense", detKey: "expense" },
  { SummaryParameterID: "msttaxablevalue", detKey: "taxablevalue" },
  { SummaryParameterID: "mstcgst", detKey: "cgst" },
  { SummaryParameterID: "mstsgst", detKey: "sgst" },
  { SummaryParameterID: "mstigst", detKey: "igst" },
  // No per-line equivalent on rb_purpodet at all (verified live — detail grid
  // has no roundoff column). Auto-calculated (business rule confirmed by PM
  // 2026-07-24, same as PV): the adjustment that rounds the base+expense+tax
  // total to the nearest whole number — still manually editable on top.
  {
    SummaryParameterID: "mstroundoff", detKey: "roundoff", editable: true,
    roundToNearestFromKeys: ["mstbaseamount", "mstexpense", "mstcgst", "mstsgst", "mstigst"],
  },
  // Net Base Amount = every other summary amount EXCEPT Taxable Value (same
  // business rule as PV) — computed live from the other fields' own totals,
  // not summed from detail rows (rb_purpodet has no netbaseamount column
  // either — same "always 0" bug PV had).
  {
    SummaryParameterID: "mstnetbaseamount",
    detKey: "netbaseamount",
    deriveFromKeys: ["mstbaseamount", "mstexpense", "mstcgst", "mstsgst", "mstigst", "mstroundoff"],
  },
];
export const PO_FILTER_INITIAL_VALUES = { basedonid: "" };
export const PO_FILTER_CASCADE_RESETS = { divisionid: ["configid"] };

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const PO_REMARK_COLUMNS = new Set(["remarks"]);

export const PO_CONFIG = {
  ...PURCHASE_API,
  SP_PO_TYPES: PURCHASE_API.SP_CONFIG_TYPES,

  RB_MASTER: RB_CODES.PURCHASE_ORDER,
  ROUTE_PATH: rbRoutePath(RB_CODES.PURCHASE_ORDER),
  DELETE_PROC_NAME: "pr_rb_purpomst_delete",
  RB_DETAIL: "rb_purpodet",
  RB_INDT_DETAIL: "rb_purpoindtdet",

  FORM_TAG: "PO",
  TRAN_BOOK: "PO",

  RB_ITEM_PICKER_DIRECT: "rb_purposelonlyitem",
  RB_ITEM_PICKER_INDENT: "rb_purposelindtitem",
  RB_ITEM_PICKER_QUOT: "rb_purposelquotitem",

  SP_ITEM_PICKER_DIRECT: "fn_tbl_rb_purposelonlyitem",
  SP_ITEM_PICKER_INDENT: "fn_tbl_rb_purposelindtitem",
  SP_ITEM_PICKER_QUOT: "fn_tbl_rb_purposelquotitem",
  SP_INDENT_SUMMARY: "fn_tbl_fetchindentsummaryitem4po",
  SP_SUPPLIER_INFO: "fn_tbl_fetchsuppliercurrencyinfo",
  SP_UNIQUE_ID: "pr_gen_fetchlevyuniqueno4web",
  SP_DEPT: PURCHASE_API.SP_DEPT,

  SP_MASTER_FILL: "fn_tbl_rb_purpomst",
  SP_DETAIL_FILL: "fn_tbl_rb_purpodet",
  SP_INDT_DETAIL_FILL: "fn_tbl_rb_purpoindtdet",
  SP_GRID_EVENT: "fn_tbl_rb_purpodet_event",

  // Select Item popup filters (Based On = Direct only) — same rollout as
  // Purchase Indent (2026-07-28). Popup-filter SPs live-verified working.
  // fn_tbl_rb_purposelonlyitem (SP_ITEM_PICKER_DIRECT) now accepts
  // @prmmaingroupid/@prmsubmaingroupid — live-confirmed 2026-07-28 (used to
  // throw "Must declare the scalar variable ...", that's gone). Wired in
  // handleApplyItemFilter.
  SP_ITEM_MAIN_GROUP: "fn_fetch_itemmaingroup4popupfilter",
  SP_ITEM_SUB_MAIN_GROUP: "fn_fetch_itemsubmaingroup4popupfilter",

  BASED_ON_OPTIONS: [BASED_ON.DIRECT, BASED_ON.INDENT_WISE, BASED_ON.QUOTATION],

  SUPPLIER_GRID_COLUMNS: PURCHASE_SUPPLIER_GRID_COLUMNS,
  INDENT_FRM_OPTION: 0,

  SAVE_ENDPOINT: "/API/PurPOSave/Post_RB_PurPOMst_Save",

  STORAGE_HEADER_META: "poHeaderMeta",
  STORAGE_ENTRY_META: "poEntryMeta",

  SP_PO_LIST: "fn_tbl_rb_purpomst_list",
  LIST_DIVISION_ID: 0,

  // Workflow (WKF) approval — "Approval Initiator" button on the list page,
  // beside Entry Form (2026-08-12 /pm, MRD_Template4WorkFlowDashBoard.docx's
  // companion feature). User-confirmed value.
  WKF_TRAN_TYPE_ID: 1,

  // Document Log (F6) — this module's own DM_TRAN_TYPE_ID, distinct from
  // (and unrelated to) WKF_TRAN_TYPE_ID above even though both currently
  // equal 1. See useDocumentLogAccess / PurchaseIndentForm.jsx for the
  // pattern this was ported from.
  DM_TRAN_TYPE_ID: 1,
};

export const PO_MASTER = {
  summaryFields: PO_SUMMARY_FIELDS,
};

export const PO_GRID_TABS = [
  { id: "items", label: "Item Grid" },
  { id: "terms", label: "Terms And Conditions" },
];

// export const APPROVED_OPTS = [
//   { value: "all", label: "All" },
//   { value: "approved", label: "Approved" },
//   { value: "pending", label: "Pending" },
// ];

// export const TERMS_COLUMNS = ["Sr.No", "Terms Type", "Code", "Terms & Conditions"];

// export const INDENT_DETAILS_COLUMNS = [
//   { key: "SrNo", label: "Sr.No", width: 70 },
//   { key: "IndentNo", label: "Indent No.", width: 120 },
//   { key: "IndentDate", label: "Indent Date", width: 110 },
//   { key: "ItemName", label: "Item Name", width: 190 },
//   { key: "IndentQty", label: "Indent Qty", width: 100 },
//   { key: "TranQty", label: "Tran Qty", width: 100 },
//   { key: "Unit", label: "Unit", width: 80 },
// ];

// export const PO_FILTER_INITIAL_VALUES = { BasedOnID: "0" };

// ── Keyboard shortcut labels (used for ActionBar button titles) ──────────────
export const PO_SHORTCUT_CONFIG = {
  a: { label: "Add", title: "Add (Alt+A)" },
  s: { label: "Save", title: "Save (Alt+S)" },
  n: { label: "Cancel", title: "Cancel (Alt+N)" },
};

// Cascade resets: Division change → clear PO Type (ConfigID)
// export const PO_FILTER_CASCADE_RESETS = {
//   DivisionID: ["ConfigID"],
// };

export const SUPPLIER_GRID_CONFIG = {
  columns: PO_CONFIG.SUPPLIER_GRID_COLUMNS,
  pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25] },
};

// Formats a date value as "dd-Mon-yyyy" for API params.
// const MONTH_ABBR = [
//   "Jan",
//   "Feb",
//   "Mar",
//   "Apr",
//   "May",
//   "Jun",
//   "Jul",
//   "Aug",
//   "Sep",
//   "Oct",
//   "Nov",
//   "Dec",
// ];
// export function formatTranDate(dateVal) {
//   if (!dateVal) return "0";
//   const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
//   if (isNaN(d.getTime())) return "0";
//   const dd = String(d.getDate()).padStart(2, "0");
//   return `${dd}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
// }

/** Header fields required before Select Item can be opened */
export const PO_ITEM_PICKER_JSON_FIELDS = [
  { headerKey: "divisionid", label: "Division" },
  { headerKey: "trandate", label: "Tran Date", isDate: true },
  { headerKey: "configid", label: "PO Type" },
  { headerKey: "supplierid", label: "Supplier" },
  { headerKey: "basedonid", label: "Based On", allowZero: true },
];

export function getMissingItemPickerHeaderFields(headerValues, headerColumns = null) {
  return getMissingPickerFields(headerValues, headerColumns, {
    zeroValidFields: new Set(["basedonid"]),
  });
}
