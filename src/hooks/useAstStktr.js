import { useState, useCallback, useRef } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { AST_CONFIG } from "../pages/assets-stock-transfer/constants";
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
    yearid: getUserSession().yearId,
    funccode: AST_CONFIG.RB_MASTER,
    loginid: getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
    frmtype: AST_CONFIG.FRM_TYPE,
    issuetypeid: AST_CONFIG.ISSUE_TYPE_ID,
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

function mapFromDivisionRows(rows) {
  return (rows || []).map((r) => ({
    value: String(r.fromdivisionid ?? r.FromDivisionID ?? r.divisionid ?? 0),
    label: String(r.fromdivision ?? r.FromDivision ?? r.divisionname ?? ""),
  }));
}

function mapToDivisionRows(rows) {
  return (rows || []).map((r) => ({
    value: String(r.todivisionid ?? r.ToDivisionID ?? r.divisionid ?? 0),
    label: String(r.todivision ?? r.ToDivision ?? r.divisionname ?? ""),
  }));
}

function mapLocationRows(rows, valueKeys, labelKeys) {
  return (rows || []).map((r) => {
    const value = valueKeys.map((k) => r[k]).find((v) => v != null && v !== "");
    const label = labelKeys.map((k) => r[k]).find((v) => v != null && v !== "");
    return {
      value: String(value ?? 0),
      label: String(label ?? ""),
    };
  });
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: AST_CONFIG.SP_RB_META,
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

export function useAstStktr(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [fromDivisionOptions, setFromDivisionOptions] = useState([]);
  const [toDivisionOptions, setToDivisionOptions] = useState([]);
  const [fromLocationOptions, setFromLocationOptions] = useState([]);
  const [toLocationOptions, setToLocationOptions] = useState([]);
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
      prmuserid: getUserSession().loginId,
      prmcompanyid: getUserSession().companyId,
      prmyearid: getUserSession().yearId,
    }]),
    []
  );

  const locationFetchJson = useCallback(
    (divisionId = 0) => JSON.stringify([{
      prmcompanyid: getUserSession().companyId,
      prmdivisionid: Number(divisionId) || 0,
      prmloginid: getUserSession().loginId,
      prmlocationtype: "",
      prmfrmtype: String(AST_CONFIG.FRM_TYPE),
    }]),
    []
  );

  const fetchFromDivisions = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AST_CONFIG.SP_FROM_DIVISION,
        JSon: divisionFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapFromDivisionRows(res);
      setFromDivisionOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[AST] From division fetch failed:", err);
      setFromDivisionOptions([]);
      return [];
    }
  }, [get, divisionFetchJson]);

  const fetchToDivisions = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AST_CONFIG.SP_TO_DIVISION,
        JSon: divisionFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapToDivisionRows(res);
      setToDivisionOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[AST] To division fetch failed:", err);
      setToDivisionOptions([]);
      return [];
    }
  }, [get, divisionFetchJson]);

  const fetchFromLocations = useCallback(async (divisionId = 0) => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AST_CONFIG.SP_FROM_LOCATION,
        JSon: locationFetchJson(divisionId),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapLocationRows(
        res,
        ["fromlocationid", "FromLocationID", "locationid", "LocationID"],
        ["fromlocation", "FromLocation", "locationname", "LocationName"]
      );
      setFromLocationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[AST] From location fetch failed:", err);
      setFromLocationOptions([]);
      return [];
    }
  }, [get, locationFetchJson]);

  const fetchToLocations = useCallback(async (divisionId = 0) => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AST_CONFIG.SP_TO_LOCATION,
        JSon: locationFetchJson(divisionId),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapLocationRows(
        res,
        ["tolocationid", "ToLocationID", "locationid", "LocationID"],
        ["tolocation", "ToLocation", "locationname", "LocationName"]
      );
      setToLocationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[AST] To location fetch failed:", err);
      setToLocationOptions([]);
      return [];
    }
  }, [get, locationFetchJson]);

  const fetchConfigOptions = useCallback(async (divisionId = 0) => {
    const resolvedDivisionId = Number(divisionId) || 0;
    if (!resolvedDivisionId) {
      setConfigOptions([]);
      return [];
    }
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AST_CONFIG.SP_CONFIG,
        JSon: JSON.stringify([{
          prmcompanyid: getUserSession().companyId,
          prmdivisionid: resolvedDivisionId,
          prmyearid: getUserSession().yearId,
          prmuserid: getUserSession().loginId,
          prmformtag: AST_CONFIG.CONFIG_FORM_TAG,
          prmreftype: AST_CONFIG.CONFIG_REF_TYPE,
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
      console.warn("[AST] Config fetch failed:", err);
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
        ObjName: AST_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: AST_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No AST header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(AST_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      const cols = colData || [];
      setHeaderColumns(cols);

      if (skipListDropdowns) {
        setFromDivisionOptions([]);
        setToDivisionOptions([]);
        setFromLocationOptions([]);
        setToLocationOptions([]);
        setConfigOptions([]);
        return;
      }

      const tasks = [];
      if (hasVisibleCol(cols, "fromdivisionid")) tasks.push(fetchFromDivisions());
      if (hasVisibleCol(cols, "todivisionid")) tasks.push(fetchToDivisions());
      if (hasVisibleCol(cols, "fromlocationid")) tasks.push(fetchFromLocations());
      if (hasVisibleCol(cols, "tolocationid")) tasks.push(fetchToLocations());
      await Promise.all(tasks);
    } catch (err) {
      console.error("[AST] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Assets Stock Transfer configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchFromDivisions, fetchToDivisions, fetchFromLocations, fetchToLocations]);

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        AST_CONFIG.RB_DETAIL,
        AST_CONFIG.STORAGE_ENTRY_META
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;

      const evtSet = buildEventColumnSet(apiColumns, ["qty", "rate"]);
      ["qty", "rate", "Qty", "Rate"].forEach((k) => evtSet.add(k));
      setEventColumns(evtSet);

      setAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
    } catch (err) {
      console.error("[AST] fetchDetailMeta failed:", err);
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
        funcCode: AST_CONFIG.RB_DETAIL,
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
      console.error("[AST] fetchGridColumns failed:", err);
      return [];
    }
  }, [get]);

  const seedOptionsFromMaster = useCallback((master) => {
    const seedOne = (id, label, setter) => {
      if (id != null && id !== 0 && label) setter([{ value: String(id), label: String(label) }]);
    };
    seedOne(
      master.fromdivisionid ?? master.FromDivisionID,
      master.fromdivision ?? master.fromdivisionname ?? master.divisionname,
      setFromDivisionOptions
    );
    seedOne(
      master.todivisionid ?? master.ToDivisionID,
      master.todivision ?? master.todivisionname ?? master.divisionname,
      setToDivisionOptions
    );
    seedOne(
      master.fromlocationid ?? master.FromLocationID,
      master.fromlocation ?? master.fromlocationname ?? master.locationname,
      setFromLocationOptions
    );
    seedOne(
      master.tolocationid ?? master.ToLocationID,
      master.tolocation ?? master.tolocationname ?? master.locationname,
      setToLocationOptions
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
    const toDiv = headerValues.todivisionid ?? fromDiv;
    const tasks = [];
    if (needsCol("fromdivisionid")) tasks.push(fetchFromDivisions());
    if (needsCol("todivisionid")) tasks.push(fetchToDivisions());
    if (needsCol("fromlocationid")) tasks.push(fetchFromLocations(fromDiv));
    if (needsCol("tolocationid")) tasks.push(fetchToLocations(toDiv));
    if (needsCol("configid")) tasks.push(fetchConfigOptions(fromDiv));
    await Promise.all(tasks);
  }, [
    headerColumns,
    fetchFromDivisions,
    fetchToDivisions,
    fetchFromLocations,
    fetchToLocations,
    fetchConfigOptions,
  ]);

  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
    const [mstRes, detRes] = await Promise.all([
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: AST_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: AST_CONFIG.RB_MASTER,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: AST_CONFIG.SP_DETAIL_FILL,
        prmParameters,
        prmFuncCode: AST_CONFIG.RB_DETAIL,
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
    toDivisionOptions,
    fromLocationOptions,
    toLocationOptions,
    configOptions,
    fetchFromDivisions,
    fetchToDivisions,
    fetchFromLocations,
    fetchToLocations,
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
