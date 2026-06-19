// useGoodsReceivedNote.js — Header meta, detail grid, and filter dropdowns for GRN

import { useState, useCallback, useRef } from "react";
import { useApi } from "../api/useApi";
import { getUserSession } from "../session/userSession";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
  OBJ_TYPE,
} from "../api/constants";
import { GRN_CONFIG } from "../pages/goods-received-note/constants";
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
} from "../utils/gridUtils";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId) || DEFAULT_COMPANY_ID,
    Number(yearId) || GRN_CONFIG.CONFIG_YEAR_ID,
    Number(loginId) || getUserSession().loginId,
    Number(sessionId) || DEFAULT_SESSION_ID,
    Number(idNumber) || 0,
  ].join(",");
}

function toDateInput(value) {
  if (!value) return "";
  if (typeof value === "string" && value.includes("T")) return value.split("T")[0];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function mapMasterRowToHeaderValues(master, params) {
  return {
    TranCode: master.TranCode != null ? String(master.TranCode) : "",
    TranDate: toDateInput(master.TranDate),
    DivisionID: master.DivisionID != null ? Number(master.DivisionID) : 0,
    ConfigID: master.ConfigID != null ? Number(master.ConfigID) : 0,
    SupplierID: master.SupplierID != null ? Number(master.SupplierID) : 0,
    CurrencyID: master.CurrencyName ?? master.CurrencyID ?? "",
    CurrencyRate: master.CurrencyRate != null ? String(master.CurrencyRate) : "",
    BasedOnID: master.BasedOnID != null ? String(master.BasedOnID) : "0",
    BillNo: master.BillNo ?? "",
    BillDate: toDateInput(master.BillDate) || null,
    ChallanNo: master.ChallanNo ?? "",
    ChallanDate: toDateInput(master.ChallanDate) || null,
    TransporterID: master.TransporterID != null ? Number(master.TransporterID) : 0,
    DestinationID: master.DestinationID != null ? Number(master.DestinationID) : 0,
    LRNo: master.LRNo ?? "",
    LRDate: toDateInput(master.LRDate) || null,
    VehicleNo: master.VehicleNo ?? "",
    VehicleTypeId: master.VehicleTypeId != null ? Number(master.VehicleTypeId) : 0,
    NoOfPerson: master.NoOfPerson ?? "",
    DriverName: master.DriverName ?? "",
    DriverContactNo: master.DriverContactNo ?? "",
    DriverLicenceNo: master.DriverLicenceNo ?? "",
    CompanyID: Number(params.companyId) || DEFAULT_COMPANY_ID,
    YearID: Number(params.yearId) || GRN_CONFIG.CONFIG_YEAR_ID,
    LoginID: Number(params.loginId) || getUserSession().loginId,
    SessionID: Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    IDNumber: Number(master.IDNumber ?? params.idNumber) || 0,
    UserID: getUserSession().userId,
  };
}

function mapDetailRowsToGridRows(rows) {
  return (rows || []).map((row, index) => ({
    ...row,
    id: String(row.CompUniqueKey ?? row.IDNumber ?? row.MasterID ?? `edit_${index}`),
  }));
}

function mapIndentRowsToChildRowsMap(detailRows, indtRows) {
  const childRowsMap = {};
  if (!indtRows?.length || !detailRows?.length) return childRowsMap;

  detailRows.forEach((parent) => {
    const parentItemId = String(Math.round(Number(parent.ItemID)));
    const children = indtRows.filter(
      (c) => String(Math.round(Number(c.ChildFKey))) === parentItemId
    );
    if (children.length > 0) {
      childRowsMap[String(parent.id)] = children;
    }
  });
  return childRowsMap;
}

function buildEventColumnSet(apiColumns, fallbackKeys = []) {
  const set = new Set();
  apiColumns.forEach((col) => {
    if (isTruthyApiFlag(col.IsEventReq) || isTruthyApiFlag(col.IsEventCol)) {
      set.add(col.ColName);
    }
  });
  if (set.size === 0) {
    fallbackKeys.forEach((k) => set.add(k));
  }
  return set;
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: OBJ_TYPE.FUNCTION,
    ObjName: GRN_CONFIG.SP_RB_META,
    JSon: JSON.stringify([{ prmRBCode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  });
  const tableRow = metaData?.Table?.[0];
  if (!tableRow) throw new Error(`No RB metadata returned for ${rbCode}.`);

  const meta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
  localStorage.setItem(storageKey, JSON.stringify(meta));

  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID: getUserSession().loginId,
  });
  return { meta, apiColumns: colData?.Links || [] };
}

function mapTableToOptions(rows, valueKey, labelKey) {
  return (rows || []).map((r) => ({
    value: String(r[valueKey] ?? r.IDNumber ?? r.IdNumber ?? ""),
    label: String(r[labelKey] ?? r.Name ?? r[valueKey] ?? ""),
  }));
}

export function useGoodsReceivedNote(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerRbMeta, setHeaderRbMeta] = useState(null);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [grnTypeOptions, setGrnTypeOptions] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [transporterOptions, setTransporterOptions] = useState([]);
  const [destinationOptions, setDestinationOptions] = useState([]);
  const supplierRowsRef = useRef(new Map());
  const [isLoadingGrnTypes, setIsLoadingGrnTypes] = useState(false);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [isLoadingTransporters, setIsLoadingTransporters] = useState(false);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(false);

  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [allIndentColumns, setAllIndentColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  const fetchGrnTypes = useCallback(
    async (divisionId) => {
      if (!divisionId || divisionId === "0") {
        setGrnTypeOptions([]);
        return [];
      }

      setIsLoadingGrnTypes(true);
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: GRN_CONFIG.SP_GRN_TYPES,
          JSon: JSON.stringify([
            {
              PrmCompanyId: DEFAULT_COMPANY_ID,
              PrmDivisionId: Number(divisionId),
              PrmYearId: GRN_CONFIG.CONFIG_YEAR_ID,
              PrmUserId: getUserSession().loginId,
              PrmFormTag: GRN_CONFIG.FORM_TAG,
              PrmRefType: "",
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = (res?.Table || []).map((r) => ({
          value: String(r.ConfigurationId),
          label: r.Name,
        }));
        setGrnTypeOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[GRN] GRN Type fetch failed:", err);
        setGrnTypeOptions([]);
        return [];
      } finally {
        setIsLoadingGrnTypes(false);
      }
    },
    [get]
  );

  const fetchSupplierOptions = useCallback(
    async (divisionId) => {
      if (!divisionId || divisionId === "0") {
        supplierRowsRef.current = new Map();
        setSupplierOptions([]);
        return [];
      }

      setIsLoadingSuppliers(true);
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: GRN_CONFIG.SUPPLIER_SP,
          JSon: JSON.stringify([
            {
              PrmDivisionId: Number(divisionId),
              PrmLoginId: getUserSession().loginId,
              PrmYearId: GRN_CONFIG.CONFIG_YEAR_ID,
              PrmPartyType: GRN_CONFIG.SUPPLIER_PARTY_TYPE,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const rows = res?.Table || [];
        supplierRowsRef.current = new Map(
          rows.map((r) => [String(Math.round(Number(r.SupplierID))), r])
        );
        const opts = rows.map((r) => ({
          value: String(Math.round(Number(r.SupplierID))),
          label: r.SupplierName,
        }));
        setSupplierOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[GRN] Supplier fetch failed:", err);
        supplierRowsRef.current = new Map();
        setSupplierOptions([]);
        return [];
      } finally {
        setIsLoadingSuppliers(false);
      }
    },
    [get]
  );

  const fetchTransporterOptions = useCallback(
    async (divisionId) => {
      if (!divisionId || divisionId === "0") {
        setTransporterOptions([]);
        return [];
      }

      setIsLoadingTransporters(true);
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: GRN_CONFIG.SP_TRANSPORTERS,
          JSon: JSON.stringify([
            {
              PrmDivisionId: Number(divisionId),
              PrmYearId: GRN_CONFIG.CONFIG_YEAR_ID,
              PrmUserId: getUserSession().loginId,
              PrmFormTag: GRN_CONFIG.FORM_TAG,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapTableToOptions(res?.Table, "TransporterID", "TransporterName");
        setTransporterOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[GRN] Transporter fetch failed:", err);
        setTransporterOptions([]);
        return [];
      } finally {
        setIsLoadingTransporters(false);
      }
    },
    [get]
  );

  const fetchDestinationOptions = useCallback(
    async (divisionId, transporterId) => {
      if (!divisionId || divisionId === "0" || !transporterId || transporterId === "0") {
        setDestinationOptions([]);
        return [];
      }

      setIsLoadingDestinations(true);
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: GRN_CONFIG.SP_DESTINATIONS,
          JSon: JSON.stringify([
            {
              PrmDivisionId: Number(divisionId),
              PrmYearId: GRN_CONFIG.CONFIG_YEAR_ID,
              PrmUserId: getUserSession().loginId,
              PrmFormTag: GRN_CONFIG.FORM_TAG,
              prmtransporterMstID: Number(transporterId),
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapTableToOptions(res?.Table, "DestinationID", "DestinationName");
        setDestinationOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[GRN] Destination fetch failed:", err);
        setDestinationOptions([]);
        return [];
      } finally {
        setIsLoadingDestinations(false);
      }
    },
    [get]
  );

  const getSupplierRow = useCallback((supplierId) => {
    if (supplierId == null || supplierId === "" || supplierId === "0") return null;
    return supplierRowsRef.current.get(String(Math.round(Number(supplierId)))) ?? null;
  }, []);

  const fetchDivisionOptions = useCallback(async () => {
    try {
      const divisionData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: GRN_CONFIG.SP_DIVISIONS,
        JSon: JSON.stringify([
          {
            prmUserID: getUserSession().loginId,
            prmCompanyID: DEFAULT_COMPANY_ID,
            prmYearID: GRN_CONFIG.DIVISION_YEAR_ID,
          },
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setDivisionOptions(
        (divisionData?.Table || []).map((r) => ({
          value: String(r.DivisionID),
          label: r.DivisionName,
        }))
      );
    } catch (err) {
      console.warn("[GRN] Division fetch failed:", err);
      setDivisionOptions([]);
    }
  }, [get]);

  const fetchHeaderMeta = useCallback(
    async ({ skipListDropdowns = false } = {}) => {
      setHeaderFetching(true);
      setHeaderError(null);

      try {
        const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: GRN_CONFIG.SP_RB_META,
          JSon: JSON.stringify([{ prmRBCode: GRN_CONFIG.RB_MASTER }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const tableRow = metaData?.Table?.[0];
        if (!tableRow) throw new Error("No GRN header RB metadata returned from server.");

        const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
        setHeaderRbMeta(hdrMeta);
        localStorage.setItem(GRN_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

        const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
          prmMasterID: hdrMeta.RBID,
          prmLoginID: getUserSession().loginId,
        });
        const apiColumns = colData?.Links || [];
        setHeaderColumns(apiColumns);

        if (skipListDropdowns) {
          setDivisionOptions([]);
          return apiColumns;
        }

        await fetchDivisionOptions();
        return apiColumns;
      } catch (err) {
        console.error("[GRN] fetchHeaderMeta failed:", err);
        setHeaderError(err?.message || "Failed to load header configuration.");
        return [];
      } finally {
        setHeaderFetching(false);
      }
    },
    [get, fetchDivisionOptions]
  );

  const fetchUnlockedHeaderDropdowns = useCallback(
    async (divisionId, transporterId) => {
      if (!headerColumns.length) return;

      const needsDivision = headerColumns.some(
        (c) => c.ColName === "DivisionID" && !isLockOnEditModeCol(c)
      );
      const needsConfig = headerColumns.some(
        (c) => c.ColName === "ConfigID" && !isLockOnEditModeCol(c)
      );
      const needsSupplier = headerColumns.some(
        (c) => c.ColName === "SupplierID" && !isLockOnEditModeCol(c)
      );

      const tasks = [];
      if (needsDivision) tasks.push(fetchDivisionOptions());
      if (needsConfig && divisionId) tasks.push(fetchGrnTypes(divisionId));
      if (needsSupplier && divisionId) tasks.push(fetchSupplierOptions(divisionId));
      if (divisionId) tasks.push(fetchTransporterOptions(divisionId));
      if (divisionId && transporterId) {
        tasks.push(fetchDestinationOptions(divisionId, transporterId));
      }
      await Promise.all(tasks);
    },
    [
      headerColumns,
      fetchDivisionOptions,
      fetchGrnTypes,
      fetchSupplierOptions,
      fetchTransporterOptions,
      fetchDestinationOptions,
    ]
  );

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);

    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        GRN_CONFIG.RB_DETAIL,
        GRN_CONFIG.STORAGE_ENTRY_META
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;
      setEventColumns(
        buildEventColumnSet(apiColumns, [
          "ItemID",
          "Qty",
          "Rate",
          "Amount",
          "TranQty",
          "BaseQty",
          "BaseRate",
          "TranRate",
        ])
      );
      setAllColumns(
        apiColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType || null }))
      );
    } catch (err) {
      console.error("[GRN] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load item grid configuration.");
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  const fetchGridColumns = useCallback(
    async (divisionID = 0, editOpts = false) => {
      const opts =
        typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
      const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

      const apiColumns = rawDetailColumnsRef.current;
      const meta = rawDetailRbMetaRef.current;

      if (!apiColumns.length || !meta) {
        console.warn("[GRN] fetchGridColumns called before fetchDetailMeta completed.");
        return [];
      }

      try {
        const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
          funcCode: GRN_CONFIG.RB_DETAIL,
          divisionID: Number(divisionID) || 0,
          existingRecordEdit,
          rowData: masterRow,
          fetchUnlockedDropdowns,
        });
        const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
          filterable: false,
          allEditable: true,
          existingRecordEdit,
        });
        setColumns(gridColumns);
        return gridColumns;
      } catch (err) {
        console.error("[GRN] fetchGridColumns failed:", err);
        return [];
      }
    },
    [get]
  );

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = buildMasterDataFillParams({
        companyId,
        yearId,
        loginId,
        sessionId,
        idNumber,
      });

      const [mstRes, detRes, indtRes] = await Promise.all([
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: GRN_CONFIG.SP_MASTER_FILL,
          prmParameters,
          prmFuncCode: GRN_CONFIG.RB_MASTER,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: GRN_CONFIG.SP_DETAIL_FILL,
          prmParameters,
          prmFuncCode: GRN_CONFIG.RB_DETAIL,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: GRN_CONFIG.SP_INDT_FILL,
          prmParameters,
          prmFuncCode: GRN_CONFIG.RB_INDT_DETAIL,
        }),
      ]);

      const master = mstRes?.Links?.[0] ?? null;
      const params = { companyId, yearId, loginId, sessionId, idNumber };
      const details = mapDetailRowsToGridRows(detRes?.Links || []);
      const indentDetails = indtRes?.Links || [];

      return {
        master,
        headerValues: master ? mapMasterRowToHeaderValues(master, params) : null,
        details,
        indentDetails,
        childRowsMap: mapIndentRowsToChildRowsMap(details, indentDetails),
      };
    },
    [get]
  );

  const fetchIndentDetailColumns = useCallback(async () => {
    const { apiColumns } = await loadRbDetailGridMeta(
      get,
      GRN_CONFIG.RB_INDT_DETAIL,
      GRN_CONFIG.STORAGE_INDT_META
    );
    setAllIndentColumns(
      apiColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType || null }))
    );
    return buildGridColumns(apiColumns, {}, { filterable: false, allEditable: false });
  }, [get]);

  const clearIndentDetailMeta = useCallback(() => {
    setAllIndentColumns([]);
  }, []);

  const [isEventFiring, setIsEventFiring] = useState(false);

  const fireCellEvent = useCallback(
    async (colName, rowData, headerValues) => {
      setIsEventFiring(true);
      try {
        const { id, ...newRowData } = rowData;
        const result = await get(ENDPOINTS.FN_TBL_RB_GRID_EVENT, {
          GridEventFuncName: GRN_CONFIG.SP_GRID_EVENT,
          EventColName: colName,
          DetJSON: JSON.stringify([newRowData]),
          MstJSon: JSON.stringify([headerValues]),
        });
        return result;
      } catch (err) {
        console.error("[GRN] fireCellEvent failed:", err);
        return null;
      } finally {
        setIsEventFiring(false);
      }
    },
    [get]
  );

  const clearGrnTypes = useCallback(() => setGrnTypeOptions([]), []);
  const clearSuppliers = useCallback(() => {
    supplierRowsRef.current = new Map();
    setSupplierOptions([]);
  }, []);
  const clearTransporters = useCallback(() => {
    setTransporterOptions([]);
    setDestinationOptions([]);
  }, []);
  const clearDestinations = useCallback(() => setDestinationOptions([]), []);

  return {
    headerColumns,
    headerRbMeta,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchUnlockedHeaderDropdowns,
    divisionOptions,
    grnTypeOptions,
    supplierOptions,
    transporterOptions,
    destinationOptions,
    fetchGrnTypes,
    fetchSupplierOptions,
    fetchTransporterOptions,
    fetchDestinationOptions,
    getSupplierRow,
    clearGrnTypes,
    clearSuppliers,
    clearTransporters,
    clearDestinations,
    isLoadingGrnTypes,
    isLoadingSuppliers,
    isLoadingTransporters,
    isLoadingDestinations,
    columns,
    allColumns,
    allIndentColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    fetchEditRecord,
    fetchIndentDetailColumns,
    clearIndentDetailMeta,
    fireCellEvent,
    isEventFiring,
  };
}
