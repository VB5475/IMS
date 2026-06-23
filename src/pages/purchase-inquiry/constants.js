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
  DIVISION_CONFIG_CASCADE_RESET,
  INDENT_DETAILS_COLUMNS,
  PURCHASE_API,
  PURCHASE_SUPPLIER_GRID_COLUMNS,
  PURCHASE_SUPPLIER_GRID_CONFIG,
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
export { INDENT_DETAILS_COLUMNS };
export { DEFAULT_BASED_ON_FILTER_VALUES as PI_FILTER_INITIAL_VALUES };
export { DIVISION_CONFIG_CASCADE_RESET as PI_FILTER_CASCADE_RESETS };

export const PI_CONFIG = {
  ...PURCHASE_API,
  SP_INQUIRY_TYPES: PURCHASE_API.SP_CONFIG_TYPES,

  RB_MASTER: "RB_PurInquiryMst",
  RB_DETAIL: "RB_PurInquiryDet",
  RB_INDT_DETAIL: "RB_PurInquiryIndtDet",

  FORM_TAG: "INQ",
  TRAN_BOOK: "PURINQUIRY",

  RB_ITEM_PICKER_DIRECT: "RB_PurInqSelOnlyItem",
  RB_ITEM_PICKER_INDENT: "RB_PurInqSelIndtItem",

  SP_MASTER_FILL: "fn_tbl_RB_PurInquiryMst",
  SP_DETAIL_FILL: "fn_tbl_RB_PurInquiryDet",
  SP_INDT_FILL: "fn_tbl_RB_PurInquiryIndtDet",

  SP_DEPARTMENTS: PURCHASE_API.SP_DEPT,
  SP_ITEM_PICKER_DIRECT: "fn_tbl_RB_PurInqSelOnlyItem",
  SP_ITEM_PICKER_INDENT: "fn_tbl_RB_PurInqSelIndtItem",
  SP_GRID_EVENT: "fn_tbl_RB_PurInquiryDet_Event",
  SP_INDENT_SUMMARY: "Fn_tbl_FetchIndentSummaryItem4Inquiry",

  BASED_ON_OPTIONS: [BASED_ON.DIRECT, BASED_ON.INDENT_WISE],

  SUPPLIER_GRID_COLUMNS: PURCHASE_SUPPLIER_GRID_COLUMNS,
  INDENT_FRM_OPTION: 0,

  SAVE_ENDPOINT: "/API/TranFormSave/Post_RB_PurInquiryMst_Save",

  STORAGE_HEADER_META: "piHeaderMeta",
  STORAGE_ENTRY_META: "piEntryMeta",
  STORAGE_INDT_META: "piIndtMeta",

  SP_INQUIRY_LIST: "Fn_tbl_Pur_InquiryMst_List",
  LIST_DIVISION_ID: 15,
};

export const PI_HEADER_FILTERS = [
  { FilterParameterID: "TranCode", FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: "TranDate", FilterColCtrlType: controlTypeMap.DATE },
  {
    FilterParameterID: "DivisionID",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  { FilterParameterID: "ConfigID", FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: "ExpectedDate", FilterColCtrlType: controlTypeMap.DATE },
  { FilterParameterID: "DeptID", FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  {
    FilterParameterID: "BasedOnID",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: PI_CONFIG.BASED_ON_OPTIONS,
  },
  { FilterParameterID: "Remarks", FilterColCtrlType: controlTypeMap.TEXTAREA },
];

export const PI_GRID_TABS = [
  { id: "items", label: "Item Grid" },
  { id: "suppliers", label: "Suppliers" },
  { id: "terms", label: "Term And Conditions" },
];

/** Header fields mapped to item picker FN_FETCH_DATA JSON — grids clear when any changes */
export const PI_ITEM_PICKER_CONTEXT_FIELDS = new Set([
  "DivisionID",
  "TranDate",
  "ConfigID",
  "BasedOnID",
]);

export const PI_ITEM_PICKER_JSON_FIELDS = [
  { headerKey: "DivisionID", label: "Division" },
  { headerKey: "TranDate", label: "Tran Date", isDate: true },
  { headerKey: "ConfigID", label: "Inquiry Type" },
  { headerKey: "BasedOnID", label: "Based On", allowZero: true },
];

export function getMissingItemPickerHeaderFields(headerValues) {
  return getMissingPickerFields(headerValues, PI_ITEM_PICKER_JSON_FIELDS);
}

export function buildItemPickerJsonPayload(headerValues, loginId) {
  return buildPickerPayload(headerValues, loginId, {
    configYearId: PI_CONFIG.CONFIG_YEAR_ID,
    tranBook: PI_CONFIG.TRAN_BOOK,
  });
}

export const SUPPLIER_GRID_CONFIG = PURCHASE_SUPPLIER_GRID_CONFIG;

export const PI_MASTER = {
  headerFields: PI_HEADER_FILTERS,
};
