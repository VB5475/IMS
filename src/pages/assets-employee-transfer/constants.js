// constants.js — Assets Employee Transfer (AET) page config
import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import { isColumnMandatoryByName } from "../../utils/gridUtils";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Employee Location Transfer";
export const PAGE_TITLE_NEW = "New Employee Location Transfer";

// Values aligned to MRD_Template4EmpTransfer.docx (Richa, 23-Jun-2026).

/** Item-grid column that supports multi-value paste (Serial Number replication). */
export const AET_MULTI_PASTE_COLUMNS = new Set(["assetsrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const AET_REMARK_COLUMNS = new Set(["remark"]);

export const AET_CONFIG = {
  RB_MASTER: RB_CODES.ASSETS_EMPLOYEE_TRANSFER,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSETS_EMPLOYEE_TRANSFER),
  DELETE_PROC_NAME: "pr_rb_astemptrfmst_delete",
  RB_DETAIL: "rb_astemptrfdet",
  RB_ITEM_PICKER: "rb_astemptrfselonly",

  MODULE_CODE: "AIS",
  FORM_TAG: "rb_astemptrfmst",
  TRAN_BOOK: "ET",
  /** MRD hardcode — FrmType value ET, label ET */
  FRM_TYPE: "ET",
  FRM_TYPE_LABEL: "ET",
  CONFIG_FORM_TAG: "ASTIS",
  CONFIG_REF_TYPE: "ET",
  ISSUE_TYPE_ID: 14,
  /** fn_tbl_rb_astemptrfselonly — MRD hardcode */
  ITEM_PICKER_ISSUE_TYPE_ID: 14,
  /** fn_gen_fetchfromuser — MRD hardcode */
  EMP_ISSUE_TYPE_ID: 14,
  /** Retained for shared hook compatibility. */
  VENDOR_ISSUE_TYPE_ID: 14,

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_FROM_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  SP_TO_DIVISION: "fn_tbl_fetchuserwstodivision",
  SP_FROM_LOCATION: "fn_gen_fetchastissfromlocationmaster",
  SP_TO_LOCATION: "fn_gen_fetchastisstolocationmaster",
  SP_FROM_DEPT: "fn_tbl_fetchfromdepartmentdata",
  SP_TO_DEPT: "fn_tbl_fetchtodepartmentdata",
  SP_FROM_EMP: "fn_gen_fetchfromuser",
  SP_TO_EMP: "fn_gen_fetchtouser",
  SP_FROM_WORKING_CLIENT: "fn_tbl_fetchfromworkingclient",
  SP_TO_WORKING_CLIENT: "fn_tbl_fetchtoworkingclient",
  SP_FROM_VENDOR: "fn_gen_fetchfromvendor",
  SP_TO_VENDOR: "fn_gen_fetchtovendor",
  SP_CONFIG: "fn_tbl_ddl_assetissueconfiguration",
  SP_ITEM_PICKER: "fn_tbl_rb_astemptrfselonly",
  // Select Item popup filters — Main Group / Sub Main Group cascading
  // filter, same rollout as Purchase Indent/GRN (2026-07-28) and the rest
  // of the Assets suite (2026-07-29). Deferred until "Filter" is clicked;
  // SP_ITEM_PICKER call also gets prmsearchtext/prmotherstr/prmjson as
  // safe empty defaults (no dedicated UI for those yet, added per RB
  // signature widening — unconfirmed live whether they affect filtering).
  SP_ITEM_MAIN_GROUP: "fn_fetch_itemmaingroup4popupfilter",
  SP_ITEM_SUB_MAIN_GROUP: "fn_fetch_itemsubmaingroup4popupfilter",

  SP_MASTER_FILL: "fn_tbl_rb_astemptrfmst",
  SP_DETAIL_FILL: "fn_tbl_rb_astemptrfdet",

  SAVE_ENDPOINT: "/API/AstEmpTrfMst/Post_RB_AstEmpTrfMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_astemptrfmst_list",
  /** Default prmfromdivisionid for list fetch — CONFIRM with DBA */
  LIST_FROM_DIVISION_ID: 15,

  PARTY_TYPE_CLIENT: "C",

  STORAGE_HEADER_META: "aetHeaderMeta",
  STORAGE_ENTRY_META: "aetEntryMeta",
};

export const AET_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const AET_FRM_TYPE_OPTIONS = [
  { value: String(AET_CONFIG.FRM_TYPE), label: AET_CONFIG.FRM_TYPE_LABEL },
];

const AET_ITEM_PICKER_REQUIRED_FIELDS = [
  { keys: ["fromdivisionid", "FromDivisionID"], label: "From Division" },
  { keys: ["trandate", "TranDate"], label: "Tran Date", isDate: true },
  { keys: ["tolocationid", "ToLocationID"], label: "To Location" },
  { keys: ["todeptid", "ToDeptID"], label: "To Department" },
  { keys: ["fromempuserid", "FromEmpUserID"], label: "Employee" },
  { keys: ["configid", "ConfigID"], label: "Configuration" },
];

function pickHeaderValue(headerValues, keys) {
  if (!headerValues) return undefined;
  for (const key of keys) {
    if (headerValues[key] !== undefined && headerValues[key] !== null && headerValues[key] !== "") {
      return headerValues[key];
    }
  }
  return undefined;
}

function isMissingValue(field, value) {
  if (field.isDate) return value == null || value === "";
  if (value == null || value === "") return true;
  return Number(value) === 0 || value === "0";
}

/**
 * @param {object} headerValues
 * @param {object[]} [headerColumns] - GET_DETAIL_COL_DATA rows. When provided, a field is only
 *   enforced as required if its matching column's IsMandatory flag is truthy.
 */
export function getMissingItemPickerHeaderFields(headerValues, headerColumns = null) {
  return AET_ITEM_PICKER_REQUIRED_FIELDS.filter((f) => {
    if (headerColumns && !isColumnMandatoryByName(headerColumns, f.keys)) return false;
    return isMissingValue(f, pickHeaderValue(headerValues, f.keys));
  }).map((f) => f.label);
}

function pickHeaderInt(headerValues, ...keys) {
  const raw = pickHeaderValue(headerValues, keys);
  if (raw == null || raw === "") return 0;
  return Number(raw) || 0;
}

/** FN_FETCH_DATA JSON for fn_tbl_rb_astemptrfselonly item picker rows. */
export function buildAetItemPickerJsonPayload(headerValues, {
  companyId,
  loginId,
  yearId,
} = {}) {
  const session = getUserSession();
  return {
    prmcompanyid: Number(companyId) || session.companyId,
    prmloginid: Number(loginId ?? pickHeaderValue(headerValues, ["loginid", "LoginID"])) || session.loginId,
    prmyearid: Number(yearId ?? pickHeaderValue(headerValues, ["yearid", "YearID"])) || session.yearId,
    prmtrandate: pickHeaderValue(headerValues, ["trandate", "TranDate"]) ?? "",
    prmfromdivisionid: pickHeaderInt(headerValues, "fromdivisionid", "FromDivisionID"),
    prmtodivisionid: pickHeaderInt(headerValues, "todivisionid", "ToDivisionID"),
    prmfromlocationid: pickHeaderInt(headerValues, "fromlocationid", "FromLocationID"),
    prmtolocationid: pickHeaderInt(headerValues, "tolocationid", "ToLocationID"),
    prmfromdeptid: pickHeaderInt(headerValues, "fromdeptid", "FromDeptID"),
    prmtodeptid: pickHeaderInt(headerValues, "todeptid", "ToDeptID"),
    prmfromempuserid: pickHeaderInt(headerValues, "fromempuserid", "FromEmpUserID"),
    prmtoempuserid: pickHeaderInt(headerValues, "toempuserid", "ToEmpUserID"),
    prmfromworkingclientid: pickHeaderInt(headerValues, "fromworkingclientid", "FromWorkingClientID"),
    prmtoworkingclientid: pickHeaderInt(headerValues, "toworkingclientid", "ToWorkingClientID"),
    prmfromvendorid: pickHeaderInt(headerValues, "fromvendorid", "FromVendorID"),
    prmtovendorid: pickHeaderInt(headerValues, "tovendorid", "ToVendorID"),
    prmconfigid: pickHeaderInt(headerValues, "configid", "ConfigID"),
    prmissuetypeid: AET_CONFIG.ITEM_PICKER_ISSUE_TYPE_ID,
  };
}

export function buildAetListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  fromDivisionId = AET_CONFIG.LIST_FROM_DIVISION_ID,
  fromEmpUserId = 0,
} = {}) {
  const session = getUserSession();
  const year = new Date().getFullYear();
  return {
    prmcompanyid: Number(companyId) || session.companyId,
    prmloginid: Number(loginId) || session.loginId,
    prmyearid: Number(yearId) || session.yearId,
    prmfromdate: fromDate ?? `01-Jan-${year}`,
    prmtodate: toDate ?? `31-Dec-${year}`,
    prmfromdivisionid: Number(fromDivisionId) || 0,
    prmfromempuserid: Number(fromEmpUserId) || 0,
  };
}

export function applyAetHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    frmtype: AET_CONFIG.FRM_TYPE,
    issuetypeid: AET_CONFIG.ISSUE_TYPE_ID,
  };
}

export function resolveAetColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildAetCascadeResets(fieldDefs) {
  const fromDiv = resolveAetColKey(fieldDefs, "fromdivisionid");
  const toLoc = resolveAetColKey(fieldDefs, "tolocationid");
  const toDept = resolveAetColKey(fieldDefs, "todeptid");
  const fromEmp = resolveAetColKey(fieldDefs, "fromempuserid");
  const config = resolveAetColKey(fieldDefs, "configid");

  const resets = {};
  if (fromDiv) resets[fromDiv] = [toLoc, toDept, fromEmp, config].filter(Boolean);
  if (toDept && fromEmp) resets[toDept] = [fromEmp];
  return resets;
}
