// useDopMaster.js — Header meta, cascading dropdowns, and two detail grids
// (Amount Detail + Employee Detail) for DOP Master.
//
// Same 3-phase load pattern as usePurchaseVoucher.js / useCWIPToFA.js, run
// twice for the two independent detail grids:
//
//   fetchHeaderMeta        → RB_MASTER → GET_DETAIL_COL_DATA + Tran Type/Department/Company (parallel)
//   fetchAmountDetailMeta  → RB_AMOUNT_DETAIL → GET_DETAIL_COL_DATA (columns only)
//   fetchAmountGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (lazy on first Add New)
//   fetchUserDetailMeta / fetchUserGridColumns — same, for RB_USER_DETAIL
//
// DOP-specific vs C2F/PV: no TranDate, no Location cascade, no
// EnterpriseSummaryPanel, no cell events (no computed columns per MRD).
// Entity cascades from Tran Type (fetchEntityOptions). Division IS present
// on the live header RB (2026-08-12 bug fix) — fetched the same
// non-cascading way as Department/Company, not tied to any other field.

import { useState, useCallback, useRef, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { DOP_CONFIG } from "../pages/dop-master/constants";
import { fetchDropdownOptions, buildGridColumns } from "../utils/gridUtils";

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

function mapMasterRowToHeaderValues(master) {
  return {
    ...master,
    yearid: getUserSession().yearId,
    funccode: DOP_CONFIG.RB_MASTER,
    loginid: getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
  };
}

// 2026-08-17 (/pm) — project-wide sentinel-row fix (see usePurchaseInquiry.js
// for the original bug write-up). A detail-fill SP with nothing to return
// sends a single {ErrCode, ErrMsg} "no data" row instead of an empty array;
// without this guard it was loaded as one phantom blank grid row instead of
// showing the grid's emptyMessage.
import { isErrorOnlyRow } from "../utils/apiResponse";

function mapDetailRowsToGridRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 1 && isErrorOnlyRow(list[0])) return [];
  return list.map((row, index) => ({
    ...row,
    id: String(row.compuniquekey ?? row.idnumber ?? row.masterid ?? `edit_${index}`),
  }));
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: DOP_CONFIG.SP_RB_META,
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

// Read-only regardless of buildGridColumns' allEditable:true — srno is
// auto-numbered by DopMasterForm.jsx (handleAddEmployeeToBand, step of
// DOP_SRNO_STEP per band), never a real user input, on either detail grid.
// Same override pattern as useDMTranTypeLink.js's GRID_READ_ONLY_COLS.
const DETAIL_GRID_READ_ONLY_COLS = new Set(["srno"]);

/** One detail-grid pipeline (meta fetch + lazy column build) — used twice, for
 *  Amount Detail and Employee Detail, so the two grids stay fully independent. */
function useDetailGridPipeline(get, rbCode, storageKey) {
  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const rawColumnsRef = useRef([]);
  const rawMetaRef = useRef(null);

  // In-flight de-dupe — the mount effect and a fast edit load (via
  // fetchGridColumns' self-heal below) can both ask for the meta before the
  // first request resolves; share one request instead of firing two.
  const inflightMetaRef = useRef(null);
  const fetchDetailMeta = useCallback(async () => {
    if (inflightMetaRef.current) return inflightMetaRef.current;
    const run = (async () => {
      setIsFetching(true);
      setMetaError(null);
      try {
        const { meta, apiColumns } = await loadRbDetailGridMeta(get, rbCode, storageKey);
        rawMetaRef.current = meta;
        rawColumnsRef.current = apiColumns;
        setAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
        return apiColumns;
      } catch (err) {
        console.error(`[DOP] fetchDetailMeta failed for ${rbCode}:`, err);
        setMetaError(err?.message || "Failed to load grid configuration.");
        return [];
      } finally {
        setIsFetching(false);
        inflightMetaRef.current = null;
      }
    })();
    inflightMetaRef.current = run;
    return run;
  }, [get, rbCode, storageKey]);

  const fetchGridColumns = useCallback(
    async (divisionID = 0, editOpts = false) => {
      const opts = typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
      const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

      let apiColumns = rawColumnsRef.current;
      let meta = rawMetaRef.current;
      if (!apiColumns.length || !meta) {
        // The detail-grid meta is fetched in parallel with the header meta on
        // mount, so a fast edit load can reach here before it resolves. Load
        // it now (deduped) instead of bailing with empty columns — returning
        // [] here left the Amount/Employee detail grids with no columns on
        // edit, so their rows couldn't render until the user entered edit mode.
        apiColumns = await fetchDetailMeta();
        meta = rawMetaRef.current;
      }
      if (!apiColumns.length || !meta) return [];

      try {
        const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
          funcCode: rbCode,
          divisionID: Number(divisionID) || 0,
          existingRecordEdit,
          rowData: masterRow,
          fetchUnlockedDropdowns,
        });
        const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
          filterable: false,
          allEditable: true,
          existingRecordEdit,
        }).map((col) =>
          DETAIL_GRID_READ_ONLY_COLS.has(col.key) ? { ...col, isEditAllow: false } : col
        );
        setColumns(gridColumns);
        return gridColumns;
      } catch (err) {
        console.error(`[DOP] fetchGridColumns failed for ${rbCode}:`, err);
        return [];
      }
    },
    [get, rbCode, fetchDetailMeta]
  );

  return { columns, allColumns, isFetching, metaError, fetchDetailMeta, fetchGridColumns };
}

export function useDopMaster(baseURL = API_BASE_URL) {
  const { get: rawGet } = useApi(baseURL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [tranTypeOptions, setTranTypeOptions] = useState([]);
  const [entityOptions, setEntityOptions] = useState([]);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [companyOptions, setCompanyOptions] = useState([]);

  const amountGrid = useDetailGridPipeline(get, DOP_CONFIG.RB_AMOUNT_DETAIL, DOP_CONFIG.STORAGE_AMOUNT_META);
  const userGrid = useDetailGridPipeline(get, DOP_CONFIG.RB_USER_DETAIL, DOP_CONFIG.STORAGE_USER_META);

  const [saveError, setSaveError] = useState(null);
  const clearSaveError = useCallback(() => setSaveError(null), []);

  // ── fetchEntityOptions — cascade from Tran Type ───────────────────────────
  // Takes the Tran Type's "code" (e.g. "PUR_IND"), not its idnumber — the
  // entity-fetch SP's @prmref_trantype expects the code, per live confirmation.
  // @prmdivisionid is optional at the call site (falls back to the session's
  // division) since Entity's own MRD-given signature scopes the list by
  // division too, not just Tran Type — see the SP_ENTITY param confirmation.
  const fetchEntityOptions = useCallback(
    async (tranTypeCode, divisionId) => {
      if (!tranTypeCode || tranTypeCode === "0") { setEntityOptions([]); return []; }
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: DOP_CONFIG.SP_ENTITY,
          JSon: JSON.stringify([{
            prmref_trantype: String(tranTypeCode),
            prmdivisionid: Number(divisionId) || 0,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = (res || []).map((r) => ({
          value: String(r.idnumber),
          label: String(r.name ?? ""),
        }));
        setEntityOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[DOP] Entity fetch failed:", err);
        setEntityOptions([]);
        return [];
      }
    },
    [get]
  );

  const clearEntityOptions = useCallback(() => setEntityOptions([]), []);

  // ── fetchHeaderMeta ────────────────────────────────────────────────────────
  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const session = getUserSession();
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: DOP_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: DOP_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No DOP Master header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(DOP_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: session.loginId,
      });
      setHeaderColumns(colData || []);

      const [tranTypeRes, divisionRes, deptRes, companyRes] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2, ObjName: DOP_CONFIG.SP_TRAN_TYPE, JSon: JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch(() => null),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2, ObjName: DOP_CONFIG.SP_DIVISION,
          JSon: JSON.stringify([{
            prmuserid: session.loginId,
            prmcompanyid: session.companyId,
            prmyearid: session.yearId,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch(() => null),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2, ObjName: DOP_CONFIG.SP_DEPARTMENT, JSon: JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch(() => null),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2, ObjName: DOP_CONFIG.SP_COMPANY, JSon: JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch(() => null),
      ]);

      setTranTypeOptions(
        (tranTypeRes || []).map((r) => ({
          value: String(r.idnumber ?? r.trantypeid),
          label: String(r.trantype ?? ""),
          // Kept alongside value/label so the Tran Type → Entity cascade can
          // look up the code for the selected id (Entity fetch needs the
          // code, not the idnumber — see fetchEntityOptions).
          code: String(r.code ?? ""),
        }))
      );
      setDivisionOptions(
        (divisionRes || []).map((r) => ({
          value: String(r.divisionid),
          label: r.divisionname,
        }))
      );
      setDepartmentOptions(
        (deptRes || []).map((r) => ({
          value: String(r.idnumber ?? r.departmentid ?? r.deptid),
          label: r.department ?? r.deptname ?? r.name ?? String(r.idnumber),
        }))
      );
      setCompanyOptions(
        (companyRes || []).map((r) => ({
          value: String(r.idnumber),
          label: String(r.company ?? ""),
        }))
      );
    } catch (err) {
      console.error("[DOP] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load DOP Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // ── fetchEditRecord — master + both detail grids ──────────────────────────
  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
      const [mstRes, amountRes, userRes] = await Promise.all([
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: DOP_CONFIG.SP_MASTER_FILL,
          prmParameters,
          prmFuncCode: DOP_CONFIG.RB_MASTER,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: DOP_CONFIG.SP_AMOUNT_DETAIL_FILL,
          prmParameters,
          prmFuncCode: DOP_CONFIG.RB_AMOUNT_DETAIL,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: DOP_CONFIG.SP_USER_DETAIL_FILL,
          prmParameters,
          prmFuncCode: DOP_CONFIG.RB_USER_DETAIL,
        }),
      ]);
      const master = mstRes?.[0] ?? null;
      return {
        master,
        headerValues: master ? mapMasterRowToHeaderValues(master) : null,
        amountDetails: mapDetailRowsToGridRows(amountRes || []),
        userDetails: mapDetailRowsToGridRows(userRes || []),
      };
    },
    [get]
  );

  const fetchListRows = useCallback(
    async (listParams) => {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
      return Array.isArray(res) ? res : (res ?? []);
    },
    [get]
  );

  return {
    // Header
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    tranTypeOptions, entityOptions, divisionOptions, departmentOptions, companyOptions,
    fetchEntityOptions, clearEntityOptions,
    // Amount Detail grid
    amountColumns: amountGrid.columns,
    amountAllColumns: amountGrid.allColumns,
    amountFetching: amountGrid.isFetching,
    amountMetaError: amountGrid.metaError,
    fetchAmountDetailMeta: amountGrid.fetchDetailMeta,
    fetchAmountGridColumns: amountGrid.fetchGridColumns,
    // Employee (User) Detail grid
    userColumns: userGrid.columns,
    userAllColumns: userGrid.allColumns,
    userFetching: userGrid.isFetching,
    userMetaError: userGrid.metaError,
    fetchUserDetailMeta: userGrid.fetchDetailMeta,
    fetchUserGridColumns: userGrid.fetchGridColumns,
    // Edit / List
    fetchEditRecord, fetchListRows,
    // Save
    saveError, setSaveError, clearSaveError,
  };
}
