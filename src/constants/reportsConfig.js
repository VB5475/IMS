// reportsConfig.js — the 7 sidebar "Reports" entries (2026-08-17 /pm verbal
// spec, no MRD). Each opens the SAME generic filter modal (From Date, To
// Date, Location, Dept + Print/Cancel) via <ReportFilterModal>, which calls
// the existing GENERATE_REPORT endpoint (src/hooks/useReportPrint.js) — no
// new backend API needed, this is the same mechanism PrintReportButton uses.
//
// ⚠️ CONFIRM with DBA — reportFileName (.rpt) is an unconfirmed placeholder
// for every entry below; none of these reports have an existing frontend
// consumer to source a real filename from (unlike most other modules' Print
// buttons, which reuse a name already proven against a live report SP).
export const REPORTS_LIST = [
  {
    key: "fixed-asset-register",
    label: "Fix Asset Register",
    reportTitle: "Fixed Asset Register",
    reportFileName: "RptFixedAssetSummItemMLNWise.rpt",
    // Confirmed 2026-08-18 (/tl, from RptFixedAssetSummItemMLNWise's own SP
    // param list) — this pair is proven ONLY for this report, not a generic
    // report-modal default. Don't copy these onto the other 6 entries below
    // without the same per-report confirmation.
    extraParams: [
      { paramtitle: "Is Division Checked", paramname: "@prmisselectivedivisionchecked", paramval: "1", paramtext: "Is Division Checked" },
      { paramtitle: "Module Code", paramname: "@prmmodulecode", paramval: "Account", paramtext: "Module Code" },
    ],
  },
  {
    key: "returnable-out-register",
    label: "Returnable Out Register",
    reportTitle: "Returnable Out Register",
    reportFileName: "ReturnableOutRegister.rpt",
  },
  {
    key: "returnable-in-register",
    label: "Returnable In Register",
    reportTitle: "Returnable In Register",
    reportFileName: "ReturnableInRegister.rpt",
  },
  {
    key: "indent-to-pv-tracking",
    label: "Indent To PV Tracking",
    reportTitle: "Indent To PV Tracking",
    reportFileName: "IndentToPVTracking.rpt",
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
  },
  {
    key: "asset-issue-location-wise",
    label: "Asset Issue Location Wise",
    reportTitle: "Asset Issue Location Wise",
    reportFileName: "AssetIssueLocationWise.rpt",
  },
  {
    key: "asset-issue-department-wise",
    label: "Asset Issue Department Wise",
    reportTitle: "Asset Issue Department Wise",
    reportFileName: "AssetIssueDepartmentWise.rpt",
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
