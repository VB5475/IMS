// constants.js — Assets Employee Issue (AEI) page config
import { getUserSession } from "../../session/userSession";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Assets Employee Issue";
export const PAGE_TITLE_NEW = "New Assets Employee Issue";

// Values aligned to MRD_Template4AssetsIssue.docx (Richa, 23-Jun-2026).

/** Item-grid column that supports multi-value paste (Serial Number replication). */
export const AEI_MULTI_PASTE_COLUMNS = new Set(["assetsrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const AEI_REMARK_COLUMNS = new Set(["remark"]);

export const AEI_CONFIG = {
  RB_MASTER: "rb_astempissmst",
  DELETE_PROC_NAME: "pr_rb_astempissmst_delete",
  RB_DETAIL: "rb_astempissdet",
  RB_ITEM_PICKER: "rb_astempissselonly",

  MODULE_CODE: "AIS",
  FORM_TAG: "rb_astempissmst",
  TRAN_BOOK: "EI",
  /** MRD hardcode — FrmType value 1, label EI */
  FRM_TYPE: 1,
  FRM_TYPE_LABEL: "EI",
  CONFIG_FORM_TAG: "ASTIS",
  CONFIG_REF_TYPE: "EI",
  ISSUE_TYPE_ID: 1,
  /** fn_tbl_Rb_astempissselonly — MRD hardcode */
  ITEM_PICKER_ISSUE_TYPE_ID: -1,
  /** fn_gen_fetchfromuser / fn_gen_fetchtouser — MRD hardcode */
  EMP_ISSUE_TYPE_ID: 1,
  /** fn_gen_fetchfromvendor / fn_gen_fetchtovendor */
  VENDOR_ISSUE_TYPE_ID: 1,

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_FROM_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  SP_TO_DIVISION: "fn_tbl_fetchuserwstodivision",
  SP_FROM_LOCATION: "fn_gen_fetchfromlocationmaster",
  SP_TO_LOCATION: "fn_gen_fetchtolocationmaster",
  SP_FROM_DEPT: "fn_tbl_fetchfromdepartmentdata",
  SP_TO_DEPT: "fn_tbl_fetchtodepartmentdata",
  SP_FROM_EMP: "fn_gen_fetchfromuser",
  SP_TO_EMP: "fn_gen_fetchtouser",
  SP_FROM_WORKING_CLIENT: "fn_tbl_fetchfromworkingclient",
  SP_TO_WORKING_CLIENT: "fn_tbl_fetchtoworkingclient",
  SP_FROM_VENDOR: "fn_gen_fetchfromvendor",
  SP_TO_VENDOR: "fn_gen_fetchtovendor",
  SP_CONFIG: "fn_tbl_ddl_assetissueconfiguration",
  SP_ITEM_PICKER: "fn_tbl_Rb_astempissselonly",

  SP_MASTER_FILL: "fn_tbl_Rb_astempissmst",
  SP_DETAIL_FILL: "fn_tbl_Rb_astempissdet",

  SAVE_ENDPOINT: "/API/AstIssueMstSave/Post_RB_AstIssueMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_astempissmst_list",
  /** Default prmfromdivisionid for list fetch — CONFIRM with DBA */
  LIST_FROM_DIVISION_ID: 15,

  PARTY_TYPE_CLIENT: "C",

  STORAGE_HEADER_META: "aeiHeaderMeta",
  STORAGE_ENTRY_META: "aeiEntryMeta",
};

export const AEI_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const AEI_FRM_TYPE_OPTIONS = [
  { value: String(AEI_CONFIG.FRM_TYPE), label: AEI_CONFIG.FRM_TYPE_LABEL },
];

const AEI_ITEM_PICKER_REQUIRED_FIELDS = [
  { keys: ["fromdivisionid", "FromDivisionID"], label: "From Division" },
  { keys: ["trandate", "TranDate"], label: "Tran Date", isDate: true },
  { keys: ["fromlocationid", "FromLocationID"], label: "From Location" },
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
  return AEI_ITEM_PICKER_REQUIRED_FIELDS.filter((f) =>
    isMissingValue(f, pickHeaderValue(headerValues, f.keys))
  ).map((f) => f.label);
}

function pickHeaderInt(headerValues, ...keys) {
  const raw = pickHeaderValue(headerValues, keys);
  if (raw == null || raw === "") return 0;
  return Number(raw) || 0;
}

/** FN_FETCH_DATA JSON for fn_tbl_Rb_astempissselonly item picker rows. */
export function buildAeiItemPickerJsonPayload(headerValues, {
  companyId,
  loginId,
  yearId,
} = {}) {
  const session = getUserSession();
  return {
    prmcompanyid: Number(companyId) || session.companyId,
    prmloginid: Number(loginId ?? pickHeaderValue(headerValues, ["loginid", "LoginID"])) || session.loginId,
    prmyearid: Number(yearId ?? pickHeaderValue(headerValues, ["yearid", "YearID"])) || session.yearId,
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
    prmissuetypeid: AEI_CONFIG.ITEM_PICKER_ISSUE_TYPE_ID,
  };
}

export function buildAeiListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  fromDivisionId = AEI_CONFIG.LIST_FROM_DIVISION_ID,
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

export function applyAeiHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    frmtype: AEI_CONFIG.FRM_TYPE,
    issuetypeid: AEI_CONFIG.ISSUE_TYPE_ID,
  };
}

export function resolveAeiColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildAeiCascadeResets(fieldDefs) {
  const fromDiv = resolveAeiColKey(fieldDefs, "fromdivisionid");
  const fromLoc = resolveAeiColKey(fieldDefs, "fromlocationid");
  const fromDept = resolveAeiColKey(fieldDefs, "fromdeptid");
  const fromEmp = resolveAeiColKey(fieldDefs, "fromempuserid");
  const fromVendor = resolveAeiColKey(fieldDefs, "fromvendorid");
  const fromClient = resolveAeiColKey(fieldDefs, "fromworkingclientid");
  const toDiv = resolveAeiColKey(fieldDefs, "todivisionid");
  const toLoc = resolveAeiColKey(fieldDefs, "tolocationid");
  const toDept = resolveAeiColKey(fieldDefs, "todeptid");
  const toEmp = resolveAeiColKey(fieldDefs, "toempuserid");

  const resets = {};
  if (fromDiv) {
    resets[fromDiv] = [fromLoc, fromEmp, fromVendor, fromClient].filter(Boolean);
  }
  if (fromLoc && fromEmp) resets[fromLoc] = [fromEmp];
  if (fromDept && fromEmp) resets[fromDept] = [fromEmp];
  if (toDiv) resets[toDiv] = [toLoc, toEmp].filter(Boolean);
  if (toLoc && toEmp) resets[toLoc] = [toEmp];
  if (toDept && toEmp) resets[toDept] = [toEmp];
  return resets;
}
