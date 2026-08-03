/**
 * Read a value from a QR JSON object by lowercase key name
 * (e.g. ItemCode / ITEMCODE / itemcode → "itemcode").
 */
export function pickQrJsonValue(obj, keyName) {
  if (!obj || typeof obj !== "object") return "";
  const want = String(keyName).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(obj, want) && obj[want] != null && obj[want] !== "") {
    return String(obj[want]).trim();
  }
  const found = Object.keys(obj).find((k) => String(k).toLowerCase() === want);
  if (!found) return "";
  const val = obj[found];
  return val == null ? "" : String(val).trim();
}

/**
 * Parse QR payload and normalize keys to lowercase itemcode / srno.
 * @returns {{ itemcode: string, srno: string } | null}
 */
export function parseQrItemPayload(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const itemcode = pickQrJsonValue(parsed, "itemcode");
  const srno = pickQrJsonValue(parsed, "srno");
  if (!itemcode || !srno) return null;
  return { itemcode, srno };
}
