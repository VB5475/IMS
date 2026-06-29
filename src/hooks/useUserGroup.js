import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { fetchDropdownOptions } from "../utils/gridUtils";
import { UG_CONFIG } from "../pages/user-group/constants";

export function useUserGroup() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns,  setHeaderColumns]  = useState([]);
  const [allColumns,     setAllColumns]     = useState([]);
  const [dropdownOptions,setDropdownOptions]= useState({});
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError,    setHeaderError]    = useState(null);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID + SaveProcName
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType:   2,
        ObjName:   UG_CONFIG.SP_RB_META,
        JSon:      JSON.stringify([{ prmRBCode: UG_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg:  "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No User Group RB metadata returned.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(UG_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions (PG returns direct array, no .Links wrapper)
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  DEFAULT_LOGIN_ID,
      });
      const apiColumns = colData || [];
      setHeaderColumns(apiColumns);
      setAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));

      // Phase 3 — dropdown options for visible header fields (driven by RB colctrltype=4)
      const headerCols = apiColumns.filter((c) => c.colseqno < 100 && c.isvisible);
      const dropdownOpts = await fetchDropdownOptions(get, headerCols, hdrMeta.RBID, {
        funcCode:   UG_CONFIG.RB_MASTER,
        divisionID: UG_CONFIG.LIST_DIVISION_ID,
      });
      setDropdownOptions(dropdownOpts);
    } catch (err) {
      console.error("[UG] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load User Group configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // Spreads PG master record directly — all keys already lowercase.
  // Overrides stale context fields so the save SP receives consistent values.
  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = [
      Number(companyId)  || DEFAULT_COMPANY_ID,
      Number(yearId)     || UG_CONFIG.CONFIG_YEAR_ID,
      Number(loginId)    || DEFAULT_LOGIN_ID,
      Number(sessionId)  || DEFAULT_SESSION_ID,
      Number(idNumber)   || 0,
    ].join(",");

    const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
      prmProcedure: UG_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode:  UG_CONFIG.RB_MASTER,
    });
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? {
        ...master,
        yearid:    UG_CONFIG.CONFIG_YEAR_ID,
        funccode:  UG_CONFIG.RB_MASTER,
        loginid:   Number(master.loginid   ?? loginId)   || DEFAULT_LOGIN_ID,
        sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
      } : null,
    };
  }, [get]);

  // PG returns a direct array — no .Table or .Links wrapper
  const fetchListRows = useCallback(async (listParams) => {
    const listRes = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
    return listRes ?? [];
  }, [get]);

  return {
    headerColumns,
    allColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchEditRecord,
    fetchListRows,
  };
}
