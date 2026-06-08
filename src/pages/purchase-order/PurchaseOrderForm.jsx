// PurchaseOrderForm.jsx
// Purchase Order entry form (add / edit).
// Mirrors PurchaseInquiryForm.jsx exactly — same three-phase load, same 3-tab layout.
// PO-specific additions vs PI: Amend strip, Currency, Cr. Days, Supplier auto-fill on select.
//
// Layout (top → bottom):
//   1. Amend strip          — checkbox + conditional PO-select dropdown
//   2. EnterpriseFilterPanel — header fields (PO No, Date, Division, PO Type,
//                              Based On, Supplier, Currency, Currency Rate, Cr. Days, Exp. Date)
//   3. po-grid-section       — 3-tab wrapper
//        • Item Grid tab  → EntryGrid (API columns, RB_PurOrderDet)
//                           buttons: Add New | Select Item
//        • Suppliers tab  → EntryGrid (hardcoded SUPPLIER_GRID_CONFIG)
//                           button: Select Supplier
//        • Terms tab      → static terms table
//        Fixed controls (always): Approved filter | Delete
//   4. POActionBar           — Save / Cancel / Close etc.

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle, Truck, Plus, Trash2, Package, FileText, Printer, Save, LogOut,
} from 'lucide-react';
import EnterpriseFilterPanel from '../../components/filters/EnterpriseFilterPanel';
import EntryGrid             from '../../components/grid/EntryGrid';
import ActionBar             from '../../components/ui/ActionBar';
import SupplierPickerModal   from '../../components/purchase-inquiry/SupplierPickerModal';
import OrderItemModal        from '../../components/txn/OrderItemModal';
import SearchSelect          from '../../components/ui/SearchSelect';
import { usePurchaseOrder }  from '../../hooks/usePurchaseOrder';
import { useApi }            from '../../api/useApi';
import {
  ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, DEFAULT_LOGIN_ID, getColDefault, OBJ_TYPE,
} from '../../api/constants';
import { buildGridColumns }  from '../../utils/gridUtils';
import { usePageHeader }     from '../../context/PageHeaderContext';
import {
  PO_CONFIG,
  PO_HEADER_FILTERS,
  PO_GRID_TABS,
  APPROVED_OPTS,
  TERMS_COLUMNS,
  PO_FILTER_CASCADE_RESETS,
  SUPPLIER_GRID_CONFIG,
  formatTranDate,
} from './constants';
import './PurchaseOrderPage.css';

// ── Temp-ID generator (negative → never clash with real IDs) ──────────
let _poTempId = -1;
const nextTempId = () => _poTempId--;

function mapPickerToSupplierRow(item, srNo) {
  return {
    id:           String(item.SupplierID ?? nextTempId()),
    SrNo:         srNo,
    SupplierName: item.SupplierName ?? '',
    Address:      item.SuppAddress ?? item.Address ?? '',
    City:         item.City ?? '',
    MobileNo:     item.ContactNo ?? item.MobileNo ?? '',
  };
}

function mapPickerToItemRow(item, allColumns) {
  const row = { id: nextTempId() };
  allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
  Object.entries(item).forEach(([k, v]) => {
    if (k !== 'id' && v != null && Object.prototype.hasOwnProperty.call(row, k)) row[k] = v;
  });
  return row;
}

// ── Component ──────────────────────────────────────────────────────────

export default function PurchaseOrderForm() {
  const { id: routeId } = useParams();
  const location        = useLocation();
  const isNewRoute      = location.pathname.endsWith('/new') || routeId === 'new';
  const recordId        = isNewRoute ? 0 : Number(routeId) || 0;
  const navigate        = useNavigate();

  const itemGridRef              = useRef(null);
  const supplierGridRef          = useRef(null);
  const gridColumnsLoadedRef     = useRef(false);
  const queuedRowsRef            = useRef([]);
  const { get: getLive }         = useApi(API_BASE_URL);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, poTypeOptions, supplierOptions, currencyOptions,
    existingPOs,
    fetchPoTypes, clearPoTypes,
    fetchSupplierInfo,
    fetchExistingPOs,
    isLoadingPoTypes,
    columns, allColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    saveTxn, isSaving, saveError, clearSaveError,
  } = usePurchaseOrder(API_BASE_URL);

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const headerValuesRef = useRef({
    TranCode:     '',
    TranDate:     todayISO,
    POTypeID:     0,
    ExpectedDate: null,
    DivisionID:   0,
    SupplierID:   0,
    CurrencyID:   0,
    CurrencyRate: 0,
    CrDays:       0,
    BasedOnID:    '0',
    CompanyID:    1,
    YearID:       PO_CONFIG.DIVISION_YEAR_ID,
    LoginID:      1,
    IDNumber:     recordId,
    IsAmend:      0,
    AmendPOID:    0,
  });

  const filterInitialValues = useMemo(
    () => ({ BasedOnID: '0', TranDate: todayISO }),
    [todayISO],
  );

  const [filterResetKey, setFilterResetKey] = useState(0);

  // ── Amend strip state ──────────────────────────────────────────────
  const [isAmend,   setIsAmend]   = useState(false);
  const [amendPOID, setAmendPOID] = useState('');

  const handleAmendChange = useCallback(async (checked) => {
    setIsAmend(checked);
    headerValuesRef.current.IsAmend = checked ? 1 : 0;
    if (!checked) {
      setAmendPOID('');
      headerValuesRef.current.AmendPOID = 0;
      return;
    }
    await fetchExistingPOs();
  }, [fetchExistingPOs]);

  const handleAmendPOChange = useCallback((val) => {
    setAmendPOID(val);
    headerValuesRef.current.AmendPOID = Number(val) || 0;
  }, []);

  // ── Edit-mode gate ─────────────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false);
  const enterEditMode = useCallback(() => setIsEditMode(true),  []);
  const exitEditMode  = useCallback(() => setIsEditMode(false), []);

  // ── Tab state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('items');

  const [itemSelectionCount,     setItemSelectionCount]     = useState(0);
  const [supplierSelectionCount, setSupplierSelectionCount] = useState(0);
  const activeSelectionCount = activeTab === 'items'     ? itemSelectionCount
    : activeTab === 'suppliers' ? supplierSelectionCount
    : 0;

  const [approvedFilter,   setApprovedFilter]   = useState('all');
  const [isGridLoading,    setIsGridLoading]     = useState(false);

  // Supplier picker modal
  const [supplierModalOpen,    setSupplierModalOpen]    = useState(false);
  const [supplierModalItems,   setSupplierModalItems]   = useState([]);
  const [supplierModalLoading, setSupplierModalLoading] = useState(false);
  const [supplierModalError,   setSupplierModalError]   = useState(null);

  // Item picker modal
  const [itemModalOpen,    setItemModalOpen]    = useState(false);
  const [itemModalItems,   setItemModalItems]   = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError,   setItemModalError]   = useState(null);

  // Collapsible indent children (indent-wise mode)
  const [childRowsMap, setChildRowsMap] = useState({});
  const [childColumns, setChildColumns] = useState([]);

  usePageHeader({
    title:    isNewRoute ? 'New Purchase Order' : 'Purchase Order',
    subtitle: isNewRoute
      ? 'Fill in the header fields, then use Item Grid or Suppliers tabs.'
      : `PO #${recordId || routeId || '—'} — fill in the header fields, then use Item Grid or Suppliers tabs.`,
    showBack: true,
    backTo:   '/purchase-order',
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
        case 'DivisionID': return { ...filter, staticOptions: divisionOptions };
        case 'POTypeID':   return { ...filter, staticOptions: poTypeOptions };
        case 'SupplierID': return { ...filter, staticOptions: supplierOptions };
        case 'CurrencyID': return { ...filter, staticOptions: currencyOptions };
        default:           return filter;
      }
    };

    if (headerColumns.length === 0) return PO_HEADER_FILTERS.map(injectOptions);

    const apiColMap = {};
    headerColumns.forEach((col) => { apiColMap[col.ColName] = col; });

    return PO_HEADER_FILTERS.map((filter) => {
      const withOpts = injectOptions(filter);
      const apiCol   = apiColMap[filter.FilterParameterID] || apiColMap[filter.FilterColName];
      if (!apiCol) return withOpts;
      return {
        ...withOpts,
        FilterColName:     apiCol.ColName,
        FilterColCtrlType: apiCol.ColCtrlType ?? withOpts.FilterColCtrlType,
      };
    });
  }, [headerColumns, divisionOptions, poTypeOptions, supplierOptions, currencyOptions]);

  // ── Filter change / cascade ────────────────────────────────────────
  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

    if (colName === 'DivisionID') {
      headerValuesRef.current.POTypeID = 0;
      clearPoTypes();
      if (val && val !== '0') await fetchPoTypes(val);
      return;
    }

    if (colName === 'SupplierID' && val && val !== '0') {
      const info = await fetchSupplierInfo(val);
      if (info) {
        headerValuesRef.current.CurrencyID   = info.CurrencyID;
        headerValuesRef.current.CurrencyRate = info.CurrencyRate;
        headerValuesRef.current.CrDays       = info.CrDays;
      }
    }
  }, [fetchPoTypes, clearPoTypes, fetchSupplierInfo]);

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

  // ── Select Item ────────────────────────────────────────────────────
  const handleSelectItem = useCallback(async () => {
    const { DivisionID, POTypeID, TranDate, BasedOnID } = headerValuesRef.current;
    const divisionID = DivisionID ?? 0;
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
      const rbCode = Number(BasedOnID) === 2
        ? PO_CONFIG.RB_ITEM_PICKER_INDENT
        : PO_CONFIG.RB_ITEM_PICKER_DIRECT;

      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PO_CONFIG.SP_RB_META,
        JSon:    JSON.stringify([{ prmRBCode: rbCode }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      const rbRow = rbRes?.Table?.[0];
      if (!rbRow) throw new Error('Could not load item picker configuration.');

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.RBID,
        prmLoginID:  DEFAULT_LOGIN_ID,
      });
      const gridColumns = buildGridColumns(colRes?.Links || [], {}, {
        filterable: false, allEditable: false,
      });
      setItemModalColumns(gridColumns);

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PO_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([{
          prmDivisionID: Number(divisionID),
          prmYearID:     PO_CONFIG.CONFIG_YEAR_ID,
          prmLoginID:    DEFAULT_LOGIN_ID,
          prmTranDate:   formatTranDate(TranDate),
          prmConfigID:   Number(POTypeID ?? 0),
          prmSupplierID: Number(headerValuesRef.current?.SupplierID ?? 0),
          prmTranBook:   PO_CONFIG.TRAN_BOOK,
          prmFrmOption:  Number(BasedOnID) || 0,
        }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      setItemModalItems(rowRes?.Table || []);
    } catch (err) {
      console.error('[PO] Item picker fetch failed:', err);
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
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ObjType:   OBJ_TYPE.FUNCTION,
          ObjName:   PO_CONFIG.SP_INDENT_SUMMARY,
          JSon:      [{ prmJSon: cleanItems }],
          p_ErrCode: -1,
          p_ErrMsg:  '',
        }),
      });
      const summaryRes = await summaryResponse.json();

      const parents = summaryRes?.Table ?? [];
      if (!parents.length) return;

      const newChildRowsMap = {};
      parents.forEach((parent) => {
        const pid      = String(Math.round(Number(parent.ItemID)));
        const children = cleanItems.filter(
          (c) => String(Math.round(Number(c.ChildFKey))) === pid,
        );
        if (children.length > 0) newChildRowsMap[pid] = children;
        addItemRow({ ...parent, id: pid });
      });

      setChildRowsMap((prev) => ({ ...prev, ...newChildRowsMap }));
      setChildColumns(itemModalColumns.filter((c) => c.key !== 'cb'));
    } catch (err) {
      console.error('[PO] Indent summary fetch failed:', err);
    } finally {
      setIsGridLoading(false);
    }
  }, [ensureItemColumns, allColumns, addItemRow, itemModalColumns]);

  // ── Select Supplier ────────────────────────────────────────────────
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
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PO_CONFIG.SUPPLIER_SP,
        JSon: JSON.stringify([{
          PrmDivisionId: Number(divisionID),
          PrmLoginId:    DEFAULT_LOGIN_ID,
          PrmYearId:     PO_CONFIG.CONFIG_YEAR_ID,
          PrmPartyType:  PO_CONFIG.SUPPLIER_PARTY_TYPE,
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
      console.error('[PO] Supplier fetch failed:', err);
      setSupplierModalError(err?.message || 'Failed to fetch suppliers.');
    } finally {
      setSupplierModalLoading(false);
    }
  }, [getLive]);

  const handleInsertSuppliers = useCallback((selectedSuppliers) => {
    if (!selectedSuppliers?.length) return;
    setActiveTab('suppliers');
    const existing    = supplierGridRef.current?.getRows?.() ?? [];
    const existingIds = new Set(existing.map((r) => String(r.SupplierID ?? r.id)));
    let nextSrNo      = existing.length;
    selectedSuppliers.forEach((item) => {
      const sid = String(item.SupplierID ?? item.id);
      if (existingIds.has(sid)) return;
      existingIds.add(sid);
      nextSrNo += 1;
      supplierGridRef.current?.addRow(mapPickerToSupplierRow(item, nextSrNo));
    });
  }, []);

  // ── Delete selected rows ───────────────────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    const ref = activeTab === 'items'     ? itemGridRef
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

  // ── Save ───────────────────────────────────────────────────────────
  const [isSavingPO, setIsSavingPO] = useState(false);

  const handleSave = useCallback(async () => {
    const mstRow = {};
    headerColumns.forEach((col) => { mstRow[col.ColName] = getColDefault(col.ColDataType); });
    const hv = headerValuesRef.current;
    Object.entries(hv).forEach(([k, v]) => { if (k !== 'id') mstRow[k] = v; });
    mstRow.LoginID = DEFAULT_LOGIN_ID;

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) => {
      const row = {};
      allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
      return { ...row, ...rest, LoginID: DEFAULT_LOGIN_ID };
    });

    const indentDetailRows = Object.values(childRowsMap)
      .flat()
      .map(({ id: _id, ...rest }) => ({ ...rest, LoginID: DEFAULT_LOGIN_ID }));

    const payload = {
      prmStrMstJSON:     JSON.stringify([mstRow]),
      prmStrDetJSON:     JSON.stringify(detRows),
      prmStrIndtDetJSON: JSON.stringify(indentDetailRows),
    };

    console.log('%c[PO Save] Payload:',      'color:#f59e0b;font-weight:700', payload);
    console.log('%c[PO Save] Master:',       'color:#6366f1;font-weight:600', [mstRow]);
    console.log('%c[PO Save] Detail:',       'color:#22c55e;font-weight:600', detRows);
    console.log('%c[PO Save] IndentDetail:', 'color:#ec4899;font-weight:600', indentDetailRows);

    setIsSavingPO(true);
    try {
      const res = await fetch(`${API_BASE_URL_IMS}${PO_CONFIG.SAVE_ENDPOINT}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      console.log('%c[PO Save] Response:', 'color:#22c55e;font-weight:700', result);
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert('Purchase Order saved successfully!');
    } catch (err) {
      console.error('[PO Save] Failed:', err);
      alert(err?.message || 'Save failed. Please try again.');
    } finally {
      setIsSavingPO(false);
    }
  }, [headerColumns, allColumns, childRowsMap]);

  const handleSaveAndPrint = useCallback(async () => {
    await handleSave();
    window.print();
  }, [handleSave]);

  const handleCancel = useCallback(() => {
    if (!window.confirm('Discard changes and reset the form?')) return;

    localStorage.removeItem(PO_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(PO_CONFIG.STORAGE_ENTRY_META);
    sessionStorage.removeItem(PO_CONFIG.STORAGE_HEADER_META);
    sessionStorage.removeItem(PO_CONFIG.STORAGE_ENTRY_META);

    headerValuesRef.current = {
      TranCode: '', TranDate: todayISO, POTypeID: 0, ExpectedDate: null,
      DivisionID: 0, SupplierID: 0, CurrencyID: 0, CurrencyRate: 0,
      CrDays: 0, BasedOnID: '0', CompanyID: 1,
      YearID: PO_CONFIG.DIVISION_YEAR_ID, LoginID: 1, IDNumber: 0,
      IsAmend: 0, AmendPOID: 0,
    };

    queuedRowsRef.current       = [];
    gridColumnsLoadedRef.current = false;

    clearPoTypes();
    clearSaveError();

    setIsAmend(false);
    setAmendPOID('');
    setActiveTab('items');
    setApprovedFilter('all');
    setIsGridLoading(false);
    setItemSelectionCount(0);
    setSupplierSelectionCount(0);

    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);

    setChildRowsMap({});
    setChildColumns([]);

    setSupplierModalOpen(false);
    setSupplierModalItems([]);
    setSupplierModalLoading(false);
    setSupplierModalError(null);

    itemGridRef.current?.clearRows?.();
    supplierGridRef.current?.clearRows?.();

    setFilterResetKey((k) => k + 1);
    exitEditMode();
  }, [clearPoTypes, clearSaveError, exitEditMode, todayISO]);

  const handleClose    = useCallback(() => navigate('/purchase-order'), [navigate]);
  const handleDocument = useCallback(() => {
    console.log('[PO] Document F6 — reserved for document generation.');
  }, []);

  const itemGridConfig = {
    columns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const combinedError = metaError || headerError;
  const filterBusy    = headerFetching || isLoadingPoTypes;

  const poExtraButtons = useMemo(() => [
    { key: 'document',  label: 'Document F6',                          Icon: FileText, variant: 'secondary', onClick: handleDocument },
    { key: 'sep1',      separator: true },
    { key: 'saveprint', label: 'Save & Print',                         Icon: Printer,  variant: 'print',     onClick: handleSaveAndPrint, disabled: isSavingPO },
    { key: 'save',      label: isSavingPO ? 'Saving…' : 'Save',       Icon: Save,     variant: 'save',       onClick: handleSave,         disabled: isSavingPO, loading: isSavingPO },
    { key: 'sep2',      separator: true },
    { key: 'close',     label: 'Close',                                 Icon: LogOut,   variant: 'close',     onClick: handleClose },
  ], [handleDocument, handleSaveAndPrint, isSavingPO, handleSave, handleClose]);

  return (
    <div className="workspace-page po-page">

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
              title="Purchase Order Detail"
              staticFilters={syncedFilters}
              initialValues={filterInitialValues}
              cascadeResets={PO_FILTER_CASCADE_RESETS}
              onFilterChange={handleFilterChange}
              isSearching={filterBusy}
              disabled={!isEditMode}
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
                  className="po-tab-action-btn"
                  onClick={handleAddNew}
                  disabled={!isEditMode || isFetching || isGridLoading}
                  title="Add a blank item row"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  Add New
                </button>
                <button
                  type="button"
                  className="po-tab-action-btn"
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
                className="po-tab-action-btn"
                onClick={handleSelectSupplier}
                disabled={!isEditMode}
                title="Pick suppliers from list"
              >
                <Truck size={12} strokeWidth={2.5} />
                Select Supplier
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

        <div className={`po-tab-pane${activeTab === 'items' ? ' po-tab-pane--active' : ''}`}>
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

        <div className={`po-tab-pane${activeTab === 'suppliers' ? ' po-tab-pane--active' : ''}`}>
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
          <div className="po-terms-pane">
            <table className="po-terms-table">
              <thead>
                <tr>{TERMS_COLUMNS.map((c) => <th key={c}>{c}</th>)}</tr>
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

      <ActionBar
        isEditMode={isEditMode}
        onAdd={enterEditMode}
        onCancel={handleCancel}
        extraButtons={poExtraButtons}
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
