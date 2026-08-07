// useItemMasterUploadExcel.js — Detail grid metadata for Item Master Upload Excel (IMUE)
//
//   fetchDetailMeta  → rb_xluplditemmst → GET_DETAIL_COL_DATA
//   fetchGridColumns → buildGridColumns (read-only — data comes from Excel upload)

import { useState, useCallback, useRef } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
} from "../api/constants";
import { IMUE_CONFIG } from "../pages/item-master-upload-excel/constants";
import { buildGridColumns } from "../utils/gridUtils";

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: IMUE_CONFIG.SP_RB_META,
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

export function useItemMasterUploadExcel(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

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
        IMUE_CONFIG.RB_DETAIL,
        IMUE_CONFIG.STORAGE_ENTRY_META,
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = cols;
      setApiColumns(cols);
      setAllColumns(cols.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
    } catch (err) {
      console.error("[IMUE] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load Item Master Upload Excel grid configuration.");
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  const fetchGridColumns = useCallback(async () => {
    const cols = rawDetailColumnsRef.current;
    if (!cols.length) {
      console.warn("[IMUE] fetchGridColumns called before fetchDetailMeta completed.");
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
      console.error("[IMUE] fetchGridColumns failed:", err);
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
