import { getUserSession } from "../session/userSession";

/** "A" add, "E" edit — "D" delete reserved for later configuration. */
export function getSaveMode(isEdit) {
  return isEdit ? "E" : "A";
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
