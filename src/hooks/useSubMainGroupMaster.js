import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { SMGM_CONFIG } from "../pages/sub-main-group-master/constants";

function mapMasterRowToHeaderValues(master, params) {
  return {
    IDNumber:                     Number(master.IDNumber ?? params.idNumber) || 0,
    ItemTypeID:                   master.ItemTypeID          != null ? Number(master.ItemTypeID)          : 0,
    MainGroupID:                  master.MainGroupID         != null ? Number(master.MainGroupID)         : 0,
    SubMainGroupCode:             master.SubMainGroupCode             ?? "",
    SubMainGroupName:             master.SubMainGroupName             ?? "",
    SubMainGroupShortName:        master.SubMainGroupShortName        ?? "",
    UsedInAutoItemCodeGeneration: (Boolean(master.UsedInAutoItemCodeGeneration)) ? 1 : 0,
    SubMainGroupShortCode:        master.SubMainGroupShortCode        ?? "",
    ISSrnoControlReq:             (Boolean(master.ISSrnoControlReq)) ? 1:0,
    FixedAssetAccountID:          master.FixedAssetAccountID  != null ? Number(master.FixedAssetAccountID)  : 0,
    CompanyID:                    Number(params.companyId)    || DEFAULT_COMPANY_ID,
    YearID:                       Number(master.YearID   ?? params.yearId)    || SMGM_CONFIG.CONFIG_YEAR_ID,
    LoginID:                      Number(master.LoginID  ?? params.loginId)   || DEFAULT_LOGIN_ID,
    SessionID:                    Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    FuncCode:                     master.FuncCode ?? SMGM_CONFIG.RB_MASTER,
  };
}

export function useSubMainGroupMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns,        setHeaderColumns]        = useState([]);
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
        JSon:      JSON.stringify([{ prmRBCode: SMGM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg:  "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error("No Sub Main Group Master RB metadata returned.");
      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      localStorage.setItem(SMGM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — field definitions from GetDetailColData
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  DEFAULT_LOGIN_ID,
      });
      setHeaderColumns(colData?.Links || []);

      // Phase 3 — Item Type + Fixed Asset dropdowns at mount (Main Group is dynamic — see fetchMainGroupByItemType)
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
        console.log("[SMGM] ItemType row sample:",      itemTypeData?.Table?.[0]);
        console.log("[SMGM] FixedAssetAcc row sample:", fixedAssetData?.Table?.[0]);
      }

      setItemTypeOptions(
        (itemTypeData?.Table || []).map((r) => ({
          value:  r.IDNumber ?? 0 ,
          label: String(r.ItemTypeCode ?? ""),
        })).filter((o) => o.value != null)
      );
      setFixedAssetAccOptions(
        (fixedAssetData?.Table || []).map((r) => ({
          value:  r.IDNUMBER ?? 0,
          label: String( r.ACNAME ?? ""),
        })).filter((o) => o.value != null)
      );
    } catch (err) {
      console.error("[SMGM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Sub Main Group Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // Called when ItemTypeID changes — reloads Main Group options filtered by item type
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
        console.log("[SMGM] MainGroup row sample:", data?.Table?.[0]);
      }
      setMainGroupOptions(
        (data?.Table || []).map((r) => ({
          value: r.IDNumber ?? 0,
          label: String(r.MainGroup ?? ""),
        })).filter((o) => o.value != null)
      );
    } catch (err) {
      console.warn("[SMGM] Main Group fetch failed:", err);
      setMainGroupOptions([]);
    } finally {
      setMainGroupLoading(false);
    }
  }, [get]);

  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = [
      Number(companyId)  || DEFAULT_COMPANY_ID,
      Number(yearId)     || SMGM_CONFIG.CONFIG_YEAR_ID,
      Number(loginId)    || DEFAULT_LOGIN_ID,
      Number(sessionId)  || DEFAULT_SESSION_ID,
      Number(idNumber)   || 0,
    ].join(",");

    const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
      prmProcedure: SMGM_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode:  SMGM_CONFIG.RB_MASTER,
    });
    const master = mstRes?.Links?.[0] ?? null;
    return {
      master,
      headerValues: master
        ? mapMasterRowToHeaderValues(master, { companyId, yearId, loginId, sessionId, idNumber })
        : null,
    };
  }, [get]);

  const seedOptionsFromMaster = useCallback((master) => {
    if (master.ItemTypeID != null && master.ItemTypeName) {
      setItemTypeOptions((prev) =>
        prev.some((o) => Number(o.value) === Number(master.ItemTypeID))
          ? prev
          : [{ value: String(master.ItemTypeID), label: master.ItemTypeName }, ...prev]
      );
    }
    if (master.FixedAssetAccountID != null && master.FixedAssetAccountName) {
      setFixedAssetAccOptions((prev) =>
        prev.some((o) => Number(o.value) === Number(master.FixedAssetAccountID))
          ? prev
          : [{ value: String(master.FixedAssetAccountID), label: master.FixedAssetAccountName }, ...prev]
      );
    }
  }, []);

  return {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    itemTypeOptions, mainGroupOptions, mainGroupLoading, fixedAssetAccOptions,
    fetchMainGroupByItemType, fetchEditRecord, seedOptionsFromMaster,
  };
}
