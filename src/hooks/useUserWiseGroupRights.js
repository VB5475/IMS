// useUserWiseGroupRights.js — User Wise Group Rights (see
// pages/user-wise-group-rights/constants.js for the architecture notes and
// the open CONFIRM items). Follows useDMGroupRights.js: one RB supplies the
// header field metadata, and separate FUNCTIONs supply each grid's rows.

import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { ENDPOINTS, API_BASE_URL, OBJ_TYPE } from "../api/constants";
import { getUserSession } from "../session/userSession";
import {
  getCheckboxValue,
  isMasterFieldVisible,
  normalizeDetailColLinks,
  resolveDetailColLinks,
} from "../utils/masterFormUtils";
import { isErrorOnlyRow } from "../utils/apiResponse";
import {
  UWGR_CONFIG as CFG,
  UWGR_REPORT_RIGHTS,
  UWGR_ROW_KEYS,
  UWGR_TRANSACTION_RIGHTS,
  buildGridParams,
} from "../pages/user-wise-group-rights/constants";

// Only RB-visible columns become header fields — a column present in
// HEADER_COLS by name but flagged isvisible:false in this RB config (e.g.
// Type, per masterID 20205) must not render, same as every other RB-driven
// form in the app.
function getColumnDefsFor(links, colnames) {
  const byName = Object.fromEntries((links ?? []).map((c) => [c.ColName ?? c.colname, c]));
  return colnames.map((name) => byName[name]).filter(Boolean).filter(isMasterFieldVisible);
}

/** Grid SPs and dropdown SPs return inconsistent key casing — flatten once so
 *  everything downstream (and the save payload) speaks lowercase. */
function toLowerKeyed(row) {
  return Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [k.toLowerCase(), v]));
}

function mapIdNameRows(rows, labelKeys) {
  return (rows || [])
    .map((raw) => {
      const row = toLowerKeyed(raw);
      const value = row.idnumber ?? 0;
      if (value == null || value === "") return null;
      const label = labelKeys.map((k) => row[k]).find((v) => v != null && v !== "");
      const num = Number(value);
      return {
        value: Number.isFinite(num) ? String(Math.round(num)) : String(value) ?? 0,
        label: String(label ?? value),
      };
    })
    .filter(Boolean);
}

/**
 * Turn raw grid rows into what both grids render from — `{ id, name, raw,
 * values }`. `raw` is kept whole so Save can write the edited rights back onto
 * the server's own row and pass every other column through untouched.
 */
function normalizeRightsRows(rawRows, rightDefs) {
  return (rawRows || []).map(toLowerKeyed).map((raw, index) => ({
    id: String(raw[UWGR_ROW_KEYS.functionId] ?? `_row_${index}`),
    name: String(raw[UWGR_ROW_KEYS.functionName] ?? ""),
    raw,
    values: Object.fromEntries(
      rightDefs.map((def) => [def.key, getCheckboxValue(raw[def.column])])
    ),
  }));
}

export function useUserWiseGroupRights() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [moduleOptions, setModuleOptions] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const fetchList = useCallback(
    async (objName, json = [{}]) => {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: CFG.LIST_OBJ_TYPE,
        ObjName: objName,
        JSon: JSON.stringify(json),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rows = resolveDetailColLinks(res) || [];
      return rows.length === 1 && isErrorOnlyRow(rows[0]) ? [] : rows;
    },
    [get]
  );

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: CFG.LIST_OBJ_TYPE,
        ObjName: CFG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: CFG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = resolveDetailColLinks(metaData)[0] ?? metaData?.[0];
      const rbid = tableRow?.RBID ?? tableRow?.rbid;
      if (!rbid) throw new Error("No User Wise Group Rights RB metadata returned.");

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbid,
        prmLoginID: getUserSession().loginId,
      });
      const links = normalizeDetailColLinks(resolveDetailColLinks(colData));

      setHeaderColumns(getColumnDefsFor(links, CFG.HEADER_COLS));

      const [groupRows, moduleRows, typeRows] = await Promise.all([
        fetchList(CFG.SP_GROUP_LIST),
        fetchList(CFG.SP_MODULE_LIST),
        fetchList(CFG.SP_TYPE_LIST),
      ]);

      setGroupOptions(mapIdNameRows(groupRows, ["groupname", "name"]));
      setModuleOptions(mapIdNameRows(moduleRows, ["modulename", "name"]));
      setTypeOptions(mapIdNameRows(typeRows, ["typename", "name"]));
    } catch (err) {
      console.error("[UserWiseGroupRights] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load User Wise Group Rights configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchList]);

  /** Search — loads both rights grids for the selected Group in one pass. */
  const fetchRightsGrids = useCallback(
    async ({ groupId, moduleId }) => {
      const moduleName = moduleOptions.find((o) => o.value === String(moduleId))?.label ?? "";
      const params = buildGridParams({ groupId, moduleName });
      if (!params.prmgroupid) return { transaction: [], report: [] };

      const [functionRows, approvalRows] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: CFG.SP_FUNCTION_GRID,
          JSon: JSON.stringify([params]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: CFG.SP_APPROVAL_GRID,
          JSon: JSON.stringify([params]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }),
      ]);

      const unwrap = (res) => {
        const rows = resolveDetailColLinks(res) || [];
        return rows.length === 1 && isErrorOnlyRow(rows[0]) ? [] : rows;
      };

      return {
        transaction: normalizeRightsRows(unwrap(functionRows), UWGR_TRANSACTION_RIGHTS),
        report: normalizeRightsRows(unwrap(approvalRows), UWGR_REPORT_RIGHTS),
      };
    },
    [get, moduleOptions]
  );

  return {
    headerColumns,
    groupOptions,
    moduleOptions,
    typeOptions,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchRightsGrids,
  };
}
