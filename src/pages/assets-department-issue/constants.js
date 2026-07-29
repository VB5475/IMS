import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Assets Department Issue";
export const PAGE_TITLE_NEW = "New Assets Department Issue";

/** Item-grid column that supports multi-value paste (Serial Number replication). */
export const ADI_MULTI_PASTE_COLUMNS = new Set(["assetsrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const ADI_REMARK_COLUMNS = new Set(["remark"]);

export const ADI_CONFIG = {
  RB_MASTER: RB_CODES.ASSETS_DEPARTMENT_ISSUE,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSETS_DEPARTMENT_ISSUE),
  DELETE_PROC_NAME: "pr_rb_astdeptissmst_delete",
  RB_DETAIL: "rb_astdeptissdet",
  RB_ITEM_PICKER: "rb_astdeptissselonly",

  MODULE_CODE: "AIS",
  FORM_TAG: "rb_astdeptissmst",
  TRAN_BOOK: "DI",
  FRM_TYPE: "DI",
  FRM_TYPE_LABEL: "DI",
  CONFIG_FORM_TAG: "ASTIS",
  CONFIG_REF_TYPE: "DI",
  ISSUE_TYPE_ID: 4,

  SUPPLIER_PARTY_TYPE: "S",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_FROM_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  SP_FROM_LOCATION: "fn_gen_fetchfromlocationmaster",
  SP_TO_LOCATION: "fn_gen_fetchtolocationmaster",
  SP_FROM_DEPT: "fn_tbl_fetchfromdepartmentdata",
  SP_TO_DEPT: "fn_tbl_fetchtodepartmentdata",
  SP_CONFIG: "Fn_tbl_ddl_prod_configuration",
  SP_ITEM_PICKER: "fn_tbl_rb_astdeptissselonly",
  // Select Item popup filters — Main Group / Sub Main Group cascading
  // filter, same rollout as Purchase Indent/GRN (2026-07-28) and the rest
  // of the Assets suite (2026-07-29). Deferred until "Filter" is clicked;
  // SP_ITEM_PICKER call also gets prmsearchtext/prmotherstr/prmjson as
  // safe empty defaults (no dedicated UI for those yet, added per RB
  // signature widening — unconfirmed live whether they affect filtering).
  SP_ITEM_MAIN_GROUP: "fn_fetch_itemmaingroup4popupfilter",
  SP_ITEM_SUB_MAIN_GROUP: "fn_fetch_itemsubmaingroup4popupfilter",

  SP_MASTER_FILL: "fn_tbl_Rb_astdeptissmst",
  SP_DETAIL_FILL: "fn_tbl_Rb_astdeptissdet",

  SAVE_ENDPOINT: "/API/AstDeptIssMst/Post_RB_AstDeptIssMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_astdeptissmst_list",
  LIST_FROM_DIVISION_ID: 15,

  STORAGE_HEADER_META: "adiHeaderMeta",
  STORAGE_ENTRY_META: "adiEntryMeta",
};

export const ADI_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const ADI_FRM_TYPE_OPTIONS = [
  { value: String(ADI_CONFIG.FRM_TYPE), label: ADI_CONFIG.FRM_TYPE_LABEL },
];

const ADI_ITEM_PICKER_REQUIRED_FIELDS = [
  { keys: ["fromdivisionid", "FromDivisionID"], label: "Division" },
  { keys: ["trandate", "TranDate"], label: "Tran Date", isDate: true },
  { keys: ["fromlocationid", "FromLocationID"], label: "From Location" },
  { keys: ["fromdeptid", "FromDeptID"], label: "From Department" },
  { keys: ["todeptid", "ToDeptID"], label: "To Department" },
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

function pickHeaderInt(headerValues, ...keys) {
  const raw = pickHeaderValue(headerValues, keys);
  if (raw == null || raw === "") return 0;
  return Number(raw) || 0;
}

export function getMissingItemPickerHeaderFields(headerValues) {
  return ADI_ITEM_PICKER_REQUIRED_FIELDS.filter((f) =>
    isMissingValue(f, pickHeaderValue(headerValues, f.keys))
  ).map((f) => f.label);
}

export function buildAdiItemPickerJsonPayload(
  headerValues,
  { companyId, loginId, yearId } = {}
) {
  const session = getUserSession();
  const fromDivisionId = pickHeaderInt(headerValues, "fromdivisionid", "FromDivisionID");

  return {
    prmcompanyid: Number(companyId) || session.companyId,
    prmloginid: Number(loginId ?? pickHeaderValue(headerValues, ["loginid", "LoginID"])) || session.loginId,
    prmyearid: Number(yearId ?? pickHeaderValue(headerValues, ["yearid", "YearID"])) || session.yearId,
    prmtrandate: pickHeaderValue(headerValues, ["trandate", "TranDate"]) ?? "",
    prmfromdivisionid: fromDivisionId,
    prmtodivisionid: pickHeaderInt(headerValues, "todivisionid", "ToDivisionID") || fromDivisionId,
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
    prmissuetypeid: ADI_CONFIG.ISSUE_TYPE_ID,
  };
}

export function buildAdiListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  fromDivisionId = ADI_CONFIG.LIST_FROM_DIVISION_ID,
  fromDeptId = 0,
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
    prmfromdeptid: Number(fromDeptId) || 0,
  };
}

export function applyAdiHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    frmtype: ADI_CONFIG.FRM_TYPE,
    issuetypeid: ADI_CONFIG.ISSUE_TYPE_ID,
  };
}

export function resolveAdiColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildAdiCascadeResets(fieldDefs) {
  const fromDiv = resolveAdiColKey(fieldDefs, "fromdivisionid");
  const fromLoc = resolveAdiColKey(fieldDefs, "fromlocationid");
  const toLoc = resolveAdiColKey(fieldDefs, "tolocationid");
  const fromDept = resolveAdiColKey(fieldDefs, "fromdeptid");
  const toDept = resolveAdiColKey(fieldDefs, "todeptid");

  const resets = {};
  if (fromDiv) resets[fromDiv] = [fromLoc, toLoc, fromDept, toDept].filter(Boolean);
  if (fromLoc) resets[fromLoc] = [];
  if (fromDept) resets[fromDept] = [];
  return resets;
}

export function validateAdiBusinessRules(headerValues = {}) {
  const errors = [];
  const fromLoc = Number(headerValues.fromlocationid ?? 0);
  const toLoc = Number(headerValues.tolocationid ?? 0);
  const fromDept = Number(headerValues.fromdeptid ?? 0);
  const toDept = Number(headerValues.todeptid ?? 0);
  const tranDate = headerValues.trandate ? new Date(headerValues.trandate) : null;
  const issueDate = headerValues.issuedate ? new Date(headerValues.issuedate) : null;

  if (fromLoc > 0 && toLoc > 0 && fromLoc === toLoc) {
    errors.push("From Location and To Location cannot be the same.");
  }
  if (fromDept > 0 && toDept > 0 && fromDept === toDept) {
    errors.push("From Department and To Department cannot be the same.");
  }
  if (tranDate && issueDate && !Number.isNaN(tranDate.getTime()) && !Number.isNaN(issueDate.getTime()) && tranDate < issueDate) {
    errors.push("Tran Date cannot be smaller than Issue Date.");
  }

  return errors;
}
