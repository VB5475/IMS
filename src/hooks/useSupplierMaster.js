// useSupplierMaster.js — Header (master) meta and dropdown option fetches for
// the Supplier Master module. (Consignee Detail grid removed — see
// SupplierMasterForm.jsx/Page.jsx history. SM_CONFIG.RB_DETAIL/SP_DETAIL_FILL
// stay in constants.js since Customer Master's own hook still uses them.)

import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { getUserSession } from "../session/userSession";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
  OBJ_TYPE,
} from "../api/constants";
import { SM_CONFIG } from "../pages/supplier-master/constants";
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

export function useSupplierMaster(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  // ── Master (header) ────────────────────────────────────────────────
  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerRbMeta, setHeaderRbMeta] = useState(null);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  // ── Header dropdowns — explicit fn_tbl_* fetches, one per field. Replaces
  // the generic RBID-driven GET_FILTER_DETAIL mechanism (which resolved a
  // dropdown's source by inspecting the column's ctrlvaluecol/ctrldisplaycol/
  // ctrlsqlsource metadata tied to the RB's object ID) with named function
  // calls, matching every other module's pattern (see GRN/PO).
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [accountGroupOptions, setAccountGroupOptions] = useState([]);
  const [countryOptions, setCountryOptions] = useState([]);
  const [registrationTypeOptions, setRegistrationTypeOptions] = useState([]);
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const [transporterOptions, setTransporterOptions] = useState([]);
  const [transporterDestinationOptions, setTransporterDestinationOptions] = useState([]);
  const [deducteeTypeOptions, setDeducteeTypeOptions] = useState([]);
  // NOP (nopid) has no working fn_tbl_* SP — see SM_CONFIG.SP_NOP DBA-CONFIRM note.
  const nopOptions = [];

  // ── Cascading State/City — not covered by the generic GET_FILTER_DETAIL
  // mechanism since they need a parent Country/State id parameter.
  const [stateOptions, setStateOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  const clearStates = useCallback(() => setStateOptions([]), []);
  const clearCities = useCallback(() => setCityOptions([]), []);

  // Zero-param header dropdowns — fetched once on mount (no cascade), all
  // live-verified against FN_Fetch_Data 2026-07-03 (see SM_CONFIG comments).
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
        console.warn(`[SM] ${label} fetch failed:`, err);
        setter([]);
      }
    },
    [get]
  );

  const fetchCategoryOptions = useCallback(
    () => fetchStaticOptions(SM_CONFIG.SP_CATEGORY, "idnumber", "lookupdesc", setCategoryOptions, "Category"),
    [fetchStaticOptions]
  );
  const fetchAccountGroupOptions = useCallback(
    () => fetchStaticOptions(SM_CONFIG.SP_ACCOUNT_GROUP, "idnumber", "grpname", setAccountGroupOptions, "Account Group"),
    [fetchStaticOptions]
  );
  const fetchCountryOptions = useCallback(
    () => fetchStaticOptions(SM_CONFIG.SP_COUNTRY, "idnumber", "countryname", setCountryOptions, "Country"),
    [fetchStaticOptions]
  );
  const fetchRegistrationTypeOptions = useCallback(
    () => fetchStaticOptions(SM_CONFIG.SP_REGISTRATION_TYPE, "idnumber", "name", setRegistrationTypeOptions, "Registration Type"),
    [fetchStaticOptions]
  );
  const fetchCurrencyOptions = useCallback(
    () => fetchStaticOptions(SM_CONFIG.SP_CURRENCY, "idnumber", "currencycode", setCurrencyOptions, "Currency"),
    [fetchStaticOptions]
  );
  // Transporter/Transporter Destination SPs are live-confirmed to exist and
  // execute cleanly, but return zero rows in this environment (no transporter
  // master data seeded yet — same result for GRN's own transporter SP). Label
  // key is a best-effort guess (no live row to confirm column names against);
  // mapTableToOptions falls back to r.Name if this guess is wrong.
  const fetchTransporterOptions = useCallback(
    () => fetchStaticOptions(SM_CONFIG.SP_TRANSPORTER, "idnumber", "transportername", setTransporterOptions, "Transporter"),
    [fetchStaticOptions]
  );
  const fetchTransporterDestinationOptions = useCallback(
    () => fetchStaticOptions(SM_CONFIG.SP_TRANSPORTER_DESTINATION, "idnumber", "destinationname", setTransporterDestinationOptions, "Transporter Destination"),
    [fetchStaticOptions]
  );
  const fetchDeducteeTypeOptions = useCallback(
    () => fetchStaticOptions(SM_CONFIG.SP_DEDUCTEE_TYPE, "idnumber", "name", setDeducteeTypeOptions, "Deductee Type"),
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
          ObjName: SM_CONFIG.SP_STATE,
          JSon: JSON.stringify([{ prmcountryid: Number(countryId) }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapTableToOptions(res, "stateid", "statename");
        setStateOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[SM] State fetch failed:", err);
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
          ObjName: SM_CONFIG.SP_CITY,
          JSon: JSON.stringify([{ prmstateid: Number(stateId) }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapTableToOptions(res, "cityid", "cityname");
        setCityOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[SM] City fetch failed:", err);
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
        ObjName: SM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: SM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Supplier Master RB metadata returned.");
      const meta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      setHeaderRbMeta(meta);
      localStorage.setItem(SM_CONFIG.STORAGE_HEADER_META, JSON.stringify(meta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: meta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      const cols = colData || [];
      setHeaderColumns(cols);

      // Header dropdowns — explicit fn_tbl_* calls, one per field, in parallel.
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
      console.error("[SM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Supplier Master configuration.");
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
        prmProcedure: SM_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: SM_CONFIG.RB_MASTER,
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
          funccode: master.funccode ?? SM_CONFIG.RB_MASTER,
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
