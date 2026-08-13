// Maintenance Contract Renewal — module config (MRD_Template4MntContractRenewal.docx)

import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import { getMissingMandatoryHeaderLabels } from "../../utils/columnValidation";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Maintenance Contract Renewal";
export const PAGE_TITLE_NEW = "New Maintenance Contract Renewal";

export const MACR_CONFIG = {
  RB_MASTER: RB_CODES.MAINTENANCE_CONTRACT_RENEWAL,
  ROUTE_PATH: rbRoutePath(RB_CODES.MAINTENANCE_CONTRACT_RENEWAL),
  // Document Log (F6) — not a Purchase-department transaction, uses ADMIN
  // (documentLogConfig.js's ADMIN_REF_DEPARTMENT_ID), per user confirmation.
  DM_TRAN_TYPE_ID: 322,
  RB_DETAIL: "rb_mntamcrnwdet",
  RB_TERMS_DETAIL: "rb_mntamcrnwtncdet",
  RB_ITEM_PICKER: "rb_mntamcrnwselonly",
  RB_TERMS_PICKER: "rb_mntamcnewtncsel",

  MODULE_CODE: "MC",
  FORM_TAG: "rb_mntamcrnwmst",
  TRAN_BOOK: "PMR",
  CONFIG_FORM_TAG: "MNTCLT",
  CONFIG_REF_TYPE: "PMR",
  SUPPLIER_PARTY_TYPE: "S",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_DIVISION: "fn_tbl_fetchuserwsdivision",
  SP_CONFIG: "fn_tbl_ddl_maintenanceconfiguration",
  SP_SUPPLIER: "fn_tbl_fetchcustomersuppliertranws4web",
  VIEW_CONTRACT_TYPE: "vw_mnt_contracttype",
  VIEW_FREQUENCY: "vw_gen_frequencytype",

  SP_ITEM_PICKER: "fn_tbl_rb_mntamcrnwselonly",
  SP_TERMS_PICKER: "fn_tbl_rb_mntamcrnwtncsel",

  SP_MASTER_FILL: "fn_tbl_rb_mntamcrnwmst",
  SP_DETAIL_FILL: "fn_tbl_rb_mntamcrnwdet",
  /** MRD §5.1 edit terms fill names the picker SP; use detail RB fill name. */
  SP_TERMS_FILL: "fn_tbl_rb_mntamcrnwtncdet",

  SAVE_ENDPOINT: "/API/MntAmcRnwMst/Post_RB_MntAmcRnwMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_mntamcrnwmst_list",
  LIST_DIVISION_ID: 15,

  STORAGE_HEADER_META: "macrHeaderMeta",
  STORAGE_ENTRY_META: "macrEntryMeta",
  STORAGE_TERMS_META: "macrTermsMeta",
};

export const MACR_GRID_TABS = [
  { id: "items", label: "Contract Item Detail" },
  { id: "terms", label: "Terms & Condition Detail" },
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

/** Terms picker gate — mandatory fields come only from GET_DETAIL_COL_DATA (IsMandatory + IsVisible). */
export function getMissingTermsPickerHeaderFields(headerValues, headerColumns = null) {
  return getMissingMandatoryHeaderLabels(headerValues, headerColumns);
}

/** fn_tbl_rb_mntamcrnwselonly — note MRD typo prmdivisonid. */
export function buildMacrItemPickerJsonPayload(headerValues, { companyId, loginId, yearId } = {}) {
  const session = getUserSession();
  return {
    prmdivisonid: pickHeaderInt(headerValues, "divisionid", "DivisionID"),
    prmsupplierid: pickHeaderInt(headerValues, "supplierid", "SupplierID"),
    prmcompanyid: Number(companyId) || session.companyId,
    prmloginid: Number(loginId) || session.loginId,
    prmyearid: Number(yearId) || session.yearId,
  };
}

/** fn_tbl_rb_mntamcrnwtncsel */
export function buildMacrTermsPickerJsonPayload(headerValues, loginId) {
  const session = getUserSession();
  return {
    prmdivisionid: pickHeaderInt(headerValues, "divisionid", "DivisionID"),
    prmtrandate:
      pickHeaderValue(headerValues, ["contractdate", "ContractDate", "trandate", "TranDate"]) ?? "",
    prmloginid: Number(loginId) || session.loginId,
    prmconfigid: pickHeaderInt(
      headerValues,
      "configtypeid",
      "ConfigTypeID",
      "configid",
      "ConfigID"
    ),
    prminqid: pickHeaderInt(headerValues, "idnumber", "IDNumber"),
  };
}

export function applyMacrHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    funccode: MACR_CONFIG.RB_MASTER,
  };
}

export function resolveMacrColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildMacrCascadeResets(fieldDefs) {
  const division = resolveMacrColKey(fieldDefs, "divisionid");
  const config = resolveMacrColKey(fieldDefs, "configtypeid", "configid");
  const supplier = resolveMacrColKey(fieldDefs, "supplierid");
  const resets = {};
  if (division) resets[division] = [config, supplier].filter(Boolean);
  return resets;
}

/** Contract To Date cannot be earlier than today (MRD §3). */
export function validateMacrBusinessRules(headerValues = {}) {
  const errors = [];
  const toDateRaw = pickHeaderValue(headerValues, ["contracttodate", "ContractToDate"]);
  if (toDateRaw) {
    const toDate = new Date(toDateRaw);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!Number.isNaN(toDate.getTime()) && toDate < today) {
      errors.push("Contract To Date cannot be earlier than the current date.");
    }
  }
  return errors;
}

export function buildMacrListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  divisionId = MACR_CONFIG.LIST_DIVISION_ID,
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
