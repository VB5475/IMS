import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { DM_CONFIG } from "../pages/department-master/constants";

// DeptHeadID dropdown is keyed by lowercase colname in dropdownOptions
const DEPT_HEAD_KEY = DM_CONFIG.DEPT_HEAD_COL.toLowerCase(); // "deptheadid"

function mapDeptHeadUserOptions(rows) {
  return (rows ?? [])
    .map((row) => {
      const value = row.idnumber ?? row.UserID ?? row.userid;
      if (value == null || value === "") return null;
      return {
        value: String(Math.round(Number(value))),
        label: String(row.username ?? row.UserName ?? row.name ?? value),
      };
    })
    .filter(Boolean);
}

/**
 * Normalize a GET_DETAIL_COL_DATA column from PG (lowercase) to dual-case so that
 * both MasterFormField (PascalCase) and dropdown lookups (lowercase)
 * work from the same column object.
 */
function normalizeColumn(col) {
  const colname = col.colname ?? col.ColName ?? "";
  const colseqno = col.colseqno ?? col.ColSeqNo ?? 999;
  const isvisible = col.isvisible ?? col.IsVisible ?? false;
  const colctrltype = col.colctrltype ?? col.ColCtrlType ?? 0;
  const updatekeycolname = col.updatekeycolname ?? col.UpdateKeyColName ?? "";
  const displayname = col.displayname ?? col.DisplayName ?? colname;
  const iseditallow = col.iseditallow ?? col.IsEditAllow ?? false;
  const islockoneditmodeallow = col.islockoneditmodeallow ?? col.IsLockOnEditModeAllow ?? false;
  const objdetid = col.objdetid ?? col.ObjDetID ?? null;
  const ismandatory = col.ismandatory ?? col.IsMandatory ?? false;
  const coldatatype = col.coldatatype ?? col.ColDataType ?? null;
  const ctrlvaluecol = col.ctrlvaluecol ?? col.CtrlValueCol ?? colname;
  const ctrldisplaycol = col.ctrldisplaycol ?? col.CtrlDisplayCol ?? colname;
  return {
    ...col,
    colname, colseqno, isvisible, colctrltype, updatekeycolname,
    displayname, iseditallow, islockoneditmodeallow, objdetid,
    ismandatory, coldatatype, ctrlvaluecol, ctrldisplaycol,
    ColName: colname,
    ColSeqNo: colseqno,
    IsVisible: isvisible,
    ColCtrlType: colctrltype,
    UpdateKeyColName: updatekeycolname,
    DisplayName: displayname,
    IsEditAllow: iseditallow,
    IsLockOnEditModeAllow: islockoneditmodeallow,
    ObjDetID: objdetid,
    IsMandatory: ismandatory,
    ColDataType: coldatatype,
  };
}

/** fn_tbl_RB_DepartmentMst — @prmCompanyID, @prmYearID, @prmLoginID, @prmSessionID, @prmMasterID */
function buildMasterFillParameterString({ companyId, yearId, loginId, sessionId, masterId }) {
  return [
    Number(companyId) || DEFAULT_COMPANY_ID,
    Number(yearId) || DM_CONFIG.CONFIG_YEAR_ID,
    Number(loginId) || DEFAULT_LOGIN_ID,
    Number(sessionId) || DEFAULT_SESSION_ID,
    Number(masterId) || 0,
  ].join(",");
}

export function useDepartmentMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: DM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: DM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      // PG returns lowercase keys
      const rbidVal = tableRow?.rbid ?? tableRow?.RBID;
      if (!rbidVal) throw new Error("No Department Master RB metadata returned.");

      const hdrMeta = {
        RBID: rbidVal,
        SaveProcName: tableRow.saveprocname ?? tableRow.SaveProcName,
      };
      localStorage.setItem(DM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions (drives visible fields, defaults, save row)
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      // PG returns a flat array; old SQL Server returned { Links: [...] }
      const rawLinks = Array.isArray(colData) ? colData : (colData || []);
      const links = rawLinks.map(normalizeColumn);
      setHeaderColumns(links);
      setAllColumns(links.map((c) => ({ key: c.colname, colDataType: c.coldatatype ?? null })));

      // Phase 3 — manual SP call for DeptHead user list
      const userRes = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: DM_CONFIG.SP_USER_FETCH,
        JSon: JSON.stringify([{}]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      }).catch(() => []);
      const userRows = Array.isArray(userRes) ? userRes : (userRes ?? userRes ?? []);
      setDropdownOptions({ [DEPT_HEAD_KEY]: mapDeptHeadUserOptions(userRows) });
    } catch (err) {
      console.error("[DM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Department Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  const refreshDropdownOptions = useCallback(async () => {
    // No cascaded dropdowns in Department Master — no-op for now
  }, []);

  // PG returns lowercase column names directly — spread master as headerValues.
  // Override system context fields so the save SP always receives consistent values.
  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: DM_CONFIG.SP_MASTER_FILL,
        prmParameters: buildMasterFillParameterString({
          companyId, yearId, loginId, sessionId, masterId: idNumber,
        }),
        prmFuncCode: DM_CONFIG.RB_MASTER,
      });
      const master = mstRes?.[0] ?? null;
      return {
        master,
        headerValues: master ? {
          ...master,
          yearid: Number(master.yearid ?? yearId) || DM_CONFIG.CONFIG_YEAR_ID,
          loginid: Number(master.loginid ?? loginId) || DEFAULT_LOGIN_ID,
          sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
          funccode: master.funccode ?? DM_CONFIG.RB_MASTER,
        } : null,
      };
    },
    [get]
  );

  const fetchListRows = useCallback(async (listParams) => {
    const res = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
    return Array.isArray(res) ? res : (res ?? res ?? []);
  }, [get]);

  // Ensures the selected DeptHead appears in the dropdown even if they're
  // an inactive user not returned by SP_USER_FETCH.
  const seedOptionsFromMaster = useCallback((master) => {
    if (!master) return;
    setDropdownOptions((prev) => {
      const headId = master[DEPT_HEAD_KEY] ?? master.DeptHeadID;
      const headName = master.deptHeadname ?? master.deptHeadName ?? master.DeptHeadName;
      if (headId == null || !headName) return prev;
      const opt = { value: String(headId), label: String(headName) };
      if (prev[DEPT_HEAD_KEY]?.some((o) => o.value === opt.value)) return prev;
      return { ...prev, [DEPT_HEAD_KEY]: [opt, ...(prev[DEPT_HEAD_KEY] || [])] };
    });
  }, []);

  return {
    headerColumns,
    allColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchEditRecord,
    fetchListRows,
    refreshDropdownOptions,
    seedOptionsFromMaster,
  };
}
