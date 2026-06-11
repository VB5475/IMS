// PurchaseOrderForm.jsx
// Purchase Order entry form (add / edit).
// Mirrors PurchaseInquiryForm.jsx exactly — same three-phase load, same 3-tab layout.
// PO-specific additions vs PI: Amend strip, Currency, Cr. Days, Supplier auto-fill on select.
//
// Layout (top → bottom):
//   1. Amend strip          — checkbox + conditional PO-select dropdown
//   2. EnterpriseFilterPanel — header fields (PO No, Date, Division, PO Type,
//                              Based On, Supplier, Currency (locked), Currency Rate (locked),
//                              Cr. Days, Delivery Date, Dept, Remarks)
//   3. po-grid-section       — 2-tab wrapper
//        • Item Grid tab  → EntryGrid (API columns, RB_PurPODet)
//                           button: Select Item
//        • Terms tab      → static terms table
//        Fixed controls (always): Approved filter | Delete
//   4. EnterpriseSummaryPanel — live totals computed from grid rows (reusable)
//   5. ActionBar            — Save / Cancel / Close etc. (bottom-right, Alt shortcuts)

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, FileText, Printer, Save, LogOut } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import OrderItemModal from "../../components/txn/OrderItemModal";
import EnterpriseSummaryPanel from "../../components/filters/EnterpriseSummaryPanel";
import SearchSelect from "../../components/ui/SearchSelect";
import { usePurchaseOrder } from "../../hooks/usePurchaseOrder";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_LOGIN_ID,
  getColDefault,
  OBJ_TYPE,
} from "../../api/constants";
import { buildGridColumns } from "../../utils/gridUtils";
import { usePageHeader } from "../../context/PageHeaderContext";
import {
  PO_CONFIG,
  PO_HEADER_FILTERS,
  PO_GRID_TABS,
  APPROVED_OPTS,
  TERMS_COLUMNS,
  PO_SUMMARY_FIELDS,
  PO_FILTER_CASCADE_RESETS,
  PO_SHORTCUT_CONFIG,
  formatTranDate,
} from "./constants";
import "./PurchaseOrderPage.css";

// ── Temp-ID generator (negative → never clash with real IDs) ──────────
let _poTempId = -1;
const nextTempId = () => _poTempId--;

// Returns all focusable, visible filter field elements inside a panel node.
function queryEditableFilterFields(panel) {
  if (!panel) return [];
  return [
    ...panel.querySelectorAll(
      "input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), .search-select__trigger:not([disabled])"
    ),
  ].filter((el) => el.offsetParent !== null);
}

function mapPickerToItemRow(item, allColumns) {
  const row = { id: nextTempId() };
  allColumns.forEach(({ key, colDataType }) => {
    row[key] = getColDefault(colDataType);
  });
  Object.entries(item).forEach(([k, v]) => {
    if (k !== "id" && v != null && Object.prototype.hasOwnProperty.call(row, k)) row[k] = v;
  });
  return row;
}

// ── Component ──────────────────────────────────────────────────────────

export default function PurchaseOrderForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const navigate = useNavigate();

  const itemGridRef = useRef(null);
  const summaryRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);

  const {
    headerColumns,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    divisionOptions,
    poTypeOptions,
    supplierOptions,
    departmentOptions,
    existingPOs,
    fetchPoTypes,
    clearPoTypes,
    fetchSupplierInfo,
    getSupplierCurrency,
    fetchExistingPOs,
    fetchUniqueId,
    isLoadingPoTypes,
    columns,
    allColumns,
    isFetching,
    metaError,
    eventColumns,
    fetchDetailMeta,
    fetchGridColumns,
    fireCellEvent,
    saveTxn,
    isSaving,
    saveError,
    clearSaveError,
  } = usePurchaseOrder(API_BASE_URL);

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const headerValuesRef = useRef({
    TranCode: "",
    TranDate: todayISO,
    ConfigID: 0,
    DeliveryDate: null,
    DivisionID: 0,
    SupplierID: 0,
    DeptID: 0,
    CurrencyID: 0,
    CurrencyName: "",
    CurrencyRate: 0,
    CreditDays: 0,
    BasedOnID: "0",
    Remarks: "",
    TranMstGenID: 0,
    CompanyID: 1,
    YearID: PO_CONFIG.DIVISION_YEAR_ID,
    LoginID: 1,
    IDNumber: recordId,
    IsAmend: 0,
    AmendPOID: 0,
  });

  const filterInitialValues = useMemo(() => ({ BasedOnID: "0", TranDate: todayISO }), [todayISO]);

  const [filterResetKey, setFilterResetKey] = useState(0);

  // ── Amend strip state ──────────────────────────────────────────────
  const [isAmend, setIsAmend] = useState(false);
  const [amendPOID, setAmendPOID] = useState("");

  const handleAmendChange = useCallback(
    async (checked) => {
      setIsAmend(checked);
      headerValuesRef.current.IsAmend = checked ? 1 : 0;
      if (!checked) {
        setAmendPOID("");
        headerValuesRef.current.AmendPOID = 0;
        return;
      }
      await fetchExistingPOs();
    },
    [fetchExistingPOs]
  );

  const handleAmendPOChange = useCallback((val) => {
    setAmendPOID(val);
    headerValuesRef.current.AmendPOID = Number(val) || 0;
  }, []);

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

  const enterEditModeWithFocus = useCallback(async () => {
    if (isNewRoute) {
      const uid = await fetchUniqueId();
      headerValuesRef.current.TranMstGenID = uid;
    }
    setIsEditMode(true);
    setActiveTab("items");
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (!focusFirstEditableFilterField()) {
          focusSelectItemButton();
        }
      }, 80);
    });
  }, [isNewRoute, fetchUniqueId, focusFirstEditableFilterField, focusSelectItemButton]);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  // ── Tab state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("items");

  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const activeSelectionCount = activeTab === "items" ? itemSelectionCount : 0;

  const [approvedFilter, setApprovedFilter] = useState("all");
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [gridRows, setGridRows] = useState([]);
  const [currencyExternalValues, setCurrencyExternalValues] = useState(null);

  // Item picker modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);

  // Collapsible indent children (indent-wise mode)
  const [childRowsMap, setChildRowsMap] = useState({});
  const [childColumns, setChildColumns] = useState([]);

  usePageHeader({
    title: isNewRoute ? "New Purchase Order" : "Purchase Order",
    subtitle: isNewRoute
      ? "Fill in the header fields, then use Item Grid or Suppliers tabs."
      : `PO #${recordId || routeId || "—"} — fill in the header fields, then use Item Grid or Suppliers tabs.`,
    showBack: true,
    backTo: "/purchase-order",
  });

  // ── Mount: load metadata ───────────────────────────────────────────
  useEffect(() => {
    fetchHeaderMeta();
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta]);

  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current) return;
    fetchGridColumns(headerValuesRef.current?.DivisionID ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns, fetchGridColumns]);

  useEffect(() => {
    if (columns.length > 0 && itemGridRef.current && queuedRowsRef.current.length > 0) {
      queuedRowsRef.current.forEach((r) => itemGridRef.current.addRow(r));
      queuedRowsRef.current = [];
    }
  }, [columns]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  // ── syncedFilters — inject dynamic options ─────────────────────────
  const syncedFilters = useMemo(() => {
    const injectOptions = (filter) => {
      switch (filter.FilterParameterID) {
        case "DivisionID":
          return { ...filter, staticOptions: divisionOptions };
        case "ConfigID":
          return { ...filter, staticOptions: poTypeOptions };
        case "SupplierID":
          return { ...filter, staticOptions: supplierOptions };
        case "DeptID":
          return { ...filter, staticOptions: departmentOptions };
        default:
          return filter;
      }
    };

    if (headerColumns.length === 0) return PO_HEADER_FILTERS.map(injectOptions);

    const apiColMap = {};
    headerColumns.forEach((col) => {
      apiColMap[col.ColName] = col;
    });

    return PO_HEADER_FILTERS.map((filter) => {
      const withOpts = injectOptions(filter);
      const apiCol = apiColMap[filter.FilterParameterID] || apiColMap[filter.FilterColName];
      if (!apiCol) return withOpts;
      return { ...withOpts, FilterColName: apiCol.ColName };
    });
  }, [headerColumns, divisionOptions, poTypeOptions, supplierOptions, departmentOptions]);

  // ── Filter change / cascade ────────────────────────────────────────
  const handleFilterChange = useCallback(
    async (colName, val) => {
      headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

      if (colName === "DivisionID") {
        headerValuesRef.current.ConfigID = 0;
        headerValuesRef.current.SupplierID = 0;
        clearPoTypes();
        itemGridRef.current?.clearRows?.();
        setChildRowsMap({});
        if (val && val !== "0") await fetchPoTypes(val);
        return;
      }

      if (colName === "TranDate") {
        headerValuesRef.current.SupplierID = 0;
        itemGridRef.current?.clearRows?.();
        setChildRowsMap({});
        return;
      }

      if (colName === "SupplierID") {
        itemGridRef.current?.clearRows?.();
        setChildRowsMap({});
        if (val && val !== "0") {
          const cached = getSupplierCurrency(val);
          if (cached) {
            headerValuesRef.current.CurrencyID = cached.CurrencyID;
            headerValuesRef.current.CurrencyName = cached.CurrencyName;
            headerValuesRef.current.CurrencyRate = cached.CurrencyRate;
            headerValuesRef.current.CreditDays = cached.CrDays;
            setCurrencyExternalValues({
              CurrencyName: cached.CurrencyName,
              CurrencyRate: String(cached.CurrencyRate),
            });
          } else {
            const info = await fetchSupplierInfo(val);
            if (info) {
              headerValuesRef.current.CurrencyID = info.CurrencyID;
              headerValuesRef.current.CurrencyRate = info.CurrencyRate;
              headerValuesRef.current.CreditDays = info.CrDays;
              setCurrencyExternalValues({
                CurrencyName: "",
                CurrencyRate: String(info.CurrencyRate),
              });
            }
          }
        } else {
          headerValuesRef.current.CurrencyID = 0;
          headerValuesRef.current.CurrencyName = "";
          headerValuesRef.current.CurrencyRate = 0;
          setCurrencyExternalValues({ CurrencyName: "", CurrencyRate: "" });
        }
      }
    },
    [fetchPoTypes, clearPoTypes, fetchSupplierInfo, getSupplierCurrency]
  );

  const ensureItemColumns = useCallback(async () => {
    if (gridColumnsLoadedRef.current && columns.length > 0) return columns;
    if (allColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const activeCols = await fetchGridColumns(headerValuesRef.current?.DivisionID ?? 0);
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [columns, allColumns, fetchGridColumns]);

  // ── Cell event — qty / rate recalculation ─────────────────────────
  const handleCellEvent = useCallback(
    async ({ rowId, colKey, rowData }) => {
      const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
      if (!result || !itemGridRef.current) return;
      const responseRow = result?.Links?.[0];
      if (!responseRow) return;
      const errCode = responseRow.ErrCode;
      if (errCode !== 1 && errCode !== 1.0) {
        console.warn("[PO] Cell-event error:", responseRow.ErrMsg ?? `ErrCode ${errCode}`);
        return;
      }
      const { ErrCode, ErrMsg, ...updatedFields } = responseRow;
      itemGridRef.current.updateRow?.(rowId, updatedFields);
    },
    [fireCellEvent]
  );

  // ── Select Item ────────────────────────────────────────────────────
  const handleSelectItem = useCallback(async () => {
    const { DivisionID, ConfigID, TranDate, BasedOnID } = headerValuesRef.current;
    const divisionID = DivisionID ?? 0;
    if (!divisionID || divisionID === "0" || divisionID === 0) {
      alert("Please select a Division before selecting items.");
      return;
    }

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      const rbCode =
        Number(BasedOnID) === 2 ? PO_CONFIG.RB_ITEM_PICKER_INDENT : PO_CONFIG.RB_ITEM_PICKER_DIRECT;

      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PO_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: rbCode }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.Table?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const gridColumns = buildGridColumns(
        colRes?.Links || [],
        {},
        {
          filterable: false,
          allEditable: false,
        }
      );
      setItemModalColumns(gridColumns);

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PO_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([
          {
            prmDivisionID: Number(divisionID),
            prmYearID: PO_CONFIG.CONFIG_YEAR_ID,
            prmLoginID: DEFAULT_LOGIN_ID,
            prmTranDate: formatTranDate(TranDate),
            prmConfigID: Number(ConfigID ?? 0),
            prmSupplierID: Number(headerValuesRef.current?.SupplierID ?? 0),
            prmTranBook:
              Number(BasedOnID) === 2 ? PO_CONFIG.INDENT_SOURCE_BOOK : PO_CONFIG.TRAN_BOOK,
            prmFrmOption: Number(BasedOnID) || 0,
          },
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setItemModalItems(rowRes?.Table || []);
    } catch (err) {
      console.error("[PO] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive]);

  const handleInsertItems = useCallback(
    async (selectedItems) => {
      if (!selectedItems?.length) return;
      setActiveTab("items");

      const isIndentWise = Number(headerValuesRef.current?.BasedOnID) === 2;

      if (!isIndentWise) {
        const activeCols = await ensureItemColumns();
        if (!activeCols?.length) return;
        setChildRowsMap({});
        setChildColumns([]);
        selectedItems.forEach((item) => addItemRow(mapPickerToItemRow(item, allColumns)));
        return;
      }

      ensureItemColumns().catch(() => {});

      const cleanItems = selectedItems.map(({ id: _id, ...rest }) => rest);
      setIsGridLoading(true);
      try {
        const summaryResponse = await fetch(`${API_BASE_URL_IMS}${ENDPOINTS.API_VALUES}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ObjType: OBJ_TYPE.FUNCTION,
            ObjName: PO_CONFIG.SP_INDENT_SUMMARY,
            JSon: [{ prmJSon: cleanItems }],
            p_ErrCode: -1,
            p_ErrMsg: "",
          }),
        });
        const summaryRes = await summaryResponse.json();

        const parents = summaryRes?.Table ?? [];
        if (!parents.length) return;

        const newChildRowsMap = {};
        parents.forEach((parent) => {
          const pid = String(Math.round(Number(parent.ItemID)));
          const children = cleanItems.filter(
            (c) => String(Math.round(Number(c.ChildFKey))) === pid
          );
          if (children.length > 0) newChildRowsMap[pid] = children;
          addItemRow({ ...parent, id: pid });
        });

        setChildRowsMap((prev) => ({ ...prev, ...newChildRowsMap }));
        setChildColumns(itemModalColumns.filter((c) => c.key !== "cb"));
      } catch (err) {
        console.error("[PO] Indent summary fetch failed:", err);
      } finally {
        setIsGridLoading(false);
      }
    },
    [ensureItemColumns, allColumns, addItemRow, itemModalColumns]
  );

  // ── Delete selected rows ───────────────────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    if (!itemGridRef.current) return;
    const selected = itemGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  // ── Save ───────────────────────────────────────────────────────────
  const [isSavingPO, setIsSavingPO] = useState(false);

  const handleSave = useCallback(async () => {
    const mstRow = {};
    headerColumns.forEach((col) => {
      mstRow[col.ColName] = getColDefault(col.ColDataType);
    });
    const hv = headerValuesRef.current;
    Object.entries(hv).forEach(([k, v]) => {
      if (k !== "id") mstRow[k] = v;
    });
    Object.assign(mstRow, summaryRef.current?.getSummary?.() ?? {});
    mstRow.LoginID = DEFAULT_LOGIN_ID;

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) => {
      const row = {};
      allColumns.forEach(({ key, colDataType }) => {
        row[key] = getColDefault(colDataType);
      });
      return { ...row, ...rest, LoginID: DEFAULT_LOGIN_ID };
    });

    const indentDetailRows = Object.values(childRowsMap)
      .flat()
      .map(({ id: _id, ...rest }) => ({ ...rest, LoginID: DEFAULT_LOGIN_ID }));

    const payload = {
      prmStrMstJSON: JSON.stringify([mstRow]),
      prmStrDetJSON: JSON.stringify(detRows),
      prmStrIndtDetJSON: JSON.stringify(indentDetailRows),
    };

    console.log("%c[PO Save] Payload:", "color:#f59e0b;font-weight:700", payload);
    console.log("%c[PO Save] Master:", "color:#6366f1;font-weight:600", [mstRow]);
    console.log("%c[PO Save] Detail:", "color:#22c55e;font-weight:600", detRows);
    console.log("%c[PO Save] IndentDetail:", "color:#ec4899;font-weight:600", indentDetailRows);

    setIsSavingPO(true);
    try {
      const res = await fetch(`${API_BASE_URL_IMS}${PO_CONFIG.SAVE_ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      console.log("%c[PO Save] Response:", "color:#22c55e;font-weight:700", result);
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert("Purchase Order saved successfully!");
    } catch (err) {
      console.error("[PO Save] Failed:", err);
      alert(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSavingPO(false);
    }
  }, [headerColumns, allColumns, childRowsMap]);

  const handleSaveAndPrint = useCallback(async () => {
    await handleSave();
    window.print();
  }, [handleSave]);

  const handleCancel = useCallback(() => {
    if (!window.confirm("Discard changes and reset the form?")) return;

    localStorage.removeItem(PO_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(PO_CONFIG.STORAGE_ENTRY_META);
    sessionStorage.removeItem(PO_CONFIG.STORAGE_HEADER_META);
    sessionStorage.removeItem(PO_CONFIG.STORAGE_ENTRY_META);

    headerValuesRef.current = {
      TranCode: "",
      TranDate: todayISO,
      ConfigID: 0,
      DeliveryDate: null,
      DivisionID: 0,
      SupplierID: 0,
      DeptID: 0,
      CurrencyID: 0,
      CurrencyName: "",
      CurrencyRate: 0,
      CreditDays: 0,
      BasedOnID: "0",
      Remarks: "",
      TranMstGenID: 0,
      CompanyID: 1,
      YearID: PO_CONFIG.DIVISION_YEAR_ID,
      LoginID: 1,
      IDNumber: 0,
      IsAmend: 0,
      AmendPOID: 0,
    };
    setGridRows([]);
    setCurrencyExternalValues({ CurrencyName: "", CurrencyRate: "" });

    queuedRowsRef.current = [];
    gridColumnsLoadedRef.current = false;

    clearPoTypes();
    clearSaveError();

    setIsAmend(false);
    setAmendPOID("");
    setActiveTab("items");
    setApprovedFilter("all");
    setIsGridLoading(false);
    setItemSelectionCount(0);

    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);

    setChildRowsMap({});
    setChildColumns([]);

    itemGridRef.current?.clearRows?.();

    setFilterResetKey((k) => k + 1);
    exitEditMode();
  }, [clearPoTypes, clearSaveError, exitEditMode, todayISO]);

  const handleClose = useCallback(() => navigate("/purchase-order"), [navigate]);
  const handleDocument = useCallback(() => {
    console.log("[PO] Document F6 — reserved for document generation.");
  }, []);

  // ── Keyboard shortcuts — Alt+A Add | Alt+S Save | Alt+N Cancel | Alt+C Close ──
  const filterBusy = headerFetching || isLoadingPoTypes;

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (itemModalOpen) return;

      const key = e.key.toLowerCase();
      switch (key) {
        case "a":
          if (!isEditMode && !filterBusy) {
            e.preventDefault();
            enterEditModeWithFocus();
          }
          break;
        case "s":
          if (isEditMode && !isSavingPO) {
            e.preventDefault();
            handleSave();
          }
          break;
        case "n":
          if (isEditMode) {
            e.preventDefault();
            handleCancel();
          }
          break;
        case "c":
          e.preventDefault();
          handleClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isEditMode,
    filterBusy,
    isSavingPO,
    itemModalOpen,
    enterEditModeWithFocus,
    handleSave,
    handleCancel,
    handleClose,
  ]);

  // ── Extra ActionBar buttons ────────────────────────────────────────
  const poExtraButtons = useMemo(
    () => [
      {
        key: "document",
        label: "Document F6",
        Icon: FileText,
        variant: "secondary",
        onClick: handleDocument,
      },
      { key: "sep1", separator: true },
      {
        key: "saveprint",
        label: "Save & Print",
        Icon: Printer,
        variant: "print",
        onClick: handleSaveAndPrint,
        disabled: isSavingPO,
      },
      {
        key: "save",
        label: isSavingPO ? "Saving…" : "Save",
        Icon: Save,
        variant: "save",
        onClick: handleSave,
        disabled: isSavingPO,
        loading: isSavingPO,
        accessKey: "s",
        title: PO_SHORTCUT_CONFIG.s.title,
      },
      { key: "sep2", separator: true },
      {
        key: "close",
        label: "Close",
        Icon: LogOut,
        variant: "close",
        onClick: handleClose,
        showAlways: true,
        accessKey: "c",
        title: PO_SHORTCUT_CONFIG.c.title,
      },
    ],
    [handleDocument, handleSaveAndPrint, isSavingPO, handleSave, handleClose]
  );

  const itemGridConfig = {
    columns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const combinedError = metaError || headerError;

  return (
    <div className="workspace-page po-page">
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
          <>
            {/* ── Amend strip ─────────────────────────────────────── */}
            <div className="po-amend-strip">
              <div className="po-amend-strip__checkbox">
                <input
                  type="checkbox"
                  id="po-amend-chk"
                  className="po-amend-strip__chk-input"
                  checked={isAmend}
                  onChange={(e) => handleAmendChange(e.target.checked)}
                  disabled={!isEditMode}
                />
                <label htmlFor="po-amend-chk" className="po-amend-strip__chk-label">
                  Amend
                </label>
              </div>

              {isAmend && (
                <div className="po-amend-strip__select">
                  <SearchSelect
                    value={amendPOID}
                    onChange={handleAmendPOChange}
                    options={existingPOs}
                    placeholder="Select PO to Amend…"
                    ariaLabel="Select PO to Amend"
                    disabled={!isEditMode}
                  />
                </div>
              )}
            </div>

            {/* ── Header filter panel ──────────────────────────────── */}
            <EnterpriseFilterPanel
              key={filterResetKey}
              panelRef={filterPanelRef}
              title="Purchase Order Detail"
              staticFilters={syncedFilters}
              initialValues={filterInitialValues}
              cascadeResets={PO_FILTER_CASCADE_RESETS}
              onFilterChange={handleFilterChange}
              externalValues={currencyExternalValues}
              isSearching={filterBusy}
              disabled={!isEditMode}
              onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
            />
          </>
        )}
      </section>

      {/* ── 3-tab grid section ───────────────────────────────────────── */}
      <section className="po-grid-section">
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {PO_GRID_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`grid-tab ${activeTab === t.id ? "grid-tab--active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid-tabbar__controls">
            {activeTab === "items" && (
              <button
                ref={selectItemBtnRef}
                type="button"
                className="po-tab-action-btn"
                onClick={handleSelectItem}
                disabled={!isEditMode}
                title="Pick items from list (Tab here after header fields)"
              >
                <Package size={12} strokeWidth={2.5} />
                Select Item
              </button>
            )}

            <div className="po-tab-filter">
              <span className="po-tab-filter__label">Approved</span>
              <SearchSelect
                value={approvedFilter}
                onChange={setApprovedFilter}
                options={APPROVED_OPTS}
                compact
                ariaLabel="Approved filter"
              />
            </div>
            <button
              type="button"
              className="po-tab-delete-btn"
              onClick={handleDeleteSelected}
              disabled={!isEditMode || activeSelectionCount === 0}
              title="Delete selected rows"
            >
              <Trash2 size={12} strokeWidth={2} />
              Delete
            </button>
          </div>
        </div>

        <div className={`po-tab-pane${activeTab === "items" ? " po-tab-pane--active" : ""}`}>
          <EntryGrid
            ref={itemGridRef}
            config={itemGridConfig}
            title=""
            hideBottomPanel
            emptyMessage="No items yet. Click Add New or Select Item above."
            onSelectionChange={setItemSelectionCount}
            onRowsChange={setGridRows}
            onCellEvent={handleCellEvent}
            eventColumns={eventColumns}
            enableCollapsible={Object.keys(childRowsMap).length > 0}
            childRowsMap={childRowsMap}
            childColumns={childColumns}
          />
        </div>

        {activeTab === "terms" && (
          <div className="po-terms-pane">
            <table className="po-terms-table">
              <thead>
                <tr>
                  {TERMS_COLUMNS.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={TERMS_COLUMNS.length} className="po-terms-empty">
                    No terms &amp; conditions added.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Summary totals — live from grid rows ── */}
      <EnterpriseSummaryPanel ref={summaryRef} fields={PO_SUMMARY_FIELDS} rows={gridRows} />

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        onCancel={handleCancel}
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={poExtraButtons}
      />

      <OrderItemModal
        isOpen={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        items={itemModalItems}
        columns={itemModalColumns}
        isLoading={itemModalLoading}
        error={itemModalError}
        onInsert={handleInsertItems}
      />
    </div>
  );
}
