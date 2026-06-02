// constants.js — All API-related constants for the project
// ─────────────────────────────────────────────────────────

export const API_BASE_URL =
  'http://122.179.135.100:8095/ERPWS_TB/webservice/WsIMS.asmx';

export const ENDPOINTS = {
  /** Dashboard: fetches report board summary rows (ReportBoardName, Overdue, etc.) */
  FN_FETCH_DATA: '/FN_Fetch_Data',

  /** Fetches filter definitions for a given master ID */
  GET_FILTERS: '/GetFilters',

  /** Fetches dropdown options for a specific filter parameter */
  GET_FILTER_DETAIL: '/GetFilterDetail',

  /** Fetches master detail info (QueryName, FuncCode, etc.) */
  GET_MASTER_DETAIL: '/GetMasterDetail',

  /** Fetches stored procedure parameters for a given QueryName */
  GET_PARAMETERS: '/GetParameters',

  /** Fetches column definitions for the grid */
  GET_DETAIL_COL_DATA: '/GetDetailColData',

  /** Fetches grid row data by executing the built procedure string */
  GET_MASTER_DATA_FILL: '/GetMasterDataFill',

  /** Saves selected rows to the backend */
  RB_REPORTBOARD_DETAIL_SAVE: '/RB_ReportBoardDetail_Save',

  FN_TBL_RB_GRID_EVENT: "/fn_tbl_RB_Grid_Event",
  RB_MASTER_DETAIL_FORM_SAVE: "/RB_MasterDetailForm_Save"
};

/**
 * Params for FN_FETCH_DATA when fetching the report board summary.
 * ObjType=2, ObjName identifies the stored function.
 */
export const REPORT_BOARD_SUMMARY = {
  OBJ_TYPE: 2,
  OBJ_NAME: 'Fn_tbl_FetchReportBoardSummaryUserWise',
};

export const CBO_MODE = {
  FILTER: 'F',
  COLUMN: 'C',
};

export const STORAGE_KEYS = {
  MASTER_DETAIL: 'masterDetail',
  TXN_ENTRY_META: 'txnEntryMeta',       // { RBID, SaveProcName } for detail grid (RB_SampleInvDet)
  TXN_HEADER_META: 'txnHeaderMeta',     // { RBID, SaveProcName } for master header (RB_SampleInvMst)
};


export const DEFAULT_RB_CODE_TXN = "RB_SampleInvDet"
export const DEFAULT_RB_CODE_TXN_MST = "RB_SampleInvMst"   // header filter panel
export const DEFAULT_LOGIN_ID = 1;
export const DEFAULT_COMPANY_ID = 1;
export const DEFAULT_YEAR_ID = 13;
export const DEFAULT_SESSION_ID = 88;
export const DEFAULT_DIVISION_ID = 0;

export const API_TIMEOUT = 30000;

// ── Column data-type identifiers (prefix-matched against ColDataType) ─
// The API returns values like "numeric(18,0)", "varchar(50)", "datetime".
// We only need the leading keyword — everything after the first '(' is ignored.
export const COL_DATA_TYPE = {
  NUMERIC: 'numeric',   // → default 0
  VARCHAR: 'varchar',   // → default ''  (empty string)
  DATETIME: 'datetime',  // → default null
};

/**
 * Returns the correct server-side default value for a column based on its
 * ColDataType string from the GET_DETAIL_COL_DATA response.
 *
 * Rules (prefix-matched, case-insensitive):
 *   numeric*  → 0
 *   varchar*  → ''
 *   datetime* → null
 *   (unknown) → null   (safe fallback)
 *
 * @param {string|null|undefined} colDataType  e.g. "numeric(18,2)", "varchar(50)"
 * @returns {number|string|null}
 */
export function getColDefault(colDataType) {
  if (!colDataType) return null;
  const lower = colDataType.toLowerCase().trimStart();
  if (lower.startsWith(COL_DATA_TYPE.NUMERIC)) return 0;
  if (lower.startsWith(COL_DATA_TYPE.VARCHAR)) return '';
  if (lower.startsWith(COL_DATA_TYPE.DATETIME)) return null;
  return null; // safe fallback for any unrecognised type
}
