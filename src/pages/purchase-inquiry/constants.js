// constants.js — Purchase Inquiry page config
// All RB codes, SP names, IDs, and request defaults used by this page in one place.

import { controlTypeMap } from "../../data/dummyData";

export const PI_CONFIG = {
  // RB board codes
  RB_MASTER: "RB_PurInquiryMst",
  RB_DETAIL: "RB_PurInquiryDet",
  RB_INDT_DETAIL: "RB_PurInquiryIndtDet",

  // Form identifiers
  FORM_TAG: "INQ",
  TRAN_BOOK: "PURINQUIRY",

  // Year IDs
  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2, // NOTE: confirm with backend — may be 13

  // Supplier picker
  SUPPLIER_PARTY_TYPE: "S",
  SUPPLIER_SP: "Fn_tbl_FetchCustomerSupplierTranWs4Web",

  // RB codes for item picker modal (depends on BasedOn selection)
  RB_ITEM_PICKER_DIRECT: "RB_PurInqSelOnlyItem", // BasedOn = '0' (Direct)
  RB_ITEM_PICKER_INDENT: "RB_PurInqSelIndtItem", // BasedOn = '2' (Indent wise)

  // Edit flow — GetMasterDataFill procedures
  SP_MASTER_FILL: "fn_tbl_RB_PurInquiryMst",
  SP_DETAIL_FILL: "fn_tbl_RB_PurInquiryDet",
  SP_INDT_FILL: "fn_tbl_RB_PurInquiryIndtDet",

  // SP / function names used in API calls
  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_INQUIRY_TYPES: "fn_tbl_ddl_Pur_Configuration",
  SP_INDENTS: "Fn_Tbl_FetchPurchaseItemDetailTransWs4Web",
  SP_DIVISIONS: "Fn_tbl_FetchUserWsDivision",
  SP_DEPARTMENTS: "Pr_Fetch_DepartmentData_IMS",
  SP_ITEM_PICKER: "Fn_Tbl_FetchPurchaseItemDetailTransWs4Web",
  SP_GRID_EVENT: "fn_tbl_RB_PurInquiryDet_Event",

  // Called when Indent wise is selected and user clicks Insert in the item picker.
  // Input: prmJSon = selected indent rows. Output: parent/item rows (aggregated).
  SP_INDENT_SUMMARY: "Fn_tbl_FetchIndentSummaryItem4Inquiry",

  // "Based On" dropdown options (hardcoded — not from API)
  BASED_ON_OPTIONS: [
    { value: "0", label: "Direct" },
    { value: "2", label: "Indent wise" },
  ],

  // Hardcoded columns for the Suppliers grid (Sr.No, Name, Address, City, Mobile)
  SUPPLIER_GRID_COLUMNS: [
    {
      id: "cb",
      name: "",
      key: "cb",
      controlType: -1,
      width: 48,
      isFixed: true,
      isEditAllow: false,
    },
    {
      id: "SrNo",
      name: "Sr.No",
      key: "SrNo",
      controlType: 0,
      width: 70,
      isFixed: false,
      isEditAllow: false,
    },
    {
      id: "SupplierName",
      name: "Supplier Name",
      key: "SupplierName",
      controlType: 0,
      width: 200,
      isFixed: false,
      isEditAllow: false,
    },
    {
      id: "Address",
      name: "Address",
      key: "Address",
      controlType: 0,
      width: 220,
      isFixed: false,
      isEditAllow: false,
    },
    {
      id: "City",
      name: "City",
      key: "City",
      controlType: 0,
      width: 120,
      isFixed: false,
      isEditAllow: false,
    },
    {
      id: "MobileNo",
      name: "Mobile No.",
      key: "MobileNo",
      controlType: 0,
      width: 110,
      isFixed: false,
      isEditAllow: false,
    },
  ],

  // Misc request params
  INDENT_FRM_OPTION: 0,

  // Save endpoint (REST gateway — POST with JSON body)
  SAVE_ENDPOINT: "/API/TranFormSave/Post_RB_PurInquiryMst_Save",

  // localStorage keys for cached RB meta
  STORAGE_HEADER_META: "piHeaderMeta",
  STORAGE_ENTRY_META: "piEntryMeta",
  STORAGE_INDT_META: "piIndtMeta",

  // Inquiry list (FN_Fetch_Data)
  LIST_OBJ_TYPE: 2,
  SP_INQUIRY_LIST: "Fn_tbl_Pur_InquiryMst_List",
  LIST_DIVISION_ID: 15,
};

// ── Header filter definitions — cascade order: Division → Inquiry Type → Indent ──
// Field order + control types only; captions from GET_DETAIL_COL_DATA (DisplayName).
export const PI_HEADER_FILTERS = [
  { FilterParameterID: "TranCode", FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: "TranDate", FilterColCtrlType: controlTypeMap.DATE },
  {
    FilterParameterID: "DivisionID",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  { FilterParameterID: "ConfigID", FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: "ExpectedDate", FilterColCtrlType: controlTypeMap.DATE },
  { FilterParameterID: "DeptID", FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  {
    FilterParameterID: "BasedOnID",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: PI_CONFIG.BASED_ON_OPTIONS,
  },
  { FilterParameterID: "Remarks", FilterColCtrlType: controlTypeMap.TEXTAREA },
];

export const PI_GRID_TABS = [
  { id: "items", label: "Item Grid" },
  { id: "suppliers", label: "Suppliers" },
  { id: "terms", label: "Term And Conditions" },
];

export const APPROVED_OPTS = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
];

export const TERMS_COLUMNS = ["Sr.No", "Terms Type", "Code", "Terms & Conditions"];

export const INDENT_DETAILS_COLUMNS = [
  { key: "SrNo", label: "Sr.No", width: 70 },
  { key: "IndentNo", label: "Indent No.", width: 120 },
  { key: "IndentDate", label: "Indent Date", width: 110 },
  { key: "ItemName", label: "Item Name", width: 190 },
  { key: "IndentQty", label: "Indent Qty", width: 100 },
  { key: "TranQty", label: "Tran Qty", width: 100 },
  { key: "Unit", label: "Unit", width: 80 },
];

export const PI_FILTER_INITIAL_VALUES = { BasedOnID: "0" };

export const PI_FILTER_CASCADE_RESETS = {
  DivisionID: ["ConfigID"],
};

/** Header fields mapped to Fn_Tbl_FetchPurchaseItemDetailTransWs4Web — grids clear when any changes */
export const PI_ITEM_PICKER_CONTEXT_FIELDS = new Set([
  "DivisionID",
  "TranDate",
  "ConfigID",
  "BasedOnID",
]);

// Supplier grid config (used by the Suppliers tab EntryGrid)
export const SUPPLIER_GRID_CONFIG = {
  columns: PI_CONFIG.SUPPLIER_GRID_COLUMNS,
  pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25] },
};

// Summary fields — field order + detKey only; captions from GET_DETAIL_COL_DATA.
// SummaryParameterID must match apiCol.ColName from RB_PurInquiryMst.
// export const PI_SUMMARY_FIELDS = [
//   { SummaryParameterID: "MstBaseAmount", detKey: "BaseAmount" },
//   { SummaryParameterID: "MstExpense", detKey: "Expense" },
//   { SummaryParameterID: "MstTaxableValue", detKey: "TaxableValue" },
//   { SummaryParameterID: "MstCGST", detKey: "CGST" },
//   { SummaryParameterID: "MstSGST", detKey: "SGST" },
//   { SummaryParameterID: "MstIGST", detKey: "IGST" },
//   { SummaryParameterID: "MstRoundOff", detKey: "RoundOff" },
//   { SummaryParameterID: "MstNetBaseAmount", detKey: "NetBaseAmount" },
// ];

/** Master config — headerFields + summaryFields share RB_PurInquiryMst GET_DETAIL_COL_DATA */
export const PI_MASTER = {
  headerFields: PI_HEADER_FILTERS,
  // summaryFields: PI_SUMMARY_FIELDS,
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
