// useAstDepIT.js — Header meta, detail grid, and filter dropdowns for
// Assets Calculate Depreciation IT Act (DIT / MRD module code "DPC" — see
// src/pages/assets-depreciation-it-act/constants.js for the naming note).
// ─────────────────────────────────────────────────────────────────────────
// Modeled directly on useAstDepCA.js (src/hooks/), the closest existing
// precedent — same 3-phase load pattern:
//
//   fetchHeaderMeta  → RB_MASTER → GET_DETAIL_COL_DATA + Division (parallel)
//   fetchDetailMeta  → RB_DETAIL → GET_DETAIL_COL_DATA (columns only)
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (lazy on first Add New)
//
// DIT-specific:
//   fetchAssetsAccByDivision(divisionId) — Fixed Account cascade from Division
//   Cascade: divisionid  → clear fixedastacid + item grid
//   Cascade: fixedastacid → clear item grid only
//   SP_ASSETS_ACC params: prmdivisionid, prmacmaingroupid (DBA CONFIRM — same
//   hardcoded 7 the sibling assets-depreciation module uses), prmloginid,
//   prmcompanyid, prmyearid

import { useState, useCallback, useRef, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL, DEFAULT_SESSION_ID } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { DIT_CONFIG } from "../pages/assets-depreciation-it-act/constants";
import { fetchDropdownOptions, buildGridColumns, isTruthyApiFlag, isLockOnEditModeCol } from "../utils/gridUtils";
import { isErrorOnlyRow } from "../utils/apiResponse";

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
    trandate: toDateInput(master.trandate),
    yearid: getUserSession().yearId,
    funccode: DIT_CONFIG.RB_MASTER,
    loginid: getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
  };
}

// 2026-08-17 (/pm) — project-wide sentinel-row fix (see usePurchaseInquiry.js
// for the original bug write-up). A detail-fill SP with nothing to return
// sends a single {ErrCode, ErrMsg} "no data" row instead of an empty array;
// without this guard it was loaded as one phantom blank grid row instead of
// showing the grid's emptyMessage.
function mapDetailRowsToGridRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 1 && isErrorOnlyRow(list[0])) return [];
  return list.map((row, index) => ({
    ...row,
    id: String(row.compuniquekey ?? row.idnumber ?? row.masterid ?? `edit_${index}`),
  }));
}

export function useAstDepIT(baseURL = API_BASE_URL) {
  const { get: rawGet } = useApi(baseURL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  // ── Header (master) state ──────────────────────────────────────────────
  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [assetsAccOptions, setAssetsAccOptions] = useState([]);

  // ── Detail grid state ─────────────────────────────────────────────────
  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  // ── fetchAssetsAccByDivision — cascade from Division ────────────────────
  const fetchAssetsAccByDivision = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === "0") { setAssetsAccOptions([]); return []; }
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: DIT_CONFIG.SP_ASSETS_ACC,
        JSon: JSON.stringify([{
          prmdivisionid: Number(divisionId),
          prmacmaingroupid: 7, // ⚠️ DBA CONFIRM — Main Group ID for Fixed Asset accounts
          prmloginid: session.loginId,
          prmcompanyid: session.companyId,
          prmyearid: session.yearId,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.accountid ?? r.acid ?? 0),
        label: String((r.accode ?? "") + " | " + (r.acname ?? "")),
      }));
      setAssetsAccOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[DIT] Assets A/C fetch failed:", err);
      setAssetsAccOptions([]);
      return [];
    }
  }, [get]);

  const clearAssetsAccOptions = useCallback(() => setAssetsAccOptions([]), []);

  // ── fetchHeaderMeta ──────────────────────────────────────────────────────
  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const session = getUserSession();
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: DIT_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: DIT_CONFIG.RB_MASTER }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No DIT header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(DIT_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: session.loginId,
      });
      const hdrApiColumns = colData || [];
      setHeaderColumns(hdrApiColumns);
      console.log("%c[DIT] Header columns received:", "color:#8b5cf6;font-weight:600", hdrApiColumns.length);

      if (skipListDropdowns) {
        setDivisionOptions([]);
        setAssetsAccOptions([]);
        return;
      }

      const divisionData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: DIT_CONFIG.SP_DIVISIONS,
        JSon: JSON.stringify([{
          prmuserid: session.loginId,
          prmcompanyid: session.companyId,
          prmyearid: session.yearId,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      }).catch((err) => { console.warn("[DIT] Division fetch failed:", err); return null; });

      setDivisionOptions(
        (divisionData || []).map((r) => ({ value: String(r.divisionid), label: r.divisionname }))
      );
    } catch (err) {
      console.error("[DIT] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Depreciation IT Act header configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // ── fetchDetailMeta ──────────────────────────────────────────────────────
  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: DIT_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: DIT_CONFIG.RB_DETAIL }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error(`No RB metadata returned for ${DIT_CONFIG.RB_DETAIL}.`);

      const meta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(DIT_CONFIG.STORAGE_DETAIL_META, JSON.stringify(meta));
      rawDetailRbMetaRef.current = meta;

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: meta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      const apiColumns = colData || [];
      rawDetailColumnsRef.current = apiColumns;
      setAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
      console.log("%c[DIT] Detail columns received:", "color:#6366f1;font-weight:600", apiColumns.length);
      return apiColumns;
    } catch (err) {
      console.error("[DIT] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load Depreciation IT Act item grid configuration.");
      return [];
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  // ── fetchGridColumns — lazy, called on first Add New or edit load ───────
  const fetchGridColumns = useCallback(async (divisionID = 0, editOpts = false) => {
    const opts = typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
    const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

    const apiColumns = rawDetailColumnsRef.current;
    const meta = rawDetailRbMetaRef.current;
    if (!apiColumns.length || !meta) {
      console.warn("[DIT] fetchGridColumns called before fetchDetailMeta completed.");
      return [];
    }

    try {
      const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
        funcCode: DIT_CONFIG.RB_DETAIL,
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
      console.log("%c[DIT] Grid columns built:", "color:#22c55e;font-weight:600", gridColumns.length);
      return gridColumns;
    } catch (err) {
      console.error("[DIT] fetchGridColumns failed:", err);
      return [];
    }
  }, [get]);

  // ── seedOptionsFromMaster — edit mode: pre-fill dropdowns from saved record ─
  // SP_MASTER_FILL returns the division/account labels as `division`/`account`
  // (not `divisionname`/`fixedastacname`) — the old field names never matched,
  // so these dropdowns silently stayed empty on every edit load despite the
  // row carrying valid divisionid/fixedastacid values. Old names kept as a
  // fallback in case another RB config still emits them.
  const seedOptionsFromMaster = useCallback((master) => {
    const divisionLabel = master.division ?? master.divisionname;
    if (master.divisionid != null && divisionLabel) {
      setDivisionOptions([{ value: String(master.divisionid), label: divisionLabel }]);
    }
    const accountLabel = master.account ?? master.fixedastacname ?? master.acname;
    if (master.fixedastacid != null && accountLabel) {
      setAssetsAccOptions([{
        value: String(master.fixedastacid),
        label: String((master.accode ?? "") + " | " + accountLabel),
      }]);
    }
  }, []);

  // ── fetchUnlockedHeaderDropdowns — enter edit mode: reload editable dropdowns
  const fetchUnlockedHeaderDropdowns = useCallback(async (divisionId) => {
    if (!headerColumns.length) return;
    const isEditable = (c) => isTruthyApiFlag(c.iseditallow) && !isLockOnEditModeCol(c);
    const needsDivision = headerColumns.some((c) => c.colname === "divisionid" && isEditable(c));
    const needsAssetAcc = headerColumns.some((c) => c.colname === "fixedastacid" && isEditable(c));

    const tasks = [];
    if (needsDivision) {
      const session = getUserSession();
      tasks.push(
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: DIT_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{
            prmuserid: session.loginId,
            prmcompanyid: session.companyId,
            prmyearid: session.yearId,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        })
          .then((res) => setDivisionOptions((res || []).map((r) => ({ value: String(r.divisionid), label: r.divisionname }))))
          .catch(() => {})
      );
    }
    if (needsAssetAcc && divisionId) tasks.push(fetchAssetsAccByDivision(divisionId));
    await Promise.all(tasks);
  }, [headerColumns, get, fetchAssetsAccByDivision]);

  // ── fetchEditRecord ───────────────────────────────────────────────────────
  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
    const [mstRes, detRes] = await Promise.all([
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: DIT_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: DIT_CONFIG.RB_MASTER,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: DIT_CONFIG.SP_DETAIL_FILL,
        prmParameters,
        prmFuncCode: DIT_CONFIG.RB_DETAIL,
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
    // Header
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, assetsAccOptions,
    fetchAssetsAccByDivision, clearAssetsAccOptions,
    // Detail grid
    columns, allColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    // Edit
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    // Save
    saveError, clearSaveError,
  };
}
