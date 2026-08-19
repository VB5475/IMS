import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
  OBJ_TYPE,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { STM_CONFIG } from "../pages/state-master/constants";

function pickFirst(row, keys, fallback = "") {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") {
      return row[key];
    }
  }
  return fallback;
}

function mapTableToOptions(rows, valueKey, labelKey) {
  return (rows || []).map((r) => ({
    value: r[valueKey] ?? r.IDNumber ?? r.idnumber ?? "",
    label: String(r[labelKey] ?? r.Name ?? r[valueKey] ?? ""),
  }));
}

export function useStateMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns,  setHeaderColumns]  = useState([]);
  const [allColumns,     setAllColumns]     = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError,    setHeaderError]    = useState(null);
  const [countryOptions, setCountryOptions] = useState([]);
  const [stateTypeOptions, setStateTypeOptions] = useState([]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType:   2,
        ObjName:   STM_CONFIG.SP_RB_META,
        JSon:      JSON.stringify([{ prmrbcode: STM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg:  "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No State Master RB metadata returned.");
      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(STM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions (drives form fields, defaults, and save row)
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  getUserSession().loginId,
      });
      setHeaderColumns(colData || []);
      setAllColumns(
        (colData || []).map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );

      // Phase 3 — Country + State Type dropdowns in parallel (both static, no cascade)
      const [countryData, stateTypeData] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: STM_CONFIG.SP_COUNTRY,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[STM] Country fetch failed:", err); return null; }),

        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: STM_CONFIG.SP_STATE_TYPE,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[STM] State Type fetch failed:", err); return null; }),
      ]);

      setCountryOptions(mapTableToOptions(countryData, "idnumber", "countryname"));
      // Live-confirmed 2026-08-17: returns {IDNUMBER, LookupDesc} (a shared
      // lookup-table shape, not statetype-specific column names) — e.g.
      // [{IDNUMBER:647,LookupDesc:"STATE"},{IDNUMBER:648,LookupDesc:"UT"}].
      setStateTypeOptions(
        (stateTypeData || []).map((r) => ({
          value: String(pickFirst(r, ["idnumber", "IDNumber", "IDNUMBER"], "")),
          label: String(pickFirst(r, ["LookupDesc", "lookupdesc", "statetypename", "typename", "name", "StateTypeName", "TypeName", "Name"], "")),
        })).filter((o) => o.value !== "")
      );
    } catch (err) {
      console.error("[STM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load State Master configuration.");
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
      prmProcedure: STM_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode:  STM_CONFIG.RB_MASTER,
    });
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? {
        ...master,
        yearid:    session.yearId,
        funccode:  STM_CONFIG.RB_MASTER,
        loginid:   Number(master.loginid   ?? loginId)   || session.loginId,
        sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
      } : null,
    };
  }, [get]);

  return {
    headerColumns, allColumns, headerFetching, headerError, fetchHeaderMeta,
    countryOptions, stateTypeOptions,
    fetchEditRecord,
  };
}
