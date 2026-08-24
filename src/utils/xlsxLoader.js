/** Shared dynamic import for SheetJS — keeps ~400KB out of unrelated route chunks. */
let xlsxPromise = null;

export function loadXlsx() {
  if (!xlsxPromise) {
    xlsxPromise = import("xlsx");
  }
  return xlsxPromise;
}
