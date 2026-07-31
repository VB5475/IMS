// Field definitions are driven dynamically from GetDetailColData via useLocationMaster hook.
// No hardcoded field array needed here.
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const MODAL_TITLE_ADD = "New Location";
export const MODAL_TITLE_EDIT = "Edit Location";
export const MODAL_SUBTITLE  = "Admin › Company › Location Master";


export const LM_CONFIG = {
  RB_MASTER:           RB_CODES.LOCATION_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.LOCATION_MASTER),
  SP_RB_META:          "fn_fetch_rbdetailbyrbcode",
  SP_LOCATION_TYPE:    "fn_tbl_fetch_locationtype",
  SP_PREMISES:         "fn_tbl_fetch_premises",
  // Division dropdown — live RB confirms `divisionid` (colseqno 1, mandatory)
  // already has ctrlsqlsource="fn_tbl_tbd_division", but GetFilterDetail (the
  // generic RB dropdown resolver) throws live for this column — same
  // "explicit fn_tbl_* fetch instead of the generic resolver" pattern used
  // for LocationType/Premises below. Signature: fn_tbl_tbd_division(@prmFuncCode
  // varchar(50), @prmDivisionID numeric(18,0), @prmLoginID numeric(18,0)).
  SP_DIVISION:         "fn_tbl_tbd_division",
  // Parent Location — cascades off Location Type. Live RB's own
  // ctrlsqlsource is "fn_tbl_fetch_locationtypebasedlocation(24)" (extra "d"
  // in "based") — confirmed live 2026-07-29 that spelling doesn't exist
  // ("Must declare the scalar variable"); the correct, working name is the
  // one below (matches what the user supplied directly, not the RB's own
  // typo'd metadata). The literal "(24)" in ctrlsqlsource is just a sample
  // invocation baked into the RB config (24 = "WorkStation" location type),
  // not a fixed param — confirmed genuinely cascading (ids 1/23 -> [],
  // 24/25 -> distinct real floor lists) so callers must pass the selected
  // Location Type's id, not a hardcoded 24.
  SP_PARENT_LOCATION:  "fn_tbl_fetch_locationtypebaselocation",
  SP_MASTER_FILL:      "fn_tbl_rb_genlocationmst",
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "fn_tbl_gen_locationmst_list", // ⚠️ CONFIRM with DBA
  LIST_DIVISION_ID:    15,             // ⚠️ CONFIRM with DBA
  DELETE_PROC_NAME:    "pr_rb_genlocationmst_delete",
  SAVE_ENDPOINT:       "/API/Gen_LocationMst/Post_RB_GenLocationMst_Save",
  STORAGE_HEADER_META: "piHeaderMeta",
};
