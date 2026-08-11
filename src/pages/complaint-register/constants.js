import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import { getMissingMandatoryHeaderLabels } from "../../utils/columnValidation";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Complaint Register";
export const PAGE_TITLE_NEW = "New Complaint Register";

export const MCR_CONFIG = {
  RB_MASTER: RB_CODES.COMPLAINT_REGISTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.COMPLAINT_REGISTER),
  RB_DETAIL: "rb_mntcpndet",
  RB_ITEM_PICKER: "rb_mntcpnselonly",

  MODULE_CODE: "MNT",
  FORM_TAG: "rb_mntcpnmst",
  TRAN_BOOK: "CPN",
  FRM_TYPE: "CPN",
  FRM_TYPE_LABEL: "CPN",
  CONFIG_FORM_TAG: "MNTCLT",
  CONFIG_REF_TYPE: "CPN",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_DIVISION: "fn_tbl_fetchuserwsdivision",
  SP_FROM_LOCATION: "fn_gen_fetchastissfromlocationmaster",
  SP_DEPARTMENT: "fn_gen_fetchdepartmentmaster",
  SP_CONFIG: "fn_tbl_ddl_maintenanceconfiguration",
  SP_ITEM_PICKER: "fn_tbl_rb_mntcpnselonly",

  SP_MASTER_FILL: "fn_tbl_rb_mntcpnmst",
  SP_DETAIL_FILL: "fn_tbl_rb_mntcpndet",

  SAVE_ENDPOINT: "/API/MntComplainMstSave/Post_RB_MntComplainMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_mntcpnmst_list",
  LIST_FROM_DIVISION_ID: 15,

  DELETE_PROC_NAME: "pr_rb_mntcomplainmst_delete",

  STORAGE_HEADER_META: "mcrHeaderMeta",
  STORAGE_ENTRY_META: "mcrEntryMeta",
};

export const MCR_GRID_TABS = [{ id: "items", label: "Item Grid" }];

export const MCR_FRM_TYPE_OPTIONS = [
  { value: String(MCR_CONFIG.FRM_TYPE), label: MCR_CONFIG.FRM_TYPE_LABEL },
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

export function buildMcrItemPickerJsonPayload(
  headerValues,
  { companyId, loginId, yearId } = {}
) {
  const session = getUserSession();
  const divisionId = pickHeaderInt(headerValues, "divisionid", "DivisionID");

  return {
    prmcompanyid: Number(companyId) || session.companyId,
    prmloginid: Number(loginId ?? pickHeaderValue(headerValues, ["loginid", "LoginID"])) || session.loginId,
    prmyearid: Number(yearId ?? pickHeaderValue(headerValues, ["yearid", "YearID"])) || session.yearId,
    prmtrandate: pickHeaderValue(headerValues, ["trandate", "TranDate"]) ?? "",
    prmdivisionid: divisionId,
    prmfromlocationid: pickHeaderInt(headerValues, "fromlocationid", "FromLocationID"),
    prmtolocationid: 0,
    prmfromdeptid: pickHeaderInt(headerValues, "fromdeptid", "FromDeptID"),
    prmtodeptid: 0,
    prmservicetypeid: 0,
    prmvendorid: 0,
    prmconfigid: pickHeaderInt(headerValues, "configid", "ConfigID"),
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
  const dept = resolveMcrColKey(fieldDefs, "fromdeptid");
  const config = resolveMcrColKey(fieldDefs, "configid");

  const resets = {};
  if (division) resets[division] = [location, dept, config].filter(Boolean);
  if (location) resets[location] = [config].filter(Boolean);
  return resets;
}

export function validateMcrBusinessRules() {
  return [];
}

export function buildMcrListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  fromDivisionId = MCR_CONFIG.LIST_FROM_DIVISION_ID,
  toVendorId = 0,
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
    prmfromdivisionid: Number(fromDivisionId) || 0,
    prmtovendorid: Number(toVendorId) || 0,
    prmtodeptid: Number(toDeptId) || 0,
  };
}
