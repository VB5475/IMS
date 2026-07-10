// Shared constants across purchase module pages (PO, PI, PQ, GRN, Indent, PV).

/** SP / API names reused by every purchase transaction module. */
export const PURCHASE_API = {
  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_DIVISIONS: "fn_tbl_fetchuserwsdivision",
  SP_CONFIG_TYPES: "fn_tbl_ddl_pur_configuration",
  // SP_DEPT: "pr_fetch_departmentdata_ims",
  SP_DEPT: "fn_tbl_tbd_departmentdata_ims",
  SUPPLIER_PARTY_TYPE: "S",
  SUPPLIER_SP: "fn_tbl_fetchcustomersuppliertranws4web",
  LIST_OBJ_TYPE: 2,
};

/** Reusable "Based On" option entries — compose per-module lists in constants. */
export const BASED_ON = {
  DIRECT: { value: "0", label: "Direct" },
  PO_BASE: { value: "1", label: "PO base" },
  INDENT_WISE: { value: "2", label: "Indent wise" },
  INDENT_BASE: { value: "3", label: "Indent base" },
  QUOTATION: { value: "3", label: "Quotation" },
  INQUIRY_BASED: { value: "2", label: "Inquiry Based" },
  GRN_BASE: { value: "0", label: "GRN Base" },
  PO_BASE_PV: { value: "1", label: "PO Base" },
};

export const APPROVED_FILTER_OPTS = [
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

/** GST summary fields — SummaryParameterID/detKey match RB master/detail ColName (API returns lowercase). */
export const PURCHASE_GST_SUMMARY_FIELDS = [
  { SummaryParameterID: "mstbaseamount", detKey: "baseamount" },
  { SummaryParameterID: "mstexpense", detKey: "expense" },
  { SummaryParameterID: "msttaxablevalue", detKey: "taxablevalue" },
  { SummaryParameterID: "mstcgst", detKey: "cgst" },
  { SummaryParameterID: "mstsgst", detKey: "sgst" },
  { SummaryParameterID: "mstigst", detKey: "igst" },
  { SummaryParameterID: "mstroundoff", detKey: "roundoff" },
  { SummaryParameterID: "mstnetbaseamount", detKey: "netbaseamount" },
];

export const CURRENCY_READONLY_FIELDS = ["currencyid", "currencyrate"];

export const DEFAULT_BASED_ON_FILTER_VALUES = { basedonid: "0" };

/** Division change → clear config type (common cascade). */
export const DIVISION_CONFIG_CASCADE_RESET = { DivisionID: ["ConfigID"] };

/** Read-only supplier picker grid columns (Inquiry / PO suppliers tab). */
export const PURCHASE_SUPPLIER_GRID_COLUMNS = [
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
];

export const PURCHASE_SUPPLIER_GRID_CONFIG = {
  columns: PURCHASE_SUPPLIER_GRID_COLUMNS,
  pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25] },
};
