// useAstWriteOff.js — Header meta, detail grid, and cascades for Assets Write Off (AWF)
import { useState, useCallback, useRef } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { AWF_CONFIG } from "../pages/assets-write-off/constants";
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
  isVisibleApiCol,
  hasVisibleCol,
} from "../utils/gridUtils";

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
    trandate: toDateInput(master.trandate ?? master.TranDate),
    yearid: getUserSession().yearId,
    funccode: AWF_CONFIG.RB_MASTER,
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

function buildEventColumnSet(apiColumns, fallbackKeys = []) {
  const set = new Set();
  apiColumns.forEach((col) => {
    if (isTruthyApiFlag(col.iseventreq) || isTruthyApiFlag(col.iseventcol)) {
      set.add(col.colname);
    }
  });
  if (set.size === 0) fallbackKeys.forEach((k) => set.add(k));
  return set;
}

function mapAccountRows(rows) {
  return (rows || []).map((r) => ({
    value: String(r.accountid ?? r.acid ?? 0),
    label: String((r.accode ?? "") + " | " + (r.acname ?? "")),
  }));
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: AWF_CONFIG.SP_RB_META,
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

export function useAstWriteOff(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [assetsAccOptions, setAssetsAccOptions] = useState([]);
  const [profitLossAccOptions, setProfitLossAccOptions] = useState([]);

  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  const fetchAccountsByDivision = useCallback(
    async (divisionId, mainGroupId) => {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AWF_CONFIG.SP_ASSETS_ACC,
        JSon: JSON.stringify([{
          prmdivisionid: Number(divisionId) || 0,
          prmacmaingroupid: Number(mainGroupId) || 0,
          prmloginid: getUserSession().loginId,
          prmcompanyid: getUserSession().companyId,
          prmyearid: getUserSession().yearId,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      return mapAccountRows(res || []);
    },
    [get]
  );

  const fetchLocations = useCallback(async (divisionId = 0) => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AWF_CONFIG.SP_LOCATION,
        JSon: JSON.stringify([{
          prmcompanyid: getUserSession().companyId,
          prmdivisionid: Number(divisionId) || 0,
          prmloginid: getUserSession().loginId,
          prmlocationtype: "",
          prmfrmtype: String(AWF_CONFIG.FRM_TYPE),
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.locationid ?? r.locid ?? 0),
        label: r.locationname ?? r.locname ?? r.location ?? String(r.locationid ?? r.locid ?? ""),
      }));
      setLocationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[AWF] Location fetch failed:", err);
      setLocationOptions([]);
      return [];
    }
  }, [get]);

  const fetchAssetsAccByDivision = useCallback(
    async (divisionId) => {
      if (!divisionId || divisionId === "0") {
        setAssetsAccOptions([]);
        return [];
      }
      try {
        const opts = await fetchAccountsByDivision(divisionId, AWF_CONFIG.ASSETS_AC_MAIN_GROUP_ID);
        setAssetsAccOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[AWF] Asset account fetch failed:", err);
        setAssetsAccOptions([]);
        return [];
      }
    },
    [fetchAccountsByDivision]
  );

  const fetchProfitLossAccByDivision = useCallback(
    async (divisionId) => {
      if (!divisionId || divisionId === "0") {
        setProfitLossAccOptions([]);
        return [];
      }
      try {
        const opts = await fetchAccountsByDivision(divisionId, AWF_CONFIG.PROFIT_LOSS_AC_MAIN_GROUP_ID);
        setProfitLossAccOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[AWF] Profit/Loss account fetch failed:", err);
        setProfitLossAccOptions([]);
        return [];
      }
    },
    [fetchAccountsByDivision]
  );

  const clearLocationOptions = useCallback(() => setLocationOptions([]), []);
  const clearAssetsAccOptions = useCallback(() => setAssetsAccOptions([]), []);
  const clearProfitLossAccOptions = useCallback(() => setProfitLossAccOptions([]), []);

  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: AWF_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: AWF_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No AWF header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(AWF_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      const cols = colData || [];
      setHeaderColumns(cols);

      if (skipListDropdowns) {
        setDivisionOptions([]);
        setLocationOptions([]);
        setAssetsAccOptions([]);
        setProfitLossAccOptions([]);
        return;
      }

      if (hasVisibleCol(cols, "divisionid")) {
        const divisionData = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: AWF_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{
            prmuserid: getUserSession().loginId,
            prmcompanyid: getUserSession().companyId,
            prmyearid: getUserSession().yearId,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }).catch((err) => {
          console.warn("[AWF] Division fetch failed:", err);
          return null;
        });

        setDivisionOptions(
          (divisionData || []).map((r) => ({
            value: String(r.divisionid),
            label: r.divisionname,
          }))
        );
      }
    } catch (err) {
      console.error("[AWF] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Assets Write Off configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        AWF_CONFIG.RB_DETAIL,
        AWF_CONFIG.STORAGE_ENTRY_META
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;

      const evtSet = buildEventColumnSet(apiColumns, ["qty", "rate"]);
      ["qty", "rate", "Qty", "Rate"].forEach((k) => evtSet.add(k));
      setEventColumns(evtSet);

      setAllColumns(
        apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );
    } catch (err) {
      console.error("[AWF] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load item grid configuration.");
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  const fetchGridColumns = useCallback(async (divisionID = 0, editOpts = false) => {
    const opts = typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
    const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

    const apiColumns = rawDetailColumnsRef.current;
    const meta = rawDetailRbMetaRef.current;
    if (!apiColumns.length || !meta) {
      console.warn("[AWF] fetchGridColumns called before fetchDetailMeta completed.");
      return [];
    }

    try {
      const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
        funcCode: AWF_CONFIG.RB_DETAIL,
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
      console.error("[AWF] fetchGridColumns failed:", err);
      return [];
    }
  }, [get]);

  const fireCellEvent = useCallback(async () => null, []);

  const seedOptionsFromMaster = useCallback((master) => {
    if (master.divisionid != null && master.divisionname) {
      setDivisionOptions([{ value: String(master.divisionid), label: master.divisionname }]);
    }
    const locLabel = master.locationname ?? master.location ?? master.fromlocation;
    const locId = master.fromlocid ?? master.locationid;
    if (locId != null && locId !== 0 && locLabel) {
      setLocationOptions([{ value: String(locId), label: locLabel }]);
    }
    const accLabel = master.acname ?? master.accountname;
    if (master.accountid != null && master.accountid !== 0 && accLabel) {
      setAssetsAccOptions([{
        value: String(master.accountid),
        label: String((master.accode ?? "") + " | " + accLabel),
      }]);
    }
    const plLabel = master.profitlossacname ?? master.profitlossactname;
    if (master.profitlossactid != null && master.profitlossactid !== 0 && plLabel) {
      setProfitLossAccOptions([{
        value: String(master.profitlossactid),
        label: String((master.profitlossaccode ?? "") + " | " + plLabel),
      }]);
    }
  }, []);

  const fetchUnlockedHeaderDropdowns = useCallback(
    async (divisionId) => {
      if (!headerColumns.length) return;

      const needsCol = (colname) => {
        const key = String(colname).toLowerCase();
        return headerColumns.some((c) => {
          const cKey = String(c.colname).toLowerCase();
          return (cKey === key || (key === "locationid" && cKey === "fromlocid"))
            && isVisibleApiCol(c)
            && isTruthyApiFlag(c.iseditallow)
            && !isLockOnEditModeCol(c);
        });
      };

      const tasks = [];
      if (needsCol("divisionid")) {
        tasks.push(
          get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: 2,
            ObjName: AWF_CONFIG.SP_DIVISIONS,
            JSon: JSON.stringify([{
              prmuserid: getUserSession().loginId,
              prmcompanyid: getUserSession().companyId,
              prmyearid: getUserSession().yearId,
            }]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          })
            .then((res) =>
              setDivisionOptions(
                (res || []).map((r) => ({
                  value: String(r.divisionid),
                  label: r.divisionname,
                }))
              )
            )
            .catch(() => {})
        );
      }
      if (needsCol("fromlocid") || needsCol("locationid")) tasks.push(fetchLocations(divisionId));
      if (divisionId) {
        if (needsCol("accountid")) tasks.push(fetchAssetsAccByDivision(divisionId));
        if (needsCol("profitlossactid")) tasks.push(fetchProfitLossAccByDivision(divisionId));
      }
      await Promise.all(tasks);
    },
    [headerColumns, get, fetchLocations, fetchAssetsAccByDivision, fetchProfitLossAccByDivision]
  );

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
      const [mstRes, detRes] = await Promise.all([
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: AWF_CONFIG.SP_MASTER_FILL,
          prmParameters,
          prmFuncCode: AWF_CONFIG.RB_MASTER,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: AWF_CONFIG.SP_DETAIL_FILL,
          prmParameters,
          prmFuncCode: AWF_CONFIG.RB_DETAIL,
        }),
      ]);

      const master = mstRes?.[0] ?? null;
      return {
        master,
        headerValues: master ? mapMasterRowToHeaderValues(master) : null,
        details: mapDetailRowsToGridRows(detRes || []),
      };
    },
    [get]
  );

  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    headerColumns,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    divisionOptions,
    locationOptions,
    assetsAccOptions,
    profitLossAccOptions,
    fetchLocations,
    fetchAssetsAccByDivision,
    fetchProfitLossAccByDivision,
    clearLocationOptions,
    clearAssetsAccOptions,
    clearProfitLossAccOptions,
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    fireCellEvent,
    fetchEditRecord,
    seedOptionsFromMaster,
    fetchUnlockedHeaderDropdowns,
    saveError,
    clearSaveError,
  };
}
