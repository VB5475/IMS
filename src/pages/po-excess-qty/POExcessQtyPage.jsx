// POExcessQtyPage.jsx — PO Excess Qty (2026-09-07 /pm)
// Sibling of POShortCloseQtyPage.jsx — identical architecture, see that
// file's header comment for the full rationale (RB-driven EntryGrid
// columns, required Division+Supplier filters with no auto-load, ActionBar
// + Save, single-option auto-select on both dropdowns).
//
// 2026-09-08 /tl — Save endpoint confirmed by the user
// (API/POExcess/Post_RB_POExcessQty_Save) and wired, then narrowed to
// selected-rows-only: buildGridColumns already prepends the "cb" checkbox
// column (see gridUtils.js), it was just inert because of the EntryGrid's
// disableSelection prop below. Removed that + read the checked rows at Save
// time via the grid ref's getSelectedRows() — the same pattern ~40 other
// forms in this app use to pull a grid's current selection (see e.g.
// AssetsWriteOffForm.jsx's handleDeleteSelected) — rather than mirroring
// every row through onRowsChange, since getSelectedRows() already reads the
// grid's own live (edited) row state filtered to what's checked.
import React, { useState, useCallback, useEffect, useRef } from "react";
import { Search as SearchIcon, Save } from "lucide-react";
import EntryGrid from "../../components/grid/EntryGrid";
import SearchSelect from "../../components/ui/SearchSelect";
import ActionBar from "../../components/ui/ActionBar";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useNotification } from "../../context/NotificationContext";
import { usePOExcessQty } from "../../hooks/usePOExcessQty";
import { POEQ_CONFIG } from "./constants";
import "./POExcessQtyPage.css";

export default function POExcessQtyPage() {
  const notify = useNotification();
  const {
    divisionOptions, isLoadingDivisions, fetchDivisionOptions,
    supplierOptions, isLoadingSuppliers, fetchSupplierOptions,
    columns, columnsLoading, columnsError, fetchGridColumns,
    rows, loading, error, fetchDetails, resetDetails,
    saveRows, isSaving,
  } = usePOExcessQty();

  const [divisionId, setDivisionId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [searchToken, setSearchToken] = useState(0);
  const gridRef = useRef(null);

  usePageHeader({
    title: POEQ_CONFIG.PAGE_TITLE,
    subtitle: "Browse PO excess quantity by Division and Supplier.",
  });

  useEffect(() => {
    fetchDivisionOptions();
    fetchGridColumns();
  }, [fetchDivisionOptions, fetchGridColumns]);

  const handleDivisionChange = useCallback((val) => {
    setDivisionId(val);
    setSupplierId("");
    resetDetails();
    setSearchToken((t) => t + 1);
    setHasSearched(false);
    fetchSupplierOptions(val);
  }, [fetchSupplierOptions, resetDetails]);

  useEffect(() => {
    if (divisionId || divisionOptions.length !== 1) return;
    handleDivisionChange(divisionOptions[0].value);
  }, [divisionOptions, divisionId, handleDivisionChange]);

  useEffect(() => {
    if (supplierId || supplierOptions.length !== 1) return;
    setSupplierId(supplierOptions[0].value);
  }, [supplierOptions, supplierId]);

  const handleSearch = useCallback(() => {
    if (!divisionId) {
      notify.error("Select a Division before searching.");
      return;
    }
    if (!supplierId) {
      notify.error("Select a Supplier before searching.");
      return;
    }
    resetDetails();
    setSearchToken((t) => t + 1);
    setHasSearched(true);
    fetchDetails({ divisionId, supplierId });
  }, [divisionId, supplierId, fetchDetails, resetDetails, notify]);

  const handleCancel = useCallback(() => {
    setDivisionId("");
    setSupplierId("");
    resetDetails();
    setSearchToken((t) => t + 1);
    setHasSearched(false);
    fetchDivisionOptions();
  }, [resetDetails, fetchDivisionOptions]);

  const handleSave = useCallback(async () => {
    const selectedRows = gridRef.current?.getSelectedRows?.() ?? [];
    if (selectedRows.length === 0) {
      notify.error("Select at least one row to save.");
      return;
    }
    try {
      const { message } = await saveRows(selectedRows, { divisionId });
      notify.success(message || "PO excess qty saved.");
      fetchDetails({ divisionId, supplierId });
    } catch (err) {
      notify.error(err?.message || "Couldn't save. Try again.");
    }
  }, [saveRows, divisionId, supplierId, fetchDetails, notify]);

  return (
    <div className="workspace-page poeq-page">
      <section className="poeq-filter-bar">
        <div className="poeq-filter-field">
          <span className="poeq-filter-label">Division</span>
          <SearchSelect
            value={divisionId}
            onChange={handleDivisionChange}
            options={divisionOptions}
            placeholder={isLoadingDivisions ? "Loading…" : "Select division"}
            disabled={isLoadingDivisions}
          />
        </div>
        <div className="poeq-filter-field">
          <span className="poeq-filter-label">Supplier</span>
          <SearchSelect
            value={supplierId}
            onChange={setSupplierId}
            options={supplierOptions}
            placeholder={!divisionId ? "Select division first" : isLoadingSuppliers ? "Loading…" : "Select supplier"}
            disabled={!divisionId || isLoadingSuppliers}
          />
        </div>
        <button type="button" className="poeq-search-btn" onClick={handleSearch} disabled={loading}>
          <SearchIcon size={14} strokeWidth={2} />
          {loading ? "Loading…" : "Search"}
        </button>
      </section>

      {(error || columnsError) && <div className="poeq-error">{error || columnsError}</div>}

      <section className="poeq-grid-section">
        <EntryGrid
          ref={gridRef}
          key={searchToken}
          title="PO Excess Qty"
          config={{ columns }}
          initialRows={rows}
          readOnly={false}
          hideBottomPanel
          loading={loading || columnsLoading}
          loaderText={columnsLoading ? "Loading grid columns…" : "Loading PO excess qty…"}
          emptyMessage={
            hasSearched
              ? "No PO excess qty found for the selected Division and Supplier."
              : "Select a Division and Supplier, then click Search."
          }
        />
      </section>

      <ActionBar
        alignEnd
        showAddCancel
        isEditMode
        onCancel={handleCancel}
        cancelLabel="Cancel"
        extraButtons={[
          {
            key: "save",
            label: isSaving ? "Saving…" : "Save",
            Icon: Save,
            variant: "save",
            onClick: handleSave,
            disabled: isSaving,
            loading: isSaving,
            showAlways: true,
            accessKey: "s",
          },
        ]}
      />
    </div>
  );
}
