// useAssetsItemOpening.js — Header meta, detail grid, and filter dropdowns for Assets Item Opening (AOP)
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 3-phase load pattern (same as useAstDepCA / useCWIPToFA):
//
//   fetchHeaderMeta  → RB_AstItemOpeMst → GET_DETAIL_COL_DATA + Division (parallel)
//   fetchDetailMeta  → RB_AstItemOpeDet → GET_DETAIL_COL_DATA (columns only)
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (lazy on first Add New)
//
// AOP-specific cascade:
//   DivisionID  → fetchItemGroups(divisionId) + fetchAssetsAcc(divisionId) + clear ItemID
//   ItemGroupID → fetchItems(divisionId, itemGroupId) + clear grid

import { useState, useCallback, useRef, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { AOP_CONFIG, AOP_ITEM_TYPE_ID } from "../pages/assets-item-opening/constants";
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
} from "../utils/gridUtils";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  const session = getUserSession();
  return [
    Number(companyId)  || session.companyId,
    Number(yearId)     || session.yearId,
    Number(loginId)    || session.loginId,
    Number(sessionId)  || DEFAULT_SESSION_ID,
    Number(idNumber)   || 0,
  ].join(",");
}

function mapMasterRowToHeaderValues(master) {
  const toDateInput = (value) => {
    if (!value) return "";
    if (typeof value === "string" && value.includes("T")) return value.split("T")[0];
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  return {
    ...master,
    trandate:  toDateInput(master.trandate),
    yearid:    getUserSession().yearId,
    funccode:  AOP_CONFIG.RB_MASTER,
    loginid:   getUserSession().loginId,
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
    ObjName: AOP_CONFIG.SP_RB_META,
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
    prmLoginID:  getUserSession().loginId,
  });
  return { meta, apiColumns: colData || [] };
}

export function useAssetsItemOpening(baseURL = API_BASE_URL) {
  const { get: rawGet } = useApi(baseURL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  // ── Header (master) state ──────────────────────────────────────────────────
  const [headerColumns,  setHeaderColumns]  = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError,    setHeaderError]    = useState(null);

  const [divisionOptions,  setDivisionOptions]  = useState([]);
  const [itemGroupOptions, setItemGroupOptions] = useState([]);
  const [itemOptions,      setItemOptions]      = useState([]);
  const [assetsAccOptions, setAssetsAccOptions] = useState([]);

  // ── Detail grid state ──────────────────────────────────────────────────────
  const [columns,    setColumns]    = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [metaError,  setMetaError]  = useState(null);
  const [saveError,  setSaveError]  = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef  = useRef(null);

  // ── fetchItemGroups — cascade from Division ────────────────────────────────
  const fetchItemGroups = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === "0") { setItemGroupOptions([]); return []; }
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AOP_CONFIG.SP_ITEM_GROUP,
        JSon: JSON.stringify([{ prmitemtypeid: AOP_ITEM_TYPE_ID }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: r.idnumber,
        label: String(r.maingroup ?? ""),
      }));
      setItemGroupOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[AOP] Item Group fetch failed:", err);
      setItemGroupOptions([]);
      return [];
    }
  }, [get]);

  const clearItemGroupOptions = useCallback(() => setItemGroupOptions([]), []);

  // ── fetchItems — cascade from Division + ItemGroup ─────────────────────────
  const fetchItems = useCallback(async (divisionId, itemGroupId) => {
    if (!divisionId || !itemGroupId || divisionId === "0" || itemGroupId === "0") {
      setItemOptions([]);
      return [];
    }
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AOP_CONFIG.SP_ITEM,
        JSon: JSON.stringify([{
          prmdivisionid:  Number(divisionId),
          prmitemgroupid: Number(itemGroupId),
          prmloginid:     getUserSession().loginId,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.itemid ?? r.idnumber ?? 0),
        label: String(r.itemname ?? ""),
      }));
      setItemOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[AOP] Item fetch failed:", err);
      setItemOptions([]);
      return [];
    }
  }, [get]);

  const clearItemOptions = useCallback(() => setItemOptions([]), []);

  // ── fetchAssetsAccByDivision ───────────────────────────────────────────────
  const fetchAssetsAccByDivision = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === "0") { setAssetsAccOptions([]); return []; }
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AOP_CONFIG.SP_ASSETS_ACC,
        JSon: JSON.stringify([{
          prmdivisionid:    Number(divisionId),
          prmacmaingroupid: 7,           // ⚠️ DBA CONFIRM
          prmloginid:       getUserSession().loginId,
          prmcompanyid:     getUserSession().companyId,
          prmyearid:        getUserSession().yearId,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.accountid ?? r.acid ?? 0),
        label: String(r.acname ?? ""),
      }));
      setAssetsAccOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[AOP] Assets A/C fetch failed:", err);
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
        ObjName: AOP_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: AOP_CONFIG.RB_MASTER }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No AOP header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(AOP_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  getUserSession().loginId,
      });
      setHeaderColumns(colData || []);

      if (skipListDropdowns) {
        setDivisionOptions([]);
        return;
      }

      const divisionData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AOP_CONFIG.SP_DIVISIONS,
        JSon: JSON.stringify([{
          prmuserid:    getUserSession().loginId,
          prmcompanyid: getUserSession().companyId,
          prmyearid:    getUserSession().yearId,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      }).catch((err) => { console.warn("[AOP] Division fetch failed:", err); return null; });

      setDivisionOptions(
        (divisionData || []).map((r) => ({ value: String(r.divisionid), label: r.divisionname }))
      );
    } catch (err) {
      console.error("[AOP] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load AOP header configuration.");
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
        AOP_CONFIG.RB_DETAIL,
        AOP_CONFIG.STORAGE_ENTRY_META,
      );
      rawDetailRbMetaRef.current  = meta;
      rawDetailColumnsRef.current = apiColumns;
      setAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
    } catch (err) {
      console.error("[AOP] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load AOP item grid configuration.");
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
      console.warn("[AOP] fetchGridColumns called before fetchDetailMeta completed.");
      return [];
    }

    try {
      const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
        funcCode:              AOP_CONFIG.RB_DETAIL,
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
      return gridColumns;
    } catch (err) {
      console.error("[AOP] fetchGridColumns failed:", err);
      return [];
    }
  }, [get]);

  const fireCellEvent = useCallback(async () => null, []);

  // ── seedOptionsFromMaster — edit mode: pre-fill dropdowns from saved record ─
  const seedOptionsFromMaster = useCallback((master) => {
    // Label fields confirmed live on GetMasterDataFill (fn_tbl_rb_astitemopemst):
    // division, itemgroup, item, account — not the guessed *name/ac* variants.
    const divisionLabel = master.division ?? master.divisionname;
    if (master.divisionid != null && divisionLabel) {
      setDivisionOptions([{ value: String(master.divisionid), label: divisionLabel }]);
    }
    const itemGroupLabel = master.itemgroup ?? master.itemgroupname;
    if (master.itemgroupid != null && itemGroupLabel) {
      setItemGroupOptions([{ value: String(master.itemgroupid), label: itemGroupLabel }]);
    }
    const itemLabel = master.item ?? master.itemname;
    if (master.itemid != null && itemLabel) {
      setItemOptions([{
        value: String(master.itemid),
        label: String(itemLabel ?? ""),
      }]);
    }
    const accountLabel = master.account ?? master.accountname ?? master.acname;
    if (master.accountid != null && master.accountid !== 0 && accountLabel) {
      setAssetsAccOptions([{
        value: String(master.accountid),
        label: String(accountLabel ?? ""),
      }]);
    }
  }, []);

  // ── fetchUnlockedHeaderDropdowns — enter edit mode ─────────────────────────
  const fetchUnlockedHeaderDropdowns = useCallback(async (divisionId, itemGroupId) => {
    if (!headerColumns.length) return;
    const isEditable = (c) => isTruthyApiFlag(c.iseditallow) && !isLockOnEditModeCol(c);
    const needsDivision = headerColumns.some((c) => c.colname === "divisionid"  && isEditable(c));
    const needsGroup    = headerColumns.some((c) => c.colname === "itemgroupid" && isEditable(c));
    const needsItem     = headerColumns.some((c) => c.colname === "itemid"      && isEditable(c));
    const needsAcc      = headerColumns.some((c) => c.colname === "accountid"   && isEditable(c));

    const tasks = [];
    if (needsDivision) {
      tasks.push(
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: AOP_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{
            prmuserid: getUserSession().loginId, prmcompanyid: getUserSession().companyId, prmyearid: getUserSession().yearId,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        })
          .then((res) => setDivisionOptions((res || []).map((r) => ({ value: String(r.divisionid), label: r.divisionname }))))
          .catch(() => {})
      );
    }
    if (needsGroup   && divisionId)              tasks.push(fetchItemGroups(divisionId));
    if (needsItem    && divisionId && itemGroupId) tasks.push(fetchItems(divisionId, itemGroupId));
    if (needsAcc     && divisionId)              tasks.push(fetchAssetsAccByDivision(divisionId));
    await Promise.all(tasks);
  }, [headerColumns, get, fetchItemGroups, fetchItems, fetchAssetsAccByDivision]);

  // ── fetchEditRecord ────────────────────────────────────────────────────────
  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
    const [mstRes, detRes] = await Promise.all([
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: AOP_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode:  AOP_CONFIG.RB_MASTER,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: AOP_CONFIG.SP_DETAIL_FILL,
        prmParameters,
        prmFuncCode:  AOP_CONFIG.RB_DETAIL,
      }),
    ]);
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? mapMasterRowToHeaderValues(master) : null,
      details:      mapDetailRowsToGridRows(detRes || []),
    };
  }, [get]);

  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    // Header
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, itemGroupOptions, itemOptions, assetsAccOptions,
    fetchItemGroups, clearItemGroupOptions,
    fetchItems,      clearItemOptions,
    fetchAssetsAccByDivision, clearAssetsAccOptions,
    // Detail grid
    columns, allColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns, fireCellEvent,
    // Edit
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    // Save
    saveError, clearSaveError,
  };
}
