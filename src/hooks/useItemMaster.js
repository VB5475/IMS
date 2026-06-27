import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getVisibleHeaderFields } from "../utils/masterFormUtils";
import { IM_CONFIG, IM_LEGACY_MASTER_COL_MAP } from "../pages/item-master/constants";

function mapItemTypeOptions(table) {
  return (table ?? [])
    .map((row) => {
      const value = row.IDNumber ?? row.ItemTypeID;
      if (value == null || value === "") return null;
      return {
        value: String(value),
        label: String(row.ItemTypeCode ?? row.ItemTypeName ?? row.Name ?? ""),
      };
    })
    .filter(Boolean);
}

function mapMainGroupOptions(table) {
  return (table ?? [])
    .map((row) => {
      const value = row.Idnumber ?? row.IDNumber ?? row.MainGroupID;
      if (value == null || value === "") return null;
      return {
        value: String(Math.round(Number(value))),
        label: String(row.MainGroup ?? row.MainGroupName ?? row.MainGroupCode ?? row.Code ?? row.Name ?? ""),
      };
    })
    .filter(Boolean);
}

function mapSubGroupOptions(table) {
  return (table ?? [])
    .map((row) => {
      const value = row.Idnumber ?? row.IDNumber ?? row.SubGroupID ?? row.SubMainGroupID;
      if (value == null || value === "") return null;
      return {
        value: String(Math.round(Number(value))),
        label: String(
          row.SubGroup ??
            row.SubGroupName ??
            row.SubMainGroupName ??
            row.Code ??
            row.SubGroupCode ??
            row.Name ??
            ""
        ),
      };
    })
    .filter(Boolean);
}

function mapTaxOptions(table) {
  return (table ?? [])
    .map((row) => {
      const value = row.Idnumber ?? row.IDNumber ?? row.TaxID ?? row.TexabilityID;
      if (value == null || value === "") return null;
      return {
        value: String(Math.round(Number(value))),
        label: String(
          row.TexabilityName ?? row.Texability ?? row.Code ?? row.TaxName ?? row.Name ?? ""
        ),
      };
    })
    .filter(Boolean);
}

function mapUnitOptions(table) {
  return (table ?? [])
    .map((row) => {
      const value =
        row.Idnumber ?? row.IDNumber ?? row.UnitID ?? row.TranUnitID ?? row.BaseUnitID;
      if (value == null || value === "") return null;
      return {
        value: String(Math.round(Number(value))),
        label: String(
          row.TranUnit ??
            row.BaseUnit ??
            row.UnitName ??
            row.TranUnitName ??
            row.BaseUnitName ??
            row.Code ??
            row.UnitCode ??
            row.Name ??
            ""
        ),
      };
    })
    .filter(Boolean);
}

function readMasterValue(master, colName) {
  if (!master || !colName) return undefined;
  if (master[colName] !== undefined) return master[colName];
  const legacyKey = IM_LEGACY_MASTER_COL_MAP[colName];
  return legacyKey ? master[legacyKey] : undefined;
}

function mapMasterRowToHeaderValues(master, fieldDefs, params) {
  const header = {
    IDNumber: Number(master.IDNumber ?? params.idNumber) || 0,
    CompanyID: Number(params.companyId) || DEFAULT_COMPANY_ID,
    YearID: Number(master.YearID ?? params.yearId) || IM_CONFIG.CONFIG_YEAR_ID,
    LoginID: Number(master.LoginID ?? params.loginId) || DEFAULT_LOGIN_ID,
    SessionID: Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    FuncCode: master.FuncCode ?? IM_CONFIG.RB_MASTER,
  };

  getVisibleHeaderFields(fieldDefs).forEach((field) => {
    const key = field.ColName;
    if (!key) return;
    const raw = readMasterValue(master, key);
    if (raw === undefined) return;

    if (key === "IsQcReq") {
      header[key] = Number(raw) === 1 ? 1 : 0;
      return;
    }

    if (
      [
        "ItemTypeID",
        "MainGroupID",
        "SubMainGroupID",
        "TaxabilityID",
        "TranUnitID",
        "BaseUnitID",
        ...Array.from({ length: 9 }, (_, i) => `SubGroupID${i + 1}`),
        "SubGroup10",
      ].includes(key)
    ) {
      header[key] = raw != null && raw !== "" ? Number(raw) : 0;
      return;
    }

    header[key] = raw;
  });

  return header;
}

export function useItemMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
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
    }).catch((err) => {
      console.warn("[IM] Item Type fetch failed:", err);
      return null;
    });
    const options = mapItemTypeOptions(res?.Table);
    setItemTypeOptions(options);
    return options;
  }, [get]);

  const fetchMainGroupOptions = useCallback(
    async (itemTypeId) => {
      if (!itemTypeId) {
        setMainGroupOptions([]);
        return [];
      }

      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IM_CONFIG.SP_MAIN_GROUP,
        JSon: JSON.stringify([{}]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      }).catch(() => null);

      const options = mapMainGroupOptions(res?.Table);
      setMainGroupOptions(options);
      return options;
    },
    [get]
  );

  const fetchSubMainGroupOptions = useCallback(
    async ({ itemTypeId, mainGroupId }) => {
      if (!mainGroupId) {
        setSubMainGroupOptions([]);
        return [];
      }

      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IM_CONFIG.SP_SUB_GROUP,
        JSon: JSON.stringify([
          {},
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      }).catch(() => null);

      const options = mapSubGroupOptions(res?.Table);
      setSubMainGroupOptions(options);
      return options;
    },
    [get]
  );

  const fetchSubGroupLevelOptions = useCallback(
    async ({ itemTypeId, mainGroupId, subMainGroupId }) => {
      if (!subMainGroupId) {
        setSubGroupOptions([]);
        return [];
      }

      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IM_CONFIG.SP_SUB_GROUP,
        JSon: JSON.stringify([
          {},
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      }).catch(() => null);

      const options = mapSubGroupOptions(res?.Table);
      setSubGroupOptions(options);
      return options;
    },
    [get]
  );

  const fetchStaticDropdowns = useCallback(async () => {
    const emptyJson = JSON.stringify([{}]);
    const [taxRes, tranRes, baseRes] = await Promise.all([
      get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IM_CONFIG.SP_TAX,
        JSon: emptyJson,
        p_ErrCode: -1,
        p_ErrMsg: "",
      }).catch(() => null),
      get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IM_CONFIG.SP_TRAN_UNIT,
        JSon: emptyJson,
        p_ErrCode: -1,
        p_ErrMsg: "",
      }).catch(() => null),
      get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IM_CONFIG.SP_BASE_UNIT,
        JSon: emptyJson,
        p_ErrCode: -1,
        p_ErrMsg: "",
      }).catch(() => null),
    ]);

    setTaxOptions(mapTaxOptions(taxRes?.Table));
    setTranUnitOptions(mapUnitOptions(tranRes?.Table));
    setBaseUnitOptions(mapUnitOptions(baseRes?.Table));
  }, [get]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: IM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error("No Item Master RB metadata returned.");

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      localStorage.setItem(IM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      setHeaderColumns(colData?.Links || []);

      await Promise.all([fetchItemTypeOptions(), fetchStaticDropdowns()]);
    } catch (err) {
      console.error("[IM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Item Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchItemTypeOptions, fetchStaticDropdowns]);

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = [
        Number(companyId) || DEFAULT_COMPANY_ID,
        Number(yearId) || IM_CONFIG.CONFIG_YEAR_ID,
        Number(loginId) || DEFAULT_LOGIN_ID,
        Number(sessionId) || DEFAULT_SESSION_ID,
        Number(idNumber) || 0,
      ].join(",");

      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: IM_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: IM_CONFIG.RB_MASTER,
      });
      const master = mstRes?.Links?.[0] ?? null;
      return {
        master,
        headerValues: master
          ? mapMasterRowToHeaderValues(master, headerColumns, {
              companyId,
              yearId,
              loginId,
              sessionId,
              idNumber,
            })
          : null,
      };
    },
    [get, headerColumns]
  );

  const fetchListRows = useCallback(
    async (listParams) => {
      const listRes = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
      return listRes?.Table ?? listRes?.Links ?? [];
    },
    [get]
  );

  const seedOptionsFromMaster = useCallback((master) => {
    const itemTypeId = readMasterValue(master, "ItemTypeID");
    if (itemTypeId != null && (master.ItemTypeName || master.ItemTypeCode)) {
      setItemTypeOptions((prev) =>
        prev.some((o) => o.value === String(itemTypeId))
          ? prev
          : [
              {
                value: String(itemTypeId),
                label: String(master.ItemTypeName ?? master.ItemTypeCode ?? ""),
              },
              ...prev,
            ]
      );
    }

    const mainGroupId = readMasterValue(master, "MainGroupID");
    if (mainGroupId != null && (master.MainGroupName || master.MainGroupCode)) {
      setMainGroupOptions((prev) =>
        prev.some((o) => o.value === String(mainGroupId))
          ? prev
          : [
              {
                value: String(mainGroupId),
                label: String(master.MainGroupName ?? master.MainGroupCode ?? ""),
              },
              ...prev,
            ]
      );
    }

    const subMainGroupId = readMasterValue(master, "SubMainGroupID");
    if (subMainGroupId != null && (master.SubMainGroupName || master.SubGroup)) {
      setSubMainGroupOptions((prev) =>
        prev.some((o) => o.value === String(subMainGroupId))
          ? prev
          : [
              {
                value: String(subMainGroupId),
                label: String(master.SubMainGroupName ?? master.SubGroup ?? ""),
              },
              ...prev,
            ]
      );
    }

    const taxabilityId = readMasterValue(master, "TaxabilityID");
    if (taxabilityId != null && (master.TaxabilityName || master.TexabilityName)) {
      setTaxOptions((prev) =>
        prev.some((o) => o.value === String(taxabilityId))
          ? prev
          : [
              {
                value: String(taxabilityId),
                label: String(master.TaxabilityName ?? master.TexabilityName ?? ""),
              },
              ...prev,
            ]
      );
    }

    const tranUnitId = readMasterValue(master, "TranUnitID");
    if (tranUnitId != null && (master.TranUnitName || master.TranUnit)) {
      setTranUnitOptions((prev) =>
        prev.some((o) => o.value === String(tranUnitId))
          ? prev
          : [
              {
                value: String(tranUnitId),
                label: String(master.TranUnitName ?? master.TranUnit ?? ""),
              },
              ...prev,
            ]
      );
    }

    const baseUnitId = readMasterValue(master, "BaseUnitID");
    if (baseUnitId != null && (master.BaseUnitName || master.BaseUnit)) {
      setBaseUnitOptions((prev) =>
        prev.some((o) => o.value === String(baseUnitId))
          ? prev
          : [
              {
                value: String(baseUnitId),
                label: String(master.BaseUnitName ?? master.BaseUnit ?? ""),
              },
              ...prev,
            ]
      );
    }
  }, []);

  return {
    headerColumns,
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
