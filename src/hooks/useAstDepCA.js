// useAstDepCA.js — Header meta, detail grid, and filter dropdowns for Assets Depreciation (DPC)
// ─────────────────────────────────────────────────────────────────────────────────────────────
// Same 3-phase load pattern as useCWIPToFA.js:
//
//   fetchHeaderMeta  → RB_AstDepCAMst → GET_DETAIL_COL_DATA + Division (parallel)
//   fetchDetailMeta  → RB_AstDepCADet → GET_DETAIL_COL_DATA (columns only)
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (lazy on first Add New)
//
// DPC-specific:
//   fetchAssetsAccByDivision(divisionId) — Fixed Asset A/C cascade from Division
//   Cascade: DivisionID → clear FixedAstAcID + grid
//   Cascade: FixedAstAcID → clear grid only
//   SP_ASSETS_ACC params: PrmDivisionID, PrmAcMainGroupID (DBA CONFIRM), PrmLoginID, PrmCompanyID, PrmYearID

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
import { DPC_CONFIG } from "../pages/assets-depreciation/constants";
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
} from "../utils/gridUtils";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId)  || DEFAULT_COMPANY_ID,
    Number(yearId)     || DPC_CONFIG.CONFIG_YEAR_ID,
    Number(loginId)    || getUserSession().loginId,
    Number(sessionId)  || DEFAULT_SESSION_ID,
    Number(idNumber)   || 0,
  ].join(",");
}

function mapMasterRowToHeaderValues(master, params) {
  const toDateInput = (value) => {
    if (!value) return "";
    if (typeof value === "string" && value.includes("T")) return value.split("T")[0];
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  return {
    TranCode:        master.TranCode       != null ? String(master.TranCode)       : "",
    TranDate:        toDateInput(master.TranDate),
    DivisionID:      master.DivisionID     != null ? Number(master.DivisionID)     : 0,
    FixedAstAcID:    master.FixedAstAcID   != null ? Number(master.FixedAstAcID)   : 0,
    TotalDepAmount:  master.TotalDepAmount  != null ? Number(master.TotalDepAmount)  : 0,
    Remarks:         master.Remarks        ?? "",
    FuncCode:        master.FuncCode       ?? DPC_CONFIG.RB_MASTER,
    TranMstGenID:    master.TranMstGenID   != null ? Number(master.TranMstGenID)   : 0,
    CompanyID:       Number(params.companyId)  || DEFAULT_COMPANY_ID,
    YearID:          Number(master.Year_ID ?? params.yearId) || DPC_CONFIG.CONFIG_YEAR_ID,
    LoginID:         Number(master.LoginID ?? params.loginId) || getUserSession().loginId,
    SessionID:       Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    IDNumber:        Number(master.IDNumber ?? params.idNumber) || 0,
    UserID:          getUserSession().userId,
    CompUniqueKey:   master.CompUniqueKey ?? master.IDNumber ?? params.idNumber ?? 0,
  };
}

function mapDetailRowsToGridRows(rows) {
  return (rows || []).map((row, index) => ({
    ...row,
    id: String(row.CompUniqueKey ?? row.IDNumber ?? row.MasterID ?? `edit_${index}`),
  }));
}

function buildEventColumnSet(apiColumns, fallbackKeys = []) {
  const set = new Set();
  apiColumns.forEach((col) => {
    if (isTruthyApiFlag(col.IsEventReq) || isTruthyApiFlag(col.IsEventCol)) set.add(col.ColName);
  });
  if (set.size === 0) fallbackKeys.forEach((k) => set.add(k));
  return set;
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: DPC_CONFIG.SP_RB_META,
    JSon: JSON.stringify([{ prmRBCode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  });
  const tableRow = metaData?.Table?.[0];
  if (!tableRow) throw new Error(`No RB metadata returned for ${rbCode}.`);
  const meta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
  localStorage.setItem(storageKey, JSON.stringify(meta));
  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID:  DEFAULT_LOGIN_ID,
  });
  return { meta, apiColumns: colData?.Links || [] };
}

export function useAstDepCA(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  // ── Header (master) state ──────────────────────────────────────────────────
  const [headerColumns,  setHeaderColumns]  = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError,    setHeaderError]    = useState(null);

  const [divisionOptions,  setDivisionOptions]  = useState([]);
  const [assetsAccOptions, setAssetsAccOptions] = useState([]);

  // ── Detail grid state ──────────────────────────────────────────────────────
  const [columns,      setColumns]      = useState([]);
  const [allColumns,   setAllColumns]   = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching,   setIsFetching]   = useState(false);
  const [metaError,    setMetaError]    = useState(null);
  const [saveError,    setSaveError]    = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef  = useRef(null);

  // ── fetchAssetsAccByDivision — cascade from Division ──────────────────────
  const fetchAssetsAccByDivision = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === "0") { setAssetsAccOptions([]); return []; }
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: DPC_CONFIG.SP_ASSETS_ACC,
        JSon: JSON.stringify([{
          PrmDivisionID:    Number(divisionId),
          PrmAcMainGroupID: 7,           // ⚠️ DBA CONFIRM — Main Group ID for Fixed Asset accounts
          PrmLoginID:       DEFAULT_LOGIN_ID,
          PrmCompanyID:     DEFAULT_COMPANY_ID,
          PrmYearID:        DPC_CONFIG.CONFIG_YEAR_ID,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.AccountID ?? r.AcID ?? 0),
        label: String((r.AcCode ?? "") + " | " + (r.AcName ?? "")),
      }));
      setAssetsAccOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[DPC] Assets A/C fetch failed:", err);
      setAssetsAccOptions([]);
      return [];
    }
  }, [get]);

  const clearAssetsAccOptions = useCallback(() => setAssetsAccOptions([]), []);

  // ── fetchHeaderMeta ────────────────────────────────────────────────────────
  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: DPC_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: DPC_CONFIG.RB_MASTER }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error("No DPC header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      localStorage.setItem(DPC_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  DEFAULT_LOGIN_ID,
      });
      const hdrApiColumns = colData?.Links || [];
      setHeaderColumns(hdrApiColumns);
      console.log("%c[DPC] Header columns received:", "color:#8b5cf6;font-weight:600", hdrApiColumns.length);

      if (skipListDropdowns) {
        setDivisionOptions([]);
        setAssetsAccOptions([]);
        return;
      }

      const divisionData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: DPC_CONFIG.SP_DIVISIONS,
        JSon: JSON.stringify([{
          prmUserID:    DEFAULT_LOGIN_ID,
          prmCompanyID: DEFAULT_COMPANY_ID,
          prmYearID:    DPC_CONFIG.DIVISION_YEAR_ID,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      }).catch((err) => { console.warn("[DPC] Division fetch failed:", err); return null; });

      setDivisionOptions(
        (divisionData?.Table || []).map((r) => ({ value: String(r.DivisionID), label: r.DivisionName }))
      );
    } catch (err) {
      console.error("[DPC] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load DPC header configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // ── fetchDetailMeta ────────────────────────────────────────────────────────
  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        DPC_CONFIG.RB_DETAIL,
        "dpcEntryMeta"
      );
      rawDetailRbMetaRef.current  = meta;
      rawDetailColumnsRef.current = apiColumns;

      // Qty + Rate drive Amount auto-calc (client-side fallback when SP_GRID_EVENT is null)
      const evtSet = buildEventColumnSet(apiColumns, ["Qty", "Rate"]);
      ["Qty", "Rate"].forEach((k) => evtSet.add(k));
      setEventColumns(evtSet);

      setAllColumns(apiColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType || null })));
      console.log("%c[DPC] Detail columns received:", "color:#6366f1;font-weight:600", apiColumns.length);
    } catch (err) {
      console.error("[DPC] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load DPC item grid configuration.");
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  // ── fetchGridColumns — lazy, called on first Add New or edit load ──────────
  const fetchGridColumns = useCallback(async (divisionID = 0, editOpts = false) => {
    const opts = typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
    const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

    const apiColumns = rawDetailColumnsRef.current;
    const meta       = rawDetailRbMetaRef.current;
    if (!apiColumns.length || !meta) {
      console.warn("[DPC] fetchGridColumns called before fetchDetailMeta completed.");
      return [];
    }

    try {
      const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
        funcCode:              DPC_CONFIG.RB_DETAIL,
        divisionID:            Number(divisionID) || 0,
        existingRecordEdit,
        rowData:               masterRow,
        fetchUnlockedDropdowns,
      });

      const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
        filterable:         false,
        allEditable:        true,
        existingRecordEdit,
      });
      setColumns(gridColumns);
      console.log("%c[DPC] Grid columns built:", "color:#22c55e;font-weight:600", gridColumns.length);
      return gridColumns;
    } catch (err) {
      console.error("[DPC] fetchGridColumns failed:", err);
      return [];
    }
  }, [get]);

  // ── fireCellEvent — no SP_GRID_EVENT in MRD; Amount is computed client-side ─
  const fireCellEvent = useCallback(async () => null, []);

  // ── seedOptionsFromMaster — edit mode: pre-fill dropdowns from saved record ─
  const seedOptionsFromMaster = useCallback((master) => {
    if (master.DivisionID != null && master.DivisionName) {
      setDivisionOptions([{ value: String(master.DivisionID), label: master.DivisionName }]);
    }
    if (master.FixedAstAcID != null && (master.FixedAstAcName ?? master.AcName)) {
      setAssetsAccOptions([{
        value: String(master.FixedAstAcID),
        label: String((master.AcCode ?? "") + " | " + (master.FixedAstAcName ?? master.AcName ?? "")),
      }]);
    }
  }, []);

  // ── fetchUnlockedHeaderDropdowns — enter edit mode: reload editable dropdowns
  const fetchUnlockedHeaderDropdowns = useCallback(async (divisionId) => {
    if (!headerColumns.length) return;
    const isEditable    = (c) => isTruthyApiFlag(c.IsEditAllow) && !isLockOnEditModeCol(c);
    const needsDivision = headerColumns.some((c) => c.ColName === "DivisionID"   && isEditable(c));
    const needsAssetAcc = headerColumns.some((c) => c.ColName === "FixedAstAcID" && isEditable(c));

    const tasks = [];
    if (needsDivision) {
      tasks.push(
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: DPC_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{
            prmUserID:    DEFAULT_LOGIN_ID,
            prmCompanyID: DEFAULT_COMPANY_ID,
            prmYearID:    DPC_CONFIG.DIVISION_YEAR_ID,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        })
          .then((res) => setDivisionOptions((res?.Table || []).map((r) => ({ value: String(r.DivisionID), label: r.DivisionName }))))
          .catch(() => {})
      );
    }
    if (needsAssetAcc && divisionId) tasks.push(fetchAssetsAccByDivision(divisionId));
    await Promise.all(tasks);
  }, [headerColumns, get, fetchAssetsAccByDivision]);

  // ── fetchEditRecord ────────────────────────────────────────────────────────
  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
    const [mstRes, detRes] = await Promise.all([
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: DPC_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode:  DPC_CONFIG.RB_MASTER,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: DPC_CONFIG.SP_DETAIL_FILL,
        prmParameters,
        prmFuncCode:  DPC_CONFIG.RB_DETAIL,
      }),
    ]);
    const master = mstRes?.Links?.[0] ?? null;
    const params = { companyId, yearId, loginId, sessionId, idNumber };
    return {
      master,
      headerValues: master ? mapMasterRowToHeaderValues(master, params) : null,
      details:      mapDetailRowsToGridRows(detRes?.Links || []),
    };
  }, [get]);

  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    // Header
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, assetsAccOptions,
    fetchAssetsAccByDivision, clearAssetsAccOptions,
    // Detail grid
    columns, allColumns, eventColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fireCellEvent,
    // Edit
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    // Save
    saveError, clearSaveError,
  };
}
