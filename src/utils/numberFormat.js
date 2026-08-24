/**
 * Format a numeric value for display using locale grouping from InputFormat.
 * @param {unknown} value
 * @param {string} [format] - e.g. "IN", "INR", "US", "USD"
 * @param {number} [decimalPlaces]
 * @returns {string}
 */
export function formatNumber(value, format = "", decimalPlaces = 0) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return "";

  const localeKey = String(format ?? "").trim().toUpperCase();

  const localeMap = {
    IN: "en-IN",
    INR: "en-IN",
    US: "en-US",
    USD: "en-US",
  };

  return new Intl.NumberFormat(localeMap[localeKey] ?? "en-US", {
    useGrouping: localeKey in localeMap,
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(num);
}

/** Strip locale grouping separators so edited/displayed numbers can be parsed. */
export function parseNumberInput(value) {
  if (value == null || value === "") return "";
  return String(value).replace(/,/g, "").trim();
}

/**
 * Keep only valid numeric characters — blocks alphabets and stray symbols.
 * @param {unknown} value
 * @param {number} [decimalPlaces]
 * @returns {string}
 */
export function sanitizeNumericInput(value, decimalPlaces = 0) {
  if (value == null || value === "") return "";

  let s = parseNumberInput(value).replace(/[a-zA-Z]/g, "");
  const negative = s.startsWith("-");
  s = s.replace(/-/g, "");

  if (decimalPlaces === 0) {
    const digits = s.replace(/\D/g, "");
    // Preserve a lone "-" (no digits yet) as a valid in-progress state —
    // otherwise typing "-" first in an empty field gets silently dropped
    // and the sign never sticks for the digits typed after it.
    return negative ? `-${digits}` : digits;
  }

  let intPart = "";
  let decPart = "";
  let dotSeen = false;
  let trailingDot = false;

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch >= "0" && ch <= "9") {
      if (!dotSeen) intPart += ch;
      else if (decPart.length < decimalPlaces) decPart += ch;
    } else if (ch === "." && !dotSeen) {
      dotSeen = true;
      trailingDot = true;
    } else if (ch === "." && dotSeen) {
      break;
    }
  }

  if (dotSeen && decPart.length > 0) trailingDot = false;
  if (dotSeen && s.endsWith(".") && decPart.length === 0) trailingDot = true;

  let out = dotSeen ? (trailingDot ? `${intPart}.` : `${intPart}.${decPart}`) : intPart;
  // Same lone-"-" preservation as the decimalPlaces===0 branch above — keep
  // the sign even before any digits/decimal are typed.
  if (negative) {
    out = out.startsWith("-") ? out : `-${out}`;
  }
  return out;
}

const NUMERIC_ALLOWED_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

/**
 * Prevent alphabetic and invalid keys in numeric inputs.
 * @param {KeyboardEvent} e
 * @param {number} [decimalPlaces]
 */
export function handleNumericKeyDown(e, decimalPlaces = 0) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (NUMERIC_ALLOWED_KEYS.has(e.key)) return;

  const input = e.target;
  const val = input?.value ?? "";
  const start = input?.selectionStart ?? 0;

  if (e.key === "-" && start === 0 && !val.includes("-")) return;
  if (e.key === "." && decimalPlaces > 0 && !val.includes(".")) return;
  if (/^\d$/.test(e.key)) return;

  e.preventDefault();
}
