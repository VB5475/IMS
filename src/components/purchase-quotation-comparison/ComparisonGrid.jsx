// ComparisonGrid.jsx — bespoke pivot/comparison table for Purchase Quotation
// Comparison. Not RB-driven, not EntryGrid/EnterpriseDataGrid — client-confirmed
// static columns, and neither shared grid component supports grouped per-supplier
// sub-columns or cross-row "Best" badge logic. See /tl architecture sign-off.

import React, { useMemo } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { formatTranDate } from "../../utils/dateFormat";
import "./ComparisonGrid.css";

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isExpiringSoon(expiryDate) {
  if (!expiryDate) return false;
  const d = new Date(expiryDate);
  if (Number.isNaN(d.getTime())) return false;
  const daysLeft = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysLeft >= 0 && daysLeft <= 3;
}

function cellKey(itemId, supplierId) {
  return `${itemId}::${supplierId}`;
}

export default function ComparisonGrid({
  items,
  suppliers,
  cells,
  badges,
  selections, // { [itemid]: supplierid }
  onSelect, // (itemid, supplierid) => void
  readOnly = false,
}) {
  const { bestRateBySupplierByItem, supplierTotals, supplierQuotedCount, bestOverallSupplierId } = badges;

  const hasData = items.length > 0 && suppliers.length > 0;

  const totalsLabel = useMemo(
    () =>
      suppliers.map((s) => ({
        supplierid: s.supplierid,
        text: `${supplierQuotedCount[s.supplierid] ?? 0} of ${items.length} items quoted`,
      })),
    [suppliers, supplierQuotedCount, items.length]
  );

  if (!hasData) {
    return (
      <div className="pqc-grid-empty">
        <span>No quotations received yet for this inquiry.</span>
      </div>
    );
  }

  return (
    <div className="pqc-grid-wrap">
      <table className="pqc-grid">
        <thead>
          <tr>
            <th className="pqc-grid__item-col pqc-grid__item-col--sticky">Item</th>
            {suppliers.map((s) => {
              const anyExpiring = items.some((item) => {
                const cell = cells.get(cellKey(item.itemid, s.supplierid));
                return cell && isExpiringSoon(cell.expirydate);
              });
              return (
                <th key={s.supplierid} className="pqc-grid__supplier-col">
                  <div className="pqc-grid__supplier-name">{s.suppliername}</div>
                  {anyExpiring && (
                    <div className="pqc-grid__expiry-warning">
                      <AlertTriangle size={11} strokeWidth={2} />
                      Expires soon
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.itemid}>
              <td className="pqc-grid__item-col pqc-grid__item-col--sticky">
                <div className="pqc-grid__item-name">{item.itemname}</div>
                <div className="pqc-grid__item-code">{item.itemcode}</div>
              </td>
              {suppliers.map((s) => {
                const cell = cells.get(cellKey(item.itemid, s.supplierid));
                const isBestRate = bestRateBySupplierByItem[item.itemid] === s.supplierid;
                const isSelected = selections[item.itemid] === s.supplierid;

                if (!cell) {
                  return (
                    <td key={s.supplierid} className="pqc-grid__cell pqc-grid__cell--not-quoted">
                      Not quoted
                    </td>
                  );
                }

                return (
                  <td
                    key={s.supplierid}
                    className={`pqc-grid__cell${isSelected ? " pqc-grid__cell--selected" : ""}`}
                  >
                    {/* Whole cell is the click target; native radio is visually hidden
                        (not display:none) so it stays keyboard/screen-reader reachable —
                        selection state reads through the checkmark badge instead. */}
                    <label className="pqc-grid__cell-select" title={`Select ${s.suppliername} for ${item.itemname}`}>
                      <input
                        type="radio"
                        className="pqc-grid__cell-radio"
                        name={`pqc-item-${item.itemid}`}
                        checked={isSelected}
                        disabled={readOnly}
                        onChange={() => onSelect(item.itemid, s.supplierid)}
                        aria-label={`Select ${s.suppliername} for ${item.itemname}`}
                      />
                      <span className="pqc-grid__cell-check" aria-hidden="true">
                        <Check size={11} strokeWidth={3} />
                      </span>
                      <div className="pqc-grid__cell-content">
                        <div className="pqc-grid__cell-rate-row">
                          <span className="pqc-grid__cell-rate">{formatCurrency(cell.rate)}</span>
                          {isBestRate && <span className="pqc-grid__badge pqc-grid__badge--rate">Best rate</span>}
                        </div>
                        <div className="pqc-grid__cell-meta">
                          Qty {cell.qty}
                          {cell.deliverydate && <> · Del. {formatTranDate(cell.deliverydate)}</>}
                        </div>
                        {cell.qtnno && (
                          <div className="pqc-grid__cell-qtn">
                            Qtn #{cell.qtnno}
                            {cell.qtndate && <> · {formatTranDate(cell.qtndate)}</>}
                          </div>
                        )}
                      </div>
                    </label>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pqc-grid__item-col pqc-grid__item-col--sticky pqc-grid__total-label">
              Total <span className="pqc-grid__total-sub">(quoted items only)</span>
            </td>
            {suppliers.map((s) => {
              const isBestOverall = bestOverallSupplierId === s.supplierid;
              const label = totalsLabel.find((t) => t.supplierid === s.supplierid);
              return (
                <td key={s.supplierid} className="pqc-grid__cell pqc-grid__total-cell">
                  <div className="pqc-grid__cell-rate-row">
                    <span className="pqc-grid__cell-rate">{formatCurrency(supplierTotals[s.supplierid])}</span>
                    {isBestOverall && (
                      <span
                        className="pqc-grid__badge pqc-grid__badge--overall"
                        title="Lowest total among suppliers who quoted every item. A lower total from a supplier that skipped items isn't a fair comparison."
                      >
                        Best overall
                      </span>
                    )}
                  </div>
                  <div className="pqc-grid__cell-meta">{label?.text}</div>
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
      <p className="pqc-grid__footnote">
        <strong>Best rate</strong> marks the lowest price for that item. <strong>Best overall</strong> only
        considers suppliers who quoted on every item in this inquiry — a supplier with a lower total may still
        lose this badge if they left items unquoted, since that isn't a like-for-like comparison.
      </p>
    </div>
  );
}
