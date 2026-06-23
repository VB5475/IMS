// constants.js — Purchase Indent page config
// All RB codes, SP names, IDs, and request defaults for the Indent module.
// Values aligned to MRD_Template4Indent.docx (Richa, 08-Jun-2026).

import { controlTypeMap } from "../../data/dummyData";
import { PURCHASE_API } from "../../constants/purchaseCommon";
import { formatTranDate } from "../../utils/dateFormat";
import { getMissingItemPickerHeaderFields as getMissingPickerFields } from "../../utils/purchaseItemPicker";

export { formatTranDate as formatIndentTranDate };

export const IND_CONFIG = {
  ...PURCHASE_API,
  SP_INDENT_TYPES: PURCHASE_API.SP_CONFIG_TYPES,

  RB_MASTER: "RB_PurIndtMst",
  RB_DETAIL: "RB_PurIndtDet",
  RB_DETAIL_SELECT: "RB_PurIndtSelItem",

  // ⚠️ CONFIRM with DBA — MRD Section 3 says pass "IND" in @PrmFormTag;
  //    MRD Section 7 constants table says "RB_PurIndtMst". Using "IND" per Section 3.
  FORM_TAG: "IND",
  TRAN_BOOK: "PURIND",

  SP_ITEM_PICKER: "fn_tbl_RB_PurIndtSelItem",
  SP_GRID_EVENT: "fn_tbl_RB_PurIndtDet_Event",
  SP_LOCATION: "Fn_Gen_FetchLocationMaster",

  SP_MASTER_FILL: "fn_tbl_RB_PurIndtMst",
  SP_DETAIL_FILL: "fn_tbl_RB_PurIndtDet",

  SAVE_ENDPOINT: "/API/PurINDSave/Post_RB_PurIndtMst_Save",

  STORAGE_HEADER_META: "indHeaderMeta",
  STORAGE_ENTRY_META: "indEntryMeta",

  SP_INDENT_LIST: "fn_tbl_RB_PurIndtMst_List",
  LIST_DIVISION_ID: 15,
};

export const IND_HEADER_FILTERS = [
  {
    FilterParameterID: "TranCode",
    FilterColName: "TranCode",
    FilterCaption: "Indent No.",
    FilterColCtrlType: controlTypeMap.TEXTBOX,
  },
  {
    FilterParameterID: "TranDate",
    FilterColName: "TranDate",
    FilterCaption: "Date",
    FilterColCtrlType: controlTypeMap.DATE,
  },
  {
    FilterParameterID: "DivisionID",
    FilterColName: "DivisionID",
    FilterCaption: "Division",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  {
    FilterParameterID: "ConfigID",
    FilterColName: "ConfigID",
    FilterCaption: "Indent Type",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  {
    FilterParameterID: "ExpDate",
    FilterColName: "ExpDate",
    FilterCaption: "Expiry Date",
    FilterColCtrlType: controlTypeMap.DATE,
  },
  {
    FilterParameterID: "DeptID",
    FilterColName: "DeptID",
    FilterCaption: "Department",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  {
    FilterParameterID: "LocationID",
    FilterColName: "LocationID",
    FilterCaption: "Location",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],
  },
  {
    FilterParameterID: "Remarks",
    FilterColName: "Remarks",
    FilterCaption: "Remarks",
    FilterColCtrlType: controlTypeMap.TEXTAREA,
  },
  {
    FilterParameterID: "IndentRefrenceNo",
    FilterColName: "IndentRefrenceNo",
    FilterCaption: "Reference No",
    FilterColCtrlType: controlTypeMap.TEXTAREA,
  },
];

export const IND_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const IND_FILTER_CASCADE_RESETS = {
  DivisionID: ["ConfigID"],
};

export const IND_SHORTCUT_CONFIG = {
  a: { label: "Add", title: "Add (Alt+A)" },
  s: { label: "Save", title: "Save (Alt+S)" },
  n: { label: "Cancel", title: "Cancel (Alt+N)" },
};

// const MONTH_ABBR = [
//   "Jan", "Feb", "Mar", "Apr", "May", "Jun",
//   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
// ];

// export function formatIndentTranDate(dateVal) {
//   if (!dateVal) return "0";
//   const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
//   if (isNaN(d.getTime())) return "0";
//   return `${String(d.getDate()).padStart(2, "0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
// }

/** Header fields required before Select Item can be opened */
export const IND_ITEM_PICKER_JSON_FIELDS = [
  { headerKey: "DivisionID", label: "Division" },
  { headerKey: "TranDate", label: "Tran Date", isDate: true },
  { headerKey: "ConfigID", label: "Indent Type" },
];

export function getMissingItemPickerHeaderFields(headerValues) {
  return getMissingPickerFields(headerValues, IND_ITEM_PICKER_JSON_FIELDS);
}
