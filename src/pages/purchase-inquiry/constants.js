// constants.js — Purchase Inquiry page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE     = "Purchase Inquiry";
export const PAGE_TITLE_NEW = "New Purchase Inquiry";

// All RB codes, SP names, IDs, and request defaults used by this page in one place.

import { controlTypeMap } from "../../data/dummyData";
import {
  APPROVED_FILTER_OPTS,
  BASED_ON,
  DEFAULT_BASED_ON_FILTER_VALUES,
  INDENT_DETAILS_COLUMNS,
  PURCHASE_API,
  PURCHASE_SUPPLIER_GRID_COLUMNS,
  PURCHASE_SUPPLIER_GRID_CONFIG,
  TERMS_COLUMNS,
} from "../../constants/purchaseCommon";
import { formatTranDate } from "../../utils/dateFormat";
import {
  getMissingItemPickerHeaderFields as getMissingPickerFields,
} from "../../utils/purchaseItemPicker";

export { formatTranDate };
export { APPROVED_FILTER_OPTS as APPROVED_OPTS };
export { TERMS_COLUMNS };
export { INDENT_DETAILS_COLUMNS };
export { DEFAULT_BASED_ON_FILTER_VALUES as PI_FILTER_INITIAL_VALUES };
export const PI_FILTER_CASCADE_RESETS = { divisionid: ["configid"] };

export const PI_CONFIG = {
  ...PURCHASE_API,
  SP_INQUIRY_TYPES: PURCHASE_API.SP_CONFIG_TYPES,

  RB_MASTER: "rb_purinquirymst",
  DELETE_PROC_NAME: "pr_rb_purinquirymst_delete",
  RB_DETAIL: "rb_purinquirydet",
  RB_INDT_DETAIL: "rb_purinquiryindtdet",

  FORM_TAG: "INQ",
  TRAN_BOOK: "PURINQUIRY",

  RB_ITEM_PICKER_DIRECT: "rb_purinqselonlyitem",
  RB_ITEM_PICKER_INDENT: "rb_purinqselindtitem",

  SP_MASTER_FILL: "fn_tbl_rb_purinquirymst",
  SP_DETAIL_FILL: "fn_tbl_rb_purinquirydet",
  SP_INDT_FILL: "fn_tbl_rb_purinquiryindtdet",

  SP_DEPARTMENTS: PURCHASE_API.SP_DEPT,
  SP_ITEM_PICKER_DIRECT: "fn_tbl_rb_purinqselonlyitem",
  SP_ITEM_PICKER_INDENT: "fn_tbl_rb_purinqselindtitem",
  SP_GRID_EVENT: "fn_tbl_rb_purinquirydet_event",
  SP_INDENT_SUMMARY: "fn_tbl_fetchindentsummaryitem4inquiry",

  BASED_ON_OPTIONS: [BASED_ON.DIRECT, BASED_ON.INDENT_WISE],

  SUPPLIER_GRID_COLUMNS: PURCHASE_SUPPLIER_GRID_COLUMNS,
  INDENT_FRM_OPTION: 0,

  SAVE_ENDPOINT: "/API/TranFormSave/Post_RB_PurInquiryMst_Save",

  STORAGE_HEADER_META: "piHeaderMeta",
  STORAGE_ENTRY_META: "piEntryMeta",
  STORAGE_INDT_META: "piIndtMeta",

  SP_INQUIRY_LIST: "fn_tbl_pur_inquirymst_list",
  LIST_DIVISION_ID: 15,
};

export const PI_HEADER_FILTERS = [
  { FilterParameterID: "trancode",     FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: "trandate",     FilterColCtrlType: controlTypeMap.DATE },
  {
    FilterParameterID: "divisionid",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  { FilterParameterID: "configid",     FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: "expecteddate", FilterColCtrlType: controlTypeMap.DATE },
  { FilterParameterID: "deptid",       FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  {
    FilterParameterID: "basedonid",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: PI_CONFIG.BASED_ON_OPTIONS,
  },
  { FilterParameterID: "remarks",      FilterColCtrlType: controlTypeMap.TEXTAREA },
];

export const PI_GRID_TABS = [
  { id: "items", label: "Item Grid" },
  { id: "suppliers", label: "Suppliers" },
  { id: "terms", label: "Term And Conditions" },
];

/** Header fields mapped to item picker FN_FETCH_DATA JSON — grids clear when any changes */
export const PI_ITEM_PICKER_CONTEXT_FIELDS = new Set([
  "divisionid",
  "trandate",
  "configid",
  "basedonid",
]);

export const PI_ITEM_PICKER_JSON_FIELDS = [
  { headerKey: "divisionid", label: "Division" },
  { headerKey: "trandate",   label: "Tran Date", isDate: true },
  { headerKey: "configid",   label: "Inquiry Type" },
  { headerKey: "basedonid",  label: "Based On", allowZero: true },
];

export function getMissingItemPickerHeaderFields(headerValues) {
  return getMissingPickerFields(headerValues, PI_ITEM_PICKER_JSON_FIELDS, { basedOnKey: "basedonid" });
}

export function buildItemPickerJsonPayload(headerValues, loginId) {
  return {
    prmdivisionid: Number(headerValues.divisionid) || 0,
    prmyearid:     PI_CONFIG.CONFIG_YEAR_ID,
    prmloginid:    loginId,
    prmtrandate:   formatTranDate(headerValues.trandate),
    prmconfigid:   Number(headerValues.configid) || 0,
    prmsupplierid: Number(headerValues.supplierid ?? 0),
    prmtranbook:   PI_CONFIG.TRAN_BOOK,
    prmfrmoption:  Number(headerValues.basedonid) || 0,
  };
}

export const SUPPLIER_GRID_CONFIG = PURCHASE_SUPPLIER_GRID_CONFIG;

export const PI_MASTER = {
  headerFields: PI_HEADER_FILTERS,
};
