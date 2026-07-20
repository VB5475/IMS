import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { MGM_CONFIG } from "../pages/main-group-master/constants";

export function useMainGroupMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns,        setHeaderColumns]        = useState([]);
  const [allColumns,           setAllColumns]           = useState([]);
  const [headerFetching,       setHeaderFetching]       = useState(false);
  const [headerError,          setHeaderError]          = useState(null);
  const [itemTypeOptions,      setItemTypeOptions]      = useState([]);
  const [fixedAssetAccOptions, setFixedAssetAccOptions] = useState([]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType:   2,
        ObjName:   MGM_CONFIG.SP_RB_META,
        JSon:      JSON.stringify([{ prmrbcode: MGM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg:  "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Main Group Master RB metadata returned.");
      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(MGM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions (drives form fields, defaults, and save row)
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  getUserSession().loginId,
      });
      setHeaderColumns(colData || []);
      setAllColumns(
        (colData || []).map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );

      // Phase 3 — Item Type + Fixed Asset A/C dropdowns in parallel
      const [itemTypeData, fixedAssetData] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType:   2,
          ObjName:   MGM_CONFIG.SP_ITEM_TYPE,
          JSon:      JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[MGM] Item Type fetch failed:", err); return null; }),

        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType:   2,
          ObjName:   MGM_CONFIG.SP_FIXED_ASSET_ACC,
          JSon:      JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[MGM] Fixed Asset A/C fetch failed:", err); return null; }),
      ]);

      if (process.env.NODE_ENV !== "production") {
        console.log("[MGM] ItemType row sample:",      itemTypeData?.[0]);
        console.log("[MGM] FixedAssetAcc row sample:", fixedAssetData?.[0]);
      }

      setItemTypeOptions(
        (itemTypeData || []).map((r) => ({
          value: r.idnumber ?? 0,
          label: String(r.itemtypecode ?? r.itemtypename ?? ""),
        })).filter((o) => o.value != null)
      );
      setFixedAssetAccOptions(
        (fixedAssetData || []).map((r) => ({
          value: r.idnumber ?? 0,
          label: String(r.acname ?? r.accountname ?? ""),
        })).filter((o) => o.value != null)
      );
    } catch (err) {
      console.error("[MGM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Main Group Master configuration.");
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
      prmProcedure: MGM_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode:  MGM_CONFIG.RB_MASTER,
    });
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? {
        ...master,
        yearid:    Number(master.yearid    ?? yearId)    || session.yearId,
        loginid:   Number(master.loginid   ?? loginId)   || session.loginId,
        sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
        funccode:  master.funccode ?? MGM_CONFIG.RB_MASTER,
      } : null,
    };
  }, [get]);

  const seedOptionsFromMaster = useCallback((master) => {
    if (master.itemtypeid != null && (master.itemtypename ?? master.itemtypecode)) {
      setItemTypeOptions((prev) =>
        prev.some((o) => Number(o.value) === Number(master.itemtypeid))
          ? prev
          : [{ value: master.itemtypeid, label: master.itemtypename ?? master.itemtypecode }, ...prev]
      );
    }
    if (master.fixedassetaccountid != null && (master.fixedassetaccountname ?? master.acname)) {
      setFixedAssetAccOptions((prev) =>
        prev.some((o) => Number(o.value) === Number(master.fixedassetaccountid))
          ? prev
          : [{ value: master.fixedassetaccountid, label: master.fixedassetaccountname ?? master.acname }, ...prev]
      );
    }
  }, []);

  return {
    headerColumns, allColumns, headerFetching, headerError, fetchHeaderMeta,
    itemTypeOptions, fixedAssetAccOptions,
    fetchEditRecord, seedOptionsFromMaster,
  };
}
