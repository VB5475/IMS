// comparisonBuilder.js — Purchase Quotation Comparison: pure pivot + badge logic.
// Deliberately kept separate from any rendering component (per /fe review) — the
// "Best overall" fairness rule is still not fully nailed down with the client,
// so it needs to be a one-file, unit-testable change, not a JSX edit.
//
// Field names confirmed live 2026-07-13 against IMS_LIVE (fn_tbl_fetchquotationdet4comparision):
// suppliername, quotno, quotdate, expirydate, itemcode, itemname, baseqty, rate,
// negotiationrate, baserate, deliverydate, supplierid, itemid, qtnmstid, qtndetid,
// isselected. No discount-percent field exists on this SP at all — the mockup's
// "Disc%" cell text isn't backed by real data and has been dropped from the grid.
//
// landcost and terms added 2026-08-31 (/pm) — real fields on the same SP, not
// previously surfaced anywhere in this grid.

function firstDefined(row, keys) {
  for (const k of keys) {
    if (row[k] != null && row[k] !== "") return row[k];
  }
  return null;
}

function cellKey(itemId, supplierId) {
  return `${itemId}::${supplierId}`;
}

/**
 * Pivot flat item×supplier rows into a { items, suppliers, cells } shape.
 * @param {object[]} flatRows — raw rows from SP_COMPARISON_GRID
 */
export function pivotQuotationRows(flatRows = []) {
  const itemsById = new Map();
  const suppliersById = new Map();
  const cells = new Map();

  flatRows.forEach((row) => {
    const itemId = String(firstDefined(row, ["itemid", "ItemID"]) ?? "");
    const supplierId = String(firstDefined(row, ["supplierid", "SupplierID"]) ?? "");
    if (!itemId || !supplierId) return;

    if (!itemsById.has(itemId)) {
      itemsById.set(itemId, {
        itemid: itemId,
        itemcode: firstDefined(row, ["itemcode", "ItemCode"]) ?? "",
        itemname: firstDefined(row, ["itemname", "ItemName"]) ?? "",
      });
    }
    if (!suppliersById.has(supplierId)) {
      suppliersById.set(supplierId, {
        supplierid: supplierId,
        suppliername: firstDefined(row, ["suppliername", "SupplierName"]) ?? "",
      });
    }

    cells.set(cellKey(itemId, supplierId), {
      rate: Number(firstDefined(row, ["rate", "Rate"]) ?? 0) || 0,
      qty: Number(firstDefined(row, ["baseqty", "qty", "Qty"]) ?? 0) || 0,
      deliverydate: firstDefined(row, ["deliverydate", "DeliveryDate", "deldate"]),
      qtnno: firstDefined(row, ["quotno", "qtnno", "QtnNo", "quotationno"]),
      qtndate: firstDefined(row, ["quotdate", "qtndate", "QtnDate", "quotationdate"]),
      expirydate: firstDefined(row, ["expirydate", "ExpiryDate", "qtnexpirydate"]),
      // Row's own save-identifier — confirmed real field, needed to round-trip
      // selection status back to the backend (see PurchaseQuotationComparisonPage
      // handleSave). Falls back to a composite key only if genuinely absent.
      qtndetid: firstDefined(row, ["qtndetid", "qtnmstid"]),
      // Prior save's selection status, so a re-opened comparison shows the
      // previously chosen supplier per item instead of starting blank.
      isselected: Number(firstDefined(row, ["isselected", "IsSelected"]) ?? 0) === 1,
      // baserate/negotiationrate feed the Best Rate score below — confirmed
      // live fields (see file header), previously fetched but unused.
      baserate: Number(firstDefined(row, ["baserate", "BaseRate"]) ?? 0) || 0,
      negotiationrate: Number(firstDefined(row, ["negotiationrate", "NegotiationRate"]) ?? 0) || 0,
      // Real per-quote fields, not previously surfaced in this grid (2026-08-31 /pm).
      landcost: Number(firstDefined(row, ["landcost", "LandCost"]) ?? 0) || 0,
      terms: firstDefined(row, ["terms", "Terms"]),
    });
  });

  return {
    items: [...itemsById.values()],
    suppliers: [...suppliersById.values()],
    cells,
  };
}

/**
 * Compute per-item "Lowest rate" badge assignments — the supplier quoting the
 * minimum unit rate for each item. (The Total row / "Best overall" supplier
 * badge that used to live here was removed per product request — comparing
 * suppliers by summed total wasn't a like-for-like metric across partial
 * quotes, and it's superseded by the per-item Best Rate work.)
 */
export function computeComparisonBadges({ items, suppliers, cells }) {
  const lowestRateSupplierIdByItem = {};

  items.forEach((item) => {
    let bestSupplierId = null;
    let bestRate = Infinity;

    suppliers.forEach((s) => {
      const cell = cells.get(cellKey(item.itemid, s.supplierid));
      if (!cell) return;
      if (cell.rate < bestRate) {
        bestRate = cell.rate;
        bestSupplierId = s.supplierid;
      }
    });

    lowestRateSupplierIdByItem[item.itemid] = bestSupplierId;
  });

  return {
    lowestRateSupplierIdByItem, // { [itemid]: supplierid | null }
  };
}

// ── Best Rate — multi-criteria score, not just lowest price ────────────
// First-pass weights, not yet client-signed-off — same "flag it clearly,
// make it a one-place change" posture as the old Best Overall rule had.
// Adjust here if the weighting needs to change; nothing else in the app
// depends on these specific numbers.
export const BEST_RATE_WEIGHTS = {
  price: 0.5,        // lower rate wins
  delivery: 0.2,      // earlier delivery date wins
  validity: 0.15,     // more days left before the quote expires wins
  negotiation: 0.15,  // bigger discount off the supplier's own base rate wins
};

// "Supplier reliability / past performance" was considered and dropped from
// this score — there's no live field or data source backing it on this
// screen's SP (fn_tbl_fetchquotationdet4comparision only returns per-quote
// fields). Scoring on a metric with no real data would just be fabricating
// a number, so it's left out until a reliability data source exists.

function daysFromNow(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
}

/** 0..1, higher is better. Flat 1 when every candidate ties (nothing to differentiate on). */
function normalize(value, min, max, { invert = false } = {}) {
  if (value == null || min == null || max == null || max === min) return 1;
  const n = (value - min) / (max - min);
  return invert ? 1 - n : n;
}

/**
 * Compute per-item "Best Rate" — a weighted score across price, delivery
 * speed, quote validity runway, and negotiated discount off base rate (see
 * BEST_RATE_WEIGHTS). Returns both the winning supplier and a breakdown per
 * supplier so the UI's info icon can explain *why* a quote won.
 */
export function computeBestRateBadges({ items, suppliers, cells }) {
  const bestRateSupplierIdByItem = {};
  const bestRateExplanationByItem = {}; // { [itemid]: { [supplierid]: breakdown } }

  items.forEach((item) => {
    const quotes = suppliers
      .map((s) => {
        const cell = cells.get(cellKey(item.itemid, s.supplierid));
        return cell ? { supplierid: s.supplierid, cell } : null;
      })
      .filter(Boolean);
    if (quotes.length === 0) return;

    const rates = quotes.map((q) => q.cell.rate);
    const [minRate, maxRate] = [Math.min(...rates), Math.max(...rates)];

    const deliveryDays = quotes.map((q) => daysFromNow(q.cell.deliverydate)).filter((d) => d != null);
    const minDelivery = deliveryDays.length ? Math.min(...deliveryDays) : null;
    const maxDelivery = deliveryDays.length ? Math.max(...deliveryDays) : null;

    const validityDays = quotes.map((q) => daysFromNow(q.cell.expirydate)).filter((d) => d != null);
    const minValidity = validityDays.length ? Math.min(...validityDays) : null;
    const maxValidity = validityDays.length ? Math.max(...validityDays) : null;

    const explanations = {};
    let winner = null;

    quotes.forEach(({ supplierid, cell }) => {
      const priceScore = normalize(cell.rate, minRate, maxRate, { invert: true });
      const deliveryScore = normalize(daysFromNow(cell.deliverydate), minDelivery, maxDelivery, { invert: true });
      const validityScore = normalize(daysFromNow(cell.expirydate), minValidity, maxValidity);

      let negotiationScore = 0.5; // neutral when no base rate to compare against
      if (cell.baserate > 0) {
        const discount = (cell.baserate - cell.rate) / cell.baserate; // >0 = negotiated down
        negotiationScore = Math.max(0, Math.min(1, 0.5 + discount));
      }

      const score =
        priceScore * BEST_RATE_WEIGHTS.price +
        deliveryScore * BEST_RATE_WEIGHTS.delivery +
        validityScore * BEST_RATE_WEIGHTS.validity +
        negotiationScore * BEST_RATE_WEIGHTS.negotiation;

      const breakdown = { supplierid, score, priceScore, deliveryScore, validityScore, negotiationScore };
      explanations[supplierid] = breakdown;
      if (!winner || score > winner.score) winner = breakdown;
    });

    bestRateExplanationByItem[item.itemid] = explanations;
    if (winner) bestRateSupplierIdByItem[item.itemid] = winner.supplierid;
  });

  return { bestRateSupplierIdByItem, bestRateExplanationByItem };
}
