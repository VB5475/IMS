// Division Wise User Rights — admin module config (MRD_Template4DivisionWiseRights.docx)

export const UDR_CONFIG = {
  RB_MASTER: "RB_DivisionWsRight",
  RB_DETAIL: "RB_DivisionWsRight",
  FORM_TAG: "RB_DivisionWsRight",
  TRAN_BOOK: "DivisionWsRight",

  /** MRD §5.1 — Transaction grid @PrmTranBook = 'T' */
  TRAN_BOOK_TRANSACTION: "T",
  /** MRD §5.1 — Report grid @PrmTranBook = 'R' */
  TRAN_BOOK_REPORT: "R",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_MASTER_FILL: "fn_tbl_RB_DivisionWsRight",
  /** Header User dropdown — admin user list (same as User Master list). */
  SP_USER_LIST: "Fn_tbl_GenUserMst_List",
  /** MRD §5 API Reference — division list (prmYearID, prmLoginID). */
  SP_DIVISIONS: "Fn_tbl_FetchUserWsDivision",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "Fn_tbl_DivisionWsRightMst_List",
  LIST_DIVISION_ID: 15,

  SAVE_ENDPOINT: "/API/PurDivisionWSRight/Post_RB_DivisionWsRight_Save",
  STORAGE_HEADER_META: "piHeaderMeta",

  /** MRD §2 — header panel: User dropdown only */
  HEADER_USER_COL: "UserID",
  /** MRD §2/§3 — grid UI columns */
  GRID_DIVISION_COL: "Division",
  GRID_ALLOW_COL: "Allow",
  /** MRD §3 — saved in detail JSON but not shown in grid UI */
  GRID_HIDDEN_COLS: ["TranBook", "UserID", "DivisionID"],
  /** Row fields from GET_DETAIL_COL_DATA (ColSeqNo < 100 for this RB). */
  GRID_ROW_COLS: ["IDNumber", "Division", "Allow", "TranBook", "UserID", "DivisionID"],
  GRID_TITLE_TRANSACTION: "Transaction",
  GRID_TITLE_REPORT: "Report",
};
