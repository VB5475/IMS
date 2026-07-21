// Division Master — admin module config (MRD_Template4DivisionMaster.docx)
//
// ⚠️ DBA CONFIRM items (carried over from the MRD as provisional, same convention
// used for Location Master — see src/pages/location-master/constants.js):
//   - SP_LIST name + its parameter shape
//   - LIST_DIVISION_ID (currently 15)

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const MODAL_TITLE_ADD = "New Division";
export const MODAL_TITLE_EDIT = "Edit Division";
export const MODAL_SUBTITLE  = "Admin › Master › Company › Division Master";

export const DV_CONFIG = {
  RB_MASTER: "rb_divisionmst",
  FORM_TAG:  "rb_divisionmst",
  TRAN_BOOK: "DivisionMst",

  SP_RB_META:     "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_divisionmst",

  /** Dropdown SPs — called directly (not via RB GetFilterDetail). */
  SP_COUNTRY:       "fn_tbl_countrymst_fatch",
  SP_STATE:         "fn_tbl_statemst_fatch",
  SP_CITY:          "fn_tbl_citymst_fatch",
  SP_YEAR:          "fn_tbl_yearmst_fetch",
  SP_DIVISION_TYPE: "fn_tbl_divisiontype_fetch",
  SP_HEAD_NAME:     "fn_tbl_genusermst_fetch",
  SP_OFFICE:        "fn_tbl_gen_officemaster_fetch",

  LIST_OBJ_TYPE:    2,
  SP_LIST:          "fn_tbl_divisionmst_list", // ⚠️ CONFIRM with DBA
  LIST_DIVISION_ID: 15,                        // ⚠️ CONFIRM with DBA

  DELETE_PROC_NAME: "pr_rb_divisionmst_delete",

  SAVE_ENDPOINT:       "/API/PurDivisionMst/Post_pr_RB_DivisionMST_Save",
  STORAGE_HEADER_META: "piHeaderMeta",
};

/**
 * Two-column form layout — lowercase PG colnames (matches RB GetDetailColData).
 * Rows not returned by the RB are silently dropped by resolveLayoutRows.
 *
 * panno/gstno (colseqno 14/15, ismandatory=1) exist live in the RB but were
 * missing from this layout — they never rendered, so their mandatory/maxlen
 * rules were never enforced (validateApiColumns only checks resolved layout
 * fields). Added 2026-07-21 per live RB payload.
 */
export const DV_FORM_LAYOUT = {
  main: {
    rows: [
      ["divisioncode", "divisionshortcode"],
      ["divisionname"],
      ["address"],
      ["openingyearid", "isdefault"],
      ["divisiontypeid", "headnameid"],
      ["officeid"],
      ["countryid", "stateid"],
      ["cityid", "zipcode"],
      ["phone1", "phone2"],
      ["fax", "arnoforgst"],
      ["panno", "gstno"],
      ["provisionalid"],
    ],
  },
  bank: {
    title: "Bank Information",
    rows: [
      ["bankname", "branch"],
      ["accountno", "ifsccode"],
      ["bankaddress"],
    ],
  },
};

/**
 * Cascade field clears — lowercase PG colnames.
 * Country change clears State + City; State change clears City only.
 * (The MRD's screen notes literally say "State change clears Country" — treated
 * as a copy-paste typo since no module in this codebase ever clears a parent
 * field from its child, and it would create an unusable cascade loop.)
 */
export const DV_CASCADE_RESETS = {
  countryid: ["stateid", "cityid"],
  stateid:   ["cityid"],
};

/** Cascade dropdown refresh — lowercase PG colnames. */
export const DV_CASCADE_DROPDOWN_REFRESH = {
  countryid: ["stateid"],
  stateid:   ["cityid"],
};

/** Which SP to call and which parent value to read when refreshing a child dropdown. */
export const DV_DROPDOWN_PARENT_BINDINGS = {
  stateid: { sp: "state", parentCol: "countryid" },
  cityid:  { sp: "city",  parentCol: "stateid" },
};
