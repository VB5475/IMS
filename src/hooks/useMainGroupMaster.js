import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { MGM_CONFIG } from "../pages/main-group-master/constants";

function pickFirst(row, keys, fallback = "") {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") {
      return row[key];
    }
  }
  return fallback;
}

export function useMainGroupMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
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
        JSon: JSON.stringify([{ prmrbcode: MGM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Main Group Master RB metadata returned.");
      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(MGM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions (drives form fields, defaults, and save row)
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      setHeaderColumns(colData || []);
      setAllColumns(
        (colData || []).map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );

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

      setItemTypeOptions(
        (itemTypeData || []).map((r) => ({
          value: String(pickFirst(r, ["idnumber", "IDNumber"], "")),
          label: String(
            pickFirst(
              r,
              ["itemtypedesc", "itemtypename", "ItemTypeDesc", "ItemTypeName", "itemtypecode", "ItemTypeCode"],
              ""
            )
          ),
        })).filter((o) => o.value !== "")
      );
      setFixedAssetAccOptions(
        (fixedAssetData || []).map((r) => ({
          value: String(pickFirst(r, ["idnumber", "IDNumber"], "")),
          label: String(
            pickFirst(
              r,
              ["acname", "accountname", "fixedassetaccountname", "AcName", "AccountName", "FixedAssetAccountName"],
              ""
            )
          ),
        })).filter((o) => o.value !== "")
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
      Number(companyId) || session.companyId,
      Number(yearId) || session.yearId,
      Number(loginId) || session.loginId,
      Number(sessionId) || DEFAULT_SESSION_ID,
      Number(idNumber) || 0,
    ].join(",");

    const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
      prmProcedure: MGM_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode: MGM_CONFIG.RB_MASTER,
    });
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? {
        ...master,
        yearid: Number(master.yearid ?? yearId) || session.yearId,
        loginid: Number(master.loginid ?? loginId) || session.loginId,
        sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
        funccode: master.funccode ?? MGM_CONFIG.RB_MASTER,
      } : null,
    };
  }, [get]);

  const seedOptionsFromMaster = useCallback((master) => {
    const itemTypeId = pickFirst(master, ["itemtypeid", "ItemTypeID"]);
    const itemTypeLabel = pickFirst(master, [
      "itemtypedesc", "itemtypename", "ItemTypeDesc", "ItemTypeName", "itemtypecode", "ItemTypeCode",
    ]);
    if (itemTypeId != null && itemTypeLabel) {
      setItemTypeOptions((prev) =>
        prev.some((o) => String(o.value) === String(itemTypeId))
          ? prev
          : [{ value: String(itemTypeId), label: String(itemTypeLabel) }, ...prev]
      );
    }

    const fixedAssetId = pickFirst(master, ["fixedassetaccountid", "FixedAssetAccountID"]);
    const fixedAssetLabel = pickFirst(master, [
      "fixedassetaccountname", "acname", "accountname", "FixedAssetAccountName", "AcName", "AccountName",
    ]);
    if (fixedAssetId != null && fixedAssetLabel) {
      setFixedAssetAccOptions((prev) =>
        prev.some((o) => String(o.value) === String(fixedAssetId))
          ? prev
          : [{ value: String(fixedAssetId), label: String(fixedAssetLabel) }, ...prev]
      );
    }
  }, []);

  return {
    headerColumns, allColumns, headerFetching, headerError, fetchHeaderMeta,
    itemTypeOptions, fixedAssetAccOptions,
    fetchEditRecord, seedOptionsFromMaster,
  };
}
