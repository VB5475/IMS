// constants.js — Purchase Quotation page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Purchase Quotation";
export const PAGE_TITLE_NEW = "New Purchase Quotation";

// All RB codes, SP names, IDs, and request defaults used by this page in one place.
// Source of truth: MRD_Template4Qtn.docx (Module Requirements — Purchase Quotation).

import { controlTypeMap } from "../../data/dummyData";
import { getUserSession } from "../../session/userSession";
import {
  APPROVED_FILTER_OPTS,
  BASED_ON,
  DEFAULT_BASED_ON_FILTER_VALUES,
  PURCHASE_API,
  PURCHASE_GST_SUMMARY_FIELDS,
} from "../../constants/purchaseCommon";
import { formatTranDate } from "../../utils/dateFormat";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import {
  buildItemPickerJsonPayload as buildPickerPayload,
  getMissingItemPickerHeaderFields as getMissingPickerFields,
} from "../../utils/purchaseItemPicker";

export { formatTranDate };
export { APPROVED_FILTER_OPTS as APPROVED_OPTS };
export const QTN_READONLY_FIELDS = ["currencyname", "currencyrate"];
export { DEFAULT_BASED_ON_FILTER_VALUES as QTN_FILTER_INITIAL_VALUES };

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const QTN_REMARK_COLUMNS = new Set(["remarks"]);

// ⚠️ CONFIRMED live 2026-07-28 — rb_purqtndet's `tranqty` column comes back
// with ColCtrlType=0 (Label), which EntryGrid always renders as a plain,
// unfocusable <span> regardless of IsEditAllow (Label isn't an "editable vs
// not" toggle, it's a widget choice with no editable form — see
// gridColumnClass.js / EntryGrid.jsx's cell renderer). Since Tran Qty is the
// core "how many are you quoting" field, not a computed/display value, this
// silently broke both editing AND Tab order (focus skips straight over an
// unfocusable label from the header panel into Tran Rate). Overriding to
// TEXTBOX client-side — same escape hatch as SM_CHECKBOX_OVERRIDE_FIELDS.
// CONFIRM with DBA whether rb_purqtndet's ColCtrlType for tranqty should be
// fixed at the source instead of overridden here.
export const QTN_GRID_CONTROL_TYPE_OVERRIDES = {
  tranqty: controlTypeMap.TEXTBOX,
};

export const QTN_CONFIG = {
  ...PURCHASE_API,
  SP_QUOTATION_TYPES: PURCHASE_API.SP_CONFIG_TYPES,

  RB_MASTER: RB_CODES.PURCHASE_QUOTATION,
  ROUTE_PATH: rbRoutePath(RB_CODES.PURCHASE_QUOTATION),
  DELETE_PROC_NAME: "pr_rb_purqtnmst_delete",
  RB_DETAIL: "rb_purqtndet",

  // Document Log (F6) — this module's own DM_TRAN_TYPE_ID, passed to
  // useDocumentLogAccess. See src/pages/purchase-indent/constants.js /
  // IND_CONFIG for the same convention on the reference implementation.
  DM_TRAN_TYPE_ID: 6,

  FORM_TAG: "PQ",
  TRAN_BOOK: "PURQTN",

  RB_ITEM_PICKER_DIRECT: "rb_purqtnselonlyitem",
  RB_ITEM_PICKER_INQUIRY: "rb_purqtnselinqitem",

  // Terms & Conditions tab (2026-08-29 /pm) — same RB-driven grid + picker
  // pattern as Purchase Inquiry's Terms tab (PI_CONFIG.RB_TERMS_DETAIL /
  // RB_TERMS_PICKER). RB-provided.
  RB_TERMS_DETAIL: "rb_purqtntncdet",
  RB_TERMS_PICKER: "rb_purqtntncselonly",

  SP_MASTER_FILL: "fn_tbl_rb_purqtnmst",
  SP_DETAIL_FILL: "fn_tbl_rb_purqtndet",

  SP_ITEM_PICKER_DIRECT: "fn_tbl_rb_purqtnselonlyitem",
  SP_ITEM_PICKER_INQUIRY: "fn_tbl_rb_purqtnselinqitem",
  SP_GRID_EVENT: "fn_tbl_rb_purqtndet_event",
  SP_TERMS_DETAIL_FILL: "fn_tbl_rb_purqtntncdet",
  // Terms picker row-fetch SP — RB-provided signature:
  // fn_tbl_rb_purqtntncselonly(@prmdivisionid int, @prmtrandate date,
  // @prmloginid int, @prmconfigid int, @prmquotid int) — see
  // buildTermsPickerJsonPayload below.
  SP_TERMS_PICKER: "fn_tbl_rb_purqtntncselonly",

  // DBA-confirmed save payload key for Terms & Conditions detail rows
  // (Post_RB_PurQtnMst_Save) — distinct spelling from both Purchase
  // Inquiry's default (prmPurTermsNConditiontDetJson) and Purchase Rate
  // Contract's (prmTermsNCondDetJSon). Verbatim, do not "fix".
  TERMS_SAVE_JSON_KEY: "prmPurTermNConditionDetJSon",

  BASED_ON_OPTIONS: [
    // BASED_ON.DIRECT, 
    BASED_ON.INQUIRY_BASED],

  SAVE_ENDPOINT: "/API/PurQtnSave/Post_RB_PurQtnMst_Save",

  STORAGE_HEADER_META: "pqHeaderMeta",
  STORAGE_ENTRY_META: "pqEntryMeta",
  STORAGE_TERMS_META: "pqTermsMeta",

  SP_QUOTATION_LIST: "fn_tbl_rb_purqtnmst_list",
  LIST_DIVISION_ID: 15,

  // WKF "Approval Initiator" send-for-approval button (2026-08-25 /pm) —
  // user-confirmed transaction-type id, same convention as PO_CONFIG.WKF_TRAN_TYPE_ID.
  WKF_TRAN_TYPE_ID: 5,
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

export function getMissingItemPickerHeaderFields(headerValues, headerColumns = null) {
  return getMissingPickerFields(headerValues, headerColumns, {
    zeroValidFields: new Set(["basedonid"]),
  });
}

export function buildItemPickerJsonPayload(headerValues, loginId) {
  return buildPickerPayload(headerValues, loginId, {
    configYearId: getUserSession().yearId,
    tranBook: QTN_CONFIG.TRAN_BOOK,
  });
}

/** fn_tbl_rb_purqtntncselonly payload — RB-provided param signature (5 args, no company/year). */
export function buildTermsPickerJsonPayload(headerValues, loginId) {
  return {
    prmdivisionid: Number(headerValues.divisionid) || 0,
    prmtrandate: formatTranDate(headerValues.trandate),
    prmloginid: loginId,
    prmconfigid: Number(headerValues.configid) || 0,
    prmquotid: Number(headerValues.idnumber) || 0,
  };
}
