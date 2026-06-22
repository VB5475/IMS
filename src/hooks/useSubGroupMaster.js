import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { SGM_CONFIG } from "../pages/sub-group-master/constants";

function mapMasterRowToHeaderValues(master, params) {
  return {
    IDNumber:                     Number(master.IDNumber ?? params.idNumber) || 0,
    SubGroupCode:                 master.SubGroupCode                 ?? "",
    SubGroupName:                 master.SubGroupName                 ?? "",
    SubGroupShortName:            master.SubGroupShortName            ?? "",
    SubGroupShortCode:            master.SubGroupShortCode            ?? "",
    UsedInAutoItemCodeGeneration: Boolean(master.UsedInAutoItemCodeGeneration) ? 1 : 0,
    CompanyID:                    Number(params.companyId)    || DEFAULT_COMPANY_ID,
    YearID:                       Number(master.YearID   ?? params.yearId)    || SGM_CONFIG.CONFIG_YEAR_ID,
    LoginID:                      Number(master.LoginID  ?? params.loginId)   || DEFAULT_LOGIN_ID,
    SessionID:                    Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    FuncCode:                     master.FuncCode ?? SGM_CONFIG.RB_MASTER,
  };
}

export function useSubGroupMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns,  setHeaderColumns]  = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError,    setHeaderError]    = useState(null);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType:   2,
        ObjName:   SGM_CONFIG.SP_RB_META,
        JSon:      JSON.stringify([{ prmRBCode: SGM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg:  "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error("No Sub Group Master RB metadata returned.");
      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      localStorage.setItem(SGM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — field definitions from GetDetailColData
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  DEFAULT_LOGIN_ID,
      });
      setHeaderColumns(colData?.Links || []);
      // No Phase 3 — Sub Group Master has no dropdown options to prefetch
    } catch (err) {
      console.error("[SGM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Sub Group Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = [
      Number(companyId)  || DEFAULT_COMPANY_ID,
      Number(yearId)     || SGM_CONFIG.CONFIG_YEAR_ID,
      Number(loginId)    || DEFAULT_LOGIN_ID,
      Number(sessionId)  || DEFAULT_SESSION_ID,
      Number(idNumber)   || 0,
    ].join(",");

    const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
      prmProcedure: SGM_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode:  SGM_CONFIG.RB_MASTER,
    });
    const master = mstRes?.Links?.[0] ?? null;
    return {
      master,
      headerValues: master
        ? mapMasterRowToHeaderValues(master, { companyId, yearId, loginId, sessionId, idNumber })
        : null,
    };
  }, [get]);

  return {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    fetchEditRecord,
  };
}
