// PurchaseReturnForm.jsx
// Purchase Return entry form (add / edit).
// Mirrors PurchaseVoucherForm.jsx — same three-phase load, edit-mode gate, item grid.
//
// PR-specific vs PV:
//   Added: Return Account, LR/RR No + Date, Transporter City → Transporter →
//          Destination cascade, Driver Name/Address/State, Vehicle No, Licence No
//   Removed: Cost Center, Location, Bill No/Date, Credit Start Date, Narration,
//            Document Log (F6), multi-value paste, Put To Use
//   2 item picker modes: PV Base (1) | Direct (2) — see constants.js note on
//   why this numbering deliberately breaks the "0=Direct" convention.
//   Cascade: DivisionID    → clear ConfigID + SupplierID + grid
//            SupplierID    → auto-fill Currency + clear grid
//            ConfigID      → clear grid
//            BasedOnID     → clear grid
//            TransporterCityID → clear TransporterID + TransporterDestinationID
//            TransporterID     → clear TransporterDestinationID
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — header fields (RB-driven, see visibleHeaderColumns)
//   2. pr-grid-section        — single-tab Item Grid
//        buttons: Select Item | Delete
//   3. EnterpriseSummaryPanel — live totals computed from grid rows
//   4. ActionBar              — Add / Save / Cancel / Close (Alt shortcuts)

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import ItemPickerGroupFilterBar from "../../components/txn/ItemPickerGroupFilterBar";
import { useNotification } from "../../context/NotificationContext";
import EnterpriseSummaryPanel from "../../components/filters/EnterpriseSummaryPanel";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import { usePurchaseReturn } from "../../hooks/usePurchaseReturn";
import { useItemPickerGroupFilter } from "../../hooks/useItemPickerGroupFilter";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  getColDefault,
  buildSaveRowFromColumns,
  OBJ_TYPE,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { buildGridColumns, isLockOnEditModeCol, isTruthyApiFlag, syncHeaderFilterWithApiCol, editRecordGridColumnOpts, syncEditGridDropdownValues, syncMasterSummaryFields } from "../../utils/gridUtils";
import { validateApiColumnsByField, validateGridRowsDetailed } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { focusFieldAfterCascade } from "../../utils/focusUtils";
import { queryEditableFilterFields, resolveEditLoadParams } from "../../utils/txnFormUtils";
import { getTodayDateInputValue } from "../../utils/dateFormat";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { usePendingCellEventFlush } from "../../hooks/usePendingCellEventFlush";
import { useTransactionFormReset } from "../../hooks/useTransactionFormReset";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  PR_CONFIG,
  PR_GRID_TABS,
  PR_FILTER_CASCADE_RESETS,
  PR_SUMMARY_FIELDS,
  PR_SUMMARY_FIELD_NAMES,
  PR_REMARK_COLUMNS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  formatPRTranDate,
  buildPurchaseReturnReportParams,
} from "./constants";
import { useReportPrint } from "../../hooks/useReportPrint";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { buildDirectItemPickerFilterParams } from "../../utils/purchaseItemPicker";
import "./PurchaseReturnPage.css";

// ── Temp-ID generator (negative → never clash with real IDs) ──────────
let _prTempId = -1;
const nextTempId = () => _prTempId--;

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    trancode: headerValues.trancode ?? "",
    trandate: headerValues.trandate ?? "",
    divisionid: String(headerValues.divisionid ?? ""),
    configid: String(headerValues.configid ?? ""),
    basedonid: String(headerValues.basedonid ?? ""),
    supplierid: String(headerValues.supplierid ?? ""),
    currencyname: headerValues.currencyname ?? headerValues.currency ?? "",
    currencyrate: String(headerValues.currencyrate ?? ""),
    returnaccountid: String(headerValues.returnaccountid ?? ""),
    lrrrno: headerValues.lrrrno ?? "",
    lrrrdt: headerValues.lrrrdt ?? "",
    transportercityid: String(headerValues.transportercityid ?? ""),
    transporterid: String(headerValues.transporterid ?? ""),
    transporterdestinationid: String(headerValues.transporterdestinationid ?? ""),
    drivername: headerValues.drivername ?? "",
    driveraddress: headerValues.driveraddress ?? "",
    driverstateid: String(headerValues.driverstateid ?? ""),
    vehicleno: headerValues.vehicleno ?? "",
    licenceno: headerValues.licenceno ?? "",
    remarks: headerValues.remarks ?? "",
  };
}

function mapPickerToItemRow(item, allColumns) {
  const row = { id: nextTempId() };
  allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
  Object.entries(item).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (lk !== "id" && v != null && Object.prototype.hasOwnProperty.call(row, lk)) row[lk] = v;
  });
  return row;
}

// ── Component ──────────────────────────────────────────────────────────

export default function PurchaseReturnForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord = location.state?.record ?? null;
  const notify = useNotification();
  const { printReport, printing: isPrintingPR } = useReportPrint();
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [detailCellErrors, setDetailCellErrors] = useState(null);

  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) {
      setFormErrors((prev) => prev.filter((m) => m !== "Please fix the highlighted field(s) below."));
    }
  }, [fieldErrors]);
  const navigate = useNavigate();

  const itemGridRef = useRef(null);
  const itemGridSectionRef = useRef(null);
  const summaryRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();
  const { get: getLive } = useApi(API_BASE_URL);
  const { post: postSave } = useApi(API_BASE_URL_IMS);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, prTypeOptions, supplierOptions, returnAccountOptions,
    transporterCityOptions, transporterOptions, transporterDestinationOptions, driverStateOptions,
    isLoadingPrTypes,
    fetchReturnTypes, clearPrTypes,
    fetchReturnAccountOptions,
    fetchTransporterOptions, fetchTransporterDestinationOptions,
    clearTransporters, clearTransporterDestinations,
    fetchSupplierInfo, getSupplierCurrency,
    columns, allColumns, eventColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fireCellEvent,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    clearSaveError,
  } = usePurchaseReturn(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  const session = getUserSession();

  const headerValuesRef = useRef({
    trancode: "",
    trandate: getTodayDateInputValue(),
    divisionid: 0,
    configid: 0,
    basedonid: "",
    supplierid: 0,
    currencyid: 0,
    currencyrate: 0,
    returnaccountid: 0,
    lrrrno: "",
    lrrrdt: getTodayDateInputValue(),
    transportercityid: 0,
    transporterid: 0,
    transporterdestinationid: 0,
    drivername: "",
    driveraddress: "",
    driverstateid: 0,
    vehicleno: "",
    licenceno: "",
    remarks: "",
    tranmstgenid: 0,
    companyid: session.companyId,
    yearid: session.yearId,
    loginid: session.loginId,
    idnumber: recordId,
    funccode: PR_CONFIG.RB_MASTER,
  });

  // trandate/lrrrdt default to today on a new record (MRD: both "Default:
  // today's date"); existing records keep their loaded dates. basedonid has
  // no default, same as every sibling module's Based On field.
  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return {
      trandate: getTodayDateInputValue(),
      basedonid: "",
      lrrrdt: getTodayDateInputValue(),
    };
  }, [loadedFilterValues]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState("items");
  const [currencyExternalValues, setCurrencyExternalValues] = useState(null);
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [gridRows, setGridRows] = useState([]);

  // Item picker modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);
  const [itemNameFilter, setItemNameFilter] = useState("");
  const groupFilter = useItemPickerGroupFilter({
    spMainGroup: PR_CONFIG.SP_ITEM_MAIN_GROUP,
    spSubMainGroup: PR_CONFIG.SP_ITEM_SUB_MAIN_GROUP,
    formTag: PR_CONFIG.FORM_TAG,
  });
  const [itemPickerIsDirect, setItemPickerIsDirect] = useState(false);

  // ── Edit-mode gate ─────────────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false);

  const focusFirstEditableFilterField = useCallback(() => {
    const fields = queryEditableFilterFields(filterPanelRef.current);
    if (fields.length === 0) return false;
    fields[0].focus();
    return true;
  }, []);

  const focusSelectItemButton = useCallback(() => {
    setActiveTab("items");
    selectItemBtnRef.current?.focus();
  }, []);

  const enterEditModeWithFocus = useCallback(() => {
    setIsEditMode(true);
    setActiveTab("items");
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (!focusFirstEditableFilterField()) focusSelectItemButton();
      }, 80);
    });
  }, [focusFirstEditableFilterField, focusSelectItemButton]);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  usePageHeader({
    title: isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then add items via the grid."
      : recordLoading
        ? "Loading purchase return…"
        : recordLoadError
          ? recordLoadError
          : `PR #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: PR_CONFIG.ROUTE_PATH,
  });

  // ── Mount: load metadata ───────────────────────────────────────────
  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta, isEditRoute]);

  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(headerValuesRef.current?.divisionid ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns, fetchGridColumns, isEditRoute]);

  useEffect(() => {
    if (columns.length > 0 && itemGridRef.current && queuedRowsRef.current.length > 0) {
      if (itemGridRef.current.loadRows) {
        itemGridRef.current.loadRows(queuedRowsRef.current);
      } else {
        queuedRowsRef.current.forEach((r) => itemGridRef.current.addRow(r));
      }
      queuedRowsRef.current = [];
    }
  }, [columns]);

  // ── Edit flow: load existing record ───────────────────────────────
  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const params = resolveEditLoadParams(recordId, listRecord, {
        idFields: ["PRID"],
      });
      const { master, headerValues, details } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("Purchase Return record not found.");

      headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      seedOptionsFromMaster(master);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      if (headerValues.transportercityid) {
        fetchTransporterOptions(headerValues.transportercityid);
      }
      if (headerValues.transporterid) {
        fetchTransporterDestinationOptions(headerValues.transporterid);
      }

      if (headerValues.currencyname || headerValues.currencyrate) {
        setCurrencyExternalValues({
          currencyname: headerValues.currencyname ?? "",
          currencyrate: String(headerValues.currencyrate ?? ""),
        });
      }
      const activeCols = await fetchGridColumns(headerValues.divisionid ?? 0, editRecordGridColumnOpts(master));
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;

      const syncedDetails = syncEditGridDropdownValues(details, activeCols || []);

      if (itemGridRef.current?.loadRows) {
        itemGridRef.current.loadRows(syncedDetails);
      } else {
        queuedRowsRef.current = syncedDetails;
      }
    } catch (err) {
      console.error("[PR] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load purchase return record.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, listRecord, fetchEditRecord, seedOptionsFromMaster, fetchGridColumns, fetchTransporterOptions, fetchTransporterDestinationOptions]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || allColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, allColumns.length, loadEditRecord]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode || !loadedMasterRow) return;
    const hv = headerValuesRef.current;
    fetchUnlockedHeaderDropdowns(
      hv.divisionid ?? loadedMasterRow?.divisionid ?? 0,
      hv.transportercityid ?? loadedMasterRow?.transportercityid ?? 0,
      hv.transporterid ?? loadedMasterRow?.transporterid ?? 0,
    );
    fetchGridColumns(hv.divisionid ?? loadedMasterRow?.divisionid ?? 0, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
  }, [isEditRoute, isEditMode, loadedMasterRow, fetchUnlockedHeaderDropdowns, fetchGridColumns]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  // Visible RB header columns, RB-ordered. Summary-panel fields (mstbaseamount,
  // ...) are excluded — rendered in EnterpriseSummaryPanel, not real header inputs.
  const visibleHeaderColumns = useMemo(() => {
    return headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible) && !PR_SUMMARY_FIELD_NAMES.has(col.colname))
      .sort((a, b) => Number(a.colseqno) - Number(b.colseqno));
  }, [headerColumns]);

  // Dropdown options we fetch ourselves, keyed by live RB colname.
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    divisionid: divisionOptions,
    configid: prTypeOptions,
    supplierid: supplierOptions,
    returnaccountid: returnAccountOptions,
    transportercityid: transporterCityOptions,
    transporterid: transporterOptions,
    transporterdestinationid: transporterDestinationOptions,
    driverstateid: driverStateOptions,
    basedonid: PR_CONFIG.BASED_ON_OPTIONS,
  }), [divisionOptions, prTypeOptions, supplierOptions, returnAccountOptions, transporterCityOptions, transporterOptions, transporterDestinationOptions, driverStateOptions]);

  // ── syncedFilters — built straight from the live RB column ──────────
  const buildFilterDefFromApiCol = useCallback(
    (col) => {
      const lockOnEditMode = isLockOnEditModeCol(col);
      const staticOptions = DROPDOWN_OPTIONS_BY_COL[col.colname];
      const base = {
        FilterParameterID: col.colname,
        FilterColName: col.colname,
        FilterCaption: col.displayname ?? col.colname,
        FilterColCtrlType: col.colctrltype ?? 0,
        ...(staticOptions ? { staticOptions } : {}),
      };
      return syncHeaderFilterWithApiCol(base, col, { lockOnEditMode });
    },
    [DROPDOWN_OPTIONS_BY_COL]
  );

  const syncedFilters = useMemo(
    () => visibleHeaderColumns.map(buildFilterDefFromApiCol),
    [visibleHeaderColumns, buildFilterDefFromApiCol]
  );

  const combinedExternalValues = useMemo(() => ({
    ...currencyExternalValues,
  }), [currencyExternalValues]);

  const syncedSummaryFields = useMemo(
    () => syncMasterSummaryFields(PR_SUMMARY_FIELDS, headerColumns),
    [headerColumns]
  );

  const filterFieldTones = useMemo(() => {
    const tones = {};
    syncedFilters.forEach((f) => {
      let tone = "editable";
      if (!isEditMode) tone = "view";
      else if (isEditRoute && f.lockOnEditMode) tone = "frozen";
      tones[f.FilterColName] = tone;
      if (f.FilterParameterID) tones[f.FilterParameterID] = tone;
    });
    return tones;
  }, [syncedFilters, isEditMode, isEditRoute]);

  // ── Filter change / cascade ────────────────────────────────────────
  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };
    setFieldErrors((prev) => {
      if (!prev[colName]) return prev;
      const next = { ...prev };
      delete next[colName];
      return next;
    });

    if (colName === "divisionid") {
      headerValuesRef.current.configid = 0;
      headerValuesRef.current.supplierid = 0;
      clearPrTypes();
      itemGridRef.current?.clearRows?.();
      if (val && val !== "0") {
        await Promise.all([
          fetchReturnTypes(val),
          fetchReturnAccountOptions(val),
        ]);
        focusFieldAfterCascade(filterPanelRef, "configid");
      }
      return;
    }

    if (colName === "supplierid") {
      itemGridRef.current?.clearRows?.();
      if (val && val !== "0") {
        const cached = getSupplierCurrency(val);
        if (cached) {
          headerValuesRef.current.currencyid = cached.currencyid ?? cached.CurrencyID;
          headerValuesRef.current.currencyname = cached.currencyname ?? cached.CurrencyName;
          headerValuesRef.current.currencyrate = cached.currencyrate ?? cached.CurrencyRate;
          setCurrencyExternalValues({
            currencyname: cached.currencyname ?? cached.CurrencyName ?? "",
            currencyrate: String(cached.currencyrate ?? cached.CurrencyRate ?? ""),
          });
        } else {
          const info = await fetchSupplierInfo(val);
          if (info) {
            headerValuesRef.current.currencyid = info.CurrencyID ?? info.currencyid;
            headerValuesRef.current.currencyname = info.CurrencyName ?? info.currencyname ?? "";
            headerValuesRef.current.currencyrate = info.CurrencyRate ?? info.currencyrate;
            setCurrencyExternalValues({
              currencyname: info.CurrencyName ?? info.currencyname ?? "",
              currencyrate: String(info.CurrencyRate ?? info.currencyrate ?? ""),
            });
          }
        }
      } else {
        headerValuesRef.current.currencyid = 0;
        headerValuesRef.current.currencyname = "";
        headerValuesRef.current.currencyrate = 0;
        setCurrencyExternalValues({ currencyname: "", currencyrate: "" });
      }
      return;
    }

    if (colName === "configid") {
      itemGridRef.current?.clearRows?.();
      return;
    }

    if (colName === "basedonid") {
      itemGridRef.current?.clearRows?.();
      return;
    }

    if (colName === "transportercityid") {
      headerValuesRef.current.transporterid = 0;
      headerValuesRef.current.transporterdestinationid = 0;
      clearTransporters();
      clearTransporterDestinations();
      if (val && val !== "0") {
        await fetchTransporterOptions(val);
        focusFieldAfterCascade(filterPanelRef, "transporterid");
      }
      return;
    }

    if (colName === "transporterid") {
      headerValuesRef.current.transporterdestinationid = 0;
      clearTransporterDestinations();
      if (val && val !== "0") {
        await fetchTransporterDestinationOptions(val);
        focusFieldAfterCascade(filterPanelRef, "transporterdestinationid");
      }
      return;
    }
  }, [fetchReturnTypes, clearPrTypes, fetchReturnAccountOptions, fetchSupplierInfo, getSupplierCurrency, fetchTransporterOptions, fetchTransporterDestinationOptions, clearTransporters, clearTransporterDestinations]);

  const ensureItemColumns = useCallback(async () => {
    if (gridColumnsLoadedRef.current && columns.length > 0) return columns;
    if (allColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const activeCols = await fetchGridColumns(headerValuesRef.current?.divisionid ?? 0);
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [columns, allColumns, fetchGridColumns]);

  const handleCellEvent = useCallback(({ rowId, colKey, rowData }) =>
    trackCellEvent(async () => {
      const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
      if (!result || !itemGridRef.current) return;
      const responseRow = result?.[0];
      if (!responseRow) return;
      const errCode = responseRow.errcode;
      if (errCode !== 1 && errCode !== 1.0) {
        console.warn("[PR] Cell-event error:", responseRow.errmsg ?? `ErrCode ${errCode}`);
        return;
      }
      const { errcode, errmsg, ...updatedFields } = responseRow;
      itemGridRef.current.updateRow?.(rowId, updatedFields);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }),
  [fireCellEvent, trackCellEvent]);

  // ── Select Item ────────────────────────────────────────────────────
  // Two-way picker: 1=PV Base, 2=Direct. Direct defers the item fetch until
  // Filter is clicked — PV Base fetches immediately, same rollout pattern as
  // every other purchase module's non-Direct picker mode.
  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const headerErrorMap = validateApiColumnsByField(headerValues, visibleHeaderColumns, {
      zeroValidFields: new Set(),
    });
    setFieldErrors(headerErrorMap);
    if (Object.keys(headerErrorMap).length > 0) {
      setFormErrors(["Please fix the highlighted field(s) below."]);
      return;
    }
    setFormErrors([]);
    const { divisionid, configid, trandate, basedonid, supplierid } = headerValues;
    const divisionID = divisionid ?? 0;
    const basedOnNum = Number(basedonid);
    const isDirect = basedOnNum === 2;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);
    setItemNameFilter("");
    groupFilter.resetFilter();
    setItemPickerIsDirect(isDirect);

    try {
      const rbCode = isDirect ? PR_CONFIG.RB_ITEM_PICKER_DIRECT : PR_CONFIG.RB_ITEM_PICKER_PV;

      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PR_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: rbCode }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.rbid,
        prmLoginID: getUserSession().loginId,
      });
      const gridColumns = buildGridColumns(colRes || [], {}, { filterable: false, allEditable: false });
      setItemModalColumns(gridColumns);

      if (isDirect) {
        await groupFilter.fetchMainGroupOptions({ divisionId: divisionID, configId: configid });
        await groupFilter.fetchSubMainGroupOptions({
          divisionId: divisionID,
          configId: configid,
          mainGroupId: 0,
        });
      } else {
        const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PR_CONFIG.SP_ITEM_PICKER_PV,
          JSon: JSON.stringify([{
            prmdivisionid: Number(divisionID),
            prmyearid: getUserSession().yearId,
            prmloginid: getUserSession().loginId,
            prmtrandate: formatPRTranDate(trandate),
            prmconfigid: Number(configid ?? 0),
            prmsupplierid: Number(supplierid ?? 0),
            prmlocationid: 0,
            prmtranbook: PR_CONFIG.TRAN_BOOK,
            prmfrmoption: basedOnNum || 0,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        });
        setItemModalItems(rowRes || []);
      }
    } catch (err) {
      console.error("[PR] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, visibleHeaderColumns, groupFilter]);

  const handleApplyItemFilter = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const { divisionid, configid, trandate, supplierid } = headerValues;
    const divisionID = divisionid ?? 0;
    const itemName = String(itemNameFilter ?? "").trim();

    setItemModalError(null);
    try {
      await groupFilter.applyFilter(
        async (groupParams) => {
          const hasMain = Boolean(groupFilter.mainGroupFilter);
          const hasSub = Boolean(groupFilter.subMainGroupFilter);
          const hasItemName = itemName.length >= 3;
          const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: OBJ_TYPE.FUNCTION,
            ObjName: PR_CONFIG.SP_ITEM_PICKER_DIRECT,
            JSon: JSON.stringify([{
              prmdivisionid: Number(divisionID),
              prmyearid: getUserSession().yearId,
              prmloginid: getUserSession().loginId,
              prmtrandate: formatPRTranDate(trandate),
              prmconfigid: Number(configid ?? 0),
              prmsupplierid: Number(supplierid ?? 0),
              prmlocationid: 0,
              prmtranbook: PR_CONFIG.TRAN_BOOK,
              prmfrmoption: 2,
              ...buildDirectItemPickerFilterParams({
                maGroupId: hasMain ? groupParams.prmmaingroupid : 0,
                subMaGroupId: hasSub ? groupParams.prmsubmaingroupid : 0,
                itemNameSearch: hasItemName ? itemName : "",
              }),
            }]),
            p_ErrCode: -1, p_ErrMsg: "",
          });
          setItemModalItems(rowRes || []);
        },
        {
          validate: ({ mainGroupFilter, subMainGroupFilter }) => {
            const hasMain = Boolean(mainGroupFilter);
            const hasSub = Boolean(subMainGroupFilter);
            const hasItemName = itemName.length >= 3;
            if (itemName.length > 0 && itemName.length < 3) {
              throw new Error("Item Name must be at least 3 characters.");
            }
            if (!hasMain && !hasSub && !hasItemName) {
              throw new Error(
                "Select Item Main Group, Item Sub Main Group, or enter at least 3 characters in Item Name."
              );
            }
          },
        }
      );
    } catch (err) {
      console.error("[PR] Item filter fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    }
  }, [getLive, groupFilter, itemNameFilter]);

  const handleInsertItems = useCallback(async (selectedItems) => {
    if (!selectedItems?.length) return;
    setActiveTab("items");
    const activeCols = await ensureItemColumns();
    if (!activeCols?.length) return;

    const rows = selectedItems.map((item) => mapPickerToItemRow(item, allColumns));
    rows.forEach((row) => addItemRow(row));

    // Picker-inserted rows carry real Qty/Rate but the calculated columns
    // (taxable value/CGST/SGST/IGST/net amount) only populate via the
    // server recalc SP — fire it immediately for every inserted row, same
    // pattern as every other purchase module (see PurchaseVoucherForm.jsx).
    await Promise.all(rows.map((row) => handleCellEvent({ rowId: row.id, colKey: "qty", rowData: row })));
  }, [ensureItemColumns, allColumns, addItemRow, handleCellEvent]);

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "items") handleSelectItem();
  }, [activeTab, handleSelectItem]);

  const handleToggleCollapsible = useCallback(() => {
    itemGridRef.current?.toggleFocusedRowCollapsible?.();
  }, []);

  // ── Delete selected rows ───────────────────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    if (!itemGridRef.current) return;
    const selected = itemGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  // ── Save ───────────────────────────────────────────────────────────
  const [isSavingPR, setIsSavingPR] = useState(false);

  const buildDefaultHeaderValues = useCallback(() => {
    const resetSession = getUserSession();
    return {
      trancode: "", trandate: getTodayDateInputValue(), divisionid: 0, configid: 0,
      basedonid: "", supplierid: 0, currencyid: 0, currencyrate: 0,
      returnaccountid: 0, lrrrno: "", lrrrdt: getTodayDateInputValue(),
      transportercityid: 0, transporterid: 0, transporterdestinationid: 0,
      drivername: "", driveraddress: "", driverstateid: 0,
      vehicleno: "", licenceno: "", remarks: "", tranmstgenid: 0,
      companyid: resetSession.companyId, yearid: resetSession.yearId,
      loginid: resetSession.loginId, idnumber: 0, funccode: PR_CONFIG.RB_MASTER,
    };
  }, []);

  const { resetFormToInitialState, discardChanges, completeSuccessfulSave } = useTransactionFormReset({
    storageKeys: [PR_CONFIG.STORAGE_HEADER_META, PR_CONFIG.STORAGE_ENTRY_META],
    buildDefaultHeaderValues,
    headerValuesRef,
    queuedRowsRef,
    gridColumnsLoadedRef,
    itemGridRef,
    editRecordLoadedRef,
    isEditRoute,
    loadEditRecord,
    exitEditMode,
    clearSaveError,
    setActiveTab,
    setIsGridLoading,
    setItemSelectionCount,
    setItemModalOpen,
    setItemModalItems,
    setItemModalColumns,
    setItemModalLoading,
    setItemModalError,
    setFilterResetKey,
    setLoadedFilterValues,
    setGridRows,
    extraClearFns: [clearPrTypes],
    extraReset: () => {
      setCurrencyExternalValues({ currencyname: "", currencyrate: "" });
      summaryRef.current?.resetOverrides?.();
      setFieldErrors({});
      setDetailCellErrors(null);
    },
  });

  const handleSave = useCallback(async ({ skipPostSave = false } = {}) => {
    await flushPendingCellEvents(itemGridSectionRef);

    setFormErrors([]);

    const headerErrorMap = validateApiColumnsByField(headerValuesRef.current, visibleHeaderColumns, {
      zeroValidFields: new Set(),
    });
    setFieldErrors(headerErrorMap);

    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    const { errors: detailErrors, cellErrors: detailCellErrs } = validateGridRowsDetailed(detailRows, columns, { requireAtLeastOne: true });
    setDetailCellErrors(detailCellErrs);

    const headerBannerMsg =
      Object.keys(headerErrorMap).length > 0 ? ["Please fix the highlighted field(s) below."] : [];
    const allErrors = [...headerBannerMsg, ...(detailRows.length === 0 ? detailErrors : [])];
    if (Object.keys(headerErrorMap).length > 0 || detailCellErrs.size > 0 || detailRows.length === 0) {
      setFormErrors(allErrors);
      return false;
    }

    const hv = headerValuesRef.current;
    const masterColumnDefs = headerColumns.map((col) => ({
      key: col.colname,
      colDataType: col.coldatatype || null,
    }));
    const mstRow = buildSaveRowFromColumns(hv, masterColumnDefs, {
      ...(summaryRef.current?.getSummary?.() ?? {}),
      loginid: getUserSession().loginId,
    });

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, { loginid: getUserSession().loginId })
    );

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: "PR", mst: mstRow, det: detRows }),
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSavingPR(true);
    try {
      const result = await postSave(PR_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
      if (!skipPostSave) completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[PR Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSavingPR(false);
    }
  }, [headerColumns, visibleHeaderColumns, allColumns, columns, isEditRoute, completeSuccessfulSave, flushPendingCellEvents]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave({ skipPostSave: true });
    if (!saved) return;
    // PurchaseReturn.rpt has no per-record filter (see constants.js) — this
    // fires the same company-wide report the listing Print button does.
    try {
      await printReport({
        ...PRINT_REPORT_CONFIG["purchase-return"],
        jsonParameters: buildPurchaseReturnReportParams(),
      });
    } catch (err) {
      notify.error(err?.message || "Saved, but failed to generate the print report.");
    }
    completeSuccessfulSave();
  }, [handleSave, completeSuccessfulSave, printReport, notify]);

  const [discardOpen, setDiscardOpen] = useState(false);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    summaryRef.current?.resetOverrides?.();
    discardChanges();
  }, [discardChanges]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = headerFetching || isLoadingPrTypes;

  useEntryFormKeyboard({
    blocked: itemModalOpen,
    isEditMode,
    isSaving: isSavingPR || isPrintingPR,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onSavePrint: handleSaveAndPrint,
    onCancel: handleCancel,
    onSelectList: handleSelectListShortcut,
    onToggleCollapsible: handleToggleCollapsible,
  });

  // ── Extra ActionBar buttons ────────────────────────────────────────
  const prExtraButtons = useMemo(() => [
    {
      key: "saveprint", label: isPrintingPR ? "Printing…" : "Save & Print", Icon: Printer, variant: "print",
      onClick: handleSaveAndPrint, disabled: isSavingPR || isPrintingPR,
      title: FORM_SHORTCUT_TITLES.savePrint,
    },
    {
      key: "save", label: isSavingPR ? "Saving…" : "Save", Icon: Save, variant: "save",
      onClick: handleSave, disabled: isSavingPR, loading: isSavingPR,
      accessKey: "s", title: FORM_SHORTCUT_TITLES.save,
    },
  ], [handleSaveAndPrint, isSavingPR, isPrintingPR, handleSave]);

  const itemGridConfig = { columns, pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] } };
  const combinedError = metaError || headerError;

  // Direct mode only — PV Base items fetch immediately, no filter step.
  const itemFilterBar = !itemPickerIsDirect ? null : (
    <ItemPickerGroupFilterBar
      mainGroupOptions={groupFilter.mainGroupOptions}
      subMainGroupOptions={groupFilter.subMainGroupOptions}
      mainGroupValue={groupFilter.mainGroupFilter}
      subMainGroupValue={groupFilter.subMainGroupFilter}
      onMainGroupChange={(value) => groupFilter.handleMainGroupChange(value, {
        divisionId: headerValuesRef.current.divisionid,
        configId: headerValuesRef.current.configid,
        defaultMaGroupId: 0,
      })}
      onSubMainGroupChange={groupFilter.setSubMainGroupFilter}
      onFilter={handleApplyItemFilter}
      filterLoading={groupFilter.filterLoading}
      subMainAlwaysEnabled
      showItemName
      itemNameValue={itemNameFilter}
      onItemNameChange={setItemNameFilter}
    />
  );

  return (
    <div className="workspace-page workspace-page--fill pr-page">
      <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
      <ConfirmDialog
        isOpen={discardOpen}
        message="Discard changes and reset the form?"
        onConfirm={handleDiscardConfirm}
        onCancel={() => setDiscardOpen(false)}
      />

      <section className="workspace-page__filters">
        {combinedError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{combinedError}</span>
            <button type="button" onClick={() => { fetchHeaderMeta(); fetchDetailMeta(); }}>Retry</button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            panelRef={filterPanelRef}
            title="Purchase Return Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={PR_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            externalValues={combinedExternalValues}
            isSearching={filterBusy || recordLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterBusy || !headerMetaReady}
            fieldTones={filterFieldTones}
            fieldErrors={fieldErrors}
            onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
          />
        )}
      </section>

      {/* ── Single-tab grid section ───────────────────────────────────── */}
      <section className="pr-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={PR_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          headerControls={
            <>
              <button
                ref={selectItemBtnRef}
                type="button"
                className="eg-tab-btn"
                onClick={handleSelectItem}
                disabled={!isEditMode}
                title="Pick items from list (Tab here after header fields)"
              >
                <Package size={12} strokeWidth={2.5} />
                Select Item
              </button>

              <button
                type="button"
                className="eg-tab-btn eg-tab-btn--danger"
                onClick={handleDeleteSelected}
                disabled={!isEditMode || itemSelectionCount === 0}
                title="Delete selected rows"
              >
                <Trash2 size={12} strokeWidth={2} />
                Delete
              </button>
            </>
          }
          hideBottomPanel
          emptyMessage="No items yet. Click Select Item above."
          onSelectionChange={setItemSelectionCount}
          onRowsChange={setGridRows}
          onCellEvent={handleCellEvent}
          eventColumns={eventColumns}
          readOnly={isEditRoute && !isEditMode}
          existingRecordEdit={isEditRoute && isEditMode}
          cellErrors={detailCellErrors}
          remarkModalColumns={PR_REMARK_COLUMNS}
        />
      </section>

      <EnterpriseSummaryPanel
        ref={summaryRef}
        fields={syncedSummaryFields}
        rows={gridRows}
        masterValues={loadedMasterRow}
      />

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        onCancel={handleCancel}
        addLabel={isEditRoute ? "Edit" : "Add"}
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={prExtraButtons}
      />

      <Suspense fallback={null}>
        <OrderItemModal
          isOpen={itemModalOpen}
          onClose={() => setItemModalOpen(false)}
          items={itemModalItems}
          columns={itemModalColumns}
          isLoading={itemModalLoading || groupFilter.filterLoading}
          error={itemModalError}
          onInsert={handleInsertItems}
          filterBar={itemFilterBar}
          awaitingFilter={itemPickerIsDirect && !groupFilter.filterApplied}
        />
      </Suspense>
    </div>
  );
}
