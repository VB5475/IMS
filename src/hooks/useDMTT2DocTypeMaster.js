// useDMTT2DocTypeMaster.js — Transaction To Document Type Master (DMS module).
// See constants.js's 2026-07-28 live-verification addendum: the live RB has
// no real Department form field, so Tran Type options are populated by
// fetching fn_tbl_fetch_trantype once per known department and merging the
// results (addendum #B), instead of a live Department->TranType cascade.

import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_SESSION_ID } from "../api/constants";
import { getUserSession } from "../session/userSession";
import {
  mapMasterRowToHeaderValues,
  normalizeDetailColLinks,
  resolveDetailColLinks,
} from "../utils/masterFormUtils";
import { normalizeListRows } from "../utils/listGridUtils";
import { TT2DOCTYPE_CONFIG } from "../pages/dm-tt2doctype-master/constants";

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

/** fn_tbl_dm_department_list / fn_tbl_fetch_trantype — [{ idnumber, name/trantype }, …] */
function mapIdNameRows(rows, labelKeys = ["Name", "name"]) {
  return (rows || [])
    .map((r) => {
      const value = r.IDNumber ?? r.idnumber;
      if (value == null || value === "") return null;
      let label;
      for (const key of labelKeys) {
        if (r[key] != null && r[key] !== "") { label = r[key]; break; }
      }
      return { value: String(Number(value) || value), label: String(label ?? value) };
    })
    .filter(Boolean);
}

export function useDMTT2DocTypeMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);
  const [tranTypeOptions, setTranTypeOptions] = useState([]);

  const fetchDepartmentIds = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: TT2DOCTYPE_CONFIG.LIST_OBJ_TYPE,
        ObjName: TT2DOCTYPE_CONFIG.SP_DEPARTMENT,
        JSon: JSON.stringify([{}]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      return mapIdNameRows(resolveDetailColLinks(res)).map((opt) => opt.value);
    } catch (err) {
      console.warn("[TT2DocType] Department id fetch failed:", err);
      return [];
    }
  }, [get]);

  /** Merge Tran Type options across every known department (see module addendum #B). */
  const fetchAllTranTypeOptions = useCallback(async () => {
    const departmentIds = await fetchDepartmentIds();
    const merged = new Map();
    await Promise.all(
      departmentIds.map(async (departmentId) => {
        try {
          const res = await get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: TT2DOCTYPE_CONFIG.LIST_OBJ_TYPE,
            ObjName: TT2DOCTYPE_CONFIG.SP_TRAN_TYPE,
            JSon: JSON.stringify([{ prmdepartmentid: Number(departmentId) }]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          });
          for (const opt of mapIdNameRows(resolveDetailColLinks(res), ["trantype", "TranType"])) {
            merged.set(opt.value, opt);
          }
        } catch (err) {
          console.warn(`[TT2DocType] Tran Type fetch failed for department ${departmentId}:`, err);
        }
      })
    );
    const opts = Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));
    setTranTypeOptions(opts);
    return opts;
  }, [get, fetchDepartmentIds]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: TT2DOCTYPE_CONFIG.LIST_OBJ_TYPE,
        ObjName: TT2DOCTYPE_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: TT2DOCTYPE_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = resolveDetailColLinks(metaData)[0] ?? metaData?.[0];
      const rbid = tableRow?.RBID ?? tableRow?.rbid;
      if (!rbid) throw new Error("No Transaction To Document Type Master RB metadata returned.");

      const hdrMeta = { RBID: rbid, SaveProcName: tableRow?.SaveProcName ?? tableRow?.saveprocname };
      localStorage.setItem(TT2DOCTYPE_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      setHeaderColumns(normalizeDetailColLinks(resolveDetailColLinks(colData)));

      await fetchAllTranTypeOptions();
    } catch (err) {
      console.error("[TT2DocType] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Transaction To Document Type Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchAllTranTypeOptions]);

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: TT2DOCTYPE_CONFIG.SP_MASTER_FILL,
        prmParameters: buildMasterFillParameterString({ companyId, yearId, loginId, sessionId, masterId: idNumber }),
        prmFuncCode: TT2DOCTYPE_CONFIG.RB_MASTER,
      });
      const master = resolveDetailColLinks(mstRes)[0] ?? null;

      return {
        master,
        headerValues: master
          ? mapMasterRowToHeaderValues(master, headerColumns, {
              companyId, yearId, loginId, sessionId, idNumber, funcCode: TT2DOCTYPE_CONFIG.RB_MASTER,
            })
          : null,
      };
    },
    [get, headerColumns]
  );

  const fetchListRows = useCallback(
    async (listParams) => normalizeListRows(resolveDetailColLinks(await get(ENDPOINTS.FN_FETCH_DATA, listParams))),
    [get]
  );

  return {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    tranTypeOptions,
    fetchEditRecord, fetchListRows,
  };
}
