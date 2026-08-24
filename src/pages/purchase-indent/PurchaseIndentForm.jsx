// PurchaseIndentForm.jsx
// Purchase Indent entry form (add / edit).
// Mirrors PurchaseOrderForm.jsx — same three-phase load, edit-mode gate, item grid.
//
// Simplified vs PO (removed): Amend strip, Supplier, Currency, CreditDays,
//   BasedOnID, Terms tab, EnterpriseSummaryPanel, cell-event, 3rd detail table.
// Added vs PO: ExpDate (Expiry Date), LocationID (pending SP from DBA).
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — header fields (Indent No, Date, Division, Indent Type,
//                               Expiry Date, Department, Location, Remarks)
//   2. ind-grid-section       — single-tab wrapper
//        • Item Grid tab  → EntryGrid (API columns, RB_PurIndentDet)
//                           buttons: Add New | Select Item | Delete
//   3. ActionBar              — Add / Save / Cancel / Close (Alt shortcuts)

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
const DocumentLogModal = lazy(() => import("../../components/txn/DocumentLogModal"));
import { DOCUMENT_LOG_CONFIG as DOC_LOG_CFG } from "../../components/txn/documentLogConfig";
import ItemPickerGroupFilterBar from "../../components/txn/ItemPickerGroupFilterBar";
import { usePurchaseIndent } from "../../hooks/usePurchaseIndent";
import { useItemPickerGroupFilter } from "../../hooks/useItemPickerGroupFilter";
import { useDocumentLogAccess } from "../../hooks/useDocumentLogAccess";
import { useApi } from "../../api/useApi";
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
import { buildGridColumns, isLockOnEditModeCol, isTruthyApiFlag, syncHeaderFilterWithApiCol, editRecordGridColumnOpts, syncEditGridDropdownValues } from "../../utils/gridUtils";
import { validateApiColumnsByField, validateGridRowsDetailed } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { focusFieldAfterCascade } from "../../utils/focusUtils";
import { queryEditableFilterFields, resolveEditLoadParams } from "../../utils/txnFormUtils";
import { dateToStoredValue, getTodayDateInputValue, isDateColumnDef } from "../../utils/dateFormat";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { useTransactionFormReset } from "../../hooks/useTransactionFormReset";
import { usePendingCellEventFlush } from "../../hooks/usePendingCellEventFlush";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  IND_CONFIG,
  IND_MULTI_PASTE_COLUMNS,
  IND_REMARK_COLUMNS,
  IND_GRID_TABS,
  IND_FILTER_CASCADE_RESETS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  formatIndentTranDate,
} from "./constants";
import { buildDirectItemPickerFilterParams } from "../../utils/purchaseItemPicker";
import "./PurchaseIndentPage.css";

// ── Temp-ID generator (negative → never clash with real IDs) ──────────
let _indTempId = -1;
const nextTempId = () => _indTempId--;

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    trancode: headerValues.trancode ?? "",
    trandate: headerValues.trandate ?? "",
    divisionid: headerValues.divisionid ?? 0,
    configid: headerValues.configid ?? 0,
    expecteddate: headerValues.expecteddate ?? "",
    deptid: headerValues.deptid ?? 0,
    locationid: headerValues.locationid ?? 0,
    costcenterid: headerValues.costcenterid ?? 0,
    remarks: headerValues.remarks ?? "",
    indentrefrenceno: headerValues.indentrefrenceno ?? "",
    enteredby: headerValues.enteredby ?? "",
  };
}

// The item picker SP echoes EVERY header param it was called with back on
// every row (not just delivery date) — overlaying the raw echo wholesale
// would make each row inherit stray master-header values it shouldn't, so
// date columns are excluded from the generic overlay below and set
// explicitly instead. "expecteddeliverydate" is a deliberate exception: it's
// the detail RB's own Delivery Date column, meant to inherit the header's
// Expected Delivery Date on insert (still editable per-row afterward) — the
// user confirmed this is existing intended behavior, not the bug the overlay
// exclusion above was written to prevent. Any other date column (if this grid
// ever gets one) still seeds with today, same as before.
function mapPickerToItemRow(item, allColumns, dateColKeys = new Set(), expectedDeliveryDate = "") {
  const row = { id: nextTempId() };
  const today = dateToStoredValue(new Date());
  const deliveryDate = expectedDeliveryDate || today;
  allColumns.forEach(({ key, colDataType }) => {
    if (!dateColKeys.has(key)) { row[key] = getColDefault(colDataType); return; }
    row[key] = key === "expecteddeliverydate" ? deliveryDate : today;
  });
  Object.entries(item).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (lk === "id" || dateColKeys.has(lk)) return;
    if (v != null && Object.prototype.hasOwnProperty.call(row, lk)) row[lk] = v;
  });
  return row;
}

// ── Component ──────────────────────────────────────────────────────────

export default function PurchaseIndentForm() {
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
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();
  const { get: getLive } = useApi(API_BASE_URL);
  const { post: postSave } = useApi(API_BASE_URL_IMS);

  const {
    headerColumns,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    divisionOptions,
    indentTypeOptions,
    departmentOptions,
    locationOptions,
    fetchIndentTypes,
    clearIndentTypes,
    fetchLocations,
    // fetchLocations,
    isLoadingIndentTypes,
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    fetchEditRecord,
    seedOptionsFromMaster,
    fetchUnlockedHeaderDropdowns,
    fireCellEvent,
    saveTxn,
    isSaving,
    saveError,
    clearSaveError,
  } = usePurchaseIndent(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  const headerValuesRef = useRef({
    trancode: "",
    trandate: getTodayDateInputValue(),
    divisionid: 0,
    configid: 0,
    expecteddate: getTodayDateInputValue(),
    deptid: 0,
    locationid: 0,
    costcenterid: 0,
    remarks: "",
    indentrefrenceno: "",
    enteredby: "",
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: recordId,
    funccode: IND_CONFIG.RB_MASTER,
  });

  // trandate/expecteddate default to today on a new record; existing records keep their loaded date.
  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { trandate: getTodayDateInputValue(), expecteddate: getTodayDateInputValue() };
  }, [loadedFilterValues]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState("items");
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [isGridLoading, setIsGridLoading] = useState(false);

  // isEditMode — the single flag driven by clicking either "Add" (new
  // record) or "Edit" (existing record), via enterEditModeWithFocus. Declared
  // here (hoisted up from its original spot further down, see "Edit-mode
  // gate" below) purely so useDocumentLogAccess can read it.
  const [isEditMode, setIsEditMode] = useState(false);

  // Document Log modal (F6) — scoped to this indent's record id, gated on
  // the session's Document Log permission flags (set at login — see
  // extractDmConfigPermissions in session/userSession.js). All of the
  // permission-gate/GUID/button-visibility/post-save-linking logic lives in
  // the shared useDocumentLogAccess hook now (2026-08-13 /pm, extracted here
  // first before rolling out to 8 more modules) — see that file for the
  // reasoning behind reading dmConfig reactively via useUser(), the
  // lowercase-field DM_HANDLE_GUID gotcha, and the dedicated
  // DM_Doc_UpdateOnTranSave linking endpoint.
  //
  // 2026-08-08 (Indent-only instruction): the app-wide convention of
  // rendering the Documents button disabled-with-explanatory-title was
  // replaced, for this module only, with hide/show — see indExtraButtons
  // below (docLog.documentsButtonEntry already encodes this).
  const docLog = useDocumentLogAccess({
    tranTypeId: IND_CONFIG.DM_TRAN_TYPE_ID,
    refDepartmentId: DOC_LOG_CFG.PURCHASE_REF_DEPARTMENT_ID,
    recordId,
    getDivisionId: () => headerValuesRef.current?.divisionid,
    isEditMode,
    postSave,
    logLabel: "[Indent]",
  });

  // Item picker modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);
  const [itemNameFilter, setItemNameFilter] = useState("");
  // Select Item popup filters (Direct mode only) — items are only fetched
  // once the user clicks Filter, not automatically when the modal opens.
  const groupFilter = useItemPickerGroupFilter({
    spMainGroup: IND_CONFIG.SP_ITEM_MAIN_GROUP,
    spSubMainGroup: IND_CONFIG.SP_ITEM_SUB_MAIN_GROUP,
    formTag: IND_CONFIG.FORM_TAG,
  });

  // ── Edit-mode gate ─────────────────────────────────────────────────
  // isEditMode itself is declared up near the useDocumentLogAccess call
  // (see there) — hoisted early so that hook can read it.

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
        ? "Loading purchase indent…"
        : recordLoadError
          ? recordLoadError
          : `Indent #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: IND_CONFIG.ROUTE_PATH,
  });

  // ── Mount: load metadata ───────────────────────────────────────────
  // (docGuid/docBtnVisible fetches now self-fire inside useDocumentLogAccess,
  // keyed on recordId — no longer spliced in here.)
  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta, isEditRoute]);

  // Phase 3 (new route only): pre-load grid columns after detail meta loads
  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(headerValuesRef.current?.divisionid ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns, fetchGridColumns, isEditRoute]);

  // Flush any queued rows once columns are ready
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
        idFields: ["indentid"],
      });
      const { master, headerValues, details } = await fetchEditRecord(params);

      if (!master || !headerValues) {
        throw new Error("Purchase Indent record not found.");
      }

      headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      seedOptionsFromMaster(master);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      const activeCols = await fetchGridColumns(headerValues.divisionid ?? 0, editRecordGridColumnOpts(master));
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;

      const syncedDetails = syncEditGridDropdownValues(details, activeCols || []);

      if (itemGridRef.current?.loadRows) {
        itemGridRef.current.loadRows(syncedDetails);
      } else {
        queuedRowsRef.current = syncedDetails;
      }
    } catch (err) {
      console.error("[Indent] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load purchase indent record.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, listRecord, fetchEditRecord, seedOptionsFromMaster, fetchGridColumns]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || allColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, allColumns.length, loadEditRecord]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode || !loadedMasterRow) return;
    const divisionId = headerValuesRef.current?.divisionid ?? loadedMasterRow?.divisionid ?? 0;
    fetchUnlockedHeaderDropdowns(divisionId);
    fetchGridColumns(divisionId, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
  }, [isEditRoute, isEditMode, loadedMasterRow, fetchUnlockedHeaderDropdowns, fetchGridColumns]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  // ── Multi-value paste — Sr. No replication ──────────────────────
  const handleMultiValuePaste = useCallback((sourceRow, colKey, values) => {
    itemGridRef.current?.updateRow?.(sourceRow.id, { [colKey]: values[0] });
    values.slice(1).forEach((val) => {
      addItemRow({ ...sourceRow, id: nextTempId(), [colKey]: val });
    });
  }, [addItemRow]);

  // ── syncedFilters — built purely from API headerColumns (fully dynamic) ────
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    divisionid: divisionOptions,
    configid: indentTypeOptions,
    deptid: departmentOptions,
    locationid: locationOptions,
  }), [divisionOptions, indentTypeOptions, departmentOptions, locationOptions]);

  const syncedFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];
    return headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible))
      .sort((a, b) => Number(a.colseqno) - Number(b.colseqno))
      .map((col) => {
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
      });
  }, [headerColumns, DROPDOWN_OPTIONS_BY_COL]);

  // ── filterFieldTones — per-field visual state ──────────────────────
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
  const handleFilterChange = useCallback(
    async (colName, val) => {
      headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };
      setFieldErrors((prev) => {
        if (!prev[colName]) return prev;
        const next = { ...prev };
        delete next[colName];
        return next;
      });

      if (colName === "divisionid") {
        headerValuesRef.current.configid = 0;
        headerValuesRef.current.locationid = 0;
        clearIndentTypes();
        itemGridRef.current?.clearRows?.();
        // Location is division-wise (fn_tbl_fetch_divwslocation) — always refetch,
        // even back to the "no division selected" (0) case, so stale options don't linger.
        await fetchLocations(val && val !== "0" ? val : 0);
        if (val && val !== "0") {
          await Promise.all([
            fetchIndentTypes(val),
            fetchLocations(val),
          ]);
          focusFieldAfterCascade(filterPanelRef, "configid");
        }
        return;
      }

      if (colName === "configid") {
        itemGridRef.current?.clearRows?.();
      }
    },
    [fetchIndentTypes, clearIndentTypes, fetchLocations]
  );

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

  // ── Cell event — Qty / Rate recalculation ─────────────────────────
  const handleCellEvent = useCallback(
    ({ rowId, colKey, rowData }) =>
      trackCellEvent(async () => {
        const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
        if (!result || !itemGridRef.current) return;
        const responseRow = result?.[0];
        if (!responseRow) return;
        const errCode = responseRow.errcode;
        if (errCode !== 1 && errCode !== 1.0) {
          console.warn("[Indent] Cell-event error:", responseRow.errmsg ?? `ErrCode ${errCode}`);
          return;
        }
        const { errcode, errmsg, ...updatedFields } = responseRow;
        itemGridRef.current.updateRow?.(rowId, updatedFields);
      }),
    [fireCellEvent, trackCellEvent]
  );

  // ── Select Item ────────────────────────────────────────────────────
  // Direct mode only (Indent has no Indent-wise variant — BasedOnID = 0 /
  // prmFrmOption = 0 per MRD). Opening the modal loads the picker's grid
  // columns and the Main Group filter options, but NOT items — items are
  // only fetched once the user picks filters and clicks Filter (see
  // handleApplyItemFilter below). Client instruction 2026-07-28.
  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValues, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    if (Object.keys(headerErrorMap).length > 0) {
      setFormErrors(["Please fix the highlighted field(s) below."]);
      return;
    }
    setFormErrors([]);
    const { divisionid, configid } = headerValues;
    const divisionID = divisionid ?? 0;

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);
    setItemNameFilter("");
    groupFilter.resetFilter();

    try {
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: IND_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: IND_CONFIG.RB_DETAIL_SELECT }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.rbid,
        prmLoginID: getUserSession().loginId,
      });
      const gridColumns = buildGridColumns(colRes || [], {}, {
        filterable: false,
        allEditable: false,
      });
      setItemModalColumns(gridColumns);

      await groupFilter.fetchMainGroupOptions({ divisionId: divisionID, configId: configid });
      await groupFilter.fetchSubMainGroupOptions({
        divisionId: divisionID,
        configId: configid,
        mainGroupId: 0,
      });
    } catch (err) {
      console.error("[Indent] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, headerColumns, groupFilter]);

  // Direct Select Item (fn_tbl_rb_purindtselitem) — trailing AEI filter args + Item Name.
  const handleApplyItemFilter = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const { divisionid, configid, trandate, expecteddate } = headerValues;
    const divisionID = divisionid ?? 0;
    const expectedDate = expecteddate ?? "";
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
            ObjName: IND_CONFIG.SP_ITEM_PICKER,
            JSon: JSON.stringify([
              {
                prmdivisionid: Number(divisionID),
                prmyearid: getUserSession().yearId,
                prmloginid: getUserSession().loginId,
                prmtrandate: formatIndentTranDate(trandate),
                prmconfigid: Number(configid ?? 0),
                prmsupplierid: 0,
                prmexpdeldate: expectedDate,
                prmtranbook: IND_CONFIG.TRAN_BOOK,
                prmfrmoption: 0,
                ...buildDirectItemPickerFilterParams({
                  maGroupId: hasMain ? groupParams.prmmaingroupid : 0,
                  subMaGroupId: hasSub ? groupParams.prmsubmaingroupid : 0,
                  itemNameSearch: hasItemName ? itemName : "",
                }),
              },
            ]),
            p_ErrCode: -1,
            p_ErrMsg: "",
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
      console.error("[Indent] Item filter fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    }
  }, [getLive, groupFilter, itemNameFilter]);

  const handleInsertItems = useCallback(
    async (selectedItems) => {
      if (!selectedItems?.length) return;
      setActiveTab("items");
      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) return;
      const dateColKeys = new Set(activeCols.filter(isDateColumnDef).map((col) => col.key));
      const headerExpectedDate = headerValuesRef.current?.expecteddate;
      const expectedDeliveryDate = headerExpectedDate ? dateToStoredValue(new Date(headerExpectedDate)) : "";
      const rows = selectedItems.map((item) => mapPickerToItemRow(item, allColumns, dateColKeys, expectedDeliveryDate));
      rows.forEach((row) => addItemRow(row));
      // Fire the same qty/rate recalc a manual blur would trigger, so a
      // picker-inserted row's calculated amounts are correct immediately
      // instead of staying 0.00 until the user touches the cell (client-
      // confirmed 2026-07-24, same fix as Purchase Voucher/Order/Quotation/Inquiry).
      await Promise.all(rows.map((row) => handleCellEvent({ rowId: row.id, colKey: "tranqty", rowData: row })));
    },
    [ensureItemColumns, allColumns, addItemRow, handleCellEvent]
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
  const [isSavingIndent, setIsSavingIndent] = useState(false);

  const buildDefaultHeaderValues = useCallback(() => ({
    trancode: "",
    trandate: getTodayDateInputValue(),
    divisionid: 0,
    configid: 0,
    expecteddate: getTodayDateInputValue(),
    deptid: 0,
    locationid: 0,
    costcenterid: 0,
    remarks: "",
    indentrefrenceno: "",
    enteredby: "",
    tranmstgenid: 0,
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: 0,
    funccode: IND_CONFIG.RB_MASTER,
  }), []);

  const { resetFormToInitialState, discardChanges, completeSuccessfulSave } = useTransactionFormReset({
    storageKeys: [IND_CONFIG.STORAGE_HEADER_META, IND_CONFIG.STORAGE_ENTRY_META],
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
    extraClearFns: [clearIndentTypes, docLog.resetDocGuid],
    // Back to a blank new-entry state (post-save, or Cancel on a new record)
    // — re-issue a fresh GUID for whatever the user enters next, same as the
    // initial mount fetch. No-op on an edit route (isNewRoute is false there).
    extraReset: () => {
      if (isNewRoute) docLog.fetchDocGuid();
      setFieldErrors({});
      setDetailCellErrors(null);
    },
  });


  const handleSave = useCallback(async ({ skipPostSave = false } = {}) => {
    await flushPendingCellEvents(itemGridSectionRef);

    setFormErrors([]);
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValuesRef.current, headerColsToValidate);
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
      colDataType: col.coldatatype,
    }));
    const mstRow = buildSaveRowFromColumns(hv, masterColumnDefs, {
      loginid: getUserSession().loginId,
    });

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, { loginid: getUserSession().loginId })
    );

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: "Indent", mst: mstRow, det: detRows }),
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSavingIndent(true);
    try {
      const result = await postSave(IND_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message, newId } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
      // The save response's own message carries the real tranid — e.g.
      // "Data Inserted/Updated Successfully with ID[ 44]!!!!" — parsed via
      // extractSavedIdFromMessage (see utils/apiResponse.js). This is what
      // closes the previously-documented Add-mode gap: recordId is only the
      // real tranid on an EDIT save (Add is always 0 here, route hasn't
      // changed), but `newId` is the real tranid either way. Falls back to
      // recordId so an Edit save still works even if the message wording
      // ever changes and the regex stops matching.
      const savedTranId = newId ?? (isEditRoute ? recordId : null);
      // Saves any document rows staged in the Documents modal but never
      // explicitly submitted via ITS OWN Save button, then links any docs
      // staged under docGuid (before this transaction existed) to the
      // now-saved transaction — see useDocumentLogAccess.finalizeSave. Covers
      // Add-mode too, since savedTranId comes from this save's own response
      // rather than the (Add-mode-stale) recordId. Best-effort throughout: a
      // failure here must never be treated as the Indent's own save having
      // failed — it already succeeded by this point.
      await docLog.finalizeSave(savedTranId);
      if (!skipPostSave) completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[Indent Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSavingIndent(false);
    }
  }, [headerColumns, allColumns, columns, isEditRoute, recordId, docLog.finalizeSave, completeSuccessfulSave, flushPendingCellEvents]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave({ skipPostSave: true });
    if (!saved) return;
    window.print();
    completeSuccessfulSave();
  }, [handleSave, completeSuccessfulSave]);

  const [discardOpen, setDiscardOpen] = useState(false);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    discardChanges();
  }, [discardChanges]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = headerFetching || isLoadingIndentTypes;

  useEntryFormKeyboard({
    blocked: itemModalOpen || docLog.docModalOpen,
    isEditMode,
    isSaving: isSavingIndent,
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
  const indExtraButtons = useMemo(
    () => [
      // Show/hide only, never a disabled state (2026-08-08, Indent-only
      // instruction) — docLog.documentsButtonEntry already encodes this
      // (null when permission gates say no), spread in/out of the array so
      // ActionBar's own `showAlways || isEditMode` filter hides/shows it
      // with Add/Edit mode the same way every other extra button does.
      ...(docLog.documentsButtonEntry ? [docLog.documentsButtonEntry] : []),
      {
        key: "saveprint",
        label: "Save & Print",
        Icon: Printer,
        variant: "print",
        onClick: handleSaveAndPrint,
        disabled: isSavingIndent,
        title: FORM_SHORTCUT_TITLES.savePrint,
      },
      {
        key: "save",
        label: isSavingIndent ? "Saving…" : "Save",
        Icon: Save,
        variant: "save",
        onClick: handleSave,
        disabled: isSavingIndent,
        loading: isSavingIndent,
        accessKey: "s",
        title: FORM_SHORTCUT_TITLES.save,
      },
    ],
    [docLog.documentsButtonEntry, handleSaveAndPrint, isSavingIndent, handleSave]
  );

  const itemGridConfig = {
    columns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const combinedError = metaError || headerError;

  const itemFilterBar = (
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
    <div className="workspace-page workspace-page--fill ind-page">
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
            <button
              type="button"
              onClick={() => {
                fetchHeaderMeta();
                fetchDetailMeta();
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            panelRef={filterPanelRef}
            title="Purchase Indent Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={IND_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
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
      <section className="ind-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={IND_GRID_TABS}
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
          onCellEvent={handleCellEvent}
          eventColumns={eventColumns}
          readOnly={isEditRoute && !isEditMode}
          existingRecordEdit={isEditRoute && isEditMode}
          cellErrors={detailCellErrors}
          multiValuePasteColumns={IND_MULTI_PASTE_COLUMNS}
          onMultiValuePaste={handleMultiValuePaste}
          remarkModalColumns={IND_REMARK_COLUMNS}
        />
      </section>

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        onCancel={handleCancel}
        addLabel={isEditRoute ? "Edit" : "Add"}
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={indExtraButtons}
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
          awaitingFilter={!groupFilter.filterApplied}
        />
      </Suspense>

      <Suspense fallback={null}>
        <DocumentLogModal
          ref={docLog.docModalRef}
          isOpen={docLog.docModalOpen}
          onClose={() => docLog.setDocModalOpen(false)}
          tranId={recordId}
          divisionId={headerValuesRef.current?.divisionid}
          tranTypeId={IND_CONFIG.DM_TRAN_TYPE_ID}
          refDepartmentId={DOC_LOG_CFG.PURCHASE_REF_DEPARTMENT_ID}
          guid={docLog.docGuid}
        />
      </Suspense>
    </div>
  );
}
