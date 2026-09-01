// useGoodsReceivedNote.js — Header meta, detail grid, and filter dropdowns for GRN

import { useState, useCallback, useRef, useMemo } from "react";
import { useApi, getApiClient } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import { getUserSession } from "../session/userSession";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
  OBJ_TYPE,
} from "../api/constants";
import { GRN_CONFIG } from "../pages/goods-received-note/constants";
import { BASED_ON } from "../constants/purchaseCommon";
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
} from "../utils/gridUtils";
import { isNumericColDataType, buildDetJSON } from "../utils/columnValidation";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId) || getUserSession().companyId,
    Number(yearId) || getUserSession().yearId,
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

function mapMasterRowToHeaderValues(master) {
  return {
    ...master,
    trandate:    toDateInput(master.trandate),
    billdate:    toDateInput(master.billdate),
    challandate: toDateInput(master.challandate),
    lrdate:      toDateInput(master.lrdate),
    yearid:    getUserSession().yearId,
    funccode:  GRN_CONFIG.RB_MASTER,
    loginid:   getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
  };
}

// 2026-08-17 (/pm) — project-wide sentinel-row fix (see usePurchaseInquiry.js
// for the original bug write-up). A detail-fill SP with nothing to return
// sends a single {ErrCode, ErrMsg} "no data" row instead of an empty array;
// without this guard it was loaded as one phantom blank grid row instead of
// showing the grid's emptyMessage.
import { isErrorOnlyRow } from "../utils/apiResponse";

function mapDetailRowsToGridRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 1 && isErrorOnlyRow(list[0])) return [];
  return list.map((row, index) => ({
    ...row,
    id: String(row.compuniquekey ?? row.idnumber ?? row.masterid ?? `edit_${index}`),
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
    if (isTruthyApiFlag(col.iseventreq) || isTruthyApiFlag(col.iseventcol)) {
      set.add(col.colname);
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
    JSon: JSON.stringify([{ prmrbcode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  });
  const tableRow = metaData?.[0];
  if (!tableRow || !tableRow.rbid) {
    throw new Error(tableRow?.ErrMsg || `No RB metadata returned for ${rbCode}.`);
  }

  const meta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
  localStorage.setItem(storageKey, JSON.stringify(meta));

  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID: getUserSession().loginId,
  });
  return { meta, apiColumns: colData || [] };
}

function mapTableToOptions(rows, valueKey, labelKey) {
  return (rows || []).map((r) => ({
    value: String(r[valueKey] ?? r.IDNumber ?? r.IdNumber ?? ""),
    label: String(r[labelKey] ?? r.Name ?? r[valueKey] ?? ""),
  }));
}

export function useGoodsReceivedNote(baseURL = API_BASE_URL) {
  const { get: rawGet } = useApi(baseURL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerRbMeta, setHeaderRbMeta] = useState(null);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [grnTypeOptions, setGrnTypeOptions] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [transporterOptions, setTransporterOptions] = useState([]);
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [clientAssetOptions, setClientAssetOptions] = useState([]);
  const supplierRowsRef = useRef(new Map());
  const [isLoadingGrnTypes, setIsLoadingGrnTypes] = useState(false);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [isLoadingTransporters, setIsLoadingTransporters] = useState(false);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isLoadingClientAssets, setIsLoadingClientAssets] = useState(false);

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
              prmcompanyid: getUserSession().companyId,
              prmdivisionid: Number(divisionId),
              prmyearid: getUserSession().yearId,
              prmuserid: getUserSession().loginId,
              prmformtag: GRN_CONFIG.FORM_TAG,
              prmreftype: "",
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = (res || []).map((r) => ({
          value: String(r.configurationid),
          label: r.name,
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
              prmdivisionid: Number(divisionId),
              prmloginid: getUserSession().loginId,
              prmyearid: getUserSession().yearId,
              prmpartytype: GRN_CONFIG.SUPPLIER_PARTY_TYPE,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const rows = res || [];
        supplierRowsRef.current = new Map(
          rows.map((r) => [String(Math.round(Number(r.supplierid))), r])
        );
        const opts = rows.map((r) => ({
          value: String(Math.round(Number(r.supplierid))),
          label: r.suppliername,
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

  const fetchClientAssetOptions = useCallback(
    async (divisionId) => {
      if (!divisionId || divisionId === "0") {
        setClientAssetOptions([]);
        return [];
      }

      setIsLoadingClientAssets(true);
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: GRN_CONFIG.SUPPLIER_SP,
          JSon: JSON.stringify([
            {
              prmdivisionid: Number(divisionId),
              prmloginid: getUserSession().loginId,
              prmyearid: getUserSession().yearId,
              prmpartytype: GRN_CONFIG.ASSET_CLIENT_PARTY_TYPE,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const rows = res || [];
        const opts = rows.map((r) => ({
          value: String(Math.round(Number(r.supplierid))),
          label: r.suppliername,
        }));
        setClientAssetOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[GRN] Client(Asset) fetch failed:", err);
        setClientAssetOptions([]);
        return [];
      } finally {
        setIsLoadingClientAssets(false);
      }
    },
    [get]
  );

  const clearClientAssets = useCallback(() => setClientAssetOptions([]), []);

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
              prmdivisionid: Number(divisionId),
              prmyearid: getUserSession().yearId,
              prmuserid: getUserSession().loginId,
              prmformtag: GRN_CONFIG.FORM_TAG,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapTableToOptions(res, "transporterid", "transportername");
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

  // Division-wise Location — same SP + cascade contract as Purchase Indent's fetchLocations.
  const fetchLocationOptions = useCallback(
    async (divisionId) => {
      if (!divisionId || divisionId === "0") {
        setLocationOptions([]);
        return [];
      }

      setIsLoadingLocations(true);
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: GRN_CONFIG.SP_LOCATION,
          JSon: JSON.stringify([
            {
              prmcompanyid: getUserSession().companyId,
              prmdivisionid: Number(divisionId),
              prmlocationtypeid: 1,
              prmloginid: getUserSession().loginId,
              prmfrmtype: GRN_CONFIG.TRAN_BOOK,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = (res || []).map((r) => ({
          value: String(r.locationid ?? r.locid),
          label: r.locationname ?? r.locname ?? r.location ?? String(r.locationid ?? r.locid),
        }));
        setLocationOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[GRN] Location fetch failed:", err);
        setLocationOptions([]);
        return [];
      } finally {
        setIsLoadingLocations(false);
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
              prmdivisionid: Number(divisionId),
              prmyearid: getUserSession().yearId,
              prmuserid: getUserSession().loginId,
              prmformtag: GRN_CONFIG.FORM_TAG,
              prmtransportermstid: Number(transporterId),
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = mapTableToOptions(res, "destinationid", "destinationname");
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
            prmuserid: getUserSession().loginId,
            prmcompanyid: getUserSession().companyId,
            prmyearid: getUserSession().yearId,
          },
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setDivisionOptions(
        (divisionData || []).map((r) => ({
          value: String(r.divisionid),
          label: r.divisionname,
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
          JSon: JSON.stringify([{ prmrbcode: GRN_CONFIG.RB_MASTER }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const tableRow = metaData?.[0];
        if (!tableRow) throw new Error("No GRN header RB metadata returned from server.");

        const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
        setHeaderRbMeta(hdrMeta);
        localStorage.setItem(GRN_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

        const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
          prmMasterID: hdrMeta.RBID,
          prmLoginID: getUserSession().loginId,
        });
        const apiColumns = colData || [];
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
        (c) => c.colname === "divisionid" && !isLockOnEditModeCol(c)
      );
      const needsConfig = headerColumns.some(
        (c) => c.colname === "configid" && !isLockOnEditModeCol(c)
      );
      const needsSupplier = headerColumns.some(
        (c) => c.colname === "supplierid" && !isLockOnEditModeCol(c)
      );
      const needsLocation = headerColumns.some(
        (c) => c.colname === "locationid" && !isLockOnEditModeCol(c)
      );

      const tasks = [];
      if (needsDivision) tasks.push(fetchDivisionOptions());
      if (needsConfig && divisionId) tasks.push(fetchGrnTypes(divisionId));
      if (needsSupplier && divisionId) tasks.push(fetchSupplierOptions(divisionId));
      if (needsLocation && divisionId) tasks.push(fetchLocationOptions(divisionId));
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
      fetchLocationOptions,
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
      const evtSet = buildEventColumnSet(apiColumns, [
        "itemid",
        "itemcode",
        "tranqty",
        "baseqty",
        "tranrate",
        "baserate",
        "unitconv",
        "discperc",
      ]);
      // Force-add amount-driving columns regardless of API iseventreq flags
      ["tranqty", "baseqty", "tranrate", "baserate", "unitconv", "discperc"].forEach((k) =>
        evtSet.add(k)
      );
      setEventColumns(evtSet);
      setAllColumns(
        apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
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

      const master = mstRes?.[0] ?? null;
      const details = mapDetailRowsToGridRows(detRes || []);
      const indentDetails = indtRes || [];

      // Direct-based GRNs have no indent linkage at all. The indent-detail
      // fetch above joins purely by ItemID (see mapIndentRowsToChildRowsMap),
      // not by any actual indent reference on this record — so it can
      // spuriously match an unrelated indent that happens to contain the
      // same item, even for a Direct GRN. Gate on basedonid explicitly
      // rather than trusting an empty join result.
      const isDirectBase = String(master?.basedonid ?? "") === BASED_ON.DIRECT.value;

      return {
        master,
        headerValues: master ? mapMasterRowToHeaderValues(master) : null,
        details,
        indentDetails,
        childRowsMap: isDirectBase ? {} : mapIndentRowsToChildRowsMap(details, indentDetails),
      };
    },
    [get]
  );

  const fetchIndentDetailColumns = useCallback(async () => {
    const { apiColumns } = await loadRbDetailGridMeta(
      get,
      GRN_CONFIG.RB_ITEM_PICKER_INDENT,
      GRN_CONFIG.STORAGE_INDT_META
    );
    setAllIndentColumns(
      apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
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
        const { id, ...rawRowData } = rowData;
        const colTypeMap = Object.fromEntries(allColumns.map((c) => [c.key, c.colDataType]));
        const newRowData = Object.fromEntries(
          Object.entries(rawRowData).map(([k, v]) => {
            if (isNumericColDataType(colTypeMap[k]) && v !== null && v !== undefined && v !== "")
              return [k, Number(v)];
            return [k, v];
          })
        );
        const result = await getApiClient(API_BASE_URL_IMS).post(ENDPOINTS.TRAN_FORM_EVENT, {
          prmobjname: GRN_CONFIG.SP_GRID_EVENT,
          prmmyeventcol: colName,
          prmdetjson: buildDetJSON([newRowData], colTypeMap),
          prmmstjson: JSON.stringify([headerValues]),
        });
        // fn_tbl_rb_purgrndet_event returns PascalCase keys (ErrCode, TranAmount, ...),
        // unlike sibling modules' event SPs — normalize so callers can rely on lowercase.
        return (result || []).map((row) =>
          Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]))
        );
      } catch (err) {
        console.error("[GRN] fireCellEvent failed:", err);
        return null;
      } finally {
        setIsEventFiring(false);
      }
    },
    [allColumns]
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
  const clearLocations = useCallback(() => setLocationOptions([]), []);

  return {
    headerColumns,
    headerRbMeta,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchUnlockedHeaderDropdowns,
    fetchDivisionOptions,
    divisionOptions,
    grnTypeOptions,
    supplierOptions,
    transporterOptions,
    destinationOptions,
    locationOptions,
    clientAssetOptions,
    fetchGrnTypes,
    fetchSupplierOptions,
    fetchTransporterOptions,
    fetchDestinationOptions,
    fetchLocationOptions,
    fetchClientAssetOptions,
    getSupplierRow,
    clearGrnTypes,
    clearSuppliers,
    clearTransporters,
    clearDestinations,
    clearLocations,
    clearClientAssets,
    isLoadingGrnTypes,
    isLoadingSuppliers,
    isLoadingTransporters,
    isLoadingDestinations,
    isLoadingLocations,
    isLoadingClientAssets,
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
