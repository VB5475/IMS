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
import { AOP_CONFIG, AOP_ITEM_TYPE_ID } from "../pages/assets-item-opening/constants";
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
} from "../utils/gridUtils";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId)  || DEFAULT_COMPANY_ID,
    Number(yearId)     || AOP_CONFIG.CONFIG_YEAR_ID,
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
    TranCode:    master.TranCode     != null ? String(master.TranCode)       : "",
    DivisionID:  master.DivisionID   != null ? Number(master.DivisionID)     : 0,
    ItemGroupID: master.ItemGroupID  != null ? Number(master.ItemGroupID)    : 0,
    ItemID:      master.ItemID       != null ? Number(master.ItemID)         : 0,
    AccountID:   master.AccountID    != null ? Number(master.AccountID)      : 0,
    Remark:      master.Remark       ?? "",
    FuncCode:    master.FuncCode     ?? AOP_CONFIG.RB_MASTER,
    TranMstGenID: master.TranMstGenID != null ? Number(master.TranMstGenID)  : 0,
    CompanyID:   Number(params.companyId)  || DEFAULT_COMPANY_ID,
    YearID:      Number(master.Year_ID ?? params.yearId) || AOP_CONFIG.CONFIG_YEAR_ID,
    LoginID:     Number(master.LoginID ?? params.loginId) || getUserSession().loginId,
    SessionID:   Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    IDNumber:    Number(master.IDNumber ?? params.idNumber) || 0,
    UserID:      getUserSession().userId,
    CompUniqueKey: master.CompUniqueKey ?? master.IDNumber ?? params.idNumber ?? 0,
  };
}

function mapDetailRowsToGridRows(rows) {
  return (rows || []).map((row, index) => ({
    ...row,
    id: String(row.CompUniqueKey ?? row.IDNumber ?? row.MasterID ?? `edit_${index}`),
  }));
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: AOP_CONFIG.SP_RB_META,
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

export function useAssetsItemOpening(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

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
        JSon: JSON.stringify([{ prmItemTypeID: AOP_ITEM_TYPE_ID }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.MainGroupID ?? r.ItemGroupID ?? r.IDNumber ?? 0),
        label: String(r.MainGroupName ?? r.ItemGroupName ?? r.GroupName ?? ""),
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
          prmDivisionID:  Number(divisionId),
          prmItemGroupID: Number(itemGroupId),
          prmLoginID:     DEFAULT_LOGIN_ID,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.ItemID ?? r.IDNumber ?? 0),
        label: String((r.ItemCode ? r.ItemCode + " | " : "") + (r.ItemName ?? "")),
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
          PrmDivisionID:    Number(divisionId),
          PrmAcMainGroupID: 7,           // ⚠️ DBA CONFIRM
          PrmLoginID:       DEFAULT_LOGIN_ID,
          PrmCompanyID:     DEFAULT_COMPANY_ID,
          PrmYearID:        AOP_CONFIG.CONFIG_YEAR_ID,
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
        JSon: JSON.stringify([{ prmRBCode: AOP_CONFIG.RB_MASTER }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error("No AOP header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      localStorage.setItem(AOP_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  DEFAULT_LOGIN_ID,
      });
      setHeaderColumns(colData?.Links || []);

      if (skipListDropdowns) {
        setDivisionOptions([]);
        return;
      }

      const divisionData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AOP_CONFIG.SP_DIVISIONS,
        JSon: JSON.stringify([{
          prmUserID:    DEFAULT_LOGIN_ID,
          prmCompanyID: DEFAULT_COMPANY_ID,
          prmYearID:    AOP_CONFIG.DIVISION_YEAR_ID,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      }).catch((err) => { console.warn("[AOP] Division fetch failed:", err); return null; });

      setDivisionOptions(
        (divisionData?.Table || []).map((r) => ({ value: String(r.DivisionID), label: r.DivisionName }))
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
      setAllColumns(apiColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType || null })));
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
    if (master.DivisionID != null && master.DivisionName) {
      setDivisionOptions([{ value: String(master.DivisionID), label: master.DivisionName }]);
    }
    if (master.ItemGroupID != null && master.ItemGroupName) {
      setItemGroupOptions([{ value: String(master.ItemGroupID), label: master.ItemGroupName }]);
    }
    if (master.ItemID != null && master.ItemName) {
      setItemOptions([{
        value: String(master.ItemID),
        label: String((master.ItemCode ? master.ItemCode + " | " : "") + (master.ItemName ?? "")),
      }]);
    }
    if (master.AccountID != null && (master.AccountName ?? master.AcName)) {
      setAssetsAccOptions([{
        value: String(master.AccountID),
        label: String((master.AcCode ?? "") + " | " + (master.AccountName ?? master.AcName ?? "")),
      }]);
    }
  }, []);

  // ── fetchUnlockedHeaderDropdowns — enter edit mode ─────────────────────────
  const fetchUnlockedHeaderDropdowns = useCallback(async (divisionId, itemGroupId) => {
    if (!headerColumns.length) return;
    const isEditable = (c) => isTruthyApiFlag(c.IsEditAllow) && !isLockOnEditModeCol(c);
    const needsDivision = headerColumns.some((c) => c.ColName === "DivisionID"  && isEditable(c));
    const needsGroup    = headerColumns.some((c) => c.ColName === "ItemGroupID" && isEditable(c));
    const needsItem     = headerColumns.some((c) => c.ColName === "ItemID"      && isEditable(c));
    const needsAcc      = headerColumns.some((c) => c.ColName === "AccountID"   && isEditable(c));

    const tasks = [];
    if (needsDivision) {
      tasks.push(
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: AOP_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{
            prmUserID: DEFAULT_LOGIN_ID, prmCompanyID: DEFAULT_COMPANY_ID, prmYearID: AOP_CONFIG.DIVISION_YEAR_ID,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        })
          .then((res) => setDivisionOptions((res?.Table || []).map((r) => ({ value: String(r.DivisionID), label: r.DivisionName }))))
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
