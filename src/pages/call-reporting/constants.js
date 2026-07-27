// Maintenance Call Reporting — module config (MRD_Template4MntCallReporting.docx)

import { RB_CODES } from "../../constants/rbCodes";

export const MNT_REPORTING_CONFIG = {
  RB_MASTER: RB_CODES.CALL_REPORTING,
  RB_NEW_PARTS_DETAIL: "rb_mnt_clrptnwprtdtl",
  RB_OLD_PARTS_DETAIL: "rb_mnt_clrptolprtdtl",
  RB_NEW_PARTS_PICKER: "rb_mnt_clrptnwprtsel",
  RB_OLD_PARTS_PICKER: "rb_mnt_clrptolprtsel",

  FORM_TAG: "rb_mnt_clrpt",
  /** MRD lists MNTFLU (same as follow-up); use dedicated book code for reporting. */
  TRAN_BOOK: "MNTCLR",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_MASTER_FILL: "fn_tbl_rb_mnt_clrpt",
  SP_NEW_PARTS_FILL: "fn_tbl_rb_mnt_clrptnwprtdtl",
  SP_OLD_PARTS_FILL: "fn_tbl_rb_mnt_clrptolprtdtl",
  SP_NEW_PARTS_PICKER: "fn_tbl_rb_mnt_clrptnwprtsel",
  SP_OLD_PARTS_PICKER: "fn_tbl_rb_mnt_clrptolprtsel",
  SP_ALLOCATED_USER: "fn_gen_fetchallocateduser",

  VIEW_CALL_STATUS: "vw_callstatus",
  VIEW_BROKEN_CALL_REASON: "vw_brokencallreason",
  VIEW_PART_REPLACEMENT_REASON: "vw_partreplacementreason",

  LIST_OBJ_TYPE: 2,
  VIEW_OBJ_TYPE: 3,
  DEFAULT_MASTER_ID: 0,
  DEFAULT_SESSION_ID: 1,

  ALLOCATED_USER_COL: "allocatedtoid",
  REPORTING_STATUS_COL: "reportingstatusid",

  /** MRD §3 — editable header fields in the popup */
  EDITABLE_FIELDS: new Set([
    "reportingstatusid",
    "reasonforbrokencallid",
    "allocatedtoid",
    "partreplacementreasonid",
    "ispartreplacementreq",
    "remarks",
  ]),

  /** Status 1 → grids readonly; 2 or 3 → editable (MRD §3 cascade). */
  STATUS_GRIDS_READONLY: new Set(["1"]),
  STATUS_GRIDS_EDITABLE: new Set(["2", "3"]),

  SAVE_ENDPOINT: "/API/MntCallReporting/Post_RB_mnt_clrpt_Save",
  STORAGE_HEADER_META: "mntCallReportingHeaderMeta",
  STORAGE_NEW_PARTS_META: "mntCallReportingNewPartsMeta",
  STORAGE_OLD_PARTS_META: "mntCallReportingOldPartsMeta",
};

export const MNT_REPORTING_GRID_TABS = [
  { id: "new-parts", label: "Required Parts" },
  { id: "old-parts", label: "Old Parts" },
];

export const MODAL_TITLE = "Call Reporting";
export const MODAL_SUBTITLE = "Maintenance › Call Reporting";

export function isReportingGridsReadonly(statusId) {
  const key = String(statusId ?? "").trim();
  if (!key) return true;
  if (MNT_REPORTING_CONFIG.STATUS_GRIDS_EDITABLE.has(key)) return false;
  if (MNT_REPORTING_CONFIG.STATUS_GRIDS_READONLY.has(key)) return true;
  return true;
}

export function buildCallReportingPickerPayload(headerValues, filterContext = {}) {
  const session = headerValues || {};
  return {
    prmmasterid: Number(session.idnumber ?? session.IDNumber ?? session.masterid) || 0,
    prmdivisonid: Number(filterContext.divisionid ?? session.divisionid) || 0,
    prmcompanyid: Number(session.companyid ?? session.CompanyID) || 0,
    prmloginid: Number(session.loginid ?? session.LoginID) || 0,
    prmyearid: Number(session.yearid ?? session.YearID) || MNT_REPORTING_CONFIG.CONFIG_YEAR_ID,
  };
}
