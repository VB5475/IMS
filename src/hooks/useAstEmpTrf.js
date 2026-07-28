// useAstEmpTrf.js — Assets Employee Transfer (AEI) header, grid, and cascades
import { useState, useCallback, useRef } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { AET_CONFIG } from "../pages/assets-employee-transfer/constants";
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
    funccode: AET_CONFIG.RB_MASTER,
    loginid: getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
    frmtype: AET_CONFIG.FRM_TYPE,
    issuetypeid: AET_CONFIG.ISSUE_TYPE_ID,
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

function mapFromLocationRows(rows) {
  return (rows || []).map((r) => ({
    value: String(r.fromlocationid ?? r.FromLocationID ?? r.locationid ?? 0),
    label: String(r.fromlocation ?? r.FromLocation ?? r.locationname ?? ""),
  }));
}

function mapToLocationRows(rows) {
  return (rows || []).map((r) => ({
    value: String(r.tolocationid ?? r.ToLocationID ?? r.locationid ?? 0),
    label: String(r.tolocation ?? r.ToLocation ?? r.locationname ?? ""),
  }));
}

function mapFromDepartmentRows(rows) {
  return (rows || []).map((r) => ({
    value: String(
      r.fromdeptid ?? r.fromdepartmentid ?? r.FromDeptID ?? r.FromDepartmentID ?? r.deptid ?? 0
    ),
    label: String(
      r.fromdept
      ?? r.fromdeptname
      ?? r.fromdepartment
      ?? r.FromDept
      ?? r.FromDeptName
      ?? r.FromDepartment
      ?? r.deptname
      ?? ""
    ),
  }));
}

function mapToDepartmentRows(rows) {
  return (rows || []).map((r) => ({
    value: String(
      r.todeptid ?? r.todepartmentid ?? r.ToDeptID ?? r.ToDepartmentID ?? r.deptid ?? 0
    ),
    label: String(
      r.todept
      ?? r.todeptname
      ?? r.todepartment
      ?? r.ToDept
      ?? r.ToDeptName
      ?? r.ToDepartment
      ?? r.deptname
      ?? ""
    ),
  }));
}

function mapFromVendorRows(rows) {
  return (rows || []).map((r) => ({
    value: String(
      r.fromvendorid ?? r.vendorid ?? r.VendorID ?? r.supplierid ?? r.partyid ?? r.idnumber ?? 0
    ),
    label: String(
      r.fromvendor
      ?? r.fromvendorname
      ?? r.vendorname
      ?? r.VendorName
      ?? r.suppliername
      ?? r.partyname
      ?? r.name
      ?? ""
    ),
  }));
}

function mapToVendorRows(rows) {
  return (rows || []).map((r) => ({
    value: String(
      r.tovendorid ?? r.vendorid ?? r.VendorID ?? r.supplierid ?? r.partyid ?? r.idnumber ?? 0
    ),
    label: String(
      r.tovendor
      ?? r.tovendorname
      ?? r.vendorname
      ?? r.VendorName
      ?? r.suppliername
      ?? r.partyname
      ?? r.name
      ?? ""
    ),
  }));
}

function mapFromWorkingClientRows(rows) {
  return (rows || []).map((r) => ({
    value: String(
      r.fromworkingclientid
      ?? r.fromworkigclientid
      ?? r.workingclientid
      ?? r.WorkingClientID
      ?? r.customerid
      ?? r.partyid
      ?? r.idnumber
      ?? 0
    ),
    label: String(
      r.fromworkingclient
      ?? r.fromworkigclient
      ?? r.fromworkingclientname
      ?? r.fromworkigclientcode
      ?? r.workingclientname
      ?? r.customername
      ?? r.partyname
      ?? r.name
      ?? ""
    ),
  }));
}

function mapToWorkingClientRows(rows) {
  return (rows || []).map((r) => ({
    value: String(
      r.toworkingclientid
      ?? r.toworkigclientid
      ?? r.workingclientid
      ?? r.WorkingClientID
      ?? r.customerid
      ?? r.partyid
      ?? r.idnumber
      ?? 0
    ),
    label: String(
      r.toworkingclient
      ?? r.toworkigclient
      ?? r.toworkingclientname
      ?? r.toworkigclientcode
      ?? r.workingclientname
      ?? r.customername
      ?? r.partyname
      ?? r.name
      ?? ""
    ),
  }));
}

function mapFromEmpRows(rows) {
  return (rows || []).map((r) => ({
    value: String(
      r.fromempuserid ?? r.userid ?? r.empuserid ?? r.idnumber ?? 0
    ),
    label: String(
      r.fromempusername
      ?? r.fromempusercode
      ?? r.username
      ?? r.empname
      ?? r.name
      ?? ""
    ),
  }));
}

function mapToEmpRows(rows) {
  return (rows || []).map((r) => ({
    value: String(
      r.toempuserid ?? r.userid ?? r.empuserid ?? r.idnumber ?? 0
    ),
    label: String(
      r.toempusername
      ?? r.toempusercode
      ?? r.username
      ?? r.empname
      ?? r.name
      ?? ""
    ),
  }));
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: AET_CONFIG.SP_RB_META,
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

export function useAstEmpTrf(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [fromDivisionOptions, setFromDivisionOptions] = useState([]);
  const [toDivisionOptions, setToDivisionOptions] = useState([]);
  const [fromLocationOptions, setFromLocationOptions] = useState([]);
  const [toLocationOptions, setToLocationOptions] = useState([]);
  const [fromDepartmentOptions, setFromDepartmentOptions] = useState([]);
  const [toDepartmentOptions, setToDepartmentOptions] = useState([]);
  const [fromEmpOptions, setFromEmpOptions] = useState([]);
  const [toEmpOptions, setToEmpOptions] = useState([]);
  const [fromVendorOptions, setFromVendorOptions] = useState([]);
  const [toVendorOptions, setToVendorOptions] = useState([]);
  const [fromClientOptions, setFromClientOptions] = useState([]);
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

  const divisionFetchJson = useCallback(() => {
    const session = getUserSession();
    return JSON.stringify([{
      prmuserid: session.loginId,
      prmcompanyid: session.companyId,
      prmyearid: session.yearId,
    }]);
  }, []);

  const locationFetchJson = useCallback((divisionId = 0) => {
    const session = getUserSession();
    return JSON.stringify([{
      prmcompanyid: session.companyId,
      prmdivisionid: Number(divisionId) || 0,
      prmloginid: session.loginId,
      prmlocationtype: "",
      prmfrmtype: String(AET_CONFIG.FRM_TYPE),
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
        ObjName: AET_CONFIG.SP_FROM_DIVISION,
        JSon: divisionFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapFromDivisionRows(res);
      setFromDivisionOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[AET] From division fetch failed:", err);
      setFromDivisionOptions([]);
      return [];
    }
  }, [get, divisionFetchJson]);

  const fetchToDivisions = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AET_CONFIG.SP_TO_DIVISION,
        JSon: divisionFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapToDivisionRows(res);
      setToDivisionOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[AET] To division fetch failed:", err);
      setToDivisionOptions([]);
      return [];
    }
  }, [get, divisionFetchJson]);

  const fetchFromLocations = useCallback(async (divisionId = 0) => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AET_CONFIG.SP_FROM_LOCATION,
        JSon: locationFetchJson(divisionId),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapFromLocationRows(res);
      setFromLocationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[AET] From location fetch failed:", err);
      setFromLocationOptions([]);
      return [];
    }
  }, [get, locationFetchJson]);

  const fetchToLocations = useCallback(async (divisionId = 0) => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AET_CONFIG.SP_TO_LOCATION,
        JSon: locationFetchJson(divisionId),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapToLocationRows(res);
      setToLocationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[AET] To location fetch failed:", err);
      setToLocationOptions([]);
      return [];
    }
  }, [get, locationFetchJson]);

  const fetchFromDepartments = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AET_CONFIG.SP_FROM_DEPT,
        JSon: deptFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapFromDepartmentRows(res);
      setFromDepartmentOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[AET] From department fetch failed:", err);
      setFromDepartmentOptions([]);
      return [];
    }
  }, [get, deptFetchJson]);

  const fetchToDepartments = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AET_CONFIG.SP_TO_DEPT,
        JSon: deptFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapToDepartmentRows(res);
      setToDepartmentOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[AET] To department fetch failed:", err);
      setToDepartmentOptions([]);
      return [];
    }
  }, [get, deptFetchJson]);

  const fetchFromVendors = useCallback(
    async (divisionId, locationId) => {
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: AET_CONFIG.SP_FROM_VENDOR,
          JSon: JSON.stringify([{
            prmcompanyid: getUserSession().companyId,
            prmdivisionid: Number(divisionId) || 0,
            prmlocationid: Number(locationId) || 0,
            prmissuetypeid: AET_CONFIG.VENDOR_ISSUE_TYPE_ID,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapFromVendorRows(res || []);
        setFromVendorOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[AET] From vendor fetch failed:", err);
        setFromVendorOptions([]);
        return [];
      }
    },
    [get]
  );

  const fetchToVendors = useCallback(
    async (divisionId, locationId) => {
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: AET_CONFIG.SP_TO_VENDOR,
          JSon: JSON.stringify([{
            prmcompanyid: getUserSession().companyId,
            prmdivisionid: Number(divisionId) || 0,
            prmlocationid: Number(locationId) || 0,
            prmissuetypeid: AET_CONFIG.VENDOR_ISSUE_TYPE_ID,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapToVendorRows(res || []);
        setToVendorOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[AET] To vendor fetch failed:", err);
        setToVendorOptions([]);
        return [];
      }
    },
    [get]
  );

  const fetchFromWorkingClients = useCallback(
    async (divisionId) => {
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: AET_CONFIG.SP_FROM_WORKING_CLIENT,
          JSon: JSON.stringify([{
            prmdivisionid: Number(divisionId) || 0,
            prmloginid: getUserSession().loginId,
            prmyearid: getUserSession().yearId,
            prmpartytype: AET_CONFIG.PARTY_TYPE_CLIENT,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapFromWorkingClientRows(res || []);
        setFromClientOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[AET] From working client fetch failed:", err);
        setFromClientOptions([]);
        return [];
      }
    },
    [get]
  );

  const fetchToWorkingClients = useCallback(
    async (divisionId) => {
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: AET_CONFIG.SP_TO_WORKING_CLIENT,
          JSon: JSON.stringify([{
            prmdivisionid: Number(divisionId) || 0,
            prmloginid: getUserSession().loginId,
            prmyearid: getUserSession().yearId,
            prmpartytype: AET_CONFIG.PARTY_TYPE_CLIENT,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapToWorkingClientRows(res || []);
        setToClientOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[AET] To working client fetch failed:", err);
        setToClientOptions([]);
        return [];
      }
    },
    [get]
  );

  const fetchConfigOptions = useCallback(
    async (divisionId = 0) => {
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: AET_CONFIG.SP_CONFIG,
          JSon: JSON.stringify([{
            prmcompanyid: getUserSession().companyId,
            prmdivisionid: Number(divisionId) || 0,
            prmyearid: getUserSession().yearId,
            prmuserid: getUserSession().loginId,
            prmformtag: AET_CONFIG.CONFIG_FORM_TAG,
            prmreftype: AET_CONFIG.CONFIG_REF_TYPE,
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
        console.warn("[AET] Config fetch failed:", err);
        setConfigOptions([]);
        return [];
      }
    },
    [get]
  );

  const fetchFromEmployees = useCallback(
    async (divisionId, locationId, deptId) => {
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: AET_CONFIG.SP_FROM_EMP,
          JSon: JSON.stringify([{
            prmcompanyid: getUserSession().companyId,
            prmdivisionid: Number(divisionId) || 0,
            prmlocationid: Number(locationId) || 0,
            prmdeptid: Number(deptId) || 0,
            prmissuetypeid: AET_CONFIG.EMP_ISSUE_TYPE_ID,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapFromEmpRows(res || []);
        setFromEmpOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[AET] From employee fetch failed:", err);
        setFromEmpOptions([]);
        return [];
      }
    },
    [get]
  );

  const fetchToEmployees = useCallback(
    async (divisionId, locationId, deptId) => {
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: AET_CONFIG.SP_TO_EMP,
          JSon: JSON.stringify([{
            prmcompanyid: getUserSession().companyId,
            prmdivisionid: Number(divisionId) || 0,
            prmlocationid: Number(locationId) || 0,
            prmdeptid: Number(deptId) || 0,
            prmissuetypeid: AET_CONFIG.EMP_ISSUE_TYPE_ID,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapToEmpRows(res || []);
        setToEmpOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[AET] To employee fetch failed:", err);
        setToEmpOptions([]);
        return [];
      }
    },
    [get]
  );

  const clearFromEmpOptions = useCallback(() => setFromEmpOptions([]), []);
  const clearToEmpOptions = useCallback(() => setToEmpOptions([]), []);

  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AET_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: AET_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No AEI header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(AET_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

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
        setFromDepartmentOptions([]);
        setToDepartmentOptions([]);
        setFromEmpOptions([]);
        setToEmpOptions([]);
        setFromVendorOptions([]);
        setToVendorOptions([]);
        setFromClientOptions([]);
        setToClientOptions([]);
        setConfigOptions([]);
        return;
      }

      const needFromDivision = hasVisibleCol(cols, "fromdivisionid");
      const needToDivision = hasVisibleCol(cols, "todivisionid");
      const needFromLocation = hasVisibleCol(cols, "fromlocationid");
      const needToLocation = hasVisibleCol(cols, "tolocationid");
      const needFromDept = hasVisibleCol(cols, "fromdeptid");
      const needToDept = hasVisibleCol(cols, "todeptid");
      const needVendor = hasVisibleCol(cols, "fromvendorid", "tovendorid");
      const needClient = hasVisibleCol(cols, "fromworkingclientid", "toworkingclientid");
      const needConfig = hasVisibleCol(cols, "configid");

      const tasks = [];
      if (needFromDivision) tasks.push(fetchFromDivisions());
      if (needToDivision) tasks.push(fetchToDivisions());
      if (needFromLocation) tasks.push(fetchFromLocations());
      if (needToLocation) tasks.push(fetchToLocations());
      if (needFromDept) tasks.push(fetchFromDepartments());
      if (needToDept) tasks.push(fetchToDepartments());
      if (needConfig) tasks.push(fetchConfigOptions(0));

      await Promise.all(tasks);
    } catch (err) {
      console.error("[AET] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Assets Employee Transfer configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [
    get,
    fetchFromDivisions,
    fetchToDivisions,
    fetchFromLocations,
    fetchToLocations,
    fetchFromDepartments,
    fetchToDepartments,
    fetchConfigOptions,
  ]);

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        AET_CONFIG.RB_DETAIL,
        AET_CONFIG.STORAGE_ENTRY_META
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;

      const evtSet = buildEventColumnSet(apiColumns, ["qty", "rate"]);
      ["qty", "rate", "Qty", "Rate"].forEach((k) => evtSet.add(k));
      setEventColumns(evtSet);

      setAllColumns(
        apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );
    } catch (err) {
      console.error("[AET] fetchDetailMeta failed:", err);
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
    if (!apiColumns.length || !meta) {
      console.warn("[AET] fetchGridColumns called before fetchDetailMeta completed.");
      return [];
    }

    try {
      const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
        funcCode: AET_CONFIG.RB_DETAIL,
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
      console.error("[AET] fetchGridColumns failed:", err);
      return [];
    }
  }, [get]);

  const fireCellEvent = useCallback(async () => null, []);

  const seedOptionsFromMaster = useCallback((master) => {
    const seedOne = (id, label, setter) => {
      if (id != null && id !== 0 && label) {
        setter([{ value: String(id), label: String(label) }]);
      }
    };
    seedOne(
      master.fromdivisionid,
      master.fromdivision ?? master.fromdivisionname ?? master.divisionname,
      setFromDivisionOptions
    );
    seedOne(
      master.todivisionid,
      master.todivision ?? master.todivisionname,
      setToDivisionOptions
    );
    seedOne(
      master.fromlocationid,
      master.fromlocation ?? master.fromlocationname ?? master.locationname,
      setFromLocationOptions
    );
    seedOne(
      master.tolocationid,
      master.tolocation ?? master.tolocationname,
      setToLocationOptions
    );
    seedOne(
      master.fromdeptid ?? master.fromdepartmentid,
      master.fromdept ?? master.fromdepartment ?? master.fromdeptname ?? master.deptname,
      setFromDepartmentOptions
    );
    seedOne(
      master.todeptid ?? master.todepartmentid,
      master.todept ?? master.todepartment ?? master.todeptname,
      setToDepartmentOptions
    );
    seedOne(
      master.fromempuserid,
      master.fromempusername ?? master.fromempusercode ?? master.fromempname,
      setFromEmpOptions
    );
    seedOne(
      master.toempuserid,
      master.toempusername ?? master.toempusercode ?? master.toempname,
      setToEmpOptions
    );
    seedOne(
      master.fromvendorid,
      master.fromvendor ?? master.fromvendorname,
      setFromVendorOptions
    );
    seedOne(
      master.tovendorid,
      master.tovendor ?? master.tovendorname,
      setToVendorOptions
    );
    seedOne(
      master.fromworkingclientid,
      master.fromworkingclient
      ?? master.fromworkigclient
      ?? master.fromworkingclientname,
      setFromClientOptions
    );
    seedOne(
      master.toworkingclientid,
      master.toworkingclient
      ?? master.toworkigclient
      ?? master.toworkingclientname,
      setToClientOptions
    );
    seedOne(
      master.configid ?? master.ConfigID ?? master.configurationid ?? master.ConfigurationId,
      master.configname ?? master.ConfigName ?? master.name ?? master.Name,
      setConfigOptions
    );
  }, []);

  const fetchUnlockedHeaderDropdowns = useCallback(
    async (headerValues = {}) => {
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
      const fromLoc = headerValues.fromlocationid ?? 0;
      const toDiv = headerValues.todivisionid ?? fromDiv;
      const toLoc = headerValues.tolocationid ?? fromLoc;
      const tasks = [];

      if (needsCol("fromdivisionid")) tasks.push(fetchFromDivisions());
      if (needsCol("todivisionid")) tasks.push(fetchToDivisions());
      if (needsCol("fromlocationid")) tasks.push(fetchFromLocations(fromDiv));
      if (needsCol("tolocationid")) tasks.push(fetchToLocations(toDiv));
      if (needsCol("fromdeptid")) tasks.push(fetchFromDepartments());
      if (needsCol("todeptid")) tasks.push(fetchToDepartments());
      if (needsCol("fromvendorid") && fromDiv) {
        tasks.push(fetchFromVendors(fromDiv, fromLoc));
      }
      if (needsCol("tovendorid") && toDiv) {
        tasks.push(fetchToVendors(toDiv, toLoc));
      }
      if (needsCol("fromworkingclientid") && fromDiv) {
        tasks.push(fetchFromWorkingClients(fromDiv));
      }
      if (needsCol("toworkingclientid") && toDiv) {
        tasks.push(fetchToWorkingClients(toDiv));
      }
      if (needsCol("configid")) tasks.push(fetchConfigOptions(fromDiv));

      if (fromDiv) {
        if (needsCol("fromempuserid")) {
          tasks.push(
            fetchFromEmployees(fromDiv, headerValues.fromlocationid, headerValues.fromdeptid)
          );
        }
        if (needsCol("toempuserid")) {
          tasks.push(
            fetchToEmployees(
              headerValues.todivisionid ?? fromDiv,
              headerValues.tolocationid,
              headerValues.todeptid
            )
          );
        }
      }

      await Promise.all(tasks);
    },
    [
      headerColumns,
      fetchFromDivisions,
      fetchToDivisions,
      fetchFromLocations,
      fetchToLocations,
      fetchFromDepartments,
      fetchToDepartments,
      fetchFromVendors,
      fetchToVendors,
      fetchFromWorkingClients,
      fetchToWorkingClients,
      fetchConfigOptions,
      fetchFromEmployees,
      fetchToEmployees,
    ]
  );

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
      const [mstRes, detRes] = await Promise.all([
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: AET_CONFIG.SP_MASTER_FILL,
          prmParameters,
          prmFuncCode: AET_CONFIG.RB_MASTER,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: AET_CONFIG.SP_DETAIL_FILL,
          prmParameters,
          prmFuncCode: AET_CONFIG.RB_DETAIL,
        }),
      ]);

      const master = mstRes?.[0] ?? null;
      return {
        master,
        headerValues: master ? mapMasterRowToHeaderValues(master) : null,
        details: mapDetailRowsToGridRows(detRes || []),
      };
    },
    [get]
  );

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
    fromDepartmentOptions,
    toDepartmentOptions,
    fromEmpOptions,
    toEmpOptions,
    fromVendorOptions,
    toVendorOptions,
    fromClientOptions,
    toClientOptions,
    configOptions,
    fetchFromDivisions,
    fetchToDivisions,
    fetchFromLocations,
    fetchToLocations,
    fetchFromDepartments,
    fetchToDepartments,
    fetchFromVendors,
    fetchToVendors,
    fetchFromWorkingClients,
    fetchToWorkingClients,
    fetchConfigOptions,
    fetchFromEmployees,
    fetchToEmployees,
    clearFromEmpOptions,
    clearToEmpOptions,
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    fireCellEvent,
    fetchEditRecord,
    seedOptionsFromMaster,
    fetchUnlockedHeaderDropdowns,
    saveError,
    clearSaveError,
  };
}
