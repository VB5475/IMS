// constants.js — Purchase Quotation page config
// All RB codes, SP names, IDs, and request defaults used by this page in one place.
// Source of truth: MRD_Template4Qtn.docx (Module Requirements — Purchase Quotation).

import { controlTypeMap } from "../../data/dummyData";

export const QTN_CONFIG = {
  // RB board codes
  RB_MASTER: "RB_PurQtnMst",
  RB_DETAIL: "RB_PurQtnDet",

  // Form identifiers
  FORM_TAG: "PQ", // passed as PrmFormTag for the Quotation Type dropdown
  TRAN_BOOK: "PURQTN",

  // Year IDs
  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  // Supplier picker (used to fill the Supplier header dropdown)
  SUPPLIER_PARTY_TYPE: "S",
  SUPPLIER_SP: "Fn_tbl_FetchCustomerSupplierTranWs4Web",

  // RB codes for item picker modal (depends on BasedOn selection)
  RB_ITEM_PICKER_DIRECT: "RB_PurQtnSelOnlyItem", // BasedOn = '0' (Direct)
  RB_ITEM_PICKER_INQUIRY: "RB_PurQtnSelInqItem", // BasedOn = '2' (Inquiry Based)

  // Edit flow — GetMasterDataFill procedures
  SP_MASTER_FILL: "fn_tbl_RB_PurQtnMst",
  SP_DETAIL_FILL: "fn_tbl_RB_PurQtnDet",

  // SP / function names used in API calls
  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_QUOTATION_TYPES: "fn_tbl_ddl_Pur_Configuration",
  SP_DIVISIONS: "Fn_tbl_FetchUserWsDivision",
  SP_ITEM_PICKER: "Fn_Tbl_FetchInquiryItemDetail4Web",
  SP_GRID_EVENT: "fn_tbl_RB_PurQtnDet_Event",

  // "Based On" dropdown options (hardcoded — not from API)
  BASED_ON_OPTIONS: [
    { value: "0", label: "Direct" },
    { value: "2", label: "Inquiry Based" },
  ],

  // Save endpoint (REST gateway — POST with JSON body)
  SAVE_ENDPOINT: "/API/PurQtnSave/Post_RB_PurQtnMst_Save",

  // localStorage keys for cached RB meta
  STORAGE_HEADER_META: "pqHeaderMeta",
  STORAGE_ENTRY_META: "pqEntryMeta",

  // Quotation list (FN_Fetch_Data)
  LIST_OBJ_TYPE: 2,
  SP_QUOTATION_LIST: "Fn_tbl_Pur_QtnMst_List",
  LIST_DIVISION_ID: 15,
};

// ── Header filter definitions ──
// Cascade order: Division → Quotation Type / Supplier.
// Field order + control types only; captions from GET_DETAIL_COL_DATA (DisplayName).
// FilterParameterID must match apiCol.ColName from RB_PurQtnMst.
export const QTN_LIST_DROPDOWN_FIELDS = new Set(["DivisionID", "ConfigID", "SupplierID"]);

export const QTN_HEADER_FILTERS = [
  { FilterParameterID: "TranCode", FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: "TranDate", FilterColCtrlType: controlTypeMap.DATE },
  {
    FilterParameterID: "DivisionID",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  { FilterParameterID: "ConfigID", FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: "InquiryExpiryDate", FilterColCtrlType: controlTypeMap.DATE },
  {
    FilterParameterID: "SupplierID",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  { FilterParameterID: "CurrencyID", FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: "CurrencyRate", FilterColCtrlType: controlTypeMap.TEXTBOX },
  {
    FilterParameterID: "BasedOnID",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: QTN_CONFIG.BASED_ON_OPTIONS,
  },
  { FilterParameterID: "SuppQuotNo", FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: "SuppQuotDate", FilterColCtrlType: controlTypeMap.DATE },
  { FilterParameterID: "ContactPerson", FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: "Remarks", FilterColCtrlType: controlTypeMap.TEXTAREA },
];

// Header fields that are always read-only (doc: Is ReadOnly = Yes), even in
// edit mode. Currency is system-derived; the user never types into it.
export const QTN_READONLY_FIELDS = ["CurrencyID"];

export const QTN_GRID_TABS = [
  { id: "items", label: "Item Grid" },
  { id: "terms", label: "Term And Conditions" },
];

export const APPROVED_OPTS = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
];

export const TERMS_COLUMNS = ["Sr.No", "Terms Type", "Code", "Terms & Conditions"];

// ── Summary field definitions ──
// Field order + detKey only; captions from GET_DETAIL_COL_DATA (DisplayName).
// SummaryParameterID must match apiCol.ColName from RB_PurQtnMst.
// detKey must match detail grid column summed (fn_tbl_RB_PurQtnDet_Event).
export const QTN_SUMMARY_FIELDS = [
  { SummaryParameterID: "MstBaseAmount", detKey: "BaseAmount" },
  { SummaryParameterID: "MstExpense", detKey: "Expense" },
  { SummaryParameterID: "MstTaxableValue", detKey: "TaxableValue" },
  { SummaryParameterID: "MstCGST", detKey: "CGST" },
  { SummaryParameterID: "MstSGST", detKey: "SGST" },
  { SummaryParameterID: "MstIGST", detKey: "IGST" },
  { SummaryParameterID: "MstRoundOff", detKey: "RoundOff" },
  { SummaryParameterID: "MstNetBaseAmount", detKey: "NetBaseAmount" },
];

/** Master config — headerFields + summaryFields share RB_PurQtnMst GET_DETAIL_COL_DATA */
export const QTN_MASTER = {
  headerFields: QTN_HEADER_FILTERS,
  summaryFields: QTN_SUMMARY_FIELDS,
};

// Default value for "Based On" — Direct ('0').
export const QTN_FILTER_INITIAL_VALUES = { BasedOnID: "0" };

export const QTN_FILTER_CASCADE_RESETS = {
  DivisionID: ["ConfigID", "SupplierID", "CurrencyID", "CurrencyRate"],
};

// Formats a date value as "dd-Mon-yyyy" (e.g. "02-Jun-2026") for API params.
const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export function formatTranDate(dateVal) {
  if (!dateVal) return "0";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return "0";
  const dd = String(d.getDate()).padStart(2, "0");
  const mon = MONTH_ABBR[d.getMonth()];
  return `${dd}-${mon}-${d.getFullYear()}`;
}
