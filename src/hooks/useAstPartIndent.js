// useAstPartIndent.js — Asset Parts Indent Detail (maintenance transaction hook)

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
import { APID_CONFIG } from "../pages/asset-parts-indent-detail/constants";
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
  isVisibleApiCol,
  hasVisibleCol,
} from "../utils/gridUtils";
import { isErrorOnlyRow } from "../utils/apiResponse";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId) || DEFAULT_COMPANY_ID,
    Number(yearId) || APID_CONFIG.CONFIG_YEAR_ID,
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
  const next = {
    ...master,
    trandate: toDateInput(master.trandate ?? master.TranDate),
    yearid: getUserSession().yearId || APID_CONFIG.CONFIG_YEAR_ID,
    funccode: APID_CONFIG.RB_MASTER,
    loginid: getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
  };
  return next;
}

function mapDetailRowsToGridRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 1 && isErrorOnlyRow(list[0])) return [];
  return list.map((row, index) => ({
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

function mapAstItemRows(rows) {
  return (rows || []).map((r) => ({
    value: String(r.idnumber ?? r.astitemid ?? r.IDNumber ?? 0),
    label: String(r.itemname ?? r.ItemName ?? r.astitemname ?? ""),
  }));
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: APID_CONFIG.SP_RB_META,
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

export function useAstPartIndent(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [astItemOptions, setAstItemOptions] = useState([]);

  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const clearSaveError = useCallback(() => setSaveError(null), []);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  const divisionFetchJson = useCallback(
    () => JSON.stringify([{
      prmuserid: DEFAULT_LOGIN_ID,
      prmcompanyid: DEFAULT_COMPANY_ID,
      prmyearid: APID_CONFIG.DIVISION_YEAR_ID,
    }]),
    []
  );

  const fetchDivisions = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: APID_CONFIG.SP_DIVISION,
        JSon: divisionFetchJson(),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapDivisionRows(res);
      setDivisionOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[APID] Division fetch failed:", err);
      setDivisionOptions([]);
      return [];
    }
  }, [get, divisionFetchJson]);

  const fetchAstItems = useCallback(async (divisionId = 0) => {
    const resolvedDivisionId = Number(divisionId) || 0;
    if (!resolvedDivisionId) {
      setAstItemOptions([]);
      return [];
    }
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: APID_CONFIG.SP_ASSET_ITEM,
        JSon: JSON.stringify([{
          prmuserid: session.loginId || DEFAULT_LOGIN_ID,
          prmdivisionid: resolvedDivisionId,
          prmyearid: session.yearId || APID_CONFIG.CONFIG_YEAR_ID,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapAstItemRows(res);
      setAstItemOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[APID] Asset item fetch failed:", err);
      setAstItemOptions([]);
      return [];
    }
  }, [get]);

  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const { apiColumns } = await loadRbDetailGridMeta(
        get,
        APID_CONFIG.RB_MASTER,
        APID_CONFIG.STORAGE_HEADER_META
      );
      setHeaderColumns(apiColumns);

      if (skipListDropdowns) {
        setDivisionOptions([]);
        setAstItemOptions([]);
        return;
      }

      const tasks = [];
      if (hasVisibleCol(apiColumns, "divisionid")) tasks.push(fetchDivisions());
      await Promise.all(tasks);
    } catch (err) {
      console.error("[APID] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Asset Parts Indent Detail configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchDivisions]);

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        APID_CONFIG.RB_DETAIL,
        APID_CONFIG.STORAGE_ENTRY_META
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;
      setAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
      return apiColumns;
    } catch (err) {
      console.error("[APID] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load item detail grid configuration.");
      return [];
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
        funcCode: APID_CONFIG.RB_DETAIL,
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
      console.error("[APID] fetchGridColumns failed:", err);
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
      master.astitemid ?? master.AstItemID ?? master.astitem ?? master.idnumber,
      master.astitemname ?? master.itemname ?? master.ItemName ?? master.astitem,
      setAstItemOptions
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
    if (needsCol("astitemid")) tasks.push(fetchAstItems(divId));
    await Promise.all(tasks);
  }, [headerColumns, fetchDivisions, fetchAstItems]);

  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
    const [mstRes, detRes] = await Promise.all([
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: APID_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: APID_CONFIG.RB_MASTER,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: APID_CONFIG.SP_DETAIL_FILL,
        prmParameters,
        prmFuncCode: APID_CONFIG.RB_DETAIL,
      }),
    ]);
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? mapMasterRowToHeaderValues(master) : null,
      details: mapDetailRowsToGridRows(detRes || []),
    };
  }, [get]);

  return {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, astItemOptions, fetchAstItems,
    columns, allColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    saveError, setSaveError, clearSaveError,
  };
}
