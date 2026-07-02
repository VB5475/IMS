// constants.js — Goods Received Note (GRN) page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE     = "Goods Received Note";
export const PAGE_TITLE_NEW = "New Goods Received Note";


// Source of truth: MRD_Template4GRN.docx (Richa, 10-Jun-2026).



import { controlTypeMap } from "../../data/dummyData";

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



export { formatTranDate };

export { APPROVED_FILTER_OPTS as APPROVED_OPTS };

export { DEFAULT_BASED_ON_FILTER_VALUES as GRN_FILTER_INITIAL_VALUES };

export { CURRENCY_READONLY_FIELDS as GRN_READONLY_FIELDS };



export const GRN_CONFIG = {

  ...PURCHASE_API,

  SP_GRN_TYPES: PURCHASE_API.SP_CONFIG_TYPES,



  RB_MASTER: "rb_purgrnmst",

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

  SP_INDENT_SUMMARY: "fn_tbl_fetchindentsummaryitem4grn",



  BASED_ON_OPTIONS: [BASED_ON.DIRECT, BASED_ON.PO_BASE, BASED_ON.INDENT_BASE],



  SAVE_ENDPOINT: "/API/PurGRNSave/Post_RB_PurInwardMst_Save",



  STORAGE_HEADER_META: "grnHeaderMeta",

  STORAGE_ENTRY_META: "grnEntryMeta",

  STORAGE_INDT_META: "grnIndtMeta",



  SP_GRN_LIST: "fn_tbl_pur_grnmst_list",

  LIST_DIVISION_ID: 15,

};



export const GRN_LIST_DROPDOWN_FIELDS = new Set([

  "divisionid",

  "configid",

  "supplierid",

  "transporterid",

  "destinationid",

  "vehicletypeid",

]);



export const GRN_HEADER_FILTERS = [

  { FilterParameterID: "trancode", FilterColCtrlType: controlTypeMap.TEXTBOX },

  { FilterParameterID: "trandate", FilterColCtrlType: controlTypeMap.DATE },

  {

    FilterParameterID: "divisionid",

    FilterColCtrlType: controlTypeMap.DROPDOWN,

    staticOptions: [],

  },

  { FilterParameterID: "configid", FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },

  {

    FilterParameterID: "supplierid",

    FilterColCtrlType: controlTypeMap.DROPDOWN,

    staticOptions: [],

  },

  { FilterParameterID: "currencyname", FilterColCtrlType: controlTypeMap.LABEL },

  { FilterParameterID: "currencyrate", FilterColCtrlType: controlTypeMap.TEXTBOX },

  {

    FilterParameterID: "basedonid",

    FilterColCtrlType: controlTypeMap.DROPDOWN,

    staticOptions: GRN_CONFIG.BASED_ON_OPTIONS,

  },

  { FilterParameterID: "billno", FilterColCtrlType: controlTypeMap.TEXTBOX },

  { FilterParameterID: "billdate", FilterColCtrlType: controlTypeMap.DATE },

  { FilterParameterID: "challanno", FilterColCtrlType: controlTypeMap.TEXTBOX },

  { FilterParameterID: "challandate", FilterColCtrlType: controlTypeMap.DATE },

  { FilterParameterID: "remarks", FilterColCtrlType: controlTypeMap.TEXTBOX },

];



export const GRN_TRANSPORTER_FILTERS = [

  {

    FilterParameterID: "transporterid",

    FilterColCtrlType: controlTypeMap.DROPDOWN,

    staticOptions: [],

  },

  {

    FilterParameterID: "destinationid",

    FilterColCtrlType: controlTypeMap.DROPDOWN,

    staticOptions: [],

  },

  { FilterParameterID: "lrno", FilterColCtrlType: controlTypeMap.TEXTBOX },

  { FilterParameterID: "lrdate", FilterColCtrlType: controlTypeMap.DATE },

  { FilterParameterID: "vehicleno", FilterColCtrlType: controlTypeMap.TEXTBOX },

  {

    FilterParameterID: "vehicletypeid",

    FilterColCtrlType: controlTypeMap.DROPDOWN,

    staticOptions: [],

  },

  { FilterParameterID: "noofperson", FilterColCtrlType: controlTypeMap.TEXTBOX },

];



export const GRN_DRIVER_FILTERS = [

  { FilterParameterID: "drivername", FilterColCtrlType: controlTypeMap.TEXTBOX },

  { FilterParameterID: "drivercontactno", FilterColCtrlType: controlTypeMap.TEXTBOX },

  { FilterParameterID: "driverlicenceno", FilterColCtrlType: controlTypeMap.TEXTBOX },

];



export const GRN_GRID_TABS = [

  { id: "items", label: "Item Grid" },

  { id: "transporter", label: "Transporter" },

  { id: "driver", label: "Driver" },

];



export const GRN_FILTER_CASCADE_RESETS = {

  divisionid: [

    "configid",

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

  const payload = buildPickerPayload(headerValues, loginId, {

    configYearId: GRN_CONFIG.CONFIG_YEAR_ID,

    tranBook: GRN_CONFIG.TRAN_BOOK,

  });

  return {

    prmdivisionid: payload.prmDivisionID,

    prmyearid:     payload.prmYearID,

    prmloginid:    payload.prmLoginID,

    prmtrandate:   payload.prmTranDate,

    prmconfigid:   payload.prmConfigID,

    prmsupplierid: payload.prmSupplierID,

    prmtranbook:   payload.prmTranBook,

    prmfrmoption:  payload.prmFrmOption,

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

