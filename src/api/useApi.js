// useApi.js — Custom hook with a global Axios interceptor
// ────────────────────────────────────────────────────────
// Every API call in the project goes through this single instance,
// so logging, auth headers, error normalization, etc. are applied
// in one place.
//
// Pass an optional baseURL to target a different server (e.g. API_BASE_URL_OLD).
//
// ── get(endpoint, params) ────────────────────────────────────────────
// Accepts a plain-object `params` map.
// Serialises it to URLSearchParams internally — callers never touch
// URLSearchParams directly.

import { useState, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from './constants';

function attachInterceptors(client) {
  client.interceptors.request.use(
    (config) => {
      console.log(
        `%c[API ➜] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
        'color:#6366f1;font-weight:600',
        config.params || '',
      );
      return config;
    },
    (error) => {
      console.error('[API ➜] Request setup error:', error);
      return Promise.reject(error);
    },
  );

  client.interceptors.response.use(
    (response) => {
      console.log(
        `%c[API ✓] ${response.status} ${response.config.url}`,
        'color:#22c55e;font-weight:600',
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
        error.response?.data || error.message,
      );

      return Promise.reject({
        status,
        message: error.response?.data?.message || error.message,
        raw: error,
      });
    },
  );
}

const clientCache = new Map();

/** Returns a cached axios client for the given base URL. */
export function getApiClient(baseURL = API_BASE_URL) {
  if (!clientCache.has(baseURL)) {
    const client = axios.create({
      baseURL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    attachInterceptors(client);
    clientCache.set(baseURL, client);
  }
  return clientCache.get(baseURL);
}

/** Default client — IMS_LIVE */
export const apiClient = getApiClient(API_BASE_URL);

function buildQueryString(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== null && v !== undefined);
  return new URLSearchParams(Object.fromEntries(entries)).toString();
}

/**
 * useApi — provides `get` and `post` helpers that track loading / error state.
 * @param {string} [baseURL] — defaults to API_BASE_URL
 */
export function useApi(baseURL = API_BASE_URL) {
  const client = useMemo(() => getApiClient(baseURL), [baseURL]);
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
      return await client.get(fullUrl);
    } catch (err) {
      if (!axios.isCancel(err)) setError(err);
      throw err;
    } finally {
      activeRequests.current -= 1;
      if (activeRequests.current === 0) setLoading(false);
    }
  }, [client]);

  const post = useCallback(async (url, body = {}, params = {}) => {
    const qs = buildQueryString(params);
    const fullUrl = qs ? `${url}?${qs}` : url;

    activeRequests.current += 1;
    setLoading(true);
    setError(null);
    try {
      return await client.post(fullUrl, body);
    } catch (err) {
      if (!axios.isCancel(err)) setError(err);
      throw err;
    } finally {
      activeRequests.current -= 1;
      if (activeRequests.current === 0) setLoading(false);
    }
  }, [client]);

  // GET with a JSON request body (mirrors: --request GET --header 'Content-Type: application/json' --data '{...}').
  // Uses client.request() instead of client.get() to guarantee Axios serialises
  // and sends the body even though the HTTP verb is GET.
  const getWithBody = useCallback(async (url, body = {}) => {
    activeRequests.current += 1;
    setLoading(true);
    setError(null);
    try {
      return await client.request({
        method: 'GET',
        url,
        data: body,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      if (!axios.isCancel(err)) setError(err);
      throw err;
    } finally {
      activeRequests.current -= 1;
      if (activeRequests.current === 0) setLoading(false);
    }
  }, [client]);

  return useMemo(
    () => ({ get, post, getWithBody, loading, error, client, baseURL }),
    [get, post, getWithBody, loading, error, client, baseURL],
  );
}
