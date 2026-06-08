// TxnEntryPage.jsx
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
import EnterpriseFilterPanel from '../../components/filters/EnterpriseFilterPanel';
import EntryGrid from '../../components/grid/EntryGrid';
import OrderItemModal from '../../components/txn/OrderItemModal';
import { useTxnEntry } from '../../hooks/useTxnEntry';
import { useApi } from '../../api/useApi';
import { controlTypeMap } from '../../data/dummyData';
import { getColDefault, ENDPOINTS, API_BASE_URL_OLD, OBJ_TYPE } from '../../api/constants';
import { TXN_CONFIG } from './constants';
import { usePageHeader } from '../../context/PageHeaderContext';
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
    FilterColCtrlType: controlTypeMap.DROPDOWN,
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
  const { id: routeId } = useParams();
  const genIDNumber = routeId ? 1 : 0;
  const { get } = useApi(API_BASE_URL_OLD);
  const gridRef = useRef(null);

  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [invoiceTypeOptions, setInvoiceTypeOptions] = useState([]);

  const {
    columns, allColumns, isFetching, metaError, fetchTxnMeta, fetchGridColumns, fireCellEvent,
    headerColumns, headerDropdownOpts, divisionOptions, headerFetching, headerError, fetchHeaderMeta,
    saveTxn, isSaving, saveError,
  } = useTxnEntry(API_BASE_URL_OLD);

  const syncedFilters = useMemo(() => {
    const injectOptions = (filter) => {
      switch (filter.FilterParameterID) {
        case 'Division': return { ...filter, staticOptions: divisionOptions };
        case 'Department': return { ...filter, staticOptions: departmentOptions };
        case 'Supplier': return { ...filter, staticOptions: supplierOptions };
        case 'InvoiceType': return { ...filter, staticOptions: invoiceTypeOptions };
        default: return filter;
      }
    };

    if (headerColumns.length === 0) return TXN_HEADER_FILTERS.map(injectOptions);

    const apiColMap = {};
    headerColumns.forEach(col => { apiColMap[col.ColName] = col; });

    return TXN_HEADER_FILTERS.map(filter => {
      const withOpts = injectOptions(filter);
      const apiCol = apiColMap[filter.FilterParameterID] || apiColMap[filter.FilterColName];
      if (!apiCol) return withOpts;
      return {
        ...withOpts,
        FilterColName: apiCol.ColName,
        FilterCaption: apiCol.DisplayName,
        staticOptions:
          withOpts?.staticOptions?.length > 0
            ? withOpts.staticOptions
            : (headerDropdownOpts[apiCol.ColName] || []),
      };
    });
  }, [headerColumns, headerDropdownOpts, divisionOptions, departmentOptions, supplierOptions, invoiceTypeOptions]);

  const headerValuesRef = useRef({
    TranCode: '', TranDate: null, DivisionID: 0, InvoiceTypeID: 0,
    SupplierID: 0, CurrencyID: 0, CurrencyRate: 0, DepartmentID: 0,
    CompanyID: 1.0, YearID: 13.0, SessionID: 4150836.0, LoginID: 1.0, IDNumber: 0,
  });

  const [showGrid, setShowGrid] = useState(false);
  const queuedRowsRef = useRef([]);

  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [orderItemsLoading, setOrderItemsLoading] = useState(false);
  const [orderItemsError, setOrderItemsError] = useState(null);

  const gridColumnsLoadedRef = useRef(false);
  const [isGridLoading, setIsGridLoading] = useState(false);

  useEffect(() => {
    fetchHeaderMeta();
    fetchTxnMeta();

    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: OBJ_TYPE.PROCEDURE,
      ObjName: TXN_CONFIG.SP_DEPARTMENTS,
      JSon: JSON.stringify([{ PrmDeptID: 0 }]),
      p_ErrCode: -1, p_ErrMsg: '',
    }).then(res => {
      setDepartmentOptions((res?.Table || []).map(r => ({ value: String(r.DepartmentID), label: r.DepartmentName })));
    }).catch(err => console.warn('[TxnEntry] Department fetch failed:', err));

    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: OBJ_TYPE.PROCEDURE,
      ObjName: TXN_CONFIG.SP_SUPPLIERS,
      JSon: JSON.stringify([{ PrmSupplierID: 0 }]),
      p_ErrCode: -1, p_ErrMsg: '',
    }).then(res => {
      setSupplierOptions((res?.Table || []).map(r => ({ value: String(r.SupplierID), label: r.SupplierName })));
    }).catch(err => console.warn('[TxnEntry] Supplier fetch failed:', err));

    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: OBJ_TYPE.FUNCTION,
      ObjName: TXN_CONFIG.SP_INVOICE_TYPES,
      JSon: JSON.stringify([{
        PrmCompanyId: TXN_CONFIG.COMPANY_ID,
        PrmDivisionId: TXN_CONFIG.LOGIN_ID,
        PrmYearId: TXN_CONFIG.INVOICE_TYPE_YEAR_ID,
        PrmUserId: TXN_CONFIG.LOGIN_ID,
        PrmFormTag: TXN_CONFIG.FORM_TAG,
        PrmRefTYpe: '', prmRef_MstID: 0, prmRef_DetID: 0,
      }]),
      p_ErrCode: -1, p_ErrMsg: '',
    }).then(res => {
      setInvoiceTypeOptions((res?.Table || []).map(r => ({ value: String(r.InvoiceTypeID), label: r.Name })));
    }).catch(err => console.warn('[TxnEntry] InvoiceType fetch failed:', err));

  }, [fetchHeaderMeta, fetchTxnMeta]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showGrid && gridRef.current && queuedRowsRef.current.length > 0) {
      queuedRowsRef.current.forEach(row => gridRef.current.addRow(row));
      queuedRowsRef.current = [];
    }
  }, [showGrid]);

  const handleAddNew = useCallback(async (_values) => {
    if (isFetching || isGridLoading) return;
    if (allColumns.length === 0) return;

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
      if (!activeCols || activeCols.length === 0) return;
    }

    const blankRow = { id: nextTempId() };
    allColumns.forEach(({ key, colDataType }) => { blankRow[key] = getColDefault(colDataType); });
    activeCols.forEach(col => {
      if (col.key !== 'cb' && !(col.key in blankRow)) blankRow[col.key] = getColDefault(col.colDataType);
    });

    if (!showGrid) { queuedRowsRef.current.push(blankRow); setShowGrid(true); }
    else gridRef.current?.addRow(blankRow);
  }, [columns, allColumns, showGrid, isFetching, isGridLoading, fetchGridColumns]);

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
        ObjType: OBJ_TYPE.PROCEDURE,
        ObjName: TXN_CONFIG.SP_ORDER_ITEMS,
        JSon: JSON.stringify([{
          prmDivisionID: Number(divisionID),
          prmYearID: TXN_CONFIG.ORDER_ITEM_YEAR_ID,
          prmConfigID: TXN_CONFIG.ORDER_ITEM_CONFIG_ID,
        }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      setOrderItems(response?.Table || []);
    } catch (err) {
      console.error('[TxnEntry] Order item fetch failed:', err);
      setOrderItemsError(err?.message || 'Failed to fetch items. Please try again.');
    } finally {
      setOrderItemsLoading(false);
    }
  }, [get, headerValuesRef]);

  const handleInsertOrderItems = useCallback((selectedItems) => {
    if (!selectedItems?.length) return;
    const insertRow = async (item) => {
      let activeCols = columns;
      if (!gridColumnsLoadedRef.current) {
        const divisionID = headerValuesRef.current?.DivisionID ?? 0;
        setIsGridLoading(true);
        try {
          activeCols = await fetchGridColumns(divisionID);
          gridColumnsLoadedRef.current = true;
        } finally {
          setIsGridLoading(false);
        }
        if (!activeCols?.length) return;
      }
      const blankRow = { id: nextTempId() };
      allColumns.forEach(({ key, colDataType }) => { blankRow[key] = getColDefault(colDataType); });
      Object.keys(item).forEach(key => { if (key in blankRow) blankRow[key] = item[key]; });
      if (!showGrid) queuedRowsRef.current.push(blankRow);
      else gridRef.current?.addRow(blankRow);
    };
    (async () => {
      for (const item of selectedItems) await insertRow(item);
      if (!showGrid) setShowGrid(true);
    })();
  }, [columns, allColumns, showGrid, fetchGridColumns, gridColumnsLoadedRef]);

  const handleCellEvent = useCallback(async ({ rowId, colKey, rowData }) => {
    const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
    if (!result || !gridRef.current) return;
    const responseRow = result?.Links?.[0];
    if (!responseRow) return;
    const errCode = responseRow.ErrCode;
    if (errCode !== 1 && errCode !== 1.0) {
      console.warn('[TxnEntry] Cell-event error:', responseRow.ErrMsg ?? `ErrCode ${errCode}`);
      return;
    }
    const { ErrCode, ErrMsg, ...updatedFields } = responseRow;
    gridRef.current.updateRow?.(rowId, updatedFields);
  }, [fireCellEvent]);

  const handleFilterChange = useCallback((colName, value) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: value };
  }, []);

  const handleSave = useCallback(async () => {
    const selectedRows = gridRef.current?.getSelectedRows?.() ?? [];
    if (selectedRows.length === 0) {
      alert('No rows selected. Please check at least one row to save.');
      return;
    }
    try {
      const result = await saveTxn(headerValuesRef.current, selectedRows, genIDNumber);
      if (result) alert('Transaction saved successfully!');
    } catch (err) {
      alert(saveError || err?.message || 'Save failed.');
    }
  }, [saveTxn, genIDNumber, saveError]);

  const gridConfig = {
    columns,
    pagination: { pageSize: 25, pageSizeOptions: [10, 25, 50, 100] },
  };

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
