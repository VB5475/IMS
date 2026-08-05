// useDocumentTypeMaster.js — Document Type Master (DMS module).
// One header dropdown (Department, sourced from DM's own department list —
// see constants.js for why the MRD's stated SP wasn't used). GetFilterDetail
// (the generic RB-driven dropdown resolver) fails live for this column, so
// the Department options are fetched via an explicit fn_tbl_* call, same
// pattern as DOP Master's header dropdowns.

import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_SESSION_ID } from "../api/constants";
import { getUserSession } from "../session/userSession";
import {
  mapMasterRowToHeaderValues,
  normalizeDetailColLinks,
  resolveDetailColLinks,
} from "../utils/masterFormUtils";
import { DOCTYPE_CONFIG } from "../pages/document-type-master/constants";

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

/** fn_tbl_dm_department_list — [{ IDNumber, Code, Name, HardCode }, …] */
function mapDepartmentRows(rows) {
  return (rows || [])
    .map((r) => {
      const value = r.IDNumber ?? r.idnumber;
      if (value == null || value === "") return null;
      return { value: String(Number(value) || value), label: String(r.Name ?? r.name ?? r.department ?? value) };
    })
    .filter(Boolean);
}

export function useDocumentTypeMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);
  const [departmentOptions, setDepartmentOptions] = useState([]);

  const fetchDepartmentOptions = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: DOCTYPE_CONFIG.LIST_OBJ_TYPE,
        ObjName: DOCTYPE_CONFIG.SP_DEPARTMENT,
        JSon: JSON.stringify([{}]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = mapDepartmentRows(resolveDetailColLinks(res));
      setDepartmentOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[DocType] Department fetch failed:", err);
      setDepartmentOptions([]);
      return [];
    }
  }, [get]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: DOCTYPE_CONFIG.LIST_OBJ_TYPE,
        ObjName: DOCTYPE_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: DOCTYPE_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = resolveDetailColLinks(metaData)[0] ?? metaData?.[0];
      const rbid = tableRow?.RBID ?? tableRow?.rbid;
      if (!rbid) throw new Error("No Document Type Master RB metadata returned.");

      const hdrMeta = { RBID: rbid, SaveProcName: tableRow?.SaveProcName ?? tableRow?.saveprocname };
      localStorage.setItem(DOCTYPE_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      setHeaderColumns(normalizeDetailColLinks(resolveDetailColLinks(colData)));

      await fetchDepartmentOptions();
    } catch (err) {
      console.error("[DocType] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Document Type Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchDepartmentOptions]);

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: DOCTYPE_CONFIG.SP_MASTER_FILL,
        prmParameters: buildMasterFillParameterString({ companyId, yearId, loginId, sessionId, masterId: idNumber }),
        prmFuncCode: DOCTYPE_CONFIG.RB_MASTER,
      });
      const master = resolveDetailColLinks(mstRes)[0] ?? null;

      return {
        master,
        headerValues: master
          ? mapMasterRowToHeaderValues(master, headerColumns, {
              companyId, yearId, loginId, sessionId, idNumber, funcCode: DOCTYPE_CONFIG.RB_MASTER,
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
    departmentOptions,
    fetchEditRecord, fetchListRows,
  };
}
