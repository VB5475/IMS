/**
 * Excel-like keyboard navigation for data-entry grids.
 *
 * Tab / Shift+Tab  → next / previous editable cell (wraps rows)
 * Enter / Shift+Enter → cell below / above (same column)
 * Arrow keys       → move between cells (respects text cursor at boundaries)
 * Space            → toggle row checkbox when focused on a row selector
 */

export const GRID_FOCUSABLE_SELECTOR = [
  'tbody input[type="checkbox"]',
  'tbody input.cell-input:not([disabled]):not([readonly])',
  'tbody textarea.cell-textarea:not([disabled]):not([readonly])',
  'tbody .search-select__trigger:not([disabled])',
].join(', ');

function isDropdownOpen(target) {
  return Boolean(
    target?.closest?.('.search-select--open')
    || target?.closest?.('.search-select__dropdown'),
  );
}

function getDataRows(root) {
  return [...root.querySelectorAll('tbody tr')].filter(
    (tr) => !tr.classList.contains('eg-child-row')
      && !tr.querySelector('td[colspan]'),
  );
}

function getCellTarget(td, readOnly) {
  if (!td) return null;
  const checkbox = td.querySelector('input[type="checkbox"]');
  if (checkbox) return checkbox;
  if (readOnly) return null;
  return td.querySelector(
    'input.cell-input:not([disabled]):not([readonly]), '
    + 'textarea.cell-textarea:not([disabled]):not([readonly]), '
    + '.search-select__trigger:not([disabled])',
  );
}

function getHeaderCheckboxRow(root, colCount) {
  const headerCb = root.querySelector('thead input[type="checkbox"]');
  if (!headerCb) return null;

  const row = Array(colCount).fill(null);
  const headerCells = root.querySelectorAll('thead tr th');
  headerCells.forEach((th, index) => {
    if (index < colCount && th.querySelector('input[type="checkbox"]')) {
      row[index] = headerCb;
    }
  });

  if (!row.some(Boolean)) {
    row[0] = headerCb;
  }

  return row;
}

export function buildCellMatrix(root, readOnly = false, options = {}) {
  const { includeHeaderRow = false } = options;
  const bodyMatrix = getDataRows(root).map((tr) => (
    [...tr.querySelectorAll('td')].map((td) => getCellTarget(td, readOnly))
  ));

  if (!includeHeaderRow || bodyMatrix.length === 0) return bodyMatrix;

  const headerRow = getHeaderCheckboxRow(root, bodyMatrix[0].length);
  if (!headerRow) return bodyMatrix;

  return [headerRow, ...bodyMatrix];
}

function findPosition(matrix, element) {
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      const target = matrix[row][col];
      if (target && (target === element || target.contains(element))) {
        return { row, col };
      }
    }
  }
  return null;
}

function focusTarget(target) {
  if (!target) return false;
  target.focus();
  if (target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'number')) {
    target.select();
  }
  return true;
}

function scanForTarget(matrix, startRow, startCol, dRow, dCol) {
  const rowCount = matrix.length;
  if (rowCount === 0) return null;

  const colCount = matrix[0].length;
  let row = startRow;
  let col = startCol;
  const maxSteps = rowCount * colCount + 1;

  for (let step = 0; step < maxSteps; step += 1) {
    row += dRow;
    col += dCol;

    if (col >= colCount) {
      col = 0;
      row += 1;
    } else if (col < 0) {
      col = colCount - 1;
      row -= 1;
    }

    if (row < 0 || row >= rowCount) return null;

    const target = matrix[row][col];
    if (target) return target;
  }

  return null;
}

function moveFocus(matrix, pos, dRow, dCol) {
  const target = scanForTarget(matrix, pos.row, pos.col, dRow, dCol);
  return focusTarget(target);
}

function shouldNavigateOnArrow(e) {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    return true;
  }

  if (el instanceof HTMLTextAreaElement) {
    return false;
  }

  if (el.type === 'checkbox' || el.type === 'date') {
    return true;
  }

  if (el.type !== 'text' && el.type !== 'number') {
    return true;
  }

  const { selectionStart, selectionEnd, value } = el;
  if (e.key === 'ArrowLeft' && selectionStart === 0 && selectionEnd === 0) return true;
  if (e.key === 'ArrowRight' && selectionStart === value.length && selectionEnd === value.length) {
    return true;
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') return true;
  return false;
}

function getRowIdFromTarget(target) {
  const tr = target.closest('tbody tr');
  if (!tr) return null;
  return tr.getAttribute('data-eg-row-id');
}

/**
 * Handle a keydown event originating from inside a grid.
 * Returns true when the event was handled (caller should preventDefault).
 */
export function handleGridKeyboardEvent(e, {
  root,
  readOnly = false,
  includeHeaderRow = false,
  onToggleRow = null,
}) {
  if (!root || isDropdownOpen(e.target)) return false;

  const matrix = buildCellMatrix(root, readOnly, { includeHeaderRow });
  if (matrix.length === 0) return false;

  const pos = findPosition(matrix, e.target);
  if (!pos) return false;

  const { key, shiftKey } = e;

  if (key === ' ' && e.target instanceof HTMLInputElement && e.target.type === 'checkbox') {
    return false;
  }

  if (key === ' ' && onToggleRow) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return false;
    }
    if (e.target.closest('.search-select__trigger')) {
      return false;
    }
    const rowId = getRowIdFromTarget(e.target);
    if (rowId) {
      e.preventDefault();
      onToggleRow(rowId);
      return true;
    }
  }

  if (key === 'Tab') {
    const moved = moveFocus(matrix, pos, 0, shiftKey ? -1 : 1);
    if (moved) {
      e.preventDefault();
      return true;
    }
    return false;
  }

  if (key === 'Enter' && !shiftKey) {
    if (e.target instanceof HTMLTextAreaElement) return false;
    if (e.target instanceof HTMLElement) e.target.blur();
    const moved = moveFocus(matrix, pos, 1, 0);
    if (moved) e.preventDefault();
    return moved;
  }

  if (key === 'Enter' && shiftKey) {
    if (e.target instanceof HTMLTextAreaElement) return false;
    if (e.target instanceof HTMLElement) e.target.blur();
    const moved = moveFocus(matrix, pos, -1, 0);
    if (moved) e.preventDefault();
    return moved;
  }

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
    if (!shouldNavigateOnArrow(e)) return false;

    const deltas = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const [dRow, dCol] = deltas[key];
    e.preventDefault();
    if (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox') {
      e.target.blur();
    }
    return moveFocus(matrix, pos, dRow, dCol);
  }

  return false;
}

export function focusFirstGridCell(root, readOnly = false, options = {}) {
  const { includeHeaderRow = false } = options;
  const matrix = buildCellMatrix(root, readOnly, { includeHeaderRow });
  const startRow = includeHeaderRow && matrix.length > 1 ? 1 : 0;
  for (let row = startRow; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (focusTarget(matrix[row][col])) return true;
    }
  }
  return false;
}
