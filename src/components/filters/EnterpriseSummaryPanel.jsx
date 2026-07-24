// EnterpriseSummaryPanel — reusable summary / totals bar (Master summary section).
//
// Part of the Master UI split — fields are synced in the page via syncMasterSummaryFields()
// from GET_DETAIL_COL_DATA (SummaryParameterID = ColName, label = DisplayName).
// Page-wise stubs live in each form's constants.js (e.g. PO_SUMMARY_FIELDS), same as header filters.
// Core behaviour unchanged: sums detail grid rows by detKey; getSummary() returns
// { [mstKey]: number } for the save master payload.
//
// Props:
//   fields       — synced [{ detKey, mstKey, label, SummaryParameterID?, fromMaster?, deriveFromKeys?, editable? }]
//   rows         — current detail rows (pass from onRowsChange)
//   masterValues — loaded master row on edit (e.g. loadedMasterRow) — only
//                  consulted for fields marked `fromMaster: true`, for values
//                  with no per-line equivalent on the detail grid at all
//                  (e.g. PV's TDS section, computed once per voucher from
//                  the supplier's TDS settings, not per item — summing rows
//                  for these always produced 0, even on edit of a saved
//                  record with real persisted amounts).
//   deriveFromKeys — explicit list of this field's own mstKey/detKey values
//                  to sum, e.g. PV's mstnetbaseamount = mstbaseamount +
//                  mstexpense + mstcgst + mstsgst + mstigst + mstroundoff
//                  (every other summary amount except msttaxablevalue).
//                  Computed live in Add mode too, unlike `fromMaster` fields —
//                  resolved from this render's own `totals`, so list the
//                  *source* keys explicitly rather than "everything else",
//                  which stays correct even if unrelated fields (e.g. TDS)
//                  become visible later. If a source key has an active manual
//                  override (see `editable` below), the override wins here too.
//   editable     — this field (e.g. Round Off) renders as a real input the
//                  user can type over. Default shown/used value is always the
//                  live auto-calculated total; typing a value "pins" it (an
//                  explicit override) until cleared (blur with an empty/invalid
//                  value reverts to auto) or `resetOverrides()` is called.
//   rowFilter    — optional (row) => boolean; excludes rows the backend
//                  itself excludes from its stored totals (e.g. PV rows
//                  with puttouse=0 — confirmed live against a saved record
//                  where such a row's tax figures were absent from the
//                  master's mstcgst/mstsgst/etc). Omit to sum every row,
//                  unchanged default behaviour for callers that don't need it.
//
// Ref API:
//   getSummary()     → { [mstKey]: number, ... } — manual overrides included as numbers.
//   resetOverrides() → clears manual overrides. Callers must invoke this on
//                  Cancel/discard and after a New/reset cycle (the panel stays
//                  mounted across those, so a stale override would otherwise
//                  leak into the next record) — see each *Form.jsx's
//                  handleDiscardConfirm / extraClearFns.
//   Spread getSummary() into the master row before calling Save.
//
// Usage:
//   const summaryRef = useRef(null);
//   <EnterpriseSummaryPanel ref={summaryRef} fields={PO_SUMMARY_FIELDS} rows={gridRows} />
//   // Before save:
//   const mstRow = { ...headerValues, ...summaryRef.current.getSummary() };

import React, { useMemo, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import "./EnterpriseSummaryPanel.css";

function fmt(val) {
  const n = Number(val);
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

const EnterpriseSummaryPanel = forwardRef(function EnterpriseSummaryPanel(
  { fields = [], rows = [], masterValues = null, rowFilter = null },
  ref
) {
  // Manual overrides for `editable` fields, keyed by mstKey. A key is only
  // present once the user has actually typed something for it — absence
  // means "keep tracking the live auto-calculated total."
  const [overrides, setOverrides] = useState({});

  const autoTotals = useMemo(() => {
    const totals = {};
    const summableRows = rowFilter ? rows.filter(rowFilter) : rows;
    const derivedFields = [];

    fields.forEach((field) => {
      const { detKey, mstKey, fromMaster, deriveFromKeys } = field;
      const k = mstKey || detKey;
      // Derived fields (e.g. mstnetbaseamount) depend on other fields' totals —
      // resolve them in a second pass once every direct total is known.
      if (deriveFromKeys) {
        derivedFields.push(field);
        return;
      }
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

    // Resolve against each source's EFFECTIVE value — a manual override on an
    // editable source (e.g. Round Off) wins over its auto-calculated total,
    // so overriding Round Off correctly ripples into Net Base Amount.
    derivedFields.forEach(({ detKey, mstKey, deriveFromKeys }) => {
      const k = mstKey || detKey;
      totals[k] = deriveFromKeys.reduce((acc, srcKey) => {
        const override = overrides[srcKey];
        const effective = override !== undefined ? Number(override) : totals[srcKey];
        return acc + (Number.isFinite(effective) ? effective : 0);
      }, 0);
    });

    return totals;
  }, [fields, rows, masterValues, rowFilter, overrides]);

  // What's actually used for save/derived math: the manual override if the
  // user has typed one for that field, else the live auto-calculated total.
  const summary = useMemo(() => {
    const merged = { ...autoTotals };
    Object.entries(overrides).forEach(([k, v]) => {
      const n = Number(v);
      if (Number.isFinite(n)) merged[k] = n;
    });
    return merged;
  }, [autoTotals, overrides]);

  const handleOverrideChange = useCallback((k, raw) => {
    setOverrides((prev) => ({ ...prev, [k]: raw }));
  }, []);

  // Empty/invalid on blur reverts to the live auto value; a valid entry gets
  // reformatted to match the other fields' two-decimal display.
  const handleOverrideBlur = useCallback((k) => {
    setOverrides((prev) => {
      const raw = prev[k];
      if (raw === undefined || raw === "" || isNaN(Number(raw))) {
        if (!(k in prev)) return prev;
        const next = { ...prev };
        delete next[k];
        return next;
      }
      return { ...prev, [k]: fmt(raw) };
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getSummary: () => ({ ...summary }),
      resetOverrides: () => setOverrides({}),
    }),
    [summary]
  );

  return (
    <section className="enterprise-summary-panel" aria-label="Transaction summary">
      {fields.map(({ detKey, mstKey, label, editable }) => {
        const k = mstKey || detKey;
        const hasOverride = overrides[k] !== undefined;
        const displayValue = hasOverride ? overrides[k] : fmt(summary[k]);
        return (
          <div key={k} className="enterprise-summary-panel__field">
            <span className="enterprise-summary-panel__label" title={label}>
              {label}
            </span>
            <input
              type="text"
              inputMode="decimal"
              readOnly={!editable}
              className={`enterprise-summary-panel__input${editable ? " enterprise-summary-panel__input--editable" : ""}`}
              value={displayValue}
              onChange={editable ? (e) => handleOverrideChange(k, e.target.value) : undefined}
              onBlur={editable ? () => handleOverrideBlur(k) : undefined}
              aria-label={label}
              title={label}
              tabIndex={editable ? 0 : -1}
            />
          </div>
        );
      })}
    </section>
  );
});

export default EnterpriseSummaryPanel;
