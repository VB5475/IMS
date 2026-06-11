// constants.js — Purchase Order page config
// All RB codes, SP names, IDs, and request defaults for the PO module.
// Values aligned to MRD_Template4PO.docx (Richa, 09-Jun-2026).

import { controlTypeMap } from "../../data/dummyData";

export const PO_CONFIG = {
  // RB board codes
  RB_MASTER: "RB_PurPOMst",
  RB_DETAIL: "RB_PurPODet",
  RB_INDT_DETAIL: "RB_PurPOIndtDet",

  // Form identifiers
  FORM_TAG: "PO",
  TRAN_BOOK: "PO",

  // Year IDs
  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  // Supplier picker
  SUPPLIER_PARTY_TYPE: "S",
  SUPPLIER_SP: "Fn_tbl_FetchCustomerSupplierTranWs4Web",

  // RB codes for item picker modal
  RB_ITEM_PICKER_DIRECT: "RB_PurPOSelOnlyItem", // BasedOn = '0' (Direct)
  RB_ITEM_PICKER_INDENT: "RB_PurPOSelIndtItem", // BasedOn = '2' (Indent wise)

  // SP / function names
  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_PO_TYPES: "fn_tbl_ddl_Pur_Configuration",
  SP_DIVISIONS: "Fn_tbl_FetchUserWsDivision",
  SP_ITEM_PICKER: "Fn_Tbl_FetchPurchaseItemDetailTransWs4Web",
  SP_INDENT_SUMMARY: "Fn_tbl_FetchIndentSummaryItem4PO",
  SP_CURRENCIES: "Fn_tbl_FetchCurrencyList",
  SP_SUPPLIER_INFO: "Fn_tbl_FetchSupplierCurrencyInfo",
  SP_EXISTING_POS: "Fn_tbl_FetchPurOrderListForAmend",
  SP_UNIQUE_ID: "Pr_Gen_FetchLevyUniqueNo4Web",
  SP_DEPT: "Pr_Fetch_DepartmentData_IMS",

  // Grid cell-event SP (fires on qty / rate column blur)
  SP_GRID_EVENT: "fn_tbl_RB_PurPODet_Event",

  // "Based On" dropdown — MRD: Direct | Indent wise | Quotation only
  BASED_ON_OPTIONS: [
    { value: "0", label: "Direct" },
    { value: "2", label: "Indent wise" },
    { value: "3", label: "Quotation" },
  ],

  // Hardcoded columns for the Suppliers grid
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

  INDENT_FRM_OPTION: 0,
  // Item picker in indent mode sources from PI — use PURINQUIRY as prmTranBook
  INDENT_SOURCE_BOOK: "PURINQUIRY",

  // Save endpoint (REST POST via API_BASE_URL_IMS)
  SAVE_ENDPOINT: "/API/PurPOSave/Post_RB_PurPOMst_Save",

  // localStorage keys for cached RB meta
  STORAGE_HEADER_META: "poHeaderMeta",
  STORAGE_ENTRY_META: "poEntryMeta",

  // Purchase Order listing
  LIST_OBJ_TYPE: 2,
  SP_PO_LIST: "Fn_tbl_Pur_POMst_List",
  LIST_DIVISION_ID: 0,
};

// ── Header filter definitions ────────────────────────────────────────────────
// Field order per MRD: TranCode → TranDate → DivisionID → ConfigID →
//   DeliveryDate → SupplierID → DeptID → BasedOnID →
//   CurrencyID → CurrencyRate → CreditDays → Remarks
// Amend checkbox is rendered separately in the page component.
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

export const PO_GRID_TABS = [
  { id: "items", label: "Item Grid" },
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

// Summary fields — detKey maps detail row columns; mstKey maps master save payload keys.
// Used by EnterpriseSummaryPanel (reactive live totals + getSummary() for Save API).
// detKey must match the exact field name returned by fn_tbl_RB_PurPODet_Event response.
export const PO_SUMMARY_FIELDS = [
  { detKey: "BaseAmount", label: "Base Amount", mstKey: "MstBaseAmount" },
  { detKey: "Expense", label: "Expense", mstKey: "MstExpense" },
  { detKey: "TaxableValue", label: "Taxable Value", mstKey: "MstTaxableValue" },
  { detKey: "CGST", label: "CGST", mstKey: "MstCGST" },
  { detKey: "SGST", label: "SGST", mstKey: "MstSGST" },
  { detKey: "IGST", label: "IGST", mstKey: "MstIGST" },
  { detKey: "RoundOff", label: "Round Off", mstKey: "MstRoundOff" },
  { detKey: "NetBaseAmount", label: "Net Base Amount", mstKey: "MstNetBaseAmount" },
];

export const PO_FILTER_INITIAL_VALUES = { BasedOnID: "0" };

// ── Keyboard shortcut labels (used for ActionBar button titles) ──────────────
export const PO_SHORTCUT_CONFIG = {
  a: { label: "Add", title: "Add (Alt+A)" },
  s: { label: "Save", title: "Save (Alt+S)" },
  n: { label: "Cancel", title: "Cancel (Alt+N)" },
  c: { label: "Close", title: "Close (Alt+C)" },
};

// Cascade resets: Division change → clear PO Type (ConfigID)
export const PO_FILTER_CASCADE_RESETS = {
  DivisionID: ["ConfigID"],
};

export const SUPPLIER_GRID_CONFIG = {
  columns: PO_CONFIG.SUPPLIER_GRID_COLUMNS,
  pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25] },
};

// Formats a date value as "dd-Mon-yyyy" for API params.
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
  return `${dd}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}
