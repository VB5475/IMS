// PurchaseVoucherForm.jsx
// Purchase Voucher entry form (add / edit).
// Mirrors PurchaseIndentForm.jsx — same three-phase load, edit-mode gate, item grid.
//
// PV-specific vs Indent:
//   Added: Supplier, Currency, CurrencyRate, BillNo, BillDate,
//          CostCenter, CreditStartDate, Narration
//   3 item picker modes: GRN Base (0) | PO Base (1) | Direct (2)
//   Cascade: DivisionID → clear ConfigID + SupplierID + grid
//            SupplierID → auto-fill Currency + clear grid
//            BasedOnID  → clear grid
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — header fields
//   2. pv-grid-section        — single-tab Item Grid
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
const DocumentLogModal = lazy(() => import("../../components/txn/DocumentLogModal"));
import { DOCUMENT_LOG_CONFIG as DOC_LOG_CFG } from "../../components/txn/documentLogConfig";
import { usePurchaseVoucher } from "../../hooks/usePurchaseVoucher";
import { useItemPickerGroupFilter } from "../../hooks/useItemPickerGroupFilter";
import { useDocumentLogAccess } from "../../hooks/useDocumentLogAccess";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
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
import { getCheckboxValue } from "../../utils/masterFormUtils";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { usePendingCellEventFlush } from "../../hooks/usePendingCellEventFlush";
import { useTransactionFormReset } from "../../hooks/useTransactionFormReset";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  PV_CONFIG,
  PV_GRID_TABS,
  PV_FILTER_CASCADE_RESETS,
  PV_SUMMARY_FIELDS,
  PV_SUMMARY_FIELD_NAMES,
  PV_MULTI_PASTE_COLUMNS,
  PV_REMARK_COLUMNS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  formatPVTranDate,
} from "./constants";
import { buildDirectItemPickerFilterParams } from "../../utils/purchaseItemPicker";
import "./PurchaseVoucherPage.css";

// ── Temp-ID generator (negative → never clash with real IDs) ──────────
let _pvTempId = -1;
const nextTempId = () => _pvTempId--;

// Same inline ISO→yyyy-MM-dd normalization used by usePurchaseVoucher.js's
// mapMasterRowToHeaderValues, for the date-input-bound header fields.
function toDateInputValue(value) {
  if (!value) return null;
  if (typeof value === "string" && value.includes("T")) return value.split("T")[0];
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    trancode: headerValues.trancode ?? "",
    trandate: headerValues.trandate ?? "",
    divisionid: String(headerValues.divisionid ?? ""),
    locationid: String(headerValues.locationid ?? ""),
    configid: String(headerValues.configid ?? ""),
    basedonid: String(headerValues.basedonid ?? "0"),
    supplierid: String(headerValues.supplierid ?? ""),
    currencyname: headerValues.currencyname ?? headerValues.currency ?? "",
    currencyrate: String(headerValues.currencyrate ?? ""),
    billno: headerValues.billno ?? "",
    billdate: headerValues.billdate ?? "",
    costcenterid: String(headerValues.costcenterid ?? ""),
    creditstartdate: headerValues.creditstartdate ?? "",
    narration: headerValues.narration ?? "",
    remarks: headerValues.remarks ?? "",
    assetclientid: String(headerValues.assetclientid ?? ""),
    isclientasset: headerValues.isclientasset ?? 0,
  };
}

function mapPickerToItemRow(item, allColumns) {
  const row = { id: nextTempId() };
  allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
  Object.entries(item).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (lk !== "id" && v != null && Object.prototype.hasOwnProperty.call(row, lk)) row[lk] = v;
  });
  // "Put To Use" (RB_PurPVDet) is a per-line checkbox with no default from the
  // picker SPs — getColDefault("int") leaves it at 0. Default new rows to
  // put-to-use=1 (a sensible "yes" default for a freshly-picked line); this
  // no longer affects the summary panel's totals either way (2026-07-30 —
  // see PV_SUMMARY_FIELDS' comment in constants.js).
  if (Object.prototype.hasOwnProperty.call(row, "puttouse") && item?.puttouse == null) {
    row.puttouse = 1;
  }
  return row;
}

// ── Component ──────────────────────────────────────────────────────────

export default function PurchaseVoucherForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord = location.state?.record ?? null;
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [detailCellErrors, setDetailCellErrors] = useState(null);

  // 2026-08-14 (/pm) — the "Fix N error(s) before saving" banner (built once,
  // at validation time, into formErrors) doesn't auto-update as the user
  // fixes fields one at a time (each field's own change handler only clears
  // fieldErrors for the field just edited) — so a field that's valid again
  // can still show the stale banner above it. Clearing just the known
  // header-validation banner string (not touching any other message already
  // in formErrors, e.g. save-failure/business-rule/detail-grid errors) once
  // every field error is gone fixes that without hiding unrelated errors.
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
  const { get: rawGetLive } = useApi(API_BASE_URL);
  const getLive = useMemo(() => withGetRetry(rawGetLive), [rawGetLive]);
  const { post: postSave } = useApi(API_BASE_URL_IMS);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, pvTypeOptions, supplierOptions,
    costCenterOptions,
    locationOptions, fetchLocationOptions, clearLocations,
    clientAssetOptions, fetchClientAssetOptions, clearClientAssets,
    isLoadingPvTypes,
    fetchPVTypes, clearPvTypes,
    fetchSupplierInfo, getSupplierCurrency,
    fetchCostCenters,
    columns, allColumns, eventColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fireCellEvent,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    clearSaveError,
  } = usePurchaseVoucher(API_BASE_URL);

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
    billno: "",
    billdate: getTodayDateInputValue(),
    costcenterid: 0,
    creditstartdate: getTodayDateInputValue(),
    narration: "",
    remarks: "",
    tranmstgenid: 0,
    companyid: session.companyId,
    yearid: session.yearId,
    loginid: session.loginId,
    idnumber: recordId,
    funccode: PV_CONFIG.RB_MASTER,
  });

  // trandate, billdate, and creditstartdate default to today on a new record;
  // existing records keep their loaded dates. basedonid still has no default —
  // client requirement 2026-07-24 remains for that dropdown.
  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return {
      trandate: getTodayDateInputValue(),
      basedonid: "",
      billdate: getTodayDateInputValue(),
      creditstartdate: getTodayDateInputValue(),
    };
  }, [loadedFilterValues]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState("items");
  const [currencyExternalValues, setCurrencyExternalValues] = useState(null);
  const [billExternalValues, setBillExternalValues] = useState(null);
  const [basedOnId, setBasedOnId] = useState("0");
  const [pasteNotice, setPasteNotice] = useState(null);
  const pasteNoticeTimerRef = useRef(null);
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
  // Select Item popup filters (Based On = Direct only) — items are only
  // fetched once the user clicks Filter; GRN/PO-base branches are untouched.
  const groupFilter = useItemPickerGroupFilter({
    spMainGroup: PV_CONFIG.SP_ITEM_MAIN_GROUP,
    spSubMainGroup: PV_CONFIG.SP_ITEM_SUB_MAIN_GROUP,
    formTag: PV_CONFIG.FORM_TAG,
  });
  const [itemPickerIsDirect, setItemPickerIsDirect] = useState(false);
  // GRN Base picker — grndetid values already present in the item grid, so
  // the picker can grey those rows out and block re-adding the same GRN
  // line twice. Snapshotted fresh each time the picker opens (see
  // handleSelectItem); empty in PO/Direct mode since grndetid is 0 there.
  const [usedGrnDetIds, setUsedGrnDetIds] = useState(() => new Set());

  // ── Edit-mode gate ─────────────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false);
  // Client(Asset) dropdown is only enabled while Is Client Asset is checked.
  const [isClientAssetChecked, setIsClientAssetChecked] = useState(false);

  // Document Log modal (F6) — scoped to this voucher's record id, gated on
  // the session's Document Log permission flags. Mirrors Purchase Indent's
  // rollout (see useDocumentLogAccess.js for the shared implementation).
  const docLog = useDocumentLogAccess({
    tranTypeId: PV_CONFIG.DM_TRAN_TYPE_ID,
    refDepartmentId: DOC_LOG_CFG.PURCHASE_REF_DEPARTMENT_ID,
    recordId,
    getDivisionId: () => headerValuesRef.current?.divisionid,
    isEditMode,
    postSave,
    logLabel: "[PV]",
  });

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
        ? "Loading purchase voucher…"
        : recordLoadError
          ? recordLoadError
          : `PV #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: PV_CONFIG.ROUTE_PATH,
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
        idFields: ["PVID"],
      });
      const { master, headerValues, details } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("Purchase Voucher record not found.");

      headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      seedOptionsFromMaster(master);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);
      setIsClientAssetChecked(getCheckboxValue(headerValues.isclientasset) === 1);

      // seedOptionsFromMaster only seeds dropdowns the master-fill row embeds
      // a display name for (divisionname, suppliername, ...) — the master
      // fill has no locationname, so fetch location options for the loaded
      // division directly, same as the divisionid cascade does on change.
      if (headerValues.divisionid) {
        fetchLocationOptions(headerValues.divisionid);
      }
      // Same gap as location — master fill has no assetclientname either, and
      // this field can be RB-frozen (islockoneditmodeallow) so it may never
      // pass through fetchUnlockedHeaderDropdowns. Fetch directly (division-
      // independent, like Supplier) so a saved selection still resolves to a
      // real label instead of a raw id.
      fetchClientAssetOptions();

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
      console.error("[PV] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load purchase voucher record.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, listRecord, fetchEditRecord, seedOptionsFromMaster, fetchGridColumns, fetchLocationOptions, fetchClientAssetOptions]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || allColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, allColumns.length, loadEditRecord]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode || !loadedMasterRow) return;
    const hv = headerValuesRef.current;
    fetchUnlockedHeaderDropdowns(
      hv.divisionid ?? loadedMasterRow?.divisionid ?? 0,
      hv.trandate,
      hv.configid,
      hv.supplierid,
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

  // Visible RB header columns, RB-ordered. Source of truth for which fields
  // exist as filters — no hand-maintained field list to fall out of sync
  // with the RB (see PV_HEADER_FILTERS removal in constants.js / GRN fix).
  // Summary-panel fields (mstbaseamount, tdsamount, ...) are excluded — RB
  // marks them visible, but they're rendered in EnterpriseSummaryPanel and
  // computed from grid rows, not real header inputs.
  const visibleHeaderColumns = useMemo(() => {
    return headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible) && !PV_SUMMARY_FIELD_NAMES.has(col.colname))
      .sort((a, b) => Number(a.colseqno) - Number(b.colseqno));
  }, [headerColumns]);

  // Dropdown options we fetch ourselves, keyed by live RB colname.
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    divisionid: divisionOptions,
    configid: pvTypeOptions,
    supplierid: supplierOptions,
    costcenterid: costCenterOptions,
    locationid: locationOptions,
    basedonid: PV_CONFIG.BASED_ON_OPTIONS,
    assetclientid: clientAssetOptions,
  }), [divisionOptions, pvTypeOptions, supplierOptions, costCenterOptions, locationOptions, clientAssetOptions]);

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

  // "Select All (Put To Use)" (RB colname selectallputtouse) mirrors the grid's
  // own puttouse column: all rows on → checked, none on → unchecked, a mix →
  // indeterminate. Derived from gridRows, never independently user-set.
  const puttouseHeaderState = useMemo(() => {
    if (gridRows.length === 0) return { checked: 0, indeterminate: false };
    const onCount = gridRows.filter((r) => Number(r.puttouse) !== 0).length;
    return {
      checked: onCount === gridRows.length ? 1 : 0,
      indeterminate: onCount > 0 && onCount < gridRows.length,
    };
  }, [gridRows]);

  // Keep the ref in sync too, so a save that reads headerValuesRef directly
  // (buildSaveRowFromColumns) reflects the live grid aggregate, not whatever
  // was last independently clicked.
  useEffect(() => {
    headerValuesRef.current.selectallputtouse = puttouseHeaderState.checked;
  }, [puttouseHeaderState.checked]);

  const syncedFilters = useMemo(() => {
    const base = visibleHeaderColumns.map(buildFilterDefFromApiCol);
    return base.map((f) =>
      f.FilterColName === "selectallputtouse"
        ? { ...f, indeterminate: puttouseHeaderState.indeterminate }
        : f
    );
  }, [visibleHeaderColumns, buildFilterDefFromApiCol, puttouseHeaderState.indeterminate]);

  // EnterpriseFilterPanel only accepts a single externalValues prop — merge the
  // currency-cascade values, the GRN-selection BillNo/BillDate values, and the
  // grid-derived Select-All-Put-To-Use checked state into one.
  const combinedExternalValues = useMemo(() => ({
    ...currencyExternalValues,
    ...billExternalValues,
    selectallputtouse: puttouseHeaderState.checked,
  }), [currencyExternalValues, billExternalValues, puttouseHeaderState.checked]);

  // Only fields RB marks visible on the master render — same rule as syncedFilters.
  const syncedSummaryFields = useMemo(
    () => syncMasterSummaryFields(PV_SUMMARY_FIELDS, headerColumns),
    [headerColumns]
  );

  const filterFieldTones = useMemo(() => {
    const tones = {};
    syncedFilters.forEach((f) => {
      let tone = "editable";
      if (!isEditMode) tone = "view";
      else if (isEditRoute && f.lockOnEditMode) tone = "frozen";

      // Client(Asset) only makes sense while Is Client Asset is checked —
      // lock it the same way an RB-frozen field would look, without
      // touching the RB metadata itself.
      if (f.FilterColName === "assetclientid" && tone === "editable" && !isClientAssetChecked) {
        tone = "view";
      }

      tones[f.FilterColName] = tone;
      if (f.FilterParameterID) tones[f.FilterParameterID] = tone;
    });
    return tones;
  }, [syncedFilters, isEditMode, isEditRoute, isClientAssetChecked]);

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
      headerValuesRef.current.locationid = 0;
      headerValuesRef.current.assetclientid = 0;
      clearPvTypes();
      clearLocations();
      itemGridRef.current?.clearRows?.();
      if (val && val !== "0") {
        await Promise.all([
          fetchPVTypes(val),
          fetchCostCenters(val, headerValuesRef.current.trandate),
          fetchLocationOptions(val),
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
      setBasedOnId(String(val));
      itemGridRef.current?.clearRows?.();
      return;
    }

    // Header "Select All (Put To Use)" click — toggles every grid row's
    // puttouse in one shot via local grid state only (updateAllRows never
    // routes through fireCellEvent, matching the "don't recalc on puttouse"
    // rule). The checkbox's own displayed value is otherwise fully derived
    // from gridRows (see puttouseHeaderState) — this click is the one place
    // it acts as an input rather than a pure read-out.
    if (colName === "selectallputtouse") {
      const next = Number(val) ? 1 : 0;
      headerValuesRef.current.selectallputtouse = next;
      itemGridRef.current?.updateAllRows?.({ puttouse: next });
      return;
    }

    if (colName === "isclientasset") {
      setIsClientAssetChecked(getCheckboxValue(val) === 1);
      // Selection reset (blank the visible dropdown) is handled by
      // PV_FILTER_CASCADE_RESETS — mirrors it in headerValuesRef.
      headerValuesRef.current.assetclientid = 0;
      return;
    }
  }, [fetchPVTypes, clearPvTypes, fetchSupplierInfo, getSupplierCurrency, fetchCostCenters, fetchLocationOptions, clearLocations]);

  // ── Multi-value paste — Sr. No replication (Direct mode only) ─────
  const handleMultiValuePaste = useCallback((sourceRow, colKey, values) => {
    itemGridRef.current?.updateRow?.(sourceRow.id, { [colKey]: values[0] });
    values.slice(1).forEach((val) => {
      addItemRow({ ...sourceRow, id: nextTempId(), [colKey]: val });
    });
    if (pasteNoticeTimerRef.current) clearTimeout(pasteNoticeTimerRef.current);
    setPasteNotice(`${values.length} row${values.length !== 1 ? "s" : ""} added from pasted serial numbers.`);
    pasteNoticeTimerRef.current = setTimeout(() => setPasteNotice(null), 4000);
  }, [addItemRow]);

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

  // Fire-and-forget from EntryGrid's own perspective (its blur handler never
  // awaits onCellEvent), but trackCellEvent lets handleSave await the
  // recalculation before reading grid/summary state.
  const handleCellEvent = useCallback(({ rowId, colKey, rowData }) =>
    trackCellEvent(async () => {
      const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
      if (!result || !itemGridRef.current) return;
      const responseRow = result?.[0];
      if (!responseRow) return;
      const errCode = responseRow.errcode;
      if (errCode !== 1 && errCode !== 1.0) {
        console.warn("[PV] Cell-event error:", responseRow.errmsg ?? `ErrCode ${errCode}`);
        return;
      }
      const { errcode, errmsg, ...updatedFields } = responseRow;
      itemGridRef.current.updateRow?.(rowId, updatedFields);
      // rowsRef is synced in updateRow, but EnterpriseSummaryPanel still
      // depends on the parent gridRows effect — give it one tick to catch up
      // so getSummary() on Save reflects the new amounts.
      await new Promise((resolve) => setTimeout(resolve, 30));
    }),
  [fireCellEvent, trackCellEvent]);

  // ── Select Item ────────────────────────────────────────────────────
  // Three-way picker: 0=GRN Base, 1=PO Base, 2=Direct. Direct defers the item
  // fetch until Filter is clicked — GRN/PO Base branches fetch immediately,
  // unchanged. Client instruction 2026-07-28, same rollout as Purchase Indent.
  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const headerErrorMap = validateApiColumnsByField(headerValues, visibleHeaderColumns, {
      zeroValidFields: new Set(["basedonid"]),
    });
    setFieldErrors(headerErrorMap);
    if (Object.keys(headerErrorMap).length > 0) {
      setFormErrors(["Please fix the highlighted field(s) below."]);
      return;
    }
    setFormErrors([]);
    const { divisionid, configid, trandate, basedonid, supplierid, locationid } = headerValues;
    const divisionID = divisionid ?? 0;
    const basedOnNum = Number(basedonid);
    // 2026-07-29: BasedOnID 0 = Direct (was 2) — see constants.js note.
    const isDirect = basedOnNum === 0;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);
    setItemNameFilter("");
    groupFilter.resetFilter();
    setItemPickerIsDirect(isDirect);

    // GRN Base only — grndetid (RB_PurPVDet, hidden column, live-confirmed
    // 2026-07-30) already rides along on every GRN-sourced row via
    // mapPickerToItemRow, so the rows already in the grid are enough to know
    // which GRN detail lines were already pulled in.
    if (basedOnNum === 2) {
      const existing = itemGridRef.current?.getRows?.() ?? [];
      const used = new Set(
        existing
          .map((r) => Number(r.grndetid))
          .filter((v) => Number.isFinite(v) && v > 0)
      );
      setUsedGrnDetIds(used);
    } else {
      setUsedGrnDetIds(new Set());
    }

    try {
      let rbCode;
      if (basedOnNum === 2) rbCode = PV_CONFIG.RB_ITEM_PICKER_GRN;
      else if (basedOnNum === 1) rbCode = PV_CONFIG.RB_ITEM_PICKER_PO;
      else rbCode = PV_CONFIG.RB_ITEM_PICKER_DIRECT; // basedOnNum === 0

      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PV_CONFIG.SP_RB_META,
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
        const spItemPicker = basedOnNum === 2 ? PV_CONFIG.SP_ITEM_PICKER_GRN : PV_CONFIG.SP_ITEM_PICKER_PO;
        const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: spItemPicker,
          JSon: JSON.stringify([{
            prmdivisionid: Number(divisionID),
            prmyearid: getUserSession().yearId,
            prmloginid: getUserSession().loginId,
            prmtrandate: formatPVTranDate(trandate),
            prmconfigid: Number(configid ?? 0),
            prmsupplierid: Number(supplierid ?? 0),
            prmlocationid: Number(locationid ?? 0),
            prmtranbook: PV_CONFIG.TRAN_BOOK,
            prmfrmoption: basedOnNum || 0,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        });
        setItemModalItems(rowRes || []);
      }
    } catch (err) {
      console.error("[PV] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, headerColumns, visibleHeaderColumns, groupFilter]);

  // Direct Select Item (fn_tbl_rb_purpvselonlyitem) — trailing AEI filter args + Item Name.
  // GRN/PO-based picker SPs keep their existing payloads unchanged.
  const handleApplyItemFilter = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const { divisionid, configid, trandate, supplierid, locationid } = headerValues;
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
            ObjName: PV_CONFIG.SP_ITEM_PICKER_DIRECT,
            JSon: JSON.stringify([{
              prmdivisionid: Number(divisionID),
              prmyearid: getUserSession().yearId,
              prmloginid: getUserSession().loginId,
              prmtrandate: formatPVTranDate(trandate),
              prmconfigid: Number(configid ?? 0),
              prmsupplierid: Number(supplierid ?? 0),
              prmlocationid: Number(locationid ?? 0),
              prmtranbook: PV_CONFIG.TRAN_BOOK,
              prmfrmoption: 0, // Direct — was hardcoded 2 before the 2026-07-29 remap, see constants.js note
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
      console.error("[PV] Item filter fetch failed:", err);
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

    // A picker-inserted row's Qty/Rate already carry real values (from the
    // GRN/PO/Item Master source), but the grid's calculated columns
    // (baseamount/expense/taxablevalue/cgst/sgst/igst) only ever populate via
    // the server recalc SP a manual Qty/Rate blur triggers — never
    // automatically on insert (confirmed live 2026-07-24: picker SPs return
    // short-form fields like baseamt/tranamt, not the grid's own baseamount/
    // tranamount columns, so those start zeroed until touched). Fire the same
    // recalc for every newly-inserted row right away, via the same
    // handleCellEvent path a real blur uses (errcode check + updateRow),
    // so the summary panel is correct immediately without the user needing
    // to click into and back out of a cell. "tranqty" is always a real
    // event-column here regardless of RB flags (see usePurchaseVoucher.js's
    // fallback list) — colKey only identifies the field to the SP, so any
    // row content is fine to send under it.
    await Promise.all(rows.map((row) => handleCellEvent({ rowId: row.id, colKey: "tranqty", rowData: row })));

    // GRN Base (BasedOnID 2, was 0 before the 2026-07-29 remap) picker rows
    // carry the source GRN's BillNo/BillDate (fn_tbl_rb_purpvselgrndet) — PM:
    // copy them onto the PV's own BillNo/BillDate master fields. Multiple
    // items may span more than one GRN, so use the first selected item's
    // bill details, per PM's clarified rule.
    if (Number(basedOnId) === 2) {
      const first = selectedItems[0];
      const billno = first?.billno ?? "";
      const billdate = toDateInputValue(first?.billdate);
      if (billno || billdate) {
        headerValuesRef.current.billno = billno;
        headerValuesRef.current.billdate = billdate;
        setBillExternalValues({ billno, billdate: billdate ?? "" });
      }
    }
  }, [ensureItemColumns, allColumns, addItemRow, basedOnId, handleCellEvent]);

  const isGrnPickerRowDisabled = useCallback(
    (row) => usedGrnDetIds.has(Number(row.grndetid)),
    [usedGrnDetIds]
  );

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
  const [isSavingPV, setIsSavingPV] = useState(false);

  const buildDefaultHeaderValues = useCallback(() => {
    const resetSession = getUserSession();
    return {
      trancode: "", trandate: getTodayDateInputValue(), divisionid: 0, configid: 0,
      basedonid: "", supplierid: 0, currencyid: 0, currencyrate: 0,
      billno: "", billdate: getTodayDateInputValue(),
      costcenterid: 0, creditstartdate: getTodayDateInputValue(),
      narration: "", remarks: "", tranmstgenid: 0,
      isclientasset: 0, assetclientid: 0,
      companyid: resetSession.companyId, yearid: resetSession.yearId,
      loginid: resetSession.loginId, idnumber: 0, funccode: PV_CONFIG.RB_MASTER,
    };
  }, []);

  const { resetFormToInitialState, discardChanges, completeSuccessfulSave } = useTransactionFormReset({
    storageKeys: [PV_CONFIG.STORAGE_HEADER_META, PV_CONFIG.STORAGE_ENTRY_META],
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
    extraClearFns: [clearPvTypes, clearClientAssets, docLog.resetDocGuid],
    // Back to a blank new-entry state (post-save, or Cancel on a new record)
    // — re-issue a fresh GUID for whatever the user enters next, same as the
    // initial mount fetch. No-op on an edit route (isNewRoute is false there).
    extraReset: () => {
      if (isNewRoute) docLog.fetchDocGuid();
      setCurrencyExternalValues({ currencyname: "", currencyrate: "" });
      setIsClientAssetChecked(false);
      // null (not blank strings) — billno/billdate are ordinary RB header
      // fields already blank in the New-record initialValues; a blank merge
      // isn't needed and, unlike currency, must never later stomp a freshly
      // reloaded edit record's real BillNo/BillDate (see handleDiscardConfirm).
      setBillExternalValues(null);
      summaryRef.current?.resetOverrides?.();
      setFieldErrors({});
      setDetailCellErrors(null);
    },
  });


  const handleSave = useCallback(async ({ skipPostSave = false } = {}) => {
    // Flush a still-focused item-grid cell before reading final row/summary
    // state. If the user typed a new Qty/Rate/Disc%/etc. and clicked Save
    // directly — without tabbing or clicking elsewhere first — that cell's
    // blur (and the recalculation it triggers) may not have happened yet.
    await flushPendingCellEvents(itemGridSectionRef);

    setFormErrors([]);

    // Validate every RB-visible header field, not a hand-maintained subset —
    // a field missing from a static list must never be silently skipped at
    // save time just because nobody remembered to list it (see GRN fix).
    const headerErrorMap = validateApiColumnsByField(headerValuesRef.current, visibleHeaderColumns, {
      zeroValidFields: new Set(["basedonid"]),
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
      buildSaveJsonFields({ label: "PV", mst: mstRow, det: detRows }),
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSavingPV(true);
    try {
      const result = await postSave(PV_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message, newId } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
      // The save response's own message carries the real tranid (see
      // extractSavedIdFromMessage in utils/apiResponse.js). recordId is only
      // the real tranid on an EDIT save (Add is always 0 here, route hasn't
      // changed), but `newId` is the real tranid either way — closes the
      // Add-mode document-linking gap, same as Purchase Indent.
      const savedTranId = newId ?? (isEditRoute ? recordId : null);
      // Saves any document rows staged in the Documents modal but never
      // explicitly submitted via ITS OWN Save button, then links any docs
      // staged under docGuid (before this transaction existed) to the
      // now-saved transaction — see useDocumentLogAccess.finalizeSave.
      // Best-effort: a failure here must never be treated as the PV's own
      // save having failed — it already succeeded by this point.
      await docLog.finalizeSave(savedTranId);
      if (!skipPostSave) completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[PV Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSavingPV(false);
    }
  }, [headerColumns, visibleHeaderColumns, allColumns, columns, isEditRoute, recordId, docLog.finalizeSave, completeSuccessfulSave, flushPendingCellEvents]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave({ skipPostSave: true });
    if (!saved) return;
    window.print();
    completeSuccessfulSave();
  }, [handleSave, completeSuccessfulSave]);

  const [discardOpen, setDiscardOpen] = useState(false);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    // Covers the edit-route branch of discardChanges() (re-fetches the record
    // instead of going through resetFormToInitialState/extraReset, which is
    // where the New-record reset clears this) — a stale Round Off override or
    // GRN-picked BillNo/BillDate must not survive a Cancel either way. Cleared
    // to null (not blank strings) so the merge is a no-op once discardChanges()
    // reloads the record and remounts the filter panel with its real BillNo/
    // BillDate — a blank-string merge would otherwise stomp the reloaded values.
    summaryRef.current?.resetOverrides?.();
    setBillExternalValues(null);
    discardChanges();
  }, [discardChanges]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = headerFetching || isLoadingPvTypes;

  useEntryFormKeyboard({
    blocked: itemModalOpen || docLog.docModalOpen,
    isEditMode,
    isSaving: isSavingPV,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onSavePrint: handleSaveAndPrint,
    onCancel: handleCancel,
    onSelectList: handleSelectListShortcut,
    onToggleCollapsible: handleToggleCollapsible,
    onDocuments: docLog.handleOpenDocuments,
  });

  // ── Extra ActionBar buttons ────────────────────────────────────────
  const pvExtraButtons = useMemo(() => [
    // Show/hide only, never a disabled state — docLog.documentsButtonEntry
    // already encodes this (null when permission gates say no), spread in/out
    // of the array so ActionBar's own `showAlways || isEditMode` filter
    // hides/shows it with Add/Edit mode the same way every other extra
    // button does. Mirrors Purchase Indent's rollout.
    ...(docLog.documentsButtonEntry ? [docLog.documentsButtonEntry] : []),
    {
      key: "saveprint", label: "Save & Print", Icon: Printer, variant: "print",
      onClick: handleSaveAndPrint, disabled: isSavingPV,
      title: FORM_SHORTCUT_TITLES.savePrint,
    },
    {
      key: "save", label: isSavingPV ? "Saving…" : "Save", Icon: Save, variant: "save",
      onClick: handleSave, disabled: isSavingPV, loading: isSavingPV,
      accessKey: "s", title: FORM_SHORTCUT_TITLES.save,
    },
  ], [docLog.documentsButtonEntry, handleSaveAndPrint, isSavingPV, handleSave]);

  const itemGridConfig = { columns, pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] } };
  const combinedError = metaError || headerError;

  // Direct mode only — GRN Base/PO Base items fetch immediately, no filter step.
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
    <div className="workspace-page workspace-page--fill pv-page">
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
            title="Purchase Voucher Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={PV_FILTER_CASCADE_RESETS}
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
      <section className="pv-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={PV_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          headerControls={
            <>
              {pasteNotice && (
                <span className="pv-paste-notice" role="status" aria-live="polite">
                  ✓ {pasteNotice}
                </span>
              )}

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
          multiValuePasteColumns={basedOnId === "0" ? PV_MULTI_PASTE_COLUMNS : null}
          onMultiValuePaste={basedOnId === "0" ? handleMultiValuePaste : null}
          remarkModalColumns={PV_REMARK_COLUMNS}
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
        extraButtons={pvExtraButtons}
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
          isRowDisabled={isGrnPickerRowDisabled}
        />
      </Suspense>

      <Suspense fallback={null}>
        <DocumentLogModal
          ref={docLog.docModalRef}
          isOpen={docLog.docModalOpen}
          onClose={() => docLog.setDocModalOpen(false)}
          tranId={recordId}
          divisionId={headerValuesRef.current?.divisionid}
          tranTypeId={PV_CONFIG.DM_TRAN_TYPE_ID}
          refDepartmentId={DOC_LOG_CFG.PURCHASE_REF_DEPARTMENT_ID}
          guid={docLog.docGuid}
        />
      </Suspense>
    </div>
  );
}
