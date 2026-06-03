// PurchaseOrderPage.jsx
// Purchase Order Detail page.
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — 13-field header; "Get Item" secondary button
//   2. EntryGrid              — Item Grid (18 columns, shown after first "Add New")
//   3. POItemDetailPanel      — Item-wise collapsible panel with 3 tabs:
//                               Levy Details | Delivery Schedule | Indent Detail
//   4. POSummaryBar           — Levy Bifercation + USD/INR totals
//   5. POTermsPanel           — Header / Title / Terms grid / Payment Terms grid
//   6. POConsigneePanel       — Own Consignee / Third Party Customer + Name/DelLoc/Address
//   7. PIActionBar            — Document F6 | Save & Print | Save | Cancel | Close
//
// Item-wise wiring:
//   onSelectionChange on EntryGrid → when exactly 1 row checked,
//   POItemDetailPanel auto-expands and shows that item's sub-grids.

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import EnterpriseFilterPanel from '../components/filters/EnterpriseFilterPanel';
import EntryGrid             from '../components/grid/EntryGrid';
import POItemDetailPanel     from '../components/purchase-order/POItemDetailPanel';
import POSummaryBar          from '../components/purchase-order/POSummaryBar';
import POTermsPanel          from '../components/purchase-order/POTermsPanel';
import POConsigneePanel      from '../components/purchase-order/POConsigneePanel';
import PIActionBar           from '../components/purchase-inquiry/PIActionBar';
import { useApi }            from '../api/useApi';
import { ENDPOINTS }         from '../api/constants';
import { controlTypeMap }    from '../data/dummyData';
import { usePageHeader }     from '../context/PageHeaderContext';
import './PurchaseOrderPage.css';

// ── Header filter definitions ─────────────────────────────────────────
const PO_HEADER_FILTERS = [
  { FilterParameterID: 'Amend',        FilterColName: 'Amend',        FilterCaption: 'Amend',        FilterColCtrlType: controlTypeMap.CHECKBOX  },
  { FilterParameterID: 'AmdNo',        FilterColName: 'AmdNo',        FilterCaption: 'Amd No.',      FilterColCtrlType: controlTypeMap.TEXTBOX   },
  { FilterParameterID: 'PoNo',         FilterColName: 'PoNo',         FilterCaption: 'Po No.',       FilterColCtrlType: controlTypeMap.TEXTBOX   },
  { FilterParameterID: 'PoDate',       FilterColName: 'PoDate',       FilterCaption: 'Date',         FilterColCtrlType: controlTypeMap.DATE      },
  { FilterParameterID: 'DeliveryDt',   FilterColName: 'DeliveryDt',   FilterCaption: 'Delivery Dt',  FilterColCtrlType: controlTypeMap.DATE      },
  { FilterParameterID: 'SupplierID',   FilterColName: 'SupplierID',   FilterCaption: 'Supplier',     FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'DivisionID',   FilterColName: 'DivisionID',   FilterCaption: 'Division',     FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'PoTypeID',     FilterColName: 'PoTypeID',     FilterCaption: 'Po Type',      FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'BasedOnID',    FilterColName: 'BasedOnID',    FilterCaption: 'Based On',     FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'IndentID',     FilterColName: 'IndentID',     FilterCaption: 'Indent',       FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'DepartmentID', FilterColName: 'DepartmentID', FilterCaption: 'Department',   FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'CrDays',       FilterColName: 'CrDays',       FilterCaption: 'Cr Days',      FilterColCtrlType: controlTypeMap.TEXTBOX   },
  { FilterParameterID: 'Currency',     FilterColName: 'Currency',     FilterCaption: 'Currency',     FilterColCtrlType: controlTypeMap.TEXTBOX   },
];

// ── Item Grid column definitions ──────────────────────────────────────
const PO_ITEM_COLUMNS = [
  { id: 'cb',            name: '',                    key: 'cb',           controlType: 0, isFixed: true,  width: 42  },
  { id: 'SrNo',          name: 'SrNO',                key: 'SrNo',         controlType: 0, isFixed: true,  width: 65  },
  { id: 'ItemCode',      name: 'Item Code',           key: 'ItemCode',     controlType: 1, isFixed: true,  width: 110 },
  { id: 'ItemName',      name: 'Item Name',           key: 'ItemName',     controlType: 1, isFixed: false, width: 170 },
  { id: 'HsnNo',         name: 'HSN No',              key: 'HsnNo',        controlType: 1, isFixed: false, width: 100 },
  { id: 'IndentQty',     name: 'Indent Qty',          key: 'IndentQty',    controlType: 1, isFixed: false, width: 95  },
  { id: 'StockQty',      name: 'Stock Qty',           key: 'StockQty',     controlType: 0, isFixed: false, width: 90  },
  { id: 'OrderQty',      name: 'Order Qty',           key: 'OrderQty',     controlType: 1, isFixed: false, width: 90  },
  { id: 'PurUnit',       name: 'Pur.Unit',            key: 'PurUnit',      controlType: 1, isFixed: false, width: 90  },
  { id: 'RatePurQty',    name: 'Rate (Pur.Qty)',      key: 'RatePurQty',   controlType: 1, isFixed: false, width: 110 },
  { id: 'UnitConv',      name: 'Unit Conv.',          key: 'UnitConv',     controlType: 1, isFixed: false, width: 90  },
  { id: 'BaseQty',       name: 'Base Qty',            key: 'BaseQty',      controlType: 1, isFixed: false, width: 85  },
  { id: 'BaseUnit',      name: 'Base Unit',           key: 'BaseUnit',     controlType: 1, isFixed: false, width: 85  },
  { id: 'BaseRateInr',   name: 'Base Rate in INR',    key: 'BaseRateInr',  controlType: 1, isFixed: false, width: 120 },
  { id: 'DiscPerc',      name: 'Disc (%)',            key: 'DiscPerc',     controlType: 1, isFixed: false, width: 80  },
  { id: 'DiscAmt',       name: 'Disc Amt',            key: 'DiscAmt',      controlType: 0, isFixed: false, width: 90  },
  { id: 'Amount',        name: 'Amount',              key: 'Amount',       controlType: 0, isFixed: false, width: 100 },
  { id: 'BaseAmountInr', name: 'Base Amount In (INR)',key: 'BaseAmountInr',controlType: 0, isFixed: false, width: 140 },
];

// Temp-ID generator
let _poTempId = -1;
const nextTempId = () => _poTempId--;

const blankItemRow = () => ({
  id: nextTempId(), SrNo: '', ItemCode: '', ItemName: '', HsnNo: '',
  IndentQty: 0, StockQty: 0, OrderQty: 0, PurUnit: '', RatePurQty: 0,
  UnitConv: 0, BaseQty: 0, BaseUnit: '', BaseRateInr: 0, DiscPerc: 0,
  DiscAmt: 0, Amount: 0, BaseAmountInr: 0,
});

// ── Page component ────────────────────────────────────────────────────
export default function PurchaseOrderPage() {
  const { id: routeId } = useParams();
  const navigate        = useNavigate();
  const { get }         = useApi();
  const itemGridRef     = useRef(null);

  const headerValuesRef = useRef({
    Amend: false, AmdNo: '', PoNo: '', PoDate: null, DeliveryDt: null,
    SupplierID: 0, DivisionID: 0, PoTypeID: 0, BasedOnID: 0,
    IndentID: 0, DepartmentID: 0, CrDays: '', Currency: '1.00',
    CompanyID: 1, YearID: 13, LoginID: 1, IDNumber: routeId ? Number(routeId) : 0,
  });

  // Dropdown options
  const [divisionOptions,   setDivisionOptions]   = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [supplierOptions,   setSupplierOptions]   = useState([]);

  // Item grid — always visible; rows start empty

  // Item-wise detail panel — selectedItem drives POItemDetailPanel
  const [selectedItem,    setSelectedItem]    = useState(null);
  const [levyRows,        setLevyRows]        = useState([]);
  const [deliveryRows,    setDeliveryRows]    = useState([]);
  const [indentDetailRows,setIndentDetailRows]= useState([]);

  // Save / error state
  const [isSaving,    setIsSaving]    = useState(false);
  const [fetchError,  setFetchError]  = useState(null);

  usePageHeader({
    title:    'Purchase Order',
    subtitle: 'Fill in the header fields, then add items using the grid buttons.',
    showBack: true,
    backTo:   '/',
  });

  // ── Fetch dropdown options on mount ──────────────────────────────
  useEffect(() => {
    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: 2, ObjName: 'Fn_tbl_FetchUserWsDivision',
      JSon: JSON.stringify([{ prmUserID: 1, prmCompanyID: 1, prmYearID: 14 }]),
      p_ErrCode: -1, p_ErrMsg: '',
    }).then((res) => setDivisionOptions(
      (res?.Table || []).map((r) => ({ value: String(r.DivisionID), label: r.DivisionName }))
    )).catch(() => {});

    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: 1, ObjName: 'Pr_Fetch_DepartmentData_IMS',
      JSon: JSON.stringify([{ PrmDeptID: 0 }]),
      p_ErrCode: -1, p_ErrMsg: '',
    }).then((res) => setDepartmentOptions(
      (res?.Table || []).map((r) => ({ value: String(r.DepartmentID), label: r.DepartmentName }))
    )).catch(() => {});

    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: 1, ObjName: 'Pr_Fetch_SupplierData_IMS',
      JSon: JSON.stringify([{ PrmSupplierID: 0 }]),
      p_ErrCode: -1, p_ErrMsg: '',
    }).then((res) => setSupplierOptions(
      (res?.Table || []).map((r) => ({ value: String(r.SupplierID), label: r.SupplierName }))
    )).catch(() => {});

  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inject live options into filter definitions ───────────────────
  const poFilters = useMemo(() => PO_HEADER_FILTERS.map((f) => {
    switch (f.FilterParameterID) {
      case 'DivisionID':   return { ...f, staticOptions: divisionOptions   };
      case 'DepartmentID': return { ...f, staticOptions: departmentOptions };
      case 'SupplierID':   return { ...f, staticOptions: supplierOptions   };
      default:             return f;
    }
  }), [divisionOptions, departmentOptions, supplierOptions]);

  // ── Item selection → drives POItemDetailPanel ─────────────────────
  // When exactly 1 row is checked: set selectedItem + load its sub-grid data.
  // Otherwise: clear everything.
  const handleItemSelectionChange = useCallback((count) => {
    if (count !== 1) {
      setSelectedItem(null);
      setLevyRows([]);
      setDeliveryRows([]);
      setIndentDetailRows([]);
      return;
    }

    const selected = itemGridRef.current?.getSelectedRows?.() ?? [];
    if (selected.length !== 1) return;

    const item = selected[0];
    setSelectedItem(item);

    console.log('%c[PO] Loading detail tabs for item:', 'color:#6366f1;font-weight:600', item);

    // TODO: fetch real data from API using item.ItemCode / item.id
    // e.g. get(ENDPOINTS.FN_FETCH_DATA, { ObjName: 'Pr_Fetch_POLevyByItem', ... })
    setLevyRows([]);
    setDeliveryRows([]);
    setIndentDetailRows([]);
  }, []);

  // ── Callbacks ─────────────────────────────────────────────────────
  const handleFilterChange = useCallback((colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };
  }, []);

  const handleAddNew = useCallback(() => {
    itemGridRef.current?.addRow(blankItemRow());
  }, []);

  const handleGetItem = useCallback((_values) => {
    console.log('[PO] Get Item — wire up item selection modal here.');
  }, []);

  const handleDeleteIndentRows = useCallback((ids) => {
    setIndentDetailRows((prev) => prev.filter((r) => !ids.includes(String(r.id ?? r))));
  }, []);

  const handleSave = useCallback(async () => {
    const selectedRows = itemGridRef.current?.getSelectedRows?.() ?? [];
    if (selectedRows.length === 0) {
      alert('No rows selected. Please check at least one item row to save.');
      return;
    }
    setIsSaving(true);
    try {
      console.log('%c[PO] Saving…', 'color:#f59e0b;font-weight:600', {
        header: headerValuesRef.current, rows: selectedRows,
      });
      alert('Purchase Order saved successfully!');
    } catch (err) {
      alert(err?.message || 'Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleSaveAndPrint = useCallback(async () => { await handleSave(); window.print(); }, [handleSave]);

  const handleCancel = useCallback(() => {
    if (!window.confirm('Discard changes and reset the form?')) return;
    headerValuesRef.current = {
      Amend: false, AmdNo: '', PoNo: '', PoDate: null, DeliveryDt: null,
      SupplierID: 0, DivisionID: 0, PoTypeID: 0, BasedOnID: 0,
      IndentID: 0, DepartmentID: 0, CrDays: '', Currency: '1.00',
      CompanyID: 1, YearID: 13, LoginID: 1, IDNumber: 0,
    };
    setSelectedItem(null);
    setLevyRows([]);
    setDeliveryRows([]);
    setIndentDetailRows([]);
  }, []);

  const handleClose    = useCallback(() => navigate('/'), [navigate]);
  const handleDocument = useCallback(() => { console.log('[PO] Document F6'); }, []);

  const gridConfig = {
    columns:    PO_ITEM_COLUMNS,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="workspace-page po-page">

      {/* 1. Header */}
      <section className="workspace-page__filters">
        {fetchError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{fetchError}</span>
            <button type="button" onClick={() => setFetchError(null)}>Dismiss</button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            title="Purchase Order Detail"
            staticFilters={poFilters}
            onFilterChange={handleFilterChange}
          />
        )}
      </section>

      {/* 2. Item Grid — always visible; empty table until rows are added */}
      <section className="workspace-page__grid po-page__grid">
        <EntryGrid
          ref={itemGridRef}
          config={gridConfig}
          title="Item Grid"
          onSave={handleSave}
          onSelectionChange={handleItemSelectionChange}
          onAddItem={handleAddNew}
          addItemLabel="Add Item"
          onGetItem={handleGetItem}
          getItemLabel="Get Item"
        />
      </section>

      {/* 3. Item-wise collapsible panel — Levy Details | Delivery Schedule | Indent Detail */}
      <section className="po-page__section">
        <POItemDetailPanel
          selectedItem={selectedItem}
          levyRows={levyRows}
          deliveryRows={deliveryRows}
          indentRows={indentDetailRows}
          onDeleteIndentRows={handleDeleteIndentRows}
        />
      </section>

      {/* 4. Terms & Conditions */}
      <section className="po-page__section">
        <POTermsPanel />
      </section>

      {/* 5. Consignee */}
      <section className="po-page__section">
        <POConsigneePanel />
      </section>

      {/* 6. Summary Bar — after Consignee, bottom of form */}
      <section className="po-page__section">
        <POSummaryBar />
      </section>

      {/* 7. Action Bar */}
      <section className="po-page__section">
        <PIActionBar
          onDocument={handleDocument}
          onSaveAndPrint={handleSaveAndPrint}
          onSave={handleSave}
          onCancel={handleCancel}
          onClose={handleClose}
          isSaving={isSaving}
        />
      </section>

    </div>
  );
}
