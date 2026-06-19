import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { LM_CONFIG } from "../pages/location-master/constants";

function mapMasterRowToHeaderValues(master, params) {
  return {
    IDNumber:       Number(master.IDNumber ?? params.idNumber) || 0,
    LocationType:   master.LocationType    != null ? Number(master.LocationType)    : 0,
    ParentIDNumber: master.ParentIDNumber  != null ? Number(master.ParentIDNumber)  : 0,
    Loc_Code:       master.Loc_Code        ?? "",
    Location_Name:  master.Location_Name   ?? "",
    Address1:       master.Address1        ?? "",
    City:           master.City            ?? "",
    State:          master.State           ?? "",
    Zipcode:        master.Zipcode         ?? "",
    Country:        master.Country         ?? "",
    CompanyID:      Number(params.companyId)    || DEFAULT_COMPANY_ID,
    YearID:         Number(master.YearID   ?? params.yearId)    || LM_CONFIG.CONFIG_YEAR_ID,
    LoginID:        Number(master.LoginID  ?? params.loginId)   || DEFAULT_LOGIN_ID,
    SessionID:      Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    FuncCode:       master.FuncCode ?? LM_CONFIG.RB_MASTER,
  };
}

export function useLocationMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns,       setHeaderColumns]       = useState([]);
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
        JSon:      JSON.stringify([{ prmRBCode: LM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg:  "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error("No Location Master RB metadata returned.");
      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      localStorage.setItem(LM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — header column definitions
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  DEFAULT_LOGIN_ID,
      });
      setHeaderColumns(colData?.Links || []);

      // Phase 3 — LocationType + Premises dropdowns in parallel
      const [locTypeData, premisesData] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType:   2,
          ObjName:   LM_CONFIG.SP_LOCATION_TYPE,
          JSon:      JSON.stringify([{ PrmIdnumber: 0 }]), // ⚠️ CONFIRM param value with DBA
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
        console.log("[LM] LocationType row sample:", locTypeData?.Table?.[0]);
        console.log("[LM] Premises row sample:",     premisesData?.Table?.[0]);
      }

      setLocationTypeOptions(
        (locTypeData?.Table || []).map((r) => ({
          value: r.IDNumber ?? r.Idnumber ?? r.ID,
          label: String(r.Name ?? r.LocationType ?? r.Description ?? ""),
        })).filter((o) => o.value != null)
      );

      setPremisesOptions(
        (premisesData?.Table || []).map((r) => ({
          value: r.IDNumber ?? r.Idnumber ?? r.ID,
          label: String(r.Name ?? r.Location_Name ?? r.Description ?? ""),
        })).filter((o) => o.value != null)
      );
    } catch (err) {
      console.error("[LM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Location Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = [
      Number(companyId)  || DEFAULT_COMPANY_ID,
      Number(yearId)     || LM_CONFIG.CONFIG_YEAR_ID,
      Number(loginId)    || DEFAULT_LOGIN_ID,
      Number(sessionId)  || DEFAULT_SESSION_ID,
      Number(idNumber)   || 0,
    ].join(",");

    const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
      prmProcedure: LM_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode:  LM_CONFIG.RB_MASTER,
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
    locationTypeOptions, premisesOptions,
    fetchEditRecord,
  };
}
