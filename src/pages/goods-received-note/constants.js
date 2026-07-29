// constants.js — Goods Received Note (GRN) page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE     = "Goods Received Note";
export const PAGE_TITLE_NEW = "New Goods Received Note";


// Source of truth: MRD_Template4GRN.docx (Richa, 10-Jun-2026).



import {

  APPROVED_FILTER_OPTS,

  BASED_ON,

  CURRENCY_READONLY_FIELDS,

  DEFAULT_BASED_ON_FILTER_VALUES,

  PURCHASE_API,

} from "../../constants/purchaseCommon";

import { formatTranDate } from "../../utils/dateFormat";

import {

  buildItemPickerJsonPayload as buildPickerPayload,

  getMissingItemPickerHeaderFields as getMissingPickerFields,

  resolveBasedOnPickerCode,

} from "../../utils/purchaseItemPicker";

import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";



export { formatTranDate };

export { APPROVED_FILTER_OPTS as APPROVED_OPTS };

export { DEFAULT_BASED_ON_FILTER_VALUES as GRN_FILTER_INITIAL_VALUES };

export { CURRENCY_READONLY_FIELDS as GRN_READONLY_FIELDS };



/**
 * Columns that support multi-value paste (Serial Number replication).
 * Both keys are listed because the live column name differs by backend project —
 * "batchsrno" on IMS_LIVE, "batchnosrno" on IMS_PGLIVE (verified against GetDetailColData,
 * same as PV's PV_MULTI_PASTE_COLUMNS). GRN only listed "batchnosrno", so paste-driven
 * row replication silently did nothing on IMS_LIVE, where the column is "batchsrno".
 */
export const GRN_MULTI_PASTE_COLUMNS = new Set(["batchsrno", "batchnosrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const GRN_REMARK_COLUMNS = new Set(["remarks"]);

export const GRN_CONFIG = {

  ...PURCHASE_API,

  SP_GRN_TYPES: PURCHASE_API.SP_CONFIG_TYPES,



  RB_MASTER: RB_CODES.GOODS_RECEIVED_NOTE,
  ROUTE_PATH: rbRoutePath(RB_CODES.GOODS_RECEIVED_NOTE),
  DELETE_PROC_NAME: "pr_rb_purgrnmst_delete",

  RB_DETAIL: "rb_purgrndet",

  RB_INDT_DETAIL: "rb_purgrnindtdet",



  FORM_TAG: "PG",

  TRAN_BOOK: "PG",



  RB_ITEM_PICKER_DIRECT: "rb_purgrnselonlyitem",

  RB_ITEM_PICKER_PO: "rb_purgrnselpodet",

  RB_ITEM_PICKER_INDENT: "rb_purgrnselindtdet",



  SP_MASTER_FILL: "fn_tbl_rb_purgrnmst",

  SP_DETAIL_FILL: "fn_tbl_rb_purgrndet",

  SP_INDT_FILL: "fn_tbl_rb_purgrnindtdet",



  SP_ITEM_PICKER_DIRECT: "fn_tbl_rb_purgrnselonlyitem",

  SP_ITEM_PICKER_PO: "fn_tbl_rb_purgrnselpodet",

  SP_ITEM_PICKER_INDENT: "fn_tbl_rb_purgrnselindtdet",

  SP_GRID_EVENT: "fn_tbl_rb_purgrndet_event",

  SP_TRANSPORTERS: "fn_tbl_gen_fetchtransporter",

  SP_DESTINATIONS: "fn_tbl_gen_fetchdestination",

  /** Division-wise location — same SP as Purchase Indent's Location cascade. */
  SP_LOCATION: "fn_tbl_fetch_divwslocation",

  SP_INDENT_SUMMARY: "fn_tbl_fetchindentsummaryitem4grn",

  // Select Item popup filters (Based On = Direct only) — same rollout as
  // Purchase Indent (2026-07-28). Popup-filter SPs live-verified working.
  // fn_tbl_rb_purgrnselonlyitem (SP_ITEM_PICKER_DIRECT) now accepts
  // @prmmaingroupid/@prmsubmaingroupid — live-confirmed 2026-07-28 (used to
  // throw "Must declare the scalar variable ...", that's gone). Wired in
  // handleApplyItemFilter.
  SP_ITEM_MAIN_GROUP: "fn_fetch_itemmaingroup4popupfilter",
  SP_ITEM_SUB_MAIN_GROUP: "fn_fetch_itemsubmaingroup4popupfilter",



  // BASED_ON_OPTIONS: [BASED_ON.DIRECT, BASED_ON.PO_BASE, BASED_ON.INDENT_BASE], ## No need GRN BASED ON INDENT.
  BASED_ON_OPTIONS: [BASED_ON.DIRECT, BASED_ON.PO_BASE],



  SAVE_ENDPOINT: "/API/PurGRNSave/Post_RB_PurInwardMst_Save",



  STORAGE_HEADER_META: "grnHeaderMeta",

  STORAGE_ENTRY_META: "grnEntryMeta",

  STORAGE_INDT_META: "grnIndtMeta",



  SP_GRN_LIST: "fn_tbl_rb_purgrnmst_list",

  LIST_DIVISION_ID: 15,

};



export const GRN_LIST_DROPDOWN_FIELDS = new Set([

  "divisionid",

  "configid",

  "supplierid",

  "transporterid",

  "destinationid",

  "vehicletypeid",

  "locationid",

]);



// Header field DEFINITIONS (caption, control type, lock state, validation) are no
// longer hand-maintained here — they're built straight from the live RB metadata
// (see syncedHeaderFilters/syncedTransporterFilters/syncedDriverFilters in
// GoodsReceivedNoteForm.jsx). A static list silently drops any RB field nobody
// remembers to add here — that's exactly how `locationid` went missing (both
// unrendered AND unvalidated) despite being mandatory in the live RB.
//
// The one thing the RB genuinely can't tell us is *which of GRN's three tabs*
// a field belongs to (Item Grid header / Transporter / Driver) — that's a UI
// layout decision, not RB data. These two membership sets are the only static
// config left; every other RB-visible field not listed here falls into the
// main header group by default.
export const GRN_TRANSPORTER_FIELD_NAMES = new Set([
  "transporterid",
  "destinationid",
  "lrno",
  "lrdate",
  "vehicleno",
  "vehicletypeid",
  "noofperson",
]);

export const GRN_DRIVER_FIELD_NAMES = new Set([
  "drivername",
  "drivercontactno",
  "driverlicenceno",
]);



export const GRN_GRID_TABS = [

  { id: "items", label: "Item Grid" },

  { id: "transporter", label: "Transporter" },

  { id: "driver", label: "Driver" },

];



export const GRN_FILTER_CASCADE_RESETS = {

  divisionid: [

    "configid",

    "locationid",

    "supplierid",

    "currencyname",

    "currencyrate",

    "transporterid",

    "destinationid",

  ],

  transporterid: ["destinationid"],

};



/** Header fields that invalidate the item grid when changed */

export const GRN_ITEM_PICKER_CONTEXT_FIELDS = new Set([

  "divisionid",

  "trandate",

  "configid",

  "supplierid",

  "basedonid",

]);



export const GRN_ITEM_PICKER_JSON_FIELDS = [

  { headerKey: "divisionid", label: "Division" },

  { headerKey: "trandate", label: "GRN Date", isDate: true },

  { headerKey: "configid", label: "GRN Type" },

  { headerKey: "basedonid", label: "Based On", allowZero: true },

  { headerKey: "supplierid", label: "Supplier", requiredWhenBasedOn: 1 },

];



export function getMissingItemPickerHeaderFields(headerValues) {

  return getMissingPickerFields(headerValues, GRN_ITEM_PICKER_JSON_FIELDS);

}



export function buildItemPickerJsonPayload(headerValues, loginId) {

  const base = buildPickerPayload(headerValues, loginId, {

    configYearId: getUserSession().yearId,

    tranBook: GRN_CONFIG.TRAN_BOOK,

  });

  // Item picker (fn_tbl_rb_purgrnselonlyitem / fn_tbl_rb_purgrnselpodet) needs
  // prmlocationid — the selected Location dropdown — right after prmsupplierid.
  // Not in the shared buildItemPickerJsonPayload since other purchase modules
  // (PO, Voucher, ...) don't have a Location header field.
  const { prmtranbook, prmfrmoption, ...rest } = base;

  return {

    ...rest,

    prmlocationid: Number(headerValues.locationid ?? headerValues.LocationID ?? 0),

    prmtranbook,

    prmfrmoption,

  };

}



export function resolveItemPickerRbCode(basedOnId) {

  return resolveBasedOnPickerCode(basedOnId, {

    routes: [

      { when: 1, code: GRN_CONFIG.RB_ITEM_PICKER_PO },

      { when: 3, code: GRN_CONFIG.RB_ITEM_PICKER_INDENT },

      { default: true, code: GRN_CONFIG.RB_ITEM_PICKER_DIRECT },

    ],

  });

}



/** FN_FETCH_DATA ObjName for item picker rows — mirrors resolveItemPickerRbCode. */

export function resolveItemPickerSpName(basedOnId) {

  return resolveBasedOnPickerCode(basedOnId, {

    routes: [

      { when: 1, code: GRN_CONFIG.SP_ITEM_PICKER_PO },

      { when: 3, code: GRN_CONFIG.SP_ITEM_PICKER_INDENT },

      { default: true, code: GRN_CONFIG.SP_ITEM_PICKER_DIRECT },

    ],

  });

}

