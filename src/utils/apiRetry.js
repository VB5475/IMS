// apiRetry.js — generic retry wrapper for a single async API call.
//
// Retries only when the call itself throws/rejects (network error, timeout,
// non-2xx HTTP status) — never on a call that resolves normally, even one
// whose JSON payload carries a business-logic error (this app's ErrCode/
// ErrMsg convention, see utils/apiResponse.js's parseApiErrMsg). useApi's
// get/post (src/api/useApi.js) only reject on a real transport/HTTP
// failure, so that resolve/reject boundary already is the right one to
// retry on — no separate "is this a business error" check needed here.
//
// Pilot (2026-08-29 /pm): Assets Employee Issue only (useAstEmpIssue.js +
// AssetsEmployeeIssueForm.jsx's read calls). Not yet adopted by any other
// module. Retry count is dynamic, read from public/config.json's
// apiRetryCount on every call (see src/config/runtimeConfig.js) — no
// rebuild needed to change it.

import { getApiRetryCount } from "../config/runtimeConfig";

/**
 * Attempts `fn`, retrying on failure up to the configured (or given) extra
 * attempt count. Resolves with the first successful result; rejects with
 * the last error once the budget is exhausted.
 *
 * @param {() => Promise<T>} fn - the call to attempt, e.g. () => get(url, params)
 * @param {object} [options]
 * @param {number} [options.retries] - extra attempts after the first failure;
 *   defaults to the configured apiRetryCount (public/config.json)
 * @param {(error: unknown, attempt: number) => void} [options.onRetry] - called
 *   right before each retry attempt (attempt is 1-based)
 * @returns {Promise<T>}
 */
export async function callWithRetry(fn, { retries, onRetry } = {}) {
  const maxRetries = retries ?? getApiRetryCount();
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;
      onRetry?.(err, attempt + 1);
    }
  }

  throw lastError;
}

/**
 * Wraps a useApi-style `get(url, params)` function so every call through it
 * retries automatically on failure.
 *
 * Read-only calls only — do NOT wrap a mutating call (e.g. a Save `post`)
 * with this without first confirming the backend is idempotent. A network
 * error can happen after the server already committed a write; blindly
 * retrying a lost-response Save risks submitting it twice.
 */
export function withGetRetry(get, options) {
  return (url, params) => callWithRetry(() => get(url, params), options);
}
