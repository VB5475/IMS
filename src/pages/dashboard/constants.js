// constants.js — Enterprise Dashboard page config
// All SP names, IDs, and request defaults used by this page in one place.

import { RB_CODES } from "../../constants/rbCodes";

export const DASHBOARD_CONFIG = {
  /** RB that defines report-board grid columns (GetDetailColData). */
  RB_DETAIL: RB_CODES.DASHBOARD_AST_STOCK_DETAIL,
  SP_RB_META: "fn_fetch_rbdetailbyrbcode",

  // SP / function name for the report board summary panel
  SP_REPORT_BOARDS: "Fn_tbl_FetchReportBoardSummaryUserWise",
  REPORT_OBJ_TYPE: 2,

  // Report board stock issue data
  SP_REPORT_DATA: "fn_tbl_fetch_adb_aststockissue",

  // Dashboard cart — available asset entry forms
  SP_AST_FORM_LIST: "fn_tbl_fetch_adb_astformlist",
  FORM_LIST_OBJ_TYPE: 2,

  // Request params
  LOGIN_ID: 1,
  DEFAULT_SUB_DESG_ID: 0,
  DEFAULT_MASTER_ID: 1,
  DEFAULT_SESSION_ID: 1,

  STORAGE_DETAIL_META: "dashboardAstStockDetailMeta",
};
