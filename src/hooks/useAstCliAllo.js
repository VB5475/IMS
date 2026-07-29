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
import { ACA_CONFIG } from "../pages/assets-client-allocation/constants";
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
    Number(yearId) || ACA_CONFIG.CONFIG_YEAR_ID,
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
    issuedate: toDateInput(master.issuedate ?? master.IssueDate) || toDateInput(master.trandate),
    yearid: ACA_CONFIG.CONFIG_YEAR_ID,
    funccode: ACA_CONFIG.RB_MASTER,
    loginid: getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
    frmtype: ACA_CONFIG.FRM_TYPE,
    issuetypeid: ACA_CONFIG.ISSUE_TYPE_ID,
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

function mapLocationRows(rows, valueKey, labelKey) {
  return (rows || []).map((r) => ({
    value: String(r[valueKey] ?? r.LocationID ?? r.locationid ?? 0),
    label: String(r[labelKey] ?? r.LocationName ?? r.locationname ?? ""),
  }));
}

function mapDeptRows(rows) {
  return (rows || []).map((r) => ({
    value: String(
      r.todeptid
      ?? r.todepartmentid
      ?? r.DeptID
      ?? r.deptid
      ?? 0
    ),
    label: String(
      r.todept
      ?? r.todeptname
      ?? r.todepartment
      ?? r.DeptName
      ?? r.deptname
      ?? ""
    ),
  }));
}

function mapWorkingClientRows(rows) {
  return (rows || []).map((r) => ({
    value: String(
      r.toworkingclientid
      ?? r.ToWorkingClientID
      ?? r.workingclientid
      ?? r.clientid
      ?? 0
    ),
    label: String(
      r.toworkingclient
      ?? r.toworkingclientname
      ?? r.clientname
      ?? r.workingclientname
      ?? ""
    ),
  }));
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: ACA_CONFIG.SP_RB_META,
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

export function useAstCliAllo(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [fromDivisionOptions, setFromDivisionOptions] = useState([]);
  const [toLocationOptions, setToLocationOptions] = useState([]);
  const [toDepartmentOptions, setToDepartmentOptions] = useState([]);
  const [toClientOptions, setToClientOptions] = useState([]);
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
      prmyearid: ACA_CONFIG.DIVISION_YEAR_ID,
    }]),
    []
  );

  const locationFetchJson = useCallback(
    (divisionId = 0) => JSON.stringify([{
      prmcompanyid: DEFAULT_COMPANY_ID,
      prmdivisionid: Number(divisionId) || 0,
      prmloginid: DEFAULT_LOGIN_ID,
      prmlocationtype: "",
      prmfrmtype: String(ACA_CONFIG.FRM_TYPE),
    }]),
    []
  );

  const deptFetchJson = useCallback(
    () => JSON.stringify([{ prmdeptid: 0, prmloginid: DEFAULT_LOGIN_ID }]),
    []
  );

  const fetchFromDivisions = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: ACA_CONFIG.SP_FROM_DIVISION,
        JSon: divisionFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapDivisionRows(res);
      setFromDivisionOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[ACA] Division fetch failed:", err);
      setFromDivisionOptions([]);
      return [];
    }
  }, [get, divisionFetchJson]);

  const fetchToLocations = useCallback(async (divisionId = 0) => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: ACA_CONFIG.SP_TO_LOCATION,
        JSon: locationFetchJson(divisionId),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapLocationRows(res, "tolocationid", "tolocation");
      setToLocationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[ACA] To location fetch failed:", err);
      setToLocationOptions([]);
      return [];
    }
  }, [get, locationFetchJson]);

  const fetchToDepartments = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: ACA_CONFIG.SP_TO_DEPT,
        JSon: deptFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapDeptRows(res);
      setToDepartmentOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[ACA] To department fetch failed:", err);
      setToDepartmentOptions([]);
      return [];
    }
  }, [get, deptFetchJson]);

  const fetchToWorkingClients = useCallback(async (divisionId = 0) => {
    const resolvedDivisionId = Number(divisionId) || 0;
    if (!resolvedDivisionId) {
      setToClientOptions([]);
      return [];
    }
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: ACA_CONFIG.SP_TO_WORKING_CLIENT,
        JSon: JSON.stringify([{
          prmcompanyid: DEFAULT_COMPANY_ID,
          prmdivisionid: resolvedDivisionId,
          prmissuetypeid: ACA_CONFIG.ISSUE_TYPE_ID,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapWorkingClientRows(res || []);
      setToClientOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[ACA] To working client fetch failed:", err);
      setToClientOptions([]);
      return [];
    }
  }, [get]);

  const fetchConfigOptions = useCallback(async (divisionId = 0) => {
    const resolvedDivisionId = Number(divisionId) || 0;
    if (!resolvedDivisionId) {
      setConfigOptions([]);
      return [];
    }
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: ACA_CONFIG.SP_CONFIG,
        JSon: JSON.stringify([{
          prmcompanyid: DEFAULT_COMPANY_ID,
          prmdivisionid: resolvedDivisionId,
          prmyearid: ACA_CONFIG.CONFIG_YEAR_ID,
          prmuserid: DEFAULT_LOGIN_ID,
          prmformtag: ACA_CONFIG.CONFIG_FORM_TAG,
          prmreftype: ACA_CONFIG.CONFIG_REF_TYPE,
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
      console.warn("[ACA] Config fetch failed:", err);
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
        ObjName: ACA_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: ACA_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Assets Client Allocation header RB metadata returned.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(ACA_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const cols = colData || [];
      setHeaderColumns(cols);

      if (skipListDropdowns) {
        setFromDivisionOptions([]);
        setToLocationOptions([]);
        setToDepartmentOptions([]);
        setToClientOptions([]);
        setConfigOptions([]);
        return;
      }

      const tasks = [];
      if (hasVisibleCol(cols, "fromdivisionid")) tasks.push(fetchFromDivisions());
      if (hasVisibleCol(cols, "tolocationid")) tasks.push(fetchToLocations());
      if (hasVisibleCol(cols, "todeptid")) tasks.push(fetchToDepartments());
      await Promise.all(tasks);
    } catch (err) {
      console.error("[ACA] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Assets Client Allocation configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchFromDivisions, fetchToLocations, fetchToDepartments]);

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        ACA_CONFIG.RB_DETAIL,
        ACA_CONFIG.STORAGE_ENTRY_META
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;

      const evtSet = buildEventColumnSet(apiColumns, ["qty", "rate"]);
      ["qty", "rate", "Qty", "Rate"].forEach((k) => evtSet.add(k));
      setEventColumns(evtSet);

      setAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
    } catch (err) {
      console.error("[ACA] fetchDetailMeta failed:", err);
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
        funcCode: ACA_CONFIG.RB_DETAIL,
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
      console.error("[ACA] fetchGridColumns failed:", err);
      return [];
    }
  }, [get]);

  const seedOptionsFromMaster = useCallback((master) => {
    const seedOne = (id, label, setter) => {
      if (id != null && id !== 0 && label) setter([{ value: String(id), label: String(label) }]);
    };
    seedOne(
      master.fromdivisionid,
      master.fromdivision ?? master.fromdivisionname ?? master.divisionname,
      setFromDivisionOptions
    );
    seedOne(
      master.tolocationid,
      master.tolocation ?? master.tolocationname ?? master.locationname,
      setToLocationOptions
    );
    seedOne(
      master.todeptid ?? master.todepartmentid,
      master.todept ?? master.todepartment ?? master.todeptname ?? master.deptname,
      setToDepartmentOptions
    );
    seedOne(
      master.toworkingclientid,
      master.toworkingclient ?? master.toworkingclientname ?? master.clientname,
      setToClientOptions
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

    const fromDiv = headerValues.fromdivisionid ?? 0;
    const tasks = [];
    if (needsCol("fromdivisionid")) tasks.push(fetchFromDivisions());
    if (needsCol("tolocationid")) tasks.push(fetchToLocations(fromDiv));
    if (needsCol("todeptid")) tasks.push(fetchToDepartments());
    if (needsCol("toworkingclientid") && fromDiv) tasks.push(fetchToWorkingClients(fromDiv));
    if (needsCol("configid")) tasks.push(fetchConfigOptions(fromDiv));
    await Promise.all(tasks);
  }, [
    headerColumns,
    fetchFromDivisions,
    fetchToLocations,
    fetchToDepartments,
    fetchToWorkingClients,
    fetchConfigOptions,
  ]);

  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
    const [mstRes, detRes] = await Promise.all([
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: ACA_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: ACA_CONFIG.RB_MASTER,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: ACA_CONFIG.SP_DETAIL_FILL,
        prmParameters,
        prmFuncCode: ACA_CONFIG.RB_DETAIL,
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
    toLocationOptions,
    toDepartmentOptions,
    toClientOptions,
    configOptions,
    fetchFromDivisions,
    fetchToLocations,
    fetchToDepartments,
    fetchToWorkingClients,
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
