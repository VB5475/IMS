// constants.js — Purchase Indent page config
// All RB codes, SP names, IDs, and request defaults for the Indent module.
// Values aligned to MRD_Template4Indent.docx (Richa, 08-Jun-2026).

import { controlTypeMap } from "../../data/dummyData";

export const IND_CONFIG = {
  // RB board codes
  RB_MASTER: "RB_PurIndtMst",
  RB_DETAIL: "RB_PurIndtDet",
  RB_DETAIL_SELECT: "RB_PurIndtSelItem",


  // Form identifiers
  // ⚠️ CONFIRM with DBA — MRD Section 3 says pass "IND" in @PrmFormTag;
  //    MRD Section 7 constants table says "RB_PurIndtMst". Using "IND" per Section 3.
  FORM_TAG: "IND",
  TRAN_BOOK: "PURIND",

  // Year IDs — ⚠️ CONFIRM with DBA
  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  // SP / function names
  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_INDENT_TYPES: "fn_tbl_ddl_Pur_Configuration",
  SP_DIVISIONS: "Fn_tbl_FetchUserWsDivision",
  SP_ITEM_PICKER: "Fn_Tbl_FetchPurchaseItemDetailTransWs4Web",
  SP_DEPT: "Pr_Fetch_DepartmentData_IMS",
  // Grid cell-event SP (fires on Qty / Rate column blur → server recalculates Amount)
  SP_GRID_EVENT: "fn_tbl_RB_PurIndtDet_Event",
  SP_LOCATION: "Fn_Gen_FetchLocationMaster",

  // Edit flow — ⚠️ CONFIRM SP names with DBA (follows PO naming convention)
  SP_MASTER_FILL: "fn_tbl_RB_PurIndtMst",
  SP_DETAIL_FILL: "fn_tbl_RB_PurIndtDet",

  // Save endpoint (REST POST via API_BASE_URL_IMS)
  SAVE_ENDPOINT: "/API/PurINDSave/Post_RB_PurIndtMst_Save",

  // localStorage keys — "ind" prefix avoids collision with PI ("pi") and PO ("po") keys
  // MRD specifies "piHeaderMeta" but that conflicts with Purchase Inquiry; using "indHeaderMeta"
  STORAGE_HEADER_META: "indHeaderMeta",
  STORAGE_ENTRY_META: "indEntryMeta",

  // Listing — ⚠️ CONFIRM with DBA
  LIST_OBJ_TYPE: 2,
  SP_INDENT_LIST: "fn_tbl_RB_PurIndtMst_List", // ⚠️ CONFIRM
  LIST_DIVISION_ID: 15,                          // ⚠️ CONFIRM
};

// ── Header filter definitions ────────────────────────────────────────────────
// Field order per revised column list (12-Jun-2026):
//   TranCode → TranDate → DivisionID → ConfigID → ExpDate → DeptID → LocationID → Remarks → IndentRefrenceNo
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
    staticOptions: [], // ⚠️ Populated once DBA provides SP_LOCATION
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

// Cascade resets: Division change → clear Indent Type (ConfigID)
export const IND_FILTER_CASCADE_RESETS = {
  DivisionID: ["ConfigID"],
};

export const IND_SHORTCUT_CONFIG = {
  a: { label: "Add", title: "Add (Alt+A)" },
  s: { label: "Save", title: "Save (Alt+S)" },
  n: { label: "Cancel", title: "Cancel (Alt+N)" },
  c: { label: "Close", title: "Close (Alt+C)" },
};

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatIndentTranDate(dateVal) {
  if (!dateVal) return "0";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return "0";
  return `${String(d.getDate()).padStart(2, "0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}
