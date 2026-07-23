// Maintenance Call Follow Up — module config (MRD_Template4MntCallFollowUp.docx)

import { RB_CODES } from "../../constants/rbCodes";

export const MNT_FOLLOWUP_CONFIG = {
  RB_MASTER: RB_CODES.CALL_FOLLOW_UP,
  FORM_TAG: "rb_mntfollowup",
  TRAN_BOOK: "MNTFLU",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  /** Popup fill — FN_Fetch_Data ObjType 2 (MRD §5) */
  SP_MASTER_FILL: "fn_tbl_rb_mntfollowup",

  LIST_OBJ_TYPE: 2,
  DEFAULT_MASTER_ID: 0,
  DEFAULT_SESSION_ID: 1,

  /** MRD §3 — only these header fields are editable in the popup */
  EDITABLE_FIELDS: new Set(["remarks", "expdate"]),

  SAVE_ENDPOINT: "/API/MntFollowUp/Post_RB_MntFollowUp_Save",
  STORAGE_HEADER_META: "mntCallFollowUpHeaderMeta",
};

export const MODAL_TITLE = "Vendor Follow Up";
export const MODAL_SUBTITLE = "Maintenance › Call Follow Up";
