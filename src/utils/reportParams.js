// reportParams.js — Shared report-parameter builders for PrintReportButton callers.
// Every list-page report so far scopes by Company, so that one param is built
// here once instead of being duplicated per page.

import { getUserSession } from "../session/userSession";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Native <input type="date"> gives back "YYYY-MM-DD" — convert to this app's
// standard report/list param format ("DD-MMM-YYYY", e.g. PurchaseOrderPage's
// `01-Jan-${year}`) rather than the ISO string.
export function toReportDateParam(isoValue) {
  if (!isoValue) return "";
  const [y, m, d] = isoValue.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${String(d).padStart(2, "0")}-${MONTH_ABBR[m - 1]}-${y}`;
}

/** Standard "Company" report parameter — id + display name pulled from session, not hardcoded. */
export function buildCompanyReportParam() {
  const session = getUserSession();
  const companyName = session.company?.companyname ?? session.company?.CompanyName ?? "";
  return {
    paramtitle: "Company",
    paramname: "@prmcompanyid",
    paramval: String(session.companyId),
    paramtext: companyName,
  };
}
