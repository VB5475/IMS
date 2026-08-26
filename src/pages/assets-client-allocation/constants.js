import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import { getMissingMandatoryHeaderLabels } from "../../utils/columnValidation";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Assets Client Allocation";
export const PAGE_TITLE_NEW = "New Assets Client Allocation";

/** Item-grid column that supports multi-value paste (Serial Number replication). */
export const ACA_MULTI_PASTE_COLUMNS = new Set(["assetsrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const ACA_REMARK_COLUMNS = new Set(["remark"]);

export const ACA_CONFIG = {
  RB_MASTER: RB_CODES.ASSETS_CLIENT_ALLOCATION,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSETS_CLIENT_ALLOCATION),
  DELETE_PROC_NAME: "pr_rb_astcliallomst_delete",
  RB_DETAIL: "rb_astcliallodet",
  RB_ITEM_PICKER: "rb_astclialloselonly",

  MODULE_CODE: "AIS",
  FORM_TAG: "rb_astcliallomst",
  TRAN_BOOK: "CA",
  FRM_TYPE: "CA",
  FRM_TYPE_LABEL: "CA",
  CONFIG_FORM_TAG: "ASTIS",
  CONFIG_REF_TYPE: "CA",
  ISSUE_TYPE_ID: 8,

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_FROM_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  SP_TO_LOCATION: "fn_gen_fetchastisstolocationmaster",
  SP_TO_DEPT: "fn_tbl_fetchtodepartmentdata",
  SP_TO_WORKING_CLIENT: "fn_gen_fetchtoworkingclient",
  SP_CONFIG: "fn_tbl_ddl_assetissueconfiguration",
  SP_ITEM_PICKER: "fn_tbl_rb_astclialloselonly",
  // Select Item popup filters — Main Group / Sub Main Group cascading
  // filter, same rollout as Purchase Indent/GRN (2026-07-28) and the rest
  // of the Assets suite (2026-07-29). Deferred until "Filter" is clicked;
  // SP_ITEM_PICKER call also gets prmsearchtext/prmotherstr/prmjson as
  // safe empty defaults (no dedicated UI for those yet, added per RB
  // signature widening — unconfirmed live whether they affect filtering).
  SP_ITEM_MAIN_GROUP: "fn_fetch_itemmaingroup4popupfilter",
  SP_ITEM_SUB_MAIN_GROUP: "fn_fetch_itemsubmaingroup4popupfilter",

  SP_MASTER_FILL: "fn_tbl_rb_astcliallomst",
  SP_DETAIL_FILL: "fn_tbl_rb_astcliallodet",

  SAVE_ENDPOINT: "/API/AstCliAlloMst/Post_RB_AstCliAlloMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_astcliallomst_list",
  LIST_FROM_DIVISION_ID: 15,

  STORAGE_HEADER_META: "acaHeaderMeta",
  STORAGE_ENTRY_META: "acaEntryMeta",
};

export const ACA_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const ACA_FRM_TYPE_OPTIONS = [
  { value: String(ACA_CONFIG.FRM_TYPE), label: ACA_CONFIG.FRM_TYPE_LABEL },
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

export function buildAcaItemPickerJsonPayload(
  headerValues,
  {
    companyId,
    loginId,
    yearId,
    maGroupId = 0,
    subMaGroupId = 0,
    itemNameSearch = "",
    qrJson = "",
    otherStr = "",
  } = {}
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
    prmissuetypeid: ACA_CONFIG.ISSUE_TYPE_ID,
    // Trailing SP args — keep this order:
    // prmmaingroupid, prmsubmaingroupid, prmitemnamesearch, prmsearchtext, prmotherstr, prmjson, prmqrjson
    prmmaingroupid: Number(maGroupId) || 0,
    prmsubmaingroupid: Number(subMaGroupId) || 0,
    prmitemnamesearch: String(itemNameSearch ?? "").trim(),
    prmsearchtext: "",
    prmotherstr: String(otherStr ?? "").trim(),
    prmjson: "[]",
    prmqrjson: String(qrJson ?? "").trim(),
  };
}

export function buildAcaListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  fromDivisionId = ACA_CONFIG.LIST_FROM_DIVISION_ID,
  toLocationId = 0,
  toWorkingClientId = 0,
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
    prmtoworkingclientid: Number(toWorkingClientId) || 0,
  };
}

export function applyAcaHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    frmtype: ACA_CONFIG.FRM_TYPE,
    issuetypeid: ACA_CONFIG.ISSUE_TYPE_ID,
  };
}

export function resolveAcaColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildAcaCascadeResets(fieldDefs) {
  const fromDiv = resolveAcaColKey(fieldDefs, "fromdivisionid");
  const toLoc = resolveAcaColKey(fieldDefs, "tolocationid");
  const toDept = resolveAcaColKey(fieldDefs, "todeptid");
  const toClient = resolveAcaColKey(fieldDefs, "toworkingclientid");
  const config = resolveAcaColKey(fieldDefs, "configid");

  const resets = {};
  if (fromDiv) resets[fromDiv] = [toLoc, toDept, toClient, config].filter(Boolean);
  if (toClient) resets[toClient] = [];
  return resets;
}

export function validateAcaBusinessRules(headerValues = {}) {
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
    errors.push("Tran Date cannot be smaller than Issue Date.");
  }

  return errors;
}
