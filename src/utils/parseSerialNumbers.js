/**
 * Splits raw clipboard / typed text into an array of serial number tokens.
 *
 * Accepted delimiters: comma, tab, newline (LF / CRLF), pipe.
 * Each token is trimmed; empty tokens are dropped.
 *
 * Returns [] when fewer than 2 valid tokens are found — callers MUST treat
 * that as a normal single-value input and must NOT intercept the event.
 *
 * Reusable by any module: PV, PO, PI, etc.
 * The caller decides which column(s) trigger this behaviour.
 *
 * @param {string} text  Raw clipboard or input text
 * @returns {string[]}   Trimmed, non-empty tokens (length >= 2) or []
 */
export function parseSerialNumbers(text) {
  if (!text || typeof text !== "string") return [];
  const tokens = text
    .split(/[\r\n,\t|]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  return tokens.length >= 2 ? tokens : [];
}
