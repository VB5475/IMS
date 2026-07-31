/**
 * Normalizes IMS API payloads — handles string JSON, ASP.NET `d` wrapper, etc.
 */
function normalizeApiPayload(result) {
  if (result == null) return result;

  if (typeof result === "string") {
    try {
      return JSON.parse(result);
    } catch {
      return { ErrMsg: [{ ErrCode: "-1", ErrMsg: result }] };
    }
  }

  if (result.d !== undefined && result.d !== null) {
    const inner = result.d;
    if (typeof inner === "string") {
      try {
        return JSON.parse(inner);
      } catch {
        return { ErrMsg: [{ ErrCode: "-1", ErrMsg: inner }] };
      }
    }
    return inner;
  }

  return result;
}

function pickField(obj, ...keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function toErrEntries(payload) {
  if (!payload) return null;

  if (Array.isArray(payload) && payload.length > 0) {
    const first = payload[0];
    if (
      pickField(first, "ErrCode", "errCode", "p_ErrCode") !== undefined ||
      pickField(first, "ErrMsg", "errMsg", "p_ErrMsg") !== undefined
    ) {
      return payload;
    }
  }

  let entries = pickField(payload, "ErrMsg", "errMsg");
  if (entries && !Array.isArray(entries)) entries = [entries];
  if (Array.isArray(entries) && entries.length > 0) return entries;

  const tableRow = payload?.[0];
  if (
    tableRow &&
    (pickField(tableRow, "ErrCode", "errCode", "p_ErrCode") !== undefined ||
      pickField(tableRow, "ErrMsg", "errMsg", "p_ErrMsg") !== undefined)
  ) {
    return [tableRow];
  }

  const errCode = pickField(payload, "ErrCode", "errCode", "p_ErrCode");
  const errMsg = pickField(payload, "ErrMsg", "errMsg", "p_ErrMsg");
  if (errCode !== undefined || errMsg !== undefined) {
    return [{ ErrCode: errCode, ErrMsg: errMsg }];
  }

  return null;
}

/**
 * True when a row is a bare {ErrCode, ErrMsg} envelope (an SP that hit a SQL
 * error, or a "no data" sentinel like "There is no row at position 1", returns
 * this shape as its one and only "row" instead of throwing an HTTP error)
 * rather than real business data — a genuine data row never consists of only
 * these two bookkeeping fields. Shared across list pages, fetch hooks, and
 * grid rendering — don't re-copy this, several call sites used to each keep
 * their own identical copy before this was consolidated.
 */
export function isErrorOnlyRow(row) {
  if (!row || typeof row !== "object") return false;
  const keys = Object.keys(row).map((k) => k.toLowerCase());
  if (keys.length === 0 || !keys.includes("errcode")) return false;
  return keys.every((k) => k === "errcode" || k === "errmsg");
}

/**
 * Parses IMS save/API responses:
 * { ErrMsg: [{ ErrCode: "1"|"-1", ErrMsg: "..." }] }
 * ErrCode 1 = success, -1 = error — always show the backend ErrMsg text.
 */
export function parseApiErrMsg(result) {
  const payload = normalizeApiPayload(result);
  const entries = toErrEntries(payload);

  if (!entries?.length) {
    return {
      success: false,
      errCode: null,
      message: "Unexpected response from server.",
    };
  }

  const row = entries[0] ?? {};
  const errCode = Number(pickField(row, "ErrCode", "errCode", "p_ErrCode"));
  const message = String(pickField(row, "ErrMsg", "errMsg", "p_ErrMsg") ?? "").trim();

  return {
    success: errCode === 1,
    errCode,
    message: message || `Request failed (ErrCode ${errCode}).`,
  };
}
