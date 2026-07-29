// useDMTT2DocTypeMaster.js — Transaction To Document Type Master (DMS module).
// Direct-form hook: RB header field metadata + Department options up front,
// then Tran Type + Document Type checklist fetched per selected department.
// See constants.js for the confirmed live-SP gap around round-tripping
// already-saved checks.

import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
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
  const { get } = useApi(API_BASE_URL);

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

  /** Checklist rows for the grid — filtered client-side by department label.
   *  `checked` always starts false: see constants.js's confirmed-gap note,
   *  there is no SP to read back already-saved checks. */
  const fetchDocumentTypeRows = useCallback(
    async (departmentLabel) => {
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: TT2DOCTYPE_CONFIG.LIST_OBJ_TYPE,
          ObjName: TT2DOCTYPE_CONFIG.SP_DOCUMENT_TYPE,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const rows = resolveDetailColLinks(res);
        const scoped = departmentLabel
          ? rows.filter(
              (r) => String(r.department ?? r.Department ?? "").toUpperCase() === departmentLabel.toUpperCase()
            )
          : rows;
        return scoped
          .map((r) => {
            const idnumber = Number(r.idnumber ?? r.IDNumber) || 0;
            if (!idnumber) return null;
            return {
              documenttypeid: idnumber,
              documenttype: String(r.name ?? r.Name ?? ""),
              checked: false,
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
