// useSupplierMaster.js — Header (master) meta, Consignee (detail) grid meta,
// and dropdown option fetches for the Supplier Master module.

import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { getUserSession } from "../session/userSession";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
  DEFAULT_LOGIN_ID,
  OBJ_TYPE,
} from "../api/constants";
import { SM_CONFIG } from "../pages/supplier-master/constants";
import { fetchDropdownOptions, buildGridColumns } from "../utils/gridUtils";
import { coerceRowByColumns } from "../utils/columnValidation";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId) || DEFAULT_COMPANY_ID,
    Number(yearId) || SM_CONFIG.CONFIG_YEAR_ID,
    Number(loginId) || getUserSession().loginId,
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

  // ── Detail (Consignee grid) ────────────────────────────────────────
  const [detailColumns, setDetailColumns] = useState([]);
  const [detailAllColumns, setDetailAllColumns] = useState([]);
  const [detailRbMeta, setDetailRbMeta] = useState(null);
  const [detailFetching, setDetailFetching] = useState(false);
  const [detailError, setDetailError] = useState(null);

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
        prmLoginID: DEFAULT_LOGIN_ID,
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

  // ── Detail RB meta + columns (Consignee grid) — direct-entry, no picker ─
  const fetchDetailMeta = useCallback(async () => {
    setDetailFetching(true);
    setDetailError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: SM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: SM_CONFIG.RB_DETAIL }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Consignee Detail RB metadata returned.");
      const meta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      setDetailRbMeta(meta);
      localStorage.setItem(SM_CONFIG.STORAGE_ENTRY_META, JSON.stringify(meta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: meta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const apiColumns = colData || [];
      setDetailAllColumns(
        apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );

      const dropdownOpts = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
        funcCode: SM_CONFIG.RB_DETAIL,
        divisionID: 0,
      });
      const gridColumns = buildGridColumns(apiColumns, dropdownOpts, {
        filterable: false,
        allEditable: true,
      });
      setDetailColumns(gridColumns);

      return { meta, columns: gridColumns };
    } catch (err) {
      console.error("[SM] fetchDetailMeta failed:", err);
      setDetailError(err?.message || "Failed to load Consignee Detail configuration.");
      return { meta: null, columns: [] };
    } finally {
      setDetailFetching(false);
    }
  }, [get]);

  // ── Edit load — master row + consignee rows in parallel ─────────────
  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = buildMasterDataFillParams({
        companyId, yearId, loginId, sessionId, idNumber,
      });

      const [mstRes, detRes] = await Promise.all([
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: SM_CONFIG.SP_MASTER_FILL,
          prmParameters,
          prmFuncCode: SM_CONFIG.RB_MASTER,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: SM_CONFIG.SP_DETAIL_FILL,
          prmParameters,
          prmFuncCode: SM_CONFIG.RB_DETAIL,
        }),
      ]);

      const master = mstRes?.[0] ?? null;
      const consigneeRows = detRes || [];

      return {
        master,
        headerValues: master ? coerceRowByColumns({
          ...master,
          companyid: Number(companyId) || DEFAULT_COMPANY_ID,
          yearid: Number(master.yearid ?? yearId) || SM_CONFIG.CONFIG_YEAR_ID,
          loginid: Number(master.loginid ?? loginId) || DEFAULT_LOGIN_ID,
          sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
          funccode: master.funccode ?? SM_CONFIG.RB_MASTER,
        }, headerColumns) : null,
        consigneeRows: consigneeRows.map((row, index) => ({
          ...coerceRowByColumns(row, detailAllColumns),
          id: String(row.compuniquekey ?? row.idnumber ?? `edit_${index}`),
        })),
      };
    },
    [get, headerColumns, detailAllColumns]
  );

  return {
    headerColumns, headerRbMeta, headerFetching, headerError,
    fetchHeaderMeta,
    detailColumns, detailAllColumns, detailRbMeta, detailFetching, detailError,
    fetchDetailMeta,
    stateOptions, cityOptions, isLoadingStates, isLoadingCities,
    fetchStateOptions, fetchCityOptions, clearStates, clearCities,
    categoryOptions, accountGroupOptions, countryOptions, registrationTypeOptions,
    currencyOptions, transporterOptions, transporterDestinationOptions,
    deducteeTypeOptions, nopOptions,
    fetchEditRecord,
  };
}
