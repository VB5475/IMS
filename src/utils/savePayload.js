import { getUserSession } from "../session/userSession";

/** "A" add, "E" edit — "D" delete reserved for later configuration. */
export function getSaveMode(isEdit) {
  return isEdit ? "E" : "A";
}

/**
 * Build prmStr*JSON fields from raw row arrays and log the full body before stringify.
 * @param {{ label?: string, mst?: object|object[], det?: object[], indtDet?: object[], supplierDet?: object[], termsDet?: object[], extra?: object }} parts
 * @returns {object} payload fragment with stringified JSON fields
 */
export function buildSaveJsonFields({
  label = "Save",
  mst,
  det,
  indtDet,
  supplierDet,
  termsDet,
  extra = {},
} = {}) {
  const rawBody = { ...extra };

  if (mst !== undefined) {
    rawBody.prmStrMstJSON = Array.isArray(mst) ? mst : [mst];
  }
  if (det !== undefined) {
    rawBody.prmStrDetJSON = det;
  }
  if (indtDet !== undefined) {
    rawBody.prmStrIndtDetJSON = indtDet;
  }
  // MRD-specified keys for Post_RB_PurInquiryMst_Save — verbatim casing (incl.
  // "TermsNConditiontDet"), confirmed against the SP signature, not a typo fix.
  if (supplierDet !== undefined) {
    rawBody.prmPurSupplierDetJson = supplierDet;
  }
  if (termsDet !== undefined) {
    rawBody.prmPurTermsNConditiontDetJson = termsDet;
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
  if (rawBody.prmPurTermsNConditiontDetJson) {
    payload.prmPurTermsNConditiontDetJson = JSON.stringify(rawBody.prmPurTermsNConditiontDetJson);
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
