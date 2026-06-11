// EnterpriseSummaryPanel — reusable summary / totals bar for enterprise forms.
//
// Computes column totals from live detail grid rows and exposes them
// via ref for injection into the Save API master row.
//
// Props:
//   fields  — [{ detKey, label, mstKey? }]
//             detKey  = column key in the detail grid rows
//             label   = display label
//             mstKey  = key to use in the master save payload (falls back to detKey)
//   rows    — current detail rows (pass from onRowsChange)
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

import React, { useMemo, useImperativeHandle, forwardRef } from 'react';
import './EnterpriseSummaryPanel.css';

function fmt(val) {
  const n = Number(val);
  return isNaN(n) ? '0.00' : n.toFixed(2);
}

const EnterpriseSummaryPanel = forwardRef(function EnterpriseSummaryPanel(
  { fields = [], rows = [] },
  ref,
) {
  const summary = useMemo(() => {
    const totals = {};
    fields.forEach(({ detKey, mstKey }) => {
      const k = mstKey || detKey;
      totals[k] = rows.reduce((acc, row) => {
        const v = Number(row[detKey]);
        return acc + (isNaN(v) ? 0 : v);
      }, 0);
    });
    return totals;
  }, [fields, rows]);

  useImperativeHandle(ref, () => ({
    getSummary: () => ({ ...summary }),
  }), [summary]);

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
