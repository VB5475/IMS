import { getUserSession } from "../session/userSession";

/** "A" add, "E" edit — "D" delete reserved for later configuration. */
export function getSaveMode(isEdit) {
  return isEdit ? "E" : "A";
}

/**
 * Collapse same-name keys that differ only by case (e.g. "IDNumber" vs "idnumber")
 * to a single lowercase-preferring entry. Save SPs read lowercase (PG column
 * casing) — a stray PascalCase duplicate from upstream header-value spreading
 * must not reach the wire.
 */
function dedupeRowCaseKeys(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row;
  const groups = new Map();
  for (const [key, value] of Object.entries(row)) {
    const lower = key.toLowerCase();
    const existing = groups.get(lower);
    if (!existing || (key === lower && existing.key !== lower)) {
      groups.set(lower, { key, value });
    }
  }
  const result = {};
  groups.forEach(({ key, value }) => {
    result[key] = value;
  });
  return result;
}

function dedupeRowsCaseKeys(rows) {
  if (Array.isArray(rows)) return rows.map(dedupeRowCaseKeys);
  return dedupeRowCaseKeys(rows);
}

/** Default Inquiry terms key — MRD spelling (incl. "Conditiont") confirmed against SP. */
const DEFAULT_TERMS_DET_KEY = "prmPurTermsNConditiontDetJson";

/**
 * Build prmStr*JSON fields from raw row arrays and log the full body before stringify.
 * @param {{ label?: string, mst?: object|object[], det?: object[], indtDet?: object[], supplierDet?: object[], termsDet?: object[], termsDetKey?: string, extra?: object }} parts
 * @returns {object} payload fragment with stringified JSON fields
 */
export function buildSaveJsonFields({
  label = "Save",
  mst,
  det,
  indtDet,
  supplierDet,
  termsDet,
  termsDetKey = DEFAULT_TERMS_DET_KEY,
  extra = {},
} = {}) {
  const rawBody = { ...extra };

  if (mst !== undefined) {
    rawBody.prmStrMstJSON = dedupeRowsCaseKeys(Array.isArray(mst) ? mst : [mst]);
  }
  if (det !== undefined) {
    rawBody.prmStrDetJSON = dedupeRowsCaseKeys(det);
  }
  if (indtDet !== undefined) {
    rawBody.prmStrIndtDetJSON = dedupeRowsCaseKeys(indtDet);
  }
  // MRD-specified keys for Post_RB_PurInquiryMst_Save — verbatim casing (incl.
  // "TermsNConditiontDet"), confirmed against the SP signature, not a typo fix.
  // Purchase Rate Contract uses prmTermsNCondDetJSon via termsDetKey override.
  if (supplierDet !== undefined) {
    rawBody.prmPurSupplierDetJson = dedupeRowsCaseKeys(supplierDet);
  }
  if (termsDet !== undefined) {
    rawBody[termsDetKey] = dedupeRowsCaseKeys(termsDet);
  }

  console.log(
    `%c[${label}] Request body (before stringify):`,
    "color:#f59e0b;font-weight:700",
    rawBody
  );

  const payload = { ...extra };
  if (rawBody.prmStrMstJSON) {
    payload.prmStrMstJSON = JSON.stringify(rawBody.prmStrMstJSON);
  }
  if (rawBody.prmStrDetJSON) {
    payload.prmStrDetJSON = JSON.stringify(rawBody.prmStrDetJSON);
  }
  if (rawBody.prmStrIndtDetJSON) {
    payload.prmStrIndtDetJSON = JSON.stringify(rawBody.prmStrIndtDetJSON);
  }
  if (rawBody.prmPurSupplierDetJson) {
    payload.prmPurSupplierDetJson = JSON.stringify(rawBody.prmPurSupplierDetJson);
  }
  if (rawBody[termsDetKey]) {
    payload[termsDetKey] = JSON.stringify(rawBody[termsDetKey]);
  }

  return payload;
}

/**
 * Merge standard save context fields into a save API request body.
 * @param {object} basePayload  prmStrMstJSON / prmStrDetJSON / etc.
 * @param {{ divisionId?: number|string, isEdit?: boolean }} [options]
 */
export function withSaveContextFields(basePayload, { divisionId = 0, isEdit = false } = {}) {
  const session = getUserSession();

  return {
    ...basePayload,
    prmYearID: session.yearId,
    prmLoginID: session.loginId,
    prmDivisionID: Number(divisionId) || 0,
    prmMode: getSaveMode(isEdit),
    prmIPAddress: "",
    prmOtherInfo: "",
  };
}
