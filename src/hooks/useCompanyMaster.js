import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { CO_CONFIG } from "../pages/company/constants";

// ---------------------------------------------------------------------------
// Dual-case normalization — PG returns lowercase; MasterFormField needs PascalCase
// ---------------------------------------------------------------------------
function normalizeColumn(col) {
  const colname = col.colname ?? col.ColName ?? "";
  const colseqno = col.colseqno ?? col.ColSeqNo ?? 999;
  const isvisible = col.isvisible ?? col.IsVisible ?? false;
  const colctrltype = col.colctrltype ?? col.ColCtrlType ?? 0;
  const updatekeycolname = col.updatekeycolname ?? col.UpdateKeyColName ?? "";
  const displayname = col.displayname ?? col.DisplayName ?? colname;
  const iseditallow = col.iseditallow ?? col.IsEditAllow ?? false;
  const islockoneditmodeallow = col.islockoneditmodeallow ?? col.IsLockOnEditModeAllow ?? false;
  const objdetid = col.objdetid ?? col.ObjDetID ?? null;
  const ismandatory = col.ismandatory ?? col.IsMandatory ?? false;
  const coldatatype = col.coldatatype ?? col.ColDataType ?? null;
  const ctrlvaluecol = col.ctrlvaluecol ?? col.CtrlValueCol ?? colname;
  const ctrldisplaycol = col.ctrldisplaycol ?? col.CtrlDisplayCol ?? colname;
  return {
    ...col,
    colname, colseqno, isvisible, colctrltype, updatekeycolname,
    displayname, iseditallow, islockoneditmodeallow, objdetid,
    ismandatory, coldatatype, ctrlvaluecol, ctrldisplaycol,
    ColName: colname,
    ColSeqNo: colseqno,
    IsVisible: isvisible,
    ColCtrlType: colctrltype,
    UpdateKeyColName: updatekeycolname,
    DisplayName: displayname,
    IsEditAllow: iseditallow,
    IsLockOnEditModeAllow: islockoneditmodeallow,
    ObjDetID: objdetid,
    IsMandatory: ismandatory,
    ColDataType: coldatatype,
  };
}

// ---------------------------------------------------------------------------
// Option mappers — try both PG lowercase and legacy PascalCase keys
// ---------------------------------------------------------------------------
function mapIdNameOptions(table, valueKeys, labelKeys) {
  return (table ?? [])
    .map((row) => {
      const value = valueKeys.map((k) => row[k]).find((v) => v != null && v !== "");
      if (value == null || value === "") return null;
      const num = Number(value);
      const valueStr = Number.isFinite(num) ? String(Math.round(num)) : String(value);
      const labelRaw = labelKeys.map((k) => row[k]).find((v) => v != null && v !== "");
      return { value: valueStr, label: String(labelRaw ?? valueStr) };
    })
    .filter(Boolean);
}

function mapCountryOptions(table) {
  return mapIdNameOptions(
    table,
    ["countryid", "CountryID", "idnumber", "IDNumber", "Idnumber"],
    ["countryname", "CountryName", "name", "Name", "Country", "country"]
  );
}
function mapStateOptions(table) {
  return mapIdNameOptions(
    table,
    ["stateid", "StateID", "idnumber", "IDNumber", "Idnumber"],
    ["statename", "StateName", "name", "Name", "State", "state"]
  );
}
function mapCityOptions(table) {
  return mapIdNameOptions(
    table,
    ["cityid", "CityID", "idnumber", "IDNumber", "Idnumber"],
    ["cityname", "CityName", "name", "Name", "City", "city"]
  );
}
function mapCurrencyOptions(table) {
  return mapIdNameOptions(
    table,
    ["idnumber", "IDNumber", "bascurrencyid", "BasCurrencyID", "currencyid", "CurrencyID"],
    ["currencycode", "CurrencyCode", "currencyname", "CurrencyName", "name", "Name", "code", "Code"]
  );
}

// ---------------------------------------------------------------------------
// SP fetch helper — handles PG flat array + legacy Table/Links wrapper
// ---------------------------------------------------------------------------
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
  return Array.isArray(res) ? res : (res ?? res ?? []);
}

// ---------------------------------------------------------------------------
// Cascade maps (lowercase PG colnames)
// ---------------------------------------------------------------------------
const CO_CASCADE_RESETS_LC = {
  countryid: ["stateid", "cityid"],
  stateid: ["cityid"],
  respersoncountryid: ["respersonstateid", "respersoncityid"],
  respersonstateid: ["respersoncityid"],
};

const CO_CASCADE_REFRESH_LC = {
  countryid: ["stateid"],
  stateid: ["cityid"],
  respersoncountryid: ["respersonstateid"],
  respersonstateid: ["respersoncityid"],
};

const CO_PARENT_BINDINGS_LC = {
  stateid: { sp: "state", parentCol: "countryid" },
  cityid: { sp: "city", parentCol: "stateid" },
  respersonstateid: { sp: "state", parentCol: "respersoncountryid" },
  respersoncityid: { sp: "city", parentCol: "respersonstateid" },
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useCompanyMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  // Fetch Country and Currency — the two base dropdowns that don't depend on parent value.
  // Stored under lowercase keys to match field.colname from PG.
  const fetchBaseDropdowns = useCallback(async () => {
    const [countryTable, currencyTable] = await Promise.all([
      fetchSpTable(get, CO_CONFIG.SP_COUNTRY, {}),
      fetchSpTable(get, CO_CONFIG.SP_CURRENCY, {}),
    ]);
    const countryOpts = mapCountryOptions(countryTable);
    const currencyOpts = mapCurrencyOptions(currencyTable);
    return {
      countryid: countryOpts,
      respersoncountryid: countryOpts,
      bascurrencyid: currencyOpts,
      basecurrencyid: currencyOpts,
      stateid: [],
      cityid: [],
      respersonstateid: [],
      respersoncityid: [],
    };
  }, [get]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID (PG returns lowercase keys)
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: CO_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: CO_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      const rbidVal = tableRow?.rbid ?? tableRow?.RBID;
      if (!rbidVal) throw new Error("No Company RB metadata returned.");

      const hdrMeta = {
        RBID: rbidVal,
        SaveProcName: tableRow.saveprocname ?? tableRow.SaveProcName,
      };
      localStorage.setItem(CO_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const rawLinks = Array.isArray(colData) ? colData : (colData || []);
      const links = rawLinks.map(normalizeColumn);
      setHeaderColumns(links);
      setAllColumns(links.map((c) => ({ key: c.colname, colDataType: c.coldatatype ?? null })));

      // Phase 3 — manual SP calls for base dropdowns
      const baseOpts = await fetchBaseDropdowns();
      setDropdownOptions(baseOpts);
    } catch (err) {
      console.error("[CO] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Company configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchBaseDropdowns]);

  // Refresh child dropdowns when a parent value changes.
  // parentColName and formValues both use lowercase keys (PG colnames).
  const refreshDropdownOptions = useCallback(
    async (parentColName, formValues = {}) => {
      const children = CO_CASCADE_REFRESH_LC[parentColName] ?? [];
      if (!children.length) return;

      const patches = {};
      for (const childCol of children) {
        const binding = CO_PARENT_BINDINGS_LC[childCol];
        if (!binding) continue;
        const parentId = Number(formValues[binding.parentCol]) || 0;
        if (!parentId) {
          patches[childCol] = [];
          continue;
        }
        if (binding.sp === "state") {
          const table = await fetchSpTable(get, CO_CONFIG.SP_STATE, { prmCountryID: parentId });
          patches[childCol] = mapStateOptions(table);
        } else if (binding.sp === "city") {
          const table = await fetchSpTable(get, CO_CONFIG.SP_CITY, { prmStateID: parentId });
          patches[childCol] = mapCityOptions(table);
        }
      }

      if (Object.keys(patches).length) {
        setDropdownOptions((prev) => ({ ...prev, ...patches }));
      }
    },
    [get]
  );

  // Load all cascaded dropdowns at once for a given set of form values (edit mode).
  const loadCascadedDropdowns = useCallback(
    async (values = {}) => {
      const patches = {};
      const countryId = Number(values.countryid) || 0;
      const stateId = Number(values.stateid) || 0;
      const resCountryId = Number(values.respersoncountryid) || 0;
      const resStateId = Number(values.respersonstateid) || 0;

      if (countryId) {
        const t = await fetchSpTable(get, CO_CONFIG.SP_STATE, { prmCountryID: countryId });
        patches.stateid = mapStateOptions(t);
      }
      if (stateId) {
        const t = await fetchSpTable(get, CO_CONFIG.SP_CITY, { prmStateID: stateId });
        patches.cityid = mapCityOptions(t);
      }
      if (resCountryId) {
        const t = await fetchSpTable(get, CO_CONFIG.SP_STATE, { prmCountryID: resCountryId });
        patches.respersonstateid = mapStateOptions(t);
      }
      if (resStateId) {
        const t = await fetchSpTable(get, CO_CONFIG.SP_CITY, { prmStateID: resStateId });
        patches.respersoncityid = mapCityOptions(t);
      }

      if (Object.keys(patches).length) {
        setDropdownOptions((prev) => ({ ...prev, ...patches }));
      }
    },
    [get]
  );

  // PG returns lowercase column names — spread master directly as headerValues.
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
      const master = mstRes?.[0] ?? null;
      return {
        master,
        headerValues: master ? {
          ...master,
          yearid: Number(master.yearid ?? yearId) || CO_CONFIG.CONFIG_YEAR_ID,
          loginid: Number(master.loginid ?? loginId) || DEFAULT_LOGIN_ID,
          sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
          funccode: master.funccode ?? CO_CONFIG.RB_MASTER,
        } : null,
      };
    },
    [get]
  );

  const fetchListRows = useCallback(async (listParams) => {
    const res = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
    return Array.isArray(res) ? res : (res ?? res ?? []);
  }, [get]);

  // After loading an edit record: reload base dropdowns, then seed cascaded
  // state/city options from the master's stored IDs.
  const seedOptionsFromMaster = useCallback(
    async (master) => {
      if (!master) return;
      const baseOpts = await fetchBaseDropdowns();
      setDropdownOptions(baseOpts);
      // Load cascaded dropdowns using lowercase PG keys from master
      await loadCascadedDropdowns({
        countryid: master.countryid ?? master.CountryID,
        stateid: master.stateid ?? master.StateID,
        respersoncountryid: master.respersoncountryid ?? master.ResPersonCountryID,
        respersonstateid: master.respersonstateid ?? master.ResPersonStateID,
      });
    },
    [fetchBaseDropdowns, loadCascadedDropdowns]
  );

  return {
    headerColumns,
    allColumns,
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
