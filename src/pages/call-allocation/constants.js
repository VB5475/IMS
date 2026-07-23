// Maintenance Call Allocation — module config (MRD_Template4MntCallAllocation.docx)

import { RB_CODES } from "../../constants/rbCodes";

export const MNT_CALL_CONFIG = {
  RB_MASTER: RB_CODES.CALL_ALLOCATION,
  FORM_TAG: "rb_mntallocation",
  TRAN_BOOK: "MNTALN",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  /** Popup fill — FN_Fetch_Data ObjType 2 (MRD §5) */
  SP_MASTER_FILL: "fn_tbl_rb_mntallocation",
  SP_ALLOCATED_USER: "fn_gen_fetchallocateduser",

  LIST_OBJ_TYPE: 2,
  DEFAULT_MASTER_ID: 0,
  DEFAULT_SESSION_ID: 1,

  ALLOCATED_USER_COL: "allocateduserid",

  SAVE_ENDPOINT: "/API/MntAllocation/Post_RB_MntAllocation_Save",
  STORAGE_HEADER_META: "mntCallAllocationHeaderMeta",
};

export const MODAL_TITLE = "Call Allocation";
export const MODAL_SUBTITLE = "Maintenance › Call Allocation";
