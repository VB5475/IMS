// useDMGroupRights.js — DMS Group Rights (see pages/dm-group-rights/constants.js
// for the full architecture notes). Mirrors useDivisionWiseRights.js's
// single-RB-covers-header-and-grid pattern.

import { useState, useCallback, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL, OBJ_TYPE } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { mapRowToFieldValues } from "../utils/gridUtils";
import { getCheckboxValue, normalizeDetailColLinks, resolveDetailColLinks } from "../utils/masterFormUtils";
import { isErrorOnlyRow } from "../utils/apiResponse";
import { DMGR_CONFIG as CFG } from "../pages/dm-group-rights/constants";

function getColumnDefsFor(links, colnames) {
  const byName = Object.fromEntries((links ?? []).map((c) => [c.ColName ?? c.colname, c]));
  return colnames.map((name) => byName[name]).filter(Boolean);
}

function mapIdNameRows(rows, labelKeys) {
  return (rows || [])
    .map((r) => {
      const value = r.idnumber ?? r.IDNumber ?? r.IdNumber;
      if (value == null || value === "") return null;
      let label;
      for (const key of labelKeys) {
        if (r[key] != null && r[key] !== "") { label = r[key]; break; }
      }
      const num = Number(value);
      return { value: Number.isFinite(num) ? String(Math.round(num)) : String(value), label: String(label ?? value) };
    })
    .filter(Boolean);
}

/** Coerces checkbox columns + falls back to a display-name field for the
 *  Document Type/SubType ids when the fetch row carries one (field name
 *  unconfirmed — table is empty live, see constants.js note). */
function mapGridRowFromApi(row, gridColumnDefs) {
  const mapped = mapRowToFieldValues(row, gridColumnDefs);

  // mapRowToFieldValues only copies the visible grid columns (doctype/subtype/
  // upload/view/delete) — idnumber is a real, hidden PK column on this RB
  // (confirmed live: colDataType numeric(18,0)) that must round-trip back to
  // Save so existing rows update instead of re-inserting with idnumber 0.
  mapped.idnumber = Number(row.idnumber ?? row.IDNumber ?? row.IdNumber) || 0;

  gridColumnDefs.forEach((col) => {
    const key = col.ColName ?? col.colname;
    if (!key) return;
    if ([CFG.GRID_UPLOAD_COL, CFG.GRID_VIEW_COL, CFG.GRID_DELETE_COL].includes(key)) {
      mapped[key] = getCheckboxValue(mapped[key]);
    }
  });

  mapped._doctypeLabel =
    row.documenttypename ?? row.DocumentTypeName ?? row[CFG.GRID_DOCTYPE_COL] ?? "";
  mapped._subtypeLabel =
    row.documentsubtypename ?? row.DocumentSubTypeName ?? row[CFG.GRID_SUBTYPE_COL] ?? "";

  return mapped;
}

export function useDMGroupRights() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const [allColumns, setAllColumns] = useState([]);
  const [headerColumns, setHeaderColumns] = useState([]);
  const [gridColumns, setGridColumns] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

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
      if (!rbid) throw new Error("No Group Rights RB metadata returned.");

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbid,
        prmLoginID: getUserSession().loginId,
      });
      const links = normalizeDetailColLinks(resolveDetailColLinks(colData));

      setAllColumns(links);
      setHeaderColumns(getColumnDefsFor(links, CFG.HEADER_COLS));
      setGridColumns(getColumnDefsFor(links, CFG.GRID_ROW_COLS));

      // Department is NOT fetched here (2026-08-20 /pm: System Defined only,
      // see constants.js) — it comes solely from refreshDepartmentOptions("system"),
      // called once on DMGroupRightsForm mount. This used to run a second,
      // generic fn_tbl_dm_department_list fetch in parallel with Group here;
      // being on a slower multi-step chain (RB meta → GetDetailColData →
      // this), it resolved AFTER the System Defined fetch and silently
      // overwrote it with the unfiltered department list every time — a real
      // race condition confirmed live (extra departments never flagged
      // System Defined showed up, and their labels rendered as raw ID
      // numbers since that SP's rows use `department`, not `name`/`Name`).
      const groupRes = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: CFG.LIST_OBJ_TYPE,
        ObjName: CFG.SP_GROUP_LIST,
        JSon: JSON.stringify([{}]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setGroupOptions(mapIdNameRows(resolveDetailColLinks(groupRes), ["groupname", "GroupName"]));
    } catch (err) {
      console.error("[DMGroupRights] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Group Rights configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  /** Swaps the Department dropdown's data source based on which of the
   *  System Defined / User Define checkboxes is active — see constants.js.
   *  `mode` is "system" | "user" | null (null restores the default,
   *  unfiltered department catalog for when neither checkbox is checked). */
  const refreshDepartmentOptions = useCallback(
    async (mode) => {
      const objName =
        mode === "system"
          ? CFG.SP_DEPARTMENT_LIST_SYSTEM_DEFINED
          : mode === "user"
          ? CFG.SP_DEPARTMENT_LIST_USER_DEFINED
          : CFG.SP_DEPARTMENT_LIST;
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: CFG.LIST_OBJ_TYPE,
          ObjName: objName,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const rows = resolveDetailColLinks(res) || [];
        if (rows.length === 1 && isErrorOnlyRow(rows[0])) {
          setDepartmentOptions([]);
          return;
        }
        setDepartmentOptions(mapIdNameRows(rows, ["name", "Name"]));
      } catch (err) {
        console.error("[DMGroupRights] refreshDepartmentOptions failed:", err);
        setDepartmentOptions([]);
      }
    },
    [get]
  );

  /** "Get Detail" — Department+Group scoped, 2026-08-14 (/pm) now a
   *  3-named-arg FUNCTION: (prmdepartmentid, prmgroupid, prmishardcoded).
   *  `prmishardcoded` is the System Defined / User Define checkbox pair's
   *  selected value — System Defined = 1 ("hardcoded" by the system), User
   *  Define = 0 — the caller (DMGroupRightsForm's handleGetDetail) derives
   *  this from headerValues and passes it as the 3rd positional arg. Both
   *  ids are still required — the caller's `canGetDetail` already gates on
   *  both being selected. */
  const fetchGridRows = useCallback(
    async (departmentId, groupId, isHardcoded, gridColumnDefs = gridColumns) => {
      const normalizedDept = Number(departmentId) || 0;
      const normalizedGroup = Number(groupId) || 0;
      if (!normalizedDept || !normalizedGroup) return [];

      const mstRes = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: CFG.SP_GET_DETAIL,
        JSon: JSON.stringify([{
          prmdepartmentid: normalizedDept,
          prmgroupid: normalizedGroup,
          prmishardcoded: Number(isHardcoded) === 1 ? 1 : 0,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rows = resolveDetailColLinks(mstRes);
      if (rows.length === 1 && isErrorOnlyRow(rows[0])) return [];
      return rows.map((row) => mapGridRowFromApi(row, gridColumnDefs));
    },
    [get, gridColumns]
  );

  return {
    allColumns,
    headerColumns,
    gridColumns,
    groupOptions,
    departmentOptions,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchGridRows,
    refreshDepartmentOptions,
  };
}
