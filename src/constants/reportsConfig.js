// reportsConfig.js — the sidebar "Reports" entries (2026-08-17 /pm verbal
// spec, no MRD). Each opens the SAME generic filter modal (From Date, To
// Date, Location, Dept + Print/Cancel) via <ReportFilterModal>, which calls
// the existing GENERATE_REPORT endpoint (src/hooks/useReportPrint.js) — no
// new backend API needed, this is the same mechanism PrintReportButton uses.
//
// 2026-08-24 (/pm) — each report builds its OWN full jsonparameters array via
// `buildParams(ctx)`, in that report's own confirmed SP parameter order.
// Deliberately NOT a shared "base params + per-report extras" merge anymore —
// that's what caused "Pending PO for GRN"'s own @prmoperationtypeid=0 to get
// silently clobbered by a same-named generic default. Some duplication across
// builders below is intentional/expected, not an oversight.
//
// ctx passed to every buildParams: { filters, session, divisionLabel }
//   filters        — ReportFilterModal's live filter state (fromDate/toDate/
//                     divisionId/locationId/deptId/employeeId, ISO date strings)
//   session         — getUserSession() result
//   divisionLabel   — display text for filters.divisionId, for paramtext
//
// ⚠️ CONFIRM with DBA — reportFileName (.rpt) is an unconfirmed placeholder
// for every entry below; none of these reports have an existing frontend
// consumer to source a real filename from (unlike most other modules' Print
// buttons, which reuse a name already proven against a live report SP).
import { buildCompanyReportParam, toReportDateParam } from "../utils/reportParams";

export const REPORTS_LIST = [
  {
    key: "fixed-asset-register",
    label: "Fix Asset Register",
    reportTitle: "Fixed Asset Register",
    reportFileName: "RptFixedAssetSummItemMLNWise.rpt",
    // Param NAMES confirmed 2026-08-18 (/tl, from RptFixedAssetSummItemMLNWise's
    // own SP param list) — but the exact POSITIONAL ORDER against the other
    // base params (dates/division/login/etc.) was never verified against the
    // SP signature, only that these two extra ones exist. Order below matches
    // this app's old shared-builder default; re-confirm against the real SP
    // signature before trusting it positionally.
    buildParams: ({ filters, session, divisionLabel }) => [
      { paramtitle: "From Date", paramname: "@prmfromdate", paramval: toReportDateParam(filters.fromDate), paramtext: filters.fromDate ? toReportDateParam(filters.fromDate) : "" },
      { paramtitle: "To Date", paramname: "@prmtodate", paramval: toReportDateParam(filters.toDate), paramtext: filters.toDate ? toReportDateParam(filters.toDate) : "" },
      { paramtitle: "Division", paramname: "@prmdivisionid", paramval: filters.divisionId || "0", paramtext: divisionLabel },
      { paramtitle: "Is Division Checked", paramname: "@prmisselectivedivisionchecked", paramval: "1", paramtext: "Is Division Checked" },
      { paramtitle: "Module Code", paramname: "@prmmodulecode", paramval: "Account", paramtext: "Module Code" },
      { paramtitle: "Login", paramname: "@prmloginid", paramval: String(session.loginId ?? "0"), paramtext: "" },
      { paramtitle: "Operation Type Id", paramname: "@prmoperationtypeid", paramval: "1", paramtext: "" },
      buildCompanyReportParam(),
    ],
  },
  {
    key: "returnable-out-register",
    label: "Returnable Out Register",
    reportTitle: "Returnable Out Register",
    reportFileName: "ReturnableOutRegister.rpt",
    // ⚠️ UNVERIFIED — no SP signature confirmed yet for this report. Order
    // below is this app's old shared-builder default, carried over as-is.
    buildParams: ({ filters, session, divisionLabel }) => [
      { paramtitle: "From Date", paramname: "@prmfromdate", paramval: toReportDateParam(filters.fromDate), paramtext: filters.fromDate ? toReportDateParam(filters.fromDate) : "" },
      { paramtitle: "To Date", paramname: "@prmtodate", paramval: toReportDateParam(filters.toDate), paramtext: filters.toDate ? toReportDateParam(filters.toDate) : "" },
      { paramtitle: "Division", paramname: "@prmdivisionid", paramval: filters.divisionId || "0", paramtext: divisionLabel },
      { paramtitle: "Login", paramname: "@prmloginid", paramval: String(session.loginId ?? "0"), paramtext: "" },
      { paramtitle: "Operation Type Id", paramname: "@prmoperationtypeid", paramval: "1", paramtext: "" },
      buildCompanyReportParam(),
    ],
  },
  {
    key: "returnable-in-register",
    label: "Returnable In Register",
    reportTitle: "Returnable In Register",
    reportFileName: "ReturnableInRegister.rpt",
    // ⚠️ UNVERIFIED — no SP signature confirmed yet for this report. Order
    // below is this app's old shared-builder default, carried over as-is.
    buildParams: ({ filters, session, divisionLabel }) => [
      { paramtitle: "From Date", paramname: "@prmfromdate", paramval: toReportDateParam(filters.fromDate), paramtext: filters.fromDate ? toReportDateParam(filters.fromDate) : "" },
      { paramtitle: "To Date", paramname: "@prmtodate", paramval: toReportDateParam(filters.toDate), paramtext: filters.toDate ? toReportDateParam(filters.toDate) : "" },
      { paramtitle: "Division", paramname: "@prmdivisionid", paramval: filters.divisionId || "0", paramtext: divisionLabel },
      { paramtitle: "Login", paramname: "@prmloginid", paramval: String(session.loginId ?? "0"), paramtext: "" },
      { paramtitle: "Operation Type Id", paramname: "@prmoperationtypeid", paramval: "1", paramtext: "" },
      buildCompanyReportParam(),
    ],
  },
  {
    key: "indent-to-pv-tracking",
    label: "Indent To PV Tracking",
    reportTitle: "Indent To PV Tracking",
    reportFileName: "IndentToPVTracking.rpt",
    // ⚠️ UNVERIFIED — no SP signature confirmed yet for this report. Order
    // below is this app's old shared-builder default, carried over as-is.
    buildParams: ({ filters, session, divisionLabel }) => [
      { paramtitle: "From Date", paramname: "@prmfromdate", paramval: toReportDateParam(filters.fromDate), paramtext: filters.fromDate ? toReportDateParam(filters.fromDate) : "" },
      { paramtitle: "To Date", paramname: "@prmtodate", paramval: toReportDateParam(filters.toDate), paramtext: filters.toDate ? toReportDateParam(filters.toDate) : "" },
      { paramtitle: "Division", paramname: "@prmdivisionid", paramval: filters.divisionId || "0", paramtext: divisionLabel },
      { paramtitle: "Login", paramname: "@prmloginid", paramval: String(session.loginId ?? "0"), paramtext: "" },
      { paramtitle: "Operation Type Id", paramname: "@prmoperationtypeid", paramval: "1", paramtext: "" },
      buildCompanyReportParam(),
    ],
  },
  {
    key: "asset-issue-employee-wise",
    label: "Asset Issue Employee Wise",
    reportTitle: "Asset Issue Employee Wise",
    reportFileName: "AssetIssueEmployeeWise.rpt",
    // 2026-08-17 (/pm) — extra Employee filter, this report only. Source API
    // "will be provided later" (user's own words) — SP_EMPLOYEE stays null
    // until then; ReportFilterModal renders the field disabled/empty in the
    // meantime rather than leaving it out, so no further UI work is needed
    // once the SP is confirmed — just fill in REPORTS_FILTER_CONFIG.SP_EMPLOYEE.
    extraFields: ["employee"],
    // ⚠️ UNVERIFIED — no SP signature confirmed yet for this report. Order
    // below is this app's old shared-builder default, carried over as-is.
    buildParams: ({ filters, session, divisionLabel }) => [
      { paramtitle: "From Date", paramname: "@prmfromdate", paramval: toReportDateParam(filters.fromDate), paramtext: filters.fromDate ? toReportDateParam(filters.fromDate) : "" },
      { paramtitle: "To Date", paramname: "@prmtodate", paramval: toReportDateParam(filters.toDate), paramtext: filters.toDate ? toReportDateParam(filters.toDate) : "" },
      { paramtitle: "Division", paramname: "@prmdivisionid", paramval: filters.divisionId || "0", paramtext: divisionLabel },
      { paramtitle: "Login", paramname: "@prmloginid", paramval: String(session.loginId ?? "0"), paramtext: "" },
      { paramtitle: "Operation Type Id", paramname: "@prmoperationtypeid", paramval: "1", paramtext: "" },
      buildCompanyReportParam(),
      { paramtitle: "Employee", paramname: "@prmEmployeeID", paramval: filters.employeeId || "0", paramtext: "" },
    ],
  },
  {
    key: "asset-issue-location-wise",
    label: "Asset Issue Location Wise",
    reportTitle: "Asset Issue Location Wise",
    reportFileName: "AssetIssueLocationWise.rpt",
    // ⚠️ UNVERIFIED — no SP signature confirmed yet for this report. Order
    // below is this app's old shared-builder default, carried over as-is.
    buildParams: ({ filters, session, divisionLabel }) => [
      { paramtitle: "From Date", paramname: "@prmfromdate", paramval: toReportDateParam(filters.fromDate), paramtext: filters.fromDate ? toReportDateParam(filters.fromDate) : "" },
      { paramtitle: "To Date", paramname: "@prmtodate", paramval: toReportDateParam(filters.toDate), paramtext: filters.toDate ? toReportDateParam(filters.toDate) : "" },
      { paramtitle: "Division", paramname: "@prmdivisionid", paramval: filters.divisionId || "0", paramtext: divisionLabel },
      { paramtitle: "Login", paramname: "@prmloginid", paramval: String(session.loginId ?? "0"), paramtext: "" },
      { paramtitle: "Operation Type Id", paramname: "@prmoperationtypeid", paramval: "1", paramtext: "" },
      buildCompanyReportParam(),
    ],
  },
  {
    key: "asset-issue-department-wise",
    label: "Asset Issue Department Wise",
    reportTitle: "Asset Issue Department Wise",
    reportFileName: "AssetIssueDepartmentWise.rpt",
    // ⚠️ UNVERIFIED — no SP signature confirmed yet for this report. Order
    // below is this app's old shared-builder default, carried over as-is.
    buildParams: ({ filters, session, divisionLabel }) => [
      { paramtitle: "From Date", paramname: "@prmfromdate", paramval: toReportDateParam(filters.fromDate), paramtext: filters.fromDate ? toReportDateParam(filters.fromDate) : "" },
      { paramtitle: "To Date", paramname: "@prmtodate", paramval: toReportDateParam(filters.toDate), paramtext: filters.toDate ? toReportDateParam(filters.toDate) : "" },
      { paramtitle: "Division", paramname: "@prmdivisionid", paramval: filters.divisionId || "0", paramtext: divisionLabel },
      { paramtitle: "Login", paramname: "@prmloginid", paramval: String(session.loginId ?? "0"), paramtext: "" },
      { paramtitle: "Operation Type Id", paramname: "@prmoperationtypeid", paramval: "1", paramtext: "" },
      buildCompanyReportParam(),
    ],
  },
  {
    key: "pending-po-for-grn",
    label: "Pending PO for GRN",
    reportTitle: "Pending PO for GRN",
    reportFileName: "Rpt_Pur_POTrackingwrtSupplierWiseGRN.rpt",
    // 2026-08-24 (/pm) — param order matches fn_rpt_pur_potrackingwrtgrn's own
    // signature exactly, per the user-supplied SP screenshot: prmcompanyid,
    // prmdivisionid, prmyearid, prmfromdate, prmtodate, prmpotypeid,
    // prmsupplierid, prmisshowallrequired, prmisitemselected, prmloginid,
    // prmoperationtypeid, prmitemtypeid, prmmaingroupid, prmsubmaingroupid.
    buildParams: ({ filters, session, divisionLabel }) => [
      buildCompanyReportParam(),
      { paramtitle: "Division", paramname: "@prmdivisionid", paramval: filters.divisionId || "0", paramtext: divisionLabel },
      { paramtitle: "Year", paramname: "@prmyearid", paramval: String(session.yearId ?? "0"), paramtext: "" },
      { paramtitle: "From Date", paramname: "@prmfromdate", paramval: toReportDateParam(filters.fromDate), paramtext: filters.fromDate ? toReportDateParam(filters.fromDate) : "" },
      { paramtitle: "To Date", paramname: "@prmtodate", paramval: toReportDateParam(filters.toDate), paramtext: filters.toDate ? toReportDateParam(filters.toDate) : "" },
      { paramtitle: "PO Type", paramname: "@prmpotypeid", paramval: "0", paramtext: "PO Type" },
      { paramtitle: "Supplier", paramname: "@prmsupplierid", paramval: "0", paramtext: "Supplier" },
      { paramtitle: "Is Show All Required", paramname: "@prmisshowallrequired", paramval: "1", paramtext: "Is Show All Required" },
      { paramtitle: "Is Item Selected", paramname: "@prmisitemselected", paramval: "1", paramtext: "Is Item Selected" },
      { paramtitle: "Login", paramname: "@prmloginid", paramval: String(session.loginId ?? "0"), paramtext: "" },
      { paramtitle: "Operation Type", paramname: "@prmoperationtypeid", paramval: "0", paramtext: "Operation Type" },
      { paramtitle: "Item Type", paramname: "@prmitemtypeid", paramval: "0", paramtext: "Item Type" },
      { paramtitle: "Main Group", paramname: "@prmmaingroupid", paramval: "0", paramtext: "Main Group" },
      { paramtitle: "Sub Main Group", paramname: "@prmsubmaingroupid", paramval: "0", paramtext: "Sub Main Group" },
    ],
  },
  {
    key: "pending-grn-for-pv",
    label: "Pending GRN for PV",
    reportTitle: "Pending GRN for PV",
    reportFileName: "rpt_pur_inwardregregisterpendingforpv.rpt",
    // 2026-08-24 (/pm) — param order matches fn_rpt_inwardregsupplierpending...'s
    // own signature exactly, per the user-supplied SP screenshot: prmfromdate,
    // prmtodate, prmselectitem, prmuserid, prmcompanyid. No division param on
    // this SP at all — Division field in the modal is simply unused for this
    // report even though it's shown (shared modal, no per-report field hiding).
    buildParams: ({ filters, session }) => [
      { paramtitle: "From Date", paramname: "@prmfromdate", paramval: toReportDateParam(filters.fromDate), paramtext: filters.fromDate ? toReportDateParam(filters.fromDate) : "" },
      { paramtitle: "To Date", paramname: "@prmtodate", paramval: toReportDateParam(filters.toDate), paramtext: filters.toDate ? toReportDateParam(filters.toDate) : "" },
      { paramtitle: "Select Item", paramname: "@prmselectitem", paramval: "1", paramtext: "Select Item" },
      { paramtitle: "User", paramname: "@prmuserid", paramval: String(session.loginId ?? "0"), paramtext: "" },
      buildCompanyReportParam(),
    ],
  },
];

// ⚠️ CONFIRM with DBA — Location/Department reused as-is from Maintenance
// Dashboard (src/pages/maintenance-dashboard/constants.js), the closest
// existing Location+Department dropdown pair already proven live for an
// Asset-module filter panel. prmfrmtype "MNT" there scopes to Maintenance;
// using "AST" here as the Assets-scoped equivalent is an inferred guess,
// not confirmed. Division is the same fn_tbl_fetchuserwsdivision every
// other module's own Division dropdown already uses (Purchase Order,
// Maintenance Dashboard, etc.) — a real, proven SP, not a guess.
//
// 2026-08-17 (/pm) — Location genuinely needs a real user-picked Division
// id (live-verified: prmdivisionid 0/15/any-fixed-value all returned zero
// rows until a real division the login actually has data under is picked;
// there is no working "all divisions" wildcard for this SP). Location now
// cascades off a real Division dropdown instead of a hardcoded guess —
// same Country→State cascade UX already used by City Master.
export const REPORTS_FILTER_CONFIG = {
  SP_DIVISION: "fn_tbl_fetchuserwsdivision",
  SP_LOCATION: "fn_gen_fetchastisslocationmaster",
  SP_DEPARTMENT: "fn_gen_fetchdepartmentmaster",
  LOCATION_FRM_TYPE: "AST",
  // ⚠️ CONFIRM with DBA — SP name/shape not yet provided (user: "API will
  // be provided later"). Employee field renders disabled until this is set.
  SP_EMPLOYEE: null,
};
