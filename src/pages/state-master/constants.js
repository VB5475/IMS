// Field definitions driven dynamically from GetDetailColData via useStateMaster hook.
// MRD_Template4StateMaster.docx (Aditya, 17-Jun-2026) — Country + State Type are
// both static (non-cascading) dropdowns, unlike City Master's Country->State
// cascade. NOTE: the MRD's own "Module Overview" section, screen-notes prose,
// and Field ID column ("citycode"/"cityname") are stale copy-paste leftovers
// from City Master's MRD (even the header still literally says "Module Name:
// City Master") — the embedded screenshot + Section 3 field ROWS are the real
// spec (Code/Name/Reg Name/State Type/Tin No); live RB colnames win regardless
// since fields are resolved dynamically, same pattern as Country/City Master.
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const MODAL_TITLE_ADD = "New State";
export const MODAL_TITLE_EDIT = "Edit State";
export const MODAL_SUBTITLE  = "Admin › Master › Item › State Master";


export const STM_CONFIG = {
  RB_MASTER:           RB_CODES.STATE_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.STATE_MASTER),
  SP_RB_META:          "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL:      "fn_tbl_rb_statemst",
  SP_COUNTRY:           "fn_tbl_countrymst_fatch",           // → {idnumber, countryname}
  SP_STATE_TYPE:        "fn_tbl_fetch_rb_statemst_statetype", // → zero params, CONFIRM return shape with DBA
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "fn_tbl_rb_statemst_list",
  LIST_DIVISION_ID:    15,             // ⚠️ CONFIRM with DBA
  DELETE_PROC_NAME:    "pr_rb_statemst_delete", // ⚠️ CONFIRM with DBA — MRD didn't list a delete SP; following Sub/Main Group Master's pr_rb_<rb>_delete naming
  SAVE_ENDPOINT:       "/API/StateMst/Post_RB_StateMst_Save",
  STORAGE_HEADER_META: "stmHeaderMeta",
};
