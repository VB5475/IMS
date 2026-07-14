/**
 * Build hierarchy from flat TB rows using ParentCode / ChildCode.
 * Dummy + future API data stay flat — tree is derived on the client.
 */

export function getRowKey(row) {
  return row?.ChildCode ?? `row-${row?.AcGrpID ?? row?.TBSeq ?? ""}`;
}

export function buildChildrenMap(rows) {
  const childrenByParent = new Map();
  const indexByKey = new Map();

  rows.forEach((row, index) => {
    indexByKey.set(getRowKey(row), index);
    const parent = row.ParentCode ?? null;
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent).push(row);
  });

  // Keep Excel / API encounter order among siblings (depth-first listing).
  for (const list of childrenByParent.values()) {
    list.sort(
      (a, b) => (indexByKey.get(getRowKey(a)) ?? 0) - (indexByKey.get(getRowKey(b)) ?? 0)
    );
  }

  return childrenByParent;
}

/** Roots: ParentCode null/undefined, or parents not present in the dataset. */
export function getRootRows(rows, childrenByParent) {
  const codes = new Set(rows.map((r) => r.ChildCode).filter(Boolean));
  const roots = [];

  for (const row of rows) {
    const parent = row.ParentCode ?? null;
    if (parent == null || !codes.has(parent)) roots.push(row);
  }

  const total = roots.find((r) => r.COAType === "Total" || r.ChildCode === "G-0");
  if (total) return [total];

  return (childrenByParent.get(null) || []).length
    ? childrenByParent.get(null)
    : roots;
}

/**
 * Flatten visible rows for depth-first tree walk given expanded keys.
 * @returns {{ row: object, depth: number, hasChildren: boolean }[]}
 */
export function flattenVisibleTree(rows, expandedKeys) {
  const childrenByParent = buildChildrenMap(rows);
  const roots = getRootRows(rows, childrenByParent);
  const out = [];
  const expanded = expandedKeys instanceof Set ? expandedKeys : new Set(expandedKeys);

  function walk(list, depth) {
    for (const row of list) {
      const key = getRowKey(row);
      const kids = childrenByParent.get(key) || [];
      const hasChildren = kids.length > 0;
      out.push({ row, depth, hasChildren });
      if (hasChildren && expanded.has(key)) {
        walk(kids, depth + 1);
      }
    }
  }

  walk(roots, 0);
  return out;
}

/** All parent keys that have at least one child. */
export function getExpandableKeys(rows) {
  const childrenByParent = buildChildrenMap(rows);
  const keys = [];
  for (const row of rows) {
    const key = getRowKey(row);
    if ((childrenByParent.get(key) || []).length > 0) keys.push(key);
  }
  return keys;
}

/** Default: expand Total + level-1 groups. */
export function getDefaultExpandedKeys(rows) {
  const keys = new Set();
  for (const row of rows) {
    const level = Number(row.GroupLevelCount);
    if (row.COAType === "Total" || level === 1 || (Number.isNaN(level) && row.ChildCode === "G-0")) {
      keys.add(getRowKey(row));
    }
  }
  return keys;
}

/** Full depth-first tree with every parent expanded (for Excel export). */
export function flattenFullTree(rows) {
  return flattenVisibleTree(rows, getExpandableKeys(rows));
}
