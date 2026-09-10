// AssetPartIndentPage.jsx — Asset Part Indent
// Two tabs sharing one filter bar (Division/From/To Date) and one Search —
// Export to Excel is NOT shared though: each tab has its own Export button,
// right above that tab's own content, exporting only that tab's data.
//  - "Date Range Report" (default) — the original three read-only grids
//    (Matching Transactions, Master Items, Location Part Count), side by
//    side. No row selection, no cross-grid filtering, no preview. Save posts
//    the full currently-loaded Matching Transactions dataset — this is the
//    only tab with a Save/Cancel action bar, since it's the only one backed
//    by an actual indent-save flow; the other tab is a pure report view.
//  - "QTY & Rate" (2026-09-09 /pm) — fn_tbl_AstDateGroupWsPartDetail, same
//    5-param filter contract as the other SPs, but rendered and exported
//    grouped by date per the reference the user shared: one small table per
//    date (Sr No/Particular/Quantity/Rate/Amount, "Total :" row summing
//    Quantity/Amount), stacked top to bottom — not one flat grid.
//  - "Per chair Repairing Cost" (2026-09-10 /pm, new) — a single flat grid
//    over fn_tbl_AstDatePerAssetRepairingCost (SrNo/PO Date/PO Month/Asset
//    Count/Total Cost/Per Asset Repairing Cost — confirmed live), with an
//    "Overall TOTAL :" row (Asset Count and Total Cost summed, Per Asset
//    Repairing Cost re-derived as Total Cost/Asset Count rather than summed
//    — same average-not-sum pattern as Location Part Count's Average Rate).
//    The reference the user shared also has Actual/Utilized/Balance Budget
//    columns; this SP does not return them at all (confirmed live) — a
//    separate budget-tracking source this fetch has no access to, not
//    something left out by mistake, so they are not in the list or export.
// Master Items carries one highlighted trailing row (on-screen and in the
// Excel export) — Total Qty/Total Amount. Location Part Count carries two
// highlighted trailing rows — Total Count/Total Amount, then Average Rate
// (= Total Amount / Total Count) on the row below.
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { PackageSearch, Save, Download } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import SearchSelect from "../../components/ui/SearchSelect";
import DateInput from "../../components/ui/DateInput";
import ActionBar from "../../components/ui/ActionBar";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useNotification } from "../../context/NotificationContext";
import { useApi } from "../../api/useApi";
import { API_BASE_URL_IMS } from "../../api/constants";
import { useAssetPartIndent } from "../../hooks/useAssetPartIndent";
import { useReportFilterOptions } from "../../hooks/useReportFilterOptions";
import { resolveRowFieldValue } from "../../utils/gridUtils";
import { buildListColumnsFromRows } from "../../utils/listGridUtils";
import { getTodayDateInputValue, parseFlexibleDate } from "../../utils/dateFormat";
import { getUserSession } from "../../session/userSession";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { exportSideBySideTablesToExcel, exportStackedTablesToExcel } from "../../utils/excelExport";
import { APIN_CONFIG } from "./constants";
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

// EnterpriseDataGrid's own CSS reserves height for a fixed 10 rows by
// default (--ng-max-rows), regardless of how many rows actually exist — the
// right default for a normal full-width list page, but it's exactly what
// left blank space below short grids once three of them share one row
// here. The variable is documented as overridable via inline style and
// inherits down through the DOM, so setting it per-section (sized to that
// grid's own row count, floored at 1 and capped at 10 to match the default
// page size) makes each box hug its actual content instead.
function gridRowStyle(rowCount) {
  return { "--ng-max-rows": Math.min(Math.max(rowCount, 1), 10) };
}

// Excel export needs plain objects keyed by column.key (raw property access,
// same contract as csvExport.js's buildCsvContent) — this page's own columns
// come from dynamic API data with mixed-case field names, so every read goes
// through resolveRowFieldValue rather than direct property access. Carries
// __isSummaryRow through as __isTotal so exportSideBySideTablesToExcel bold-
// renders it — without this, a Total/Average Rate row that's highlighted
// on-screen would come out as a plain unbolded row in the export.
function resolveRowByColumns(row, columns) {
  const out = {};
  columns.forEach((c) => { out[c.key] = resolveRowFieldValue(row, c.key) ?? ""; });
  if (row.__isSummaryRow) out.__isTotal = true;
  return out;
}

// 2026-09-10 /pm — every grid on this page only, per request: plain display
// tables, no per-column sort/filter. buildListColumnsFromRows defaults every
// column to filterable:true (and sortable is on unless explicitly false), so
// this strips both back off rather than touching that shared default — scoped
// to Asset Part Indent's own column-building, not the shared column builder
// or any other list page.
function stripGridInteractivity(columns) {
  return columns.map((c) => ({ ...c, filterable: false, sortable: false }));
}

const TABS = [
  { key: "dateRange", label: "Date Range Report" },
  { key: "dateGroup", label: "Date Wise Part Summary" },
  { key: "perChairCost", label: "Per Asset Repairing Cost" },
];

// "25-04-2025" — matches the reference's numeric dd-mm-yyyy group headers,
// not this app's usual dd-Mon-yyyy list-date display.
function formatGroupDateLabel(value) {
  const d = value instanceof Date ? value : parseFlexibleDate(value);
  if (!d || Number.isNaN(d.getTime())) return String(value ?? "");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export default function AssetPartIndentPage() {
  const notify = useNotification();
  const { post: postSave } = useApi(API_BASE_URL_IMS);
  const { divisionOptions, optionsLoading, fetchOptions } = useReportFilterOptions();
  const {
    masterRows,
    detailRows,
    locCountRows,
    dateGroupRows,
    perChairCostRows,
    loading,
    error,
    fetchGrids,
  } = useAssetPartIndent();

  const [filters, setFilters] = useState(buildDefaultFilters);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(TABS[0].key);

  usePageHeader({
    title: "Asset Part Indent",
    subtitle: "Browse asset part items, their matching transactions, and location-wise part counts.",
  });

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const handleSearch = useCallback(() => {
    fetchGrids(filters);
  }, [filters, fetchGrids]);

  // Discards the current filters and reloads the default view — same
  // "Cancel = discard" convention as every other transaction form.
  const handleCancel = useCallback(() => {
    const defaults = buildDefaultFilters();
    setFilters(defaults);
    fetchGrids(defaults);
  }, [fetchGrids]);

  // Load once on mount with the default filters, same as every other list page.
  useEffect(() => {
    fetchGrids(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // buildListColumnsFromRows infers a per-column minWidth (e.g. 110px for
  // Rate/QTY/Amount, but 140-200px for text columns) sized for this app's
  // normal full-width list pages — EnterpriseDataGrid applies minWidth as a
  // real CSS min-width, which wins over any smaller `width` we set, so three
  // grids crammed into one row would overflow into horizontal scroll no
  // matter what `width` says. And even that generic 100-120px guess is too
  // generous once several narrow columns share one cramped grid (e.g. Sr No
  // + Rate + QTY + Amount already sums past a ~440px column on its own) —
  // so narrow columns are instead sized to their own actual longest value
  // (header included). Remaining (text) columns split whatever width is
  // left equally, via `min(equal share, that column's own content-fit
  // width)` — a lone wide column (e.g. Master's Particular) is capped at
  // what its own values actually need instead of consuming 100% of
  // whatever's left over, while a grid with several genuinely-wide text
  // columns (e.g. Matching Transactions) still gets the full equal share it
  // needs to avoid horizontal scroll, since the content-fit cap only bites
  // when it's smaller than the share.
  const NARROW_COLUMN_MAX_WIDTH = 130;
  // Deliberately low — this is only a floor against a column collapsing to
  // 0, not a "comfortable" width. A higher floor risks the exact bug this
  // whole function exists to avoid: EnterpriseDataGrid applies minWidth as
  // real CSS min-width, so a floor bigger than a cramped grid's own
  // equal-share calc silently overrides that calc back upward — confirmed
  // live at 70px, which clamped every wide column up just enough to
  // reintroduce a few px of horizontal overflow.
  const FLEX_COLUMN_MIN_WIDTH = 36;
  const measureContentWidth = useCallback((col, rows) => {
    let maxLen = String(col.label ?? col.key).length;
    rows.forEach((row) => {
      const val = resolveRowFieldValue(row, col.key);
      if (val != null && val !== "") {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    });
    return Math.min(Math.max(maxLen * 8 + 28, 56), 260);
  }, []);
  const withFitWidths = useCallback((cols, rows) => {
    if (cols.length === 0) return cols;
    const isNarrow = (col) => (col.minWidth ?? 140) <= NARROW_COLUMN_MAX_WIDTH;
    const contentWidths = new Map(cols.map((col) => [col.key, measureContentWidth(col, rows)]));
    const wideCols = cols.filter((col) => !isNarrow(col));
    const narrowTotalPx = cols
      .filter(isNarrow)
      .reduce((sum, col) => sum + contentWidths.get(col.key), 0);
    // -12px reserves room for the grid's own vertical scrollbar (8px, see
    // EnterpriseDataGrid.css's .ng-table-wrapper), which only appears once
    // wrapped row text pushes content past the reserved row height — without
    // this the columns are sized against the wrapper's full width, then the
    // scrollbar shows up afterward and steals it back, causing a few px of
    // horizontal overflow.
    const equalShare = wideCols.length > 0 ? `((100% - ${narrowTotalPx}px - 12px) / ${wideCols.length})` : null;
    return cols.map((col) => {
      const contentPx = contentWidths.get(col.key);
      if (isNarrow(col)) {
        return { ...col, width: `${contentPx}px`, minWidth: contentPx };
      }
      return {
        ...col,
        width: equalShare ? `min(calc(${equalShare}), ${contentPx}px)` : `${contentPx}px`,
        minWidth: FLEX_COLUMN_MIN_WIDTH,
      };
    });
  }, [measureContentWidth]);

  const masterColumns = useMemo(
    () => stripGridInteractivity(withFitWidths(buildListColumnsFromRows(masterRows), masterRows)),
    [masterRows, withFitWidths]
  );

  // Trailing row appended to Master Items (on-screen and in the Excel
  // export): a highlighted Total row (Qty/Amount summed). Column keys are
  // detected from masterColumns rather than hardcoded, since they come from
  // dynamic API data (confirmed live: "Sr No"/"Particular"/"Rate"/"QTY"/
  // "Amount"). 2026-09-09 /pm — Average Rate moved to Location Part Count.
  const masterSummaryRows = useMemo(() => {
    if (masterRows.length === 0) return [];
    const labelCol = masterColumns.find((c) => /particular/i.test(c.key)) ?? masterColumns[0];
    const qtyCol = masterColumns.find((c) => /qty/i.test(c.key));
    const amountCol = masterColumns.find((c) => /amount/i.test(c.key));
    if (!labelCol || !qtyCol || !amountCol) return [];

    const totalQty = masterRows.reduce((sum, r) => sum + (Number(resolveRowFieldValue(r, qtyCol.key)) || 0), 0);
    const totalAmount = masterRows.reduce((sum, r) => sum + (Number(resolveRowFieldValue(r, amountCol.key)) || 0), 0);

    return [{
      [labelCol.key]: "Total :",
      [qtyCol.key]: totalQty,
      [amountCol.key]: totalAmount,
      __isSummaryRow: true,
    }];
  }, [masterRows, masterColumns]);

  const masterDisplayRows = useMemo(
    () => [...masterRows, ...masterSummaryRows],
    [masterRows, masterSummaryRows]
  );

  // CallGenPartDtlID is an internal linking id on Matching Transactions rows
  // (confirmed live: only fn_tbl_AstSrNoWsPartDetail returns it, not the
  // other two SPs) — hidden from both the on-screen grid and, since
  // detailColumns also drives handleExportExcel below, the Excel export.
  const detailColumns = useMemo(
    () =>
      stripGridInteractivity(
        withFitWidths(buildListColumnsFromRows(detailRows, { hiddenKeys: ["CallGenPartDtlID"] }), detailRows)
      ),
    [detailRows, withFitWidths]
  );
  const locCountColumns = useMemo(
    () => stripGridInteractivity(withFitWidths(buildListColumnsFromRows(locCountRows), locCountRows)),
    [locCountRows, withFitWidths]
  );

  // Tab 2 — displayed and exported grouped by date, per the reference: one
  // small table per date, columns Sr No/Particular/Quantity/Rate/Amount (the
  // date column itself pulled out to become each group's own title), each
  // ending in a highlighted Total row (Quantity + Amount summed, same
  // pattern as Master Items'/Location Part Count's own summary rows above).
  const dateGroupAllColumns = useMemo(() => buildListColumnsFromRows(dateGroupRows), [dateGroupRows]);
  const dateGroupDateCol = useMemo(
    () => dateGroupAllColumns.find((c) => c.filterType === "date") ?? dateGroupAllColumns[0] ?? null,
    [dateGroupAllColumns]
  );
  // Every group's rows share this column set — Sr No/Particular/Quantity/
  // Rate/Amount minus whichever column turned out to be the date.
  const dateGroupColumns = useMemo(
    () =>
      stripGridInteractivity(
        buildListColumnsFromRows(dateGroupRows, { hiddenKeys: dateGroupDateCol ? [dateGroupDateCol.key] : [] })
      ),
    [dateGroupRows, dateGroupDateCol]
  );

  const dateGroupBlocks = useMemo(() => {
    if (!dateGroupDateCol || dateGroupRows.length === 0) return [];
    const labelCol = dateGroupColumns.find((c) => /particular/i.test(c.key)) ?? dateGroupColumns[0];
    const qtyCol = dateGroupColumns.find((c) => /qty|quantity/i.test(c.key));
    const amountCol = dateGroupColumns.find((c) => /amount/i.test(c.key));

    const groups = new Map();
    dateGroupRows.forEach((row) => {
      const rawDate = resolveRowFieldValue(row, dateGroupDateCol.key);
      const label = formatGroupDateLabel(rawDate);
      if (!groups.has(label)) {
        const parsed = parseFlexibleDate(rawDate);
        groups.set(label, {
          label,
          sortKey: parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0,
          rows: [],
        });
      }
      groups.get(label).rows.push(row);
    });

    return Array.from(groups.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((group) => {
        if (!labelCol || (!qtyCol && !amountCol)) {
          return { ...group, displayRows: group.rows };
        }
        const summaryRow = { [labelCol.key]: "Total :", __isSummaryRow: true };
        if (qtyCol) {
          summaryRow[qtyCol.key] = group.rows.reduce(
            (sum, r) => sum + (Number(resolveRowFieldValue(r, qtyCol.key)) || 0),
            0
          );
        }
        if (amountCol) {
          summaryRow[amountCol.key] = group.rows.reduce(
            (sum, r) => sum + (Number(resolveRowFieldValue(r, amountCol.key)) || 0),
            0
          );
        }
        return { ...group, displayRows: [...group.rows, summaryRow] };
      });
  }, [dateGroupRows, dateGroupDateCol, dateGroupColumns]);

  // Tab 3 — one flat grid (no grouping), with an Overall TOTAL row: Asset
  // Count and Total Cost summed, Per Asset Repairing Cost re-derived as
  // Total Cost / Asset Count (an average, not a sum — same pattern as
  // Location Part Count's Average Rate above).
  const perChairCostColumns = useMemo(
    () =>
      stripGridInteractivity(
        buildListColumnsFromRows(perChairCostRows).map((c) =>
          /perassetrepairingcost/i.test(c.key.replace(/\s+/g, ""))
            ? { ...c, label: "Per Chair Repairing Cost" }
            : c
        )
      ),
    [perChairCostRows]
  );

  const perChairCostSummaryRows = useMemo(() => {
    if (perChairCostRows.length === 0) return [];
    // Not a date/number column — putting the "Overall TOTAL :" label under a
    // date-typed column (e.g. "PO Date") doesn't work: the grid formats
    // date-column cells as dates for display, so a plain label string in
    // one silently renders as "—" instead of the text (confirmed live).
    const labelCol =
      perChairCostColumns.find((c) => c.filterType !== "date" && c.filterType !== "number")
      ?? perChairCostColumns[0];
    const qtyCol = perChairCostColumns.find((c) => /assetcount|qty/i.test(c.key.replace(/\s+/g, "")));
    const totalCostCol = perChairCostColumns.find((c) => /totalcost/i.test(c.key.replace(/\s+/g, "")));
    const perCostCol = perChairCostColumns.find((c) => /perassetrepairingcost|perchairrepairingcost/i.test(c.key.replace(/\s+/g, "")));
    if (!labelCol || (!qtyCol && !totalCostCol)) return [];

    const totalQty = qtyCol
      ? perChairCostRows.reduce((sum, r) => sum + (Number(resolveRowFieldValue(r, qtyCol.key)) || 0), 0)
      : 0;
    const totalCost = totalCostCol
      ? perChairCostRows.reduce((sum, r) => sum + (Number(resolveRowFieldValue(r, totalCostCol.key)) || 0), 0)
      : 0;

    const summaryRow = { [labelCol.key]: "Overall TOTAL :", __isSummaryRow: true };
    if (qtyCol) summaryRow[qtyCol.key] = totalQty;
    if (totalCostCol) summaryRow[totalCostCol.key] = totalCost;
    if (perCostCol && qtyCol && totalQty !== 0) {
      summaryRow[perCostCol.key] = Number((totalCost / totalQty).toFixed(2));
    }
    return [summaryRow];
  }, [perChairCostRows, perChairCostColumns]);

  const perChairCostDisplayRows = useMemo(
    () => [...perChairCostRows, ...perChairCostSummaryRows],
    [perChairCostRows, perChairCostSummaryRows]
  );

  // Two trailing rows appended to Location Part Count (2026-09-09 /pm —
  // moved here from Master Items): a highlighted Total row (summing
  // whatever numeric columns exist — the dynamic item-count column, e.g.
  // "Chairs"/"Asset Count", plus Amount) and, below it, a highlighted
  // Average Rate row (= Total Amount / Total Count). This grid has no Qty/
  // Rate columns like Master, so the "count" column is detected generically
  // as whichever numeric column isn't Amount, rather than hardcoded by name
  // (it varies per item type).
  const locCountSummaryRows = useMemo(() => {
    if (locCountRows.length === 0) return [];
    const labelCol = locCountColumns.find((c) => /floor|location/i.test(c.key)) ?? locCountColumns[0];
    const amountCol = locCountColumns.find((c) => /amount/i.test(c.key));
    const countCol = locCountColumns.find(
      (c) => c.filterType === "number" && c.key !== amountCol?.key
    );
    if (!labelCol || !amountCol || !countCol) return [];

    const totalCount = locCountRows.reduce((sum, r) => sum + (Number(resolveRowFieldValue(r, countCol.key)) || 0), 0);
    const totalAmount = locCountRows.reduce((sum, r) => sum + (Number(resolveRowFieldValue(r, amountCol.key)) || 0), 0);
    const avgRate = totalCount !== 0 ? totalAmount / totalCount : 0;

    const totalRow = {
      [labelCol.key]: "Total :",
      [countCol.key]: totalCount,
      [amountCol.key]: totalAmount,
      __isSummaryRow: true,
    };
    const avgRow = {
      [labelCol.key]: "Average Rate :",
      [amountCol.key]: Number(avgRate.toFixed(4)),
      __isSummaryRow: true,
    };
    return [totalRow, avgRow];
  }, [locCountRows, locCountColumns]);

  const locCountDisplayRows = useMemo(
    () => [...locCountRows, ...locCountSummaryRows],
    [locCountRows, locCountSummaryRows]
  );

  // Shared by Master Items and Location Part Count — the neutral
  // "ng-row--status-summary" highlight (bold + tinted background) rather
  // than the approval-status greens/ambers this same getRowState mechanism
  // is normally used for elsewhere in the app.
  const getSummaryRowState = useCallback(
    (row) => (row.__isSummaryRow ? { statusKey: "summary" } : null),
    []
  );

  // Real .xlsx, one sheet, three tables side by side — Transactions |
  // Master | Location Part Count — mirroring the three on-screen grids
  // exactly (2026-09-09 /pm — the 3rd table used to be a separately
  // recomputed "Summary" grouping of Matching Transactions that didn't
  // match the real Location Part Count grid at all; replaced with the same
  // locCountDisplayRows/locCountColumns the on-screen grid uses, so the
  // export can never disagree with what's shown). Every table is the full
  // currently-loaded dataset (2026-09-09 /pm — no more row selection to
  // export a subset of).
  const handleExportExcel = useCallback(() => {
    const tables = [
      {
        title: "Asset TagID Wise Detail",
        columns: detailColumns,
        rows: detailRows.map((r) => resolveRowByColumns(r, detailColumns)),
      },
      {
        title: "Asset Part Wise Summary",
        columns: masterColumns,
        rows: masterDisplayRows.map((r) => resolveRowByColumns(r, masterColumns)),
      },
      {
        title: "Asset Location Wise Summary",
        columns: locCountColumns,
        rows: locCountDisplayRows.map((r) => resolveRowByColumns(r, locCountColumns)),
      },
    ];
    exportSideBySideTablesToExcel(tables, "Asset_Part_Indent_export.xlsx");
  }, [masterColumns, detailColumns, masterDisplayRows, detailRows, locCountColumns, locCountDisplayRows]);

  // Date Wise Part Summary's own export — one table per date group, stacked,
  // mirroring the on-screen blocks exactly (same displayRows, same Total row).
  const handleExportDateGroupExcel = useCallback(() => {
    const tables = dateGroupBlocks.map((group) => ({
      title: group.label,
      columns: dateGroupColumns,
      rows: group.displayRows.map((r) => resolveRowByColumns(r, dateGroupColumns)),
    }));
    exportStackedTablesToExcel(tables, "Asset_Part_Indent_Date_Wise_Part_Summary_export.xlsx");
  }, [dateGroupBlocks, dateGroupColumns]);

  // Per Asset Repairing Cost's own export — one flat table, Overall TOTAL
  // row bolded (exportStackedTablesToExcel handles a single-table list fine,
  // and keeps the same title/header/total styling as the other two tabs).
  const handleExportPerChairCostExcel = useCallback(() => {
    const tables = [
      {
        title: "Per Asset Repairing Cost",
        columns: perChairCostColumns,
        rows: perChairCostDisplayRows.map((r) => resolveRowByColumns(r, perChairCostColumns)),
      },
    ];
    exportStackedTablesToExcel(tables, "Asset_Part_Indent_Per_Asset_Repairing_Cost_export.xlsx");
  }, [perChairCostColumns, perChairCostDisplayRows]);

  // 2026-09-09 /pm — posts the full currently-loaded Matching Transactions
  // dataset. Previously posted only the checkbox-selected subset, but the
  // selection UI has been removed entirely (every grid now just displays
  // everything it fetched), so "what gets saved" is simply "what's loaded".
  const handleSave = useCallback(async () => {
    if (detailRows.length === 0) {
      notify.error("No transactions to save for the selected filters.");
      return;
    }
    const divisionId = Number(filters.divisionId) || 0;
    if (!divisionId) {
      notify.error("Select a Division before saving.");
      return;
    }

    const payload = withSaveContextFields(
      buildSaveJsonFields({ label: APIN_CONFIG.PAGE_TITLE, det: detailRows }),
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
  }, [detailRows, filters.divisionId, postSave, notify, handleCancel]);

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

      <div className="apin-tabs" role="tablist" aria-label="Asset Part Indent report tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`apin-tab${activeTab === tab.key ? " apin-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "dateRange" && (
        <>
          <div className="apin-tab-toolbar">
            <button
              type="button"
              className="apin-export-btn"
              onClick={handleExportExcel}
              disabled={loading}
              title="Export Asset TagID Wise Detail, Asset Part Wise Summary, and Asset Location Wise Summary to Excel"
            >
              <Download size={14} strokeWidth={2} />
              Export to Excel
            </button>
          </div>

          <div className="apin-grids-row">
            <section className="apin-grid-section" style={gridRowStyle(detailRows.length)}>
              <EnterpriseDataGrid
                title="Asset TagID Wise Detail"
                columns={detailColumns}
                data={detailRows}
                loading={loading}
                error={null}
                hidePagination
                loaderText="Loading transactions…"
                emptyMessage="No matching transactions found for the selected filters."
              />
            </section>

            <section className="apin-grid-section" style={gridRowStyle(masterDisplayRows.length)}>
              <EnterpriseDataGrid
                title="Asset Part Wise Summary"
                icon={<PackageSearch size={16} strokeWidth={2} />}
                columns={masterColumns}
                data={masterDisplayRows}
                loading={loading}
                error={null}
                hidePagination
                loaderText="Loading master items…"
                emptyMessage="No Asset Part master items found for the selected filters."
                getRowState={getSummaryRowState}
              />
            </section>

            <section className="apin-grid-section" style={gridRowStyle(locCountDisplayRows.length)}>
              <EnterpriseDataGrid
                title="Asset Location Wise Summary"
                columns={locCountColumns}
                data={locCountDisplayRows}
                loading={loading}
                error={null}
                hidePagination
                loaderText="Loading location part counts…"
                emptyMessage="No location-wise part counts found for the selected filters."
                getRowState={getSummaryRowState}
              />
            </section>
          </div>
        </>
      )}

      {activeTab === "dateGroup" && (
        <>
          <div className="apin-tab-toolbar">
            <button
              type="button"
              className="apin-export-btn"
              onClick={handleExportDateGroupExcel}
              disabled={loading || dateGroupBlocks.length === 0}
              title="Export Date Wise Part Summary (grouped by date) to Excel"
            >
              <Download size={14} strokeWidth={2} />
              Export to Excel
            </button>
          </div>

          {dateGroupBlocks.length === 0 ? (
            <section className="apin-grid-section apin-grid-section--full">
              <EnterpriseDataGrid
                title="Date Wise Part Summary"
                columns={dateGroupColumns}
                data={dateGroupRows}
                loading={loading}
                error={null}
                hidePagination
                loaderText="Loading Date Wise Part Summary…"
                emptyMessage="No Date Wise Part Summary data found for the selected filters."
              />
            </section>
          ) : (
            <div className="apin-dategroups">
              {dateGroupBlocks.map((group) => (
                <section
                  key={group.label}
                  className="apin-grid-section apin-grid-section--full"
                  style={gridRowStyle(group.displayRows.length)}
                >
                  <EnterpriseDataGrid
                    title={group.label}
                    columns={dateGroupColumns}
                    data={group.displayRows}
                    loading={loading}
                    error={null}
                    hidePagination
                    getRowState={getSummaryRowState}
                  />
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "perChairCost" && (
        <>
          <div className="apin-tab-toolbar">
            <button
              type="button"
              className="apin-export-btn"
              onClick={handleExportPerChairCostExcel}
              disabled={loading || perChairCostRows.length === 0}
              title="Export Per Asset Repairing Cost to Excel"
            >
              <Download size={14} strokeWidth={2} />
              Export to Excel
            </button>
          </div>

          <section
            className="apin-grid-section apin-grid-section--full"
            style={gridRowStyle(perChairCostDisplayRows.length)}
          >
            <EnterpriseDataGrid
              title="Per Asset Repairing Cost"
              columns={perChairCostColumns}
              data={perChairCostDisplayRows}
              loading={loading}
              error={null}
              hidePagination
              loaderText="Loading Per Asset Repairing Cost…"
              emptyMessage="No Per Asset Repairing Cost data found for the selected filters."
              getRowState={getSummaryRowState}
            />
          </section>
        </>
      )}

      {activeTab === "dateRange" && (
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
      )}
    </div>
  );
}
