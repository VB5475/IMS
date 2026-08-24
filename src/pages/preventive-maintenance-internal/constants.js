// Preventive Maintenance Internal — MRD_Template4MntInternalMaintenance.docx

import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import { getMissingMandatoryHeaderLabels } from "../../utils/columnValidation";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Preventive Maintenance Internal";
export const PAGE_TITLE_NEW = "New Preventive Maintenance Internal";

export const PMI_CONFIG = {
  RB_MASTER: RB_CODES.PREVENTIVE_MAINTENANCE_INTERNAL,
  ROUTE_PATH: rbRoutePath(RB_CODES.PREVENTIVE_MAINTENANCE_INTERNAL),
  RB_DETAIL: "rb_mntpmidet",
  RB_ITEM_PICKER: "rb_mntpmiselonly",

  MODULE_CODE: "PMI",
  FORM_TAG: "rb_mntpmimst",
  TRAN_BOOK: "MCI",
  CONFIG_FORM_TAG: "MNTCLT",
  CONFIG_REF_TYPE: "PMI",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_DIVISION: "fn_tbl_fetchuserwsdivision",
  SP_CONFIG: "fn_tbl_ddl_maintenanceconfiguration",
  VIEW_FREQUENCY: "vw_gen_frequencytype",

  SP_ITEM_PICKER: "fn_tbl_rb_mntpmiselonly",
  SP_MASTER_FILL: "fn_tbl_rb_mntpmimst",
  SP_DETAIL_FILL: "fn_tbl_rb_mntpmidet",

  SAVE_ENDPOINT: "/API/MntPMIMst/Post_RB_MntPMIMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_mntpmimst_list",
  LIST_DIVISION_ID: 15,

  STORAGE_HEADER_META: "pmiHeaderMeta",
  STORAGE_ENTRY_META: "pmiEntryMeta",
};

export const PMI_GRID_TABS = [{ id: "items", label: "Contract Item Detail" }];

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

export function getMissingItemPickerHeaderFields(headerValues, headerColumns = null) {
  return getMissingMandatoryHeaderLabels(headerValues, headerColumns);
}

/** fn_tbl_rb_mntpmiselonly — MRD typo prmdivisonid preserved. */
export function buildPmiItemPickerJsonPayload(headerValues, { companyId, loginId, yearId } = {}) {
  const session = getUserSession();
  return {
    prmdivisonid: pickHeaderInt(headerValues, "divisionid", "DivisionID"),
    prmcompanyid: Number(companyId) || session.companyId,
    prmloginid: Number(loginId) || session.loginId,
    prmyearid: Number(yearId) || session.yearId,
  };
}

export function applyPmiHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    funccode: PMI_CONFIG.RB_MASTER,
  };
}

export function resolvePmiColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildPmiCascadeResets(fieldDefs) {
  const division = resolvePmiColKey(fieldDefs, "divisionid");
  const config = resolvePmiColKey(fieldDefs, "configtypeid", "configid");
  const resets = {};
  if (division) resets[division] = [config].filter(Boolean);
  return resets;
}

export function validatePmiBusinessRules(headerValues = {}) {
  const errors = [];
  const toDateRaw = pickHeaderValue(headerValues, ["contracttodate", "ContractToDate"]);
  const fromDateRaw = pickHeaderValue(headerValues, ["contractfromdate", "ContractFromDate"]);
  if (fromDateRaw && toDateRaw) {
    const fromDate = new Date(fromDateRaw);
    const toDate = new Date(toDateRaw);
    if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime()) && toDate < fromDate) {
      errors.push("Contract To Date cannot be earlier than Contract From Date.");
    }
  }
  return errors;
}

export function buildPmiListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  divisionId = PMI_CONFIG.LIST_DIVISION_ID,
} = {}) {
  const session = getUserSession();
  const year = new Date().getFullYear();
  return {
    prmcompanyid: Number(companyId) || session.companyId,
    prmdivisionid: Number(divisionId) || 0,
    prmyearid: Number(yearId) || session.yearId,
    prmfromdate: fromDate ?? `01-Jan-${year}`,
    prmtodate: toDate ?? `31-Dec-${year}`,
    prmloginid: Number(loginId) || session.loginId,
  };
}
