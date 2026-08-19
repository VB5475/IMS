import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { CTM_CONFIG } from "../pages/country-master/constants";

export function useCountryMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns,  setHeaderColumns]  = useState([]);
  const [allColumns,     setAllColumns]     = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError,    setHeaderError]    = useState(null);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType:   2,
        ObjName:   CTM_CONFIG.SP_RB_META,
        JSon:      JSON.stringify([{ prmrbcode: CTM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg:  "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Country Master RB metadata returned.");
      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(CTM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions (drives form fields, defaults, and save row)
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  getUserSession().loginId,
      });
      setHeaderColumns(colData || []);
      setAllColumns(
        (colData || []).map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );
      // No Phase 3 — Country Master has no dropdown options to prefetch
    } catch (err) {
      console.error("[CTM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Country Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // Returns master spread directly (PG returns lowercase keys matching RB colnames).
  // System context fields are overlaid so the save SP always gets consistent values.
  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const session = getUserSession();
    const prmParameters = [
      Number(companyId)  || session.companyId,
      Number(yearId)     || session.yearId,
      Number(loginId)    || session.loginId,
      Number(sessionId)  || DEFAULT_SESSION_ID,
      Number(idNumber)   || 0,
    ].join(",");

    const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
      prmProcedure: CTM_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode:  CTM_CONFIG.RB_MASTER,
    });
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? {
        ...master,
        yearid:    session.yearId,
        funccode:  CTM_CONFIG.RB_MASTER,
        loginid:   Number(master.loginid   ?? loginId)   || session.loginId,
        sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
      } : null,
    };
  }, [get]);

  return {
    headerColumns, allColumns, headerFetching, headerError, fetchHeaderMeta,
    fetchEditRecord,
  };
}
