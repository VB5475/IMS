// Field definitions are driven dynamically from GetDetailColData via useLocationMaster hook.
// No hardcoded field array needed here.
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const MODAL_TITLE_ADD = "New Location";
export const MODAL_TITLE_EDIT = "Edit Location";
export const MODAL_SUBTITLE  = "Admin › Company › Location Master";


export const LM_CONFIG = {
  RB_MASTER:           "rb_genlocationmst",
  CONFIG_YEAR_ID:      2,              // ⚠️ CONFIRM with DBA
  SP_RB_META:          "fn_fetch_rbdetailbyrbcode",
  SP_LOCATION_TYPE:    "fn_tbl_fetch_locationtype",
  SP_PREMISES:         "fn_tbl_fetch_premises",
  SP_MASTER_FILL:      "fn_tbl_rb_genlocationmst",
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "fn_tbl_gen_locationmst_list", // ⚠️ CONFIRM with DBA
  LIST_DIVISION_ID:    15,             // ⚠️ CONFIRM with DBA
  SAVE_ENDPOINT:       "/API/Gen_LocationMst/Post_RB_GenLocationMst_Save",
  STORAGE_HEADER_META: "piHeaderMeta",
};
