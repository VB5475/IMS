// constants.js — Purchase Quotation page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Purchase Quotation";
export const PAGE_TITLE_NEW = "New Purchase Quotation";

// All RB codes, SP names, IDs, and request defaults used by this page in one place.
// Source of truth: MRD_Template4Qtn.docx (Module Requirements — Purchase Quotation).

import { controlTypeMap } from "../../data/dummyData";
import {
  APPROVED_FILTER_OPTS,
  BASED_ON,
  DEFAULT_BASED_ON_FILTER_VALUES,
  PURCHASE_API,
  PURCHASE_GST_SUMMARY_FIELDS,
  TERMS_COLUMNS,
} from "../../constants/purchaseCommon";
import { formatTranDate } from "../../utils/dateFormat";
import {
  buildItemPickerJsonPayload as buildPickerPayload,
  getMissingItemPickerHeaderFields as getMissingPickerFields,
} from "../../utils/purchaseItemPicker";

export { formatTranDate };
export { APPROVED_FILTER_OPTS as APPROVED_OPTS };
export { TERMS_COLUMNS };
export const QTN_READONLY_FIELDS = ["currencyname", "currencyrate"];
export { DEFAULT_BASED_ON_FILTER_VALUES as QTN_FILTER_INITIAL_VALUES };

export const QTN_CONFIG = {
  ...PURCHASE_API,
  SP_QUOTATION_TYPES: PURCHASE_API.SP_CONFIG_TYPES,

  RB_MASTER: "rb_purqtnmst",
  DELETE_PROC_NAME: "pr_rb_purqtnmst_delete",
  RB_DETAIL: "rb_purqtndet",

  FORM_TAG: "PQ",
  TRAN_BOOK: "PURQTN",

  RB_ITEM_PICKER_DIRECT: "rb_purqtnselonlyitem",
  RB_ITEM_PICKER_INQUIRY: "rb_purqtnselinqitem",

  SP_MASTER_FILL: "fn_tbl_rb_purqtnmst",
  SP_DETAIL_FILL: "fn_tbl_rb_purqtndet",

  SP_ITEM_PICKER_DIRECT: "fn_tbl_rb_purqtnselonlyitem",
  SP_ITEM_PICKER_INQUIRY: "fn_tbl_rb_purqtnselinqitem",
  SP_GRID_EVENT: "fn_tbl_rb_purqtndet_event",

  BASED_ON_OPTIONS: [BASED_ON.DIRECT, BASED_ON.INQUIRY_BASED],

  SAVE_ENDPOINT: "/API/PurQtnSave/Post_RB_PurQtnMst_Save",

  STORAGE_HEADER_META: "pqHeaderMeta",
  STORAGE_ENTRY_META: "pqEntryMeta",

  SP_QUOTATION_LIST: "fn_tbl_pur_qtnmst_list",
  LIST_DIVISION_ID: 15,
};

export const QTN_LIST_DROPDOWN_FIELDS = new Set(["divisionid", "configid", "supplierid"]);

export const QTN_HEADER_FILTERS = [
  { FilterParameterID: "trancode", FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: "trandate", FilterColCtrlType: controlTypeMap.DATE },
  {
    FilterParameterID: "divisionid",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  { FilterParameterID: "configid", FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: "inquiryexpirydate", FilterColCtrlType: controlTypeMap.DATE },
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
    staticOptions: QTN_CONFIG.BASED_ON_OPTIONS,
  },
  { FilterParameterID: "suppquotno", FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: "suppquotdate", FilterColCtrlType: controlTypeMap.DATE },
  { FilterParameterID: "contactperson", FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: "remarks", FilterColCtrlType: controlTypeMap.TEXTAREA },
];

export const QTN_GRID_TABS = [
  { id: "items", label: "Item Grid" },
  { id: "terms", label: "Terms And Conditions" },
];

export const QTN_SUMMARY_FIELDS = PURCHASE_GST_SUMMARY_FIELDS;

export const QTN_MASTER = {
  headerFields: QTN_HEADER_FILTERS,
  summaryFields: QTN_SUMMARY_FIELDS,
};

export const QTN_FILTER_CASCADE_RESETS = {
  divisionid: ["configid", "supplierid", "currencyname", "currencyrate"],
};

export const QTN_ITEM_PICKER_CONTEXT_FIELDS = new Set([
  "divisionid",
  "trandate",
  "configid",
  "supplierid",
  "basedonid",
]);

export const QTN_ITEM_PICKER_JSON_FIELDS = [
  { headerKey: "divisionid", label: "Division" },
  { headerKey: "trandate", label: "Tran Date", isDate: true },
  { headerKey: "configid", label: "Quotation Type" },
  { headerKey: "supplierid", label: "Supplier" },
  { headerKey: "basedonid", label: "Based On", allowZero: true },
];

export function getMissingItemPickerHeaderFields(headerValues) {
  return getMissingPickerFields(headerValues, QTN_ITEM_PICKER_JSON_FIELDS);
}

export function buildItemPickerJsonPayload(headerValues, loginId) {
  return buildPickerPayload(headerValues, loginId, {
    configYearId: QTN_CONFIG.CONFIG_YEAR_ID,
    tranBook: QTN_CONFIG.TRAN_BOOK,
  });
}
