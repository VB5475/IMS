// constants.js — Assets Client Release (ACR) page config
// Values aligned to MRD_Template4AssetsClientRelease.docx (Richa, 03-Jul-2026).
import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import { getMissingMandatoryHeaderLabels } from "../../utils/columnValidation";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Assets Client Release";
export const PAGE_TITLE_NEW = "New Assets Client Release";

/** Item-grid column that supports multi-value paste (Serial Number replication). */
export const ACR_MULTI_PASTE_COLUMNS = new Set(["assetsrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const ACR_REMARK_COLUMNS = new Set(["remark"]);

export const ACR_CONFIG = {
  RB_MASTER: RB_CODES.ASSETS_CLIENT_RELEASE,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSETS_CLIENT_RELEASE),
  DELETE_PROC_NAME: "pr_rb_astclirelmst_delete",
  RB_DETAIL: "rb_astclireldet",
  RB_ITEM_PICKER: "rb_astclirelselonly",

  MODULE_CODE: "AIS",
  FORM_TAG: "rb_astclirelmst",
  TRAN_BOOK: "CR",
  FRM_TYPE: "CR",
  FRM_TYPE_LABEL: "CR",
  CONFIG_FORM_TAG: "ASTIS",
  CONFIG_REF_TYPE: "CR",
  ISSUE_TYPE_ID: 9,

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_FROM_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  SP_TO_LOCATION: "fn_gen_fetchastisstolocationmaster",
  SP_TO_DEPT: "fn_tbl_fetchtodepartmentdata",
  SP_FROM_WORKING_CLIENT: "fn_tbl_fetchfromworkingclient",
  /** fn_tbl_fetchfromworkingclient — @prmpartytype */
  PARTY_TYPE_CLIENT: "C",
  SP_CONFIG: "fn_tbl_ddl_assetissueconfiguration",
  SP_ITEM_PICKER: "fn_tbl_rb_astclirelselonly",
  SP_ITEM_MAIN_GROUP: "fn_fetch_itemmaingroup4popupfilter",
  SP_ITEM_SUB_MAIN_GROUP: "fn_fetch_itemsubmaingroup4popupfilter",

  SP_MASTER_FILL: "fn_tbl_rb_astclirelmst",
  SP_DETAIL_FILL: "fn_tbl_rb_astclireldet",

  SAVE_ENDPOINT: "/API/AstCliRelMst/Post_RB_AstCliRelMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_astclirelmst_list",
  LIST_FROM_DIVISION_ID: 15,

  STORAGE_HEADER_META: "acrHeaderMeta",
  STORAGE_ENTRY_META: "acrEntryMeta",
};

export const ACR_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const ACR_FRM_TYPE_OPTIONS = [
  { value: String(ACR_CONFIG.FRM_TYPE), label: ACR_CONFIG.FRM_TYPE_LABEL },
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

function pickHeaderInt(headerValues, ...keys) {
  const raw = pickHeaderValue(headerValues, keys);
  if (raw == null || raw === "") return 0;
  return Number(raw) || 0;
}

/** Select Item gate — mandatory fields come only from GET_DETAIL_COL_DATA (IsMandatory + IsVisible). */
export function getMissingItemPickerHeaderFields(headerValues, headerColumns = null) {
  return getMissingMandatoryHeaderLabels(headerValues, headerColumns);
}

export function buildAcrItemPickerJsonPayload(
  headerValues,
  { companyId, loginId, yearId, maGroupId = 0, subMaGroupId = 0, itemNameSearch = "", qrJson = "" } = {}
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
    prmissuetypeid: ACR_CONFIG.ISSUE_TYPE_ID,
    // Trailing SP args — keep this order (AEI):
    // prmmaingroupid, prmsubmaingroupid, prmitemnamesearch, prmsearchtext, prmotherstr, prmjson, prmqrjson
    prmmaingroupid: Number(maGroupId) || 0,
    prmsubmaingroupid: Number(subMaGroupId) || 0,
    prmitemnamesearch: String(itemNameSearch ?? "").trim(),
    prmsearchtext: "",
    prmotherstr: "",
    prmjson: "[]",
    prmqrjson: String(qrJson ?? "").trim(),
  };
}

/** List SP: prmfromdivisionid, prmtolocationid, prmfromworkingclientid (MRD §5). */
export function buildAcrListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  fromDivisionId = ACR_CONFIG.LIST_FROM_DIVISION_ID,
  toLocationId = 0,
  fromWorkingClientId = 0,
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
    prmtolocationid: Number(toLocationId) || 0,
    prmfromworkingclientid: Number(fromWorkingClientId) || 0,
  };
}

export function applyAcrHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    frmtype: ACR_CONFIG.FRM_TYPE,
    issuetypeid: ACR_CONFIG.ISSUE_TYPE_ID,
  };
}

export function resolveAcrColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildAcrCascadeResets(fieldDefs) {
  const fromDiv = resolveAcrColKey(fieldDefs, "fromdivisionid");
  const toLoc = resolveAcrColKey(fieldDefs, "tolocationid");
  const toDept = resolveAcrColKey(fieldDefs, "todeptid");
  const fromClient = resolveAcrColKey(fieldDefs, "fromworkingclientid");
  const config = resolveAcrColKey(fieldDefs, "configid");

  const resets = {};
  if (fromDiv) resets[fromDiv] = [toLoc, toDept, fromClient, config].filter(Boolean);
  if (fromClient) resets[fromClient] = [];
  return resets;
}

/** MRD: Tran date cannot be smaller than Return date (issuedate). */
export function validateAcrBusinessRules(headerValues = {}) {
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
