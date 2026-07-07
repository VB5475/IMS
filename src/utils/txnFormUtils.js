// txnFormUtils.js — Shared helpers for transaction entry forms (Purchase/Assets/CWIP)
// ─────────────────────────────────────────────────────────────────────
// Extracted from near-identical copies previously duplicated in every
// *Form.jsx under src/pages/. Keep this file free of per-module business
// logic (RB codes, SP names, header field shapes) — those stay in each
// module's own constants.js and are passed in as parameters.

import { DEFAULT_COMPANY_ID, DEFAULT_SESSION_ID } from "../api/constants";
import { getUserSession } from "../session/userSession";

/** Editable/focusable fields currently rendered inside a filter panel DOM node. */
export function queryEditableFilterFields(panel) {
  if (!panel) return [];
  return [
    ...panel.querySelectorAll(
      "input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), .search-select__trigger:not([disabled])"
    ),
  ].filter((el) => el.offsetParent !== null);
}

/**
 * Resolves the {companyId, yearId, loginId, sessionId, idNumber} params needed to
 * load an existing record for edit. `idFields` is an ordered list of the
 * module-specific master-ID column names (camel + Pascal case as returned by
 * the list API) to check on `listRecord` before falling back to the generic
 * `idnumber`/`IDNumber`/`recordId`.
 */
export function resolveEditLoadParams(recordId, listRecord, { idFields = [], configYearId } = {}) {
  const session = getUserSession();
  const idNumber = idFields.reduce(
    (found, key) => (found != null ? found : listRecord?.[key]),
    null
  ) ?? listRecord?.idnumber ?? listRecord?.IDNumber ?? recordId;

  return {
    companyId: listRecord?.companyid ?? listRecord?.CompanyID ?? session.companyId ?? DEFAULT_COMPANY_ID,
    yearId: listRecord?.yearid ?? listRecord?.YearID ?? session.yearId ?? configYearId,
    loginId: listRecord?.loginid ?? listRecord?.LoginID ?? session.loginId,
    sessionId: listRecord?.sessionid ?? listRecord?.SessionID ?? listRecord?.SessionId ?? DEFAULT_SESSION_ID,
    idNumber,
  };
}
