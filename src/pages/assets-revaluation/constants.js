import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Assets Revaluation";
export const PAGE_TITLE_NEW = "New Assets Revaluation";

/** Item-grid column that supports multi-value paste (Serial Number replication). */
export const ARV_MULTI_PASTE_COLUMNS = new Set(["assetsrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const ARV_REMARK_COLUMNS = new Set(["remark"]);

export const ARV_CONFIG = {
  RB_MASTER: RB_CODES.ASSETS_REVALUATION,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSETS_REVALUATION),
  DELETE_PROC_NAME: "pr_rb_astrevalmst_delete",
  RB_DETAIL: "rb_astrevaldet",
  RB_ITEM_PICKER: "rb_astrevalselonly",

  MODULE_CODE: "AIS",
  FORM_TAG: "rb_astrevalmst",
  TRAN_BOOK: "RVL",
  FRM_TYPE: "RVL",
  FRM_TYPE_LABEL: "RVL",
  CONFIG_FORM_TAG: "ASTIS",
  CONFIG_REF_TYPE: "RVL",
  ISSUE_TYPE_ID: 12,

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_FROM_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  SP_CONFIG: "fn_tbl_ddl_assetissueconfiguration",
  SP_ITEM_PICKER: "fn_tbl_rb_astrevalselonly",
  // Select Item popup filters — Main Group / Sub Main Group cascading
  // filter, same rollout as Purchase Indent/GRN (2026-07-28) and the rest
  // of the Assets suite (2026-07-29). Deferred until "Filter" is clicked;
  // SP_ITEM_PICKER call also gets prmsearchtext/prmotherstr/prmjson as
  // safe empty defaults (no dedicated UI for those yet, added per RB
  // signature widening — unconfirmed live whether they affect filtering).
  SP_ITEM_MAIN_GROUP: "fn_fetch_itemmaingroup4popupfilter",
  SP_ITEM_SUB_MAIN_GROUP: "fn_fetch_itemsubmaingroup4popupfilter",

  SP_MASTER_FILL: "fn_tbl_rb_astrevalmst",
  SP_DETAIL_FILL: "fn_tbl_rb_astrevaldet",

  SAVE_ENDPOINT: "/API/AstRevalMst/Post_RB_AstRevalMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_astrevalmst_list",
  LIST_FROM_DIVISION_ID: 15,

  STORAGE_HEADER_META: "arvHeaderMeta",
  STORAGE_ENTRY_META: "arvEntryMeta",
};

export const ARV_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const ARV_FRM_TYPE_OPTIONS = [
  { value: String(ARV_CONFIG.FRM_TYPE), label: ARV_CONFIG.FRM_TYPE_LABEL },
];

const ARV_ITEM_PICKER_REQUIRED_FIELDS = [
  { keys: ["fromdivisionid", "FromDivisionID"], label: "Division" },
  { keys: ["trandate", "TranDate"], label: "Tran Date", isDate: true },
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
  return ARV_ITEM_PICKER_REQUIRED_FIELDS.filter((f) =>
    isMissingValue(f, pickHeaderValue(headerValues, f.keys))
  ).map((f) => f.label);
}

export function buildArvItemPickerJsonPayload(
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
    prmissuetypeid: ARV_CONFIG.ISSUE_TYPE_ID,
  };
}

export function buildArvListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  fromDivisionId = ARV_CONFIG.LIST_FROM_DIVISION_ID,
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
  };
}

export function applyArvHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    frmtype: ARV_CONFIG.FRM_TYPE,
    issuetypeid: ARV_CONFIG.ISSUE_TYPE_ID,
  };
}

export function resolveArvColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildArvCascadeResets(fieldDefs) {
  const fromDiv = resolveArvColKey(fieldDefs, "fromdivisionid");
  const config = resolveArvColKey(fieldDefs, "configid");

  const resets = {};
  if (fromDiv) resets[fromDiv] = [config].filter(Boolean);
  return resets;
}

export function validateArvBusinessRules(headerValues = {}) {
  const errors = [];
  const tranDate = headerValues.trandate ? new Date(headerValues.trandate) : null;
  const issueDate = headerValues.issuedate ? new Date(headerValues.issuedate) : null;

  if (
    tranDate
    && issueDate
    && !Number.isNaN(tranDate.getTime())
    && !Number.isNaN(issueDate.getTime())
    && tranDate < issueDate
  ) {
    errors.push("Tran Date cannot be smaller than Revaluation Date.");
  }

  return errors;
}
