import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { IM_CONFIG } from "../pages/item-master/constants";

function mapItemTypeOptions(rows) {
  return (rows ?? []).map((r) => {
    const value = r.idnumber ?? r.itemtypeid;
    if (value == null || value === "") return null;
    return { value: String(value), label: String(r.idnumber) + " - " + String(r.itemtypecode ?? r.itemtypename ?? r.name ?? "") };
  }).filter(Boolean);
}

function mapMainGroupOptions(rows) {
  return (rows ?? []).map((r) => {
    const value = r.idnumber ?? r.maingroupid;
    if (value == null || value === "") return null;
    return {
      value: String(Math.round(Number(value))),
      label: String(r.code) + " - " + String(r.maingroup ?? r.maingroupname ?? r.maingroupcode ?? r.code ?? r.name ?? ""),
    };
  }).filter(Boolean);
}

function mapSubGroupOptions(rows) {
  return (rows ?? []).map((r) => {
    const value = r.idnumber ?? r.subgroupid ?? r.submaingroupid;
    if (value == null || value === "") return null;
    return {
      value: String(Math.round(Number(value))),
      label: String(r.code) + " - " + String(r.submaingroup ?? r.subgroup),
    };
  }).filter(Boolean);
}

function mapTaxOptions(rows) {
  return (rows ?? []).map((r) => {
    const value = r.idnumber ?? r.taxid ?? r.texabilityid;
    if (value == null || value === "") return null;
    return {
      value: String(Math.round(Number(value))),
      label: String(r.code) + " - " + String(r.texabilityname ?? r.texability ?? r.code ?? r.taxname ?? r.name ?? ""),
    };
  }).filter(Boolean);
}

function mapUnitOptions(rows) {
  return (rows ?? []).map((r) => {
    const value = r.idnumber ?? r.unitid ?? r.tranunitid ?? r.baseunitid;
    if (value == null || value === "") return null;
    return {
      value: String(Math.round(Number(value))),
      label: String(r.code) + " - " + String(r.tranunit ?? r.baseunit ?? r.unitname ?? r.tranunitname ?? r.baseunitname ?? r.code ?? r.unitcode ?? r.name ?? ""),
    };
  }).filter(Boolean);
}

export function useItemMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [itemTypeOptions, setItemTypeOptions] = useState([]);
  const [mainGroupOptions, setMainGroupOptions] = useState([]);
  const [subMainGroupOptions, setSubMainGroupOptions] = useState([]);
  const [subGroupOptions, setSubGroupOptions] = useState([]);
  const [taxOptions, setTaxOptions] = useState([]);
  const [tranUnitOptions, setTranUnitOptions] = useState([]);
  const [baseUnitOptions, setBaseUnitOptions] = useState([]);

  const fetchItemTypeOptions = useCallback(async () => {
    const res = await get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: 2,
      ObjName: IM_CONFIG.SP_ITEM_TYPE,
      JSon: JSON.stringify([{}]),
      p_ErrCode: -1,
      p_ErrMsg: "",
    }).catch((err) => { console.warn("[IM] Item Type fetch failed:", err); return null; });
    const options = mapItemTypeOptions(res);
    setItemTypeOptions(options);
    return options;
  }, [get]);

  const fetchMainGroupOptions = useCallback(async (itemTypeId) => {
    if (!itemTypeId) { setMainGroupOptions([]); return []; }
    const res = await get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: 2,
      ObjName: IM_CONFIG.SP_MAIN_GROUP,
      JSon: JSON.stringify([{ prmitemtypeid: itemTypeId }]),
      p_ErrCode: -1,
      p_ErrMsg: "",
    }).catch(() => null);
    const options = mapMainGroupOptions(res);
    setMainGroupOptions(options);
    return options;
  }, [get]);

  const fetchSubMainGroupOptions = useCallback(async ({ itemTypeId, mainGroupId }) => {
    if (!mainGroupId) { setSubMainGroupOptions([]); return []; }
    const res = await get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: 2,
      ObjName: IM_CONFIG.SP_SUB_MAIN_GROUP,
      JSon: JSON.stringify([{ prmitemtypeid: itemTypeId, prmmaingroupid: mainGroupId }]),
      p_ErrCode: -1,
      p_ErrMsg: "",
    }).catch(() => null);
    const options = mapSubGroupOptions(res);
    setSubMainGroupOptions(options);
    return options;
  }, [get]);

  const fetchSubGroupLevelOptions = useCallback(async ({ itemTypeId, mainGroupId, subMainGroupId }) => {
    if (!subMainGroupId) { setSubGroupOptions([]); return []; }
    const res = await get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: 2,
      ObjName: IM_CONFIG.SP_SUB_GROUP,
      JSon: JSON.stringify([{}]),
      p_ErrCode: -1,
      p_ErrMsg: "",
    }).catch(() => null);
    const options = mapSubGroupOptions(res);
    setSubGroupOptions(options);
    return options;
  }, [get]);

  const fetchStaticDropdowns = useCallback(async () => {
    const emptyJson = JSON.stringify([{}]);
    const [taxRes, tranRes, baseRes] = await Promise.all([
      get(ENDPOINTS.FN_FETCH_DATA, { ObjType: 2, ObjName: IM_CONFIG.SP_TAX, JSon: emptyJson, p_ErrCode: -1, p_ErrMsg: "" }).catch(() => null),
      get(ENDPOINTS.FN_FETCH_DATA, { ObjType: 2, ObjName: IM_CONFIG.SP_TRAN_UNIT, JSon: emptyJson, p_ErrCode: -1, p_ErrMsg: "" }).catch(() => null),
      get(ENDPOINTS.FN_FETCH_DATA, { ObjType: 2, ObjName: IM_CONFIG.SP_BASE_UNIT, JSon: emptyJson, p_ErrCode: -1, p_ErrMsg: "" }).catch(() => null),
    ]);
    setTaxOptions(mapTaxOptions(taxRes));
    setTranUnitOptions(mapUnitOptions(tranRes));
    setBaseUnitOptions(mapUnitOptions(baseRes));
  }, [get]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: IM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Item Master RB metadata returned.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(IM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      const apiColumns = colData || [];
      setHeaderColumns(apiColumns);
      setAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));

      await Promise.all([fetchItemTypeOptions(), fetchStaticDropdowns()]);
    } catch (err) {
      console.error("[IM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Item Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchItemTypeOptions, fetchStaticDropdowns]);

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
      prmProcedure: IM_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode: IM_CONFIG.RB_MASTER,
    });
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? {
        ...master,
        yearid: session.yearId,
        funccode: IM_CONFIG.RB_MASTER,
        loginid: Number(master.loginid ?? loginId) || session.loginId,
        sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
      } : null,
    };
  }, [get]);

  const fetchListRows = useCallback(async (listParams) => {
    const listRes = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
    return listRes ?? [];
  }, [get]);

  const seedOptionsFromMaster = useCallback((master) => {
    const itemTypeId = master.itemtypeid;
    if (itemTypeId != null && (master.itemtypename || master.itemtypecode)) {
      setItemTypeOptions((prev) =>
        prev.some((o) => o.value === String(itemTypeId)) ? prev :
          [{ value: String(itemTypeId), label: String(master.itemtypename ?? master.itemtypecode ?? "") }, ...prev]
      );
    }

    const mainGroupId = master.maingroupid;
    if (mainGroupId != null && (master.maingroupname || master.maingroupcode)) {
      setMainGroupOptions((prev) =>
        prev.some((o) => o.value === String(mainGroupId)) ? prev :
          [{ value: String(mainGroupId), label: String(master.maingroupname ?? master.maingroupcode ?? "") }, ...prev]
      );
    }

    const subMainGroupId = master.submaingroupid;
    if (subMainGroupId != null && (master.submaingroupname || master.subgroup)) {
      setSubMainGroupOptions((prev) =>
        prev.some((o) => o.value === String(subMainGroupId)) ? prev :
          [{ value: String(subMainGroupId), label: String(master.submaingroupname ?? master.subgroup ?? "") }, ...prev]
      );
    }

    const taxabilityId = master.taxabilityid;
    if (taxabilityId != null && (master.taxabilityname || master.texabilityname)) {
      setTaxOptions((prev) =>
        prev.some((o) => o.value === String(taxabilityId)) ? prev :
          [{ value: String(taxabilityId), label: String(master.taxabilityname ?? master.texabilityname ?? "") }, ...prev]
      );
    }

    const tranUnitId = master.tranunitid;
    if (tranUnitId != null && (master.tranunitname || master.tranunit)) {
      setTranUnitOptions((prev) =>
        prev.some((o) => o.value === String(tranUnitId)) ? prev :
          [{ value: String(tranUnitId), label: String(master.tranunitname ?? master.tranunit ?? "") }, ...prev]
      );
    }

    const baseUnitId = master.baseunitid;
    if (baseUnitId != null && (master.baseunitname || master.baseunit)) {
      setBaseUnitOptions((prev) =>
        prev.some((o) => o.value === String(baseUnitId)) ? prev :
          [{ value: String(baseUnitId), label: String(master.baseunitname ?? master.baseunit ?? "") }, ...prev]
      );
    }
  }, []);

  return {
    headerColumns,
    allColumns,
    headerFetching,
    headerError,
    itemTypeOptions,
    mainGroupOptions,
    subMainGroupOptions,
    subGroupOptions,
    taxOptions,
    tranUnitOptions,
    baseUnitOptions,
    fetchHeaderMeta,
    fetchEditRecord,
    fetchListRows,
    fetchMainGroupOptions,
    fetchSubMainGroupOptions,
    fetchSubGroupLevelOptions,
    seedOptionsFromMaster,
  };
}
