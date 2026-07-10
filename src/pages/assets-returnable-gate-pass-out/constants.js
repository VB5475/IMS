import { getUserSession } from "../../session/userSession";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Assets Returnable Gate Pass Out";
export const PAGE_TITLE_NEW = "New Assets Returnable Gate Pass Out";

export const ARGO_CONFIG = {
  RB_MASTER: "rb_astissrgomst",
  DELETE_PROC_NAME: "pr_rb_astissrgomst_delete",
  RB_DETAIL: "rb_astissrgodet",
  RB_ITEM_PICKER: "rb_astissrgoselonly",

  MODULE_CODE: "AIS",
  FORM_TAG: "rb_astissrgomst",
  TRAN_BOOK: "RGO",
  FRM_TYPE: "RGO",
  FRM_TYPE_LABEL: "RGO",
  CONFIG_FORM_TAG: "ASTIS",
  CONFIG_REF_TYPE: "RGO",
  ISSUE_TYPE_ID: 5,

  SUPPLIER_PARTY_TYPE: "S",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_FROM_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  SP_FROM_LOCATION: "fn_gen_fetchfromlocationmaster",
  SP_TO_LOCATION: "fn_gen_fetchtolocationmaster",
  SP_FROM_DEPT: "fn_tbl_fetchfromdepartmentdata",
  SP_TO_VENDOR: "fn_gen_fetchtovendor",
  SP_CONFIG: "fn_tbl_ddl_assetissueconfiguration",
  SP_ITEM_PICKER: "fn_tbl_rb_astissrgoselonly",

  SP_MASTER_FILL: "fn_tbl_rb_astissrgomst",
  SP_DETAIL_FILL: "fn_tbl_rb_astissrgodet",

  SAVE_ENDPOINT: "/API/AstIssRGOMst/Post_RB_AstIssRGOMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_astissrgomst_list",
  LIST_FROM_DIVISION_ID: 15,

  STORAGE_HEADER_META: "argoHeaderMeta",
  STORAGE_ENTRY_META: "argoEntryMeta",
};

export const ARGO_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const ARGO_FRM_TYPE_OPTIONS = [
  { value: String(ARGO_CONFIG.FRM_TYPE), label: ARGO_CONFIG.FRM_TYPE_LABEL },
];

const ARGO_ITEM_PICKER_REQUIRED_FIELDS = [
  { keys: ["fromdivisionid", "FromDivisionID"], label: "Division" },
  { keys: ["trandate", "TranDate"], label: "Tran Date", isDate: true },
  { keys: ["fromlocationid", "FromLocationID"], label: "From Location" },
  { keys: ["fromdeptid", "FromDeptID"], label: "From Department" },
  { keys: ["tovendorid", "ToVendorID"], label: "Supplier" },
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
  return ARGO_ITEM_PICKER_REQUIRED_FIELDS.filter((f) =>
    isMissingValue(f, pickHeaderValue(headerValues, f.keys))
  ).map((f) => f.label);
}

export function buildArgoItemPickerJsonPayload(
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
    prmissuetypeid: ARGO_CONFIG.ISSUE_TYPE_ID,
  };
}

export function buildArgoListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  fromDivisionId = ARGO_CONFIG.LIST_FROM_DIVISION_ID,
  fromDeptId = 0,
  toVendorId = 0,
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
    prmtovendorid: Number(toVendorId) || 0,
  };
}

export function applyArgoHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    frmtype: ARGO_CONFIG.FRM_TYPE,
    issuetypeid: ARGO_CONFIG.ISSUE_TYPE_ID,
  };
}

export function resolveArgoColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildArgoCascadeResets(fieldDefs) {
  const fromDiv = resolveArgoColKey(fieldDefs, "fromdivisionid");
  const fromLoc = resolveArgoColKey(fieldDefs, "fromlocationid");
  const toLoc = resolveArgoColKey(fieldDefs, "tolocationid");
  const fromDept = resolveArgoColKey(fieldDefs, "fromdeptid");
  const toVendor = resolveArgoColKey(fieldDefs, "tovendorid");
  const config = resolveArgoColKey(fieldDefs, "configid");

  const resets = {};
  if (fromDiv) {
    resets[fromDiv] = [fromLoc, toLoc, fromDept, toVendor, config].filter(Boolean);
  }
  if (fromLoc) resets[fromLoc] = [];
  if (fromDept) resets[fromDept] = [];
  return resets;
}

export function validateArgoBusinessRules(headerValues = {}) {
  const errors = [];
  const fromLoc = Number(headerValues.fromlocationid ?? 0);
  const toLoc = Number(headerValues.tolocationid ?? 0);
  const tranDate = headerValues.trandate ? new Date(headerValues.trandate) : null;
  const issueDate = headerValues.issuedate ? new Date(headerValues.issuedate) : null;

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
    errors.push("Tran Date cannot be smaller than Issue Date.");
  }

  return errors;
}
