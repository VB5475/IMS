// constants.js — Purchase Voucher page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE     = "Purchase Voucher";
export const PAGE_TITLE_NEW = "New Purchase Voucher";

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

  RB_MASTER: "rb_purpvmst",
  RB_DETAIL: "rb_purpvdet",

  FORM_TAG: "PV",
  TRAN_BOOK: "PR",

  // Supplier picker
  SUPPLIER_PARTY_TYPE: "S",
  SUPPLIER_SP: "fn_tbl_fetchcustomersuppliertranws4web",

  // RB codes for item picker modal (3 modes based on BasedOnID)
  RB_ITEM_PICKER_GRN: "rb_purpvselgrndet",    // BasedOn = '0' (GRN Base)
  RB_ITEM_PICKER_PO: "rb_purpvselpodet",     // BasedOn = '1' (PO Base)
  RB_ITEM_PICKER_DIRECT: "rb_purpvselonlyitem",  // BasedOn = '2' (Direct)

  // SP / function names
  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_PV_TYPES: "fn_tbl_ddl_pur_configuration",
  SP_DIVISIONS: "fn_tbl_fetchuserwsdivision",
  SP_ITEM_PICKER_GRN: "fn_tbl_rb_purpvselgrndet",    // BasedOn = '0' (GRN Base)
  SP_ITEM_PICKER_PO: "fn_tbl_rb_purpvselpodet",     // BasedOn = '1' (PO Base)
  SP_ITEM_PICKER_DIRECT: "fn_tbl_rb_purpvselonlyitem",  // BasedOn = '2' (Direct)
  SP_SUPPLIER_INFO: "fn_tbl_fetchsuppliercurrencyinfo",
  SP_COST_CENTER: "fn_tbl_fas_fetchcostcenterac",
  SP_DEPT: "pr_fetch_departmentdata_ims",

  // Grid cell-event SP (fires on qty / rate column blur)
  SP_GRID_EVENT: "fn_tbl_rb_purpvdet_event",

  SP_MASTER_FILL: "fn_tbl_rb_purpvmst",
  SP_DETAIL_FILL: "fn_tbl_rb_purpvdet",

  SAVE_ENDPOINT: "/API/PurPVSave/Post_RB_PurPVMst_Save",

  STORAGE_HEADER_META: "pvHeaderMeta",
  STORAGE_ENTRY_META: "pvEntryMeta",

  // Purchase Voucher listing
  LIST_OBJ_TYPE: 2,
  SP_PV_LIST: "fn_tbl_pur_pvmst_list",
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
    FilterParameterID: "trancode",
    FilterColName: "trancode",
    FilterCaption: "PR No.",
    FilterColCtrlType: controlTypeMap.TEXTBOX,
  },
  {
    FilterParameterID: "trandate",
    FilterColName: "trandate",
    FilterCaption: "Date",
    FilterColCtrlType: controlTypeMap.DATE,
  },
  {
    FilterParameterID: "divisionid",
    FilterColName: "divisionid",
    FilterCaption: "Division",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  {
    FilterParameterID: "configid",
    FilterColName: "configid",
    FilterCaption: "PR Type",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  {
    FilterParameterID: "basedonid",
    FilterColName: "basedonid",
    FilterCaption: "Based On",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: PV_CONFIG.BASED_ON_OPTIONS,
  },
  {
    FilterParameterID: "supplierid",
    FilterColName: "supplierid",
    FilterCaption: "Supplier",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  {
    FilterParameterID: "currencyname",
    FilterColName: "currencyname",
    FilterCaption: "Currency",
    FilterColCtrlType: controlTypeMap.LABEL,
  },
  {
    FilterParameterID: "currencyrate",
    FilterColName: "currencyrate",
    FilterCaption: "Currency Rate",
    FilterColCtrlType: controlTypeMap.LABEL,
  },
  {
    FilterParameterID: "billno",
    FilterColName: "billno",
    FilterCaption: "Bill No.",
    FilterColCtrlType: controlTypeMap.TEXTBOX,
  },
  {
    FilterParameterID: "billdate",
    FilterColName: "billdate",
    FilterCaption: "Bill Date",
    FilterColCtrlType: controlTypeMap.DATE,
  },
  {
    FilterParameterID: "costcenterid",
    FilterColName: "costcenterid",
    FilterCaption: "Cost Center",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  {
    FilterParameterID: "creditstartdate",
    FilterColName: "creditstartdate",
    FilterCaption: "Cr. Start Date",
    FilterColCtrlType: controlTypeMap.DATE,
  },
  {
    FilterParameterID: "narration",
    FilterColName: "narration",
    FilterCaption: "Narration",
    FilterColCtrlType: controlTypeMap.TEXTAREA,
  },
  {
    FilterParameterID: "remarks",
    FilterColName: "remarks",
    FilterCaption: "Remarks",
    FilterColCtrlType: controlTypeMap.TEXTAREA,
  },
];

export const PV_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const PV_FILTER_CASCADE_RESETS = {
  divisionid: ["configid", "supplierid"],
};

export const PV_SUMMARY_FIELDS = [
  // ── Tax breakdown (ColSeqNo 23-30) — sums from detail rows ──
  { SummaryParameterID: "mstbaseamount", detKey: "baseamount" },
  { SummaryParameterID: "mstexpense", detKey: "expense" },
  { SummaryParameterID: "msttaxablevalue", detKey: "taxablevalue" },
  { SummaryParameterID: "mstcgst", detKey: "cgst" },
  { SummaryParameterID: "mstsgst", detKey: "sgst" },
  { SummaryParameterID: "mstigst", detKey: "igst" },
  { SummaryParameterID: "mstroundoff", detKey: "roundoff" },
  { SummaryParameterID: "mstnetbaseamount", detKey: "netbaseamount" },
  // ── TDS section (ColSeqNo 17-22, 31) — detKey confirmed pending backend ──
  { SummaryParameterID: "nopid", detKey: "nopid" },
  { SummaryParameterID: "tdsapplicableamount", detKey: "tdsapplicableamount" },
  { SummaryParameterID: "tdstypeid", detKey: "tdstypeid" },
  { SummaryParameterID: "tdspercentage", detKey: "tdspercentage" },
  { SummaryParameterID: "tdsamount", detKey: "tdsamount" },
  { SummaryParameterID: "pendingtdsamount", detKey: "pendingtdsamount" },
  { SummaryParameterID: "netpayable", detKey: "netpayable" },
];

export const PV_SHORTCUT_CONFIG = {
  a: { label: "Add", title: "Add (Alt+A)" },
  s: { label: "Save", title: "Save (Alt+S)" },
  n: { label: "Cancel", title: "Cancel (Alt+N)" },
};

// const MONTH_ABBR = [
//   "Jan", "Feb", "Mar", "Apr", "May", "Jun",
//   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
// ];

// export function formatPVTranDate(dateVal) {
//   if (!dateVal) return "0";
//   const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
//   if (isNaN(d.getTime())) return "0";
//   return `${String(d.getDate()).padStart(2, "0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
// }

/**
 * Columns that support multi-value paste (Serial Number replication) in Direct mode.
 * Reuse pattern: each module exports its own Set with the relevant column key(s).
 */
export const PV_MULTI_PASTE_COLUMNS = new Set(["batchnosrno"]);

/** Header fields required before Select Item can be opened */
export const PV_ITEM_PICKER_JSON_FIELDS = [
  { headerKey: "divisionid", label: "Division" },
  { headerKey: "trandate", label: "Tran Date", isDate: true },
  { headerKey: "configid", label: "PR Type" },
  { headerKey: "supplierid", label: "Supplier" },
  { headerKey: "basedonid", label: "Based On", allowZero: true },
];

export function getMissingItemPickerHeaderFields(headerValues) {
  return getMissingPickerFields(headerValues, PV_ITEM_PICKER_JSON_FIELDS);
}
