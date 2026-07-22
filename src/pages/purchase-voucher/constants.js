// constants.js — Purchase Voucher page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE     = "Purchase Voucher";
export const PAGE_TITLE_NEW = "New Purchase Voucher";

// All RB codes, SP names, IDs, and request defaults for the PV module.
// Values aligned to MRD_Template4PV.docx (Richa, 10-Jun-2026).

import { BASED_ON, PURCHASE_API } from "../../constants/purchaseCommon";
import { formatTranDate } from "../../utils/dateFormat";
import { getMissingItemPickerHeaderFields as getMissingPickerFields } from "../../utils/purchaseItemPicker";


export { formatTranDate as formatPVTranDate };
export const PV_CONFIG = {
  ...PURCHASE_API,
  SP_PV_TYPES: PURCHASE_API.SP_CONFIG_TYPES,

  RB_MASTER: "rb_purpvmst",
  DELETE_PROC_NAME: "pr_rb_purpvmst_delete",
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

  // Division-wise Location — same SP + cascade contract as GRN/Purchase Indent's fetchLocations.
  SP_LOCATION: "fn_tbl_fetch_divwslocation",

  // Grid cell-event SP (fires on qty / rate column blur)
  SP_GRID_EVENT: "fn_tbl_rb_purpvdet_event",

  SP_MASTER_FILL: "fn_tbl_rb_purpvmst",
  SP_DETAIL_FILL: "fn_tbl_rb_purpvdet",

  SAVE_ENDPOINT: "/API/PurPVSave/Post_RB_PurPVMst_Save",

  STORAGE_HEADER_META: "pvHeaderMeta",
  STORAGE_ENTRY_META: "pvEntryMeta",

  // Purchase Voucher listing
  LIST_OBJ_TYPE: 2,
  SP_PV_LIST: "fn_tbl_rb_purpvmst_list",
  LIST_DIVISION_ID: 0, // ⚠️ CONFIRM with DBA — MRD says 15; using 0 (all divisions) pending confirmation

  // "Based On" dropdown — MRD: GRN Base | PO Base | Direct
  BASED_ON_OPTIONS: [
    { value: "0", label: "GRN Base" },
    { value: "1", label: "PO Base" },
    { value: "2", label: "Direct" },
  ],
};

// Header field DEFINITIONS (caption, control type, lock state, validation) are no
// longer hand-maintained here — they're built straight from the live RB metadata
// (see syncedFilters in PurchaseVoucherForm.jsx), same fix applied to GRN. A static
// list silently drops any RB field nobody remembers to add here, both from render
// AND validation.

export const PV_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const PV_FILTER_CASCADE_RESETS = {
  divisionid: ["configid", "supplierid", "locationid"],
};

export const PV_SUMMARY_FIELDS = [
  // ── Tax breakdown (ColSeqNo 23-30) — sums from detail rows, excluding
  // rows where puttouse = 0 (see PV_SUMMARY_ROW_FILTER below — verified
  // against a live fn_tbl_rb_purpvdet response where a puttouse=0 row's
  // tax figures were excluded from the master's stored totals) ──
  { SummaryParameterID: "mstbaseamount", detKey: "baseamount" },
  { SummaryParameterID: "mstexpense", detKey: "expense" },
  { SummaryParameterID: "msttaxablevalue", detKey: "taxablevalue" },
  { SummaryParameterID: "mstcgst", detKey: "cgst" },
  { SummaryParameterID: "mstsgst", detKey: "sgst" },
  { SummaryParameterID: "mstigst", detKey: "igst" },
  // roundoff/netbaseamount have NO per-line equivalent at all on the detail
  // grid (fn_tbl_rb_purpvdet has no roundoff/netbaseamount column) — same
  // "can't be summed, must read from master" case as the TDS section below.
  { SummaryParameterID: "mstroundoff", detKey: "roundoff", fromMaster: true },
  { SummaryParameterID: "mstnetbaseamount", detKey: "netbaseamount", fromMaster: true },
  // ── TDS section (ColSeqNo 17-22, 31) — header/master-level values, no
  // per-line equivalent exists on the detail grid at all (TDS is computed
  // once per voucher from the supplier's TDS settings, not per item). Read
  // directly from the loaded master row on edit instead of summing grid
  // rows — summing always produced 0 here since no detail row ever carries
  // these columns. See EnterpriseSummaryPanel's `fromMaster` handling.
  { SummaryParameterID: "nopid", detKey: "nopid", fromMaster: true },
  { SummaryParameterID: "tdsapplicableamount", detKey: "tdsapplicableamount", fromMaster: true },
  { SummaryParameterID: "tdstypeid", detKey: "tdstypeid", fromMaster: true },
  { SummaryParameterID: "tdspercentage", detKey: "tdspercentage", fromMaster: true },
  { SummaryParameterID: "tdsamount", detKey: "tdsamount", fromMaster: true },
  { SummaryParameterID: "pendingtdsamount", detKey: "pendingtdsamount", fromMaster: true },
  { SummaryParameterID: "netpayable", detKey: "netpayable", fromMaster: true },
];

// Excludes rows the backend itself excludes from the master's stored totals
// (confirmed live: a detail row with puttouse=0 carried real tax figures
// that were NOT reflected in mstbaseamount/msttaxablevalue/mstcgst/mstsgst
// on the saved master). Passed as EnterpriseSummaryPanel's `rowFilter`.
export function PV_SUMMARY_ROW_FILTER(row) {
  return Number(row.puttouse) !== 0;
}

// RB marks these visible as header columns, but they're computed from grid
// rows and rendered via EnterpriseSummaryPanel (see syncedSummaryFields), not
// real header inputs. Must be excluded from the RB-driven header filter/
// validation set (visibleHeaderColumns in PurchaseVoucherForm.jsx) or they'd
// render as blank filter fields and fail "required" validation before the
// grid-derived totals ever get merged into headerValuesRef at save time.
export const PV_SUMMARY_FIELD_NAMES = new Set(PV_SUMMARY_FIELDS.map((f) => f.SummaryParameterID));

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
 * Both keys are listed because the live column name differs by backend project —
 * "batchsrno" on IMS_LIVE, "batchnosrno" on IMS_PGLIVE (verified against GetDetailColData).
 */
export const PV_MULTI_PASTE_COLUMNS = new Set(["batchsrno", "batchnosrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const PV_REMARK_COLUMNS = new Set(["remarks"]);

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
