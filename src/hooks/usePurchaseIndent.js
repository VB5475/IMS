// usePurchaseIndent.js — Header meta, detail grid, and filter dropdowns for Purchase Indent
// ─────────────────────────────────────────────────────────────────────────────────────────
// Mirrors usePurchaseOrder.js — same three-phase load pattern:
//
//   fetchHeaderMeta  → RB_PurIndtMst → GetDetailColData + Division + Dept (parallel)
//   fetchDetailMeta  → RB_PurIndentDet → GetDetailColData (columns only)
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (lazy on first Add New)
//
// Indent-specific vs PO:
//   fetchIndentTypes(divisionId)  — cascade: Division → Indent Type
//   fetchLocations()              — Fn_Gen_FetchLocationMaster (add + edit unlock)
//   No supplier, currency, amend, or 3rd detail table (simpler than PO)

import { useState, useCallback, useRef } from "react";
import axios from "axios";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_TIMEOUT,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { IND_CONFIG } from "../pages/purchase-indent/constants";
import { fetchDropdownOptions, buildGridColumns, isTruthyApiFlag, isLockOnEditModeCol } from "../utils/gridUtils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatIndentTranDate(dateVal) {
  const d = dateVal ? new Date(dateVal) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, "0")}-${MONTHS[now.getMonth()]}-${now.getFullYear()}`;
  }
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId) || DEFAULT_COMPANY_ID,
    Number(yearId) || IND_CONFIG.CONFIG_YEAR_ID,
    Number(loginId) || getUserSession().loginId,
    Number(sessionId) || DEFAULT_SESSION_ID,
    Number(idNumber) || 0,
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
    TranCode: master.TranCode != null ? String(master.TranCode) : "",
    TranDate: toDateInput(master.TranDate),
    DivisionID: master.DivisionID != null ? Number(master.DivisionID) : 0,
    ConfigID: master.ConfigID != null ? Number(master.ConfigID) : 0,
    ExpDate: toDateInput(master.ExpDate ?? master.ExpectedDate) || null,
    DeptID: master.DeptID != null ? Number(master.DeptID) : 0,
    LocationID: master.LocationID != null ? Number(master.LocationID) : 0,
    Remarks: master.Remarks ?? "",
    IndentRefrenceNo: master.IndentRefrenceNo ?? "",
    TranMstGenID: master.TranMstGenID != null ? Number(master.TranMstGenID) : 0,
    CompanyID: Number(params.companyId) || DEFAULT_COMPANY_ID,
    YearID: Number(master.Year_ID ?? params.yearId) || IND_CONFIG.CONFIG_YEAR_ID,
    LoginID: Number(master.LoginID ?? params.loginId) || getUserSession().loginId,
    SessionID: Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    IDNumber: Number(master.IDNumber ?? master.IndentID ?? params.idNumber) || 0,
    UserID: getUserSession().userId,
    CompUniqueKey: master.CompUniqueKey ?? master.IDNumber ?? master.IndentID ?? params.idNumber ?? 0,
    FuncCode: master.FuncCode ?? IND_CONFIG.RB_MASTER,
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
    if (isTruthyApiFlag(col.IsEventReq) || isTruthyApiFlag(col.IsEventCol)) {
      set.add(col.ColName);
    }
  });
  if (set.size === 0) fallbackKeys.forEach((k) => set.add(k));
  return set;
}

// Shared loader: RB code → RBID + SaveProcName → GetDetailColData columns.
async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: IND_CONFIG.SP_RB_META,
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
    prmLoginID: DEFAULT_LOGIN_ID,
  });
  const apiColumns = colData?.Links || [];
  return { meta, apiColumns };
}

export function usePurchaseIndent(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  // ── Header (master) state ───────────────────────────────────────────
  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerRbMeta, setHeaderRbMeta] = useState(null);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [indentTypeOptions, setIndentTypeOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);

  const [isLoadingIndentTypes, setIsLoadingIndentTypes] = useState(false);

  // ── Detail grid state ───────────────────────────────────────────────
  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isEventFiring, setIsEventFiring] = useState(false);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  // ── fetchLocations ──────────────────────────────────────────────────
  const fetchLocations = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IND_CONFIG.SP_LOCATION,
        JSon: JSON.stringify([{ PrmCompanyID: DEFAULT_COMPANY_ID, PrmLoginID: DEFAULT_LOGIN_ID,prmLocationType : "" }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.LocationID ?? r.LocID),
        label: r.LocationName ?? r.LocName ?? r.Location ?? String(r.LocationID ?? r.LocID),
      }));
      setLocationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[Indent] Location fetch failed:", err);
      setLocationOptions([]);
      return [];
    }
  }, [get]);

  // ── fetchDepartments ────────────────────────────────────────────────
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 1,
        ObjName: IND_CONFIG.SP_DEPT,
        JSon: JSON.stringify([{ PrmCompanyID: DEFAULT_COMPANY_ID, PrmLoginID: DEFAULT_LOGIN_ID }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.DeptID ?? r.DepartmentID),
        label: r.DeptName ?? r.DepartmentName ?? String(r.DeptID),
      }));
      setDepartmentOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[Indent] Department fetch failed:", err);
      setDepartmentOptions([]);
      return [];
    }
  }, [get]);

  // ── fetchIndentTypes — cascade from Division ────────────────────────
  const fetchIndentTypes = useCallback(
    async (divisionId) => {
      if (!divisionId || divisionId === "0") {
        setIndentTypeOptions([]);
        return [];
      }
      setIsLoadingIndentTypes(true);
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: IND_CONFIG.SP_INDENT_TYPES,
          JSon: JSON.stringify([
            {
              PrmCompanyId: DEFAULT_COMPANY_ID,
              PrmDivisionId: Number(divisionId),
              PrmYearId: IND_CONFIG.CONFIG_YEAR_ID,
              PrmUserId: DEFAULT_LOGIN_ID,
              PrmFormTag: IND_CONFIG.FORM_TAG,
              PrmRefType: "",
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = (res?.Table || []).map((r) => ({
          value: String(r.ConfigurationId),
          label: r.Name,
        }));
        setIndentTypeOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[Indent] Indent Type fetch failed:", err);
        setIndentTypeOptions([]);
        return [];
      } finally {
        setIsLoadingIndentTypes(false);
      }
    },
    [get]
  );

  // ── fetchHeaderMeta ─────────────────────────────────────────────────
  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);

    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IND_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: IND_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error("No Indent header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      setHeaderRbMeta(hdrMeta);
      localStorage.setItem(IND_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));
      console.log("%c[Indent] Header meta stored:", "color:#8b5cf6;font-weight:600", hdrMeta);

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      setHeaderColumns(colData?.Links || []);
      console.log(
        "%c[Indent] Header columns received:",
        "color:#8b5cf6;font-weight:600",
        (colData?.Links || []).length
      );

      if (skipListDropdowns) {
        setDivisionOptions([]);
        setDepartmentOptions([]);
        setLocationOptions([]);
        return;
      }

      // Phase 1: divisions + departments + locations in parallel
      const [divisionData, deptData, locationData] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: IND_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([
            {
              prmUserID: DEFAULT_LOGIN_ID,
              prmCompanyID: DEFAULT_COMPANY_ID,
              prmYearID: IND_CONFIG.DIVISION_YEAR_ID,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }).catch((err) => { console.warn("[Indent] Division fetch failed:", err); return null; }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 1,
          ObjName: IND_CONFIG.SP_DEPT,
          JSon: JSON.stringify([{ PrmCompanyID: DEFAULT_COMPANY_ID, PrmLoginID: DEFAULT_LOGIN_ID }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }).catch((err) => { console.warn("[Indent] Department fetch failed:", err); return null; }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: IND_CONFIG.SP_LOCATION,
          JSon: JSON.stringify([{ PrmCompanyID: DEFAULT_COMPANY_ID, PrmLoginID: DEFAULT_LOGIN_ID,prmLocationType : ""  }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }).catch((err) => { console.warn("[Indent] Location fetch failed:", err); return null; }),
      ]);

      setDivisionOptions(
        (divisionData?.Table || []).map((r) => ({
          value: String(r.DivisionID),
          label: r.DivisionName,
        }))
      );
      setDepartmentOptions(
        (deptData?.Table || []).map((r) => ({
          value: String(r.DeptID ?? r.DepartmentID),
          label: r.DeptName ?? r.DepartmentName ?? String(r.DeptID),
        }))
      );
      setLocationOptions(
        (locationData?.Table || []).map((r) => ({
          value: String(r.LocationID ?? r.LocID),
          label: r.LocationName ?? r.LocName ?? r.Location ?? String(r.LocationID ?? r.LocID),
        }))
      );
    } catch (err) {
      console.error("[Indent] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Indent header configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // ── fetchDetailMeta ─────────────────────────────────────────────────
  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        IND_CONFIG.RB_DETAIL,
        IND_CONFIG.STORAGE_ENTRY_META
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;

      const evtSet = buildEventColumnSet(apiColumns, ["Qty", "TranQty", "BaseQty", "Rate", "TranRate"]);
      // Force-add quantity and rate columns that drive Amount recalculation
      ["Qty", "TranQty", "BaseQty", "Rate", "TranRate", "UnitConvRate"].forEach((k) => evtSet.add(k));
      setEventColumns(evtSet);

      setAllColumns(
        apiColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType || null }))
      );
      console.log(
        "%c[Indent] Detail columns received:",
        "color:#6366f1;font-weight:600",
        apiColumns.length
      );
    } catch (err) {
      console.error("[Indent] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load Indent item grid configuration.");
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  // ── fetchGridColumns ────────────────────────────────────────────────
  const fetchGridColumns = useCallback(
    async (divisionID = 0, editOpts = false) => {
      const opts =
        typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
      const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

      const apiColumns = rawDetailColumnsRef.current;
      const meta = rawDetailRbMetaRef.current;

      if (!apiColumns.length || !meta) {
        console.warn("[Indent] fetchGridColumns called before fetchDetailMeta completed.");
        return [];
      }

      try {
        const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
          funcCode: IND_CONFIG.RB_DETAIL,
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
        console.log(
          "%c[Indent] Grid columns built:",
          "color:#22c55e;font-weight:600",
          gridColumns.length
        );
        return gridColumns;
      } catch (err) {
        console.error("[Indent] fetchGridColumns failed:", err);
        return [];
      }
    },
    [get]
  );

  // ── fireCellEvent — Qty / Rate column blur → server recalculation ───
  const fireCellEvent = useCallback(
    async (colName, rowData, headerValues) => {
      setIsEventFiring(true);
      try {
        const { id, ...newRowData } = rowData;
        const result = await get(ENDPOINTS.FN_TBL_RB_GRID_EVENT, {
          GridEventFuncName: IND_CONFIG.SP_GRID_EVENT,
          EventColName: colName,
          DetJSON: JSON.stringify([newRowData]),
          MstJSon: JSON.stringify([headerValues]),
        });
        console.log("%c[Indent] CellEvent response:", "color:#f59e0b;font-weight:600", {
          col: colName,
          result,
        });
        return result;
      } catch (err) {
        console.error("[Indent] fireCellEvent failed:", err);
        return null;
      } finally {
        setIsEventFiring(false);
      }
    },
    [get]
  );

  // ── saveTxn ─────────────────────────────────────────────────────────
  const saveTxn = useCallback(
    async (headerValues, detailRows) => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const mstMeta = JSON.parse(localStorage.getItem(IND_CONFIG.STORAGE_HEADER_META) || "null");
        const detMeta = JSON.parse(localStorage.getItem(IND_CONFIG.STORAGE_ENTRY_META) || "null");

        if (!mstMeta || !detMeta) {
          throw new Error("Missing save configuration. Please refresh and try again.");
        }

        const cleanedRows = detailRows.map(({ id, ...rest }) => rest);
        const body = {
          PrmStrMstRBName: IND_CONFIG.RB_MASTER,
          prmStrMstJSON: JSON.stringify([headerValues]),
          prmstrMasterSaveProcName: mstMeta?.SaveProcName,
          prmstrDetailSaveProcName: detMeta?.SaveProcName,
          PrmStrDetRBName: IND_CONFIG.RB_DETAIL,
          prmStrDetJSON: JSON.stringify(cleanedRows),
          p_ErrCode: -1,
          p_ErrMsg: "",
        };

        const result = await axios.post(`${baseURL}${ENDPOINTS.RB_MASTER_DETAIL_FORM_SAVE}`, body, {
          timeout: API_TIMEOUT,
          headers: { "Content-Type": "application/json", Accept: "application/json" },
        });
        console.log("%c[Indent] Save result:", "color:#22c55e;font-weight:600", result.data);
        return result.data;
      } catch (err) {
        console.error("[Indent] saveTxn failed:", err);
        setSaveError(err?.message || "Save failed. Please try again.");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [baseURL]
  );

  // ── seedOptionsFromMaster — seed single-item options from master fill response ──
  // API returns display names as: DivisionName, ConfigName, Department (not DeptName), Location (not LocationName)
  const seedOptionsFromMaster = useCallback((master) => {
    if (master.DivisionID != null && master.DivisionName) {
      setDivisionOptions([{ value: String(master.DivisionID), label: master.DivisionName }]);
    }
    if (master.ConfigID != null && master.ConfigName) {
      setIndentTypeOptions([{ value: String(master.ConfigID), label: master.ConfigName }]);
    }
    const deptLabel = master.DeptName ?? master.Department;
    if (master.DeptID != null && master.DeptID !== 0 && deptLabel) {
      setDepartmentOptions([{ value: String(master.DeptID), label: deptLabel }]);
    }
    const locLabel = master.LocationName ?? master.Location;
    if (master.LocationID != null && master.LocationID !== 0 && locLabel) {
      setLocationOptions([{ value: String(master.LocationID), label: locLabel }]);
    }
  }, []);

  // ── fetchUnlockedHeaderDropdowns — re-fetch editable dropdowns when entering edit mode ──
  const fetchUnlockedHeaderDropdowns = useCallback(
    async (divisionId) => {
      if (!headerColumns.length) return;

      const isEditable = (c) => isTruthyApiFlag(c.IsEditAllow) && !isLockOnEditModeCol(c);

      const needsDivision = headerColumns.some((c) => c.ColName === "DivisionID" && isEditable(c));
      const needsConfig = headerColumns.some((c) => c.ColName === "ConfigID" && isEditable(c));
      const needsDept = headerColumns.some((c) => c.ColName === "DeptID" && isEditable(c));
      const needsLocation = headerColumns.some((c) => c.ColName === "LocationID" && isEditable(c));

      const tasks = [];

      if (needsDivision) {
        tasks.push(
          get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: 2,
            ObjName: IND_CONFIG.SP_DIVISIONS,
            JSon: JSON.stringify([{
              prmUserID: DEFAULT_LOGIN_ID,
              prmCompanyID: DEFAULT_COMPANY_ID,
              prmYearID: IND_CONFIG.DIVISION_YEAR_ID,
            }]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          }).then((res) =>
            setDivisionOptions(
              (res?.Table || []).map((r) => ({ value: String(r.DivisionID), label: r.DivisionName }))
            )
          ).catch(() => {})
        );
      }
      if (needsConfig && divisionId) tasks.push(fetchIndentTypes(divisionId));
      if (needsDept) tasks.push(fetchDepartments());
      if (needsLocation) tasks.push(fetchLocations());
      await Promise.all(tasks);
    },
    [headerColumns, get, fetchIndentTypes, fetchDepartments, fetchLocations]
  );

  // ── fetchEditRecord — load master + detail rows for edit mode ────────
  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = buildMasterDataFillParams({
        companyId,
        yearId,
        loginId,
        sessionId,
        idNumber,
      });

      const [mstRes, detRes] = await Promise.all([
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: IND_CONFIG.SP_MASTER_FILL,
          prmParameters,
          prmFuncCode: IND_CONFIG.RB_MASTER,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: IND_CONFIG.SP_DETAIL_FILL,
          prmParameters,
          prmFuncCode: IND_CONFIG.RB_DETAIL,
        }),
      ]);

      const master = mstRes?.Links?.[0] ?? null;
      const params = { companyId, yearId, loginId, sessionId, idNumber };

      return {
        master,
        headerValues: master ? mapMasterRowToHeaderValues(master, params) : null,
        details: mapDetailRowsToGridRows(detRes?.Links || []),
      };
    },
    [get]
  );

  const clearIndentTypes = useCallback(() => setIndentTypeOptions([]), []);
  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    // header
    headerColumns,
    headerRbMeta,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    // dropdown options
    divisionOptions,
    indentTypeOptions,
    departmentOptions,
    locationOptions,
    // loaders
    isLoadingIndentTypes,
    // cascade
    fetchIndentTypes,
    clearIndentTypes,
    fetchDepartments,
    fetchLocations,
    // detail grid
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    // cell events
    fireCellEvent,
    isEventFiring,
    // edit flow
    fetchEditRecord,
    seedOptionsFromMaster,
    fetchUnlockedHeaderDropdowns,
    // save
    saveTxn,
    isSaving,
    saveError,
    clearSaveError,
  };
}
