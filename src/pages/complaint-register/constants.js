import { DEFAULT_COMPANY_ID, DEFAULT_LOGIN_ID } from "../../api/constants";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Complaint Register";
export const PAGE_TITLE_NEW = "New Complaint Register";

export const MCR_CONFIG = {
  RB_MASTER: "rb_mntcomplmst",
  DELETE_PROC_NAME: "pr_rb_mntcomplmst_delete",
  RB_DETAIL: "rb_mntcompldet",
  RB_ITEM_PICKER: "rb_mntcomplselonly",

  MODULE_CODE: "MNT",
  FORM_TAG: "rb_mntcomplmst",
  TRAN_BOOK: "HS",
  FRM_TYPE: "CPN",
  FRM_TYPE_LABEL: "CPN",
  CONFIG_FORM_TAG: "MNTCLT",
  CONFIG_REF_TYPE: "HS",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_DIVISION: "fn_tbl_fetchuserwsdivision",
  SP_FROM_LOCATION: "fn_gen_fetchfromlocationmaster",
  SP_DEPARTMENT: "fn_gen_fetchdepartmentmaster",
  SP_CONFIG: "fn_tbl_ddl_maintenanceconfiguration",
  SP_ITEM_PICKER: "fn_tbl_rb_mntcomplselonly",

  SP_MASTER_FILL: "fn_tbl_rb_mntcomplmst",
  SP_DETAIL_FILL: "fn_tbl_rb_mntcompldet",

  SAVE_ENDPOINT: "/API/MntComplainMstSave/Post_RB_MntComplainMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_mntcomplmst_list",
  LIST_FROM_DIVISION_ID: 15,

  STORAGE_HEADER_META: "mcrHeaderMeta",
  STORAGE_ENTRY_META: "mcrEntryMeta",
};

export const MCR_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const MCR_FRM_TYPE_OPTIONS = [
  { value: String(MCR_CONFIG.FRM_TYPE), label: MCR_CONFIG.FRM_TYPE_LABEL },
];

const MCR_ITEM_PICKER_REQUIRED_FIELDS = [
  { keys: ["divisionid", "DivisionID"], label: "Division" },
  { keys: ["trandate", "TranDate"], label: "Tran Date", isDate: true },
  { keys: ["fromlocationid", "FromLocationID"], label: "Location" },
  { keys: ["deptid", "DeptID"], label: "Department" },
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
  return MCR_ITEM_PICKER_REQUIRED_FIELDS.filter((f) =>
    isMissingValue(f, pickHeaderValue(headerValues, f.keys))
  ).map((f) => f.label);
}

export function buildMcrItemPickerJsonPayload(
  headerValues,
  {
    companyId = DEFAULT_COMPANY_ID,
    loginId = DEFAULT_LOGIN_ID,
    yearId = MCR_CONFIG.CONFIG_YEAR_ID,
  } = {}
) {
  const divisionId = pickHeaderInt(headerValues, "divisionid", "DivisionID");

  return {
    prmcompanyid: Number(companyId) || DEFAULT_COMPANY_ID,
    prmloginid: Number(loginId ?? pickHeaderValue(headerValues, ["loginid", "LoginID"])) || DEFAULT_LOGIN_ID,
    prmyearid: Number(yearId ?? pickHeaderValue(headerValues, ["yearid", "YearID"])) || MCR_CONFIG.CONFIG_YEAR_ID,
    prmtrandate: pickHeaderValue(headerValues, ["trandate", "TranDate"]) ?? "",
    prmfromdivisionid: divisionId,
    prmtodivisionid: divisionId,
    prmfromlocationid: pickHeaderInt(headerValues, "fromlocationid", "FromLocationID"),
    prmtolocationid: pickHeaderInt(headerValues, "fromlocationid", "FromLocationID"),
    prmfromdeptid: pickHeaderInt(headerValues, "deptid", "DeptID"),
    prmtodeptid: pickHeaderInt(headerValues, "deptid", "DeptID"),
    prmfromempuserid: 0,
    prmtoempuserid: 0,
    prmfromworkingclientid: 0,
    prmtoworkingclientid: 0,
    prmfromvendorid: 0,
    prmtovendorid: 0,
    prmconfigid: pickHeaderInt(headerValues, "configid", "ConfigID"),
    prmissuetypeid: 0,
  };
}

export function applyMcrHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    frmtype: MCR_CONFIG.FRM_TYPE,
  };
}

export function resolveMcrColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildMcrCascadeResets(fieldDefs) {
  const division = resolveMcrColKey(fieldDefs, "divisionid");
  const location = resolveMcrColKey(fieldDefs, "fromlocationid");
  const dept = resolveMcrColKey(fieldDefs, "deptid");
  const config = resolveMcrColKey(fieldDefs, "configid");

  const resets = {};
  if (division) resets[division] = [location, dept, config].filter(Boolean);
  return resets;
}

export function validateMcrBusinessRules() {
  return [];
}

export function buildMcrListJsonPayload({
  companyId = DEFAULT_COMPANY_ID,
  loginId = DEFAULT_LOGIN_ID,
  yearId = MCR_CONFIG.CONFIG_YEAR_ID,
  fromDate,
  toDate,
  fromDivisionId = MCR_CONFIG.LIST_FROM_DIVISION_ID,
  toVendorId = 0,
  toDeptId = 0,
} = {}) {
  const year = new Date().getFullYear();
  return {
    prmcompanyid: Number(companyId) || DEFAULT_COMPANY_ID,
    prmloginid: Number(loginId) || DEFAULT_LOGIN_ID,
    prmyearid: Number(yearId) || MCR_CONFIG.CONFIG_YEAR_ID,
    prmfromdate: fromDate ?? `01-Jan-${year}`,
    prmtodate: toDate ?? `31-Dec-${year}`,
    prmfromdivisionid: Number(fromDivisionId) || 0,
    prmtovendorid: Number(toVendorId) || 0,
    prmtodeptid: Number(toDeptId) || 0,
  };
}
