// constants.js — Purchase Voucher page config
// All RB codes, SP names, IDs, and request defaults for the PV module.
// Values aligned to MRD_Template4PV.docx (Richa, 10-Jun-2026).

import { controlTypeMap } from "../../data/dummyData";
import { BASED_ON, PURCHASE_API } from "../../constants/purchaseCommon";
import { formatTranDate } from "../../utils/dateFormat";
import { getMissingItemPickerHeaderFields as getMissingPickerFields } from "../../utils/purchaseItemPicker";

export { formatTranDate as formatPVTranDate };

export const PV_CONFIG = {
  ...PURCHASE_API,
  SP_PV_TYPES: PURCHASE_API.SP_CONFIG_TYPES,

  RB_MASTER: "RB_PurPVMst",
  RB_DETAIL: "RB_PurPVDet",

  FORM_TAG: "PV",
  TRAN_BOOK: "PR",

  // Year IDs
  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  // Supplier picker
  SUPPLIER_PARTY_TYPE: "S",
  SUPPLIER_SP: "Fn_tbl_FetchCustomerSupplierTranWs4Web",

  // RB codes for item picker modal (3 modes based on BasedOnID)
  RB_ITEM_PICKER_GRN: "RB_PurPVSelGRNDet",    // BasedOn = '0' (GRN Base)
  RB_ITEM_PICKER_PO: "RB_PurPVSelPODet",     // BasedOn = '1' (PO Base)
  RB_ITEM_PICKER_DIRECT: "RB_PurPVSelOnlyItem",  // BasedOn = '2' (Direct)

  // SP / function names
  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_PV_TYPES: "fn_tbl_ddl_Pur_Configuration",
  SP_DIVISIONS: "Fn_tbl_FetchUserWsDivision",
  SP_ITEM_PICKER_GRN: "fn_tbl_RB_PurPVSelGRNDet",    // BasedOn = '0' (GRN Base)
  SP_ITEM_PICKER_PO: "fn_tbl_RB_PurPVSelPODet",     // BasedOn = '1' (PO Base)
  SP_ITEM_PICKER_DIRECT: "fn_tbl_RB_PurPVSelOnlyItem",  // BasedOn = '2' (Direct)
  SP_SUPPLIER_INFO: "Fn_tbl_FetchSupplierCurrencyInfo",
  SP_COST_CENTER: "Fn_tbl_Fas_FetchCostCenterAc",
  SP_DEPT: "Pr_Fetch_DepartmentData_IMS",

  // Grid cell-event SP (fires on qty / rate column blur)
  SP_GRID_EVENT: "fn_tbl_RB_PurPVDet_Event",

  SP_MASTER_FILL: "fn_tbl_RB_PurPVMst",
  SP_DETAIL_FILL: "fn_tbl_RB_PurPVDet",

  SAVE_ENDPOINT: "/API/PurPVSave/Post_RB_PurPVMst_Save",

  STORAGE_HEADER_META: "pvHeaderMeta",
  STORAGE_ENTRY_META: "pvEntryMeta",

  // Purchase Voucher listing
  LIST_OBJ_TYPE: 2,
  SP_PV_LIST: "Fn_tbl_Pur_PVMst_List",
  LIST_DIVISION_ID: 0, // ⚠️ CONFIRM with DBA — MRD says 15; using 0 (all divisions) pending confirmation

  // "Based On" dropdown — MRD: GRN Base | PO Base | Direct
  BASED_ON_OPTIONS: [
    { value: "0", label: "GRN Base" },
    { value: "1", label: "PO Base" },
    { value: "2", label: "Direct" },
  ],
};

// ── Header filter definitions ─────────────────────────────────────────────────
// Field order per MRD Section 3:
//   TranCode → TranDate → DivisionID → ConfigID → BasedOnID →
//   SupplierID → CurrencyID → CurrencyRate →
//   BillNo → BillDate → CostCenterID →
//   CreditStartDate → Narration → Remarks
export const PV_HEADER_FILTERS = [
  {
    FilterParameterID: "TranCode",
    FilterColName: "TranCode",
    FilterCaption: "PR No.",
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
    FilterCaption: "PR Type",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  {
    FilterParameterID: "BasedOnID",
    FilterColName: "BasedOnID",
    FilterCaption: "Based On",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: PV_CONFIG.BASED_ON_OPTIONS,
  },
  {
    FilterParameterID: "SupplierID",
    FilterColName: "SupplierID",
    FilterCaption: "Supplier",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
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
    FilterParameterID: "BillNo",
    FilterColName: "BillNo",
    FilterCaption: "Bill No.",
    FilterColCtrlType: controlTypeMap.TEXTBOX,
  },
  {
    FilterParameterID: "BillDate",
    FilterColName: "BillDate",
    FilterCaption: "Bill Date",
    FilterColCtrlType: controlTypeMap.DATE,
  },
  {
    FilterParameterID: "CostCenterID",
    FilterColName: "CostCenterID",
    FilterCaption: "Cost Center",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  {
    FilterParameterID: "CreditStartDate",
    FilterColName: "CreditStartDate",
    FilterCaption: "Cr. Start Date",
    FilterColCtrlType: controlTypeMap.DATE,
  },
  {
    FilterParameterID: "Narration",
    FilterColName: "Narration",
    FilterCaption: "Narration",
    FilterColCtrlType: controlTypeMap.TEXTAREA,
  },
  {
    FilterParameterID: "Remarks",
    FilterColName: "Remarks",
    FilterCaption: "Remarks",
    FilterColCtrlType: controlTypeMap.TEXTAREA,
  },
];

export const PV_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const PV_FILTER_CASCADE_RESETS = {
  DivisionID: ["ConfigID", "SupplierID"],
};

export const PV_SUMMARY_FIELDS = [
  // ── Tax breakdown (ColSeqNo 23-30) — sums from detail rows ──
  { SummaryParameterID: "MstBaseAmount", detKey: "BaseAmount" },
  { SummaryParameterID: "MstExpense", detKey: "Expense" },
  { SummaryParameterID: "MstTaxableValue", detKey: "TaxableValue" },
  { SummaryParameterID: "MstCGST", detKey: "CGST" },
  { SummaryParameterID: "MstSGST", detKey: "SGST" },
  { SummaryParameterID: "MstIGST", detKey: "IGST" },
  { SummaryParameterID: "MstRoundOff", detKey: "RoundOff" },
  { SummaryParameterID: "MstNetBaseAmount", detKey: "NetBaseAmount" },
  // ── TDS section (ColSeqNo 17-22, 31) — detKey confirmed pending backend ──
  { SummaryParameterID: "NOPID", detKey: "NOPID" },
  { SummaryParameterID: "TDSApplicableAmount", detKey: "TDSApplicableAmount" },
  { SummaryParameterID: "TDSTypeID", detKey: "TDSTypeID" },
  { SummaryParameterID: "TDSPercentage", detKey: "TDSPercentage" },
  { SummaryParameterID: "TDSAmount", detKey: "TDSAmount" },
  { SummaryParameterID: "PendingTDSAmount", detKey: "PendingTDSAmount" },
  { SummaryParameterID: "NetPayable", detKey: "NetPayable" },
];

export const PV_SHORTCUT_CONFIG = {
  a: { label: "Add", title: "Add (Alt+A)" },
  s: { label: "Save", title: "Save (Alt+S)" },
  n: { label: "Cancel", title: "Cancel (Alt+N)" },
};

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatPVTranDate(dateVal) {
  if (!dateVal) return "0";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return "0";
  return `${String(d.getDate()).padStart(2, "0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

/**
 * Columns that support multi-value paste (Serial Number replication) in Direct mode.
 * Reuse pattern: each module exports its own Set with the relevant column key(s).
 */
export const PV_MULTI_PASTE_COLUMNS = new Set(["BatchNoSrNo"]);

/** Header fields required before Select Item can be opened */
export const PV_ITEM_PICKER_JSON_FIELDS = [
  { headerKey: "DivisionID", label: "Division" },
  { headerKey: "TranDate", label: "Tran Date", isDate: true },
  { headerKey: "ConfigID", label: "PR Type" },
  { headerKey: "SupplierID", label: "Supplier" },
  { headerKey: "BasedOnID", label: "Based On", allowZero: true },
];

export function getMissingItemPickerHeaderFields(headerValues) {
  return getMissingPickerFields(headerValues, PV_ITEM_PICKER_JSON_FIELDS);
}
