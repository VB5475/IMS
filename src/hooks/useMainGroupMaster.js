import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { MGM_CONFIG } from "../pages/main-group-master/constants";

function mapMasterRowToHeaderValues(master, params) {


  return {
    IDNumber: Number(master.IDNumber ?? params.idNumber) || 0,
    ItemTypeID: master.ItemTypeID != null ? Number(master.ItemTypeID) : 0,
    MainGroupCode: master.MainGroupCode ?? "",
    MainGroupName: master.MainGroupName ?? "",
    MainGroupShortName: master.MainGroupShortName ?? "",
    UsedCodeInCodeGeneration:
      master.UsedCodeInCodeGeneration === true ||
        master.UsedCodeInCodeGeneration === 1 ||
        master.UsedCodeInCodeGeneration === "1"
        ? 1
        : 0,
    MainGroupShortCode: master.MainGroupShortCode ?? "",
    FixedAssetAccountID: master.FixedAssetAccountID != null ? Number(master.FixedAssetAccountID) : 0,
    CompanyID: Number(params.companyId) || DEFAULT_COMPANY_ID,
    YearID: Number(master.YearID ?? params.yearId) || MGM_CONFIG.CONFIG_YEAR_ID,
    LoginID: Number(master.LoginID ?? params.loginId) || DEFAULT_LOGIN_ID,
    SessionID: Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    FuncCode: master.FuncCode ?? MGM_CONFIG.RB_MASTER,
  };
}

export function useMainGroupMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);
  const [itemTypeOptions, setItemTypeOptions] = useState([]);
  const [fixedAssetAccOptions, setFixedAssetAccOptions] = useState([]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: MGM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: MGM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error("No Main Group Master RB metadata returned.");
      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      localStorage.setItem(MGM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — header column definitions
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      setHeaderColumns(colData?.Links || []);

      // Phase 3 — Item Type + Fixed Asset A/C dropdowns in parallel
      const [itemTypeData, fixedAssetData] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: MGM_CONFIG.SP_ITEM_TYPE,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[MGM] Item Type fetch failed:", err); return null; }),

        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: MGM_CONFIG.SP_FIXED_ASSET_ACC,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[MGM] Fixed Asset A/C fetch failed:", err); return null; }),
      ]);

      if (process.env.NODE_ENV !== "production") {
        console.log("[MGM] ItemType row sample:", itemTypeData?.Table?.[0]);
        console.log("[MGM] FixedAssetAcc row sample:", fixedAssetData?.Table?.[0]);
      }

      setItemTypeOptions(
        (itemTypeData?.Table || []).map((r) => ({
          value: r.ItemTypeID ?? r.IDNumber ?? r.ID,
          label: String(r.ItemTypeName ?? r.ItemTypeCode ?? r.Name ?? ""),
        })).filter((o) => o.value != null)
      );
      setFixedAssetAccOptions(
        (fixedAssetData?.Table || []).map((r) => ({
          value: r.FixedAssetAccountID ?? r.AccountID ?? r.AccID ?? r.IDNUMBER ?? r.ID,
          label: String(r.FixedAssetAccountName ?? r.AccountName ?? r.ACNAME ?? r.Name ?? ""),
        })).filter((o) => o.value != null)
      );
    } catch (err) {
      console.error("[MGM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Main Group Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = [
      Number(companyId) || DEFAULT_COMPANY_ID,
      Number(yearId) || MGM_CONFIG.CONFIG_YEAR_ID,
      Number(loginId) || DEFAULT_LOGIN_ID,
      Number(sessionId) || DEFAULT_SESSION_ID,
      Number(idNumber) || 0,
    ].join(",");

    const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
      prmProcedure: MGM_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode: MGM_CONFIG.RB_MASTER,
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
        prev.some((o) => o.value === String(master.ItemTypeID))
          ? prev
          : [{ value: String(master.ItemTypeID), label: master.ItemTypeName }, ...prev]
      );
    }
    if (master.FixedAssetAccountID != null && master.FixedAssetAccountName) {
      setFixedAssetAccOptions((prev) =>
        prev.some((o) => o.value === String(master.FixedAssetAccountID))
          ? prev
          : [{ value: String(master.FixedAssetAccountID), label: master.FixedAssetAccountName }, ...prev]
      );
    }
  }, []);

  return {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    itemTypeOptions, fixedAssetAccOptions,
    fetchEditRecord, seedOptionsFromMaster,
  };
}
