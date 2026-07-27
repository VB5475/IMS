// useDocumentSubTypeMaster.js — Document SubType Master (DMS module).
// Two independent header dropdowns (Department, Document Type) — no cascade
// between them per the MRD. Both sourced from explicit fn_tbl_* fetches
// (GetFilterDetail fails live for these RB columns, same as DOP/DocType).

import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_SESSION_ID } from "../api/constants";
import { getUserSession } from "../session/userSession";
import {
  mapMasterRowToHeaderValues,
  normalizeDetailColLinks,
  resolveDetailColLinks,
} from "../utils/masterFormUtils";
import { DOCSUBTYPE_CONFIG } from "../pages/document-subtype-master/constants";

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

/** fn_tbl_dm_department_list / fn_tbl_dm_documenttype_list — [{ IDNumber, Code, Name, … }, …] */
function mapIdNameRows(rows) {
  return (rows || [])
    .map((r) => {
      const value = r.IDNumber ?? r.idnumber;
      if (value == null || value === "") return null;
      return { value: String(Number(value) || value), label: String(r.Name ?? r.name ?? value) };
    })
    .filter(Boolean);
}

export function useDocumentSubTypeMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [documentTypeOptions, setDocumentTypeOptions] = useState([]);

  const fetchOptions = useCallback(
    async (spName, setter, label) => {
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: DOCSUBTYPE_CONFIG.LIST_OBJ_TYPE,
          ObjName: spName,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapIdNameRows(resolveDetailColLinks(res));
        setter(opts);
        return opts;
      } catch (err) {
        console.warn(`[DocSubType] ${label} fetch failed:`, err);
        setter([]);
        return [];
      }
    },
    [get]
  );

  const fetchDepartmentOptions = useCallback(
    () => fetchOptions(DOCSUBTYPE_CONFIG.SP_DEPARTMENT, setDepartmentOptions, "Department"),
    [fetchOptions]
  );
  const fetchDocumentTypeOptions = useCallback(
    () => fetchOptions(DOCSUBTYPE_CONFIG.SP_DOCUMENT_TYPE, setDocumentTypeOptions, "Document Type"),
    [fetchOptions]
  );

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: DOCSUBTYPE_CONFIG.LIST_OBJ_TYPE,
        ObjName: DOCSUBTYPE_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: DOCSUBTYPE_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = resolveDetailColLinks(metaData)[0] ?? metaData?.[0];
      const rbid = tableRow?.RBID ?? tableRow?.rbid;
      if (!rbid) throw new Error("No Document SubType Master RB metadata returned.");

      const hdrMeta = { RBID: rbid, SaveProcName: tableRow?.SaveProcName ?? tableRow?.saveprocname };
      localStorage.setItem(DOCSUBTYPE_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      setHeaderColumns(normalizeDetailColLinks(resolveDetailColLinks(colData)));

      await Promise.all([fetchDepartmentOptions(), fetchDocumentTypeOptions()]);
    } catch (err) {
      console.error("[DocSubType] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Document SubType Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchDepartmentOptions, fetchDocumentTypeOptions]);

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: DOCSUBTYPE_CONFIG.SP_MASTER_FILL,
        prmParameters: buildMasterFillParameterString({ companyId, yearId, loginId, sessionId, masterId: idNumber }),
        prmFuncCode: DOCSUBTYPE_CONFIG.RB_MASTER,
      });
      const master = resolveDetailColLinks(mstRes)[0] ?? null;

      return {
        master,
        headerValues: master
          ? mapMasterRowToHeaderValues(master, headerColumns, {
              companyId, yearId, loginId, sessionId, idNumber, funcCode: DOCSUBTYPE_CONFIG.RB_MASTER,
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
    departmentOptions, documentTypeOptions,
    fetchEditRecord, fetchListRows,
  };
}
