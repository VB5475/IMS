import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { SMGM_CONFIG } from "../pages/sub-main-group-master/constants";

export function useSubMainGroupMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns,        setHeaderColumns]        = useState([]);
  const [allColumns,           setAllColumns]           = useState([]);
  const [headerFetching,       setHeaderFetching]       = useState(false);
  const [headerError,          setHeaderError]          = useState(null);
  const [itemTypeOptions,      setItemTypeOptions]      = useState([]);
  const [mainGroupOptions,     setMainGroupOptions]     = useState([]);
  const [mainGroupLoading,     setMainGroupLoading]     = useState(false);
  const [fixedAssetAccOptions, setFixedAssetAccOptions] = useState([]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType:   2,
        ObjName:   SMGM_CONFIG.SP_RB_META,
        JSon:      JSON.stringify([{ prmrbcode: SMGM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg:  "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Sub Main Group Master RB metadata returned.");
      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(SMGM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions (drives form fields, defaults, and save row)
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  getUserSession().loginId,
      });
      setHeaderColumns(colData || []);
      setAllColumns(
        (colData || []).map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );

      // Phase 3 — Item Type + Fixed Asset dropdowns at mount
      // Main Group is dynamic — see fetchMainGroupByItemType (cascade from Item Type)
      const [itemTypeData, fixedAssetData] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType:   2,
          ObjName:   SMGM_CONFIG.SP_ITEM_TYPE,
          JSon:      JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[SMGM] Item Type fetch failed:", err); return null; }),

        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType:   2,
          ObjName:   SMGM_CONFIG.SP_FIXED_ASSET_ACC,
          JSon:      JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[SMGM] Fixed Asset A/C fetch failed:", err); return null; }),
      ]);

      if (process.env.NODE_ENV !== "production") {
        console.log("[SMGM] ItemType row sample:",      itemTypeData?.[0]);
        console.log("[SMGM] FixedAssetAcc row sample:", fixedAssetData?.[0]);
      }

      setItemTypeOptions(
        (itemTypeData || []).map((r) => ({
          value: r.idnumber ?? 0,
          label: String(r.itemtypecode ?? ""),
        })).filter((o) => o.value != null)
      );
      setFixedAssetAccOptions(
        (fixedAssetData || []).map((r) => ({
          value: r.idnumber ?? 0,
          label: String(r.acname ?? ""),
        })).filter((o) => o.value != null)
      );
    } catch (err) {
      console.error("[SMGM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Sub Main Group Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // Cascade: Item Type → Main Group options
  const fetchMainGroupByItemType = useCallback(async (itemTypeId) => {
    if (!itemTypeId) { setMainGroupOptions([]); return; }
    setMainGroupLoading(true);
    try {
      const data = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType:   2,
        ObjName:   SMGM_CONFIG.SP_MAIN_GROUP,
        JSon:      JSON.stringify([{ prmItemTypeID: Number(itemTypeId) }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      if (process.env.NODE_ENV !== "production") {
        console.log("[SMGM] MainGroup row sample:", data?.[0]);
      }
      setMainGroupOptions(
        (data || []).map((r) => ({
          value: r.idnumber ?? r.parentid ?? 0,
          label: String(r.maingroup ?? ""),
        })).filter((o) => o.value != null)
      );
    } catch (err) {
      console.warn("[SMGM] Main Group fetch failed:", err);
      setMainGroupOptions([]);
    } finally {
      setMainGroupLoading(false);
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
      prmProcedure: SMGM_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode:  SMGM_CONFIG.RB_MASTER,
    });
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? {
        ...master,
        yearid:    Number(master.yearid    ?? yearId)    || session.yearId,
        loginid:   Number(master.loginid   ?? loginId)   || session.loginId,
        sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
        funccode:  master.funccode ?? SMGM_CONFIG.RB_MASTER,
      } : null,
    };
  }, [get]);

  // Seeds single-item dropdown options from the master fill response so that the
  // selected value is visible in the dropdown even before the full list loads.
  const seedOptionsFromMaster = useCallback((master) => {
    if (master.itemtypeid != null && master.itemtypename) {
      setItemTypeOptions((prev) =>
        prev.some((o) => Number(o.value) === Number(master.itemtypeid))
          ? prev
          : [{ value: master.itemtypeid, label: master.itemtypename }, ...prev]
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
    itemTypeOptions, mainGroupOptions, mainGroupLoading, fixedAssetAccOptions,
    fetchMainGroupByItemType, fetchEditRecord, seedOptionsFromMaster,
  };
}
