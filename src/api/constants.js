// constants.js — Shared API constants for the whole project
// ──────────────────────────────────────────────────────────
// Page-specific configs (RB codes, SP names, IDs, storage keys) live in each
// page's own constants file, e.g. src/pages/purchase-inquiry/constants.js.
// The re-exports below keep existing hook/component import paths unchanged.

// ── Base URLs ──────────────────────────────────────────────────────────
// Resolved once, at module scope — public/config.json decides whether the
// backend is pinned or user-selectable, so loadRuntimeConfig() has to have
// resolved before this module is imported (src/main.jsx guarantees that).
import {
  BASE_PROJECTS,
  getBaseDomain,
  getBaseProject,
  isEnvSwitcherEnabled,
  setBaseProject,
} from "../config/runtimeConfig";

export const BASE_PROJECT_OPTIONS = BASE_PROJECTS;
export const PROD_BASE_PROJECT = getBaseProject();
/** False when config.json pins a single backend — hides the env switcher UI. */
export const ENV_SWITCHER_ENABLED = isEnvSwitcherEnabled();
export const switchBaseProject = setBaseProject;

const DOMAIN_ROOT = getBaseDomain();
const BASE_DOMAIN = DOMAIN_ROOT + PROD_BASE_PROJECT;
export const API_BASE_URL = BASE_DOMAIN + "/webservice/WsIMS.asmx";

export const API_BASE_URL_OLD = DOMAIN_ROOT + "ERPWS_TB/webservice/WsIMS.asmx";

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
  // Document Log permissions (fetched once at login, cached in user session —
  // see extractDmConfigPermissions in session/userSession.js).
  DM_CONFIG: "/API/DM_Config/Post_RB_DM_Config",
  // Issues a GUID for a not-yet-saved transaction (so document uploads can be
  // associated with it before a real TranID exists) — fetched on new-entry
  // load, per-form state (not session). Live-confirmed 2026-07-30: exists on
  // IMS_LIVE only (404 on IMS_PGLIVE), plain JSON object body (NOT an array),
  // and — confirmed the same day IMS ERPWS - DM API.docx's other endpoints
  // went live — LOWERCASE field names (prmguid/prmref_trantypeid/prmtranid),
  // NOT the mixed-case the doc itself documented (prmGUID/prmRef_TranTypeID/
  // prmTranID, which 500s). See PurchaseIndentForm.jsx's fetchDocGuid.
  DM_HANDLE_GUID: "/API/DM_HandleGUID/Post_RB_DM_HandleGUID",
  // Per-transaction-type Document Log button visibility flag (isdmbtnvisible).
  // Live-confirmed 2026-07-30: IMS_LIVE only, plain JSON object body (the
  // user's own Postman screenshot showed an array, but that 400s — object
  // is what actually works, same gotcha as DM_HANDLE_GUID above). Response
  // is an array of one row: [{ isdmbtnvisible: "YES"|"NO", errcode, errmsg }].
  DM_HANDLE_BUTTON_VISIBILITY: "/API/DM_HandleButtonVisibility/Post_RB_DM_HandleButtonVisibility",
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
  VIEW: 3,
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

/** Current timestamp in the app's stored-date format (matches dateToStoredValue's "T" shape). */
export function nowStoredValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Build a save payload row: seed every column from GET_DETAIL_COL_DATA (incl. hidden),
 * then overlay row values. Empty/null/"" uses getColDefault(ColDataType).
 * "logdate" is a hidden audit-timestamp column present across RB tables — some save
 * SPs stamp it server-side, others (e.g. pr_rb_accountmst_save) enforce NOT NULL and
 * expect the caller to supply it, so it's stamped client-side here rather than left null.
 */
export function buildSaveRowFromColumns(rest, columnDefs, extraFields = {}) {
  const row = {};
  columnDefs.forEach(({ key, colDataType }) => {
    const raw = rest[key];
    if (raw == null || raw === "") {
      row[key] = key.toLowerCase() === "logdate" ? nowStoredValue() : getColDefault(colDataType);
      return;
    }
    const lower = colDataType ? String(colDataType).toLowerCase() : "";
    row[key] = lower && isNumericTypeStr(lower) ? (Number(raw) || 0) : raw;
  });
  const rowKeysLower = new Set(Object.keys(row).map((k) => k.toLowerCase()));
  Object.entries(rest).forEach(([k, v]) => {
    // Leading underscore = internal-only UI state (e.g. _isUploaded,
    // _docSubTypeOptions, _pgId elsewhere in this app), never a real column —
    // must never leak into a save payload.
    if (k === "id" || k.startsWith("_") || k in row || rowKeysLower.has(k.toLowerCase())) return;
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
