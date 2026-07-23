/**
 * Resolve the primary key for opening a list row in edit mode.
 * Uses common API id fields — casing may differ per endpoint.
 */
export function resolveListRowId(row) {
  if (!row || typeof row !== "object") return null;
  const id =
    row.IDNumber ??
    row.idnumber ??
    row.id ??
    row.UserID ??
    row.userid ??
    row.GroupID ??
    row.groupid ??
    row.Itemcode ??
    row.itemcode;
  return id != null && id !== "" ? id : null;
}

function isIdNumberKey(key) {
  return String(key).replace(/\s+/g, "").toLowerCase() === "idnumber";
}

/** Column keys for the list grid — idnumber is a row-id reference only, never a display column. */
function extractListKeys(data, excludeSet) {
  if (!Array.isArray(data) || data.length === 0) return [];

  const isExcluded = (key) => excludeSet.has(key) || isIdNumberKey(key);

  const keys = Object.keys(data[0]).filter((key) => !isExcluded(key));
  const seen = new Set(keys);

  for (let i = 1; i < data.length; i += 1) {
    Object.keys(data[i]).forEach((key) => {
      if (!isExcluded(key) && !seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    });
  }

  return keys;
}

/**
 * Build list grid columns from list API row keys and GET_DETAIL_COL_DATA labels.
 * Column keys and order come only from the list API response.
 */
export function buildListColumnsFromApi({
  data = [],
  fieldDefs = [],
  onEdit,
  renderEditCell,
  excludeKeys = [],
}) {
  const excludeSet = new Set([
    ...excludeKeys,
    "idnumber",
    "IDNumber",
    "IDNUMBER",
  ]);
  const labelMap = new Map(
    (fieldDefs || []).flatMap((field) => {
      const colName = field.ColName ?? field.colname;
      const displayName = (field.DisplayName ?? field.displayname)?.trim();
      if (!colName) return [];
      const label = displayName || colName;
      return [[colName, label], [colName.toLowerCase(), label]];
    })
  );

  const orderedKeys = extractListKeys(data, excludeSet);

  const dataColumns = orderedKeys.map((key) => ({
    key,
    label: labelMap.get(key) ?? key,
    filterable: true,
    align: "left",
  }));

  if (!renderEditCell) return dataColumns;

  return [
    ...dataColumns,
    {
      key: "_actions",
      label: "Edit",
      width: "8%",
      align: "center",
      render: (_value, row) => renderEditCell(row, onEdit),
    },
  ];
}
