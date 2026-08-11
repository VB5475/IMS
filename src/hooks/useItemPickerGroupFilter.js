// Shared "Item Main Group / Item Sub Main Group" Select-Item filter logic.
// Extracted 2026-07-29 after this exact shape was independently copy-pasted
// into 15 modules (Purchase Indent/GRN/PO/PV/PI, built 2026-07-28, then all
// 10 Assets item-picker modules, built 2026-07-29 — see
// project_assets_item_picker_maingroup_rollout memory). Owns only the two
// cascading dropdowns' fetch/state/reset; the actual "fetch matching items"
// SP call stays in each module's own Form.jsx since the SP name and base
// payload shape differ per module — this hook just hands back the 5 extra
// params (prmmaingroupid/prmsubmaingroupid/prmsearchtext/prmotherstr/prmjson)
// to spread into that call.
import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { ENDPOINTS, API_BASE_URL, OBJ_TYPE } from "../api/constants";
import { getUserSession } from "../session/userSession";

/**
 * @param {object} config
 * @param {string} config.spMainGroup - SP_ITEM_MAIN_GROUP (e.g. "fn_fetch_itemmaingroup4popupfilter")
 * @param {string} config.spSubMainGroup - SP_ITEM_SUB_MAIN_GROUP
 * @param {string} config.formTag - module's FORM_TAG / RB_MASTER, sent as prmfrmtype
 */
export function useItemPickerGroupFilter({ spMainGroup, spSubMainGroup, formTag }) {
  const { get } = useApi(API_BASE_URL);

  const [mainGroupOptions, setMainGroupOptions] = useState([]);
  const [subMainGroupOptions, setSubMainGroupOptions] = useState([]);
  const [mainGroupFilter, setMainGroupFilter] = useState("");
  const [subMainGroupFilter, setSubMainGroupFilter] = useState("");
  const [filterApplied, setFilterApplied] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);

  const fetchMainGroupOptions = useCallback(async ({ divisionId, configId }) => {
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: spMainGroup,
        JSon: JSON.stringify([{
          prmcompanyid: session.companyId,
          prmdivisionid: Number(divisionId) || 0,
          prmyearid: session.yearId,
          prmloginid: session.loginId,
          prmitemtype: 0,
          prmconfigid: Number(configId) || 0,
          prmfrmtype: formTag,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.maingroupid),
        label: r.maingroup ?? String(r.maingroupid),
      }));
      setMainGroupOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[ItemPickerGroupFilter] Item Main Group fetch failed:", err);
      setMainGroupOptions([]);
      return [];
    }
  }, [get, spMainGroup, formTag]);

  const fetchSubMainGroupOptions = useCallback(async ({ divisionId, configId, mainGroupId }) => {
    // Allow prmmaingroupid=0 (default / all) when callers pass 0 explicitly.
    // Only skip when the id is truly absent (undefined/null/"").
    if (mainGroupId === undefined || mainGroupId === null || mainGroupId === "") {
      setSubMainGroupOptions([]);
      return [];
    }
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: spSubMainGroup,
        JSon: JSON.stringify([{
          prmcompanyid: session.companyId,
          prmdivisionid: Number(divisionId) || 0,
          prmyearid: session.yearId,
          prmloginid: session.loginId,
          prmitemtype: 0,
          prmconfigid: Number(configId) || 0,
          prmfrmtype: formTag,
          prmmaingroupid: Number(mainGroupId) || 0,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.submaingroupid ?? r.subgroupid ?? r.id),
        label: r.submaingroup ?? r.subgroup ?? String(r.submaingroupid ?? r.subgroupid ?? r.id),
      }));
      setSubMainGroupOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[ItemPickerGroupFilter] Item Sub Main Group fetch failed:", err);
      setSubMainGroupOptions([]);
      return [];
    }
  }, [get, spSubMainGroup, formTag]);

  const clearSubMainGroupOptions = useCallback(() => setSubMainGroupOptions([]), []);

  /**
   * Main Group changed → reload Sub Main Group, reset its own selection.
   * When cleared, `defaultMaGroupId` (e.g. 0) keeps Sub Main options loaded
   * with that default prmmaingroupid — used by AEI so the dropdown stays active
   * on first open / after clearing Main Group.
   */
  const handleMainGroupChange = useCallback((value, { divisionId, configId, defaultMaGroupId } = {}) => {
    setMainGroupFilter(value);
    setSubMainGroupFilter("");
    if (value) {
      fetchSubMainGroupOptions({ divisionId, configId, mainGroupId: value });
    } else if (defaultMaGroupId !== undefined && defaultMaGroupId !== null && defaultMaGroupId !== "") {
      fetchSubMainGroupOptions({ divisionId, configId, mainGroupId: defaultMaGroupId });
    } else {
      clearSubMainGroupOptions();
    }
  }, [fetchSubMainGroupOptions, clearSubMainGroupOptions]);

  /** Call when the Select Item modal (re)opens, before fetching Main Group options. */
  const resetFilter = useCallback(() => {
    setMainGroupFilter("");
    setSubMainGroupFilter("");
    setFilterApplied(false);
    setSubMainGroupOptions([]);
  }, []);

  /** The 5 extra params to spread into the module's own item-list SP call. */
  const buildFilterParams = useCallback(() => ({
    prmmaingroupid: Number(mainGroupFilter) || 0,
    prmsubmaingroupid: Number(subMainGroupFilter) || 0,
    prmsearchtext: "",
    prmotherstr: "",
    prmjson: "[]",
  }), [mainGroupFilter, subMainGroupFilter]);

  /**
   * Wraps the module's own "fetch items with the current filter" call,
   * managing filterLoading/filterApplied around it. `fetchItemsFn` receives
   * the 5 filter params and is expected to set the module's own item state;
   * errors propagate to the caller's own try/catch (e.g. to set an error banner).
   *
   * Default: requires both Main Group AND Sub Main Group (2026-07-29).
   * Pass `options.validate` to replace that check (e.g. AEI: group pair OR
   * item-name search).
   */
  const applyFilter = useCallback(async (fetchItemsFn, options = {}) => {
    if (typeof options.validate === "function") {
      options.validate({
        mainGroupFilter,
        subMainGroupFilter,
      });
    } else {
      if (!mainGroupFilter) {
        throw new Error("Please select an Item Main Group before applying the filter.");
      }
      if (!subMainGroupFilter) {
        throw new Error("Please select an Item Sub Main Group before applying the filter.");
      }
    }
    setFilterLoading(true);
    try {
      await fetchItemsFn(buildFilterParams());
      setFilterApplied(true);
    } finally {
      setFilterLoading(false);
    }
  }, [buildFilterParams, mainGroupFilter, subMainGroupFilter]);

  return {
    mainGroupOptions, subMainGroupOptions,
    mainGroupFilter, subMainGroupFilter, setSubMainGroupFilter,
    filterApplied, filterLoading,
    fetchMainGroupOptions, fetchSubMainGroupOptions, clearSubMainGroupOptions,
    handleMainGroupChange, resetFilter, buildFilterParams, applyFilter,
  };
}
