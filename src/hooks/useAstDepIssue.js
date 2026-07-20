import { useState, useCallback, useRef } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { ADI_CONFIG } from "../pages/assets-department-issue/constants";
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
  isVisibleApiCol,
  hasVisibleCol,
} from "../utils/gridUtils";

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
    issuedate: toDateInput(master.issuedate ?? master.IssueDate) || toDateInput(master.trandate),
    expecteddate: toDateInput(master.expecteddate ?? master.ExpectedDate) || null,
    yearid: getUserSession().yearId,
    funccode: ADI_CONFIG.RB_MASTER,
    loginid: getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
    frmtype: ADI_CONFIG.FRM_TYPE,
    issuetypeid: ADI_CONFIG.ISSUE_TYPE_ID,
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
    value: String(r.fromdivisionid ?? r.FromDivisionID ?? r.divisionid ?? 0),
    label: String(r.fromdivision ?? r.FromDivision ?? r.divisionname ?? ""),
  }));
}

function mapLocationRows(rows, valueKey = "locationid", labelKey = "locationname") {
  return (rows || []).map((r) => ({
    value: String(r[valueKey] ?? r.LocationID ?? r.locationid ?? 0),
    label: String(r[labelKey] ?? r.LocationName ?? r.locationname ?? ""),
  }));
}

function mapDeptRows(rows, side = "from") {
  const prefix = side === "to" ? "to" : "from";
  return (rows || []).map((r) => ({
    value: String(
      r[`${prefix}deptid`]
      ?? r[`${prefix}departmentid`]
      ?? r.DeptID
      ?? r.deptid
      ?? 0
    ),
    label: String(
      r[`${prefix}dept`]
      ?? r[`${prefix}deptname`]
      ?? r[`${prefix}department`]
      ?? r.DeptName
      ?? r.deptname
      ?? ""
    ),
  }));
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: ADI_CONFIG.SP_RB_META,
    JSon: JSON.stringify([{ prmrbcode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  });
  const tableRow = metaData?.[0];
  if (!tableRow) throw new Error(`No RB metadata returned for ${rbCode}.`);

  const meta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
  localStorage.setItem(storageKey, JSON.stringify(meta));

  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID: getUserSession().loginId,
  });
  return { meta, apiColumns: colData || [] };
}

export function useAstDepIssue(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [fromDivisionOptions, setFromDivisionOptions] = useState([]);
  const [fromLocationOptions, setFromLocationOptions] = useState([]);
  const [toLocationOptions, setToLocationOptions] = useState([]);
  const [fromDepartmentOptions, setFromDepartmentOptions] = useState([]);
  const [toDepartmentOptions, setToDepartmentOptions] = useState([]);
  const [configOptions, setConfigOptions] = useState([]);

  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  const divisionFetchJson = useCallback(() => {
    const session = getUserSession();
    return JSON.stringify([{
      prmuserid: session.loginId,
      prmcompanyid: session.companyId,
      prmyearid: session.yearId,
    }]);
  }, []);

  const locationFetchJson = useCallback(() => {
    const session = getUserSession();
    return JSON.stringify([{
      prmcompanyid: session.companyId,
      prmloginid: session.loginId,
      prmlocationtype: "",
    }]);
  }, []);

  const deptFetchJson = useCallback(() => {
    const session = getUserSession();
    return JSON.stringify([{ prmdeptid: 0, prmloginid: session.loginId }]);
  }, []);

  const fetchFromDivisions = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: ADI_CONFIG.SP_FROM_DIVISION,
        JSon: divisionFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapDivisionRows(res);
      setFromDivisionOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[ADI] Division fetch failed:", err);
      setFromDivisionOptions([]);
      return [];
    }
  }, [get, divisionFetchJson]);

  const fetchFromLocations = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: ADI_CONFIG.SP_FROM_LOCATION,
        JSon: locationFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapLocationRows(res, "fromlocationid", "fromlocation");
      setFromLocationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[ADI] From location fetch failed:", err);
      setFromLocationOptions([]);
      return [];
    }
  }, [get, locationFetchJson]);

  const fetchToLocations = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: ADI_CONFIG.SP_TO_LOCATION,
        JSon: locationFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapLocationRows(res, "tolocationid", "tolocation");
      setToLocationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[ADI] To location fetch failed:", err);
      setToLocationOptions([]);
      return [];
    }
  }, [get, locationFetchJson]);

  const fetchFromDepartments = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: ADI_CONFIG.SP_FROM_DEPT,
        JSon: deptFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapDeptRows(res, "from");
      setFromDepartmentOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[ADI] From department fetch failed:", err);
      setFromDepartmentOptions([]);
      return [];
    }
  }, [get, deptFetchJson]);

  const fetchToDepartments = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: ADI_CONFIG.SP_TO_DEPT,
        JSon: deptFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapDeptRows(res, "to");
      setToDepartmentOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[ADI] To department fetch failed:", err);
      setToDepartmentOptions([]);
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
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: ADI_CONFIG.SP_CONFIG,
        JSon: JSON.stringify([{
          prmcompanyid: session.companyId,
          prmdivisionid: resolvedDivisionId,
          prmyearid: session.yearId,
          prmuserid: session.loginId,
          prmformtag: ADI_CONFIG.CONFIG_FORM_TAG,
          prmreftype: ADI_CONFIG.CONFIG_REF_TYPE,
          prmref_mstid: 0,
          prmref_detid: 0,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.configurationid ?? r.ConfigurationId ?? r.configid ?? r.idnumber ?? r.IDNumber ?? 0),
        label: r.name ?? r.Name ?? r.configname ?? r.ConfigName ?? String(r.configurationid ?? r.ConfigurationId ?? ""),
      }));
      setConfigOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[ADI] Config fetch failed:", err);
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
        ObjName: ADI_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: ADI_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No ADI header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(ADI_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      const cols = colData || [];
      setHeaderColumns(cols);

      if (skipListDropdowns) {
        setFromDivisionOptions([]);
        setFromLocationOptions([]);
        setToLocationOptions([]);
        setFromDepartmentOptions([]);
        setToDepartmentOptions([]);
        setConfigOptions([]);
        return;
      }

      const tasks = [];
      if (hasVisibleCol(cols, "fromdivisionid")) tasks.push(fetchFromDivisions());
      if (hasVisibleCol(cols, "fromlocationid")) tasks.push(fetchFromLocations());
      if (hasVisibleCol(cols, "tolocationid")) tasks.push(fetchToLocations());
      if (hasVisibleCol(cols, "fromdeptid")) tasks.push(fetchFromDepartments());
      if (hasVisibleCol(cols, "todeptid")) tasks.push(fetchToDepartments());
      await Promise.all(tasks);
    } catch (err) {
      console.error("[ADI] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Assets Department Issue configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchFromDivisions, fetchFromLocations, fetchToLocations, fetchFromDepartments, fetchToDepartments]);

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        ADI_CONFIG.RB_DETAIL,
        ADI_CONFIG.STORAGE_ENTRY_META
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;

      const evtSet = buildEventColumnSet(apiColumns, ["qty", "rate"]);
      ["qty", "rate", "Qty", "Rate"].forEach((k) => evtSet.add(k));
      setEventColumns(evtSet);

      setAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
    } catch (err) {
      console.error("[ADI] fetchDetailMeta failed:", err);
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
        funcCode: ADI_CONFIG.RB_DETAIL,
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
      console.error("[ADI] fetchGridColumns failed:", err);
      return [];
    }
  }, [get]);

  const seedOptionsFromMaster = useCallback((master) => {
    const seedOne = (id, label, setter) => {
      if (id != null && id !== 0 && label) setter([{ value: String(id), label: String(label) }]);
    };
    seedOne(master.fromdivisionid, master.fromdivision ?? master.fromdivisionname ?? master.divisionname, setFromDivisionOptions);
    seedOne(master.fromlocationid, master.fromlocation ?? master.fromlocationname ?? master.locationname, setFromLocationOptions);
    seedOne(master.tolocationid, master.tolocation ?? master.tolocationname ?? master.locationname, setToLocationOptions);
    seedOne(master.fromdeptid ?? master.fromdepartmentid, master.fromdept ?? master.fromdepartment ?? master.fromdeptname ?? master.deptname, setFromDepartmentOptions);
    seedOne(master.todeptid ?? master.todepartmentid, master.todept ?? master.todepartment ?? master.todeptname ?? master.deptname, setToDepartmentOptions);
    seedOne(master.configid ?? master.ConfigID ?? master.configurationid ?? master.ConfigurationId, master.configname ?? master.ConfigName ?? master.name ?? master.Name, setConfigOptions);
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

    const fromDiv = headerValues.fromdivisionid ?? 0;
    const tasks = [];
    if (needsCol("fromdivisionid")) tasks.push(fetchFromDivisions());
    if (needsCol("fromlocationid")) tasks.push(fetchFromLocations());
    if (needsCol("tolocationid")) tasks.push(fetchToLocations());
    if (needsCol("fromdeptid")) tasks.push(fetchFromDepartments());
    if (needsCol("todeptid")) tasks.push(fetchToDepartments());
    if (needsCol("configid")) tasks.push(fetchConfigOptions(fromDiv));
    await Promise.all(tasks);
  }, [headerColumns, fetchFromDivisions, fetchFromLocations, fetchToLocations, fetchFromDepartments, fetchToDepartments, fetchConfigOptions]);

  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
    const [mstRes, detRes] = await Promise.all([
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: ADI_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: ADI_CONFIG.RB_MASTER,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: ADI_CONFIG.SP_DETAIL_FILL,
        prmParameters,
        prmFuncCode: ADI_CONFIG.RB_DETAIL,
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
    fromDivisionOptions,
    fromLocationOptions,
    toLocationOptions,
    fromDepartmentOptions,
    toDepartmentOptions,
    configOptions,
    fetchFromDivisions,
    fetchFromLocations,
    fetchToLocations,
    fetchFromDepartments,
    fetchToDepartments,
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
