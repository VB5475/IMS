// useReportFilterOptions.js — Division/Location/Department dropdown options
// shared by every report in REPORTS_LIST's filter modal (see
// reportsConfig.js). Location cascades off Division (clear + refetch on
// Division change), same pattern as City Master's Country→State cascade.
import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { ENDPOINTS, API_BASE_URL, OBJ_TYPE } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { REPORTS_FILTER_CONFIG } from "../constants/reportsConfig";

function mapOptions(rows, valueKeys, labelKeys) {
  const seen = new Set();
  const options = [];
  (rows || []).forEach((row) => {
    const value = String(valueKeys.map((k) => row[k]).find((v) => v != null) ?? "");
    const label = String(labelKeys.map((k) => row[k]).find((v) => v != null) ?? "");
    if (!value || seen.has(value)) return;
    seen.add(value);
    options.push({ value, label });
  });
  return options;
}

export function useReportFilterOptions() {
  const { get } = useApi(API_BASE_URL);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  const clearLocations = useCallback(() => setLocationOptions([]), []);

  // Division → Location cascade — Location genuinely requires a real
  // division id (see reportsConfig.js comment), so this only fires once the
  // user has picked one.
  const fetchLocations = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === "0") {
      setLocationOptions([]);
      return [];
    }
    const session = getUserSession();
    setIsLoadingLocations(true);
    try {
      const rows = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: REPORTS_FILTER_CONFIG.SP_LOCATION,
        JSon: JSON.stringify([{
          prmcompanyid: session.companyId,
          prmdivisionid: Number(divisionId),
          prmloginid: session.loginId,
          prmlocationtype: "",
          prmfrmtype: REPORTS_FILTER_CONFIG.LOCATION_FRM_TYPE,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = mapOptions(rows, ["locationid", "LocationID"], ["locationname", "location", "LocationName"]);
      setLocationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[Reports] Location fetch failed:", err);
      setLocationOptions([]);
      return [];
    } finally {
      setIsLoadingLocations(false);
    }
  }, [get]);

  // Division + Department — both static (zero-param besides company/login),
  // fetched together whenever the modal opens.
  const fetchOptions = useCallback(async () => {
    const session = getUserSession();
    setOptionsLoading(true);
    try {
      const [divisionRows, departmentRows] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: REPORTS_FILTER_CONFIG.SP_DIVISION,
          JSon: JSON.stringify([{
            prmuserid: session.loginId,
            prmcompanyid: session.companyId,
            prmyearid: session.yearId,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[Reports] Division fetch failed:", err); return null; }),

        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: REPORTS_FILTER_CONFIG.SP_DEPARTMENT,
          JSon: JSON.stringify([{
            prmcompanyid: session.companyId,
            prmloginid: session.loginId,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[Reports] Department fetch failed:", err); return null; }),
      ]);

      setDivisionOptions(mapOptions(divisionRows, ["divisionid", "DivisionID"], ["divisionname", "division", "DivisionName"]));
      setDepartmentOptions(mapOptions(departmentRows, ["deptid", "DeptID", "departmentid"], ["deptname", "department", "DeptName"]));
      setLocationOptions([]);
    } finally {
      setOptionsLoading(false);
    }
  }, [get]);

  return {
    divisionOptions, locationOptions, departmentOptions,
    optionsLoading, isLoadingLocations,
    fetchOptions, fetchLocations, clearLocations,
  };
}
