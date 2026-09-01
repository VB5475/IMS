// useDMDepartmentMaster.js — DM Department Master (DMS module).
// Header-only master, no dropdowns/detail grids — closest existing pattern
// is useAccountGroupMaster.js minus the Main Group special-casing.

import { useState, useCallback, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL, DEFAULT_SESSION_ID } from "../api/constants";
import { getUserSession } from "../session/userSession";
import {
  mapMasterRowToHeaderValues,
  normalizeDetailColLinks,
  resolveDetailColLinks,
} from "../utils/masterFormUtils";
import { DMDEPT_CONFIG } from "../pages/dm-department-master/constants";

function buildMasterFillParameterString({ companyId, yearId, loginId, sessionId, masterId }) {
  const session = getUserSession();
  return [
    Number(companyId) || session.companyId,
    Number(yearId) || session.yearId,
    Number(loginId) || session.loginId,
    Number(sessionId) || DEFAULT_SESSION_ID,
    Number(masterId) || 0,
  ].join(",");
}

export function useDMDepartmentMaster() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: DMDEPT_CONFIG.LIST_OBJ_TYPE,
        ObjName: DMDEPT_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: DMDEPT_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = resolveDetailColLinks(metaData)[0] ?? metaData?.[0];
      const rbid = tableRow?.RBID ?? tableRow?.rbid;
      if (!rbid) throw new Error("No DM Department Master RB metadata returned.");

      const hdrMeta = { RBID: rbid, SaveProcName: tableRow?.SaveProcName ?? tableRow?.saveprocname };
      localStorage.setItem(DMDEPT_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      setHeaderColumns(normalizeDetailColLinks(resolveDetailColLinks(colData)));
    } catch (err) {
      console.error("[DMDept] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load DM Department Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: DMDEPT_CONFIG.SP_MASTER_FILL,
        prmParameters: buildMasterFillParameterString({ companyId, yearId, loginId, sessionId, masterId: idNumber }),
        prmFuncCode: DMDEPT_CONFIG.RB_MASTER,
      });
      const master = resolveDetailColLinks(mstRes)[0] ?? null;

      return {
        master,
        headerValues: master
          ? mapMasterRowToHeaderValues(master, headerColumns, {
              companyId, yearId, loginId, sessionId, idNumber, funcCode: DMDEPT_CONFIG.RB_MASTER,
            })
          : null,
      };
    },
    [get, headerColumns]
  );

  const fetchListRows = useCallback(
    async (listParams) => resolveDetailColLinks(await get(ENDPOINTS.FN_FETCH_DATA, listParams)),
    [get]
  );

  return {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    fetchEditRecord, fetchListRows,
  };
}
