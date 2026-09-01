// ComparisonGrid.jsx — bespoke pivot/comparison table for Purchase Quotation
// Comparison. Not RB-driven, not EntryGrid/EnterpriseDataGrid — client-confirmed
// static columns, and neither shared grid component supports grouped per-supplier
// sub-columns or cross-row "Best" badge logic. See /tl architecture sign-off.

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { AlertTriangle, Check, Info, Rows3, GripVertical } from "lucide-react";
import { formatTranDate } from "../../utils/dateFormat";
import "./ComparisonGrid.css";

// Supplier columns are user-resizable/reorderable (2026-08-31 /pm — heavy
// content like a long Terms line was forcing table-layout:auto to blow the
// whole table wide instead of wrapping, pushing later items off-screen).
// table-layout:fixed + an explicit <colgroup> below makes column widths
// authoritative, so long content wraps (grows the row) instead of growing
// the column. The Item column stays fixed — only supplier columns move.
const ITEM_COL_WIDTH = 220;
const DEFAULT_SUPPLIER_COL_WIDTH = 240;
const MIN_SUPPLIER_COL_WIDTH = 160;
const MAX_SUPPLIER_COL_WIDTH = 560;

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

  // Column order + widths are local UI state, not persisted — reset whenever
  // the underlying supplier SET changes (a different inquiry loaded), so a
  // custom arrangement from one inquiry never leaks onto an unrelated one.
  const supplierIdsKey = suppliers.map((s) => s.supplierid).join("|");
  const [order, setOrder] = useState(() => suppliers.map((s) => s.supplierid));
  const [colWidths, setColWidths] = useState({});
  const prevKeyRef = useRef(supplierIdsKey);

  useEffect(() => {
    if (prevKeyRef.current !== supplierIdsKey) {
      setOrder(suppliers.map((s) => s.supplierid));
      setColWidths({});
      prevKeyRef.current = supplierIdsKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierIdsKey]);

  const orderedSuppliers = useMemo(() => {
    const bySupplierId = new Map(suppliers.map((s) => [s.supplierid, s]));
    return order.map((id) => bySupplierId.get(id)).filter(Boolean);
  }, [order, suppliers]);

  // ── Column resize (drag the handle on a supplier column's right edge) ──
  const resizingRef = useRef(null); // { supplierId, startX, startWidth }

  const handleResizeMove = useCallback((e) => {
    const r = resizingRef.current;
    if (!r) return;
    const delta = e.clientX - r.startX;
    const next = Math.min(MAX_SUPPLIER_COL_WIDTH, Math.max(MIN_SUPPLIER_COL_WIDTH, r.startWidth + delta));
    setColWidths((prev) => ({ ...prev, [r.supplierId]: next }));
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  }, [handleResizeMove]);

  const handleResizeStart = useCallback(
    (e, supplierId) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = colWidths[supplierId] ?? DEFAULT_SUPPLIER_COL_WIDTH;
      resizingRef.current = { supplierId, startX: e.clientX, startWidth };
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
    },
    [colWidths, handleResizeMove, handleResizeEnd]
  );

  // Stop listening if the component unmounts mid-drag.
  useEffect(() => () => {
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  }, [handleResizeMove, handleResizeEnd]);

  // ── Column reorder (drag a supplier header, drop it before another) ────
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const handleColumnDrop = useCallback((targetId) => {
    setOrder((prev) => {
      if (!draggedId || draggedId === targetId) return prev;
      const draggedIndex = prev.indexOf(draggedId);
      const targetIndex = prev.indexOf(targetId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      // Direction-aware insert: dragging forward drops AFTER the target
      // (target slides left into dragged's old spot); dragging backward
      // drops BEFORE it. Using the target's plain post-removal index for
      // both directions makes a 2-column drag a no-op (removing the one
      // before it always shifts the target back to the same slot) — this
      // is what actually needs the direction check, not a style choice.
      const next = prev.filter((id) => id !== draggedId);
      const newTargetIndex = next.indexOf(targetId);
      const insertAt = draggedIndex < targetIndex ? newTargetIndex + 1 : newTargetIndex;
      next.splice(insertAt, 0, draggedId);
      return next;
    });
    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId]);

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
        <span className="pqc-grid-title__hint">Drag a supplier's grip to reorder · drag its right edge to resize</span>
      </div>
      <div className="pqc-grid-wrap pqc-grid-wrap--titled">
      <table className="pqc-grid">
        <colgroup>
          <col style={{ width: `${ITEM_COL_WIDTH}px` }} />
          {orderedSuppliers.map((s) => (
            <col key={s.supplierid} style={{ width: `${colWidths[s.supplierid] ?? DEFAULT_SUPPLIER_COL_WIDTH}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="pqc-grid__item-col pqc-grid__item-col--sticky">Item</th>
            {orderedSuppliers.map((s) => {
              const anyExpiring = items.some((item) => {
                const cell = cells.get(cellKey(item.itemid, s.supplierid));
                return cell && isExpiringSoon(cell.expirydate);
              });
              return (
                <th
                  key={s.supplierid}
                  className={`pqc-grid__supplier-col${dragOverId === s.supplierid ? " pqc-grid__supplier-col--drop-target" : ""}${draggedId === s.supplierid ? " pqc-grid__supplier-col--dragging" : ""}`}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDraggedId(s.supplierid); }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverId(s.supplierid); }}
                  onDragLeave={() => setDragOverId((prev) => (prev === s.supplierid ? null : prev))}
                  onDrop={(e) => { e.preventDefault(); handleColumnDrop(s.supplierid); }}
                  onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                >
                  <div className="pqc-grid__supplier-header">
                    <span className="pqc-grid__supplier-grip" title="Drag to reorder" aria-hidden="true">
                      <GripVertical size={12} strokeWidth={2} />
                    </span>
                    <div className="pqc-grid__supplier-name">{s.suppliername}</div>
                  </div>
                  {anyExpiring && (
                    <div className="pqc-grid__expiry-warning">
                      <AlertTriangle size={11} strokeWidth={2} />
                      Expires soon
                    </div>
                  )}
                  <div
                    className="pqc-grid__col-resize-handle"
                    title="Drag to resize column"
                    onMouseDown={(e) => handleResizeStart(e, s.supplierid)}
                    onClick={(e) => e.stopPropagation()}
                  />
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
              {orderedSuppliers.map((s) => {
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
                        <div className="pqc-grid__cell-landcost">
                          Land Cost: {formatCurrency(cell.landcost)}
                        </div>
                        {cell.qtnno && (
                          <div className="pqc-grid__cell-qtn">
                            Qtn #{cell.qtnno}
                            {cell.qtndate && <> · {formatTranDate(cell.qtndate)}</>}
                          </div>
                        )}
                        {cell.terms && (
                          <div className="pqc-grid__cell-terms">
                            Terms: {cell.terms}
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
