/** Column role from API flags: IsFreezeReq, IsEditAllow (or mapped isFixed / isEditAllow). */

import { isTruthyApiFlag } from "../../utils/gridUtils";

export function isColumnFixed(col) {
  if (!col) return false;
  if (col.isFixed === true) return true;
  return isTruthyApiFlag(col.IsFreezeReq);
}

export function isColumnEditable(col, opts = {}) {
  const { existingRecordEdit = false } = opts;
  if (isColumnFixed(col)) return false;
  if (existingRecordEdit && isTruthyApiFlag(col.lockOnEditMode ?? col.IsLockOnEditModeAllow)) {
    return false;
  }
  if (col.isEditAllow === false) return false;
  if (col.isEditAllow === true) return true;
  return isTruthyApiFlag(col.IsEditAllow);
}

export function getColumnCellClass(col, lastFixedColId, opts = {}) {
  const { existingRecordEdit = false, viewMode = false } = opts;

  if (viewMode && col.key !== "cb") {
    if (isColumnFixed(col)) {
      const classes = ["fixed-col", "view-col"];
      if (col.id === lastFixedColId) classes.push("last-fixed");
      return classes.join(" ");
    }
    return "view-col";
  }

  if (isColumnFixed(col)) {
    const classes = ["fixed-col"];
    if (col.id === lastFixedColId) classes.push("last-fixed");
    return classes.join(" ");
  }

  if (existingRecordEdit && isTruthyApiFlag(col.lockOnEditMode ?? col.IsLockOnEditModeAllow)) {
    return "frozen-col";
  }

  if (isColumnEditable(col, opts)) return "editable-col";
  return "readonly-col";
}

export function getColumnHeaderThemeClass(col, opts = {}) {
  const { existingRecordEdit = false, viewMode = false } = opts;

  if (viewMode && col.key !== "cb") {
    return isColumnFixed(col) ? "fixed-header view-header" : "view-header";
  }

  if (isColumnFixed(col)) return "fixed-header";

  if (existingRecordEdit && isTruthyApiFlag(col.lockOnEditMode ?? col.IsLockOnEditModeAllow)) {
    return "frozen-header";
  }

  if (isColumnEditable(col, opts)) return "editable-header";
  return "readonly-header";
}
