import { useState, useCallback, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
  OBJ_TYPE,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { CIM_CONFIG } from "../pages/city-master/constants";

function mapTableToOptions(rows, valueKey, labelKey) {
  return (rows || []).map((r) => ({
    value: r[valueKey] ?? r.IDNumber ?? r.idnumber ?? "",
    label: String(r[labelKey] ?? r.Name ?? r[valueKey] ?? ""),
  }));
}

export function useCityMaster() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const [headerColumns,  setHeaderColumns]  = useState([]);
  const [allColumns,     setAllColumns]     = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError,    setHeaderError]    = useState(null);

  const [countryOptions, setCountryOptions] = useState([]);
  const [stateOptions,   setStateOptions]   = useState([]);
  const [isLoadingStates, setIsLoadingStates] = useState(false);

  const clearStates = useCallback(() => setStateOptions([]), []);

  // Country -> State cascade — needs the parent Country id, so it isn't a
  // simple zero-param static fetch like Country itself.
  const fetchStateOptions = useCallback(async (countryId) => {
    if (!countryId || countryId === "0") {
      setStateOptions([]);
      return [];
    }
    setIsLoadingStates(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: CIM_CONFIG.SP_STATE,
        JSon: JSON.stringify([{ prmcountryid: Number(countryId) }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapTableToOptions(res, "stateid", "statename");
      setStateOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[CIM] State fetch failed:", err);
      setStateOptions([]);
      return [];
    } finally {
      setIsLoadingStates(false);
    }
  }, [get]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType:   2,
        ObjName:   CIM_CONFIG.SP_RB_META,
        JSon:      JSON.stringify([{ prmrbcode: CIM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg:  "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No City Master RB metadata returned.");
      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(CIM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions (drives form fields, defaults, and save row)
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  getUserSession().loginId,
      });
      setHeaderColumns(colData || []);
      setAllColumns(
        (colData || []).map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );

      // Phase 3 — Country dropdown (zero-param, State is fetched on-demand via cascade)
      const countryData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: CIM_CONFIG.SP_COUNTRY,
        JSon: JSON.stringify([{}]),
        p_ErrCode: -1, p_ErrMsg: "",
      }).catch((err) => { console.warn("[CIM] Country fetch failed:", err); return null; });
      setCountryOptions(mapTableToOptions(countryData, "idnumber", "countryname"));
    } catch (err) {
      console.error("[CIM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load City Master configuration.");
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
      prmProcedure: CIM_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode:  CIM_CONFIG.RB_MASTER,
    });
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? {
        ...master,
        yearid:    session.yearId,
        funccode:  CIM_CONFIG.RB_MASTER,
        loginid:   Number(master.loginid   ?? loginId)   || session.loginId,
        sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
      } : null,
    };
  }, [get]);

  return {
    headerColumns, allColumns, headerFetching, headerError, fetchHeaderMeta,
    countryOptions, stateOptions, isLoadingStates,
    fetchStateOptions, clearStates,
    fetchEditRecord,
  };
}
