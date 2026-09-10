// POShortCloseQtyPage.jsx — PO Short Close Qty (2026-09-07 /pm)
// Division + Supplier filters (Supplier cascades off Division, same as
// GRN/PO), Search fetches fn_tbl_rb_poshortcloseqty server-side (real filter
// params, not a client-side match like Asset Part Indent). No auto-load on
// mount — both filters are required params on the Get Details call, so
// loading before they're picked would be meaningless.
//
// Get Details grid is EntryGrid (2026-09-07 /pm correction), columns driven
// by the RB pipeline (RB_POShortCloseQty -> GetDetailColData), not inferred
// from row keys. readOnly is left false so the grid respects each column's
// real iseditallow flag from the RB instead of locking everything — per
// RBID 20263's live-checked metadata only "Short Close Qty." comes back
// editable, every other column is locked, with no bespoke per-column logic
// needed. hideBottomPanel stays true — the grid's own Save/Export toolbar
// isn't used; Save lives in the page's ActionBar instead (below), same
// split every other transaction form in this app uses.
//
// ActionBar + Save (2026-09-08 /tl) — isEditMode permanently true (no
// separate Add-mode concept on this page). Save endpoint confirmed by the
// user (API/POShortclose/Post_RB_POShortcloseQty_Save, see constants.js),
// then narrowed to selected-rows-only: buildGridColumns already prepends
// the "cb" checkbox column (gridUtils.js), it was just inert because of the
// EntryGrid's disableSelection prop below. Removed that + read the checked
// rows at Save time via the grid ref's getSelectedRows() — the same pattern
// ~40 other forms in this app use to pull a grid's current selection (see
// e.g. AssetsWriteOffForm.jsx's handleDeleteSelected) — rather than
// mirroring every row through onRowsChange, since getSelectedRows() already
// reads the grid's own live (edited) row state filtered to what's checked.
//
// Single-option auto-select (2026-09-07 /pm) — Division and Supplier each
// auto-fill when their own options resolve to exactly one row, mirroring
// the project's established single-option auto-select convention (see
// EnterpriseFilterPanel's rollout / DocLog's Doc Type auto-select). This
// page hand-rolls its own two-field filter bar rather than going through
// EnterpriseFilterPanel, so it gets its own small effect instead of pulling
// in that component's full RB-driven filter-table machinery.
import React, { useState, useCallback, useEffect, useRef } from "react";
import { Search as SearchIcon, Save } from "lucide-react";
import EntryGrid from "../../components/grid/EntryGrid";
import SearchSelect from "../../components/ui/SearchSelect";
import ActionBar from "../../components/ui/ActionBar";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useNotification } from "../../context/NotificationContext";
import { usePOShortCloseQty } from "../../hooks/usePOShortCloseQty";
import { POSCQ_CONFIG } from "./constants";
import "./POShortCloseQtyPage.css";

export default function POShortCloseQtyPage() {
  const notify = useNotification();
  const {
    divisionOptions, isLoadingDivisions, fetchDivisionOptions,
    supplierOptions, isLoadingSuppliers, fetchSupplierOptions,
    columns, columnsLoading, columnsError, fetchGridColumns,
    rows, loading, error, fetchDetails, resetDetails,
    saveRows, isSaving,
  } = usePOShortCloseQty();

  const [divisionId, setDivisionId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const gridRef = useRef(null);
  // EntryGrid only re-syncs its internal rows from `initialRows` when that
  // array is non-empty (see its own "Load initialRows" effect) — a search
  // that goes from some rows to zero would otherwise leave the previous
  // search's rows on screen. Keying the grid on a per-search token forces a
  // clean remount every time, so an empty result actually clears the grid.
  const [searchToken, setSearchToken] = useState(0);

  usePageHeader({
    title: POSCQ_CONFIG.PAGE_TITLE,
    subtitle: "Browse PO short-close quantity by Division and Supplier.",
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

  // Auto-fill Division the moment its options resolve to exactly one row —
  // re-fires after Cancel too, since handleCancel re-fetches divisionOptions
  // (a fresh array reference) rather than just clearing local state.
  useEffect(() => {
    if (divisionId || divisionOptions.length !== 1) return;
    handleDivisionChange(divisionOptions[0].value);
  }, [divisionOptions, divisionId, handleDivisionChange]);

  // Same for Supplier — fires once Division's cascade resolves its list.
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
    // Clear before fetching (not after) — EntryGrid's own remount needs to
    // see an empty `rows` prop at mount time; remounting first and clearing
    // second would hand the fresh instance a stale non-empty array.
    resetDetails();
    setSearchToken((t) => t + 1);
    setHasSearched(true);
    fetchDetails({ divisionId, supplierId });
  }, [divisionId, supplierId, fetchDetails, resetDetails, notify]);

  // Discard current filters/results and reload — same "Cancel = discard and
  // reload defaults" convention as every other transaction form. Re-running
  // fetchDivisionOptions (not just clearing local state) gives the
  // single-option auto-select effect above a fresh array reference to react
  // to, so Cancel correctly re-auto-fills a single-option Division again.
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
      notify.success(message || "PO short close qty saved.");
      fetchDetails({ divisionId, supplierId });
    } catch (err) {
      notify.error(err?.message || "Couldn't save. Try again.");
    }
  }, [saveRows, divisionId, supplierId, fetchDetails, notify]);

  return (
    <div className="workspace-page posq-page">
      <section className="posq-filter-bar">
        <div className="posq-filter-field">
          <span className="posq-filter-label">Division</span>
          <SearchSelect
            value={divisionId}
            onChange={handleDivisionChange}
            options={divisionOptions}
            placeholder={isLoadingDivisions ? "Loading…" : "Select division"}
            disabled={isLoadingDivisions}
          />
        </div>
        <div className="posq-filter-field">
          <span className="posq-filter-label">Supplier</span>
          <SearchSelect
            value={supplierId}
            onChange={setSupplierId}
            options={supplierOptions}
            placeholder={!divisionId ? "Select division first" : isLoadingSuppliers ? "Loading…" : "Select supplier"}
            disabled={!divisionId || isLoadingSuppliers}
          />
        </div>
        <button type="button" className="posq-search-btn" onClick={handleSearch} disabled={loading}>
          <SearchIcon size={14} strokeWidth={2} />
          {loading ? "Loading…" : "Search"}
        </button>
      </section>

      {(error || columnsError) && <div className="posq-error">{error || columnsError}</div>}

      <section className="posq-grid-section">
        <EntryGrid
          ref={gridRef}
          key={searchToken}
          title="PO Short Close Qty"
          config={{ columns }}
          initialRows={rows}
          readOnly={false}
          hideBottomPanel
          loading={loading || columnsLoading}
          loaderText={columnsLoading ? "Loading grid columns…" : "Loading PO short close qty…"}
          emptyMessage={
            hasSearched
              ? "No PO short close qty found for the selected Division and Supplier."
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
