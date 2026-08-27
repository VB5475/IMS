// AssetPartIndentPage.jsx — Asset Part Indent (2026-08-25 /pm)
// Read-only two-grid browse page: Master grid (parts) on top, Detail grid
// (transactions) below. Both grids load their full dataset for the chosen
// Division/From/To Date up front; selecting a Master row filters the
// already-loaded Detail rows client-side by matching masteritemid AND
// detailitemid — neither fetch function takes a per-row filter parameter.
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { PackageSearch, Save } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import SearchSelect from "../../components/ui/SearchSelect";
import ActionBar from "../../components/ui/ActionBar";
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

function detailRowKey(row, index) {
  return `${masterRowKey(row)}-${index}`;
}

export default function AssetPartIndentPage() {
  const notify = useNotification();
  const { post: postSave } = useApi(API_BASE_URL_IMS);
  const { divisionOptions, optionsLoading, fetchOptions } = useReportFilterOptions();
  const { masterRows, detailRows, loading, error, fetchGrids } = useAssetPartIndent();

  const [filters, setFilters] = useState(buildDefaultFilters);
  const [selectedMasterKey, setSelectedMasterKey] = useState(null);
  const [selectedDetailKeys, setSelectedDetailKeys] = useState([]);
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
    setSelectedMasterKey(null);
    fetchGrids(filters);
  }, [filters, fetchGrids]);

  // Discards the current selection/filters and reloads the default view —
  // same "Cancel = discard" convention as every other transaction form.
  const handleCancel = useCallback(() => {
    const defaults = buildDefaultFilters();
    setFilters(defaults);
    setSelectedMasterKey(null);
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

  const selectedMasterRow = useMemo(
    () => masterRows.find((row) => masterRowKey(row) === selectedMasterKey) ?? null,
    [masterRows, selectedMasterKey]
  );

  // Empty until a Master row is picked (2026-08-25 /pm) — then narrow to the
  // detail rows that share BOTH its masteritemid and detailitemid, since
  // masteritemid alone is shared by every part line on the same indent.
  const filteredDetailRows = useMemo(() => {
    if (!selectedMasterRow) return [];
    const [masterField, detailField] = APIN_MASTER_KEY_FIELDS;
    const masterVal = String(resolveRowFieldValue(selectedMasterRow, masterField) ?? "");
    const detailVal = String(resolveRowFieldValue(selectedMasterRow, detailField) ?? "");
    return detailRows.filter(
      (row) =>
        String(resolveRowFieldValue(row, masterField) ?? "") === masterVal &&
        String(resolveRowFieldValue(row, detailField) ?? "") === detailVal
    );
  }, [detailRows, selectedMasterRow]);

  // Auto-select every matching row as soon as they're fetched/filtered
  // (2026-08-25 /pm) — the user picks a Master row to see what would be
  // included, then deselects anything they don't want before Save.
  useEffect(() => {
    setSelectedDetailKeys(filteredDetailRows.map((row, index) => detailRowKey(row, index)));
  }, [filteredDetailRows]);

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

    const keySet = new Set(selectedDetailKeys);
    const selectedRows = filteredDetailRows.filter((row, index) => keySet.has(detailRowKey(row, index)));

    const payload = withSaveContextFields(
      buildSaveJsonFields({ label: APIN_CONFIG.PAGE_TITLE, det: selectedRows }),
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
  }, [selectedDetailKeys, filteredDetailRows, filters.divisionId, postSave, notify, handleCancel]);

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
          <input
            type="date"
            className="apin-filter-input"
            value={filters.fromDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
          />
        </div>
        <div className="apin-filter-field">
          <span className="apin-filter-label">To Date</span>
          <input
            type="date"
            className="apin-filter-input"
            value={filters.toDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, toDate: e.target.value }))}
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
          singleSelect
          selectedRowKeys={selectedMasterKey != null ? [selectedMasterKey] : []}
          onSelectionChange={(keys) => setSelectedMasterKey(keys[0] ?? null)}
          getRowKey={(row) => masterRowKey(row)}
        />
      </section>

      <section className="apin-grid-section">
        <EnterpriseDataGrid
          title="Matching Transactions"
          columns={detailColumns}
          data={filteredDetailRows}
          loading={loading}
          error={null}
          loaderText="Loading transactions…"
          emptyMessage={
            selectedMasterRow
              ? "No matching transactions for the selected master item."
              : "Select a Master Item row above to see its matching transactions."
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
    </div>
  );
}
