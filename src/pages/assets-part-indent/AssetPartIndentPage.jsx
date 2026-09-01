// AssetPartIndentPage.jsx — Asset Part Indent (2026-08-25 /pm; multi-select
// Master Items 2026-08-29 /pm)
// Read-only two-grid browse page: Master grid (parts) on top, Detail grid
// (transactions) below. Both grids load their full dataset for the chosen
// Division/From/To Date up front; selecting one or more Master rows filters
// the already-loaded Detail rows client-side by matching masteritemid AND
// detailitemid against ANY selected Master row — neither fetch function
// takes a per-row filter parameter.
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { PackageSearch, Save, Eye } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import CollapsibleGrid from "../../components/grid/CollapsibleGrid";
import SearchSelect from "../../components/ui/SearchSelect";
import DateInput from "../../components/ui/DateInput";
import ActionBar from "../../components/ui/ActionBar";
import Modal from "../../components/ui/Modal";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useNotification } from "../../context/NotificationContext";
import { useApi } from "../../api/useApi";
import { API_BASE_URL_IMS } from "../../api/constants";
import { useAssetPartIndent } from "../../hooks/useAssetPartIndent";
import { useReportFilterOptions } from "../../hooks/useReportFilterOptions";
import { resolveRowFieldValue } from "../../utils/gridUtils";
import { buildListColumnsFromRows } from "../../utils/listGridUtils";
import { getTodayDateInputValue } from "../../utils/dateFormat";
import { getUserSession } from "../../session/userSession";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { APIN_CONFIG, APIN_MASTER_KEY_FIELDS } from "./constants";
import "./AssetPartIndentPage.css";

function buildDefaultFilters() {
  const yearFrom = getUserSession().year?.yearfrom;
  const fromDate = yearFrom ? new Date(yearFrom) : null;
  const toIso = (d) => {
    if (!d || Number.isNaN(d.getTime())) return getTodayDateInputValue();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return {
    divisionId: "",
    fromDate: toIso(fromDate),
    toDate: getTodayDateInputValue(),
  };
}

function masterRowKey(row) {
  const [masterField, detailField] = APIN_MASTER_KEY_FIELDS;
  return `${resolveRowFieldValue(row, masterField) ?? ""}-${resolveRowFieldValue(row, detailField) ?? ""}`;
}

// Human-readable label for grouping the Preview Selection panel — same two
// columns shown in the Master Items grid itself.
function masterRowLabel(row) {
  const item = resolveRowFieldValue(row, "Asset Item Name") ?? "";
  const material = resolveRowFieldValue(row, "Part Material") ?? "";
  return [item, material].filter(Boolean).join(" — ") || "—";
}

// 2026-08-29 /pm — was `${masterRowKey(row)}-${index}`. `index` came from
// whatever array .map() happened to run over — filteredDetailRows (the full
// set) in this page, but EnterpriseDataGrid computes its own row keys from
// currentData (the already-paginated slice, index always restarting at 0
// per page). Same logical row got two different keys depending on which of
// those computed it, so selection silently failed to carry over past page 1
// the moment there were enough matches to paginate — real bug, not just a
// "does select-all span every page" question. trandetid (confirmed on every
// live row) is a real per-row id and stays identical no matter which array
// or page a row is read from; index is now only a last-resort fallback.
function detailRowKey(row, index) {
  const trandetid = resolveRowFieldValue(row, "trandetid");
  if (trandetid != null && trandetid !== "") return `trandetid-${trandetid}`;
  return `${masterRowKey(row)}-${index}`;
}

export default function AssetPartIndentPage() {
  const notify = useNotification();
  const { post: postSave } = useApi(API_BASE_URL_IMS);
  const { divisionOptions, optionsLoading, fetchOptions } = useReportFilterOptions();
  const { masterRows, detailRows, loading, error, fetchGrids } = useAssetPartIndent();

  const [filters, setFilters] = useState(buildDefaultFilters);
  const [selectedMasterKeys, setSelectedMasterKeys] = useState([]);
  const [selectedDetailKeys, setSelectedDetailKeys] = useState([]);
  // Detail row keys ever shown on this page since the last fresh Search —
  // see the sticky auto-select effect below.
  const seenDetailKeysRef = useRef(new Set());
  const [isSaving, setIsSaving] = useState(false);

  usePageHeader({
    title: "Asset Part Indent",
    subtitle: "Browse asset part items and their matching transactions.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const handleSearch = useCallback(() => {
    setSelectedMasterKeys([]);
    seenDetailKeysRef.current = new Set();
    fetchGrids(filters);
  }, [filters, fetchGrids]);

  // Discards the current selection/filters and reloads the default view —
  // same "Cancel = discard" convention as every other transaction form.
  const handleCancel = useCallback(() => {
    const defaults = buildDefaultFilters();
    setFilters(defaults);
    setSelectedMasterKeys([]);
    seenDetailKeysRef.current = new Set();
    fetchGrids(defaults);
  }, [fetchGrids]);

  // Load once on mount with the default filters, same as every other list page.
  useEffect(() => {
    fetchGrids(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MasterItemID/DetailItemID drive the match logic but stay hidden from
  // both grids — 2026-08-25 /pm.
  const isHiddenKeyColumn = useCallback((col) => {
    const lower = String(col.key ?? "").toLowerCase();
    return APIN_MASTER_KEY_FIELDS.includes(lower);
  }, []);

  // Both grids here have very few data columns, which starves the checkbox
  // column of its declared 40px under the shared grid's fixed table-layout —
  // with no "auto" column left to absorb the table's forced 100% width, the
  // layout algorithm has nowhere else to redistribute the remainder into.
  // Giving every data column an explicit, even share of "the rest" removes
  // that ambiguity so the checkbox column's 40px actually holds.
  const withEvenWidths = useCallback((cols) => {
    if (cols.length === 0) return cols;
    const width = `calc((100% - 40px) / ${cols.length})`;
    return cols.map((col) => ({ ...col, width }));
  }, []);

  const masterColumns = useMemo(
    () => withEvenWidths(buildListColumnsFromRows(masterRows).filter((col) => !isHiddenKeyColumn(col))),
    [masterRows, isHiddenKeyColumn, withEvenWidths]
  );
  const detailColumns = useMemo(
    () => withEvenWidths(buildListColumnsFromRows(detailRows).filter((col) => !isHiddenKeyColumn(col))),
    [detailRows, isHiddenKeyColumn, withEvenWidths]
  );

  // Multi-select (2026-08-29 /pm) — Master Items allows selecting more than
  // one row; Detail is filtered to whatever matches ANY of them.
  const selectedMasterKeySet = useMemo(() => new Set(selectedMasterKeys), [selectedMasterKeys]);
  const selectedMasterRows = useMemo(
    () => masterRows.filter((row) => selectedMasterKeySet.has(masterRowKey(row))),
    [masterRows, selectedMasterKeySet]
  );

  // Empty until at least one Master row is picked — then narrow to the detail
  // rows that share BOTH its masteritemid and detailitemid (masteritemid
  // alone is shared by every part line on the same indent), unioned across
  // every currently-selected Master row.
  const filteredDetailRows = useMemo(() => {
    if (selectedMasterRows.length === 0) return [];
    const [masterField, detailField] = APIN_MASTER_KEY_FIELDS;
    const selectedPairs = selectedMasterRows.map((row) => ({
      masterVal: String(resolveRowFieldValue(row, masterField) ?? ""),
      detailVal: String(resolveRowFieldValue(row, detailField) ?? ""),
    }));
    return detailRows.filter((row) => {
      const rowMasterVal = String(resolveRowFieldValue(row, masterField) ?? "");
      const rowDetailVal = String(resolveRowFieldValue(row, detailField) ?? "");
      return selectedPairs.some(
        (pair) => pair.masterVal === rowMasterVal && pair.detailVal === rowDetailVal
      );
    });
  }, [detailRows, selectedMasterRows]);

  // Auto-select every matching row the first time it's ever seen (2026-08-25
  // /pm) — the user picks a Master row to see what would be included, then
  // deselects anything they don't want before Save.
  //
  // 2026-08-29 /pm — made additive/sticky. Originally this just replaced the
  // whole selection with "everything currently in filteredDetailRows" on
  // every recompute, which was fine for a single Master row but broke the
  // moment Master Items got multi-select: picking a SECOND Master row
  // recomputes filteredDetailRows into a bigger array, and this effect would
  // re-select the FIRST Master row's rows too — silently undoing whatever
  // the user had already manually deselected for it. seenDetailKeysRef
  // tracks every row key this page has shown at least once (reset on a
  // fresh Search/Cancel); a key seen for the first time still auto-selects,
  // but a key seen before keeps whatever the user last set it to, even if it
  // temporarily left and re-entered filteredDetailRows via Master-item
  // toggling.
  useEffect(() => {
    const currentKeys = filteredDetailRows.map((row, index) => detailRowKey(row, index));
    // Classify each key as "already seen" vs "brand new" against a frozen
    // snapshot BEFORE touching the ref, then mutate the ref. setSelectedDetailKeys'
    // updater below can run asynchronously (React doesn't guarantee it executes
    // before this effect body finishes) — reading the *live* ref from inside
    // that updater meant it could see keys as "already seen" that this very
    // effect pass had only just marked as seen moments earlier via the
    // forEach, making every row look pre-existing and none get auto-selected.
    const alreadySeen = new Set(currentKeys.filter((key) => seenDetailKeysRef.current.has(key)));
    currentKeys.forEach((key) => seenDetailKeysRef.current.add(key));

    setSelectedDetailKeys((prev) => {
      const prevSet = new Set(prev);
      return currentKeys.filter((key) => (alreadySeen.has(key) ? prevSet.has(key) : true));
    });
  }, [filteredDetailRows]);

  // 2026-08-29 /pm — EnterpriseDataGrid's own header checkbox is
  // deliberately page-scoped ("Select all rows on this page", shared across
  // every list page in the app that uses it — not something to change
  // globally for this one module). These two operate on the full,
  // unpaginated filteredDetailRows instead, so re-selecting everything after
  // manually deselecting some rows can't silently drop rows sitting on a
  // page the user isn't currently viewing.
  const handleSelectAllDetail = useCallback(() => {
    setSelectedDetailKeys(filteredDetailRows.map((row, index) => detailRowKey(row, index)));
  }, [filteredDetailRows]);

  const handleClearDetailSelection = useCallback(() => {
    setSelectedDetailKeys([]);
  }, []);

  // Single source of truth for "what will actually be saved" — used by both
  // handleSave and the Preview Selection panel below, so the preview can
  // never show something different from what Save actually sends.
  const selectedDetailRows = useMemo(() => {
    const keySet = new Set(selectedDetailKeys);
    return filteredDetailRows.filter((row, index) => keySet.has(detailRowKey(row, index)));
  }, [filteredDetailRows, selectedDetailKeys]);

  // 2026-08-29 /pm — optional "Preview Selection" panel. Purely informational:
  // groups the currently-selected rows by their Master item so it's easy to
  // eyeball "1 from Chair Handle, 2 from Chair Wheel, ..." before Save.
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewGroups = useMemo(() => {
    const groups = new Map();
    selectedDetailRows.forEach((row) => {
      const key = masterRowKey(row);
      if (!groups.has(key)) {
        const masterRow = selectedMasterRows.find((m) => masterRowKey(m) === key);
        groups.set(key, { label: masterRow ? masterRowLabel(masterRow) : key, rows: [] });
      }
      groups.get(key).rows.push(row);
    });
    return Array.from(groups.values());
  }, [selectedDetailRows, selectedMasterRows]);

  // Posts only the checked (2026-08-25 /pm) Detail rows — prmStrDetJSON is
  // "selected rows array objects" per the user's own API spec, not the full
  // filtered set. Division comes from the filter bar's own selection, same
  // value the grids were just loaded with.
  const handleSave = useCallback(async () => {
    if (selectedDetailKeys.length === 0) {
      notify.error("Select at least one transaction row before saving.");
      return;
    }
    const divisionId = Number(filters.divisionId) || 0;
    if (!divisionId) {
      notify.error("Select a Division before saving.");
      return;
    }

    const payload = withSaveContextFields(
      buildSaveJsonFields({ label: APIN_CONFIG.PAGE_TITLE, det: selectedDetailRows }),
      { divisionId, isEdit: false }
    );

    setIsSaving(true);
    try {
      const result = await postSave(APIN_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        notify.error(message);
        return;
      }
      notify.success(message || "Asset Part Indent saved successfully.");
      handleCancel();
    } catch (err) {
      console.error("[AssetPartIndent] Save failed:", err);
      notify.error(err?.message || "Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [selectedDetailKeys, selectedDetailRows, filters.divisionId, postSave, notify, handleCancel]);

  return (
    <div className="workspace-page apin-page">
      <section className="apin-filter-bar">
        <div className="apin-filter-field">
          <span className="apin-filter-label">Division</span>
          <SearchSelect
            value={filters.divisionId}
            onChange={(val) => setFilters((prev) => ({ ...prev, divisionId: val }))}
            options={divisionOptions}
            placeholder={optionsLoading ? "Loading…" : "All divisions"}
            disabled={optionsLoading}
          />
        </div>
        <div className="apin-filter-field">
          <span className="apin-filter-label">From Date</span>
          <DateInput
            className="apin-filter-input"
            value={filters.fromDate}
            onChange={(next) => setFilters((prev) => ({ ...prev, fromDate: next }))}
            aria-label="From Date"
          />
        </div>
        <div className="apin-filter-field">
          <span className="apin-filter-label">To Date</span>
          <DateInput
            className="apin-filter-input"
            value={filters.toDate}
            onChange={(next) => setFilters((prev) => ({ ...prev, toDate: next }))}
            aria-label="To Date"
          />
        </div>
        <button type="button" className="apin-search-btn" onClick={handleSearch} disabled={loading}>
          {loading ? "Loading…" : "Search"}
        </button>
      </section>

      {error && <div className="apin-error">{error}</div>}

      <section className="apin-grid-section">
        <EnterpriseDataGrid
          title="Master Items"
          icon={<PackageSearch size={16} strokeWidth={2} />}
          columns={masterColumns}
          data={masterRows}
          loading={loading}
          error={null}
          loaderText="Loading master items…"
          emptyMessage="No Asset Part master items found for the selected filters."
          selectable
          selectedRowKeys={selectedMasterKeys}
          onSelectionChange={setSelectedMasterKeys}
          getRowKey={(row) => masterRowKey(row)}
        />
      </section>

      <section className="apin-grid-section">
        <div className="apin-selection-toolbar">
          <span className="apin-selection-toolbar__count">
            {selectedDetailKeys.length} of {filteredDetailRows.length} transaction{filteredDetailRows.length !== 1 ? "s" : ""} selected
          </span>
          <div className="apin-selection-toolbar__actions">
            <button
              type="button"
              className="apin-selection-toolbar__btn"
              onClick={handleSelectAllDetail}
              disabled={filteredDetailRows.length === 0 || selectedDetailKeys.length === filteredDetailRows.length}
            >
              Select All
            </button>
            <button
              type="button"
              className="apin-selection-toolbar__btn"
              onClick={handleClearDetailSelection}
              disabled={selectedDetailKeys.length === 0}
            >
              Clear Selection
            </button>
            <button
              type="button"
              className="apin-selection-toolbar__btn apin-selection-toolbar__btn--preview"
              onClick={() => setPreviewOpen(true)}
              disabled={selectedDetailKeys.length === 0}
              title="Preview exactly what will be saved"
            >
              <Eye size={12} strokeWidth={2} />
              Preview Selection
            </button>
          </div>
        </div>
        <EnterpriseDataGrid
          title="Matching Transactions"
          columns={detailColumns}
          data={filteredDetailRows}
          loading={loading}
          error={null}
          loaderText="Loading transactions…"
          emptyMessage={
            selectedMasterRows.length > 0
              ? "No matching transactions for the selected master item(s)."
              : "Select one or more Master Item rows above to see their matching transactions."
          }
          selectable
          selectedRowKeys={selectedDetailKeys}
          onSelectionChange={setSelectedDetailKeys}
          getRowKey={detailRowKey}
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

      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Preview Selection"
        subtitle={`${selectedDetailRows.length} transaction${selectedDetailRows.length !== 1 ? "s" : ""} across ${previewGroups.length} master item${previewGroups.length !== 1 ? "s" : ""} will be saved`}
        icon={<Eye size={16} strokeWidth={2} />}
        size="lg"
      >
        <div className="apin-preview">
          {previewGroups.map((group) => (
            <CollapsibleGrid
              key={group.label}
              title={group.label}
              recordLabel="row"
              columns={detailColumns}
              rows={group.rows}
              readOnly
              hideBottomPanel
              hidePagination
            />
          ))}
        </div>
      </Modal>
    </div>
  );
}
