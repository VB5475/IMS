// useBomMaster.js — Header meta + detail grid for Assets BOM Master

import { useState, useCallback, useRef, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL, DEFAULT_SESSION_ID } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { BOM_CONFIG } from "../pages/bom-master/constants";
import {
  fetchDropdownOptions,
  buildGridColumns,
  hasVisibleCol,
  isTruthyApiFlag,
} from "../utils/gridUtils";
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

function mapMasterRowToHeaderValues(master) {
  return {
    ...master,
    yearid: getUserSession().yearId,
    funccode: BOM_CONFIG.RB_MASTER,
    loginid: getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
  };
}

function mapDetailRowsToGridRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 1 && isErrorOnlyRow(list[0])) return [];
  return list.map((row, index) => ({
    ...row,
    id: String(row.compuniquekey ?? row.idnumber ?? row.masterid ?? `edit_${index}`),
  }));
}

/** fn_tbl_bomitem_fetch row shape: idnumber, itemname, unitidnumber, unitcode */
function mapBomItemRows(rows) {
  return (rows || []).map((r) => ({
    value: String(r.idnumber ?? r.IDNumber ?? 0),
    label: String(r.itemname ?? r.ItemName ?? ""),
    unitCode: String(r.unitcode ?? r.UnitCode ?? "").trim(),
    unitIdNumber: Number(r.unitidnumber ?? r.UnitIDNumber) || 0,
    raw: r,
  }));
}

async function loadRbMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: BOM_CONFIG.SP_RB_META,
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

export function useBomMaster(baseURL = API_BASE_URL) {
  const { get: rawGet } = useApi(baseURL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerAllColumns, setHeaderAllColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [bomItemOptions, setBomItemOptions] = useState([]);
  const bomItemByIdRef = useRef(new Map());

  const [detailColumns, setDetailColumns] = useState([]);
  const [detailAllColumns, setDetailAllColumns] = useState([]);
  const [detailFetching, setDetailFetching] = useState(false);
  const [detailMetaError, setDetailMetaError] = useState(null);
  const [eventColumns, setEventColumns] = useState(() => new Set(["qty", "rate"]));

  const [saveError, setSaveError] = useState(null);
  const clearSaveError = useCallback(() => setSaveError(null), []);

  const detailRawColumnsRef = useRef([]);
  const detailRbIdRef = useRef(null);

  const fetchBomItems = useCallback(async (divisionId = 0) => {
    if (!divisionId || Number(divisionId) === 0) {
      setBomItemOptions([]);
      bomItemByIdRef.current = new Map();
      return [];
    }
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: BOM_CONFIG.SP_BOM_ITEM,
        JSon: JSON.stringify([{
          prmuserid: session.loginId,
          prmdivisionid: Number(divisionId) || 0,
          prmyearid: session.yearId,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const mapped = mapBomItemRows(res || []);
      const byId = new Map();
      mapped.forEach((opt) => byId.set(opt.value, opt));
      bomItemByIdRef.current = byId;
      setBomItemOptions(mapped.map(({ value, label }) => ({ value, label })));
      return mapped;
    } catch (err) {
      console.warn("[BOM] BOM item fetch failed:", err);
      setBomItemOptions([]);
      bomItemByIdRef.current = new Map();
      return [];
    }
  }, [get]);

  const clearBomItemOptions = useCallback(() => {
    setBomItemOptions([]);
    bomItemByIdRef.current = new Map();
  }, []);

  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const { apiColumns } = await loadRbMeta(get, BOM_CONFIG.RB_MASTER, BOM_CONFIG.STORAGE_HEADER_META);
      setHeaderColumns(apiColumns);
      setHeaderAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));

      if (skipListDropdowns) {
        setDivisionOptions([]);
        clearBomItemOptions();
        return;
      }

      if (hasVisibleCol(apiColumns, "divisionid")) {
        const session = getUserSession();
        const divisionData = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: BOM_CONFIG.SP_DIVISION,
          JSon: JSON.stringify([{
            prmuserid: session.loginId,
            prmcompanyid: session.companyId,
            prmyearid: session.yearId,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }).catch((err) => {
          console.warn("[BOM] Division fetch failed:", err);
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
      console.error("[BOM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Assets BOM Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, clearBomItemOptions]);

  const fetchDetailMeta = useCallback(async () => {
    setDetailFetching(true);
    setDetailMetaError(null);
    try {
      const { meta, apiColumns } = await loadRbMeta(get, BOM_CONFIG.RB_DETAIL, BOM_CONFIG.STORAGE_DETAIL_META);
      detailRbIdRef.current = meta.RBID;
      detailRawColumnsRef.current = apiColumns;
      setDetailAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));

      const evtSet = new Set(["qty", "rate"]);
      apiColumns.forEach((col) => {
        if (isTruthyApiFlag(col.iseventreq) || isTruthyApiFlag(col.iseventcol)) {
          evtSet.add(col.colname);
        }
      });
      setEventColumns(evtSet);
      return apiColumns;
    } catch (err) {
      console.error("[BOM] fetchDetailMeta failed:", err);
      setDetailMetaError(err?.message || "Failed to load item grid configuration.");
      return [];
    } finally {
      setDetailFetching(false);
    }
  }, [get]);

  const fetchGridColumns = useCallback(
    async (divisionID = 0, editOpts = false) => {
      const opts = typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
      const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

      if (!detailRawColumnsRef.current.length || !detailRbIdRef.current) {
        console.warn("[BOM] fetchGridColumns called before fetchDetailMeta completed.");
        return [];
      }

      try {
        const colDropdownOptions = await fetchDropdownOptions(get, detailRawColumnsRef.current, detailRbIdRef.current, {
          funcCode: BOM_CONFIG.RB_DETAIL,
          divisionID: Number(divisionID) || 0,
          existingRecordEdit,
          rowData: masterRow,
          fetchUnlockedDropdowns,
        });
        const gridColumns = buildGridColumns(detailRawColumnsRef.current, colDropdownOptions, {
          filterable: false,
          allEditable: true,
          existingRecordEdit,
        });
        setDetailColumns(gridColumns);
        return gridColumns;
      } catch (err) {
        console.error("[BOM] fetchGridColumns failed:", err);
        return [];
      }
    },
    [get]
  );

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
      const [mstRes, detRes] = await Promise.all([
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: BOM_CONFIG.SP_MASTER_FILL,
          prmParameters,
          prmFuncCode: BOM_CONFIG.RB_MASTER,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: BOM_CONFIG.SP_DETAIL_FILL,
          prmParameters,
          prmFuncCode: BOM_CONFIG.RB_DETAIL,
        }),
      ]);
      const master = mstRes?.[0] ?? null;
      return {
        master,
        headerValues: master ? mapMasterRowToHeaderValues(master) : null,
        detailRows: mapDetailRowsToGridRows(detRes || []),
      };
    },
    [get]
  );

  const seedOptionsFromMaster = useCallback(async (master) => {
    const divId = master?.divisionid ?? 0;
    if (divId) await fetchBomItems(divId);
  }, [fetchBomItems]);

  const fetchListRows = useCallback(
    async (listParams) => {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
      return Array.isArray(res) ? res : (res ?? []);
    },
    [get]
  );

  const getBomItemSelection = useCallback((bomItemId) => {
    const opt = bomItemByIdRef.current.get(String(bomItemId));
    return {
      unit: opt?.unitCode ?? "",
      unitidnumber: opt?.unitIdNumber ?? 0,
    };
  }, []);

  return {
    headerColumns, headerAllColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, bomItemOptions, fetchBomItems, clearBomItemOptions, getBomItemSelection,
    detailColumns, detailAllColumns, detailFetching, detailMetaError, eventColumns,
    fetchDetailMeta, fetchGridColumns,
    fetchEditRecord, seedOptionsFromMaster, fetchListRows,
    saveError, setSaveError, clearSaveError,
  };
}
