// PurchaseInquiryPage.jsx
// Purchase Inquiry Detail page.
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — header (9 PI fields, staticFilters mode)
//   2. EntryGrid              — Item Detail editable grid (shown after first "Add New")
//   3. PIBottomTabPanel       — Suppliers | Term And Conditions
//   4. CollapsibleGrid        — Indent Details (item-wise child grid)
//                               Rows reflect whichever single item row is checked.
//   5. PIActionBar            — Document F6 | Save & Print | Save | Cancel | Close
//
// API pattern mirrors TxnEntryPage.jsx:
//   - headerValuesRef keeps always-current values for API calls (no re-render cost)
//   - Dropdown options fetched on mount via useApi().get()
//   - Item grid hidden until first "Add New" click

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ShoppingBag, Plus } from 'lucide-react';
import EnterpriseFilterPanel from '../components/filters/EnterpriseFilterPanel';
import EntryGrid from '../components/grid/EntryGrid';
import CollapsibleGrid from '../components/grid/CollapsibleGrid';
import PIBottomTabPanel from '../components/purchase-inquiry/PIBottomTabPanel';
import PIActionBar from '../components/purchase-inquiry/PIActionBar';
import { useApi } from '../api/useApi';
import { ENDPOINTS } from '../api/constants';
import { controlTypeMap } from '../data/dummyData';
import { usePageHeader } from '../context/PageHeaderContext';
import './PurchaseInquiryPage.css';

// ── Header filter definitions — matches Excel wireframe ────────────────
const PI_HEADER_FILTERS = [
  { FilterParameterID: 'InquiryNo',     FilterColName: 'InquiryNo',     FilterCaption: 'Inquiry No.',   FilterColCtrlType: controlTypeMap.TEXTBOX   },
  { FilterParameterID: 'InquiryDate',   FilterColName: 'InquiryDate',   FilterCaption: 'Date',          FilterColCtrlType: controlTypeMap.DATE      },
  { FilterParameterID: 'InquiryTypeID', FilterColName: 'InquiryTypeID', FilterCaption: 'Inquiry Type',  FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'ExpectedDate',  FilterColName: 'ExpectedDate',  FilterCaption: 'Expected Date', FilterColCtrlType: controlTypeMap.DATE      },
  { FilterParameterID: 'DivisionID',    FilterColName: 'DivisionID',    FilterCaption: 'Division',      FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'IndentID',      FilterColName: 'IndentID',      FilterCaption: 'Indent',        FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'DepartmentID',  FilterColName: 'DepartmentID',  FilterCaption: 'Department',    FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'BasedOn',       FilterColName: 'BasedOn',       FilterCaption: 'Based On',      FilterColCtrlType: controlTypeMap.TEXTBOX   },
  { FilterParameterID: 'Remark',        FilterColName: 'Remark',        FilterCaption: 'Remark',        FilterColCtrlType: controlTypeMap.TEXTAREA  },
];

// ── Item Detail grid column definitions — matches Excel wireframe ──────
// controlType: 0=Label, 1=TextBox, 2=Date, 4=Dropdown, 9=Textarea
const PI_ITEM_COLUMNS = [
  { id: 'cb',           name: '',               key: 'cb',           controlType: 0, isFixed: true,  width: 42  },
  { id: 'SrNo',         name: 'Sr.No',          key: 'SrNo',         controlType: 0, isFixed: true,  width: 70  },
  { id: 'ItemCode',     name: 'Item Code',      key: 'ItemCode',     controlType: 1, isFixed: true,  width: 130 },
  { id: 'ItemName',     name: 'Item Name',      key: 'ItemName',     controlType: 1, isFixed: false, width: 210 },
  { id: 'TranQty',      name: 'Tran Qty',       key: 'TranQty',      controlType: 1, isFixed: false, width: 100 },
  { id: 'UnitConvRate', name: 'Unit Conv. Rate',key: 'UnitConvRate', controlType: 1, isFixed: false, width: 130 },
  { id: 'TranUnit',     name: 'Tran Unit',      key: 'TranUnit',     controlType: 1, isFixed: false, width: 100 },
  { id: 'BaseQty',      name: 'Base Qty',       key: 'BaseQty',      controlType: 1, isFixed: false, width: 100 },
  { id: 'BaseUnit',     name: 'Base Unit',      key: 'BaseUnit',     controlType: 1, isFixed: false, width: 100 },
  { id: 'ItemRemark',   name: 'Remark',         key: 'ItemRemark',   controlType: 9, isFixed: false, width: 180 },
];

// ── Indent Details column definitions — child grid, item-wise ─────────
const INDENT_DETAILS_COLUMNS = [
  { key: 'SrNo',       label: 'Sr.No',       width: 70  },
  { key: 'IndentNo',   label: 'Indent No.',  width: 120 },
  { key: 'IndentDate', label: 'Indent Date', width: 110 },
  { key: 'ItemName',   label: 'Item Name',   width: 190 },
  { key: 'IndentQty',  label: 'Indent Qty',  width: 100 },
  { key: 'TranQty',    label: 'Tran Qty',    width: 100 },
  { key: 'Unit',       label: 'Unit',        width: 80  },
];

// Temp-ID generator — negative so it never clashes with real backend IDs
let _piTempId = -1;
const nextTempId = () => _piTempId--;

const blankItemRow = () => ({
  id:           nextTempId(),
  SrNo:         '',
  ItemCode:     '',
  ItemName:     '',
  TranQty:      0,
  UnitConvRate: 0,
  TranUnit:     '',
  BaseQty:      0,
  BaseUnit:     '',
  ItemRemark:   '',
});

// ── Page component ────────────────────────────────────────────────────
export default function PurchaseInquiryPage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { get } = useApi();
  const itemGridRef = useRef(null);

  // Always-current header values for API calls — not state, avoids re-renders.
  const headerValuesRef = useRef({
    InquiryNo:     '',
    InquiryDate:   null,
    InquiryTypeID: 0,
    ExpectedDate:  null,
    DivisionID:    0,
    IndentID:      0,
    DepartmentID:  0,
    BasedOn:       '',
    Remark:        '',
    CompanyID:     1,
    YearID:        13,
    LoginID:       1,
    IDNumber:      routeId ? Number(routeId) : 0,
  });

  // Dropdown options
  const [divisionOptions,   setDivisionOptions]   = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);

  // Item grid visibility — hidden until first "Add New" click
  const [showItemGrid,  setShowItemGrid]  = useState(false);
  const queuedRowsRef = useRef([]);
  const [isAdding,    setIsAdding]    = useState(false);

  // Indent Details — rows for the currently selected item row (item-wise child grid)
  const [indentRows, setIndentRows] = useState([]);

  // Save state
  const [isSaving,    setIsSaving]    = useState(false);
  const [fetchError,  setFetchError]  = useState(null);

  // ── Page header ────────────────────────────────────────────────────
  usePageHeader({
    title:    'Purchase Inquiry',
    subtitle: 'Fill in the header fields, then click Add New to add item rows.',
    showBack: true,
    backTo:   '/',
  });

  // ── Fetch dropdown options on mount ──────────────────────────────
  useEffect(() => {
    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: 2,
      ObjName: 'Fn_tbl_FetchUserWsDivision',
      JSon:    JSON.stringify([{ prmUserID: 1, prmCompanyID: 1, prmYearID: 14 }]),
      p_ErrCode: -1,
      p_ErrMsg:  '',
    }).then((res) => {
      setDivisionOptions(
        (res?.Table || []).map((r) => ({ value: String(r.DivisionID), label: r.DivisionName }))
      );
    }).catch((err) => console.warn('[PI] Division fetch failed:', err));

    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: 1,
      ObjName: 'Pr_Fetch_DepartmentData_IMS',
      JSon:    JSON.stringify([{ PrmDeptID: 0 }]),
      p_ErrCode: -1,
      p_ErrMsg:  '',
    }).then((res) => {
      setDepartmentOptions(
        (res?.Table || []).map((r) => ({ value: String(r.DepartmentID), label: r.DepartmentName }))
      );
    }).catch((err) => console.warn('[PI] Department fetch failed:', err));

  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inject live dropdown options into filter definitions ──────────
  const piFilters = useMemo(() => PI_HEADER_FILTERS.map((f) => {
    switch (f.FilterParameterID) {
      case 'DivisionID':   return { ...f, staticOptions: divisionOptions };
      case 'DepartmentID': return { ...f, staticOptions: departmentOptions };
      default:             return f;
    }
  }), [divisionOptions, departmentOptions]);

  // ── Flush queued rows once item grid mounts ───────────────────────
  useEffect(() => {
    if (showItemGrid && itemGridRef.current && queuedRowsRef.current.length > 0) {
      queuedRowsRef.current.forEach((row) => itemGridRef.current.addRow(row));
      queuedRowsRef.current = [];
    }
  }, [showItemGrid]);

  // ── Item grid selection → drives Indent Details child grid ────────
  // Called by EntryGrid whenever checkbox selection changes.
  // Reads the actual selected rows via ref (same render cycle as the count update).
  // If exactly 1 row is checked → show that item's indent details.
  // Otherwise → clear the child grid.
  const handleItemSelectionChange = useCallback((count) => {
    if (count !== 1) {
      setIndentRows([]);
      return;
    }
    const selected = itemGridRef.current?.getSelectedRows?.() ?? [];
    if (selected.length !== 1) return;

    const item = selected[0];
    console.log('%c[PI] Indent Details: loading for item', 'color:#6366f1;font-weight:600', item);

    // TODO: fetch real indent details for item.ItemCode from API.
    // Shape must match INDENT_DETAILS_COLUMNS keys.
    // e.g. get(ENDPOINTS.FN_FETCH_DATA, { ObjName: 'Pr_Fetch_IndentDetailByItem', ... })
    setIndentRows([]); // cleared until API is wired
  }, []);

  // ── Callbacks ────────────────────────────────────────────────────
  const handleFilterChange = useCallback((colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };
  }, []);

  const handleAddNew = useCallback((_values) => {
    const row = blankItemRow();
    if (!showItemGrid) {
      queuedRowsRef.current.push(row);
      setShowItemGrid(true);
    } else {
      itemGridRef.current?.addRow(row);
    }
  }, [showItemGrid]);

  const handleIndentItem = useCallback((_values) => {
    console.log('[PI] Indent Item — wire up indent selection modal here.');
  }, []);

  const handleSave = useCallback(async () => {
    const selectedRows = itemGridRef.current?.getSelectedRows?.() ?? [];
    if (selectedRows.length === 0) {
      alert('No rows selected. Please check at least one item row to save.');
      return;
    }
    setIsSaving(true);
    try {
      // TODO: wire to RB_MasterDetailForm_Save with PI SaveProcName from backend
      console.log('%c[PI] Saving…', 'color:#f59e0b;font-weight:600', {
        header: headerValuesRef.current,
        rows:   selectedRows,
      });
      alert('Purchase Inquiry saved successfully!');
    } catch (err) {
      alert(err?.message || 'Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleSaveAndPrint = useCallback(async () => {
    await handleSave();
    window.print();
  }, [handleSave]);

  const handleCancel = useCallback(() => {
    if (!window.confirm('Discard changes and reset the form?')) return;
    headerValuesRef.current = {
      InquiryNo: '', InquiryDate: null, InquiryTypeID: 0, ExpectedDate: null,
      DivisionID: 0, IndentID: 0, DepartmentID: 0, BasedOn: '', Remark: '',
      CompanyID: 1, YearID: 13, LoginID: 1, IDNumber: 0,
    };
    queuedRowsRef.current = [];
    setShowItemGrid(false);
    setIndentRows([]);
  }, []);

  const handleClose    = useCallback(() => navigate('/'), [navigate]);
  const handleDocument = useCallback(() => {
    console.log('[PI] Document F6 — reserved for document generation.');
  }, []);

  const gridConfig = {
    columns:    PI_ITEM_COLUMNS,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="workspace-page pi-page">

      {/* 1. Header Panel */}
      <section className="workspace-page__filters">
        {fetchError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{fetchError}</span>
            <button type="button" onClick={() => setFetchError(null)}>Dismiss</button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            title="Purchase Inquiry Detail"
            staticFilters={piFilters}
            onSearch={handleAddNew}
            onOrderItem={handleIndentItem}
            orderItemLabel="Indent Item"
            OrderItemIcon={ShoppingBag}
            onFilterChange={handleFilterChange}
            isSearching={isAdding}
            actionLabel="Add New"
            ActionIcon={Plus}
          />
        )}
      </section>

      {/* 2. Item Detail Grid — shown after first "Add New" click */}
      {showItemGrid && (
        <section className="workspace-page__grid pi-page__grid">
          <EntryGrid
            ref={itemGridRef}
            config={gridConfig}
            title="Item Detail"
            onSave={handleSave}
            onSelectionChange={handleItemSelectionChange}
          />
        </section>
      )}

      {/* 3. Suppliers | Term And Conditions tab panel */}
      <section className="pi-page__section">
        <PIBottomTabPanel />
      </section>

      {/* 4. Indent Details — item-wise child grid.
             Rows populate automatically when exactly one item row is checked above. */}
      <section className="pi-page__section">
        <CollapsibleGrid
          title="Indent Details"
          subtitle="(Select one item row above to load its indent records)"
          columns={INDENT_DETAILS_COLUMNS}
          rows={indentRows}
        />
      </section>

      {/* 5. Action Bar */}
      <section className="pi-page__section">
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
