import { useState, useCallback, useRef } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { MCR_CONFIG } from "../pages/complaint-register/constants";
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
  isVisibleApiCol,
  hasVisibleCol,
} from "../utils/gridUtils";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId) || DEFAULT_COMPANY_ID,
    Number(yearId) || MCR_CONFIG.CONFIG_YEAR_ID,
    Number(loginId) || getUserSession().loginId,
    Number(sessionId) || DEFAULT_SESSION_ID,
    Number(idNumber) || 0,
  ].join(",");
}

function toDateInput(value) {
  if (!value) return "";
  if (typeof value === "string" && value.includes("T")) return value.split("T")[0];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function mapMasterRowToHeaderValues(master) {
  return {
    ...master,
    trandate: toDateInput(master.trandate ?? master.TranDate),
    yearid: MCR_CONFIG.CONFIG_YEAR_ID,
    funccode: MCR_CONFIG.RB_MASTER,
    loginid: getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
    frmtype: MCR_CONFIG.FRM_TYPE,
  };
}

function mapDetailRowsToGridRows(rows) {
  return (rows || []).map((row, index) => ({
    ...row,
    id: String(row.compuniquekey ?? row.idnumber ?? row.masterid ?? `edit_${index}`),
  }));
}

function buildEventColumnSet(apiColumns, fallbackKeys = []) {
  const set = new Set();
  apiColumns.forEach((col) => {
    if (isTruthyApiFlag(col.iseventreq) || isTruthyApiFlag(col.iseventcol)) {
      set.add(col.colname);
    }
  });
  if (set.size === 0) fallbackKeys.forEach((k) => set.add(k));
  return set;
}

function mapDivisionRows(rows) {
  return (rows || []).map((r) => ({
    value: String(r.divisionid ?? r.DivisionID ?? r.fromdivisionid ?? r.FromDivisionID ?? 0),
    label: String(r.division ?? r.Division ?? r.divisionname ?? r.fromdivision ?? ""),
  }));
}

function mapLocationRows(rows) {
  return (rows || []).map((r) => ({
    value: String(r.fromlocationid ?? r.FromLocationID ?? r.locationid ?? r.LocationID ?? 0),
    label: String(r.fromlocation ?? r.FromLocation ?? r.locationname ?? r.LocationName ?? ""),
  }));
}

function mapDeptRows(rows) {
  return (rows || []).map((r) => ({
    value: String(r.deptid ?? r.DeptID ?? r.departmentid ?? 0),
    label: String(r.dept ?? r.deptname ?? r.department ?? r.DeptName ?? ""),
  }));
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: MCR_CONFIG.SP_RB_META,
    JSon: JSON.stringify([{ prmRBCode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  });
  const tableRow = metaData?.[0];
  if (!tableRow) throw new Error(`No RB metadata returned for ${rbCode}.`);

  const meta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
  localStorage.setItem(storageKey, JSON.stringify(meta));

  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID: DEFAULT_LOGIN_ID,
  });
  return { meta, apiColumns: colData || [] };
}

export function useMntComplaint(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [configOptions, setConfigOptions] = useState([]);

  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  const divisionFetchJson = useCallback(
    () => JSON.stringify([{
      prmuserid: DEFAULT_LOGIN_ID,
      prmcompanyid: DEFAULT_COMPANY_ID,
      prmyearid: MCR_CONFIG.DIVISION_YEAR_ID,
    }]),
    []
  );

  const locationFetchJson = useCallback(
    () => JSON.stringify([{
      prmcompanyid: DEFAULT_COMPANY_ID,
      prmloginid: DEFAULT_LOGIN_ID,
      prmlocationtype: "",
    }]),
    []
  );

  const deptFetchJson = useCallback(
    () => JSON.stringify([{
      prmcompanyid: DEFAULT_COMPANY_ID,
      prmloginid: DEFAULT_LOGIN_ID,
    }]),
    []
  );

  const fetchDivisions = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: MCR_CONFIG.SP_DIVISION,
        JSon: divisionFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapDivisionRows(res);
      setDivisionOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[MCR] Division fetch failed:", err);
      setDivisionOptions([]);
      return [];
    }
  }, [get, divisionFetchJson]);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: MCR_CONFIG.SP_FROM_LOCATION,
        JSon: locationFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapLocationRows(res);
      setLocationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[MCR] Location fetch failed:", err);
      setLocationOptions([]);
      return [];
    }
  }, [get, locationFetchJson]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: MCR_CONFIG.SP_DEPARTMENT,
        JSon: deptFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapDeptRows(res);
      setDepartmentOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[MCR] Department fetch failed:", err);
      setDepartmentOptions([]);
      return [];
    }
  }, [get, deptFetchJson]);

  const fetchConfigOptions = useCallback(async (divisionId = 0) => {
    const resolvedDivisionId = Number(divisionId) || 0;
    if (!resolvedDivisionId) {
      setConfigOptions([]);
      return [];
    }
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: MCR_CONFIG.SP_CONFIG,
        JSon: JSON.stringify([{
          prmcompanyid: DEFAULT_COMPANY_ID,
          prmdivisionid: resolvedDivisionId,
          prmyearid: MCR_CONFIG.CONFIG_YEAR_ID,
          prmuserid: DEFAULT_LOGIN_ID,
          prmformtag: MCR_CONFIG.CONFIG_FORM_TAG,
          prmreftype: MCR_CONFIG.CONFIG_REF_TYPE,
          prmref_mstid: 0,
          prmref_detid: 0,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(
          r.configurationid ?? r.ConfigurationId ?? r.configid ?? r.idnumber ?? r.IDNumber ?? 0
        ),
        label:
          r.name
          ?? r.Name
          ?? r.configname
          ?? r.ConfigName
          ?? String(r.configurationid ?? r.ConfigurationId ?? ""),
      }));
      setConfigOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[MCR] Config fetch failed:", err);
      setConfigOptions([]);
      return [];
    }
  }, [get]);

  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: MCR_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: MCR_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Complaint Register header RB metadata returned.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(MCR_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const cols = colData || [];
      setHeaderColumns(cols);

      if (skipListDropdowns) {
        setDivisionOptions([]);
        setLocationOptions([]);
        setDepartmentOptions([]);
        setConfigOptions([]);
        return;
      }

      const tasks = [];
      if (hasVisibleCol(cols, "divisionid")) tasks.push(fetchDivisions());
      if (hasVisibleCol(cols, "fromlocationid")) tasks.push(fetchLocations());
      if (hasVisibleCol(cols, "deptid")) tasks.push(fetchDepartments());
      await Promise.all(tasks);
    } catch (err) {
      console.error("[MCR] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Complaint Register configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchDivisions, fetchLocations, fetchDepartments]);

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        MCR_CONFIG.RB_DETAIL,
        MCR_CONFIG.STORAGE_ENTRY_META
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;

      const evtSet = buildEventColumnSet(apiColumns, []);
      setEventColumns(evtSet);

      setAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
    } catch (err) {
      console.error("[MCR] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load item grid configuration.");
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  const fetchGridColumns = useCallback(async (divisionID = 0, editOpts = false) => {
    const opts = typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
    const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;
    const apiColumns = rawDetailColumnsRef.current;
    const meta = rawDetailRbMetaRef.current;
    if (!apiColumns.length || !meta) return [];

    try {
      const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
        funcCode: MCR_CONFIG.RB_DETAIL,
        divisionID: Number(divisionID) || 0,
        existingRecordEdit,
        rowData: masterRow,
        fetchUnlockedDropdowns,
      });
      const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
        filterable: false,
        allEditable: true,
        existingRecordEdit,
      });
      setColumns(gridColumns);
      return gridColumns;
    } catch (err) {
      console.error("[MCR] fetchGridColumns failed:", err);
      return [];
    }
  }, [get]);

  const seedOptionsFromMaster = useCallback((master) => {
    const seedOne = (id, label, setter) => {
      if (id != null && id !== 0 && label) setter([{ value: String(id), label: String(label) }]);
    };
    seedOne(
      master.divisionid ?? master.DivisionID,
      master.division ?? master.divisionname ?? master.Division,
      setDivisionOptions
    );
    seedOne(
      master.fromlocationid ?? master.FromLocationID,
      master.fromlocation ?? master.fromlocationname ?? master.locationname,
      setLocationOptions
    );
    seedOne(
      master.deptid ?? master.DeptID,
      master.dept ?? master.deptname ?? master.department,
      setDepartmentOptions
    );
    seedOne(
      master.configid ?? master.ConfigID ?? master.configurationid ?? master.ConfigurationId,
      master.configname ?? master.ConfigName ?? master.name ?? master.Name,
      setConfigOptions
    );
  }, []);

  const fetchUnlockedHeaderDropdowns = useCallback(async (headerValues = {}) => {
    if (!headerColumns.length) return;
    const needsCol = (...names) =>
      headerColumns.some((c) => {
        const key = String(c.colname).toLowerCase();
        return names.some((n) => key === String(n).toLowerCase())
          && isVisibleApiCol(c)
          && isTruthyApiFlag(c.iseditallow)
          && !isLockOnEditModeCol(c);
      });

    const divId = headerValues.divisionid ?? 0;
    const tasks = [];
    if (needsCol("divisionid")) tasks.push(fetchDivisions());
    if (needsCol("fromlocationid")) tasks.push(fetchLocations());
    if (needsCol("deptid")) tasks.push(fetchDepartments());
    if (needsCol("configid")) tasks.push(fetchConfigOptions(divId));
    await Promise.all(tasks);
  }, [headerColumns, fetchDivisions, fetchLocations, fetchDepartments, fetchConfigOptions]);

  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
    const [mstRes, detRes] = await Promise.all([
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: MCR_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: MCR_CONFIG.RB_MASTER,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: MCR_CONFIG.SP_DETAIL_FILL,
        prmParameters,
        prmFuncCode: MCR_CONFIG.RB_DETAIL,
      }),
    ]);

    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? mapMasterRowToHeaderValues(master) : null,
      details: mapDetailRowsToGridRows(detRes || []),
    };
  }, [get]);

  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    headerColumns,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    divisionOptions,
    locationOptions,
    departmentOptions,
    configOptions,
    fetchDivisions,
    fetchLocations,
    fetchDepartments,
    fetchConfigOptions,
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    fetchEditRecord,
    seedOptionsFromMaster,
    fetchUnlockedHeaderDropdowns,
    saveError,
    clearSaveError,
  };
}
