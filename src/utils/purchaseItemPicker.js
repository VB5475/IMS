// Shared item-picker helpers for purchase entry forms.

import { formatTranDate } from "./dateFormat";
import { getMissingMandatoryHeaderLabels } from "./columnValidation";

/**
 * Returns display labels of header fields that must be filled before Select Item.
 * Driven entirely by GET_DETAIL_COL_DATA IsMandatory / IsVisible — no hardcoded
 * candidate field lists.
 *
 * @param {object} headerValues
 * @param {object[]|null|undefined} headerColumns - GET_DETAIL_COL_DATA rows
 * @param {{ zeroValidFields?: Set<string> }} [opts]
 */
export function getMissingItemPickerHeaderFields(headerValues, headerColumns = null, opts = {}) {
  return getMissingMandatoryHeaderLabels(headerValues, headerColumns, opts);
}

/**
 * Standard FN_FETCH_DATA JSON payload for purchase item picker SPs.
 */
export function buildItemPickerJsonPayload(headerValues, loginId, { configYearId, tranBook }) {
  return {
    prmdivisionid: Number(headerValues.divisionid ?? headerValues.DivisionID),
    prmyearid: configYearId,
    prmloginid: loginId,
    prmtrandate: formatTranDate(headerValues.trandate ?? headerValues.TranDate),
    prmconfigid: Number(headerValues.configid ?? headerValues.ConfigID),
    prmsupplierid: Number(headerValues.supplierid ?? headerValues.SupplierID ?? 0),
    prmtranbook: tranBook,
    prmfrmoption: Number(headerValues.basedonid ?? headerValues.BasedOnID) || 0,
  };
}

/**
 * Trailing Select-Item filter args for Direct-only picker SPs, in SP order:
 * prmmaingroupid, prmsubmaingroupid, prmitemnamesearch, prmsearchtext,
 * prmotherstr, prmjson, prmqrjson.
 *
 * Use only with Direct obj names (e.g. fn_tbl_rb_purindtselitem,
 * fn_tbl_rb_purinqselonlyitem, fn_tbl_rb_purposelonlyitem,
 * fn_tbl_rb_purgrnselonlyitem, fn_tbl_rb_purpvselonlyitem).
 * Indent/PO/Quotation/GRN-based picker SPs keep their existing payloads.
 */
export function buildDirectItemPickerFilterParams({
  maGroupId = 0,
  subMaGroupId = 0,
  itemNameSearch = "",
  qrJson = "",
} = {}) {
  return {
    prmmaingroupid: Number(maGroupId) || 0,
    prmsubmaingroupid: Number(subMaGroupId) || 0,
    prmitemnamesearch: String(itemNameSearch ?? "").trim(),
    prmsearchtext: "",
    prmotherstr: "",
    prmjson: "[]",
    prmqrjson: String(qrJson ?? "").trim(),
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
