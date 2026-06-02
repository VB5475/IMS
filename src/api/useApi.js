// useApi.js — Custom hook with a global Axios interceptor
// ────────────────────────────────────────────────────────
// Every API call in the project goes through this single instance,
// so logging, auth headers, error normalization, etc. are applied
// in one place.
//
// ── get(endpoint, params) ────────────────────────────────────────────
// Accepts a plain-object `params` map.
// Serialises it to URLSearchParams internally — callers never touch
// URLSearchParams directly.
//
// Filtering rules applied before serialisation:
//   - null / undefined values are dropped
//   - empty-string values are KEPT (e.g. p_ErrMsg: '' must survive)
//   - all other values are kept as-is

import { useState, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from './constants';

// ── Shared Axios instance (singleton) ─────────────────────────────
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── REQUEST interceptor ───────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    console.log(
      `%c[API ➜] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
      'color:#6366f1;font-weight:600',
      config.params || ''
    );
    return config;
  },
  (error) => {
    console.error('[API ➜] Request setup error:', error);
    return Promise.reject(error);
  }
);

// ── RESPONSE interceptor ──────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => {
    console.log(
      `%c[API ✓] ${response.status} ${response.config.url}`,
      'color:#22c55e;font-weight:600'
    );
    return response.data;
  },
  (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);

    const status = error.response?.status;
    const url = error.config?.url;

    console.error(
      `%c[API ✗] ${status || 'NETWORK'} ${url}`,
      'color:#ef4444;font-weight:600',
      error.response?.data || error.message
    );

    return Promise.reject({
      status,
      message: error.response?.data?.message || error.message,
      raw: error,
    });
  }
);

// ── Export the raw client for non-hook contexts ───────────────────
export { apiClient };

// ── Internal helper: build URLSearchParams from a plain object ────
// Rules:
//   null / undefined  → dropped
//   everything else   → kept (including '' and 0 and -1)
function buildQueryString(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== null && v !== undefined);
  return new URLSearchParams(Object.fromEntries(entries)).toString();
}

// const JSON_PARAMS = ['prmStrMstJSON', 'prmStrDetJSON'];

// function buildQueryString(params = {}) {
//   const parts = Object.entries(params)
//     .filter(([, v]) => v !== null && v !== undefined)
//     .map(([k, v]) => {
//       const encoded = encodeURIComponent(v);
//       const decoded = JSON_PARAMS.includes(k)
//         ? encoded.replace(/%5B/gi, '[').replace(/%5D/gi, ']')
//         : encoded;
//       return `${k}=${decoded}`;
//     });
//   return parts.join('&');
// }
// ── Hook ──────────────────────────────────────────────────────────
/**
 * useApi — provides `get` and `post` helpers that track
 * loading / error state automatically.
 *
 * Usage:
 *   const { get } = useApi();
 *
 *   // Pass params as a plain object — URLSearchParams is built internally
 *   const data = await get('/GetFilters', { prmMasterID: 1 });
 *   const data = await get('/FN_Fetch_Data', {
 *     ObjType: 2,
 *     ObjName: 'Fn_Fetch_RBDetailByRBCode',
 *     JSon: JSON.stringify([{ prmRBCode: 'RB_SampleInvDet' }]),
 *     p_ErrCode: -1,
 *     p_ErrMsg: '',        // ← empty string is preserved
 *   });
 */
export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const activeRequests = useRef(0);

  const get = useCallback(async (url, params = {}) => {
    const qs = buildQueryString(params);
    const fullUrl = qs ? `${url}?${qs}` : url;

    activeRequests.current += 1;
    setLoading(true);
    setError(null);
    try {
      return await apiClient.get(fullUrl);
    } catch (err) {
      if (!axios.isCancel(err)) setError(err);
      throw err;
    } finally {
      activeRequests.current -= 1;
      if (activeRequests.current === 0) setLoading(false);
    }
  }, []);

  const post = useCallback(async (url, body = {}, params = {}) => {
    const qs = buildQueryString(params);
    const fullUrl = qs ? `${url}?${qs}` : url;

    activeRequests.current += 1;
    setLoading(true);
    setError(null);
    try {
      return await apiClient.post(fullUrl, body);
    } catch (err) {
      if (!axios.isCancel(err)) setError(err);
      throw err;
    } finally {
      activeRequests.current -= 1;
      if (activeRequests.current === 0) setLoading(false);
    }
  }, []);

  return useMemo(
    () => ({ get, post, loading, error, client: apiClient }),
    [get, post, loading, error]
  );
}
