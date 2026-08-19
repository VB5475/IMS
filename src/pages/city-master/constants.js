// Field definitions driven dynamically from GetDetailColData via useCityMaster hook.
// MRD_Template4CityMaster.docx (Aditya, 17-Jun-2026) — Country -> State cascade
// (Country change clears State + City, refilters State by the new country),
// same SP names already proven live in Supplier/Division Master's own
// Country/State/City dropdowns (fn_tbl_countrymst_fatch / fn_tbl_statemst_fatch).
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const MODAL_TITLE_ADD = "New City";
export const MODAL_TITLE_EDIT = "Edit City";
export const MODAL_SUBTITLE  = "Admin › Master › Item › City Master";


export const CIM_CONFIG = {
  RB_MASTER:           RB_CODES.CITY_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.CITY_MASTER),
  SP_RB_META:          "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL:      "fn_tbl_rb_citymst",
  SP_COUNTRY:           "fn_tbl_countrymst_fatch",   // → {idnumber, countryname}
  SP_STATE:             "fn_tbl_statemst_fatch",     // → {stateid, statename}, param prmcountryid
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "fn_tbl_rb_citymst_list",
  LIST_DIVISION_ID:    15,             // ⚠️ CONFIRM with DBA
  DELETE_PROC_NAME:    "pr_rb_citymst_delete", // ⚠️ CONFIRM with DBA — MRD didn't list a delete SP; following Sub/Main Group Master's pr_rb_<rb>_delete naming
  SAVE_ENDPOINT:       "/API/CityMst/Post_RB_CityMst_Save",
  STORAGE_HEADER_META: "cimHeaderMeta",
};
