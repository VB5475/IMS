// constants.js — Workflow Dashboard (WKF) page config
// Source of truth: MRD_Template4WorkFlowDashBoard.docx (Richa, 08-Aug-2026).
// Read-only multi-level approval dashboard — no header RB (Section 2 of the
// MRD explicitly calls the header controls "Fix control without any rb
// references"), grid columns driven by rb_wkfdashboard.
//
// ⚠️ DBA-PENDING — several constants below were left blank ("-") or marked
// uncertain in the MRD's own Section 7 table. Scaffolded with best-effort
// values/placeholders per explicit instruction (2026-08-11 /pm) rather than
// blocking on a completed MRD — confirm each with the backend/DBA before
// this module goes live:
//   - RB_MASTER: MRD leaves this blank — consistent with "no header RB", not
//     necessarily a gap, but worth a DBA sanity check.
//   - FORM_TAG, SAVE_ENDPOINT, SP_LIST, LIST_DIVISION_ID, SUPPLIER_PARTY_TYPE:
//     never filled in. FORM_TAG guessed as "WKF" (matches TRAN_BOOK, the one
//     value the MRD DID confirm). SAVE_ENDPOINT is N/A — this module has no
//     save flow (MRD Section 5.1: "RB Save API: -").
//   - pr_WKF_Get_Dashboard_List_COM_APP takes 14 params, but the MRD's own
//     Header Fields table (Section 3) only defines 6 UI controls. The mapping
//     below (prmDiv/prmFromDate/prmToDate/prmRefNo/prmTranType4Disp/prmIniname)
//     is a best-effort guess from field-name similarity, NOT confirmed by the
//     MRD. prmComp/prmDept/prmDocType/prmFrom have no corresponding UI field
//     at all — sent as empty string until DBA/MRD clarifies their source.

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import { OBJ_TYPE } from "../../api/constants";

export const WKF_DASHBOARD_CONFIG = {
  RB_DETAIL: RB_CODES.WORKFLOW_DASHBOARD, // rb_wkfdashboard — grid column metadata, MRD-confirmed
  ROUTE_PATH: rbRoutePath(RB_CODES.WORKFLOW_DASHBOARD),

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  // Casing matches Maintenance Dashboard's confirmed-working call (this
  // module's MRD spells it "Fn_tbl_FetchUserWsDivision" — same function).
  SP_DIVISION: "fn_tbl_fetchuserwsdivision",
  // ⚠️ DBA-pending — exact param shapes unconfirmed beyond what the MRD listed.
  SP_TRANSACTION_NAME: "Fn_tbl_fetch_transactionlist4wkfdashboard",
  SP_INITIATE_BY: "fn_tbl_fetch_dopuser4wkfdashboard",
  SP_DATA: "pr_WKF_Get_Dashboard_List_COM_APP",
  DATA_OBJ_TYPE: OBJ_TYPE.PROCEDURE,

  FORM_TAG: "WKF", // ⚠️ DBA-pending — not in MRD, guessed from TRAN_BOOK
  TRAN_BOOK: "WKF", // MRD-confirmed (Section 7)
  CONFIG_YEAR_ID: 2, // ⚠️ MRD marks this CONFIRM
  DIVISION_YEAR_ID: 2, // ⚠️ MRD marks this CONFIRM
};

/** Status buttons — prmStatus/prmDecisionStatus pairs per MRD Section 3's
 *  cascade note. All three (plus Search) clear existing grid data and reload. */
export const WKF_STATUS_FILTERS = {
  PENDING: { label: "Pending", prmStatus: "P", prmDecisionStatus: "" },
  INPROCESS: { label: "In Process", prmStatus: "M", prmDecisionStatus: "" },
  APPROVED: { label: "Approved", prmStatus: "A", prmDecisionStatus: "P" },
};

export const WKF_DEFAULT_STATUS = "PENDING";
