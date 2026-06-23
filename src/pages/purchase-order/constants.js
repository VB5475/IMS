// constants.js — Purchase Order page config
// All RB codes, SP names, IDs, and request defaults for the PO module.
// Values aligned to MRD_Template4PO.docx (Richa, 09-Jun-2026).

import { controlTypeMap } from "../../data/dummyData";
import {
  APPROVED_FILTER_OPTS,
  BASED_ON,
  DEFAULT_BASED_ON_FILTER_VALUES,
  DIVISION_CONFIG_CASCADE_RESET,
  INDENT_DETAILS_COLUMNS,
  PURCHASE_API,
  PURCHASE_GST_SUMMARY_FIELDS,
  PURCHASE_SUPPLIER_GRID_COLUMNS,
  PURCHASE_SUPPLIER_GRID_CONFIG,
  TERMS_COLUMNS,
} from "../../constants/purchaseCommon";
import { formatTranDate } from "../../utils/dateFormat";
import { getMissingItemPickerHeaderFields as getMissingPickerFields } from "../../utils/purchaseItemPicker";

export { formatTranDate };
export { APPROVED_FILTER_OPTS as APPROVED_OPTS };
export { TERMS_COLUMNS };
export { INDENT_DETAILS_COLUMNS };
export { PURCHASE_GST_SUMMARY_FIELDS as PO_SUMMARY_FIELDS };
export { DEFAULT_BASED_ON_FILTER_VALUES as PO_FILTER_INITIAL_VALUES };
export { DIVISION_CONFIG_CASCADE_RESET as PO_FILTER_CASCADE_RESETS };

export const PO_CONFIG = {
  ...PURCHASE_API,
  SP_PO_TYPES: PURCHASE_API.SP_CONFIG_TYPES,

  RB_MASTER: "RB_PurPOMst",
  RB_DETAIL: "RB_PurPODet",
  RB_INDT_DETAIL: "RB_PurPOIndtDet",

  FORM_TAG: "PO",
  TRAN_BOOK: "PO",

  RB_ITEM_PICKER_DIRECT: "RB_PurPOSelOnlyItem",
  RB_ITEM_PICKER_INDENT: "RB_PurPOSelIndtItem",
  RB_ITEM_PICKER_QUOT: "RB_PurPOSelQuotItem",

  SP_ITEM_PICKER_DIRECT: "fn_tbl_RB_PurPOSelOnlyItem",
  SP_ITEM_PICKER_INDENT: "fn_tbl_RB_PurPOSelIndtItem",
  SP_ITEM_PICKER_QUOT: "fn_tbl_RB_PurPOSelQuotItem",
  SP_INDENT_SUMMARY: "Fn_tbl_FetchIndentSummaryItem4PO",
  SP_SUPPLIER_INFO: "Fn_tbl_FetchSupplierCurrencyInfo",
  SP_EXISTING_POS: "Fn_tbl_FetchPurOrderListForAmend",
  SP_UNIQUE_ID: "Pr_Gen_FetchLevyUniqueNo4Web",
  SP_DEPT: PURCHASE_API.SP_DEPT,

  SP_MASTER_FILL: "fn_tbl_RB_PurPOMst",
  SP_DETAIL_FILL: "fn_tbl_RB_PurPODet",
  SP_INDT_DETAIL_FILL: "fn_tbl_RB_PurPOIndtDet",
  SP_GRID_EVENT: "fn_tbl_RB_PurPODet_Event",

  BASED_ON_OPTIONS: [BASED_ON.DIRECT, BASED_ON.INDENT_WISE, BASED_ON.QUOTATION],

  SUPPLIER_GRID_COLUMNS: PURCHASE_SUPPLIER_GRID_COLUMNS,
  INDENT_FRM_OPTION: 0,

  SAVE_ENDPOINT: "/API/PurPOSave/Post_RB_PurPOMst_Save",

  STORAGE_HEADER_META: "poHeaderMeta",
  STORAGE_ENTRY_META: "poEntryMeta",

  SP_PO_LIST: "Fn_tbl_Pur_POMst_List",
  LIST_DIVISION_ID: 0,
};

export const PO_HEADER_FILTERS = [
  {
    FilterParameterID: "TranCode",
    FilterColName: "TranCode",
    FilterCaption: "PO No.",
    FilterColCtrlType: controlTypeMap.TEXTBOX,
  },
  {
    FilterParameterID: "TranDate",
    FilterColName: "TranDate",
    FilterCaption: "Date",
    FilterColCtrlType: controlTypeMap.DATE,
  },
  {
    FilterParameterID: "DivisionID",
    FilterColName: "DivisionID",
    FilterCaption: "Division",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  {
    FilterParameterID: "ConfigID",
    FilterColName: "ConfigID",
    FilterCaption: "PO Type",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  {
    FilterParameterID: "DeliveryDate",
    FilterColName: "DeliveryDate",
    FilterCaption: "Delivery Date",
    FilterColCtrlType: controlTypeMap.DATE,
  },
  {
    FilterParameterID: "SupplierID",
    FilterColName: "SupplierID",
    FilterCaption: "Supplier",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  {
    FilterParameterID: "DeptID",
    FilterColName: "DeptID",
    FilterCaption: "Department",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  {
    FilterParameterID: "BasedOnID",
    FilterColName: "BasedOnID",
    FilterCaption: "Based On",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: PO_CONFIG.BASED_ON_OPTIONS,
  },
  {
    FilterParameterID: "CurrencyName",
    FilterColName: "CurrencyName",
    FilterCaption: "Currency",
    FilterColCtrlType: controlTypeMap.LABEL,
  },
  {
    FilterParameterID: "CurrencyRate",
    FilterColName: "CurrencyRate",
    FilterCaption: "Currency Rate",
    FilterColCtrlType: controlTypeMap.LABEL,
  },
  {
    FilterParameterID: "CreditDays",
    FilterColName: "CreditDays",
    FilterCaption: "Cr. Days",
    FilterColCtrlType: controlTypeMap.TEXTBOX,
  },
  {
    FilterParameterID: "Remarks",
    FilterColName: "Remarks",
    FilterCaption: "Remarks",
    FilterColCtrlType: controlTypeMap.TEXTAREA,
  },
];

export const PO_MASTER = {
  headerFields: PO_HEADER_FILTERS,
  summaryFields: PURCHASE_GST_SUMMARY_FIELDS,
};

export const PO_GRID_TABS = [
  { id: "items", label: "Item Grid" },
  { id: "terms", label: "Term And Conditions" },
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
  { headerKey: "DivisionID", label: "Division" },
  { headerKey: "TranDate", label: "Tran Date", isDate: true },
  { headerKey: "ConfigID", label: "PO Type" },
  { headerKey: "SupplierID", label: "Supplier" },
  { headerKey: "BasedOnID", label: "Based On", allowZero: true },
];

export function getMissingItemPickerHeaderFields(headerValues) {
  return getMissingPickerFields(headerValues, PO_ITEM_PICKER_JSON_FIELDS);
}
