// ComparisonGrid.jsx — bespoke pivot/comparison table for Purchase Quotation
// Comparison. Not RB-driven, not EntryGrid/EnterpriseDataGrid — client-confirmed
// static columns, and neither shared grid component supports grouped per-supplier
// sub-columns or cross-row "Best" badge logic. See /tl architecture sign-off.

import React from "react";
import { AlertTriangle, Check, Info, Rows3 } from "lucide-react";
import { formatTranDate } from "../../utils/dateFormat";
import "./ComparisonGrid.css";

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(score) {
  return `${Math.round((score ?? 0) * 100)}%`;
}

/** Native-tooltip explanation for the Best Rate info icon — plain text, no popover component exists yet. */
function buildBestRateExplanation(breakdown) {
  if (!breakdown) return "";
  return [
    "Why this is the Best Rate:",
    `• Price competitiveness: ${formatPercent(breakdown.priceScore)}`,
    `• Delivery speed: ${formatPercent(breakdown.deliveryScore)}`,
    `• Quote validity runway: ${formatPercent(breakdown.validityScore)}`,
    `• Negotiated discount off base rate: ${formatPercent(breakdown.negotiationScore)}`,
    `Overall score: ${formatPercent(breakdown.score)}`,
  ].join("\n");
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
  bestRate,
  selections, // { [itemid]: supplierid }
  onSelect, // (itemid, supplierid) => void
  readOnly = false,
}) {
  const { lowestRateSupplierIdByItem } = badges;
  const { bestRateSupplierIdByItem = {}, bestRateExplanationByItem = {} } = bestRate ?? {};

  const hasData = items.length > 0 && suppliers.length > 0;

  if (!hasData) {
    return (
      <div className="pqc-grid-empty">
        <span>No quotations received yet for this inquiry.</span>
      </div>
    );
  }

  return (
    <div className="pqc-grid-container">
      <div className="pqc-grid-title">
        <Rows3 size={13} strokeWidth={2} />
        <span>
          Comparison Grid — {items.length} item{items.length !== 1 ? "s" : ""} ×{" "}
          {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="pqc-grid-wrap pqc-grid-wrap--titled">
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
                const isLowestRate = lowestRateSupplierIdByItem[item.itemid] === s.supplierid;
                const isBestRate = bestRateSupplierIdByItem[item.itemid] === s.supplierid;
                const bestRateBreakdown = bestRateExplanationByItem[item.itemid]?.[s.supplierid];
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
                          {isLowestRate && <span className="pqc-grid__badge pqc-grid__badge--rate">Lowest rate</span>}
                          {isBestRate && (
                            <span className="pqc-grid__badge pqc-grid__badge--best">
                              Best rate
                              <button
                                type="button"
                                className="pqc-grid__badge-info"
                                title={buildBestRateExplanation(bestRateBreakdown)}
                                aria-label={`Why ${s.suppliername} is the best rate for ${item.itemname}`}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                              >
                                <Info size={11} strokeWidth={2} />
                              </button>
                            </span>
                          )}
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
      </table>
      </div>
      <p className="pqc-grid__footnote">
        <strong>Lowest rate</strong> marks the lowest price quoted for that item across all suppliers.{" "}
        <strong>Best rate</strong> weighs price alongside delivery speed, quote validity, and negotiated
        discount — click the <Info size={10} strokeWidth={2} style={{ verticalAlign: "-1px" }} /> icon on a
        Best rate badge to see the breakdown for that quote.
      </p>
    </div>
  );
}
