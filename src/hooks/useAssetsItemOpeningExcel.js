// useAssetsItemOpeningExcel.js — Detail grid metadata for Asset Item Opening Excel (AIME)
//
//   fetchDetailMeta  → rb_assetitmopnexl → GET_DETAIL_COL_DATA
//   fetchGridColumns → buildGridColumns (read-only — data comes from Excel upload)

import { useState, useCallback, useRef, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
} from "../api/constants";
import { AIME_CONFIG } from "../pages/assets-item-opening-excel/constants";
import { buildGridColumns } from "../utils/gridUtils";

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: AIME_CONFIG.SP_RB_META,
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
    prmLoginID: DEFAULT_LOGIN_ID,
  });
  return { meta, apiColumns: colData || [] };
}

export function useAssetsItemOpeningExcel(baseURL = API_BASE_URL) {
  const { get: rawGet } = useApi(baseURL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [apiColumns, setApiColumns] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const { meta, apiColumns: cols } = await loadRbDetailGridMeta(
        get,
        AIME_CONFIG.RB_DETAIL,
        AIME_CONFIG.STORAGE_ENTRY_META,
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = cols;
      setApiColumns(cols);
      setAllColumns(cols.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
    } catch (err) {
      console.error("[AIME] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load Asset Item Opening Excel grid configuration.");
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  const fetchGridColumns = useCallback(async () => {
    const cols = rawDetailColumnsRef.current;
    if (!cols.length) {
      console.warn("[AIME] fetchGridColumns called before fetchDetailMeta completed.");
      return [];
    }

    try {
      const gridColumns = buildGridColumns(cols, {}, {
        filterable: false,
        allEditable: false,
      });
      setColumns(gridColumns);
      return gridColumns;
    } catch (err) {
      console.error("[AIME] fetchGridColumns failed:", err);
      return [];
    }
  }, []);

  return {
    columns,
    allColumns,
    apiColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
  };
}
