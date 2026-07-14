// constants.js — Enterprise Dashboard page config
// All SP names, IDs, and request defaults used by this page in one place.

export const DASHBOARD_CONFIG = {
  // SP / function name for the report board summary panel
  SP_REPORT_BOARDS: "Fn_tbl_FetchReportBoardSummaryUserWise",
  REPORT_OBJ_TYPE: 2,

  // Report board stock issue data
  SP_REPORT_DATA: "fn_tbl_fetch_adb_aststockissue",

  // Request params
  LOGIN_ID: 1,
  DEFAULT_SUB_DESG_ID: 0,
  DEFAULT_MASTER_ID: 1,
  DEFAULT_SESSION_ID: 1,
};
