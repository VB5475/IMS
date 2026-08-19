// Field definitions driven dynamically from GetDetailColData via useCountryMaster hook.
// MRD_Template4CountryMaster.docx (Aditya, 17-Jun-2026) — flat 3-field master,
// no dropdowns/cascades, same shape as Sub Group Master.
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const MODAL_TITLE_ADD = "New Country";
export const MODAL_TITLE_EDIT = "Edit Country";
export const MODAL_SUBTITLE  = "Admin › Master › Item › Country Master";


export const CTM_CONFIG = {
  RB_MASTER:           RB_CODES.COUNTRY_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.COUNTRY_MASTER),
  SP_RB_META:          "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL:      "fn_tbl_rb_countrymst",
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "fn_tbl_rb_countrymst_list",
  LIST_DIVISION_ID:    15,             // ⚠️ CONFIRM with DBA
  DELETE_PROC_NAME:    "pr_rb_countrymst_delete", // ⚠️ CONFIRM with DBA — MRD didn't list a delete SP; following Sub/Main Group Master's pr_rb_<rb>_delete naming
  SAVE_ENDPOINT:       "/API/CountryMst/Post_RB_CountryMst_Save",
  STORAGE_HEADER_META: "ctmHeaderMeta",
};
