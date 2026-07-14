// constants.js — Shared API constants for the whole project
// ──────────────────────────────────────────────────────────
// Page-specific configs (RB codes, SP names, IDs, storage keys) live in each
// page's own constants file, e.g. src/pages/purchase-inquiry/constants.js.
// The re-exports below keep existing hook/component import paths unchanged.

// ── Base URLs ──────────────────────────────────────────────────────────
const PROJECT_STORAGE_KEY = "ims_base_project";
export const BASE_PROJECT_OPTIONS = ["IMS_LIVE", "IMS_PGLIVE"];
export const PROD_BASE_PROJECT =
  localStorage.getItem(PROJECT_STORAGE_KEY) || "IMS_LIVE";

export function switchBaseProject(name) {
  localStorage.setItem(PROJECT_STORAGE_KEY, name);
  window.location.reload();
}

const BASE_DOMAIN = "http://122.179.135.100:8095/" + PROD_BASE_PROJECT;
export const API_BASE_URL = BASE_DOMAIN + "/webservice/WsIMS.asmx";

export const API_BASE_URL_OLD = "http://122.179.135.100:8095/ERPWS_TB/webservice/WsIMS.asmx";

// REST-style endpoint — body is a JSON object, not query params.
// Used by SPs that route through the newer /API/Values gateway.
// export const API_BASE_URL_IMS = "http://122.179.135.100:8095/IMS_LIVE";
// export const API_BASE_URL_IMS = "http://122.179.135.100:8095/IMS_PGLIVE";
export const API_BASE_URL_IMS = BASE_DOMAIN;

// ── API endpoint paths ─────────────────────────────────────────────────
export const ENDPOINTS = {
  FN_FETCH_DATA: "/FN_Fetch_Data",
  // REST gateway — accepts a JSON body: { ObjType, ObjName, JSon (array), p_ErrCode, p_ErrMsg }
  API_VALUES: "/API/Values",
  GET_FILTERS: "/GetFilters",
  GET_FILTER_DETAIL: "/GetFilterDetail",
  GET_MASTER_DETAIL: "/GetMasterDetail",
  GET_PARAMETERS: "/GetParameters",
  GET_DETAIL_COL_DATA: "/GetDetailColData",
  GET_MASTER_DATA_FILL: "/GetMasterDataFill",
  RB_REPORTBOARD_DETAIL_SAVE: "/RB_ReportBoardDetail_Save",
  FN_TBL_RB_GRID_EVENT: "/fn_tbl_RB_Grid_Event",
  TRAN_FORM_EVENT: "/API/TransactionFormEvent/Post_RB_TransactionFormEvent",
  TRAN_FORM_DELETE: "/API/TranFormDelete/Post_TranFormDelete",
  RB_MASTER_DETAIL_FORM_SAVE: "/RB_MasterDetailForm_Save",
  GENERATE_REPORT: "/API/Report/GenerateReport",
};

// ── Shared request defaults (used across pages) ────────────────────────
// CompanyID/YearID/LoginID come from the login-time session (see
// src/session/userSession.js, getUserSession()) — do not reintroduce
// hardcoded fallbacks for those here.
export const DEFAULT_SESSION_ID = 88;
export const DEFAULT_DIVISION_ID = 0;
export const API_TIMEOUT = 30000;

// TODO(tech-debt): Asset Revaluation / Health Status Updation / Item Opening Excel
// import these instead of reading getUserSession().loginId / .companyId, breaking the
// convention above. Values mirror DEFAULT_USER_SESSION's fallback (session/userSession.js)
// purely to unblock the build — those pages should be migrated to getUserSession() and
// these two exports removed.
export const DEFAULT_LOGIN_ID = 1;
export const DEFAULT_COMPANY_ID = 1;

/** FN_Fetch_Data / API/Values — ObjType discriminator */
export const OBJ_TYPE = {
  PROCEDURE: 1,
  FUNCTION: 2,
};

export const CBO_MODE = {
  FILTER: "F",
  COLUMN: "C",
};

// ── Column data-type identifiers (prefix-matched against ColDataType) ──
export const COL_DATA_TYPE = {
  NUMERIC: "numeric",   // → default 0
  DECIMAL: "decimal",   // PG alias for numeric   → default 0
  FLOAT: "float",     // float4 / float8        → default 0
  REAL: "real",      // float4                 → default 0
  DOUBLE: "double",    // double precision       → default 0
  INT: "int",       // integer / bigint / smallint → default 0
  MONEY: "money",     // money                  → default 0
  VARCHAR: "varchar",   // → default ''
  TEXT: "text",      // PG text                → default ''
  DATETIME: "datetime", // → default null
};

/** True if the lower-cased colDataType string represents any numeric PG type. */
function isNumericTypeStr(lower) {
  return (
    lower.includes("numeric") ||
    lower.includes("decimal") ||
    lower.includes("float") ||
    lower.includes("real") ||
    lower.includes("double") ||
    lower.includes("int") ||   // integer, bigint, smallint
    lower.includes("money")
  );
}

/**
 * Returns the correct server-side default value for a column based on its
 * ColDataType string from the GET_DETAIL_COL_DATA response.
 * @param {string|null|undefined} colDataType  e.g. "numeric(18,2)", "decimal(10,4)", "integer"
 * @returns {number|string|null}
 */
export function getColDefault(colDataType) {
  if (!colDataType) return null;
  const lower = String(colDataType).toLowerCase();
  if (isNumericTypeStr(lower)) return 0;
  if (lower.includes("varchar") || lower.includes("text") || lower.includes("char")) return "";
  if (lower.includes("datetime") || lower.includes("date") || lower.includes("time")) return null;
  return null;
}

/**
 * Build a save payload row: seed every column from GET_DETAIL_COL_DATA (incl. hidden),
 * then overlay row values. Empty/null/"" uses getColDefault(ColDataType).
 */
export function buildSaveRowFromColumns(rest, columnDefs, extraFields = {}) {
  const row = {};
  columnDefs.forEach(({ key, colDataType }) => {
    const raw = rest[key];
    if (raw == null || raw === "") {
      row[key] = getColDefault(colDataType);
      return;
    }
    const lower = colDataType ? String(colDataType).toLowerCase() : "";
    row[key] = lower && isNumericTypeStr(lower) ? (Number(raw) || 0) : raw;
  });
  Object.entries(rest).forEach(([k, v]) => {
    if (k === "id" || k in row) return;
    row[k] = v;
  });
  return { ...row, ...extraFields };
}

// ══════════════════════════════════════════════════════════════════════
// Page-config re-exports — the authoritative definitions live in each
// page's own constants.js; these re-exports keep hooks and shared
// components working without touching their import paths.
// ══════════════════════════════════════════════════════════════════════
export { DASHBOARD_CONFIG } from "../pages/dashboard/constants";
export { REPORT_WORKSPACE_CONFIG } from "../pages/report-workspace/constants";
export { TXN_CONFIG } from "../pages/txn-entry/constants";
export { PI_CONFIG } from "../pages/purchase-inquiry/constants";
export { QTN_CONFIG } from "../pages/purchase-quotation/constants";
export { PO_CONFIG } from "../pages/purchase-order/constants";
