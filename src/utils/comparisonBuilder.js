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
    });
  });

  return {
    items: [...itemsById.values()],
    suppliers: [...suppliersById.values()],
    cells,
  };
}

/**
 * Compute per-item "Best rate" and per-supplier "Best overall" badge assignments.
 * Total = sum of per-unit rate across quoted items (matches the mockup's own
 * numbers exactly, e.g. 340 + 68900 = 69240 — confirmed by back-calculating the
 * screenshot, not an assumption).
 * "Best overall" is only awarded among suppliers who quoted every item — a
 * supplier with a lower total but a gap in coverage cannot win it, however low
 * their number looks (the exact fairness rule is still pending final client
 * sign-off on tie-break behaviour; this implements the "quoted 100% of items,
 * lowest total wins" reading confirmed so far).
 */
export function computeComparisonBadges({ items, suppliers, cells }) {
  const bestRateBySupplierByItem = {};
  const supplierTotals = {};
  const supplierQuotedCount = {};

  suppliers.forEach((s) => {
    supplierTotals[s.supplierid] = 0;
    supplierQuotedCount[s.supplierid] = 0;
  });

  items.forEach((item) => {
    let bestSupplierId = null;
    let bestRate = Infinity;

    suppliers.forEach((s) => {
      const cell = cells.get(cellKey(item.itemid, s.supplierid));
      if (!cell) return;
      supplierTotals[s.supplierid] += cell.rate;
      supplierQuotedCount[s.supplierid] += 1;
      if (cell.rate < bestRate) {
        bestRate = cell.rate;
        bestSupplierId = s.supplierid;
      }
    });

    bestRateBySupplierByItem[item.itemid] = bestSupplierId;
  });

  const fullyQuotedSupplierIds = suppliers
    .filter((s) => supplierQuotedCount[s.supplierid] === items.length && items.length > 0)
    .map((s) => s.supplierid);

  let bestOverallSupplierId = null;
  let bestOverallTotal = Infinity;
  fullyQuotedSupplierIds.forEach((id) => {
    if (supplierTotals[id] < bestOverallTotal) {
      bestOverallTotal = supplierTotals[id];
      bestOverallSupplierId = id;
    }
  });

  return {
    bestRateBySupplierByItem, // { [itemid]: supplierid | null }
    supplierTotals, // { [supplierid]: number }
    supplierQuotedCount, // { [supplierid]: number }
    bestOverallSupplierId, // supplierid | null
  };
}
