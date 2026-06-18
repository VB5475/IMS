// useCWIPToFA.js — Header meta, detail grid, and filter dropdowns for CWIP To FA
// ───────────────────────────────────────────────────────────────────────────────
// Same 3-phase load pattern as usePurchaseVoucher.js:
//
//   fetchHeaderMeta  → RB_AstCWIP2FAMst → GET_DETAIL_COL_DATA + Division (parallel)
//   fetchDetailMeta  → RB_AstCWIP2FADet → GET_DETAIL_COL_DATA (columns only)
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (lazy on first Add New)
//
// C2F-specific vs PV:
//   No SupplierID, no BasedOnID, no EnterpriseSummaryPanel
//   fetchLocations(divisionId)               — Location cascade from Division
//   fetchCostCenters(divisionId, tranDate)   — Cost Center dropdown (same SP, module="C2F")
//   seedOptionsFromMaster handles: Division, Location, CWIPAccID, CostCenter

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
import { C2F_CONFIG } from "../pages/cwip-to-fa/constants";
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
  buildDropdownOptionFromRow,
} from "../utils/gridUtils";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId)  || DEFAULT_COMPANY_ID,
    Number(yearId)     || C2F_CONFIG.CONFIG_YEAR_ID,
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
    TranNo:           master.TranNo          != null ? String(master.TranNo)           : "",
    TranDate:         toDateInput(master.TranDate),
    PutToUseInstDate: toDateInput(master.PutToUseInstDate) || null,
    DivisionID:       master.DivisionID      != null ? Number(master.DivisionID)       : 0,
    LocationID:       master.LocationID      != null ? Number(master.LocationID)       : 0,
    CWIPAccID:        master.CWIPAccID        != null ? Number(master.CWIPAccID)        : 0,
    CostCenterAccID:  master.CostCenterAccID  != null ? Number(master.CostCenterAccID)  : 0,
    ConvTypeID:       master.ConvTypeID      != null ? String(master.ConvTypeID)       : "1",
    NetTotal:         master.NetTotal        != null ? Number(master.NetTotal)         : 0,
    Remark:           master.Remark          ?? "",
    TranMstGenID:     master.TranMstGenID    != null ? Number(master.TranMstGenID)     : 0,
    CompanyID:        Number(params.companyId)  || DEFAULT_COMPANY_ID,
    YearID:           Number(master.Year_ID ?? params.yearId) || C2F_CONFIG.CONFIG_YEAR_ID,
    LoginID:          Number(master.LoginID ?? params.loginId) || getUserSession().loginId,
    SessionID:        Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    IDNumber:         Number(master.IDNumber ?? params.idNumber) || 0,
    UserID:           getUserSession().userId,
    CompUniqueKey:    master.CompUniqueKey ?? master.IDNumber ?? params.idNumber ?? 0,
    FuncCode:         master.FuncCode ?? C2F_CONFIG.RB_MASTER,
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
    ObjName: C2F_CONFIG.SP_RB_META,
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

export function useCWIPToFA(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  // ── Header (master) state ──────────────────────────────────────────────────
  const [headerColumns,   setHeaderColumns]   = useState([]);
  const [headerFetching,  setHeaderFetching]  = useState(false);
  const [headerError,     setHeaderError]     = useState(null);

  const [divisionOptions,       setDivisionOptions]       = useState([]);
  const [locationOptions,       setLocationOptions]       = useState([]);
  const [costCenterOptions,     setCostCenterOptions]     = useState([]);
  // Dynamically fetched via GET_FILTER_DETAIL on the header RBID — covers CWIPAccID
  // and any other account-type dropdowns in the master. { [ColName]: [{value,label}] }
  const [headerDropdownOptions, setHeaderDropdownOptions] = useState({});
  const headerRbMetaRef = useRef(null);

  // ── Detail grid state ──────────────────────────────────────────────────────
  const [columns,    setColumns]    = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching,  setIsFetching]  = useState(false);
  const [metaError,   setMetaError]   = useState(null);
  const [saveError,   setSaveError]   = useState(null);

  const rawDetailColumnsRef  = useRef([]);
  const rawDetailRbMetaRef   = useRef(null);

  // ── fetchLocations — cascade from Division ─────────────────────────────────
  const fetchLocations = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === "0") { setLocationOptions([]); return []; }
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: C2F_CONFIG.SP_LOCATION,
        JSon: JSON.stringify([{
          PrmCompanyID:  DEFAULT_COMPANY_ID,
          PrmLoginID:    DEFAULT_LOGIN_ID,
          prmLocationType: "",
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.LocationID ?? r.LocID),
        label: r.LocationName ?? r.LocName ?? r.Location ?? String(r.LocationID ?? r.LocID),
      }));
      setLocationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[C2F] Location fetch failed:", err);
      setLocationOptions([]);
      return [];
    }
  }, [get]);

  // ── fetchCostCenters ───────────────────────────────────────────────────────
  const fetchCostCenters = useCallback(async (divisionId, tranDate) => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: C2F_CONFIG.SP_COST_CENTER,
        JSon: JSON.stringify([{
          PrmDivisionId:  Number(divisionId) || 0,
          PrmTranDate:    tranDate || "",
          PrmAccountId:   0,
          PrmLoginId:     DEFAULT_LOGIN_ID,
          PrmLangCode:    1,
          PrmModuleCode:  "C2F",
          PrmIsMultiDiv:  0,
          PrmYearId:      C2F_CONFIG.CONFIG_YEAR_ID,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.CostCenterID ?? r.CostCenterId ?? r.AccountId),
        label: r.CostCenterAc,
      }));
      setCostCenterOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[C2F] Cost Center fetch failed:", err);
      setCostCenterOptions([]);
      return [];
    }
  }, [get]);

  // ── fetchHeaderMeta ────────────────────────────────────────────────────────
  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — fetch RB metadata → RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: C2F_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: C2F_CONFIG.RB_MASTER }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error("No C2F header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      headerRbMetaRef.current = hdrMeta;
      localStorage.setItem(C2F_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — fetch header column definitions (master field metadata — dynamic)
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  DEFAULT_LOGIN_ID,
      });
      const hdrApiColumns = colData?.Links || [];
      setHeaderColumns(hdrApiColumns);
      console.log("%c[C2F] Header columns received:", "color:#8b5cf6;font-weight:600", hdrApiColumns.length);

      if (skipListDropdowns) {
        setDivisionOptions([]);
        return;
      }

      // Phase 3 — Division + header account dropdowns (GET_FILTER_DETAIL) in parallel
      // Manually managed: DivisionID, LocationID, CostCenterAccID, ConvTypeID
      const MANUAL_HDR_DROPDOWNS = new Set(["DivisionID", "LocationID", "CostCenterAccID", "ConvTypeID"]);
      const hdrDropdownCols = hdrApiColumns.filter(
        (c) => c.ColCtrlType === 4 && !MANUAL_HDR_DROPDOWNS.has(c.ColName)
      );
      const [divisionData, hdrDropdownOpts] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: C2F_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{
            prmUserID:    DEFAULT_LOGIN_ID,
            prmCompanyID: DEFAULT_COMPANY_ID,
            prmYearID:    C2F_CONFIG.DIVISION_YEAR_ID,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[C2F] Division fetch failed:", err); return null; }),
        fetchDropdownOptions(get, hdrDropdownCols, hdrMeta.RBID, { funcCode: C2F_CONFIG.RB_MASTER }).catch(() => ({})),
      ]);

      setDivisionOptions(
        (divisionData?.Table || []).map((r) => ({ value: String(r.DivisionID), label: r.DivisionName }))
      );
      setHeaderDropdownOptions(hdrDropdownOpts || {});
      console.log("%c[C2F] Header dropdown options fetched:", "color:#8b5cf6;font-weight:600", Object.keys(hdrDropdownOpts || {}));
    } catch (err) {
      console.error("[C2F] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load C2F header configuration.");
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
        C2F_CONFIG.RB_DETAIL,
        C2F_CONFIG.STORAGE_ENTRY_META
      );
      rawDetailRbMetaRef.current  = meta;
      rawDetailColumnsRef.current = apiColumns;

      // Build event column set — Qty and Rate drive Amount auto-calc
      const evtSet = buildEventColumnSet(apiColumns, ["Qty", "Rate"]);
      ["Qty", "Rate"].forEach((k) => evtSet.add(k));
      setEventColumns(evtSet);

      setAllColumns(apiColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType || null })));
      console.log("%c[C2F] Detail columns received:", "color:#6366f1;font-weight:600", apiColumns.length);
    } catch (err) {
      console.error("[C2F] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load C2F item grid configuration.");
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
      console.warn("[C2F] fetchGridColumns called before fetchDetailMeta completed.");
      return [];
    }

    try {
      // All ColCtrlType=4 columns (including CWIPAccID if in detail) auto-resolved
      // via GET_FILTER_DETAIL using each column's ObjDetID — fully dynamic.
      const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
        funcCode:              C2F_CONFIG.RB_DETAIL,
        divisionID:            Number(divisionID) || 0,
        existingRecordEdit,
        rowData:               masterRow,
        fetchUnlockedDropdowns,
      });

      const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
        filterable:          false,
        allEditable:         true,
        existingRecordEdit,
      });
      setColumns(gridColumns);
      console.log("%c[C2F] Grid columns built:", "color:#22c55e;font-weight:600", gridColumns.length);
      return gridColumns;
    } catch (err) {
      console.error("[C2F] fetchGridColumns failed:", err);
      return [];
    }
  }, [get]);

  // ── fireCellEvent — Qty / Rate → Amount recalc ────────────────────────────
  const fireCellEvent = useCallback(async (colName, rowData, headerValues) => {
    if (!C2F_CONFIG.SP_GRID_EVENT) return null;
    try {
      const { id, ...newRowData } = rowData;
      const result = await get(ENDPOINTS.FN_TBL_RB_GRID_EVENT, {
        GridEventFuncName: C2F_CONFIG.SP_GRID_EVENT,
        EventColName:      colName,
        DetJSON:           JSON.stringify([newRowData]),
        MstJSon:           JSON.stringify([headerValues]),
      });
      console.log("%c[C2F] CellEvent response:", "color:#f59e0b;font-weight:600", { col: colName, result });
      return result;
    } catch (err) {
      console.error("[C2F] fireCellEvent failed:", err);
      return null;
    }
  }, [get]);

  // ── seedOptionsFromMaster — edit mode: pre-fill dropdowns from saved record ─
  const seedOptionsFromMaster = useCallback((master) => {
    if (master.DivisionID != null && master.DivisionName) {
      setDivisionOptions([{ value: String(master.DivisionID), label: master.DivisionName }]);
    }
    if (master.LocationID != null && master.LocationName) {
      setLocationOptions([{ value: String(master.LocationID), label: master.LocationName }]);
    }
    if (master.CostCenterAccID != null && master.CostCenterName) {
      setCostCenterOptions([{ value: String(master.CostCenterAccID), label: master.CostCenterName }]);
    }
  }, []);

  // ── fetchUnlockedHeaderDropdowns — enter edit mode: reload editable dropdowns
  const fetchUnlockedHeaderDropdowns = useCallback(async (divisionId, tranDate) => {
    if (!headerColumns.length) return;
    const isEditable  = (c) => isTruthyApiFlag(c.IsEditAllow) && !isLockOnEditModeCol(c);
    const needsDivision    = headerColumns.some((c) => c.ColName === "DivisionID"    && isEditable(c));
    const needsLocation    = headerColumns.some((c) => c.ColName === "LocationID"    && isEditable(c));
    const needsCostCenter  = headerColumns.some((c) => c.ColName === "CostCenterAccID" && isEditable(c));

    const tasks = [];
    if (needsDivision) {
      tasks.push(
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: C2F_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{
            prmUserID:    DEFAULT_LOGIN_ID,
            prmCompanyID: DEFAULT_COMPANY_ID,
            prmYearID:    C2F_CONFIG.DIVISION_YEAR_ID,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        })
          .then((res) => setDivisionOptions((res?.Table || []).map((r) => ({ value: String(r.DivisionID), label: r.DivisionName }))))
          .catch(() => {})
      );
    }
    if (needsLocation && divisionId)   tasks.push(fetchLocations(divisionId));
    if (needsCostCenter)               tasks.push(fetchCostCenters(divisionId, tranDate));
    await Promise.all(tasks);
  }, [headerColumns, get, fetchLocations, fetchCostCenters]);

  // ── fetchEditRecord ────────────────────────────────────────────────────────
  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
    const [mstRes, detRes] = await Promise.all([
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: C2F_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode:  C2F_CONFIG.RB_MASTER,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: C2F_CONFIG.SP_DETAIL_FILL,
        prmParameters,
        prmFuncCode:  C2F_CONFIG.RB_DETAIL,
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

  const clearLocations  = useCallback(() => setLocationOptions([]), []);
  const clearSaveError  = useCallback(() => setSaveError(null), []);

  return {
    // Header
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, locationOptions, costCenterOptions, headerDropdownOptions,
    fetchLocations, clearLocations,
    fetchCostCenters,
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
