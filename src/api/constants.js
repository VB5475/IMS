// constants.js — Shared API constants for the whole project
// ──────────────────────────────────────────────────────────
// Page-specific configs (RB codes, SP names, IDs, storage keys) live in each
// page's own constants file, e.g. src/pages/purchase-inquiry/constants.js.
// The re-exports below keep existing hook/component import paths unchanged.

// ── Base URLs ──────────────────────────────────────────────────────────
export const API_BASE_URL =
  'http://122.179.135.100:8095/IMS_LIVE/webservice/WsIMS.asmx';

export const API_BASE_URL_OLD =
  'http://122.179.135.100:8095/ERPWS_TB/webservice/WsIMS.asmx';

// REST-style endpoint — body is a JSON object, not query params.
// Used by SPs that route through the newer /API/Values gateway.
export const API_BASE_URL_IMS =
  'http://122.179.135.100:8095/IMS_LIVE';

// ── API endpoint paths ─────────────────────────────────────────────────
export const ENDPOINTS = {
  FN_FETCH_DATA: '/FN_Fetch_Data',
  // REST gateway — accepts a JSON body: { ObjType, ObjName, JSon (array), p_ErrCode, p_ErrMsg }
  API_VALUES: '/API/Values',
  GET_FILTERS: '/GetFilters',
  GET_FILTER_DETAIL: '/GetFilterDetail',
  GET_MASTER_DETAIL: '/GetMasterDetail',
  GET_PARAMETERS: '/GetParameters',
  GET_DETAIL_COL_DATA: '/GetDetailColData',
  GET_MASTER_DATA_FILL: '/GetMasterDataFill',
  RB_REPORTBOARD_DETAIL_SAVE: '/RB_ReportBoardDetail_Save',
  FN_TBL_RB_GRID_EVENT: '/fn_tbl_RB_Grid_Event',
  RB_MASTER_DETAIL_FORM_SAVE: '/RB_MasterDetailForm_Save',
};

// ── Shared request defaults (used across pages) ────────────────────────
export const DEFAULT_LOGIN_ID = 1;
export const DEFAULT_COMPANY_ID = 1;
export const DEFAULT_YEAR_ID = 13;
export const DEFAULT_SESSION_ID = 88;
export const DEFAULT_DIVISION_ID = 0;
export const API_TIMEOUT = 30000;

/** FN_Fetch_Data / API/Values — ObjType discriminator */
export const OBJ_TYPE = {
  PROCEDURE: 1,
  FUNCTION: 2,
};

export const CBO_MODE = {
  FILTER: 'F',
  COLUMN: 'C',
};

// ── Column data-type identifiers (prefix-matched against ColDataType) ──
export const COL_DATA_TYPE = {
  NUMERIC: 'numeric',   // → default 0
  VARCHAR: 'varchar',   // → default ''
  DATETIME: 'datetime',  // → default null
};

/**
 * Returns the correct server-side default value for a column based on its
 * ColDataType string from the GET_DETAIL_COL_DATA response.
 * @param {string|null|undefined} colDataType  e.g. "numeric(18,2)", "varchar(50)"
 * @returns {number|string|null}
 */
export function getColDefault(colDataType) {
  if (!colDataType) return null;
  const lower = colDataType.toLowerCase().trimStart();
  if (lower.startsWith(COL_DATA_TYPE.NUMERIC)) return 0;
  if (lower.startsWith(COL_DATA_TYPE.VARCHAR)) return '';
  if (lower.startsWith(COL_DATA_TYPE.DATETIME)) return null;
  return null;
}

// ══════════════════════════════════════════════════════════════════════
// Page-config re-exports — the authoritative definitions live in each
// page's own constants.js; these re-exports keep hooks and shared
// components working without touching their import paths.
// ══════════════════════════════════════════════════════════════════════
export { DASHBOARD_CONFIG } from '../pages/dashboard/constants';
export { REPORT_WORKSPACE_CONFIG } from '../pages/report-workspace/constants';
export { TXN_CONFIG } from '../pages/txn-entry/constants';
export { PI_CONFIG } from '../pages/purchase-inquiry/constants';
