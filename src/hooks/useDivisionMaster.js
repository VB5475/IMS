import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { DV_CONFIG, DV_CASCADE_DROPDOWN_REFRESH } from "../pages/division-master/constants";

// ---------------------------------------------------------------------------
// Dual-case normalization — PG returns lowercase; MasterFormField needs PascalCase
// ---------------------------------------------------------------------------
function normalizeColumn(col) {
  const colname               = col.colname               ?? "";
  const colseqno              = col.colseqno              ?? 999;
  const isvisible             = col.isvisible             ?? false;
  const colctrltype           = col.colctrltype           ?? 0;
  const updatekeycolname      = col.updatekeycolname      ?? "";
  const displayname           = col.displayname           ?? colname;
  const iseditallow           = col.iseditallow           ?? false;
  const islockoneditmodeallow = col.islockoneditmodeallow ?? false;
  const objdetid              = col.objdetid              ?? null;
  const ismandatory           = col.ismandatory           ?? false;
  const coldatatype           = col.coldatatype           ?? null;
  const ctrlvaluecol          = col.ctrlvaluecol          ?? colname;
  const ctrldisplaycol        = col.ctrldisplaycol        ?? colname;
  return {
    ...col,
    colname, colseqno, isvisible, colctrltype, updatekeycolname,
    displayname, iseditallow, islockoneditmodeallow, objdetid,
    ismandatory, coldatatype, ctrlvaluecol, ctrldisplaycol,
    ColName:               colname,
    ColSeqNo:              colseqno,
    IsVisible:             isvisible,
    ColCtrlType:           colctrltype,
    UpdateKeyColName:      updatekeycolname,
    DisplayName:           displayname,
    IsEditAllow:           iseditallow,
    IsLockOnEditModeAllow: islockoneditmodeallow,
    ObjDetID:              objdetid,
    IsMandatory:           ismandatory,
    ColDataType:           coldatatype,
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
function mapYearOptions(table) {
  return mapIdNameOptions(
    table,
    ["idnumber"],
    ["year_name"]
  );
}
function mapDivisionTypeOptions(table) {
  return mapIdNameOptions(
    table,
    ["divisiontypeid", "DivisionTypeID", "idnumber", "IDNumber", "Idnumber"],
    ["divisiontypename", "DivisionTypeName", "name", "Name"]
  );
}
function mapHeadNameOptions(table) {
  return mapIdNameOptions(
    table,
    ["idnumber", "IDNumber", "userid", "UserID"],
    ["username", "UserName", "name", "Name"]
  );
}
function mapOfficeOptions(table) {
  return mapIdNameOptions(
    table,
    ["officeid", "OfficeID", "idnumber", "IDNumber", "Idnumber"],
    ["officename", "OfficeName", "name", "Name"]
  );
}

// ---------------------------------------------------------------------------
// SP fetch helper — handles PG flat array + legacy Table/Links wrapper
// ---------------------------------------------------------------------------
async function fetchSpTable(get, spName, jsonRow = {}) {
  const res = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType:   DV_CONFIG.LIST_OBJ_TYPE,
    ObjName:   spName,
    JSon:      JSON.stringify([jsonRow]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  }).catch((err) => {
    console.warn(`[DV] ${spName} fetch failed:`, err);
    return null;
  });
  return Array.isArray(res) ? res : (res ?? res ?? []);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useDivisionMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns,   setHeaderColumns]   = useState([]);
  const [allColumns,      setAllColumns]      = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching,  setHeaderFetching]  = useState(false);
  const [headerError,     setHeaderError]     = useState(null);

  // Fetch the dropdowns that don't depend on a parent value: Country, Opening
  // Year, Division Type, Head Name, Office. State/City stay empty until cascaded.
  const fetchBaseDropdowns = useCallback(async () => {
    const [countryTable, yearTable, divTypeTable, headTable, officeTable] = await Promise.all([
      fetchSpTable(get, DV_CONFIG.SP_COUNTRY, {}),
      fetchSpTable(get, DV_CONFIG.SP_YEAR, {}),
      fetchSpTable(get, DV_CONFIG.SP_DIVISION_TYPE, {}),
      fetchSpTable(get, DV_CONFIG.SP_HEAD_NAME, {}),
      fetchSpTable(get, DV_CONFIG.SP_OFFICE, {}),
    ]);
    return {
      countryid:      mapCountryOptions(countryTable),
      stateid:        [],
      cityid:         [],
      openingyearid:  mapYearOptions(yearTable),
      divisiontypeid: mapDivisionTypeOptions(divTypeTable),
      headnameid:     mapHeadNameOptions(headTable),
      officeid:       mapOfficeOptions(officeTable),
    };
  }, [get]);

  // Manual refresh for a base (non-cascading) dropdown — e.g. the "refresh"
  // icon next to Head Name, or after its quick-add (User Master) modal saves.
  // Re-fetches the whole base bundle (cheap, same SPs as initial load) and
  // merges over State/City so an in-progress cascade selection isn't wiped.
  const refreshBaseDropdowns = useCallback(async () => {
    const baseOpts = await fetchBaseDropdowns();
    setDropdownOptions((prev) => ({ ...prev, ...baseOpts, stateid: prev.stateid, cityid: prev.cityid }));
    return baseOpts;
  }, [fetchBaseDropdowns]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType:   2,
        ObjName:   DV_CONFIG.SP_RB_META,
        JSon:      JSON.stringify([{ prmrbcode: DV_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg:  "",
      });
      const tableRow = metaData?.[0];
      const rbidVal  = tableRow?.rbid ?? tableRow?.RBID;
      if (!rbidVal) throw new Error("No Division Master RB metadata returned.");

      const hdrMeta = {
        RBID:         rbidVal,
        SaveProcName: tableRow.saveprocname ?? tableRow.SaveProcName,
      };
      localStorage.setItem(DV_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions
      const colData  = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  getUserSession().loginId,
      });
      const rawLinks = Array.isArray(colData) ? colData : (colData || []);
      const links    = rawLinks.map(normalizeColumn);
      setHeaderColumns(links);
      setAllColumns(links.map((c) => ({ key: c.colname, colDataType: c.coldatatype ?? null })));

      // Phase 3 — manual SP calls for the non-cascading base dropdowns
      const baseOpts = await fetchBaseDropdowns();
      setDropdownOptions(baseOpts);
    } catch (err) {
      console.error("[DV] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Division Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchBaseDropdowns]);

  // Refresh State/City when Country/State change. parentColName + formValues are lowercase.
  const refreshDropdownOptions = useCallback(
    async (parentColName, formValues = {}) => {
      const children = DV_CASCADE_DROPDOWN_REFRESH[parentColName] ?? [];
      if (!children.length) return;

      const patches = {};
      for (const childCol of children) {
        if (childCol === "stateid") {
          const countryId = Number(formValues.countryid) || 0;
          if (!countryId) { patches.stateid = []; continue; }
          const table = await fetchSpTable(get, DV_CONFIG.SP_STATE, { prmCountryID: countryId });
          patches.stateid = mapStateOptions(table);
        } else if (childCol === "cityid") {
          const stateId = Number(formValues.stateid) || 0;
          if (!stateId) { patches.cityid = []; continue; }
          const table = await fetchSpTable(get, DV_CONFIG.SP_CITY, { prmStateID: stateId });
          patches.cityid = mapCityOptions(table);
        }
      }

      if (Object.keys(patches).length) {
        setDropdownOptions((prev) => ({ ...prev, ...patches }));
      }
    },
    [get]
  );

  // Load State/City cascade in one shot for a given set of form values (edit mode).
  const loadCascadedDropdowns = useCallback(
    async (values = {}) => {
      const patches = {};
      const countryId = Number(values.countryid) || 0;
      const stateId   = Number(values.stateid)   || 0;

      if (countryId) {
        const t = await fetchSpTable(get, DV_CONFIG.SP_STATE, { prmCountryID: countryId });
        patches.stateid = mapStateOptions(t);
      }
      if (stateId) {
        const t = await fetchSpTable(get, DV_CONFIG.SP_CITY, { prmStateID: stateId });
        patches.cityid = mapCityOptions(t);
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
      const session = getUserSession();
      const prmParameters = [
        Number(companyId)  || session.companyId,
        Number(yearId)     || session.yearId,
        Number(loginId)    || session.loginId,
        Number(sessionId)  || DEFAULT_SESSION_ID,
        Number(idNumber)   || 0,
      ].join(",");

      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: DV_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode:  DV_CONFIG.RB_MASTER,
      });
      const master = mstRes?.[0] ?? null;
      return {
        master,
        headerValues: master ? {
          ...master,
          yearid:    Number(master.yearid    ?? yearId)    || session.yearId,
          loginid:   Number(master.loginid   ?? loginId)   || session.loginId,
          sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
          funccode:  master.funccode ?? DV_CONFIG.RB_MASTER,
        } : null,
      };
    },
    [get]
  );

  const fetchListRows = useCallback(async (listParams) => {
    const res = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
    return Array.isArray(res) ? res : (res ?? res ?? []);
  }, [get]);

  // After loading an edit record: reload base dropdowns, then seed the State/City
  // cascade from the master's stored Country/State IDs.
  const seedOptionsFromMaster = useCallback(
    async (master) => {
      if (!master) return;
      const baseOpts = await fetchBaseDropdowns();
      setDropdownOptions(baseOpts);
      await loadCascadedDropdowns({
        countryid: master.countryid ?? master.CountryID,
        stateid:   master.stateid   ?? master.StateID,
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
    refreshBaseDropdowns,
    refreshDropdownOptions,
    seedOptionsFromMaster,
  };
}
