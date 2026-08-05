// useTransporterMaster.js — Header meta + one detail grid (Transporter
// Detail, called "Consignee Detail" in the MRD's API section) for
// Transporter Master.
//
// Same 3-phase load pattern as useDopMaster.js (the closest existing
// precedent — the only other master module with a detail grid):
//   fetchHeaderMeta  → RB_MASTER → GET_DETAIL_COL_DATA
//   fetchDetailMeta  → RB_DETAIL → GET_DETAIL_COL_DATA (columns only)
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (lazy on first Add)
//
// Transporter Master's header has no dropdowns and no cascades (all 9
// fields are Text/Checkbox per the MRD) — unlike DOP Master, there's no
// Tran Type/Entity/Department/Company fetch here.

import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_SESSION_ID } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { TM_CONFIG } from "../pages/transporter-master/constants";
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
    funccode: TM_CONFIG.RB_MASTER,
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

async function loadRbMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: TM_CONFIG.SP_RB_META,
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

export function useTransporterMaster(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerAllColumns, setHeaderAllColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [detailColumns, setDetailColumns] = useState([]);
  const [detailAllColumns, setDetailAllColumns] = useState([]);
  const [detailFetching, setDetailFetching] = useState(false);
  const [detailMetaError, setDetailMetaError] = useState(null);

  const [saveError, setSaveError] = useState(null);
  const clearSaveError = useCallback(() => setSaveError(null), []);

  const [detailRawColumns, setDetailRawColumns] = useState([]);
  const [detailRbId, setDetailRbId] = useState(null);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const { apiColumns } = await loadRbMeta(get, TM_CONFIG.RB_MASTER, TM_CONFIG.STORAGE_HEADER_META);
      setHeaderColumns(apiColumns);
      setHeaderAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
    } catch (err) {
      console.error("[TM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Transporter Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  const fetchDetailMeta = useCallback(async () => {
    setDetailFetching(true);
    setDetailMetaError(null);
    try {
      const { meta, apiColumns } = await loadRbMeta(get, TM_CONFIG.RB_DETAIL, TM_CONFIG.STORAGE_DETAIL_META);
      setDetailRbId(meta.RBID);
      setDetailRawColumns(apiColumns);
      setDetailAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
      return apiColumns;
    } catch (err) {
      console.error("[TM] fetchDetailMeta failed:", err);
      setDetailMetaError(err?.message || "Failed to load Transporter Detail grid configuration.");
      return [];
    } finally {
      setDetailFetching(false);
    }
  }, [get]);

  const fetchGridColumns = useCallback(
    async (divisionID = 0, editOpts = false) => {
      const opts = typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
      const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

      if (!detailRawColumns.length || !detailRbId) {
        console.warn("[TM] fetchGridColumns called before fetchDetailMeta completed.");
        return [];
      }

      try {
        const colDropdownOptions = await fetchDropdownOptions(get, detailRawColumns, detailRbId, {
          funcCode: TM_CONFIG.RB_DETAIL,
          divisionID: Number(divisionID) || 0,
          existingRecordEdit,
          rowData: masterRow,
          fetchUnlockedDropdowns,
        });
        const gridColumns = buildGridColumns(detailRawColumns, colDropdownOptions, {
          filterable: false,
          allEditable: true,
          existingRecordEdit,
        });
        setDetailColumns(gridColumns);
        return gridColumns;
      } catch (err) {
        console.error("[TM] fetchGridColumns failed:", err);
        return [];
      }
    },
    [get, detailRawColumns, detailRbId]
  );

  // ── fetchEditRecord — master + detail grid (two separate SPs per MRD) ──
  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
      const [mstRes, detRes] = await Promise.all([
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: TM_CONFIG.SP_MASTER_FILL,
          prmParameters,
          prmFuncCode: TM_CONFIG.RB_MASTER,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: TM_CONFIG.SP_DETAIL_FILL,
          prmParameters,
          prmFuncCode: TM_CONFIG.RB_DETAIL,
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

  const fetchListRows = useCallback(
    async (listParams) => {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
      return Array.isArray(res) ? res : (res ?? []);
    },
    [get]
  );

  return {
    headerColumns, headerAllColumns, headerFetching, headerError, fetchHeaderMeta,
    detailColumns, detailAllColumns, detailFetching, detailMetaError,
    fetchDetailMeta, fetchGridColumns,
    fetchEditRecord, fetchListRows,
    saveError, setSaveError, clearSaveError,
  };
}
