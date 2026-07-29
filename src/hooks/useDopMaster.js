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
// DOP-specific vs C2F/PV: no TranDate, no Division/Location cascade, no
// EnterpriseSummaryPanel, no cell events (no computed columns per MRD).
// Entity cascades from Tran Type (fetchEntityOptions).

import { useState, useCallback, useRef } from "react";
import { useApi } from "../api/useApi";
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

function mapDetailRowsToGridRows(rows) {
  return (rows || []).map((row, index) => ({
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

/** One detail-grid pipeline (meta fetch + lazy column build) — used twice, for
 *  Amount Detail and Employee Detail, so the two grids stay fully independent. */
function useDetailGridPipeline(get, rbCode, storageKey) {
  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const rawColumnsRef = useRef([]);
  const rawMetaRef = useRef(null);

  const fetchDetailMeta = useCallback(async () => {
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
    }
  }, [get, rbCode, storageKey]);

  const fetchGridColumns = useCallback(
    async (divisionID = 0, editOpts = false) => {
      const opts = typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
      const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

      const apiColumns = rawColumnsRef.current;
      const meta = rawMetaRef.current;
      if (!apiColumns.length || !meta) {
        console.warn(`[DOP] fetchGridColumns called before fetchDetailMeta completed for ${rbCode}.`);
        return [];
      }

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
        });
        setColumns(gridColumns);
        return gridColumns;
      } catch (err) {
        console.error(`[DOP] fetchGridColumns failed for ${rbCode}:`, err);
        return [];
      }
    },
    [get, rbCode]
  );

  return { columns, allColumns, isFetching, metaError, fetchDetailMeta, fetchGridColumns };
}

export function useDopMaster(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [tranTypeOptions, setTranTypeOptions] = useState([]);
  const [entityOptions, setEntityOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [companyOptions, setCompanyOptions] = useState([]);

  const amountGrid = useDetailGridPipeline(get, DOP_CONFIG.RB_AMOUNT_DETAIL, DOP_CONFIG.STORAGE_AMOUNT_META);
  const userGrid = useDetailGridPipeline(get, DOP_CONFIG.RB_USER_DETAIL, DOP_CONFIG.STORAGE_USER_META);

  const [saveError, setSaveError] = useState(null);
  const clearSaveError = useCallback(() => setSaveError(null), []);

  // ── fetchEntityOptions — cascade from Tran Type ───────────────────────────
  // Takes the Tran Type's "code" (e.g. "PUR_IND"), not its idnumber — the
  // entity-fetch SP's @prmref_trantype expects the code, per live confirmation.
  const fetchEntityOptions = useCallback(
    async (tranTypeCode) => {
      if (!tranTypeCode || tranTypeCode === "0") { setEntityOptions([]); return []; }
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: DOP_CONFIG.SP_ENTITY,
          JSon: JSON.stringify([{ prmref_trantype: String(tranTypeCode) }]),
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

      const [tranTypeRes, deptRes, companyRes] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2, ObjName: DOP_CONFIG.SP_TRAN_TYPE, JSon: JSON.stringify([{}]),
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
    tranTypeOptions, entityOptions, departmentOptions, companyOptions,
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
