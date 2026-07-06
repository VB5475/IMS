import { DEFAULT_COMPANY_ID, DEFAULT_LOGIN_ID } from "../../api/constants";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Assets Stock Transfer";
export const PAGE_TITLE_NEW = "New Assets Stock Transfer";

export const AST_CONFIG = {
  RB_MASTER: "Rb_astissstktrmst",
  RB_DETAIL: "Rb_astissstktrdet",
  RB_ITEM_PICKER: "rb_astisstktrselonly",

  MODULE_CODE: "AIS",
  FORM_TAG: "Rb_astissstktrmst",
  TRAN_BOOK: "ST",
  FRM_TYPE: "ST",
  FRM_TYPE_LABEL: "ST",
  CONFIG_FORM_TAG: "ASTIS",
  CONFIG_REF_TYPE: "ST",
  ISSUE_TYPE_ID: 7,

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,
  SUPPLIER_PARTY_TYPE: "S",

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_FROM_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  SP_TO_DIVISION: "fn_tbl_fetchuserwstodivision",
  SP_FROM_LOCATION: "fn_gen_fetchfromlocationmaster",
  SP_TO_LOCATION: "fn_gen_fetchtolocationmaster",
  SP_CONFIG: "fn_tbl_ddl_assetissueconfiguration",
  SP_ITEM_PICKER: "fn_tbl_rb_astisstktrselonly",

  SP_MASTER_FILL: "fn_tbl_Rb_astissstktrmst",
  SP_DETAIL_FILL: "fn_tbl_Rb_astissstktrdet",

  SAVE_ENDPOINT: "/API/AstIssStktrMst/Post_RB_AstIssStktrMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_astissstktrmst_list",
  LIST_FROM_DIVISION_ID: 15,
  LIST_TO_DIVISION_ID: 0,
  LIST_FROM_LOCATION_ID: 0,

  STORAGE_HEADER_META: "astHeaderMeta",
  STORAGE_ENTRY_META: "astEntryMeta",
};

export const AST_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const AST_FRM_TYPE_OPTIONS = [
  { value: String(AST_CONFIG.FRM_TYPE), label: AST_CONFIG.FRM_TYPE_LABEL },
];

const AST_ITEM_PICKER_REQUIRED_FIELDS = [
  { keys: ["fromdivisionid", "FromDivisionID"], label: "From Division" },
  { keys: ["todivisionid", "ToDivisionID"], label: "To Division" },
  { keys: ["trandate", "TranDate"], label: "Tran Date", isDate: true },
  { keys: ["tolocationid", "ToLocationID"], label: "To Location" },
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
  return AST_ITEM_PICKER_REQUIRED_FIELDS.filter((f) =>
    isMissingValue(f, pickHeaderValue(headerValues, f.keys))
  ).map((f) => f.label);
}

export function buildAstItemPickerJsonPayload(
  headerValues,
  {
    companyId = DEFAULT_COMPANY_ID,
    loginId = DEFAULT_LOGIN_ID,
    yearId = AST_CONFIG.CONFIG_YEAR_ID,
  } = {}
) {
  return {
    prmcompanyid: Number(companyId) || DEFAULT_COMPANY_ID,
    prmloginid: Number(loginId ?? pickHeaderValue(headerValues, ["loginid", "LoginID"])) || DEFAULT_LOGIN_ID,
    prmyearid: Number(yearId ?? pickHeaderValue(headerValues, ["yearid", "YearID"])) || AST_CONFIG.CONFIG_YEAR_ID,
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
    prmissuetypeid: AST_CONFIG.ISSUE_TYPE_ID,
  };
}

/** List SP: prmfromdivisionid, prmfromlocationid, prmtodivisionid (MRD §5.1). */
export function buildAstListJsonPayload({
  companyId = DEFAULT_COMPANY_ID,
  loginId = DEFAULT_LOGIN_ID,
  yearId = AST_CONFIG.CONFIG_YEAR_ID,
  fromDate,
  toDate,
  fromDivisionId = AST_CONFIG.LIST_FROM_DIVISION_ID,
  fromLocationId = AST_CONFIG.LIST_FROM_LOCATION_ID,
  toDivisionId = AST_CONFIG.LIST_TO_DIVISION_ID,
} = {}) {
  const year = new Date().getFullYear();
  return {
    prmcompanyid: Number(companyId) || DEFAULT_COMPANY_ID,
    prmloginid: Number(loginId) || DEFAULT_LOGIN_ID,
    prmyearid: Number(yearId) || AST_CONFIG.CONFIG_YEAR_ID,
    prmfromdate: fromDate ?? `01-Jan-${year}`,
    prmtodate: toDate ?? `31-Dec-${year}`,
    prmfromdivisionid: Number(fromDivisionId) || 0,
    prmfromlocationid: Number(fromLocationId) || 0,
    prmtodivisionid: Number(toDivisionId) || 0,
  };
}

export function applyAstHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    frmtype: AST_CONFIG.FRM_TYPE,
    issuetypeid: AST_CONFIG.ISSUE_TYPE_ID,
  };
}

export function resolveAstColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildAstCascadeResets(fieldDefs) {
  const fromDiv = resolveAstColKey(fieldDefs, "fromdivisionid");
  const toDiv = resolveAstColKey(fieldDefs, "todivisionid");
  const fromLoc = resolveAstColKey(fieldDefs, "fromlocationid");
  const toLoc = resolveAstColKey(fieldDefs, "tolocationid");
  const config = resolveAstColKey(fieldDefs, "configid");

  const resets = {};
  if (fromDiv) resets[fromDiv] = [fromLoc, config].filter(Boolean);
  if (toDiv) resets[toDiv] = [toLoc].filter(Boolean);
  if (fromLoc) resets[fromLoc] = [];
  return resets;
}

export function validateAstBusinessRules(headerValues = {}) {
  const errors = [];
  const fromDiv = Number(headerValues.fromdivisionid ?? 0);
  const toDiv = Number(headerValues.todivisionid ?? 0);
  const fromLoc = Number(headerValues.fromlocationid ?? 0);
  const toLoc = Number(headerValues.tolocationid ?? 0);
  const tranDate = headerValues.trandate ? new Date(headerValues.trandate) : null;
  const issueDate = headerValues.issuedate ? new Date(headerValues.issuedate) : null;

  if (fromDiv > 0 && toDiv > 0 && fromDiv === toDiv) {
    errors.push("From Division and To Division cannot be the same.");
  }
  if (fromLoc > 0 && toLoc > 0 && fromLoc === toLoc) {
    errors.push("From Location and To Location cannot be the same.");
  }
  if (
    tranDate
    && issueDate
    && !Number.isNaN(tranDate.getTime())
    && !Number.isNaN(issueDate.getTime())
    && tranDate < issueDate
  ) {
    errors.push("Tran Date cannot be smaller than Transfer Date.");
  }

  return errors;
}
