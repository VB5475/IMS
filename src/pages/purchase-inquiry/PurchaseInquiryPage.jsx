// PurchaseInquiryPage.jsx
// Purchase Inquiry Detail page.
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — header fields only (no action buttons)
//   2. pi-grid-section        — custom 3-tab wrapper
//        • Item Grid tab  → EntryGrid (API columns, RB_PurInquiryDet)
//                           buttons: Add New | Select Item
//        • Suppliers tab  → EntryGrid (hardcoded SUPPLIER_GRID_CONFIG)
//                           button: Select Supplier
//        • Terms tab      → static terms table (no buttons)
//        Fixed controls (always): Approved filter | Delete
//   3. CollapsibleGrid        — Indent Details
//   4. PIActionBar            — Save / Cancel / Close etc.
//
// Both the Items and Suppliers EntryGrid instances are always mounted (CSS
// show/hide) so their row state is preserved when switching tabs.

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Truck, Plus, Trash2, Package, FileText, Printer, Save, LogOut } from 'lucide-react';
import EnterpriseFilterPanel from '../../components/filters/EnterpriseFilterPanel';
import EntryGrid from '../../components/grid/EntryGrid';
import CollapsibleGrid from '../../components/grid/CollapsibleGrid';
import ActionBar from '../../components/ui/ActionBar';
import SupplierPickerModal from '../../components/purchase-inquiry/SupplierPickerModal';
import OrderItemModal from '../../components/txn/OrderItemModal';
import SearchSelect from '../../components/ui/SearchSelect';
import { usePurchaseInquiry } from '../../hooks/usePurchaseInquiry';
import { useApi } from '../../api/useApi';
import { ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, DEFAULT_LOGIN_ID, getColDefault } from '../../api/constants';
import { buildGridColumns } from '../../utils/gridUtils';
import { usePageHeader } from '../../context/PageHeaderContext';
import {
  PI_CONFIG,
  PI_HEADER_FILTERS,
  PI_GRID_TABS,
  APPROVED_OPTS,
  TERMS_COLUMNS,
  INDENT_DETAILS_COLUMNS,
  PI_FILTER_CASCADE_RESETS,
  SUPPLIER_GRID_CONFIG,
  formatTranDate,
} from './constants';
import './PurchaseInquiryPage.css';

// ── Temp-ID generator (negative → never clash with real IDs) ─────────
let _piTempId = -1;
const nextTempId = () => _piTempId--;

// Map a supplier picker row → supplier grid row (hardcoded column keys).
function mapPickerToSupplierRow(item, srNo) {
  return {
    id: String(item.SupplierID ?? nextTempId()),
    SrNo: srNo,
    SupplierName: item.SupplierName ?? '',
    Address: item.SuppAddress ?? item.Address ?? '',
    City: item.City ?? '',
    MobileNo: item.ContactNo ?? item.MobileNo ?? '',
  };
}

// Map an item picker row → items grid row (seeded from allColumns).
function mapPickerToItemRow(item, allColumns) {
  const row = { id: nextTempId() };
  allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
  Object.entries(item).forEach(([k, v]) => {
    if (k !== 'id' && v != null && Object.prototype.hasOwnProperty.call(row, k)) row[k] = v;
  });
  return row;
}

// ── Component ────────────────────────────────────────────────────────

export default function PurchaseInquiryPage() {
  const { id: routeId } = useParams();
  const genIDNumber = routeId ? 1 : 0;
  const navigate = useNavigate();

  const itemGridRef = useRef(null);
  const supplierGridRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, departmentOptions, inquiryTypeOptions,
    fetchInquiryTypes, clearInquiryTypes,
    isLoadingInquiryTypes,
    columns, allColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    saveTxn, isSaving, saveError, clearSaveError,
  } = usePurchaseInquiry(API_BASE_URL);

  // Computed first so both the ref and the filter panel share the same initial date.
  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // TranDate seeded with todayISO so prmTranDate is correct on the first
  // "Select Item" click even before the user touches the date field.
  const headerValuesRef = useRef({
    TranCode: '', TranDate: todayISO, ConfigID: 0, ExpectedDate: null,
    DivisionID: 0, DeptID: 0, BasedOnID: '0',
    Remarks: '', CompanyID: 1, YearID: PI_CONFIG.DIVISION_YEAR_ID, LoginID: 1,
    IDNumber: routeId ? Number(routeId) : 0,
  });

  const filterInitialValues = useMemo(
    () => ({ BasedOnID: '0', TranDate: todayISO }),
    [todayISO],
  );

  // Incrementing this forces EnterpriseFilterPanel to remount and re-apply
  // initialValues, resetting all filter field values visually on Cancel.
  const [filterResetKey, setFilterResetKey] = useState(0);

  // ── Edit-mode gate ─────────────────────────────────────────────────
  // Page starts in read-only mode. Clicking the "Add" footer button enters
  // edit mode; "Cancel" (or the action-bar Cancel) returns to read-only.
  const [isEditMode, setIsEditMode] = useState(false);

  const enterEditMode = useCallback(() => setIsEditMode(true), []);
  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  // ── Tab state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('items');

  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [supplierSelectionCount, setSupplierSelectionCount] = useState(0);
  const activeSelectionCount = activeTab === 'items' ? itemSelectionCount
    : activeTab === 'suppliers' ? supplierSelectionCount
      : 0;

  const [approvedFilter, setApprovedFilter] = useState('all');
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [indentRows, setIndentRows] = useState([]);

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierModalItems, setSupplierModalItems] = useState([]);
  const [supplierModalLoading, setSupplierModalLoading] = useState(false);
  const [supplierModalError, setSupplierModalError] = useState(null);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);

  // ── Collapsible indent children (indent-wise mode only) ───────────────
  // childRowsMap  — { [parentRowId: string]: selectedIndentRows[] }
  // childColumns  — same column defs passed to InlineChildTable (picker cols)
  const [childRowsMap, setChildRowsMap] = useState({});
  const [childColumns, setChildColumns] = useState([]);

  usePageHeader({
    title: 'Purchase Inquiry',
    subtitle: 'Fill in the header fields, then use Item Grid or Suppliers tabs.',
    showBack: true,
    backTo: '/',
  });

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

  // ── syncedFilters ─────────────────────────────────────────────────
  const syncedFilters = useMemo(() => {
    const injectOptions = (filter) => {
      switch (filter.FilterParameterID) {
        case 'DivisionID': return { ...filter, staticOptions: divisionOptions };
        case 'ConfigID': return { ...filter, staticOptions: inquiryTypeOptions };
        case 'DeptID': return { ...filter, staticOptions: departmentOptions };
        default: return filter;
      }
    };

    if (headerColumns.length === 0) return PI_HEADER_FILTERS.map(injectOptions);

    const apiColMap = {};
    headerColumns.forEach((col) => { apiColMap[col.ColName] = col; });

    return PI_HEADER_FILTERS.map((filter) => {
      const withOpts = injectOptions(filter);
      const apiCol = apiColMap[filter.FilterParameterID] || apiColMap[filter.FilterColName];
      if (!apiCol) return withOpts;
      return {
        ...withOpts,
        FilterColName: apiCol.ColName,
        FilterColCtrlType: apiCol.ColCtrlType ?? withOpts.FilterColCtrlType,
      };
    });
  }, [headerColumns, divisionOptions, inquiryTypeOptions, departmentOptions]);

  // ── Filter cascade ─────────────────────────────────────────────────
  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

    if (colName === 'DivisionID') {
      headerValuesRef.current.ConfigID = 0;
      clearInquiryTypes();
      if (val && val !== '0') await fetchInquiryTypes(val);
      return;
    }
  }, [fetchInquiryTypes, clearInquiryTypes]);

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

  // ── Add New (Items tab) ────────────────────────────────────────────
  const handleAddNew = useCallback(async () => {
    if (isFetching || isGridLoading) return;
    setActiveTab('items');
    const activeCols = await ensureItemColumns();
    if (!activeCols || activeCols.length === 0) return;
    const blankRow = { id: nextTempId() };
    allColumns.forEach(({ key, colDataType }) => { blankRow[key] = getColDefault(colDataType); });
    addItemRow(blankRow);
  }, [isFetching, isGridLoading, ensureItemColumns, allColumns, addItemRow]);

  // ── Select Item (Items tab) ────────────────────────────────────────
  // Flow:
  //   1. Pick RB code by BasedOn ('0'→Direct, '2'→Indent wise)
  //   2. Fetch RBID via Fn_Fetch_RBDetailByRBCode
  //   3. Fetch grid columns via GetDetailColData (read-only, no dropdown fetch)
  //   4. Fetch item rows via SP_ITEM_PICKER
  //   5. Open modal — EntryGrid in readOnly mode with those columns + rows
  const handleSelectItem = useCallback(async () => {
    const { DivisionID, ConfigID, TranDate, BasedOnID } = headerValuesRef.current;
    const divisionID = DivisionID ?? 0;
    const configID = ConfigID ?? 0;
    if (!divisionID || divisionID === '0' || divisionID === 0) {
      alert('Please select a Division before selecting items.');
      return;
    }

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      // Step 1 — choose RB code by BasedOnID
      const rbCode = Number(BasedOnID) === 2
        ? PI_CONFIG.RB_ITEM_PICKER_INDENT
        : PI_CONFIG.RB_ITEM_PICKER_DIRECT;

      // Step 2 — fetch RBID
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PI_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: rbCode }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      const rbRow = rbRes?.Table?.[0];
      if (!rbRow) throw new Error('Could not load item picker configuration.');

      // Step 3 — fetch columns (read-only: skip dropdown options)
      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const gridColumns = buildGridColumns(colRes?.Links || [], {}, {
        filterable: false,
        allEditable: false,
      });
      setItemModalColumns(gridColumns);

      // Step 4 — fetch item rows
      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PI_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([{
          prmDivisionID: Number(divisionID),
          prmYearID: PI_CONFIG.CONFIG_YEAR_ID,
          prmLoginID: DEFAULT_LOGIN_ID,
          prmTranDate: formatTranDate(TranDate),
          prmConfigID: Number(configID),
          prmSupplierID: Number(headerValuesRef.current?.SupplierID ?? 0),
          prmTranBook: PI_CONFIG.TRAN_BOOK,
          prmFrmOption: Number(BasedOnID) || 0,
        }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      setItemModalItems(rowRes?.Table || []);
    } catch (err) {
      console.error('[PI] Item picker fetch failed:', err);
      setItemModalError(err?.message || 'Failed to fetch items.');
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive]);

  const handleInsertItems = useCallback(async (selectedItems) => {
    if (!selectedItems?.length) return;
    setActiveTab('items');

    const isIndentWise = Number(headerValuesRef.current?.BasedOnID) === 2;

    if (!isIndentWise) {
      // ── Direct mode ───────────────────────────────────────────────────
      // Column definitions must be loaded before we can map rows.
      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) return;
      setChildRowsMap({});
      setChildColumns([]);
      selectedItems.forEach((item) => addItemRow(mapPickerToItemRow(item, allColumns)));
      return;
    }

    // ── Indent-wise mode ─────────────────────────────────────────────
    // The summary API call must not be gated on column loading — fire it
    // immediately.  Parent rows are spread directly onto the grid row so
    // the display works even if allColumns hasn't resolved yet.
    // Also kick off column loading in the background so the grid is
    // properly configured by the time the user interacts with it.
    ensureItemColumns().catch(() => { });

    // Strip synthetic '_row_N' ids before sending to the API.
    const cleanItems = selectedItems.map(({ id: _id, ...rest }) => rest);

    setIsGridLoading(true);
    try {
      const summaryResponse = await fetch(`${API_BASE_URL_IMS}${ENDPOINTS.API_VALUES}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ObjType: 2,
          ObjName: PI_CONFIG.SP_INDENT_SUMMARY,
          JSon: [{ prmJSon: cleanItems }],
          p_ErrCode: -1,
          p_ErrMsg: '',
        }),
      });
      const summaryRes = await summaryResponse.json();

      const parents = summaryRes?.Table ?? [];
      if (!parents.length) return;

      // Build childRowsMap: parent.ItemID → matching selected indent rows.
      // Relationship: child.ChildFKey === parent.ItemID
      const newChildRowsMap = {};
      parents.forEach((parent) => {
        const pid = String(Math.round(Number(parent.ItemID)));
        const children = cleanItems.filter(
          (c) => String(Math.round(Number(c.ChildFKey))) === pid,
        );
        if (children.length > 0) newChildRowsMap[pid] = children;

        // Spread all API fields directly so the row doesn't depend on
        // allColumns being loaded yet; any grid column whose key matches
        // a parent field will display the correct value automatically.
        addItemRow({ ...parent, id: pid });
      });

      setChildRowsMap((prev) => ({ ...prev, ...newChildRowsMap }));
      setChildColumns(itemModalColumns.filter((c) => c.key !== 'cb'));
    } catch (err) {
      console.error('[PI] Indent summary fetch failed:', err);
    } finally {
      setIsGridLoading(false);
    }
  }, [ensureItemColumns, allColumns, addItemRow, itemModalColumns]);

  // ── Select Supplier (Suppliers tab) ──────────────────────────────
  const handleSelectSupplier = useCallback(async () => {
    const divisionID = headerValuesRef.current?.DivisionID ?? 0;
    if (!divisionID || divisionID === '0' || divisionID === 0) {
      alert('Please select a Division before selecting suppliers.');
      return;
    }
    setSupplierModalOpen(true);
    setSupplierModalItems([]);
    setSupplierModalError(null);
    setSupplierModalLoading(true);
    try {
      const response = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PI_CONFIG.SUPPLIER_SP,
        JSon: JSON.stringify([{
          PrmDivisionId: Number(divisionID),
          PrmLoginId: DEFAULT_LOGIN_ID,
          PrmYearId: PI_CONFIG.CONFIG_YEAR_ID,
          PrmPartyType: PI_CONFIG.SUPPLIER_PARTY_TYPE,
        }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      setSupplierModalItems(
        (response?.Table || []).map((row, idx) => ({
          ...row,
          id: String(row.SupplierID ?? `sup_${idx}`),
        })),
      );
    } catch (err) {
      console.error('[PI] Supplier fetch failed:', err);
      setSupplierModalError(err?.message || 'Failed to fetch suppliers.');
    } finally {
      setSupplierModalLoading(false);
    }
  }, [getLive]);

  const handleInsertSuppliers = useCallback((selectedSuppliers) => {
    if (!selectedSuppliers?.length) return;
    setActiveTab('suppliers');
    const existing = supplierGridRef.current?.getRows?.() ?? [];
    const existingIds = new Set(existing.map((r) => String(r.SupplierID ?? r.id)));
    let nextSrNo = existing.length;
    selectedSuppliers.forEach((item) => {
      const sid = String(item.SupplierID ?? item.id);
      if (existingIds.has(sid)) return;
      existingIds.add(sid);
      nextSrNo += 1;
      supplierGridRef.current?.addRow(mapPickerToSupplierRow(item, nextSrNo));
    });
  }, []);

  // ── Delete selected rows (active tab's grid) ───────────────────────
  const handleDeleteSelected = useCallback(() => {
    const ref = activeTab === 'items' ? itemGridRef
      : activeTab === 'suppliers' ? supplierGridRef
        : null;
    if (!ref?.current) return;
    const selected = ref.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    ref.current.removeRows?.(selected.map((r) => r.id));
    if (activeTab === 'suppliers') {
      const remaining = ref.current.getRows?.() ?? [];
      remaining.forEach((row, idx) => {
        if (Object.prototype.hasOwnProperty.call(row, 'SrNo')) {
          ref.current.updateRow?.(row.id, { SrNo: idx + 1 });
        }
      });
    }
  }, [activeTab]);

  // ── Save / Cancel ──────────────────────────────────────────────────
  const [isSavingPI, setIsSavingPI] = useState(false);

  const handleSave = useCallback(async () => {
    // ── Master ────────────────────────────────────────────────────────
    const mstRow = {};
    headerColumns.forEach((col) => { mstRow[col.ColName] = getColDefault(col.ColDataType); });
    const hv = headerValuesRef.current;
    Object.entries(hv).forEach(([k, v]) => { if (k !== 'id') mstRow[k] = v; });
    mstRow.LoginID = DEFAULT_LOGIN_ID;

    // ── Detail ────────────────────────────────────────────────────────
    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) => {
      const row = {};
      allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
      return { ...row, ...rest, LoginID: DEFAULT_LOGIN_ID };
    });

    // ── IndentDetail ──────────────────────────────────────────────────
    const indentDetailRows = Object.values(childRowsMap)
      .flat()
      .map(({ id: _id, ...rest }) => ({ ...rest, LoginID: DEFAULT_LOGIN_ID }));

    const payload = {
      prmStrMstJSON:     JSON.stringify([mstRow]),
      prmStrDetJSON:     JSON.stringify(detRows),
      prmStrIndtDetJSON: JSON.stringify(indentDetailRows),
    };

    console.log('%c[PI Save] Payload:', 'color:#f59e0b;font-weight:700', payload);
    console.log('%c[PI Save] Master:', 'color:#6366f1;font-weight:600', [mstRow]);
    console.log('%c[PI Save] Detail:', 'color:#22c55e;font-weight:600', detRows);
    console.log('%c[PI Save] IndentDetail:', 'color:#ec4899;font-weight:600', indentDetailRows);

    setIsSavingPI(true);
    try {
      const res = await fetch(`${API_BASE_URL_IMS}${PI_CONFIG.SAVE_ENDPOINT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      console.log('%c[PI Save] Response:', 'color:#22c55e;font-weight:700', result);
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert('Purchase Inquiry saved successfully!');
    } catch (err) {
      console.error('[PI Save] Failed:', err);
      alert(err?.message || 'Save failed. Please try again.');
    } finally {
      setIsSavingPI(false);
    }
  }, [headerColumns, allColumns, childRowsMap]);

  const handleSaveAndPrint = useCallback(async () => {
    await handleSave();
    window.print();
  }, [handleSave]);

  const handleCancel = useCallback(() => {
    if (!window.confirm('Discard changes and reset the form?')) return;

    // ── 1. Wipe page-session storage ──────────────────────────────────
    localStorage.removeItem(PI_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(PI_CONFIG.STORAGE_ENTRY_META);
    sessionStorage.removeItem(PI_CONFIG.STORAGE_HEADER_META);
    sessionStorage.removeItem(PI_CONFIG.STORAGE_ENTRY_META);

    // ── 2. Reset header ref (TranDate back to today, matching filterInitialValues) ──
    headerValuesRef.current = {
      TranCode: '', TranDate: todayISO, ConfigID: 0, ExpectedDate: null,
      DivisionID: 0, DeptID: 0, BasedOnID: '0',
      Remarks: '', CompanyID: 1, YearID: PI_CONFIG.DIVISION_YEAR_ID, LoginID: 1, IDNumber: 0,
    };

    // ── 3. Reset internal refs ────────────────────────────────────────
    queuedRowsRef.current = [];
    gridColumnsLoadedRef.current = false;

    // ── 4. Reset hook-owned state ─────────────────────────────────────
    clearInquiryTypes();   // inquiryTypeOptions → []
    clearSaveError();      // saveError → null

    // ── 5. Reset every local useState to its initial value ────────────
    setActiveTab('items');
    setApprovedFilter('all');
    setIsGridLoading(false);
    setIndentRows([]);
    setItemSelectionCount(0);
    setSupplierSelectionCount(0);

    // Item picker modal
    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);

    // Collapsible child state
    setChildRowsMap({});
    setChildColumns([]);

    // Supplier picker modal
    setSupplierModalOpen(false);
    setSupplierModalItems([]);
    setSupplierModalLoading(false);
    setSupplierModalError(null);

    // ── 6. Clear both grids ───────────────────────────────────────────
    itemGridRef.current?.clearRows?.();
    supplierGridRef.current?.clearRows?.();

    // ── 7. Force-remount EnterpriseFilterPanel so its internal field
    //       state is wiped and initialValues are re-applied cleanly ────
    setFilterResetKey((k) => k + 1);

    exitEditMode();
  }, [clearInquiryTypes, clearSaveError, exitEditMode]);

  const handleClose = useCallback(() => navigate('/'), [navigate]);
  const handleDocument = useCallback(() => {
    console.log('[PI] Document F6 — reserved for document generation.');
  }, []);

  const itemGridConfig = { columns, pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] } };
  const combinedError = metaError || headerError;
  const filterBusy = headerFetching || isLoadingInquiryTypes;

  // Extra buttons visible in the ActionBar while in edit mode
  const piExtraButtons = useMemo(() => [
    { key: 'document', label: 'Document F6', Icon: FileText, variant: 'secondary', onClick: handleDocument },
    { key: 'sep1', separator: true },
    { key: 'saveprint', label: 'Save & Print', Icon: Printer, variant: 'print', onClick: handleSaveAndPrint, disabled: isSavingPI },
    { key: 'save', label: isSavingPI ? 'Saving…' : 'Save', Icon: Save, variant: 'save', onClick: handleSave, disabled: isSavingPI, loading: isSavingPI },
    { key: 'sep2', separator: true },
    { key: 'close', label: 'Close', Icon: LogOut, variant: 'close', onClick: handleClose },
  ], [handleDocument, handleSaveAndPrint, isSavingPI, handleSave, handleClose]);

  return (
    <div className="workspace-page pi-page">

      <section className="workspace-page__filters">
        {combinedError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{combinedError}</span>
            <button type="button" onClick={() => { fetchHeaderMeta(); fetchDetailMeta(); }}>
              Retry
            </button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            title="Purchase Inquiry Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={PI_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            isSearching={filterBusy}
            disabled={!isEditMode}
          />
        )}
      </section>

      <section className="pi-grid-section">

        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {PI_GRID_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`grid-tab ${activeTab === t.id ? 'grid-tab--active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid-tabbar__controls">
            {activeTab === 'items' && (
              <>
                <button
                  type="button"
                  className="pi-tab-action-btn"
                  onClick={handleAddNew}
                  disabled={!isEditMode || isFetching || isGridLoading}
                  title="Add a blank item row"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  Add New
                </button>
                <button
                  type="button"
                  className="pi-tab-action-btn"
                  onClick={handleSelectItem}
                  disabled={!isEditMode}
                  title="Pick items from list"
                >
                  <Package size={12} strokeWidth={2.5} />
                  Select Item
                </button>
              </>
            )}

            {activeTab === 'suppliers' && (
              <button
                type="button"
                className="pi-tab-action-btn"
                onClick={handleSelectSupplier}
                disabled={!isEditMode}
                title="Pick suppliers from list"
              >
                <Truck size={12} strokeWidth={2.5} />
                Select Supplier
              </button>
            )}

            <div className="pi-tab-filter">
              <span className="pi-tab-filter__label">Approved</span>
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
              className="pi-tab-delete-btn"
              onClick={handleDeleteSelected}
              disabled={!isEditMode || activeSelectionCount === 0}
              title="Delete selected rows"
            >
              <Trash2 size={12} strokeWidth={2} />
              Delete
            </button>
          </div>
        </div>

        <div className={`pi-tab-pane${activeTab === 'items' ? ' pi-tab-pane--active' : ''}`}>
          <EntryGrid
            ref={itemGridRef}
            config={itemGridConfig}
            title=""
            hideBottomPanel
            emptyMessage="No items yet. Click Add New or Select Item above."
            onSelectionChange={setItemSelectionCount}
            enableCollapsible={Object.keys(childRowsMap).length > 0}
            childRowsMap={childRowsMap}
            childColumns={childColumns}
          />
        </div>

        <div className={`pi-tab-pane${activeTab === 'suppliers' ? ' pi-tab-pane--active' : ''}`}>
          <EntryGrid
            ref={supplierGridRef}
            config={SUPPLIER_GRID_CONFIG}
            title=""
            hideBottomPanel
            emptyMessage="No suppliers added. Click Select Supplier above."
            onSelectionChange={setSupplierSelectionCount}
          />
        </div>

        {activeTab === 'terms' && (
          <div className="pi-terms-pane">
            <table className="pi-terms-table">
              <thead>
                <tr>{TERMS_COLUMNS.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={TERMS_COLUMNS.length} className="pi-terms-empty">
                    No terms &amp; conditions added.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

      </section>

      <section className="pi-page__section">
        <CollapsibleGrid
          title="Indent Details"
          subtitle="(Select one item row above to load its indent records)"
          columns={INDENT_DETAILS_COLUMNS}
          rows={indentRows}
        />
      </section>

      <ActionBar
        isEditMode={isEditMode}
        onAdd={enterEditMode}
        onCancel={handleCancel}
        extraButtons={piExtraButtons}
      />

      <SupplierPickerModal
        isOpen={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        items={supplierModalItems}
        isLoading={supplierModalLoading}
        error={supplierModalError}
        onInsert={handleInsertSuppliers}
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
