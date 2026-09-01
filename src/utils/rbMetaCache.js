// rbMetaCache.js — client-side cache for RB *structure* metadata
// (GetDetailColData: captions, control types, validation rules, lock flags —
// the heavy payload every module's hook re-fetches on every page load).
//
// The RB-lookup call (Fn_Fetch_RBDetailByRBCode) now also returns "rbversion".
// That lookup is cheap and always fires; GetDetailColData is skipped whenever
// the cached rbversion for this RB code still matches what the lookup just
// returned. No manual "regenerate" step — the cache self-updates the moment
// a version bump is observed.
//
// Cache is scoped per backend project (IMS_LIVE / IMS_PGLIVE / MV_WSLIVE) —
// those have independently-configured RB metadata (different RBIDs/versions
// per module) that can drift out of sync, so a cache entry from one must
// never leak into another.
//
// Pilot (2026-08-29 /pm): Assets Health Status Updation only
// (useAstHealthStatus.js, both RB_MASTER and RB_DETAIL). Not yet adopted by
// any other module's hook — every hook still has its own copy-pasted
// RB-lookup + GetDetailColData fetch. Roll this out module-by-module rather
// than switching every hook over at once.

import { ENDPOINTS } from "../api/constants";
import { BASE_PROJECTS } from "../config/runtimeConfig";

const CACHE_PREFIX = "rbMetaCache:";
// Bump this to invalidate every cached entry in one shot if the stored shape
// ever changes (e.g. a new field gets added to what we persist).
const CACHE_SHAPE_VERSION = 1;

function resolveBaseProject(baseURL) {
  const found = BASE_PROJECTS.find((p) => baseURL?.includes(`/${p}/`));
  return found ?? "default";
}

function cacheKey(baseURL, rbCode) {
  return `${CACHE_PREFIX}${resolveBaseProject(baseURL)}:${rbCode}`;
}

function readCache(baseURL, rbCode) {
  try {
    const raw = localStorage.getItem(cacheKey(baseURL, rbCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.shapeVersion === CACHE_SHAPE_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(baseURL, rbCode, entry) {
  try {
    localStorage.setItem(
      cacheKey(baseURL, rbCode),
      JSON.stringify({ shapeVersion: CACHE_SHAPE_VERSION, ...entry })
    );
  } catch {
    // localStorage full/unavailable/private-mode — caching is a pure
    // optimization on top of the always-correct network fetch, safe to skip.
  }
}

/**
 * Resolves {meta, apiColumns} for one RB code, reusing the cached column
 * structure whenever the live rbversion still matches it. Return shape
 * mirrors every hook's existing loadRbDetailGridMeta-style helper, so this
 * is a drop-in replacement at the call site.
 *
 * @param {Function} get         bound API client from useApi(baseURL)
 * @param {string}   baseURL     the same baseURL `get` targets (for cache scoping)
 * @param {string}   rbCode      RB code to resolve, e.g. "rb_asthealstamst"
 * @param {object}   [options]
 * @param {string}   [options.spRbMeta="Fn_Fetch_RBDetailByRBCode"] RB-lookup SP name
 * @param {string}   [options.rbCodeParam="prmRBCode"] JSON param key the SP expects
 *   (varies by module — some hooks call it prmrbcode; case doesn't matter to
 *   the backend, but keep whatever the caller already used)
 * @param {number}   [options.loginId] prmLoginID for GetDetailColData
 * @param {string}   [options.storageKey] legacy localStorage key some hooks
 *   still read elsewhere for {RBID, SaveProcName} — written through unchanged
 *   for backward compat with that code, not part of the version cache itself
 */
export async function fetchRbStructure(get, baseURL, rbCode, {
  spRbMeta = "Fn_Fetch_RBDetailByRBCode",
  rbCodeParam = "prmRBCode",
  loginId,
  storageKey,
} = {}) {
  const lookup = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: spRbMeta,
    JSon: JSON.stringify([{ [rbCodeParam]: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  });
  const row = lookup?.[0];
  if (!row?.rbid) throw new Error(`No RB metadata returned for ${rbCode}.`);

  const meta = { RBID: row.rbid, SaveProcName: row.saveprocname };
  if (storageKey) localStorage.setItem(storageKey, JSON.stringify(meta));

  // rbversion missing (older/unrolled-out RB) → never trust a stale cache,
  // always refetch full structure.
  const rbversion = row.rbversion ?? null;
  const cached = rbversion != null ? readCache(baseURL, rbCode) : null;
  if (cached && cached.rbid === row.rbid && cached.rbversion === rbversion) {
    return { meta, apiColumns: cached.columns };
  }

  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID: loginId,
  });
  const apiColumns = colData || [];

  if (rbversion != null) {
    writeCache(baseURL, rbCode, { rbid: row.rbid, rbversion, columns: apiColumns, cachedAt: Date.now() });
  }

  return { meta, apiColumns };
}
