// constants.js — Supplier Master page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE     = "Supplier Master";
export const PAGE_TITLE_NEW = "New Supplier";
export const MODAL_TITLE_ADD  = "New Supplier";
export const MODAL_TITLE_EDIT = "Edit Supplier";
export const MODAL_SUBTITLE   = "Admin › Master › Supplier";

// RB codes, SP names, IDs — live-verified 2026-07-02 against rb_suppliermst
// (RBID 10112) and rb_consigneedet (RBID 10113). Source: MRD_Template4SupplierMaster.docx
// + live GetDetailColData checks. Live schema wins over the MRD wherever they disagree.
import { controlTypeMap } from "../../data/dummyData";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import { isMasterFieldVisible } from "../../utils/masterFormUtils";

export const SM_CONFIG = {
  RB_MASTER: RB_CODES.SUPPLIER_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.SUPPLIER_MASTER),
  RB_DETAIL: "rb_consigneedet",

  FORM_TAG: "SM",
  TRAN_BOOK: "SM",

  // Customer Master shares this exact table/RB codes/SPs — "S" vs "C" in the
  // master row's "prmentrytype" field is the only thing that tells the two
  // modules' records apart.
  ENTRY_TYPE: "S",

  // ⚠️ CONFIRM with DBA — MRD flagged this as uncertain
  LIST_DIVISION_ID: 15,

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_suppliermst",
  SP_DETAIL_FILL: "fn_tbl_rb_consigneedet",

  // Cascading dropdowns not covered by the generic GET_FILTER_DETAIL mechanism
  // (State/City need a parent ID parameter) — fetched directly.
  SP_STATE: "fn_tbl_statemst_fatch",
  SP_CITY: "fn_tbl_citymst_fatch",

  // Header dropdowns — explicit fn_tbl_* calls (not the generic RBID-driven
  // GET_FILTER_DETAIL mechanism). All live-verified 2026-07-03 via direct
  // FN_Fetch_Data calls (ObjType=2, zero params, [{}]); every SP below is
  // confirmed to exist and returns rows in the shape noted.
  SP_CATEGORY: "fn_tbl_lookupmst_fetch",             // → {idnumber, lookupdesc}
  SP_ACCOUNT_GROUP: "fn_tbl_accountgroup_fatch",     // → {idnumber, grpname}
  SP_COUNTRY: "fn_tbl_countrymst_fatch",             // → {idnumber, countryname}
  SP_REGISTRATION_TYPE: "fn_tbl_registrationtype_fatch", // → {idnumber, name}
  SP_CURRENCY: "fn_tbl_currency_fatch",              // → {idnumber, currencycode}
  SP_TRANSPORTER: "fn_tbl_transporter_fatch",        // → zero params; no rows in this env yet (data gap, not wiring)
  SP_TRANSPORTER_DESTINATION: "fn_tbl_transpoterdestination_fatch", // → zero params, no header cascade documented in MRD
  SP_DEDUCTEE_TYPE: "fn_tbl_tdsdeducteetype_fatch",  // → {idnumber, name}
  // ⚠️ DBA-CONFIRM — NOP (nopid): MRD names "ACC_TDSNatureOfPaymentMaster" as the
  // source, but live-verified 2026-07-03 that it is a raw DB TABLE, not a
  // function/procedure — FN_Fetch_Data rejects it under both ObjType 1 and 2
  // ("is a table object" / "not a function"). No working fn_tbl_* wrapper exists
  // yet. NOP dropdown ships with an empty option list until DBA adds one.
  SP_NOP: null,

  // ⚠️ CONFIRM with DBA — not live-verified; MRD name used as-is
  LIST_OBJ_TYPE: 2,
  SP_LIST: "Fn_tbl_SupplierMst_List",

  // Shared with Customer Master (same rb_suppliermst table — see ENTRY_TYPE note
  // above); CM_CONFIG inherits this via its `...SM_CONFIG` spread.
  DELETE_PROC_NAME: "pr_rb_suppliermst_delete",

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
  "supcode", "supname", "partyname","catrgoryid", "accountgroupid", 
  "address", "mailingaddress", "countryid", "stateid", "cityid",
  "zipcode", "district", "msmedate", "msmeno", "registrationtypeid",
  "gstno","panno", "currencyid", "crlimit", "creditamt",
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

// ⚠️ Live RB bug (confirmed 2026-07-27 via GetDetailColData?prmMasterID=10112) —
// "panno"'s displayname comes back as "IFSC Code" (an exact copy-paste
// duplicate of the ifsccode column right before it, same colseqno too).
// Same override pattern as SM_CHECKBOX_OVERRIDE_FIELDS below.
export const SM_LABEL_OVERRIDES = {
  panno: "PAN No",
};

// tds is a Textbox in the live RB (colctrltype 1), but the MRD requires it to
// gate the Deductee Type / NOP fields as a checkbox — same override pattern as
// ItemMasterForm.jsx's CHECKBOX_OVERRIDES.
export const SM_CHECKBOX_OVERRIDE_FIELDS = new Set(["tds"]);

/**
 * Section layout — each section is a flat, ordered field list (not paired
 * into rows) — the form renders each section's fields into a uniform 3-per-
 * row CSS grid that auto-flows and wraps, instead of hand-curated 1-or-2-
 * field rows. All sections render full-width, stacked top to bottom (no
 * left/right column split) so a 3-column grid has real room to breathe.
 * All field names are live PG lowercase colnames. Consignee Detail is NOT
 * part of this layout — it stays a data grid, rendered as its own
 * full-width section below (currently unused, see SupplierMasterForm.jsx).
 */
export const SM_FORM_LAYOUT = {
  main: {
    fields: [
      "supcode", "supname", "partyname", "catrgoryid", "accountgroupid",
      "address", "mailingaddress", "countryid", "stateid", "cityid",
      "zipcode", "district", "msmedate", "msmeno", "registrationtypeid",
      "gstno", "panno", "currencyid", "crlimit", "creditamt",
    ],
  },
  transporter: {
    title: "Transporter Detail",
    fields: ["transporterid", "transpoterdestinationid"],
  },
  tds: {
    title: "TDS Deduction",
    fields: ["tds", "deducteetypeid", "nopid"],
  },
  bank: {
    title: "Bank Information",
    fields: [
      "bankname", "bankaddress", "branch", "beneficiaryname",
      "bankmobileno", "accountno", "accounttype", "ifsccode",
    ],
  },
  contact: {
    title: "Contacts",
    fields: ["contactperson", "designation", "emailaddress", "mobileno"],
  },
};

/**
 * Resolve a layout field name against a fieldMap keyed by lowercase colname.
 * Fields the RB has flagged IsVisible=false are omitted, same as the shared
 * getVisibleHeaderFields/getVisibleGridFields pattern used elsewhere.
 */
export function resolveSmLayoutField(fieldMap, colname) {
  if (!colname) return null;
  const field = fieldMap[colname] ?? null;
  if (!field || !isMasterFieldVisible(field)) return null;
  return field;
}

/** Resolve a section's flat field-name list into real field objects. */
export function resolveSmLayoutFields(fields, fieldMap) {
  return fields.map((name) => resolveSmLayoutField(fieldMap, name)).filter(Boolean);
}

/** Ordered flat field list for validation / save — keyed by lowercase colname. */
export function getSmLayoutFieldNames(fieldMap = null) {
  const names = [];
  const pushFields = (fields) => {
    fields.forEach((colname) => {
      if (fieldMap) {
        const field = resolveSmLayoutField(fieldMap, colname);
        if (field) names.push(field.colname);
      } else {
        names.push(colname);
      }
    });
  };
  pushFields(SM_FORM_LAYOUT.main.fields);
  pushFields(SM_FORM_LAYOUT.transporter.fields);
  pushFields(SM_FORM_LAYOUT.tds.fields);
  pushFields(SM_FORM_LAYOUT.bank.fields);
  pushFields(SM_FORM_LAYOUT.contact.fields);
  return names;
}

export { controlTypeMap };
