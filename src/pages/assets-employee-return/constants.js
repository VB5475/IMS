import { getUserSession } from "../../session/userSession";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Assets Employee Return";
export const PAGE_TITLE_NEW = "New Assets Employee Return";

export const AER_CONFIG = {
  RB_MASTER: "rb_astempretmst",
  DELETE_PROC_NAME: "pr_rb_astempretmst_delete",
  RB_DETAIL: "rb_astempretdet",
  RB_ITEM_PICKER: "rb_astempretselonly",

  MODULE_CODE: "AIS",
  FORM_TAG: "rb_astempretmst",
  TRAN_BOOK: "ER",
  FRM_TYPE: 3,
  FRM_TYPE_LABEL: "ER",
  CONFIG_FORM_TAG: "ASTIS",
  CONFIG_REF_TYPE: "ER",
  ISSUE_TYPE_ID: 3,
  ITEM_PICKER_ISSUE_TYPE_ID: -1,
  EMP_ISSUE_TYPE_ID: -1,

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_FROM_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  SP_TO_LOCATION: "fn_gen_fetchtolocationmaster",
  SP_TO_DEPT: "fn_tbl_fetchtodepartmentdata",
  SP_FROM_EMP: "fn_gen_fetchfromuser",
  SP_CONFIG: "fn_tbl_ddl_assetissueconfiguration",
  SP_ITEM_PICKER: "fn_tbl_Rb_astempretselonly",

  SP_MASTER_FILL: "fn_tbl_rb_astempretmst",
  SP_DETAIL_FILL: "fn_tbl_rb_astempretdet",

  SAVE_ENDPOINT: "/API/AstEmpRetMst/Post_RB_AstEmpRetMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_astempretmst_list",
  LIST_FROM_DIVISION_ID: 15,

  STORAGE_HEADER_META: "aerHeaderMeta",
  STORAGE_ENTRY_META: "aerEntryMeta",
};

export const AER_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const AER_FRM_TYPE_OPTIONS = [
  { value: String(AER_CONFIG.FRM_TYPE), label: AER_CONFIG.FRM_TYPE_LABEL },
];

const AER_ITEM_PICKER_REQUIRED_FIELDS = [
  { keys: ["fromdivisionid", "FromDivisionID"], label: "From Division" },
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

export function getMissingItemPickerHeaderFields(headerValues) {
  return AER_ITEM_PICKER_REQUIRED_FIELDS.filter((f) =>
    isMissingValue(f, pickHeaderValue(headerValues, f.keys))
  ).map((f) => f.label);
}

function pickHeaderInt(headerValues, ...keys) {
  const raw = pickHeaderValue(headerValues, keys);
  if (raw == null || raw === "") return 0;
  return Number(raw) || 0;
}

export function buildAerItemPickerJsonPayload(
  headerValues,
  { companyId, loginId, yearId } = {}
) {
  const session = getUserSession();
  return {
    prmcompanyid: Number(companyId) || session.companyId,
    prmloginid: Number(loginId ?? pickHeaderValue(headerValues, ["loginid", "LoginID"])) || session.loginId,
    prmyearid: Number(yearId ?? pickHeaderValue(headerValues, ["yearid", "YearID"])) || session.yearId,
    prmtrandate: pickHeaderValue(headerValues, ["trandate", "TranDate"]) ?? "",
    prmfromdivisionid: pickHeaderInt(headerValues, "fromdivisionid", "FromDivisionID"),
    prmtodivisionid: 0,
    prmfromlocationid: 0,
    prmtolocationid: pickHeaderInt(headerValues, "tolocationid", "ToLocationID"),
    prmfromdeptid: 0,
    prmtodeptid: pickHeaderInt(headerValues, "todeptid", "ToDeptID"),
    prmfromempuserid: pickHeaderInt(headerValues, "fromempuserid", "FromEmpUserID"),
    prmtoempuserid: 0,
    prmfromworkingclientid: 0,
    prmtoworkingclientid: 0,
    prmfromvendorid: 0,
    prmtovendorid: 0,
    prmconfigid: pickHeaderInt(headerValues, "configid", "ConfigID"),
    prmissuetypeid: AER_CONFIG.ITEM_PICKER_ISSUE_TYPE_ID,
  };
}

export function buildAerListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  fromDivisionId = AER_CONFIG.LIST_FROM_DIVISION_ID,
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

export function applyAerHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    frmtype: AER_CONFIG.FRM_TYPE,
    issuetypeid: AER_CONFIG.ISSUE_TYPE_ID,
  };
}

export function resolveAerColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildAerCascadeResets(fieldDefs) {
  const fromDiv = resolveAerColKey(fieldDefs, "fromdivisionid");
  const toLoc = resolveAerColKey(fieldDefs, "tolocationid");
  const toDept = resolveAerColKey(fieldDefs, "todeptid");
  const fromEmp = resolveAerColKey(fieldDefs, "fromempuserid");

  const resets = {};
  if (fromDiv) resets[fromDiv] = [toLoc, toDept, fromEmp].filter(Boolean);
  if (toLoc) resets[toLoc] = [];
  if (toDept) resets[toDept] = [];
  return resets;
}
