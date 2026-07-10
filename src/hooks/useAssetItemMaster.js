import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { AIM_CONFIG } from "../pages/asset-item-master/constants";

export function useAssetItemMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns,    setHeaderColumns]    = useState([]);
  const [allColumns,       setAllColumns]       = useState([]);
  const [headerFetching,   setHeaderFetching]   = useState(false);
  const [headerError,      setHeaderError]      = useState(null);
  const [itemGroupOptions, setItemGroupOptions] = useState([]);
  const [accountOptions,   setAccountOptions]   = useState([]);
  const [tranUnitOptions,  setTranUnitOptions]  = useState([]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType:   2,
        ObjName:   AIM_CONFIG.SP_RB_META,
        JSon:      JSON.stringify([{ prmrbcode: AIM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg:  "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Asset Item Master RB metadata returned.");
      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(AIM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions (drives form fields, defaults, and save row)
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  getUserSession().loginId,
      });
      setHeaderColumns(colData || []);
      setAllColumns(
        (colData || []).map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );

      // Phase 3 — Item Group + Account + Tran Unit dropdowns in parallel
      const [itemGroupData, accountData, tranUnitData] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType:   2,
          ObjName:   AIM_CONFIG.SP_ITEM_GROUP,
          JSon:      JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[AIM] Item Group fetch failed:", err); return null; }),

        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType:   2,
          ObjName:   AIM_CONFIG.SP_ACCOUNT,
          JSon:      JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[AIM] Account fetch failed:", err); return null; }),

        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType:   2,
          ObjName:   AIM_CONFIG.SP_TRAN_UNIT,
          JSon:      JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[AIM] Tran Unit fetch failed:", err); return null; }),
      ]);

      if (process.env.NODE_ENV !== "production") {
        console.log("[AIM] Item Group row sample:", itemGroupData?.[0]);
        console.log("[AIM] Account row sample:",    accountData?.[0]);
        console.log("[AIM] Tran Unit row sample:",  tranUnitData?.[0]);
      }

      setItemGroupOptions(
        (itemGroupData || []).map((r) => ({
          value: r.idnumber,
          label: String(r.code + " - " + r.itemgroup),
        })).filter((o) => o.value != null)
      );

      setAccountOptions(
        (accountData || []).map((r) => ({
          value: r.idnumber,
          label: String(r.accode + " - " + r.acname),
        })).filter((o) => o.value != null)
      );

      setTranUnitOptions(
        (tranUnitData || []).map((r) => ({
          value: r.idnumber,
          label: String(r.code + " - " + r.tranunit),
        })).filter((o) => o.value != null)
      );
    } catch (err) {
      console.error("[AIM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Asset Item Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // Returns master spread directly (PG returns lowercase keys matching RB colnames).
  // System context fields are overlaid so the save SP always gets consistent values.
  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const session = getUserSession();
    const prmParameters = [
      Number(companyId)  || session.companyId,
      Number(yearId)     || session.yearId,
      Number(loginId)    || session.loginId,
      Number(sessionId)  || DEFAULT_SESSION_ID,
      Number(idNumber)   || 0,
    ].join(",");

    const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
      prmProcedure: AIM_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode:  AIM_CONFIG.RB_MASTER,
    });
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? {
        ...master,
        companyid: Number(companyId)                     || session.companyId,
        yearid:    Number(master.yearid    ?? yearId)    || session.yearId,
        loginid:   Number(master.loginid   ?? loginId)   || session.loginId,
        sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
        funccode:  master.funccode ?? AIM_CONFIG.RB_MASTER,
      } : null,
    };
  }, [get]);

  return {
    headerColumns, allColumns, headerFetching, headerError, fetchHeaderMeta,
    itemGroupOptions, accountOptions, tranUnitOptions,
    fetchEditRecord,
  };
}
