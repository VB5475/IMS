// constants.js — Purchase Inquiry page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Purchase Inquiry";
export const PAGE_TITLE_NEW = "New Purchase Inquiry";

// All RB codes, SP names, IDs, and request defaults used by this page in one place.

import { controlTypeMap } from "../../data/dummyData";
import {
  APPROVED_FILTER_OPTS,
  BASED_ON,
  DEFAULT_BASED_ON_FILTER_VALUES,
  INDENT_DETAILS_COLUMNS,
  PURCHASE_API,
} from "../../constants/purchaseCommon";
import { formatTranDate } from "../../utils/dateFormat";
import {
  getMissingItemPickerHeaderFields as getMissingPickerFields,
} from "../../utils/purchaseItemPicker";
import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { formatTranDate };
export { APPROVED_FILTER_OPTS as APPROVED_OPTS };
export { INDENT_DETAILS_COLUMNS };
export { DEFAULT_BASED_ON_FILTER_VALUES as PI_FILTER_INITIAL_VALUES };
export const PI_FILTER_CASCADE_RESETS = { divisionid: ["configid"] };

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const PI_REMARK_COLUMNS = new Set(["remarks"]);

export const PI_CONFIG = {
  ...PURCHASE_API,
  SP_INQUIRY_TYPES: PURCHASE_API.SP_CONFIG_TYPES,

  // Purchase Inquiry-only override: dedicated supplier-picker RB (not the shared
  // PURCHASE_API.SUPPLIER_SP used by other purchase modules). Takes the same JSON
  // payload shape as the item picker — see buildItemPickerJsonPayload below.
  SUPPLIER_SP: "fn_tbl_rb_purinqselonlysupp",

  RB_MASTER: RB_CODES.PURCHASE_INQUIRY,
  ROUTE_PATH: rbRoutePath(RB_CODES.PURCHASE_INQUIRY),
  DELETE_PROC_NAME: "pr_rb_purinquirymst_delete",
  RB_DETAIL: "rb_purinquirydet",
  RB_INDT_DETAIL: "rb_purinquiryindtdet",

  // Tab-2 (Supplier Detail) + Tab-3 (Terms & Conditions) — MRD_Template4inquiryTab2Details
  RB_SUPP_DETAIL: "rb_purinqsuppdet",
  RB_TERMS_DETAIL: "rb_purinqtncdet",
  RB_TERMS_PICKER: "rb_purinqtncselonly",

  FORM_TAG: "INQ",
  TRAN_BOOK: "PURINQUIRY",

  RB_ITEM_PICKER_DIRECT: "rb_purinqselonlyitem",
  RB_ITEM_PICKER_INDENT: "rb_purinqselindtitem",

  SP_MASTER_FILL: "fn_tbl_rb_purinquirymst",
  SP_DETAIL_FILL: "fn_tbl_rb_purinquirydet",
  SP_INDT_FILL: "fn_tbl_rb_purinquiryindtdet",
  // MRD-specified edit-mode fill SPs — verbatim "fn_tbl_" + RB code, matching the
  // convention already used above for master/detail/indent.
  SP_SUPP_DETAIL_FILL: "fn_tbl_rb_purinqsuppdet",
  SP_TERMS_DETAIL_FILL: "fn_tbl_rb_purinqtncdet",
  // Terms picker row-fetch SP — DBA-confirmed signature:
  // fn_tbl_rb_purinqtncselonly(@prmdivisionid int, @prmtrandate date,
  // @prmloginid int, @prmconfigid int, @prminqid int) — see buildTermsPickerJsonPayload below.
  SP_TERMS_PICKER: "fn_tbl_rb_purinqtncselonly",

  SP_DEPARTMENTS: PURCHASE_API.SP_DEPT,
  SP_ITEM_PICKER_DIRECT: "fn_tbl_rb_purinqselonlyitem",
  SP_ITEM_PICKER_INDENT: "fn_tbl_rb_purinqselindtitem",
  SP_GRID_EVENT: "fn_tbl_rb_purinquirydet_event",
  SP_INDENT_SUMMARY: "fn_tbl_fetchindentsummaryitem4inquiry",

  BASED_ON_OPTIONS: [BASED_ON.DIRECT, BASED_ON.INDENT_WISE],

  INDENT_FRM_OPTION: 0,

  SAVE_ENDPOINT: "/API/TranFormSave/Post_RB_PurInquiryMst_Save",

  STORAGE_HEADER_META: "piHeaderMeta",
  STORAGE_ENTRY_META: "piEntryMeta",
  STORAGE_INDT_META: "piIndtMeta",
  STORAGE_SUPP_META: "piSuppMeta",
  STORAGE_TERMS_META: "piTermsMeta",

  SP_INQUIRY_LIST: "fn_tbl_rb_purinquirymst_list",
  LIST_DIVISION_ID: 15,
};

export const PI_HEADER_FILTERS = [
  { FilterParameterID: "trancode", FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: "trandate", FilterColCtrlType: controlTypeMap.DATE },
  {
    FilterParameterID: "divisionid",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  { FilterParameterID: "configid", FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: "expecteddate", FilterColCtrlType: controlTypeMap.DATE },
  { FilterParameterID: "deptid", FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  {
    FilterParameterID: "basedonid",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: PI_CONFIG.BASED_ON_OPTIONS,
  },
  { FilterParameterID: "remarks", FilterColCtrlType: controlTypeMap.TEXTAREA },
];

export const PI_GRID_TABS = [
  { id: "items", label: "Item Grid" },
  { id: "suppliers", label: "Suppliers" },
  { id: "terms", label: "Terms And Conditions" },
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
  { headerKey: "trandate", label: "Tran Date", isDate: true },
  { headerKey: "configid", label: "Inquiry Type" },
  { headerKey: "basedonid", label: "Based On", allowZero: true },
];

export function getMissingItemPickerHeaderFields(headerValues) {
  return getMissingPickerFields(headerValues, PI_ITEM_PICKER_JSON_FIELDS, { basedOnKey: "basedonid" });
}

export function buildItemPickerJsonPayload(headerValues, loginId) {
  return {
    prmdivisionid: Number(headerValues.divisionid) || 0,
    prmyearid: getUserSession().yearId,
    prmloginid: loginId,
    prmtrandate: formatTranDate(headerValues.trandate),
    prmconfigid: Number(headerValues.configid) || 0,
    prmsupplierid: Number(headerValues.supplierid ?? 0),
    prmtranbook: PI_CONFIG.TRAN_BOOK,
    prmfrmoption: Number(headerValues.basedonid) || 0,
  };
}

/** fn_tbl_rb_purinqtncselonly payload — DBA-confirmed param signature (5 args only, no company/year). */
export function buildTermsPickerJsonPayload(headerValues, loginId) {
  return {
    prmdivisionid: Number(headerValues.divisionid) || 0,
    prmtrandate: formatTranDate(headerValues.trandate),
    prmloginid: loginId,
    prmconfigid: Number(headerValues.configid) || 0,
    prminqid: Number(headerValues.idnumber) || 0,
  };
}

export const PI_MASTER = {
  headerFields: PI_HEADER_FILTERS,
};
