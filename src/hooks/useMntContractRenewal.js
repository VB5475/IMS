import { useState, useCallback, useRef } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
  OBJ_TYPE,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { MACR_CONFIG } from "../pages/maintenance-contract-renewal/constants";
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
    Number(yearId) || MACR_CONFIG.CONFIG_YEAR_ID,
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

function todayIsoDate() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function mapMasterRowToHeaderValues(master) {
  const next = {
    ...master,
    yearid: getUserSession().yearId || MACR_CONFIG.CONFIG_YEAR_ID,
    funccode: MACR_CONFIG.RB_MASTER,
    loginid: getUserSession().loginId,
    sessionid: getUserSession().sessionId || DEFAULT_SESSION_ID,
  };
  [
    "contractdate",
    "issuedate",
    "contractfromdate",
    "contracttodate",
    "trandate",
  ].forEach((key) => {
    if (next[key] != null && next[key] !== "") next[key] = toDateInput(next[key]);
  });
  return next;
}

function mapDetailRowsToGridRows(rows) {
  return (rows || []).map((row, index) => ({
    ...row,
    id: String(row.compuniquekey ?? row.idnumber ?? row.masterid ?? `edit_${index}`),
  }));
}

function mapDivisionRows(rows) {
  return (rows || []).map((r) => ({
    value: String(r.divisionid ?? r.DivisionID ?? r.fromdivisionid ?? 0),
    label: String(r.division ?? r.Division ?? r.divisionname ?? r.fromdivision ?? ""),
  }));
}

function mapViewRows(rows) {
  return (rows || [])
    .map((row) => {
      const keys = Object.keys(row || {});
      if (!keys.length) return null;
      const idKey =
        keys.find((k) => /id$/i.test(k) && !/^err/i.test(k))
        ?? keys.find((k) => /code$/i.test(k))
        ?? keys[0];
      const labelKey =
        keys.find((k) => /(name|desc|label|text)$/i.test(k))
        ?? keys.find((k) => k !== idKey)
        ?? idKey;
      const value = row[idKey];
      if (value == null || value === "") return null;
      return {
        value: String(value),
        label: String(row[labelKey] ?? value).trim() || String(value),
      };
    })
    .filter(Boolean);
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: MACR_CONFIG.SP_RB_META,
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
    prmLoginID: getUserSession().loginId || DEFAULT_LOGIN_ID,
  });
  return { meta, apiColumns: colData || [] };
}

/**
 * Maintenance Contract Renewal — RB rb_mntamcrnwmst
 * Header + Contract Item Detail + Terms & Condition Detail.
 */
export function useMntContractRenewal(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [configOptions, setConfigOptions] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [contractTypeOptions, setContractTypeOptions] = useState([]);
  const [frequencyOptions, setFrequencyOptions] = useState([]);

  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [termsColumns, setTermsColumns] = useState([]);
  const [allTermsColumns, setAllTermsColumns] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);
  const rawTermsColumnsRef = useRef([]);
  const rawTermsRbMetaRef = useRef(null);

  const fetchDivisions = useCallback(async () => {
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: MACR_CONFIG.SP_DIVISION,
        JSon: JSON.stringify([{
          prmuserid: session.loginId || DEFAULT_LOGIN_ID,
          prmcompanyid: session.companyId || DEFAULT_COMPANY_ID,
          prmyearid: session.yearId || MACR_CONFIG.DIVISION_YEAR_ID,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapDivisionRows(res);
      setDivisionOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[MACR] Division fetch failed:", err);
      setDivisionOptions([]);
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
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: MACR_CONFIG.SP_CONFIG,
        JSon: JSON.stringify([{
          prmcompanyid: session.companyId || DEFAULT_COMPANY_ID,
          prmdivisionid: resolvedDivisionId,
          prmyearid: session.yearId || MACR_CONFIG.CONFIG_YEAR_ID,
          prmuserid: session.loginId || DEFAULT_LOGIN_ID,
          prmformtag: MACR_CONFIG.CONFIG_FORM_TAG,
          prmreftype: MACR_CONFIG.CONFIG_REF_TYPE,
          prmref_mstid: 0,
          prmref_detid: 0,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(
          r.configurationid ?? r.ConfigurationId ?? r.configid ?? r.configtypeid ?? r.idnumber ?? 0
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
      console.warn("[MACR] Config fetch failed:", err);
      setConfigOptions([]);
      return [];
    }
  }, [get]);

  const fetchSuppliers = useCallback(async (divisionId = 0) => {
    const resolvedDivisionId = Number(divisionId) || 0;
    if (!resolvedDivisionId) {
      setSupplierOptions([]);
      return [];
    }
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: MACR_CONFIG.SP_SUPPLIER,
        JSon: JSON.stringify([{
          prmdivisionid: resolvedDivisionId,
          prmloginid: session.loginId || DEFAULT_LOGIN_ID,
          prmyearid: session.yearId || MACR_CONFIG.CONFIG_YEAR_ID,
          prmpartytype: MACR_CONFIG.SUPPLIER_PARTY_TYPE,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(Math.round(Number(r.supplierid ?? r.SupplierID ?? 0))),
        label: String(r.suppliername ?? r.SupplierName ?? r.supplier ?? ""),
      })).filter((o) => o.value && o.value !== "0");
      setSupplierOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[MACR] Supplier fetch failed:", err);
      setSupplierOptions([]);
      return [];
    }
  }, [get]);

  const fetchViewOptions = useCallback(async (viewName, setter) => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.VIEW,
        ObjName: viewName,
        JSon: JSON.stringify([{}]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapViewRows(res);
      setter(opts);
      return opts;
    } catch (err) {
      console.warn(`[MACR] view ${viewName} fetch failed:`, err);
      setter([]);
      return [];
    }
  }, [get]);

  const fetchContractTypes = useCallback(
    () => fetchViewOptions(MACR_CONFIG.VIEW_CONTRACT_TYPE, setContractTypeOptions),
    [fetchViewOptions]
  );

  const fetchFrequencies = useCallback(
    () => fetchViewOptions(MACR_CONFIG.VIEW_FREQUENCY, setFrequencyOptions),
    [fetchViewOptions]
  );

  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const session = getUserSession();
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: MACR_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: MACR_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Contract Renewal header RB metadata returned.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(MACR_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: session.loginId || DEFAULT_LOGIN_ID,
      });
      const cols = colData || [];
      setHeaderColumns(cols);

      if (skipListDropdowns) {
        setDivisionOptions([]);
        setConfigOptions([]);
        setSupplierOptions([]);
        setContractTypeOptions([]);
        setFrequencyOptions([]);
        return;
      }

      const tasks = [];
      if (hasVisibleCol(cols, "divisionid")) tasks.push(fetchDivisions());
      if (hasVisibleCol(cols, "contracttypeid")) tasks.push(fetchContractTypes());
      if (hasVisibleCol(cols, "frequencyid")) tasks.push(fetchFrequencies());
      await Promise.all(tasks);
    } catch (err) {
      console.error("[MACR] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Contract Renewal configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchDivisions, fetchContractTypes, fetchFrequencies]);

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const [itemMeta, termsMeta] = await Promise.all([
        loadRbDetailGridMeta(get, MACR_CONFIG.RB_DETAIL, MACR_CONFIG.STORAGE_ENTRY_META),
        loadRbDetailGridMeta(get, MACR_CONFIG.RB_TERMS_DETAIL, MACR_CONFIG.STORAGE_TERMS_META),
      ]);

      rawDetailRbMetaRef.current = itemMeta.meta;
      rawDetailColumnsRef.current = itemMeta.apiColumns;
      rawTermsRbMetaRef.current = termsMeta.meta;
      rawTermsColumnsRef.current = termsMeta.apiColumns;

      setAllColumns(
        itemMeta.apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );
      setAllTermsColumns(
        termsMeta.apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );
    } catch (err) {
      console.error("[MACR] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load grid configuration.");
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
        funcCode: MACR_CONFIG.RB_DETAIL,
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
      console.error("[MACR] fetchGridColumns failed:", err);
      return [];
    }
  }, [get]);

  const fetchTermsGridColumns = useCallback(async (divisionID = 0, editOpts = false) => {
    const opts = typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
    const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;
    const apiColumns = rawTermsColumnsRef.current;
    const meta = rawTermsRbMetaRef.current;
    if (!apiColumns.length || !meta) return [];

    try {
      const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
        funcCode: MACR_CONFIG.RB_TERMS_DETAIL,
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
      setTermsColumns(gridColumns);
      return gridColumns;
    } catch (err) {
      console.error("[MACR] fetchTermsGridColumns failed:", err);
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
      master.configtypeid ?? master.ConfigTypeID ?? master.configid ?? master.ConfigID,
      master.configtypename ?? master.configname ?? master.ConfigName ?? master.name,
      setConfigOptions
    );
    seedOne(
      master.supplierid ?? master.SupplierID,
      master.suppliername ?? master.SupplierName ?? master.supplier,
      setSupplierOptions
    );
    seedOne(
      master.contracttypeid ?? master.ContractTypeID,
      master.contracttypename ?? master.ContractTypeName ?? master.contracttype,
      setContractTypeOptions
    );
    seedOne(
      master.frequencyid ?? master.FrequencyID,
      master.frequencyname ?? master.FrequencyName ?? master.frequency,
      setFrequencyOptions
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
    if (needsCol("configtypeid", "configid")) tasks.push(fetchConfigOptions(divId));
    if (needsCol("supplierid")) tasks.push(fetchSuppliers(divId));
    if (needsCol("contracttypeid")) tasks.push(fetchContractTypes());
    if (needsCol("frequencyid")) tasks.push(fetchFrequencies());
    await Promise.all(tasks);
  }, [
    headerColumns,
    fetchDivisions,
    fetchConfigOptions,
    fetchSuppliers,
    fetchContractTypes,
    fetchFrequencies,
  ]);

  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
    const [mstRes, detRes, termsRes] = await Promise.all([
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: MACR_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: MACR_CONFIG.RB_MASTER,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: MACR_CONFIG.SP_DETAIL_FILL,
        prmParameters,
        prmFuncCode: MACR_CONFIG.RB_DETAIL,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: MACR_CONFIG.SP_TERMS_FILL,
        prmParameters,
        prmFuncCode: MACR_CONFIG.RB_TERMS_DETAIL,
      }),
    ]);

    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? mapMasterRowToHeaderValues(master) : null,
      details: mapDetailRowsToGridRows(detRes || []),
      termsDetails: mapDetailRowsToGridRows(termsRes || []),
    };
  }, [get]);

  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    headerColumns,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    divisionOptions,
    configOptions,
    supplierOptions,
    contractTypeOptions,
    frequencyOptions,
    fetchDivisions,
    fetchConfigOptions,
    fetchSuppliers,
    fetchContractTypes,
    fetchFrequencies,
    columns,
    allColumns,
    termsColumns,
    allTermsColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    fetchTermsGridColumns,
    fetchEditRecord,
    seedOptionsFromMaster,
    fetchUnlockedHeaderDropdowns,
    saveError,
    clearSaveError,
    todayIsoDate,
  };
}
