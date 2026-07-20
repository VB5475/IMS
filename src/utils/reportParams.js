// reportParams.js — Shared report-parameter builders for PrintReportButton callers.
// Every list-page report so far scopes by Company, so that one param is built
// here once instead of being duplicated per page.

import { getUserSession } from "../session/userSession";

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
