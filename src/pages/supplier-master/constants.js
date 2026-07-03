// constants.js — Supplier Master page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE     = "Supplier Master";
export const PAGE_TITLE_NEW = "New Supplier";

// RB codes, SP names, IDs — live-verified 2026-07-02 against rb_suppliermst
// (RBID 10112) and rb_consigneedet (RBID 10113). Source: MRD_Template4SupplierMaster.docx
// + live GetDetailColData checks. Live schema wins over the MRD wherever they disagree.
import { controlTypeMap } from "../../data/dummyData";

export const SM_CONFIG = {
  RB_MASTER: "rb_suppliermst",
  RB_DETAIL: "rb_consigneedet",

  FORM_TAG: "SM",
  TRAN_BOOK: "SM",

  // ⚠️ CONFIRM with DBA — MRD flagged these as uncertain
  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,
  LIST_DIVISION_ID: 15,

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_suppliermst",
  SP_DETAIL_FILL: "fn_tbl_rb_consigneedet",

  // Cascading dropdowns not covered by the generic GET_FILTER_DETAIL mechanism
  // (State/City need a parent ID parameter) — fetched directly.
  SP_STATE: "fn_tbl_statemst_fatch",
  SP_CITY: "fn_tbl_citymst_fatch",

  // ⚠️ CONFIRM with DBA — not live-verified; MRD name used as-is
  LIST_OBJ_TYPE: 2,
  SP_LIST: "Fn_tbl_SupplierMst_List",

  SAVE_ENDPOINT: "/API/SupplierMst/Post_RB_SupplierMst_Save",

  // Own key — MRD mistakenly listed Purchase Inquiry's "piHeaderMeta" (copy-paste
  // leftover from the template); using an SM-specific key avoids a localStorage collision.
  STORAGE_HEADER_META: "smHeaderMeta",
  STORAGE_ENTRY_META: "smEntryMeta",
};

// ── Header field blocks — live schema all comes from one flat GetDetailColData
// response (RBID 10112); these Sets just group colnames into the MRD's 5 visual
// blocks. Pattern mirrors Purchase Order's DROPDOWN_OPTIONS_BY_COL approach
// (colname-keyed, control type read live) rather than GRN's older per-block
// FilterColCtrlType arrays.
export const SM_CORE_FIELDS = new Set([
  "supcode", "supname", "catrgoryid", "accountgroupid", "partyname",
  "address", "mailingaddress", "countryid", "stateid", "cityid",
  "zipcode", "district", "msmedate", "msmeno", "registrationtypeid",
  "gstno", "currencyid", "crlimit", "creditamt",
]);

export const SM_CONTACTS_FIELDS = new Set([
  "contactperson", "designation", "emailaddress", "mobileno",
]);

// Live colname/valuecol is "transpoter..." (typo) — kept exactly as-is; must
// match the live RB column name for save round-trip to work.
export const SM_TRANSPORTER_FIELDS = new Set([
  "transporterid", "transpoterdestinationid",
]);

export const SM_TDS_FIELDS = new Set(["tds", "deducteetypeid", "nopid"]);

export const SM_BANK_FIELDS = new Set([
  "bankname", "bankaddress", "branch", "beneficiaryname",
  "bankmobileno", "accountno", "accounttype", "ifsccode",
]);

// tds is a Textbox in the live RB (colctrltype 1), but the MRD requires it to
// gate the Deductee Type / NOP fields as a checkbox — same override pattern as
// ItemMasterForm.jsx's CHECKBOX_OVERRIDES.
export const SM_CHECKBOX_OVERRIDE_FIELDS = new Set(["tds"]);

export const SM_TABS = [
  { id: "contacts", label: "Contacts" },
  { id: "transporter", label: "Transporter Detail" },
  { id: "tds", label: "TDS Deduction" },
  { id: "bank", label: "Bank Information" },
  { id: "consignee", label: "Consignee Detail" },
];

// Cascade: Country clears State + City; State clears City. The MRD's own text
// ("When State changes → clear Country") is backwards — State depends on
// Country, not the reverse — so this implements the sensible reading instead.
export const SM_FILTER_CASCADE_RESETS = {
  countryid: ["stateid", "cityid"],
  stateid: ["cityid"],
};

export { controlTypeMap };
