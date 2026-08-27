// constants.js — Assets Employee Issue (AEI) page config
import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import { parseQrItemPayload } from "../../utils/qrScanJson";
import { getMissingMandatoryHeaderLabels } from "../../utils/columnValidation";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Assets Employee Issue";
export const PAGE_TITLE_NEW = "New Assets Employee Issue";

// Values aligned to MRD_Template4AssetsIssue.docx (Richa, 23-Jun-2026).

/** Item-grid column that supports multi-value paste (Serial Number replication). */
export const AEI_MULTI_PASTE_COLUMNS = new Set(["assetsrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const AEI_REMARK_COLUMNS = new Set(["remark"]);

export const AEI_CONFIG = {
  RB_MASTER: RB_CODES.ASSETS_EMPLOYEE_ISSUE,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSETS_EMPLOYEE_ISSUE),
  DELETE_PROC_NAME: "pr_rb_astempissmst_delete",
  // Document Log (F6) — this module's own DM Tran Type id, used by
  // useDocumentLogAccess (2026-08-14, /pm). Department id is DM Department
  // Master id=12, see documentLogConfig.js's REF_DEPARTMENT_ID.ASSETS_EMPLOYEE_ISSUE.
  DM_TRAN_TYPE_ID: 323,
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
  SP_FROM_LOCATION: "fn_gen_fetchastissfromlocationmaster",
  SP_TO_LOCATION: "fn_gen_fetchastisstolocationmaster",
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
  // Select Item popup filters — any one of Main Group / Sub Main Group /
  // Item Name (≥3 chars). Unselected filters are sent as defaults (0 / "").
  // Manual Search modal uses prmotherstr (Sr No). Header QR scan uses prmqrjson.
  SP_ITEM_MAIN_GROUP: "fn_fetch_itemmaingroup4popupfilter",
  SP_ITEM_SUB_MAIN_GROUP: "fn_fetch_itemsubmaingroup4popupfilter",

  SP_MASTER_FILL: "fn_tbl_Rb_astempissmst",
  SP_DETAIL_FILL: "fn_tbl_Rb_astempissdet",

  SAVE_ENDPOINT: "/API/AstIssueMstSave/Post_RB_AstIssueMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_astempissmst_list",
  /** Default prmfromdivisionid for list fetch — CONFIRM with DBA */
  LIST_FROM_DIVISION_ID: 15,

  // WKF "Approval Initiator" send-for-approval button (2026-08-25 /pm) —
  // user-confirmed transaction-type id; routes on From Division (fromdivisionid).
  WKF_TRAN_TYPE_ID: 379,

  PARTY_TYPE_CLIENT: "C",

  STORAGE_HEADER_META: "aeiHeaderMeta",
  STORAGE_ENTRY_META: "aeiEntryMeta",
};

export const AEI_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const AEI_FRM_TYPE_OPTIONS = [
  { value: String(AEI_CONFIG.FRM_TYPE), label: AEI_CONFIG.FRM_TYPE_LABEL },
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

/** Select Item gate — mandatory fields come only from GET_DETAIL_COL_DATA (IsMandatory + IsVisible). */
export function getMissingItemPickerHeaderFields(headerValues, headerColumns = null) {
  return getMissingMandatoryHeaderLabels(headerValues, headerColumns);
}

function pickHeaderInt(headerValues, ...keys) {
  const raw = pickHeaderValue(headerValues, keys);
  if (raw == null || raw === "") return 0;
  return Number(raw) || 0;
}

/**
 * Parse pasted/scanned QR JSON for Select Item (prmqrjson).
 * Accepts any key casing (ItemCode, SrNo, …) and normalizes to
 * { "itemcode": "...", "srno": "..." }.
 */
export function normalizeAeiQrSearchJson(rawText) {
  const trimmed = String(rawText ?? "").trim();
  if (!trimmed) return { error: "Enter both Item Code and Sr No." };
  const parsed = parseQrItemPayload(trimmed);
  if (!parsed) {
    return { error: "Invalid JSON. Expected itemcode and srno (any key casing)." };
  }
  return { qrJson: JSON.stringify(parsed) };
}

/** FN_FETCH_DATA JSON for fn_tbl_Rb_astempissselonly item picker rows. */
export function buildAeiItemPickerJsonPayload(headerValues, {
  companyId,
  loginId,
  yearId,
  maGroupId = 0,
  subMaGroupId = 0,
  itemNameSearch = "",
  qrJson = "",
  otherStr = "",
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
    // Trailing SP args — keep this order:
    // prmmaingroupid, prmsubmaingroupid, prmitemnamesearch, prmsearchtext,
    // prmotherstr, prmjson, prmqrjson
    prmmaingroupid: Number(maGroupId) || 0,
    prmsubmaingroupid: Number(subMaGroupId) || 0,
    prmitemnamesearch: String(itemNameSearch ?? "").trim(),
    prmsearchtext: "",
    prmotherstr: String(otherStr ?? "").trim(),
    prmjson: "[]",
    prmqrjson: String(qrJson ?? "").trim(),
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

  // 2026-08-14 (/pm): live-verified via Playwright that changing Division or
  // From Location left "To Employee" showing its stale, pre-change selection
  // even though AssetsEmployeeIssueForm's own handleFilterChange already
  // resets headerValuesRef.current.toempuserid to 0 at the data layer for
  // both cascades — this map (EnterpriseFilterPanel's own display-only
  // `values` state) is what actually drives what the SearchSelect shows, and
  // it wasn't clearing toEmp for either cascade. Added here so the visible
  // field always matches the real (reset) value instead of lagging behind it.
  const resets = {};
  if (fromDiv) {
    resets[fromDiv] = [fromLoc, fromEmp, fromVendor, fromClient, toEmp].filter(Boolean);
  }
  if (fromLoc) resets[fromLoc] = [fromEmp, toEmp].filter(Boolean);
  if (fromDept && fromEmp) resets[fromDept] = [fromEmp];
  if (toDiv) resets[toDiv] = [toLoc, toEmp].filter(Boolean);
  if (toLoc && toEmp) resets[toLoc] = [toEmp];
  if (toDept && toEmp) resets[toDept] = [toEmp];
  return resets;
}
