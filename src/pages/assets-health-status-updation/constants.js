import { getUserSession } from "../../session/userSession";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Assets Health Status Updation";
export const PAGE_TITLE_NEW = "New Assets Health Status Updation";

export const AHS_CONFIG = {
  RB_MASTER: "rb_asthealstamst",
  DELETE_PROC_NAME: "pr_rb_asthealstamst_delete",
  RB_DETAIL: "rb_asthealstadet",
  RB_ITEM_PICKER: "rb_asthealstaselonly",

  MODULE_CODE: "AIS",
  FORM_TAG: "rb_asthealstamst",
  TRAN_BOOK: "HS",
  FRM_TYPE: "HS",
  FRM_TYPE_LABEL: "HS",
  CONFIG_FORM_TAG: "ASTIS",
  CONFIG_REF_TYPE: "HS",
  ISSUE_TYPE_ID: 10,

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_FROM_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  SP_TO_LOCATION: "fn_gen_fetchtolocationmaster",
  SP_TO_DEPT: "fn_tbl_fetchtodepartmentdata",
  SP_CONFIG: "fn_tbl_ddl_assetissueconfiguration",
  SP_ITEM_PICKER: "fn_tbl_rb_asthealstaselonly",

  SP_MASTER_FILL: "fn_tbl_rb_asthealstamst",
  SP_DETAIL_FILL: "fn_tbl_rb_asthealstadet",

  SAVE_ENDPOINT: "/API/AstHealStaMst/Post_RB_AstHealStaMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_asthealstamst_list",
  LIST_FROM_DIVISION_ID: 15,

  STORAGE_HEADER_META: "ahsHeaderMeta",
  STORAGE_ENTRY_META: "ahsEntryMeta",
};

export const AHS_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const AHS_FRM_TYPE_OPTIONS = [
  { value: String(AHS_CONFIG.FRM_TYPE), label: AHS_CONFIG.FRM_TYPE_LABEL },
];

const AHS_ITEM_PICKER_REQUIRED_FIELDS = [
  { keys: ["fromdivisionid", "FromDivisionID"], label: "Division" },
  { keys: ["trandate", "TranDate"], label: "Tran Date", isDate: true },
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
  return AHS_ITEM_PICKER_REQUIRED_FIELDS.filter((f) =>
    isMissingValue(f, pickHeaderValue(headerValues, f.keys))
  ).map((f) => f.label);
}

export function buildAhsItemPickerJsonPayload(
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
    prmissuetypeid: AHS_CONFIG.ISSUE_TYPE_ID,
  };
}

export function buildAhsListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  fromDivisionId = AHS_CONFIG.LIST_FROM_DIVISION_ID,
  toVendorId = 0,
  toDeptId = 0,
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
    prmtovendorid: Number(toVendorId) || 0,
    prmtodeptid: Number(toDeptId) || 0,
  };
}

export function applyAhsHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    frmtype: AHS_CONFIG.FRM_TYPE,
    issuetypeid: AHS_CONFIG.ISSUE_TYPE_ID,
  };
}

export function resolveAhsColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildAhsCascadeResets(fieldDefs) {
  const fromDiv = resolveAhsColKey(fieldDefs, "fromdivisionid");
  const toLoc = resolveAhsColKey(fieldDefs, "tolocationid");
  const toDept = resolveAhsColKey(fieldDefs, "todeptid");
  const config = resolveAhsColKey(fieldDefs, "configid");

  const resets = {};
  if (fromDiv) resets[fromDiv] = [toLoc, toDept, config].filter(Boolean);
  return resets;
}

export function validateAhsBusinessRules(headerValues = {}) {
  const errors = [];
  const tranDate = headerValues.trandate ? new Date(headerValues.trandate) : null;
  const statusDate = headerValues.issuedate ? new Date(headerValues.issuedate) : null;

  if (
    tranDate
    && statusDate
    && !Number.isNaN(tranDate.getTime())
    && !Number.isNaN(statusDate.getTime())
    && tranDate < statusDate
  ) {
    errors.push("Tran Date cannot be smaller than Status Date.");
  }

  return errors;
}
