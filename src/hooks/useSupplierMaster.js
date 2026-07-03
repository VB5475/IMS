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
    value: String(r[valueKey] ?? r.IDNumber ?? r.idnumber ?? ""),
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
  const [headerDropdownOptions, setHeaderDropdownOptions] = useState({});

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

      const dropdownOpts = await fetchDropdownOptions(get, cols, meta.RBID, {
        funcCode: SM_CONFIG.RB_MASTER,
        divisionID: 0,
      });
      setHeaderDropdownOptions(dropdownOpts);

      return { meta, columns: cols };
    } catch (err) {
      console.error("[SM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Supplier Master configuration.");
      return { meta: null, columns: [] };
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

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
        headerValues: master ? {
          ...master,
          companyid: Number(companyId) || DEFAULT_COMPANY_ID,
          yearid: Number(master.yearid ?? yearId) || SM_CONFIG.CONFIG_YEAR_ID,
          loginid: Number(master.loginid ?? loginId) || DEFAULT_LOGIN_ID,
          sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
          funccode: master.funccode ?? SM_CONFIG.RB_MASTER,
        } : null,
        consigneeRows: consigneeRows.map((row, index) => ({
          ...row,
          id: String(row.compuniquekey ?? row.idnumber ?? `edit_${index}`),
        })),
      };
    },
    [get]
  );

  return {
    headerColumns, headerRbMeta, headerFetching, headerError, headerDropdownOptions,
    fetchHeaderMeta,
    detailColumns, detailAllColumns, detailRbMeta, detailFetching, detailError,
    fetchDetailMeta,
    stateOptions, cityOptions, isLoadingStates, isLoadingCities,
    fetchStateOptions, fetchCityOptions, clearStates, clearCities,
    fetchEditRecord,
  };
}
