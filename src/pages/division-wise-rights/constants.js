// Division Wise User Rights — admin module config (MRD_Template4DivisionWiseRights.docx)

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const UDR_CONFIG = {
  RB_MASTER: RB_CODES.DIVISION_WISE_RIGHTS,
  ROUTE_PATH: rbRoutePath(RB_CODES.DIVISION_WISE_RIGHTS),
  RB_DETAIL: "rb_divisionwsright",
  FORM_TAG:  "rb_divisionwsright",
  TRAN_BOOK: "DivisionWsRight",

  /** MRD §5.1 — Transaction grid @PrmTranBook = 'T' */
  TRAN_BOOK_TRANSACTION: "T",
  /** MRD §5.1 — Report grid @PrmTranBook = 'R' */
  TRAN_BOOK_REPORT: "R",

  SP_RB_META:    "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_divisionwsright",
  /** Header User dropdown — admin user list (same as User Master list). */
  SP_USER_LIST: "fn_tbl_genusermst_list",
  /** MRD §5 API Reference — division list. */
  SP_DIVISIONS: "fn_tbl_fetchuserwsdivision",

  LIST_OBJ_TYPE:    2,
  SP_LIST:          "fn_tbl_divisionwsrightmst_list",
  LIST_DIVISION_ID: 15,

  SAVE_ENDPOINT:       "/API/PurDivisionWSRight/Post_RB_DivisionWsRight_Save",
  STORAGE_HEADER_META: "piHeaderMeta",

  /** MRD §2 — header panel: User dropdown only (lowercase PG colname). */
  HEADER_USER_COL: "userid",
  /** MRD §2/§3 — grid UI columns (lowercase PG colnames). */
  GRID_DIVISION_COL: "division",
  GRID_ALLOW_COL:    "allow",
  /** MRD §3 — saved in detail JSON but not shown in grid UI. */
  GRID_HIDDEN_COLS: ["tranbook", "userid", "divisionid"],
  /** Row fields from GET_DETAIL_COL_DATA (lowercase PG colnames). */
  GRID_ROW_COLS: ["idnumber", "division", "allow", "tranbook", "userid", "divisionid"],
  GRID_TITLE_TRANSACTION: "Transaction",
  GRID_TITLE_REPORT:      "Report",
};
