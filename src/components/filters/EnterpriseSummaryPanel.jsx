// EnterpriseSummaryPanel — reusable summary / totals bar (Master summary section).
//
// Part of the Master UI split — fields are synced in the page via syncMasterSummaryFields()
// from GET_DETAIL_COL_DATA (SummaryParameterID = ColName, label = DisplayName).
// Page-wise stubs live in each form's constants.js (e.g. PO_SUMMARY_FIELDS), same as header filters.
// Core behaviour unchanged: sums detail grid rows by detKey; getSummary() returns
// { [mstKey]: number } for the save master payload.
//
// Props:
//   fields       — synced [{ detKey, mstKey, label, SummaryParameterID?, fromMaster? }]
//   rows         — current detail rows (pass from onRowsChange)
//   masterValues — loaded master row on edit (e.g. loadedMasterRow) — only
//                  consulted for fields marked `fromMaster: true`, for values
//                  with no per-line equivalent on the detail grid at all
//                  (e.g. PV's TDS section, computed once per voucher from
//                  the supplier's TDS settings, not per item — summing rows
//                  for these always produced 0, even on edit of a saved
//                  record with real persisted amounts).
//   rowFilter    — optional (row) => boolean; excludes rows the backend
//                  itself excludes from its stored totals (e.g. PV rows
//                  with puttouse=0 — confirmed live against a saved record
//                  where such a row's tax figures were absent from the
//                  master's mstcgst/mstsgst/etc). Omit to sum every row,
//                  unchanged default behaviour for callers that don't need it.
//
// Ref API:
//   getSummary()  → { [mstKey]: number, ... }
//   Spread into the master row before calling Save.
//
// Usage:
//   const summaryRef = useRef(null);
//   <EnterpriseSummaryPanel ref={summaryRef} fields={PO_SUMMARY_FIELDS} rows={gridRows} />
//   // Before save:
//   const mstRow = { ...headerValues, ...summaryRef.current.getSummary() };

import React, { useMemo, useImperativeHandle, forwardRef } from "react";
import "./EnterpriseSummaryPanel.css";

function fmt(val) {
  const n = Number(val);
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

const EnterpriseSummaryPanel = forwardRef(function EnterpriseSummaryPanel(
  { fields = [], rows = [], masterValues = null, rowFilter = null },
  ref
) {
  const summary = useMemo(() => {
    const totals = {};
    const summableRows = rowFilter ? rows.filter(rowFilter) : rows;
    fields.forEach(({ detKey, mstKey, fromMaster }) => {
      const k = mstKey || detKey;
      if (fromMaster) {
        const v = Number(masterValues?.[k]);
        totals[k] = isNaN(v) ? 0 : v;
        return;
      }
      totals[k] = summableRows.reduce((acc, row) => {
        const v = Number(row[detKey]);
        return acc + (isNaN(v) ? 0 : v);
      }, 0);
    });
    return totals;
  }, [fields, rows, masterValues, rowFilter]);

  useImperativeHandle(
    ref,
    () => ({
      getSummary: () => ({ ...summary }),
    }),
    [summary]
  );

  return (
    <section className="enterprise-summary-panel" aria-label="Transaction summary">
      {fields.map(({ detKey, mstKey, label }) => {
        const k = mstKey || detKey;
        return (
          <div key={k} className="enterprise-summary-panel__field">
            <span className="enterprise-summary-panel__label">{label}</span>
            <input
              type="text"
              readOnly
              className="enterprise-summary-panel__input"
              value={fmt(summary[k])}
              aria-label={label}
              tabIndex={-1}
            />
          </div>
        );
      })}
    </section>
  );
});

export default EnterpriseSummaryPanel;
