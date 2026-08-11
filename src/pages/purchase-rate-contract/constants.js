// constants.js — Purchase Rate Contract (PRC) module config
// Values aligned to MRD_Template4PurchaseRateContract.docx (Richa, 03-Jul-2026).

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Purchase Rate Contract";
export const PAGE_TITLE_NEW = "New Purchase Rate Contract";

import { PURCHASE_API } from "../../constants/purchaseCommon";
import { formatTranDate } from "../../utils/dateFormat";
import { getMissingItemPickerHeaderFields as getMissingPickerFields } from "../../utils/purchaseItemPicker";
import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { formatTranDate };

/** Item-grid column that opens the paste-friendly remark modal. */
export const PRC_REMARK_COLUMNS = new Set(["remarks"]);

export const PRC_CONFIG = {
  ...PURCHASE_API,

  RB_MASTER: RB_CODES.PURCHASE_RATE_CONTRACT,
  ROUTE_PATH: rbRoutePath(RB_CODES.PURCHASE_RATE_CONTRACT),
  // ⚠️ CONFIRM — guessed from RB naming convention; not listed in MRD §5.
  DELETE_PROC_NAME: "pr_rb_purratecontmst_delete",

  RB_DETAIL: "rb_purratecontdet",
  RB_TERMS_DETAIL: "rb_purrateconttncdet",
  RB_ITEM_PICKER: "rb_purratecontitem",
  RB_TERMS_PICKER: "rb_purrateconttncsel",

  // MRD §7 — FORM_TAG is the full master RB code (not a short tag like "PO").
  FORM_TAG: "rb_purratecontmst",
  TRAN_BOOK: "RC",

  SP_MASTER_FILL: "fn_tbl_rb_purratecontmst",
  SP_DETAIL_FILL: "fn_tbl_rb_purratecontdet",
  SP_TERMS_DETAIL_FILL: "fn_tbl_rb_purrateconttncdet",
  SP_ITEM_PICKER: "fn_tbl_rb_purratecontitem",
  SP_TERMS_PICKER: "fn_tbl_rb_purrateconttncsel",
  // Same supplier-currency helper used by PO.
  SP_SUPPLIER_INFO: "fn_tbl_fetchsuppliercurrencyinfo",
  // Live event SP: @prmmyeventcol, @prmjson, @prmmstjson
  SP_GRID_EVENT: "fn_tbl_rb_purratecontmst_event",

  SAVE_ENDPOINT: "/API/PurRateContractSave/Post_RB_PurRateContMst_Save",
  /** MRD §5 save payload key for terms rows (distinct from Inquiry spelling). */
  TERMS_SAVE_JSON_KEY: "prmTermsNCondDetJSon",

  STORAGE_HEADER_META: "prcHeaderMeta",
  STORAGE_ENTRY_META: "prcEntryMeta",
  STORAGE_TERMS_META: "prcTermsMeta",

  SP_LIST: "fn_tbl_rb_purratecontmst_list",
  // MRD §7 says 15 CONFIRM — using 0 (all divisions) like other live purchase modules.
  LIST_DIVISION_ID: 0,
};

export const PRC_GRID_TABS = [
  { id: "items", label: "Contract Item Detail" },
  { id: "terms", label: "Terms And Conditions" },
];

/** Header fields that clear the item grid when changed (MRD cascade: division). */
export const PRC_ITEM_PICKER_CONTEXT_FIELDS = new Set([
  "divisionid",
  "trandate",
  "supplierid",
]);

export const PRC_ITEM_PICKER_JSON_FIELDS = [
  { headerKey: "divisionid", label: "Division" },
  { headerKey: "trandate", label: "Contract Date", isDate: true },
  { headerKey: "supplierid", label: "Supplier" },
];

export function getMissingItemPickerHeaderFields(headerValues, headerColumns = null) {
  return getMissingPickerFields(headerValues, headerColumns);
}

/** fn_tbl_rb_purratecontitem — live param signature. */
export function buildItemPickerJsonPayload(headerValues, loginId) {
  return {
    prmdivisionid: Number(headerValues.divisionid) || 0,
    prmyearid: getUserSession().yearId,
    prmloginid: loginId,
    prmtrandate: formatTranDate(headerValues.trandate),
    prmconfigid: Number(headerValues.configid) || 0,
    prmsupplierid: Number(headerValues.supplierid) || 0,
  };
}

/** fn_tbl_rb_purrateconttncsel — live param signature. */
export function buildTermsPickerJsonPayload(headerValues, loginId) {
  return {
    prmdivisionid: Number(headerValues.divisionid) || 0,
    prmtrandate: formatTranDate(headerValues.trandate),
    prmloginid: loginId,
    prmconfigid: Number(headerValues.configid) || 0,
    prmmasterid: Number(headerValues.idnumber) || 0,
  };
}

export const PRC_FILTER_CASCADE_RESETS = {
  divisionid: ["supplierid", "currencyid", "currencyrate"],
};
