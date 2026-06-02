// TxnEntryForm.jsx
// Transaction Entry page — Sample Invoice Detail
//
// Two separate API chains on mount:
//   1a. fetchHeaderMeta()  → RB_SampleInvMst → RBID → GetDetailColData → raw cols
//       └─ Synced with hardcoded TXN_HEADER_FILTERS (FilterColName ← ColName,
//          FilterCaption ← DisplayName, staticOptions ← dropdown data)
//   1b. fetchTxnMeta()     → RB_SampleInvDet → RBID → GetDetailColData → grid columns
//       └─ GET_FILTER_DETAIL for every ColCtrlType=4 column (dropdown options)
//
// GridForm (mode="entry") is hidden until the first "Add New" click.
// Row-state lives inside GridForm; parent pushes rows via gridRef.current.addRow().

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Plus } from 'lucide-react';
import EnterpriseFilterPanel from '../components/filters/EnterpriseFilterPanel';
import EntryGrid from '../components/grid/EntryGrid';
import OrderItemModal from '../components/txn/OrderItemModal';
import { useTxnEntry } from '../hooks/useTxnEntry';
import { useApi } from '../api/useApi';
import { controlTypeMap } from '../data/dummyData';
import { getColDefault, ENDPOINTS } from '../api/constants';
import {
  usePageHeader,
} from '../context/PageHeaderContext';
import './TxnEntryPage.css';

// ── Hardcoded header fields (mirrors the image: Sample Invoice Detail) ──
// Shape matches what FilterPanel/FilterControl expects from the API.
// FilterColCtrlType:  1=TextBox  2=Date  4=Dropdown
// For Dropdown fields, leave staticOptions empty for now (wired later).
const TXN_HEADER_FILTERS = [
  {
    FilterParameterID: 'TranCode',
    FilterColName: 'TranCode',
    FilterCaption: 'Tran Code',
    FilterColCtrlType: controlTypeMap.TEXTBOX,
  },
  {
    FilterParameterID: 'TranDate',
    FilterColName: 'TranDate',
    FilterCaption: 'Tran Date',
    FilterColCtrlType: controlTypeMap.DATE,
  },
  {
    FilterParameterID: 'Division',
    FilterColName: 'DivisionID',
    FilterCaption: 'Division',
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],   // populated from Fn_tbl_FetchUserWsDivision
  },
  {
    FilterParameterID: 'InvoiceType',
    FilterColName: 'InvoiceTypeID',
    FilterCaption: 'Invoice Type',
    FilterColCtrlType: controlTypeMap.DROPDOWN,  // search-select
    staticOptions: [],   // populated from fn_tbl_ddl_Sal_Configuration
  },
  {
    FilterParameterID: 'Supplier',
    FilterColName: 'SupplierID',
    FilterCaption: 'Supplier',
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],   // populated from Pr_Fetch_SupplierData_IMS
  },
  {
    FilterParameterID: 'Currency',
    FilterColName: 'CurrencyID',
    FilterCaption: 'Currency',
    FilterColCtrlType: controlTypeMap.TEXTBOX,
  },
  {
    FilterParameterID: 'CurrencyRate',
    FilterColName: 'CurrencyRate',
    FilterCaption: 'Currency Rate',
    FilterColCtrlType: controlTypeMap.TEXTBOX,
  },
  {
    FilterParameterID: 'Department',
    FilterColName: 'DepartmentID',
    FilterCaption: 'Department',
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],   // populated from Pr_Fetch_DepartmentData_IMS
  },
];

// ── Temp-ID generator (negative → never clash with real IDs) ─────────
let _tempId = -1;
const nextTempId = () => _tempId--;

export default function TxnEntryPage() {
  const { id: routeId } = useParams();          // optional :id from route
  const genIDNumber = routeId ? 1 : 0;           // 1 = edit existing, 0 = new entry
  const { get } = useApi();
  const gridRef = useRef(null); // imperative handle → addRow / getRows / getSelectedRows

  // ── Extra dropdown options fetched directly (not via useTxnEntry) ───
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [invoiceTypeOptions, setInvoiceTypeOptions] = useState([]);

  const {
    columns, allColumns, isFetching, metaError, fetchTxnMeta, fetchGridColumns, fireCellEvent,
    headerColumns, headerDropdownOpts, divisionOptions, headerFetching, headerError, fetchHeaderMeta,
    saveTxn, isSaving, saveError,
  } = useTxnEntry();

  // ── Sync hardcoded filters with API column data ──────────────────
  // Match by FilterParameterID ↔ ColName.
  // When matched:
  //   FilterColName   ← ColName       (syncs key used in MstJSON)
  //   FilterCaption   ← DisplayName   (syncs label shown on control)
  //   staticOptions   ← API options   (dropdown data)
  // Division dropdown is populated separately from Fn_tbl_FetchUserWsDivision.
  // Unmatched hardcoded filters are kept as-is (no API data to sync).
  const syncedFilters = useMemo(() => {
    // Helper: inject known API-fetched options by FilterParameterID
    const injectOptions = (filter) => {
      switch (filter.FilterParameterID) {
        case 'Division': return { ...filter, staticOptions: divisionOptions };
        case 'Department': return { ...filter, staticOptions: departmentOptions };
        case 'Supplier': return { ...filter, staticOptions: supplierOptions };
        case 'InvoiceType': return { ...filter, staticOptions: invoiceTypeOptions };
        default: return filter;
      }
    };

    if (headerColumns.length === 0) {
      // API col defs not yet loaded — still inject already-fetched dropdown options
      return TXN_HEADER_FILTERS.map(injectOptions);
    }

    // Build a lookup: ColName → API column object
    const apiColMap = {};
    headerColumns.forEach(col => { apiColMap[col.ColName] = col; });

    return TXN_HEADER_FILTERS.map(filter => {
      const withOpts = injectOptions(filter);

      // Try matching by FilterParameterID first, then by FilterColName
      const apiCol = apiColMap[filter.FilterParameterID] || apiColMap[filter.FilterColName];
      if (!apiCol) return withOpts;

      return {
        ...withOpts,
        FilterColName: apiCol.ColName,
        FilterCaption: apiCol.DisplayName,
        // Only override staticOptions from headerDropdownOpts if we don't already have dedicated data
        staticOptions:
          withOpts?.staticOptions?.length > 0
            ? withOpts.staticOptions
            : (headerDropdownOpts[apiCol.ColName] || []),
      };
    });
  }, [headerColumns, headerDropdownOpts, divisionOptions, departmentOptions, supplierOptions, invoiceTypeOptions]);

  // Track current FilterPanel header values (always up-to-date via ref)
  // Seeded with default values so untouched fields are still sent to the API.
  // In fireCellEvent MstJSON, ColName is used as keys (synced from API).
  const headerValuesRef = useRef({
    TranCode: '',
    TranDate: null,
    DivisionID: 0,
    InvoiceTypeID: 0,
    SupplierID: 0,
    CurrencyID: 0,
    CurrencyRate: 0,
    DepartmentID: 0,
    CompanyID: 1.0,
    YearID: 13.0,
    SessionID: 4150836.0,
    LoginID: 1.0,
    IDNumber: 0
  });

  // Controls GridForm visibility — shown only after first "Add New" click
  const [showGrid, setShowGrid] = useState(false);

  // Rows queued before GridForm is mounted (first click edge-case)
  const queuedRowsRef = useRef([]);

  // ── Order Item modal state ─────────────────────────────────────────────
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [orderItemsLoading, setOrderItemsLoading] = useState(false);
  const [orderItemsError, setOrderItemsError] = useState(null);

  // Tracks whether fetchGridColumns has already run (prevents re-fetching dropdowns)
  const gridColumnsLoadedRef = useRef(false);
  // Spinner guard — prevents double-click while dropdown options are loading
  const [isGridLoading, setIsGridLoading] = useState(false);

  // ── Fetch meta on mount ────────────────────────────────────────────────
  // fetchHeaderMeta: filter panel + Division options (RB_SampleInvMst)
  // fetchTxnMeta:   grid RBID + raw column defs only — NO dropdowns yet
  useEffect(() => {
    fetchHeaderMeta();
    fetchTxnMeta();

    // ── Department options — Pr_Fetch_DepartmentData_IMS ──────────────────
    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: 1,
      ObjName: 'Pr_Fetch_DepartmentData_IMS',
      JSon: JSON.stringify([{ PrmDeptID: 0 }]),
      p_ErrCode: -1,
      p_ErrMsg: '',
    }).then(res => {
      const opts = (res?.Table || []).map(r => ({
        value: String(r.DepartmentID),
        label: r.DepartmentName,
      }));
      setDepartmentOptions(opts);
      console.log('%c[TxnEntry] Department options:', 'color:#06b6d4;font-weight:600', opts.length);
    }).catch(err => console.warn('[TxnEntry] Department fetch failed:', err));

    // ── Supplier options — Pr_Fetch_SupplierData_IMS ──────────────────────
    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: 1,
      ObjName: 'Pr_Fetch_SupplierData_IMS',
      JSon: JSON.stringify([{ PrmSupplierID: 0 }]),
      p_ErrCode: -1,
      p_ErrMsg: '',
    }).then(res => {
      const opts = (res?.Table || []).map(r => ({
        value: String(r.SupplierID),
        label: r.SupplierName,
      }));
      setSupplierOptions(opts);
      console.log('%c[TxnEntry] Supplier options:', 'color:#06b6d4;font-weight:600', opts.length);
    }).catch(err => console.warn('[TxnEntry] Supplier fetch failed:', err));

    // ── Invoice Type options — fn_tbl_ddl_Sal_Configuration ───────────────
    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: 2,
      ObjName: 'fn_tbl_ddl_Sal_Configuration',
      JSon: JSON.stringify([{
        PrmCompanyId: 1,
        PrmDivisionId: 1,
        PrmYearId: 14,
        PrmUserId: 1,
        PrmFormTag: 'SI',
        PrmRefTYpe: '',
        prmRef_MstID: 0,
        prmRef_DetID: 0,
      }]),
      p_ErrCode: -1,
      p_ErrMsg: '',
    }).then(res => {
      const opts = (res?.Table || []).map(r => ({
        value: String(r.InvoiceTypeID),
        label: r.Name,
      }));
      setInvoiceTypeOptions(opts);
      console.log('%c[TxnEntry] InvoiceType options:', 'color:#06b6d4;font-weight:600', opts.length);
    }).catch(err => console.warn('[TxnEntry] InvoiceType fetch failed:', err));

  }, [fetchHeaderMeta, fetchTxnMeta]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flush queued rows once GridForm mounts ────────────────────────────

  useEffect(() => {
    if (showGrid && gridRef.current && queuedRowsRef.current.length > 0) {
      queuedRowsRef.current.forEach(row => gridRef.current.addRow(row));
      queuedRowsRef.current = [];
    }
  }, [showGrid]);

  // ── Add New — called by FilterPanel when the button is clicked ───────
  // On the FIRST click: lazily fetches grid dropdown options (fetchGridColumns)
  // then builds the blank row and shows the grid.
  // _values = current header field values from the filter panel (includes DivisionID)
  // Subsequent clicks: re-uses already-built columns.
  const handleAddNew = useCallback(async (_values) => {
    if (isFetching || isGridLoading) return; // still loading meta — ignore click
    if (allColumns.length === 0) return;      // fetchTxnMeta not done yet

    // ── Lazy-load grid columns on first click ──────────────────────
    // DivisionID from the filter panel is passed so GET_FILTER_DETAIL
    // uses the correct prmDivisionID when fetching column dropdowns.
    let activeCols = columns;
    if (!gridColumnsLoadedRef.current) {
      const divisionID = _values?.DivisionID ?? headerValuesRef.current?.DivisionID ?? 0;
      setIsGridLoading(true);
      try {
        activeCols = await fetchGridColumns(divisionID);
        gridColumnsLoadedRef.current = true;
      } finally {
        setIsGridLoading(false);
      }
      if (!activeCols || activeCols.length === 0) return; // fetch failed
    }

    // ── Seed blank row with ALL columns (visible + hidden) ────────
    // Default value driven by ColDataType via getColDefault():
    //   numeric* → 0 | varchar* → '' | datetime* → null
    const blankRow = { id: nextTempId() };
    allColumns.forEach(({ key, colDataType }) => {
      blankRow[key] = getColDefault(colDataType);
    });

    // Safety net: seed any visible key not already covered
    activeCols.forEach(col => {
      if (col.key !== 'cb' && !(col.key in blankRow)) {
        blankRow[col.key] = getColDefault(col.colDataType);
      }
    });

    if (!showGrid) {
      queuedRowsRef.current.push(blankRow);
      setShowGrid(true);
    } else {
      gridRef.current?.addRow(blankRow);
    }
  }, [columns, allColumns, showGrid, isFetching, isGridLoading, fetchGridColumns]);

  // ── Order Item — fetch items for selected Division and open modal ────────
  // Called by TxnEntryFilterPanel via onOrderItem(currentValues)
  const handleOrderItem = useCallback(async (panelValues) => {
    const divisionID = panelValues?.DivisionID ?? headerValuesRef.current?.DivisionID ?? 0;
    if (!divisionID || divisionID === '0' || divisionID === 0) {
      alert('Please select a Division before ordering items.');
      return;
    }

    setOrderModalOpen(true);
    setOrderItems([]);
    setOrderItemsError(null);
    setOrderItemsLoading(true);

    try {
      const response = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 1,
        ObjName: 'Pr_TBD_FetchItemDetail',
        JSon: JSON.stringify([{
          prmDivisionID: Number(divisionID),
          prmYearID: 14,
          prmConfigID: 34,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      setOrderItems(response?.Table || []);
      console.log('%c[TxnEntry] Order items fetched:', 'color:#f59e0b;font-weight:600',
        response?.Table?.length ?? 0, 'items');
    } catch (err) {
      console.error('[TxnEntry] Order item fetch failed:', err);
      setOrderItemsError(err?.message || 'Failed to fetch items. Please try again.');
    } finally {
      setOrderItemsLoading(false);
    }
  }, [get, headerValuesRef]);

  // ── Insert selected Order Items into the entry grid ───────────────────
  // Each selected item is mapped to a blank row (seeded from allColumns)
  // with the item's own fields merged in by matching key names.
  const handleInsertOrderItems = useCallback((selectedItems) => {
    if (!selectedItems || selectedItems.length === 0) return;

    // Ensure grid columns are built before inserting
    const insertRow = async (item) => {
      let activeCols = columns;

      // Lazy-load grid columns if not yet built (first interaction via Order Item)
      if (!gridColumnsLoadedRef.current) {
        const divisionID = headerValuesRef.current?.DivisionID ?? 0;
        setIsGridLoading(true);
        try {
          activeCols = await fetchGridColumns(divisionID);
          gridColumnsLoadedRef.current = true;
        } finally {
          setIsGridLoading(false);
        }
        if (!activeCols || activeCols.length === 0) return;
      }

      // Seed blank row from allColumns, then merge item fields
      const blankRow = { id: nextTempId() };
      allColumns.forEach(({ key, colDataType }) => {
        blankRow[key] = getColDefault(colDataType);
      });
      // Merge item fields by key name match
      Object.keys(item).forEach(key => {
        if (key in blankRow) blankRow[key] = item[key];
      });

      if (!showGrid) {
        queuedRowsRef.current.push(blankRow);
      } else {
        gridRef.current?.addRow(blankRow);
      }
    };

    (async () => {
      for (const item of selectedItems) {
        await insertRow(item);
      }
      // Show grid if not already visible
      if (!showGrid) setShowGrid(true);
    })();
  }, [columns, allColumns, showGrid, fetchGridColumns, gridColumnsLoadedRef]);

  // ── Cell event — fires when user Tabs off an event column ──────────
  // Calls the server-side calculation function and merges the result
  // back into the grid row.
  // Response shape: { Links: [{ ...fields, ErrCode: 1, ErrMsg: "Success" }] }
  const handleCellEvent = useCallback(async ({ rowId, colKey, rowData }) => {
    const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
    if (!result || !gridRef.current) return;

    const responseRow = result?.Links?.[0];
    if (!responseRow) return;

    // ErrCode === 1 means success on this API
    const errCode = responseRow.ErrCode;
    if (errCode !== 1 && errCode !== 1.0) {
      console.warn(
        '%c[TxnEntry] Cell-event returned an error:',
        'color:#ef4444;font-weight:600',
        responseRow.ErrMsg ?? `ErrCode ${errCode}`
      );
      return;
    }

    // Strip the status fields — only merge the actual data fields
    const { ErrCode, ErrMsg, ...updatedFields } = responseRow;

    console.log(
      '%c[TxnEntry] Merging event result into row:',
      'color:#22c55e;font-weight:600',
      { rowId, updatedFields }
    );

    gridRef.current.updateRow?.(rowId, updatedFields);
  }, [fireCellEvent]);

  // ── Track header values as they change in FilterPanel ──────────────
  // ColName (synced from API) is used as the key
  const handleFilterChange = useCallback((colName, value) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: value };
  }, []);

  // ── Save handler ────────────────────────────────────────────────────
  // Only CHECKED rows (getSelectedRows) are sent to the save API.
  const handleSave = useCallback(async () => {
    const selectedRows = gridRef.current?.getSelectedRows?.() ?? [];
    if (selectedRows.length === 0) {
      alert('No rows selected. Please check at least one row to save.');
      return;
    }
    console.log('[TxnEntry] Saving selected rows:', selectedRows);
    try {
      const result = await saveTxn(
        headerValuesRef.current,
        selectedRows,
        genIDNumber,
      );
      // Handle success
      if (result) {
        alert('Transaction saved successfully!');
      }
    } catch (err) {
      // Error already logged + setSaveError in the hook
      alert(saveError || err?.message || 'Save failed.');
    }
  }, [saveTxn, genIDNumber, saveError]);

  // ── GridForm config ─────────────────────────────────────────────────
  const gridConfig = {
    columns,
    pagination: { pageSize: 25, pageSizeOptions: [10, 25, 50, 100] },
  };

  // ── Determine overall loading / error state ─────────────────────────
  const combinedError = metaError || headerError;

  usePageHeader({
    title: 'Sample Invoice',
    subtitle: 'Fill in the header fields, then click Add New to add line items.',
    showBack: true,
    backTo: '/',
  });

  return (
    <div className="workspace-page workspace-page--fill txn-page">
      <section className="workspace-page__filters">
        {combinedError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{combinedError}</span>
            <button type="button" onClick={() => { fetchHeaderMeta(); fetchTxnMeta(); }}>
              Retry
            </button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            title="Sample Invoice Detail"
            staticFilters={syncedFilters}
            onSearch={handleAddNew}
            onOrderItem={handleOrderItem}
            onFilterChange={handleFilterChange}
            isSearching={isGridLoading || headerFetching}
            actionLabel="Add New"
            ActionIcon={Plus}
          />
        )}
      </section>

      {showGrid && (
        <section className="workspace-page__grid">
          <EntryGrid
            ref={gridRef}
            config={gridConfig}
            title="Invoice Line Items"
            onSave={handleSave}
            onCellEvent={handleCellEvent}
          />
        </section>
      )}

      <OrderItemModal
        isOpen={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        items={orderItems}
        isLoading={orderItemsLoading}
        error={orderItemsError}
        onInsert={handleInsertOrderItems}
      />
    </div>
  );
}
