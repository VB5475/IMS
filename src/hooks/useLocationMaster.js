import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { LM_CONFIG } from "../pages/location-master/constants";

export function useLocationMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns,       setHeaderColumns]       = useState([]);
  const [allColumns,          setAllColumns]          = useState([]);
  const [headerFetching,      setHeaderFetching]      = useState(false);
  const [headerError,         setHeaderError]         = useState(null);
  const [locationTypeOptions, setLocationTypeOptions] = useState([]);
  const [premisesOptions,     setPremisesOptions]     = useState([]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType:   2,
        ObjName:   LM_CONFIG.SP_RB_META,
        JSon:      JSON.stringify([{ prmrbcode: LM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg:  "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Location Master RB metadata returned.");
      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(LM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions (drives form fields, defaults, and save row)
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  getUserSession().loginId,
      });
      setHeaderColumns(colData || []);
      setAllColumns(
        (colData || []).map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );

      // Phase 3 — LocationType + Premises dropdowns in parallel
      const [locTypeData, premisesData] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType:   2,
          ObjName:   LM_CONFIG.SP_LOCATION_TYPE,
          JSon:      JSON.stringify([{ PrmIdnumber: 0 }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[LM] Location Type fetch failed:", err); return null; }),

        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType:   2,
          ObjName:   LM_CONFIG.SP_PREMISES,
          JSon:      JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[LM] Premises fetch failed:", err); return null; }),
      ]);

      if (process.env.NODE_ENV !== "production") {
        console.log("[LM] LocationType row sample:", locTypeData?.[0]);
        console.log("[LM] Premises row sample:",     premisesData?.[0]);
      }

      setLocationTypeOptions(
        (locTypeData || []).map((r) => ({
          value: r.idnumber,
          label: String(r.code + " - " + r.locationtype),
        })).filter((o) => o.value != null)
      );

      setPremisesOptions(
        (premisesData || []).map((r) => ({
          value: r.idnumber,
          label: String(r.idnumber + " - " + r.locationname),
        })).filter((o) => o.value != null)
      );
    } catch (err) {
      console.error("[LM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Location Master configuration.");
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
      prmProcedure: LM_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode:  LM_CONFIG.RB_MASTER,
    });
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? {
        ...master,
        // API returns locationtypeid (numeric) + locationtype (display string).
        // The form dropdown is keyed on "locationtype" and matches by numeric ID.
        locationtype: master.locationtypeid ?? master.locationtype,
        companyid: Number(companyId)                     || session.companyId,
        yearid:    Number(master.yearid    ?? yearId)    || session.yearId,
        loginid:   Number(master.loginid   ?? loginId)   || session.loginId,
        sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
        funccode:  master.funccode ?? LM_CONFIG.RB_MASTER,
      } : null,
    };
  }, [get]);

  return {
    headerColumns, allColumns, headerFetching, headerError, fetchHeaderMeta,
    locationTypeOptions, premisesOptions,
    fetchEditRecord,
  };
}
