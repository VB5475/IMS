import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Assets Stock Transfer";
export const PAGE_TITLE_NEW = "New Assets Stock Transfer";

/** Item-grid column that supports multi-value paste (Serial Number replication). */
export const AST_MULTI_PASTE_COLUMNS = new Set(["assetsrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const AST_REMARK_COLUMNS = new Set(["remark"]);

export const AST_CONFIG = {
  RB_MASTER: RB_CODES.ASSETS_STOCK_TRANSFER,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSETS_STOCK_TRANSFER),
  DELETE_PROC_NAME: "pr_rb_astissstktrmst_delete",
  RB_DETAIL: "rb_astissstktrdet",
  RB_ITEM_PICKER: "rb_astisstktrselonly",

  MODULE_CODE: "AIS",
  FORM_TAG: "rb_astissstktrmst",
  TRAN_BOOK: "ST",
  FRM_TYPE: "ST",
  FRM_TYPE_LABEL: "ST",
  CONFIG_FORM_TAG: "ASTIS",
  CONFIG_REF_TYPE: "ST",
  ISSUE_TYPE_ID: 7,

  SUPPLIER_PARTY_TYPE: "S",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_FROM_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  SP_TO_DIVISION: "fn_tbl_fetchuserwstodivision",
  SP_FROM_LOCATION: "fn_gen_fetchfromlocationmaster",
  SP_TO_LOCATION: "fn_gen_fetchtolocationmaster",
  SP_CONFIG: "fn_tbl_ddl_assetissueconfiguration",
  SP_ITEM_PICKER: "fn_tbl_rb_astisstktrselonly",
  // Select Item popup filters — Main Group / Sub Main Group cascading
  // filter, same rollout as Purchase Indent/GRN (2026-07-28) and the rest
  // of the Assets suite (2026-07-29). Deferred until "Filter" is clicked;
  // SP_ITEM_PICKER call also gets prmsearchtext/prmotherstr/prmjson as
  // safe empty defaults (no dedicated UI for those yet, added per RB
  // signature widening — unconfirmed live whether they affect filtering).
  SP_ITEM_MAIN_GROUP: "fn_fetch_itemmaingroup4popupfilter",
  SP_ITEM_SUB_MAIN_GROUP: "fn_fetch_itemsubmaingroup4popupfilter",

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
    companyId = getUserSession().companyId,
    loginId = getUserSession().loginId,
    yearId = getUserSession().yearId,
  } = {}
) {
  return {
    prmcompanyid: Number(companyId) || getUserSession().companyId,
    prmloginid: Number(loginId ?? pickHeaderValue(headerValues, ["loginid", "LoginID"])) || getUserSession().loginId,
    prmyearid: Number(yearId ?? pickHeaderValue(headerValues, ["yearid", "YearID"])) || getUserSession().yearId,
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
  companyId = getUserSession().companyId,
  loginId = getUserSession().loginId,
  yearId = getUserSession().yearId,
  fromDate,
  toDate,
  fromDivisionId = AST_CONFIG.LIST_FROM_DIVISION_ID,
  fromLocationId = AST_CONFIG.LIST_FROM_LOCATION_ID,
  toDivisionId = AST_CONFIG.LIST_TO_DIVISION_ID,
} = {}) {
  const year = new Date().getFullYear();
  return {
    prmcompanyid: Number(companyId) || getUserSession().companyId,
    prmloginid: Number(loginId) || getUserSession().loginId,
    prmyearid: Number(yearId) || getUserSession().yearId,
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
