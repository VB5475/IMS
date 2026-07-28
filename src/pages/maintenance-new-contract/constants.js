// Maintenance Contract (New) — module config (MRD_Template4MntNewContractGeneration.docx)

import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";

export const PAGE_TITLE = "Maintenance Contract (New)";
export const PAGE_TITLE_NEW = "New Maintenance Contract";

export const MACNG_CONFIG = {
  RB_MASTER: RB_CODES.MAINTENANCE_NEW_CONTRACT,
  ROUTE_PATH: rbRoutePath(RB_CODES.MAINTENANCE_NEW_CONTRACT),
  RB_DETAIL: "rb_mntamcnewdet",
  RB_TERMS_DETAIL: "rb_mntamcnewtncdet",
  RB_ITEM_PICKER: "rb_mntamcnewselonly",
  RB_TERMS_PICKER: "rb_mntamcnewtncsel",

  MODULE_CODE: "MC",
  FORM_TAG: "rb_mntamcnewmst",
  TRAN_BOOK: "CA",
  CONFIG_FORM_TAG: "MNTCLT",
  CONFIG_REF_TYPE: "PMN",
  SUPPLIER_PARTY_TYPE: "S",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_DIVISION: "fn_tbl_fetchuserwsdivision",
  SP_CONFIG: "fn_tbl_ddl_maintenanceconfiguration",
  SP_SUPPLIER: "fn_tbl_fetchcustomersuppliertranws4web",
  VIEW_CONTRACT_TYPE: "vw_mnt_contracttype",
  VIEW_FREQUENCY: "vw_gen_frequencytype",

  SP_ITEM_PICKER: "fn_tbl_rb_mntamcnewselonly",
  SP_TERMS_PICKER: "fn_tbl_rb_mntamcnewtncsel",

  SP_MASTER_FILL: "fn_tbl_rb_mntamcnewmst",
  SP_DETAIL_FILL: "fn_tbl_rb_mntamcnewdet",
  SP_TERMS_FILL: "fn_tbl_rb_mntamcnewtncdet",

  SAVE_ENDPOINT: "/API/MntAmcNewMst/Post_RB_MntAmcNewMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_mntamcnewmst_list",
  LIST_DIVISION_ID: 15,

  STORAGE_HEADER_META: "macngHeaderMeta",
  STORAGE_ENTRY_META: "macngEntryMeta",
  STORAGE_TERMS_META: "macngTermsMeta",
};

export const MACNG_GRID_TABS = [
  { id: "items", label: "Contract Item Detail" },
  { id: "terms", label: "Terms & Condition Detail" },
];

const ITEM_PICKER_REQUIRED = [
  { keys: ["divisionid", "DivisionID"], label: "Division" },
];

const TERMS_PICKER_REQUIRED = [
  { keys: ["divisionid", "DivisionID"], label: "Division" },
  { keys: ["configtypeid", "ConfigTypeID", "configid", "ConfigID"], label: "Config Type" },
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

function isMissingValue(value) {
  if (value == null || value === "") return true;
  return Number(value) === 0 || value === "0";
}

function pickHeaderInt(headerValues, ...keys) {
  const raw = pickHeaderValue(headerValues, keys);
  if (raw == null || raw === "") return 0;
  return Number(raw) || 0;
}

export function getMissingItemPickerHeaderFields(headerValues) {
  return ITEM_PICKER_REQUIRED.filter((f) => isMissingValue(pickHeaderValue(headerValues, f.keys))).map(
    (f) => f.label
  );
}

export function getMissingTermsPickerHeaderFields(headerValues) {
  return TERMS_PICKER_REQUIRED.filter((f) => isMissingValue(pickHeaderValue(headerValues, f.keys))).map(
    (f) => f.label
  );
}

/** fn_tbl_rb_mntamcnewselonly — MRD typo prmdivisonid; no supplier param. */
export function buildMacngItemPickerJsonPayload(headerValues, { companyId, loginId, yearId } = {}) {
  const session = getUserSession();
  return {
    prmdivisonid: pickHeaderInt(headerValues, "divisionid", "DivisionID"),
    prmcompanyid: Number(companyId) || session.companyId,
    prmloginid: Number(loginId) || session.loginId,
    prmyearid: Number(yearId) || session.yearId,
  };
}

/** fn_tbl_rb_mntamcnewtncsel */
export function buildMacngTermsPickerJsonPayload(headerValues, loginId) {
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

export function applyMacngHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    funccode: MACNG_CONFIG.RB_MASTER,
  };
}

export function resolveMacngColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildMacngCascadeResets(fieldDefs) {
  const division = resolveMacngColKey(fieldDefs, "divisionid");
  const config = resolveMacngColKey(fieldDefs, "configtypeid", "configid");
  const supplier = resolveMacngColKey(fieldDefs, "supplierid");
  const resets = {};
  if (division) resets[division] = [config, supplier].filter(Boolean);
  return resets;
}

/** Contract To Date cannot be earlier than today (MRD §3). */
export function validateMacngBusinessRules(headerValues = {}) {
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

export function buildMacngListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  divisionId = MACNG_CONFIG.LIST_DIVISION_ID,
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
