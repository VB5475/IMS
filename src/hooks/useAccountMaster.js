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
import {
  mapMasterRowToHeaderValues,
  normalizeDetailColLinks,
  resolveDetailColLinks,
} from "../utils/masterFormUtils";
import { AM_CONFIG } from "../pages/account-master/constants";

function pickCI(obj, key) {
  if (!obj || key == null) return undefined;
  if (key in obj) return obj[key];
  const lower = key.toLowerCase();
  const found = Object.keys(obj).find((k) => k.toLowerCase() === lower);
  return found !== undefined ? obj[found] : undefined;
}

function buildMasterFillParameterString({ companyId, yearId, loginId, sessionId, masterId }) {
  return [
    Number(companyId) || DEFAULT_COMPANY_ID,
    Number(yearId) || AM_CONFIG.CONFIG_YEAR_ID,
    Number(loginId) || DEFAULT_LOGIN_ID,
    Number(sessionId) || DEFAULT_SESSION_ID,
    Number(masterId) || 0,
  ].join(",");
}

/** FN_Fetch_Data list rows — [{ idnumber, <labelCol> }, …] */
function mapIdNumberLabelRows(table, labelKeys) {
  const labels = Array.isArray(labelKeys) ? labelKeys : [labelKeys];
  return (table ?? [])
    .map((row) => {
      const rawId = pickCI(row, "idnumber");
      if (rawId == null || rawId === "") return null;
      const value = String(Number(rawId) || rawId);
      let label = "";
      for (const k of labels) {
        const v = pickCI(row, k);
        if (v != null && String(v).trim() !== "") {
          label = String(v);
          break;
        }
      }
      label = label.trim() || value;
      return { value, label };
    })
    .filter(Boolean);
}

function resolveLinks(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.Links)) return payload.Links;
  if (Array.isArray(payload?.Table)) return payload.Table;
  return [];
}

/** fn_tbl_acgroup_list — [{ idnumber, grpname }, …] */
function mapGroupListRows(table) {
  return (table ?? [])
    .map((row) => {
      const rawId = pickCI(row, "idnumber");
      if (rawId == null || rawId === "") return null;
      const value = String(Number(rawId) || rawId);
      const label = String(pickCI(row, "grpname") ?? value).trim();
      return { value, label: label || value };
    })
    .filter(Boolean);
}

function isGroupCol(col) {
  const name = String(col.ColName ?? col.colname ?? "").toLowerCase();
  if (name === AM_CONFIG.GROUP_COL.toLowerCase()) return true;
  const label = String(col.DisplayName ?? col.displayname ?? "").toLowerCase();
  return label === "group" || label === "group code" || label.includes("account group");
}

function findGroupColumn(links) {
  return (links || []).find((col) => isGroupCol(col));
}

function getGroupColKey(links) {
  return findGroupColumn(links)?.ColName ?? AM_CONFIG.GROUP_COL;
}

function findColumnByHints(links, hints) {
  const lowerHints = (hints || []).map((h) => String(h).toLowerCase());
  return (links || []).find((col) => {
    const name = String(col.ColName ?? col.colname ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
}

function getColKey(links, hints, fallback) {
  return findColumnByHints(links, hints)?.ColName ?? fallback;
}

function getAccClsColKey(links) {
  return getColKey(links, ["accclsid"], "accclsid");
}

function getCountryColKey(links) {
  return getColKey(links, ["countryid"], "countryid");
}

function getStateColKey(links) {
  return getColKey(links, ["stated", "stateid"], "stated");
}

function getCityColKey(links) {
  return getColKey(links, ["cityid"], "cityid");
}

export function useAccountMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const fetchListOptions = useCallback(
    async (spName, labelKeys, jsonParam = [{}]) => {
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: spName,
          JSon: JSON.stringify(jsonParam),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const rows = Array.isArray(res) ? res : resolveLinks(res);
        return mapIdNumberLabelRows(rows, labelKeys);
      } catch (err) {
        console.warn(`[AM] ${spName} fetch failed:`, err);
        return [];
      }
    },
    [get]
  );

  /** Account group dropdown — FN_Fetch_Data fn_tbl_acgroup_list (not GET_FILTER_DETAIL). */
  const fetchGroupOptions = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: AM_CONFIG.LIST_OBJ_TYPE,
        ObjName: AM_CONFIG.SP_GROUP_LIST,
        JSon: JSON.stringify([{}]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rows = Array.isArray(res) ? res : resolveLinks(res);
      return mapGroupListRows(rows);
    } catch (err) {
      console.warn(`[AM] ${AM_CONFIG.SP_GROUP_LIST} fetch failed:`, err);
      return [];
    }
  }, [get]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: AM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = resolveLinks(metaData)[0];
      const rbid = tableRow?.RBID ?? tableRow?.rbid;
      if (!rbid) throw new Error("No Account Master RB metadata returned.");

      const hdrMeta = {
        RBID: rbid,
        SaveProcName: tableRow?.SaveProcName ?? tableRow?.saveprocname,
      };
      localStorage.setItem(AM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const links = normalizeDetailColLinks(resolveDetailColLinks(colData));
      setHeaderColumns(links);

      const groupColKey = getGroupColKey(links);
      const accClsColKey = getAccClsColKey(links);
      const countryColKey = getCountryColKey(links);
      const stateColKey = getStateColKey(links);
      const cityColKey = getCityColKey(links);

      const [groupOpts, acClassOpts, countryOpts] = await Promise.all([
        fetchGroupOptions(),
        fetchListOptions(AM_CONFIG.SP_AC_CLASS_LIST, ["clsname", "accclsname"]),
        fetchListOptions(AM_CONFIG.SP_COUNTRY_LIST, ["countryname", "CountryName"]),
      ]);

      setDropdownOptions({
        [groupColKey]: groupOpts,
        [accClsColKey]: acClassOpts,
        [countryColKey]: countryOpts,
        [stateColKey]: [],
        [cityColKey]: [],
      });
    } catch (err) {
      console.error("[AM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Account Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchListOptions, fetchGroupOptions]);

  const refreshDropdownOptions = useCallback(
    async (parentColName, currentValues = {}) => {
      const colLower = String(parentColName ?? "").toLowerCase();
      const groupColKey = getGroupColKey(headerColumns);
      const countryColKey = getCountryColKey(headerColumns);
      const stateColKey = getStateColKey(headerColumns);
      const cityColKey = getCityColKey(headerColumns);

      if (colLower === groupColKey.toLowerCase()) {
        const groupOpts = await fetchGroupOptions();
        setDropdownOptions((prev) => ({ ...prev, [groupColKey]: groupOpts }));
        return;
      }

      if (colLower === countryColKey.toLowerCase()) {
        const countryId =
          currentValues[countryColKey] ?? currentValues.CountryID ?? currentValues.countryid ?? 0;
        const stateOpts = await fetchListOptions(
          AM_CONFIG.SP_STATE_LIST,
          ["statename", "StateName"],
          [{ prmcountryid: Number(countryId) || 0 }]
        );
        setDropdownOptions((prev) => ({
          ...prev,
          [stateColKey]: stateOpts,
          [cityColKey]: [],
        }));
        return;
      }

      if (colLower === stateColKey.toLowerCase()) {
        const stateId =
          currentValues[stateColKey] ?? currentValues.StateID ?? currentValues.stated ?? 0;
        const countryId =
          currentValues[countryColKey] ?? currentValues.CountryID ?? currentValues.countryid ?? 0;
        const cityOpts = await fetchListOptions(
          AM_CONFIG.SP_CITY_LIST,
          ["cityname", "CityName"],
          [
            {
              prmcountryid: Number(countryId) || 0,
              prmstateid: Number(stateId) || 0,
            },
          ]
        );
        setDropdownOptions((prev) => ({
          ...prev,
          [cityColKey]: cityOpts,
        }));
      }
    },
    [fetchListOptions, fetchGroupOptions, headerColumns]
  );

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: AM_CONFIG.SP_MASTER_FILL,
        prmParameters: buildMasterFillParameterString({
          companyId,
          yearId,
          loginId,
          sessionId,
          masterId: idNumber,
        }),
        prmFuncCode: AM_CONFIG.RB_MASTER,
      });
      const master = resolveLinks(mstRes)[0] ?? null;

      return {
        master,
        headerValues: master
          ? mapMasterRowToHeaderValues(master, headerColumns, {
              companyId,
              yearId,
              loginId,
              sessionId,
              idNumber,
              funcCode: AM_CONFIG.RB_MASTER,
            })
          : null,
      };
    },
    [get, headerColumns]
  );

  const fetchListRows = useCallback(
    async (listParams) => {
      const listRes = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
      return resolveLinks(listRes);
    },
    [get]
  );

  const seedOptionsFromMaster = useCallback(
    (master) => {
      if (!master) return;
      setDropdownOptions((prev) => seedMasterDropdownOptions(headerColumns, master, prev));
    },
    [headerColumns]
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
  };
}
