import { DEFAULT_COMPANY_ID, DEFAULT_LOGIN_ID } from "../../api/constants";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Assets Department Issue";
export const PAGE_TITLE_NEW = "New Assets Department Issue";

export const ADI_CONFIG = {
  RB_MASTER: "Rb_astdeptissmst",
  RB_DETAIL: "Rb_astdeptissdet",
  RB_ITEM_PICKER: "rb_astdeptissselonly",

  MODULE_CODE: "AIS",
  FORM_TAG: "Rb_astdeptissmst",
  TRAN_BOOK: "DI",
  FRM_TYPE: "DI",
  FRM_TYPE_LABEL: "DI",
  CONFIG_FORM_TAG: "ASTIS",
  CONFIG_REF_TYPE: "DI",
  ISSUE_TYPE_ID: 4,
  ITEM_PICKER_ISSUE_TYPE_ID: -1,

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_FROM_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  SP_FROM_LOCATION: "fn_gen_fetchfromlocationmaster",
  SP_TO_LOCATION: "fn_gen_fetchtolocationmaster",
  SP_FROM_DEPT: "fn_tbl_fetchfromdepartmentdata",
  SP_TO_DEPT: "fn_tbl_fetchtodepartmentdata",
  SP_CONFIG: "Fn_tbl_ddl_prod_configuration",
  SP_ITEM_PICKER: "fn_tbl_rb_astdeptissselonly",

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
  {
    companyId = DEFAULT_COMPANY_ID,
    loginId = DEFAULT_LOGIN_ID,
    yearId = ADI_CONFIG.CONFIG_YEAR_ID,
  } = {}
) {
  return {
    prmcompanyid: Number(companyId) || DEFAULT_COMPANY_ID,
    prmloginid: Number(loginId ?? pickHeaderValue(headerValues, ["loginid", "LoginID"])) || DEFAULT_LOGIN_ID,
    prmyearid: Number(yearId ?? pickHeaderValue(headerValues, ["yearid", "YearID"])) || ADI_CONFIG.CONFIG_YEAR_ID,
    prmtrandate: pickHeaderValue(headerValues, ["trandate", "TranDate"]) ?? "",
    prmfromdivisionid: pickHeaderInt(headerValues, "fromdivisionid", "FromDivisionID"),
    prmfromlocationid: pickHeaderInt(headerValues, "fromlocationid", "FromLocationID"),
    prmtolocationid: pickHeaderInt(headerValues, "tolocationid", "ToLocationID"),
    prmfromdeptid: pickHeaderInt(headerValues, "fromdeptid", "FromDeptID"),
    prmtodeptid: pickHeaderInt(headerValues, "todeptid", "ToDeptID"),
    prmfromempuserid: 0,
    prmfromworkingclientid: 0,
    prmfromvendorid: 0,
    prmconfigid: pickHeaderInt(headerValues, "configid", "ConfigID"),
    prmissuetypeid: ADI_CONFIG.ITEM_PICKER_ISSUE_TYPE_ID,
  };
}

export function buildAdiListJsonPayload({
  companyId = DEFAULT_COMPANY_ID,
  loginId = DEFAULT_LOGIN_ID,
  yearId = ADI_CONFIG.CONFIG_YEAR_ID,
  fromDate,
  toDate,
  fromDivisionId = ADI_CONFIG.LIST_FROM_DIVISION_ID,
  fromDeptId = 0,
} = {}) {
  const year = new Date().getFullYear();
  return {
    prmcompanyid: Number(companyId) || DEFAULT_COMPANY_ID,
    prmloginid: Number(loginId) || DEFAULT_LOGIN_ID,
    prmyearid: Number(yearId) || ADI_CONFIG.CONFIG_YEAR_ID,
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
