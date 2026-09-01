// useAssetPartIndent.js — fetches both grids' full datasets for Asset Part
// Indent. Both SPs take the same six params (company/division/year/from/
// to/login) and return their whole result set — no per-row drill-down call.
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
    prmloginid: session.loginId,
  };
}

export function useAssetPartIndent() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);
  const [masterRows, setMasterRows] = useState([]);
  const [detailRows, setDetailRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchGrids = useCallback(async (filters) => {
    setLoading(true);
    setError(null);
    try {
      const params = buildFetchParams(filters);
      const [masterJson, detailJson] = await Promise.all([
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
      ]);
      setMasterRows(normalizeListRows(masterJson ?? []));
      setDetailRows(normalizeListRows(detailJson ?? []));
    } catch (err) {
      console.error("[AssetPartIndent] fetch failed:", err);
      setError(err?.message || "Failed to load Asset Part Indent data.");
      setMasterRows([]);
      setDetailRows([]);
    } finally {
      setLoading(false);
    }
  }, [get]);

  return { masterRows, detailRows, loading, error, fetchGrids };
}
