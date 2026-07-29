// useCustomerMaster.js — Header (master) meta and dropdown option fetches
// for the Customer Master module.
//
// Clone of useSupplierMaster.js — Customer Master shares the exact same
// backend RB codes/SPs (see customer-master/constants.js CM_CONFIG), so this
// hook's logic is identical; only the config import differs. (Consignee
// Detail grid meta/fetch removed — matches useSupplierMaster.js. CM_CONFIG's
// RB_DETAIL/SP_DETAIL_FILL/STORAGE_ENTRY_META stay in constants.js, unused
// for now, per the same caution as SM_CONFIG's equivalents.)

import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { getUserSession } from "../session/userSession";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
  OBJ_TYPE,
} from "../api/constants";
import { CM_CONFIG } from "../pages/customer-master/constants";
import { coerceRowByColumns } from "../utils/columnValidation";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  const session = getUserSession();
  return [
    Number(companyId) || session.companyId,
    Number(yearId) || session.yearId,
    Number(loginId) || session.loginId,
    Number(sessionId) || DEFAULT_SESSION_ID,
    Number(idNumber) || 0,
  ].join(",");
}

function mapTableToOptions(rows, valueKey, labelKey) {
  return (rows || []).map((r) => ({
    value: r[valueKey] ?? r.IDNumber ?? r.idnumber ?? "",
    label: String(r[labelKey] ?? r.Name ?? r[valueKey] ?? ""),
  }));
}

export function useCustomerMaster(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  // ── Master (header) ────────────────────────────────────────────────
  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerRbMeta, setHeaderRbMeta] = useState(null);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  // ── Header dropdowns — explicit fn_tbl_* fetches, one per field.
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [accountGroupOptions, setAccountGroupOptions] = useState([]);
  const [countryOptions, setCountryOptions] = useState([]);
  const [registrationTypeOptions, setRegistrationTypeOptions] = useState([]);
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const [transporterOptions, setTransporterOptions] = useState([]);
  const [transporterDestinationOptions, setTransporterDestinationOptions] = useState([]);
  const [deducteeTypeOptions, setDeducteeTypeOptions] = useState([]);
  // NOP (nopid) has no working fn_tbl_* SP — see CM_CONFIG.SP_NOP DBA-CONFIRM note.
  const nopOptions = [];

  // ── Cascading State/City ─────────────────────────────────────────────
  const [stateOptions, setStateOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  const clearStates = useCallback(() => setStateOptions([]), []);
  const clearCities = useCallback(() => setCityOptions([]), []);

  const fetchStaticOptions = useCallback(
    async (spName, valueKey, labelKey, setter, label) => {
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: spName,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        setter(mapTableToOptions(res, valueKey, labelKey));
      } catch (err) {
        console.warn(`[CM] ${label} fetch failed:`, err);
        setter([]);
      }
    },
    [get]
  );

  const fetchCategoryOptions = useCallback(
    () => fetchStaticOptions(CM_CONFIG.SP_CATEGORY, "idnumber", "lookupdesc", setCategoryOptions, "Category"),
    [fetchStaticOptions]
  );
  const fetchAccountGroupOptions = useCallback(
    () => fetchStaticOptions(CM_CONFIG.SP_ACCOUNT_GROUP, "idnumber", "grpname", setAccountGroupOptions, "Account Group"),
    [fetchStaticOptions]
  );
  const fetchCountryOptions = useCallback(
    () => fetchStaticOptions(CM_CONFIG.SP_COUNTRY, "idnumber", "countryname", setCountryOptions, "Country"),
    [fetchStaticOptions]
  );
  const fetchRegistrationTypeOptions = useCallback(
    () => fetchStaticOptions(CM_CONFIG.SP_REGISTRATION_TYPE, "idnumber", "name", setRegistrationTypeOptions, "Registration Type"),
    [fetchStaticOptions]
  );
  const fetchCurrencyOptions = useCallback(
    () => fetchStaticOptions(CM_CONFIG.SP_CURRENCY, "idnumber", "currencycode", setCurrencyOptions, "Currency"),
    [fetchStaticOptions]
  );
  const fetchTransporterOptions = useCallback(
    () => fetchStaticOptions(CM_CONFIG.SP_TRANSPORTER, "idnumber", "transportername", setTransporterOptions, "Transporter"),
    [fetchStaticOptions]
  );
  const fetchTransporterDestinationOptions = useCallback(
    () => fetchStaticOptions(CM_CONFIG.SP_TRANSPORTER_DESTINATION, "idnumber", "destinationname", setTransporterDestinationOptions, "Transporter Destination"),
    [fetchStaticOptions]
  );
  const fetchDeducteeTypeOptions = useCallback(
    () => fetchStaticOptions(CM_CONFIG.SP_DEDUCTEE_TYPE, "idnumber", "name", setDeducteeTypeOptions, "Deductee Type"),
    [fetchStaticOptions]
  );

  const fetchStateOptions = useCallback(
    async (countryId) => {
      if (!countryId || countryId === "0") {
        setStateOptions([]);
        return [];
      }
      setIsLoadingStates(true);
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: CM_CONFIG.SP_STATE,
          JSon: JSON.stringify([{ prmcountryid: Number(countryId) }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapTableToOptions(res, "stateid", "statename");
        setStateOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[CM] State fetch failed:", err);
        setStateOptions([]);
        return [];
      } finally {
        setIsLoadingStates(false);
      }
    },
    [get]
  );

  const fetchCityOptions = useCallback(
    async (stateId) => {
      if (!stateId || stateId === "0") {
        setCityOptions([]);
        return [];
      }
      setIsLoadingCities(true);
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: CM_CONFIG.SP_CITY,
          JSon: JSON.stringify([{ prmstateid: Number(stateId) }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapTableToOptions(res, "cityid", "cityname");
        setCityOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[CM] City fetch failed:", err);
        setCityOptions([]);
        return [];
      } finally {
        setIsLoadingCities(false);
      }
    },
    [get]
  );

  // ── Phase 1+2+3 — master RB meta, columns, dropdown options ─────────
  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: CM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: CM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Customer Master RB metadata returned.");
      const meta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      setHeaderRbMeta(meta);
      localStorage.setItem(CM_CONFIG.STORAGE_HEADER_META, JSON.stringify(meta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: meta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      const cols = colData || [];
      setHeaderColumns(cols);

      await Promise.all([
        fetchCategoryOptions(),
        fetchAccountGroupOptions(),
        fetchCountryOptions(),
        fetchRegistrationTypeOptions(),
        fetchCurrencyOptions(),
        fetchTransporterOptions(),
        fetchTransporterDestinationOptions(),
        fetchDeducteeTypeOptions(),
      ]);

      return { meta, columns: cols };
    } catch (err) {
      console.error("[CM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Customer Master configuration.");
      return { meta: null, columns: [] };
    } finally {
      setHeaderFetching(false);
    }
  }, [
    get,
    fetchCategoryOptions,
    fetchAccountGroupOptions,
    fetchCountryOptions,
    fetchRegistrationTypeOptions,
    fetchCurrencyOptions,
    fetchTransporterOptions,
    fetchTransporterDestinationOptions,
    fetchDeducteeTypeOptions,
  ]);

  // ── Edit load — master row only ──────────────────────────────────────
  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = buildMasterDataFillParams({
        companyId, yearId, loginId, sessionId, idNumber,
      });

      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: CM_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: CM_CONFIG.RB_MASTER,
      });

      const master = mstRes?.[0] ?? null;
      const session = getUserSession();

      return {
        master,
        headerValues: master ? coerceRowByColumns({
          ...master,
          companyid: Number(companyId) || session.companyId,
          yearid: Number(master.yearid ?? yearId) || session.yearId,
          loginid: Number(master.loginid ?? loginId) || session.loginId,
          sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
          funccode: master.funccode ?? CM_CONFIG.RB_MASTER,
        }, headerColumns) : null,
      };
    },
    [get, headerColumns]
  );

  return {
    headerColumns, headerRbMeta, headerFetching, headerError,
    fetchHeaderMeta,
    stateOptions, cityOptions, isLoadingStates, isLoadingCities,
    fetchStateOptions, fetchCityOptions, clearStates, clearCities,
    categoryOptions, accountGroupOptions, countryOptions, registrationTypeOptions,
    currencyOptions, transporterOptions, transporterDestinationOptions,
    deducteeTypeOptions, nopOptions,
    fetchEditRecord,
  };
}
