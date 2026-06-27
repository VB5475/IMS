// Shared item-picker helpers for purchase entry forms.

import { formatTranDate } from "./dateFormat";

/** True when a required item-picker header field value is missing or invalid. */
export function isMissingItemPickerFieldValue(field, value) {
  if (field.isDate) {
    return value == null || value === "" || formatTranDate(value) === "0";
  }
  if (value == null || value === "") return true;
  if (field.allowZero) return false;
  return Number(value) === 0 || value === "0";
}

/**
 * Returns display labels of header fields that must be filled before Select Item.
 * @param {object} headerValues
 * @param {object[]} fields — module-specific picker field defs
 * @param {{ basedOnKey?: string }} [opts]
 */
export function getMissingItemPickerHeaderFields(headerValues, fields, opts = {}) {
  const { basedOnKey = "basedonid" } = opts;
  const basedOn = Number(headerValues?.[basedOnKey]) || 0;
  const missing = [];

  fields.forEach((field) => {
    if (field.requiredWhenBasedOn != null && basedOn !== field.requiredWhenBasedOn) return;
    if (isMissingItemPickerFieldValue(field, headerValues?.[field.headerKey])) {
      missing.push(field.label);
    }
  });

  return missing;
}

/**
 * Standard FN_FETCH_DATA JSON payload for purchase item picker SPs.
 */
export function buildItemPickerJsonPayload(headerValues, loginId, { configYearId, tranBook }) {
  return {
    prmDivisionID: Number(headerValues.divisionid ?? headerValues.DivisionID),
    prmYearID: configYearId,
    prmLoginID: loginId,
    prmTranDate: formatTranDate(headerValues.trandate ?? headerValues.TranDate),
    prmConfigID: Number(headerValues.configid ?? headerValues.ConfigID),
    prmSupplierID: Number(headerValues.supplierid ?? headerValues.SupplierID ?? 0),
    prmTranBook: tranBook,
    prmFrmOption: Number(headerValues.basedonid ?? headerValues.BasedOnID) || 0,
  };
}

/**
 * Resolve RB code or SP name from BasedOnID using a module route table.
 * @param {number|string} basedOnId
 * @param {{ routes: Array<{ when?: number, default?: boolean, code: string }> }} config
 */
export function resolveBasedOnPickerCode(basedOnId, { routes }) {
  const frmOption = Number(basedOnId) || 0;
  const match = routes.find((r) => r.when === frmOption);
  if (match) return match.code;
  const fallback = routes.find((r) => r.default);
  return fallback?.code ?? routes[0]?.code ?? "";
}
