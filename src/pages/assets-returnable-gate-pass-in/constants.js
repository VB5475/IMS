import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import { isColumnMandatoryByName } from "../../utils/gridUtils";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Assets Returnable Gate Pass In";
export const PAGE_TITLE_NEW = "New Assets Returnable Gate Pass In";

/** Item-grid column that supports multi-value paste (Serial Number replication). */
export const ARGI_MULTI_PASTE_COLUMNS = new Set(["assetsrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const ARGI_REMARK_COLUMNS = new Set(["remark"]);

export const ARGI_CONFIG = {
  RB_MASTER: RB_CODES.ASSETS_RETURNABLE_GATE_PASS_IN,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSETS_RETURNABLE_GATE_PASS_IN),
  DELETE_PROC_NAME: "pr_rb_astissrgimst_delete",
  RB_DETAIL: "rb_astissrgidet",
  RB_ITEM_PICKER: "rb_astissrgiselonly",

  MODULE_CODE: "AIS",
  FORM_TAG: "rb_astissrgimst",
  TRAN_BOOK: "RGI",
  FRM_TYPE: "RGI",
  FRM_TYPE_LABEL: "RGI",
  CONFIG_FORM_TAG: "ASTIS",
  CONFIG_REF_TYPE: "RGI",
  ISSUE_TYPE_ID: 6,

  SUPPLIER_PARTY_TYPE: "S",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_FROM_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  SP_TO_LOCATION: "fn_gen_fetchastisstolocationmaster",
  SP_TO_DEPT: "fn_tbl_fetchtodepartmentdata",
  SP_FROM_VENDOR: "fn_gen_fetchfromvendor",
  SP_CONFIG: "fn_tbl_ddl_assetissueconfiguration",
  SP_ITEM_PICKER: "fn_tbl_rb_astissrgiselonly",

  SP_MASTER_FILL: "fn_tbl_Rb_astissrgimst",
  SP_DETAIL_FILL: "fn_tbl_Rb_astissrgidet",

  SAVE_ENDPOINT: "/API/AstIssRGIMst/Post_RB_AstIssRGIMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_astissrgimst_list",
  LIST_TO_DIVISION_ID: 15,

  STORAGE_HEADER_META: "argiHeaderMeta",
  STORAGE_ENTRY_META: "argiEntryMeta",
};

export const ARGI_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const ARGI_FRM_TYPE_OPTIONS = [
  { value: String(ARGI_CONFIG.FRM_TYPE), label: ARGI_CONFIG.FRM_TYPE_LABEL },
];

const ARGI_ITEM_PICKER_REQUIRED_FIELDS = [
  { keys: ["fromdivisionid", "FromDivisionID"], label: "Division" },
  { keys: ["trandate", "TranDate"], label: "Tran Date", isDate: true },
  { keys: ["todeptid", "ToDeptID"], label: "To Department" },
  { keys: ["fromvendorid", "FromVendorID"], label: "Vendor" },
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

/**
 * @param {object} headerValues
 * @param {object[]} [headerColumns] - GET_DETAIL_COL_DATA rows. When provided, a field is only
 *   enforced as required if its matching column's IsMandatory flag is truthy.
 */
export function getMissingItemPickerHeaderFields(headerValues, headerColumns = null) {
  return ARGI_ITEM_PICKER_REQUIRED_FIELDS.filter((f) => {
    if (headerColumns && !isColumnMandatoryByName(headerColumns, f.keys)) return false;
    return isMissingValue(f, pickHeaderValue(headerValues, f.keys));
  }).map((f) => f.label);
}

export function buildArgiItemPickerJsonPayload(
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
    prmissuetypeid: ARGI_CONFIG.ISSUE_TYPE_ID,
  };
}

export function buildArgiListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  toDivisionId = ARGI_CONFIG.LIST_TO_DIVISION_ID,
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
    prmtodivisionid: Number(toDivisionId) || 0,
    prmtodeptid: Number(toDeptId) || 0,
  };
}

export function applyArgiHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    frmtype: ARGI_CONFIG.FRM_TYPE,
    issuetypeid: ARGI_CONFIG.ISSUE_TYPE_ID,
  };
}

export function resolveArgiColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildArgiCascadeResets(fieldDefs) {
  const fromDiv = resolveArgiColKey(fieldDefs, "fromdivisionid");
  const toLoc = resolveArgiColKey(fieldDefs, "tolocationid");
  const fromVendor = resolveArgiColKey(fieldDefs, "fromvendorid");
  const config = resolveArgiColKey(fieldDefs, "configid");

  const resets = {};
  if (fromDiv) resets[fromDiv] = [toLoc, fromVendor, config].filter(Boolean);
  return resets;
}

export function validateArgiBusinessRules(headerValues = {}) {
  const errors = [];
  const tranDate = headerValues.trandate ? new Date(headerValues.trandate) : null;
  const returnDate = headerValues.issuedate ? new Date(headerValues.issuedate) : null;

  if (
    tranDate
    && returnDate
    && !Number.isNaN(tranDate.getTime())
    && !Number.isNaN(returnDate.getTime())
    && tranDate < returnDate
  ) {
    errors.push("Tran Date cannot be smaller than Return Date.");
  }

  return errors;
}
