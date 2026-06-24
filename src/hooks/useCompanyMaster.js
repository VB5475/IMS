import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { seedMasterDropdownOptions } from "../utils/gridUtils";
import { getVisibleHeaderFields } from "../utils/masterFormUtils";
import {
  CO_CONFIG,
  CO_CASCADE_DROPDOWN_REFRESH,
  CO_COUNTRY_COLS,
  CO_DROPDOWN_PARENT_BINDINGS,
} from "../pages/company/constants";

function mapIdNameOptions(table, valueKeys, labelKeys) {
  return (table ?? [])
    .map((row) => {
      const value = valueKeys.map((k) => row[k]).find((v) => v != null && v !== "");
      if (value == null || value === "") return null;
      const num = Number(value);
      const valueStr = Number.isFinite(num) ? String(Math.round(num)) : String(value);
      const labelRaw = labelKeys.map((k) => row[k]).find((v) => v != null && v !== "");
      return {
        value: valueStr,
        label: String(labelRaw ?? valueStr),
      };
    })
    .filter(Boolean);
}

function mapCountryOptions(table) {
  return mapIdNameOptions(
    table,
    ["CountryID", "IDNumber", "Idnumber"],
    ["CountryName", "Name", "Country"]
  );
}

function mapStateOptions(table) {
  return mapIdNameOptions(table, ["StateID", "IDNumber", "Idnumber"], ["StateName", "Name", "State"]);
}

function mapCityOptions(table) {
  return mapIdNameOptions(table, ["CityID", "IDNumber", "Idnumber"], ["CityName", "Name", "City"]);
}

function mapCurrencyOptions(table) {
  return mapIdNameOptions(
    table,
    ["IDNumber", "Idnumber", "BasCurrencyID", "CurrencyID"],
    ["CurrencyCode", "CurrencyName", "Name", "Currency", "Code"]
  );
}

async function fetchSpTable(get, spName, jsonRow = {}) {
  const res = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: CO_CONFIG.LIST_OBJ_TYPE,
    ObjName: spName,
    JSon: JSON.stringify([jsonRow]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  }).catch((err) => {
    console.warn(`[CO] ${spName} fetch failed:`, err);
    return null;
  });
  return res?.Table ?? res?.Links ?? [];
}

function mapMasterRowToHeaderValues(master, fieldDefs, params) {
  const header = {
    IDNumber: Number(master.IDNumber ?? params.idNumber) || 0,
    CompanyID: Number(params.companyId) || DEFAULT_COMPANY_ID,
    YearID: Number(master.YearID ?? params.yearId) || CO_CONFIG.CONFIG_YEAR_ID,
    LoginID: Number(master.LoginID ?? params.loginId) || DEFAULT_LOGIN_ID,
    SessionID: Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    FuncCode: master.FuncCode ?? CO_CONFIG.RB_MASTER,
  };

  getVisibleHeaderFields(fieldDefs).forEach((field) => {
    const key = field.ColName;
    if (!key || master[key] === undefined) return;
    header[key] = master[key];
  });

  return header;
}

async function fetchCountryOptions(get) {
  const table = await fetchSpTable(get, CO_CONFIG.SP_COUNTRY, {});
  return mapCountryOptions(table);
}

async function fetchStateOptionsForCountry(get, countryId) {
  const id = Number(countryId) || 0;
  if (!id) return [];
  const table = await fetchSpTable(get, CO_CONFIG.SP_STATE, { prmCountryID: id });
  return mapStateOptions(table);
}

async function fetchCityOptionsForState(get, stateId) {
  const id = Number(stateId) || 0;
  if (!id) return [];
  const table = await fetchSpTable(get, CO_CONFIG.SP_CITY, { prmStateID: id });
  return mapCityOptions(table);
}

export function useCompanyMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const fetchBaseDropdowns = useCallback(async () => {
    const [countryOpts, currencyTable] = await Promise.all([
      fetchCountryOptions(get),
      fetchSpTable(get, CO_CONFIG.SP_CURRENCY, {}),
    ]);
    const currencyOpts = mapCurrencyOptions(currencyTable);
    return {
      CountryID: countryOpts,
      ResPersonCountryID: countryOpts,
      BasCurrencyID: currencyOpts,
      BaseCurrencyID: currencyOpts,
      StateID: [],
      CityID: [],
      ResPersonStateID: [],
      ResPersonCityID: [],
    };
  }, [get]);

  const loadCascadedDropdowns = useCallback(
    async (values = {}) => {
      const patches = {};

      const countryId = Number(values.CountryID) || 0;
      const stateId = Number(values.StateID) || 0;
      if (countryId) {
        patches.StateID = await fetchStateOptionsForCountry(get, countryId);
      }
      if (stateId) {
        patches.CityID = await fetchCityOptionsForState(get, stateId);
      }

      const resCountryId = Number(values.ResPersonCountryID) || 0;
      const resStateId = Number(values.ResPersonStateID) || 0;
      if (resCountryId) {
        patches.ResPersonStateID = await fetchStateOptionsForCountry(get, resCountryId);
      }
      if (resStateId) {
        patches.ResPersonCityID = await fetchCityOptionsForState(get, resStateId);
      }

      if (Object.keys(patches).length) {
        setDropdownOptions((prev) => ({ ...prev, ...patches }));
      }
      return patches;
    },
    [get]
  );

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: CO_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: CO_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow?.RBID) throw new Error("No Company RB metadata returned.");

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      localStorage.setItem(CO_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const links = colData?.Links || [];
      setHeaderColumns(links);

      const baseOpts = await fetchBaseDropdowns();
      setDropdownOptions(baseOpts);
    } catch (err) {
      console.error("[CO] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Company configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchBaseDropdowns]);

  const refreshDropdownOptions = useCallback(
    async (parentColName, formValues = {}) => {
      const childNames = CO_CASCADE_DROPDOWN_REFRESH[parentColName] ?? [];
      const patches = {};

      if (CO_COUNTRY_COLS.includes(parentColName)) {
        const countryOpts = await fetchCountryOptions(get);
        patches.CountryID = countryOpts;
        patches.ResPersonCountryID = countryOpts;
      }

      if (!childNames.length && !Object.keys(patches).length) return;

      for (const childCol of childNames) {
        const binding = CO_DROPDOWN_PARENT_BINDINGS[childCol];
        if (!binding) continue;

        const parentId = Number(formValues[binding.parentCol]) || 0;
        if (!parentId) {
          patches[childCol] = [];
          continue;
        }

        if (binding.sp === "state") {
          patches[childCol] = await fetchStateOptionsForCountry(get, parentId);
        } else if (binding.sp === "city") {
          patches[childCol] = await fetchCityOptionsForState(get, parentId);
        }
      }

      if (Object.keys(patches).length) {
        setDropdownOptions((prev) => ({ ...prev, ...patches }));
      }
    },
    [get]
  );

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = [
        Number(companyId) || DEFAULT_COMPANY_ID,
        Number(yearId) || CO_CONFIG.CONFIG_YEAR_ID,
        Number(loginId) || DEFAULT_LOGIN_ID,
        Number(sessionId) || DEFAULT_SESSION_ID,
        Number(idNumber) || 0,
      ].join(",");

      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: CO_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: CO_CONFIG.RB_MASTER,
      });
      const master = mstRes?.Links?.[0] ?? null;
      const headerValues = master
        ? mapMasterRowToHeaderValues(master, headerColumns, {
            companyId,
            yearId,
            loginId,
            sessionId,
            idNumber,
          })
        : null;

      return { master, headerValues };
    },
    [get, headerColumns]
  );

  const fetchListRows = useCallback(async (listParams) => {
    const listRes = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
    return listRes?.Table ?? listRes?.Links ?? [];
  }, [get]);

  const seedOptionsFromMaster = useCallback(
    async (master, headerValues = null) => {
      if (!master) return;

      const baseOpts = await fetchBaseDropdowns();
      setDropdownOptions((prev) => {
        const seeded = seedMasterDropdownOptions(headerColumns, master, {
          ...baseOpts,
          ...prev,
        });
        return { ...baseOpts, ...seeded };
      });

      const values = headerValues ?? master;
      await loadCascadedDropdowns(values);
    },
    [fetchBaseDropdowns, headerColumns, loadCascadedDropdowns]
  );

  return {
    headerColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchEditRecord,
    fetchListRows,
    refreshDropdownOptions,
    seedOptionsFromMaster,
    loadCascadedDropdowns,
  };
}
