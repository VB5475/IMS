/** Column role from API flags: IsFreezeReq, IsEditAllow (or mapped isFixed / isEditAllow). */

import { isTruthyApiFlag } from '../../utils/gridUtils';

export function isColumnFixed(col) {
  if (!col) return false;
  if (col.isFixed === true) return true;
  return isTruthyApiFlag(col.IsFreezeReq);
}

export function isColumnEditable(col) {
  if (isColumnFixed(col)) return false;
  if (col.isEditAllow === true) return true;
  return isTruthyApiFlag(col.IsEditAllow);
}

export function getColumnCellClass(col, lastFixedColId) {
  if (isColumnFixed(col)) {
    const classes = ['fixed-col'];
    if (col.id === lastFixedColId) classes.push('last-fixed');
    return classes.join(' ');
  }
  if (isColumnEditable(col)) return 'editable-col';
  return 'readonly-col';
}

export function getColumnHeaderThemeClass(col) {
  if (isColumnFixed(col)) return 'fixed-header';
  if (isColumnEditable(col)) return 'editable-header';
  return 'readonly-header';
}
