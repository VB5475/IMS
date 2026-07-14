import React, { useCallback, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  Scale,
} from "lucide-react";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useNotification } from "../../context/NotificationContext";
import { tbReportMeta, tbRows } from "../../data/trialBalanceDummyData";
import { formatNumber } from "../../utils/numberFormat";
import { exportTrialBalanceToExcel } from "./tbExportExcel";
import {
  flattenVisibleTree,
  getDefaultExpandedKeys,
  getExpandableKeys,
  getRowKey,
} from "./tbHierarchy";
import "./TrialBalanceDemoPage.css";

const AMOUNT_COLS = [
  { key: "OpeningDebit", label: "Op. Debit" },
  { key: "OpeningCredit", label: "Op. Credit" },
  { key: "DebitAmount", label: "Debit" },
  { key: "CreditAmount", label: "Credit" },
  { key: "ClosingDebit", label: "Cl. Debit" },
  { key: "ClosingCredit", label: "Cl. Credit" },
];

function formatAmount(value) {
  if (value == null || value === "" || Number(value) === 0) return "";
  return formatNumber(value, "IN", 2);
}

export default function TrialBalanceDemoPage() {
  const notify = useNotification();
  const expandableKeys = useMemo(() => getExpandableKeys(tbRows), []);
  const [expandedKeys, setExpandedKeys] = useState(() => getDefaultExpandedKeys(tbRows));
  const [searchQuery, setSearchQuery] = useState("");

  usePageHeader({
    title: tbReportMeta.title,
    subtitle: `${tbReportMeta.company} · ${tbReportMeta.period}`,
    showBack: true,
    backTo: "/",
  });

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tbRows;

    const matchKeys = new Set();
    const byCode = new Map(tbRows.map((r) => [getRowKey(r), r]));

    for (const row of tbRows) {
      const hay = [
        row.AcGrpNameWOAlign,
        row.AcGrpNameWIAlign,
        row.ChildCode,
        row.ParentCode,
        row.COAType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) continue;

      let cur = row;
      while (cur) {
        const key = getRowKey(cur);
        matchKeys.add(key);
        cur = cur.ParentCode ? byCode.get(cur.ParentCode) : null;
      }
    }

    return tbRows.filter((r) => matchKeys.has(getRowKey(r)));
  }, [searchQuery]);

  const visible = useMemo(() => {
    // When searching, auto-expand matched ancestors so results show in tree
    if (searchQuery.trim()) {
      const force = new Set(expandedKeys);
      for (const row of filteredRows) {
        if (row.ParentCode) force.add(row.ParentCode);
        // also expand every ancestor already included via filteredRows parents
        force.add(getRowKey(row));
      }
      return flattenVisibleTree(filteredRows, force);
    }
    return flattenVisibleTree(filteredRows, expandedKeys);
  }, [expandedKeys, filteredRows, searchQuery]);

  const toggleExpand = useCallback((key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedKeys(new Set(expandableKeys));
  }, [expandableKeys]);

  const collapseAll = useCallback(() => {
    setExpandedKeys(new Set());
  }, []);

  const handleExportExcel = useCallback(() => {
    try {
      const rowsToExport = searchQuery.trim() ? filteredRows : tbRows;
      exportTrialBalanceToExcel({
        rows: rowsToExport,
        meta: tbReportMeta,
      });
      notify.success(
        searchQuery.trim()
          ? "Filtered trial balance exported with hierarchy grouping."
          : "Trial balance exported with hierarchy grouping."
      );
    } catch (err) {
      notify.error(err?.message || "Failed to export trial balance.");
    }
  }, [filteredRows, notify, searchQuery]);

  return (
    <div className="workspace-page workspace-page--fill tb-demo-page">
      <section className="tb-demo-page__banner" aria-label="Demo notice">
        <Scale size={14} strokeWidth={2} />
        <div>
          <strong>Demo — hierarchical grouping</strong> from flat JSON (
          {tbReportMeta.rowCount} rows). Tree uses <code>ParentCode</code> →{" "}
          <code>ChildCode</code> like <code>TB_Hierarchy_Grouping.xlsx</code>. Expand a
          parent to reveal children.
        </div>
      </section>

      <section className="tb-demo-card">
        <header className="tb-demo-card__header">
          <h2 className="tb-demo-card__title">
            <Scale size={14} strokeWidth={2} />
            {tbReportMeta.title}
          </h2>
          <div className="tb-demo-card__toolbar">
            <input
              type="search"
              className="tb-demo-card__search"
              placeholder="Search particulars / code…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search trial balance"
            />
            <button type="button" className="tb-demo-card__btn" onClick={expandAll}>
              <ChevronsUpDown size={14} strokeWidth={2} />
              Expand all
            </button>
            <button type="button" className="tb-demo-card__btn" onClick={collapseAll}>
              <ChevronsDownUp size={14} strokeWidth={2} />
              Collapse all
            </button>
            <button
              type="button"
              className="tb-demo-card__btn tb-demo-card__btn--primary"
              onClick={handleExportExcel}
              title="Export hierarchy to Excel with expand/collapse grouping"
            >
              <Download size={14} strokeWidth={2} />
              Export Excel
            </button>
          </div>
        </header>

        <div className="tb-demo-card__body">
          <div className="tb-demo-table-wrap">
            <table className="tb-demo-table">
              <thead>
                <tr>
                  <th className="tb-demo-table__col-name">Particulars</th>
                  {AMOUNT_COLS.map((col) => (
                    <th key={col.key} className="tb-demo-table__col-amt">
                      {col.label}
                    </th>
                  ))}
                  <th className="tb-demo-table__col-meta">Type</th>
                  <th className="tb-demo-table__col-meta">Code</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={AMOUNT_COLS.length + 3} className="tb-demo-table__empty">
                      No matching rows.
                    </td>
                  </tr>
                ) : (
                  visible.map(({ row, depth, hasChildren }) => {
                    const key = getRowKey(row);
                    const isExpanded = expandedKeys.has(key);
                    const isBold = Number(row.IsBold) === 1;
                    const name = String(row.AcGrpNameWOAlign ?? "").trim();

                    return (
                      <tr
                        key={key}
                        className={[
                          "tb-demo-row",
                          isBold ? "tb-demo-row--bold" : "",
                          row.COAType === "Total" ? "tb-demo-row--total" : "",
                          depth === 1 ? "tb-demo-row--l1" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <td className="tb-demo-table__col-name">
                          <div
                            className="tb-demo-particulars"
                            style={{ paddingLeft: `${depth * 18}px` }}
                          >
                            {hasChildren ? (
                              <button
                                type="button"
                                className="tb-demo-expand"
                                aria-expanded={isExpanded}
                                aria-label={isExpanded ? `Collapse ${name}` : `Expand ${name}`}
                                onClick={() => toggleExpand(key)}
                              >
                                {isExpanded ? (
                                  <ChevronDown size={14} strokeWidth={2.25} />
                                ) : (
                                  <ChevronRight size={14} strokeWidth={2.25} />
                                )}
                              </button>
                            ) : (
                              <span className="tb-demo-expand tb-demo-expand--spacer" />
                            )}
                            <span className="tb-demo-particulars__text" title={name}>
                              {name}
                            </span>
                          </div>
                        </td>
                        {AMOUNT_COLS.map((col) => (
                          <td key={col.key} className="tb-demo-table__col-amt">
                            {formatAmount(row[col.key])}
                          </td>
                        ))}
                        <td className="tb-demo-table__col-meta">{row.COAType}</td>
                        <td className="tb-demo-table__col-meta">{row.ChildCode}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <footer className="tb-demo-card__footer">
            Showing <strong>{visible.length}</strong> visible rows
            {searchQuery.trim() ? (
              <>
                {" "}
                (filtered from <strong>{tbRows.length}</strong>)
              </>
            ) : (
              <>
                {" "}
                of <strong>{tbRows.length}</strong> flat records
              </>
            )}
          </footer>
        </div>
      </section>
    </div>
  );
}
