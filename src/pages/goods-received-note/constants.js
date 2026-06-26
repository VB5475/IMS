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



  RB_MASTER: "RB_PurGRNMst",

  RB_DETAIL: "RB_PurGRNDet",

  RB_INDT_DETAIL: "RB_PurGRNIndtDet",



  FORM_TAG: "PG",

  TRAN_BOOK: "PG",



  RB_ITEM_PICKER_DIRECT: "RB_PurGRNSelOnlyItem",

  RB_ITEM_PICKER_PO: "RB_PurGRNSelPODet",

  RB_ITEM_PICKER_INDENT: "RB_PurGRNSelIndtDet",



  SP_MASTER_FILL: "fn_tbl_RB_PurGRNMst",

  SP_DETAIL_FILL: "fn_tbl_RB_PurGRNDet",

  SP_INDT_FILL: "fn_tbl_RB_PurGRNIndtDet",



  SP_ITEM_PICKER_DIRECT: "fn_tbl_RB_PurGRNSelOnlyItem",

  SP_ITEM_PICKER_PO: "fn_tbl_RB_PurGRNSelPODet",

  SP_ITEM_PICKER_INDENT: "fn_tbl_RB_PurGRNSelIndtDet",

  SP_GRID_EVENT: "fn_tbl_RB_PurGRNDet_Event",

  SP_TRANSPORTERS: "Fn_tbl_Gen_FetchTransporter",

  SP_DESTINATIONS: "Fn_tbl_Gen_FetchDestination",

  SP_INDENT_SUMMARY: "Fn_tbl_FetchIndentSummaryItem4GRN",



  BASED_ON_OPTIONS: [BASED_ON.DIRECT, BASED_ON.PO_BASE, BASED_ON.INDENT_BASE],



  SAVE_ENDPOINT: "/API/PurGRNSave/Post_RB_PurInwardMst_Save",



  STORAGE_HEADER_META: "grnHeaderMeta",

  STORAGE_ENTRY_META: "grnEntryMeta",

  STORAGE_INDT_META: "grnIndtMeta",



  SP_GRN_LIST: "Fn_tbl_Pur_GRNMst_List",

  LIST_DIVISION_ID: 15,

};



export const GRN_LIST_DROPDOWN_FIELDS = new Set([

  "DivisionID",

  "ConfigID",

  "SupplierID",

  "TransporterID",

  "DestinationID",

  "VehicleTypeId",

]);



export const GRN_HEADER_FILTERS = [

  { FilterParameterID: "TranCode", FilterColCtrlType: controlTypeMap.TEXTBOX },

  { FilterParameterID: "TranDate", FilterColCtrlType: controlTypeMap.DATE },

  {

    FilterParameterID: "DivisionID",

    FilterColCtrlType: controlTypeMap.DROPDOWN,

    staticOptions: [],

  },

  { FilterParameterID: "ConfigID", FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },

  {

    FilterParameterID: "SupplierID",

    FilterColCtrlType: controlTypeMap.DROPDOWN,

    staticOptions: [],

  },

  { FilterParameterID: "CurrencyID", FilterColCtrlType: controlTypeMap.TEXTBOX },

  { FilterParameterID: "CurrencyRate", FilterColCtrlType: controlTypeMap.TEXTBOX },

  {

    FilterParameterID: "BasedOnID",

    FilterColCtrlType: controlTypeMap.DROPDOWN,

    staticOptions: GRN_CONFIG.BASED_ON_OPTIONS,

  },

  { FilterParameterID: "BillNo", FilterColCtrlType: controlTypeMap.TEXTBOX },

  { FilterParameterID: "BillDate", FilterColCtrlType: controlTypeMap.DATE },

  { FilterParameterID: "ChallanNo", FilterColCtrlType: controlTypeMap.TEXTBOX },

  { FilterParameterID: "ChallanDate", FilterColCtrlType: controlTypeMap.DATE },

  { FilterParameterID: "Remarks", FilterColCtrlType: controlTypeMap.TEXTBOX },

];



export const GRN_TRANSPORTER_FILTERS = [

  {

    FilterParameterID: "TransporterID",

    FilterColCtrlType: controlTypeMap.DROPDOWN,

    staticOptions: [],

  },

  {

    FilterParameterID: "DestinationID",

    FilterColCtrlType: controlTypeMap.DROPDOWN,

    staticOptions: [],

  },

  { FilterParameterID: "LRNo", FilterColCtrlType: controlTypeMap.TEXTBOX },

  { FilterParameterID: "LRDate", FilterColCtrlType: controlTypeMap.DATE },

  { FilterParameterID: "VehicleNo", FilterColCtrlType: controlTypeMap.TEXTBOX },

  {

    FilterParameterID: "VehicleTypeId",

    FilterColCtrlType: controlTypeMap.DROPDOWN,

    staticOptions: [],

  },

  { FilterParameterID: "NoOfPerson", FilterColCtrlType: controlTypeMap.TEXTBOX },

];



export const GRN_DRIVER_FILTERS = [

  { FilterParameterID: "DriverName", FilterColCtrlType: controlTypeMap.TEXTBOX },

  { FilterParameterID: "DriverContactNo", FilterColCtrlType: controlTypeMap.TEXTBOX },

  { FilterParameterID: "DriverLicenceNo", FilterColCtrlType: controlTypeMap.TEXTBOX },

];



export const GRN_GRID_TABS = [

  { id: "items", label: "Item Grid" },

  { id: "transporter", label: "Transporter" },

  { id: "driver", label: "Driver" },

];



export const GRN_FILTER_CASCADE_RESETS = {

  DivisionID: [

    "ConfigID",

    "SupplierID",

    "CurrencyID",

    "CurrencyRate",

    "TransporterID",

    "DestinationID",

  ],

  TransporterID: ["DestinationID"],

};



/** Header fields that invalidate the item grid when changed */

export const GRN_ITEM_PICKER_CONTEXT_FIELDS = new Set([

  "DivisionID",

  "TranDate",

  "ConfigID",

  "SupplierID",

  "BasedOnID",

]);



export const GRN_ITEM_PICKER_JSON_FIELDS = [

  { headerKey: "DivisionID", label: "Division" },

  { headerKey: "TranDate", label: "GRN Date", isDate: true },

  { headerKey: "ConfigID", label: "GRN Type" },

  { headerKey: "BasedOnID", label: "Based On", allowZero: true },

  { headerKey: "SupplierID", label: "Supplier", requiredWhenBasedOn: 1 },

];



export function getMissingItemPickerHeaderFields(headerValues) {

  return getMissingPickerFields(headerValues, GRN_ITEM_PICKER_JSON_FIELDS);

}



export function buildItemPickerJsonPayload(headerValues, loginId) {

  return buildPickerPayload(headerValues, loginId, {

    configYearId: GRN_CONFIG.CONFIG_YEAR_ID,

    tranBook: GRN_CONFIG.TRAN_BOOK,

  });

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


