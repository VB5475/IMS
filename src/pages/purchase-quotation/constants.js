// constants.js — Purchase Quotation page config
// All RB codes, SP names, IDs, and request defaults used by this page in one place.
// Source of truth: MRD_Template4Qtn.docx (Module Requirements — Purchase Quotation).

import { controlTypeMap } from "../../data/dummyData";
import {
  APPROVED_FILTER_OPTS,
  BASED_ON,
  CURRENCY_READONLY_FIELDS,
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
export { CURRENCY_READONLY_FIELDS as QTN_READONLY_FIELDS };
export { DEFAULT_BASED_ON_FILTER_VALUES as QTN_FILTER_INITIAL_VALUES };

export const QTN_CONFIG = {
  ...PURCHASE_API,
  SP_QUOTATION_TYPES: PURCHASE_API.SP_CONFIG_TYPES,

  RB_MASTER: "RB_PurQtnMst",
  RB_DETAIL: "RB_PurQtnDet",

  FORM_TAG: "PQ",
  TRAN_BOOK: "PURQTN",

  RB_ITEM_PICKER_DIRECT: "RB_PurQtnSelOnlyItem",
  RB_ITEM_PICKER_INQUIRY: "RB_PurQtnSelInqItem",

  SP_MASTER_FILL: "fn_tbl_RB_PurQtnMst",
  SP_DETAIL_FILL: "fn_tbl_RB_PurQtnDet",

  SP_ITEM_PICKER_DIRECT: "fn_tbl_RB_PurQtnSelOnlyItem",
  SP_ITEM_PICKER_INQUIRY: "fn_tbl_RB_PurQtnSelInqItem",
  SP_GRID_EVENT: "fn_tbl_RB_PurQtnDet_Event",

  BASED_ON_OPTIONS: [BASED_ON.DIRECT, BASED_ON.INQUIRY_BASED],

  SAVE_ENDPOINT: "/API/PurQtnSave/Post_RB_PurQtnMst_Save",

  STORAGE_HEADER_META: "pqHeaderMeta",
  STORAGE_ENTRY_META: "pqEntryMeta",

  SP_QUOTATION_LIST: "Fn_tbl_Pur_QtnMst_List",
  LIST_DIVISION_ID: 15,
};

export const QTN_LIST_DROPDOWN_FIELDS = new Set(["DivisionID", "ConfigID", "SupplierID"]);

export const QTN_HEADER_FILTERS = [
  { FilterParameterID: "TranCode", FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: "TranDate", FilterColCtrlType: controlTypeMap.DATE },
  {
    FilterParameterID: "DivisionID",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  { FilterParameterID: "ConfigID", FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: "InquiryExpiryDate", FilterColCtrlType: controlTypeMap.DATE },
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
    staticOptions: QTN_CONFIG.BASED_ON_OPTIONS,
  },
  { FilterParameterID: "SuppQuotNo", FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: "SuppQuotDate", FilterColCtrlType: controlTypeMap.DATE },
  { FilterParameterID: "ContactPerson", FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: "Remarks", FilterColCtrlType: controlTypeMap.TEXTAREA },
];

export const QTN_GRID_TABS = [
  { id: "items", label: "Item Grid" },
  { id: "terms", label: "Term And Conditions" },
];

export const QTN_SUMMARY_FIELDS = PURCHASE_GST_SUMMARY_FIELDS;

export const QTN_MASTER = {
  headerFields: QTN_HEADER_FILTERS,
  summaryFields: QTN_SUMMARY_FIELDS,
};

export const QTN_FILTER_CASCADE_RESETS = {
  DivisionID: ["ConfigID", "SupplierID", "CurrencyID", "CurrencyRate"],
};

export const QTN_ITEM_PICKER_CONTEXT_FIELDS = new Set([
  "DivisionID",
  "TranDate",
  "ConfigID",
  "SupplierID",
  "BasedOnID",
]);

export const QTN_ITEM_PICKER_JSON_FIELDS = [
  { headerKey: "DivisionID", label: "Division" },
  { headerKey: "TranDate", label: "Tran Date", isDate: true },
  { headerKey: "ConfigID", label: "Quotation Type" },
  { headerKey: "SupplierID", label: "Supplier" },
  { headerKey: "BasedOnID", label: "Based On", allowZero: true },
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
