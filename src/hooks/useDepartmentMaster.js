import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { fetchDropdownOptions, seedMasterDropdownOptions } from "../utils/gridUtils";
import { getVisibleHeaderFields } from "../utils/masterFormUtils";
import { DM_CONFIG } from "../pages/department-master/constants";

const EMPTY_JSON = JSON.stringify([{}]);

function mapDeptHeadUserOptions(table) {
  return (table ?? [])
    .map((row) => {
      const value = row.UserID ?? row.DeptHeadID ?? row.IDNumber ?? row.Idnumber;
      if (value == null || value === "") return null;
      const num = Number(value);
      const valueStr = Number.isFinite(num) ? String(Math.round(num)) : String(value);
      return {
        value: valueStr,
        label: String(row.UserName ?? row.Name ?? row.DeptHeadName ?? row.UserID ?? valueStr),
      };
    })
    .filter(Boolean);
}

async function fetchDeptHeadUserOptions(get) {
  const res = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: DM_CONFIG.SP_USER_FETCH,
    JSon: EMPTY_JSON,
    p_ErrCode: -1,
    p_ErrMsg: "",
  }).catch((err) => {
    console.warn("[DM] Dept head user list fetch failed:", err);
    return null;
  });
  return mapDeptHeadUserOptions(res?.Table ?? res?.Links);
}

function mapMasterRowToHeaderValues(master, fieldDefs, params) {
  const header = {
    IDNumber: Number(master.IDNumber ?? params.idNumber) || 0,
    CompanyID: Number(params.companyId) || DEFAULT_COMPANY_ID,
    YearID: Number(master.YearID ?? params.yearId) || DM_CONFIG.CONFIG_YEAR_ID,
    LoginID: Number(master.LoginID ?? params.loginId) || DEFAULT_LOGIN_ID,
    SessionID: Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    FuncCode: master.FuncCode ?? DM_CONFIG.RB_MASTER,
  };

  getVisibleHeaderFields(fieldDefs).forEach((field) => {
    const key = field.ColName;
    if (!key || master[key] === undefined) return;
    header[key] = master[key];
  });

  return header;
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
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);
  const [rbId, setRbId] = useState(null);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: DM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: DM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow?.RBID) throw new Error("No Department Master RB metadata returned.");

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      localStorage.setItem(DM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));
      setRbId(hdrMeta.RBID);

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const links = colData?.Links || [];
      setHeaderColumns(links);

      const headerCols = links.filter((c) => c.ColSeqNo < 100 && c.IsVisible);
      const otherDropdownCols = headerCols.filter(
        (c) => c.ColName !== DM_CONFIG.DEPT_HEAD_COL
      );
      const [dropdownOpts, deptHeadOptions] = await Promise.all([
        fetchDropdownOptions(get, otherDropdownCols, hdrMeta.RBID, {
          funcCode: DM_CONFIG.RB_MASTER,
          divisionID: DM_CONFIG.LIST_DIVISION_ID,
        }),
        fetchDeptHeadUserOptions(get),
      ]);
      setDropdownOptions({
        ...dropdownOpts,
        [DM_CONFIG.DEPT_HEAD_COL]: deptHeadOptions,
      });
    } catch (err) {
      console.error("[DM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Department Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  const refreshDropdownOptions = useCallback(
    async (parentColName) => {
      if (!rbId) return;
      const childNames = (headerColumns ?? [])
        .filter((c) => String(c.UpdateKeyColName ?? "").trim() === parentColName)
        .map((c) => c.ColName)
        .filter(Boolean);
      if (!childNames.length) return;

      const colsToRefresh = headerColumns.filter((c) => childNames.includes(c.ColName));
      const refreshed = await fetchDropdownOptions(get, colsToRefresh, rbId, {
        funcCode: DM_CONFIG.RB_MASTER,
        divisionID: DM_CONFIG.LIST_DIVISION_ID,
      });
      setDropdownOptions((prev) => ({ ...prev, ...refreshed }));
    },
    [get, headerColumns, rbId]
  );

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: DM_CONFIG.SP_MASTER_FILL,
        prmParameters: buildMasterFillParameterString({
          companyId,
          yearId,
          loginId,
          sessionId,
          masterId: idNumber,
        }),
        prmFuncCode: DM_CONFIG.RB_MASTER,
      });
      const master = mstRes?.Links?.[0] ?? null;
      return {
        master,
        headerValues: master
          ? mapMasterRowToHeaderValues(master, headerColumns, {
            companyId,
            yearId,
            loginId,
            sessionId,
            idNumber,
          })
          : null,
      };
    },
    [get, headerColumns]
  );

  const fetchListRows = useCallback(async (listParams) => {
    const listRes = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
    return listRes?.Table ?? listRes?.Links ?? [];
  }, [get]);

  const seedOptionsFromMaster = useCallback(
    (master) => {
      if (!master) return;
      setDropdownOptions((prev) => {
        let next = seedMasterDropdownOptions(headerColumns, master, prev);
        const headId = master.DeptHeadID ?? master.UserID;
        const headName = master.DeptHeadName ?? master.UserName ?? master.Name;
        if (headId != null && headName != null && headName !== "") {
          const opt = { value: String(headId), label: String(headName) };
          if (!next[DM_CONFIG.DEPT_HEAD_COL]?.some((o) => o.value === opt.value)) {
            next = {
              ...next,
              [DM_CONFIG.DEPT_HEAD_COL]: [opt, ...(next[DM_CONFIG.DEPT_HEAD_COL] || [])],
            };
          }
        }
        return next;
      });
    },
    [headerColumns]
  );

  return {
    headerColumns,
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
