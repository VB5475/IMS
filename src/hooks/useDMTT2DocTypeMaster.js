// useDMTT2DocTypeMaster.js — Transaction To Document Type Master (DMS module).
// Direct-form hook: RB header field metadata + Department options up front,
// then Tran Type fetched per selected department, then the Document Type
// checklist fetched once Tran Type is also selected (2026-08-14 /pm — its
// source SP now takes both department and tran type, see constants.js).
// See constants.js for the confirmed live-SP gap around round-tripping
// already-saved checks.

import { useState, useCallback, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { normalizeDetailColLinks, resolveDetailColLinks } from "../utils/masterFormUtils";
import { TT2DOCTYPE_CONFIG } from "../pages/dm-tt2doctype-master/constants";

/** fn_tbl_dm_department_list / fn_tbl_fetch_trantype — [{ idnumber, name/trantype }, …] */
function mapIdNameRows(rows, labelKeys = ["name", "Name"]) {
  return (rows || [])
    .map((r) => {
      const value = r.idnumber ?? r.IDNumber ?? r.IdNumber;
      if (value == null || value === "") return null;
      let label;
      for (const key of labelKeys) {
        if (r[key] != null && r[key] !== "") { label = r[key]; break; }
      }
      const num = Number(value);
      return { value: Number.isFinite(num) ? String(Math.round(num)) : String(value), label: String(label ?? value) };
    })
    .filter(Boolean);
}

export function useDMTT2DocTypeMaster() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);
  const [departmentOptions, setDepartmentOptions] = useState([]);

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

      const deptRes = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: TT2DOCTYPE_CONFIG.LIST_OBJ_TYPE,
        ObjName: TT2DOCTYPE_CONFIG.SP_DEPARTMENT,
        JSon: JSON.stringify([{}]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setDepartmentOptions(mapIdNameRows(resolveDetailColLinks(deptRes)));
    } catch (err) {
      console.error("[TT2DocType] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Transaction To Document Type Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  /** Live cascade — genuinely department-scoped, see constants.js. */
  const fetchTranTypeOptions = useCallback(
    async (departmentId) => {
      if (!departmentId) return [];
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: TT2DOCTYPE_CONFIG.LIST_OBJ_TYPE,
          ObjName: TT2DOCTYPE_CONFIG.SP_TRAN_TYPE,
          JSon: JSON.stringify([{ prmdepartmentid: Number(departmentId) }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        return mapIdNameRows(resolveDetailColLinks(res), ["trantype", "TranType"]);
      } catch (err) {
        console.warn("[TT2DocType] Tran Type fetch failed:", err);
        return [];
      }
    },
    [get]
  );

  /** Checklist rows for the grid — genuinely scoped server-side by department
   *  + tran type (2026-08-14 /pm: fn_tbl_fetch_documenttypett2doc(@prmdeptid,
   *  @prmreftrantypeid), replacing the old flat-list-plus-client-side-filter
   *  approach). Needs both ids; returns [] rather than calling the SP with a
   *  missing one.
   *
   *  Row shape confirmed live (curl against IMS_LIVE, 2026-08-14 /pm):
   *  { ref_documenttypeid, ref_documenttypename, ischecked } — NOT the old
   *  flat list's { idnumber, name }. This also closes the "CONFIRMED GAP" in
   *  constants.js's header comment (no way to read back already-saved
   *  checks): `ischecked` (1/0) IS the already-mapped flag for this exact
   *  department+trantype, live-verified with real data (e.g. dept=1/tt=1
   *  returned "Purchase Indent" with ischecked:1 among ~40 other rows at 0). */
  const fetchDocumentTypeRows = useCallback(
    async (departmentId, tranTypeId) => {
      if (!departmentId || !tranTypeId) return [];
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: TT2DOCTYPE_CONFIG.LIST_OBJ_TYPE,
          ObjName: TT2DOCTYPE_CONFIG.SP_DOCUMENT_TYPE,
          JSon: JSON.stringify([{
            prmdeptid: Number(departmentId),
            prmreftrantypeid: Number(tranTypeId),
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const rows = resolveDetailColLinks(res);
        return rows
          .map((r) => {
            const idnumber = Number(r.ref_documenttypeid ?? r.Ref_DocumentTypeID) || 0;
            if (!idnumber) return null;
            return {
              documenttypeid: idnumber,
              documenttype: String(r.ref_documenttypename ?? r.Ref_DocumentTypeName ?? ""),
              checked: Number(r.ischecked ?? r.IsChecked) === 1,
            };
          })
          .filter(Boolean);
      } catch (err) {
        console.warn("[TT2DocType] Document Type fetch failed:", err);
        return [];
      }
    },
    [get]
  );

  return {
    headerColumns,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    departmentOptions,
    fetchTranTypeOptions,
    fetchDocumentTypeRows,
  };
}
