// useAssetPartIndent.js — fetches all five grids' full datasets for Asset
// Part Indent (Tab 1's three, Tab 2's fn_tbl_AstDateGroupWsPartDetail, Tab
// 3's fn_tbl_AstDatePerAssetRepairingCost). All five SPs take the same five
// params (company/division/year/from/to) and return their whole result set
// — no per-row drill-down call.
// 2026-09-09/10 — live-confirmed against the real SPs (fn_tbl_AstItemWs
// PartDetail / fn_tbl_AstSrNoWsPartDetail / fn_tbl_AstLocWsPartCount /
// fn_tbl_AstDateGroupWsPartDetail / fn_tbl_AstDatePerAssetRepairingCost):
// none of them accept a login param — passing prmloginid threw "Must
// declare the scalar variable '@prmloginid'" on every one.
import { useState, useCallback, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL, OBJ_TYPE } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { formatTranDate } from "../utils/dateFormat";
import { normalizeListRows } from "../utils/listGridUtils";
import { APIN_CONFIG } from "../pages/assets-part-indent/constants";

function buildFetchParams({ divisionId, fromDate, toDate }) {
  const session = getUserSession();
  return {
    prmcompanyid: session.companyId,
    prmdivisionid: Number(divisionId) || 0,
    prmyearid: session.yearId,
    prmfromdate: formatTranDate(fromDate, { fallbackToToday: true }),
    prmtodate: formatTranDate(toDate, { fallbackToToday: true }),
  };
}

export function useAssetPartIndent() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);
  const [masterRows, setMasterRows] = useState([]);
  const [detailRows, setDetailRows] = useState([]);
  const [locCountRows, setLocCountRows] = useState([]);
  const [dateGroupRows, setDateGroupRows] = useState([]);
  const [perChairCostRows, setPerChairCostRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetches all five grids together on one Search — the filter (Division/
  // From/To Date) is shared across all three tabs, so switching tabs never
  // needs its own fetch.
  const fetchGrids = useCallback(async (filters) => {
    setLoading(true);
    setError(null);
    try {
      const params = buildFetchParams(filters);
      const [masterJson, detailJson, locCountJson, dateGroupJson, perChairCostJson] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: APIN_CONFIG.LIST_OBJ_TYPE,
          ObjName: APIN_CONFIG.SP_MASTER_FETCH,
          JSon: JSON.stringify([params]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: APIN_CONFIG.LIST_OBJ_TYPE,
          ObjName: APIN_CONFIG.SP_DETAIL_FETCH,
          JSon: JSON.stringify([params]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: APIN_CONFIG.LIST_OBJ_TYPE,
          ObjName: APIN_CONFIG.SP_LOC_COUNT_FETCH,
          JSon: JSON.stringify([params]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: APIN_CONFIG.LIST_OBJ_TYPE,
          ObjName: APIN_CONFIG.SP_DATE_GROUP_FETCH,
          JSon: JSON.stringify([params]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: APIN_CONFIG.LIST_OBJ_TYPE,
          ObjName: APIN_CONFIG.SP_PER_CHAIR_COST_FETCH,
          JSon: JSON.stringify([params]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }),
      ]);
      setMasterRows(normalizeListRows(masterJson ?? []));
      setDetailRows(normalizeListRows(detailJson ?? []));
      setLocCountRows(normalizeListRows(locCountJson ?? []));
      setDateGroupRows(normalizeListRows(dateGroupJson ?? []));
      setPerChairCostRows(normalizeListRows(perChairCostJson ?? []));
    } catch (err) {
      console.error("[AssetPartIndent] fetch failed:", err);
      setError(err?.message || "Failed to load Asset Part Indent data.");
      setMasterRows([]);
      setDetailRows([]);
      setLocCountRows([]);
      setDateGroupRows([]);
      setPerChairCostRows([]);
    } finally {
      setLoading(false);
    }
  }, [get]);

  return {
    masterRows,
    detailRows,
    locCountRows,
    dateGroupRows,
    perChairCostRows,
    loading,
    error,
    fetchGrids,
  };
}
