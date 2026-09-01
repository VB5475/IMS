// runtimeConfig.js — reads public/config.json at boot.
//
// The file ships unbundled in public/ so a deployed server's API environment
// can be changed by editing one file and reloading, with no rebuild.
// `apiMode` is one of:
//   "IMS_LIVE"   — pin the app to the IMS_LIVE backend, hide the switcher
//   "IMS_PGLIVE" — pin the app to the IMS_PGLIVE backend, hide the switcher
//   "MV_WSLIVE"  — pin the app to the MV_WSLIVE backend, hide the switcher
//   "ALL"        — show the switcher and let the user pick from all of the
//                  above; the choice is remembered in localStorage
//
// loadRuntimeConfig() MUST resolve before anything imports src/api/constants.js,
// which reads the base project once at module scope — see src/main.jsx.

export const BASE_PROJECTS = Object.freeze(["IMS_LIVE", "IMS_PGLIVE", "MV_WSLIVE"]);
export const API_MODES = Object.freeze([...BASE_PROJECTS, "ALL"]);
export const UI_GUARD_OPTIONS = Object.freeze(["Yes", "No"]);

const DEFAULT_API_MODE = "ALL";
const DEFAULT_UI_GUARD_IS_ALLOW = "Yes";
const DEFAULT_BASE_DOMAIN = "http://122.179.135.100:8095/";
// Extra attempts after the first failed API call, before giving up — see
// src/utils/apiRetry.js. Pilot (2026-08-29 /pm): Assets Employee Issue only.
const DEFAULT_API_RETRY_COUNT = 1;
const PROJECT_STORAGE_KEY = "ims_base_project";

let apiMode = DEFAULT_API_MODE;
let uiGuardIsAllow = DEFAULT_UI_GUARD_IS_ALLOW;
let baseDomain = DEFAULT_BASE_DOMAIN;
let apiRetryCount = DEFAULT_API_RETRY_COUNT;

export async function loadRuntimeConfig() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`config.json responded ${res.status}`);
    const config = await res.json();

    const mode = config?.apiMode;
    if (!API_MODES.includes(mode)) {
      throw new Error(`apiMode "${mode}" is not one of ${API_MODES.join(", ")}`);
    }
    apiMode = mode;

    const guardFlag = config?.uiGuardIsAllow;
    uiGuardIsAllow = UI_GUARD_OPTIONS.includes(guardFlag) ? guardFlag : DEFAULT_UI_GUARD_IS_ALLOW;

    const domain = config?.baseDomain;
    baseDomain = typeof domain === "string" && domain.trim()
      ? (domain.endsWith("/") ? domain : `${domain}/`)
      : DEFAULT_BASE_DOMAIN;

    const retryRaw = Number(config?.apiRetryCount);
    apiRetryCount = Number.isFinite(retryRaw) && retryRaw >= 0 ? retryRaw : DEFAULT_API_RETRY_COUNT;
  } catch (err) {
    console.error(`[config] Using default apiMode "${DEFAULT_API_MODE}":`, err);
    apiMode = DEFAULT_API_MODE;
    uiGuardIsAllow = DEFAULT_UI_GUARD_IS_ALLOW;
    baseDomain = DEFAULT_BASE_DOMAIN;
    apiRetryCount = DEFAULT_API_RETRY_COUNT;
  }
  return apiMode;
}

export function getApiMode() {
  return apiMode;
}

/** UI Guard's isAllow flag — see src/config/uiGuardConfig.js. */
export function getUiGuardIsAllow() {
  return uiGuardIsAllow;
}

/** Root server URL (protocol + host + port, trailing slash) — see src/api/constants.js. */
export function getBaseDomain() {
  return baseDomain;
}

/**
 * Extra attempts after the first failed API call (network error/exception)
 * before giving up — e.g. 1 means try once, retry once more on failure (2
 * attempts total). 0 disables retry. See src/utils/apiRetry.js.
 */
export function getApiRetryCount() {
  return apiRetryCount;
}

/** The switcher only makes sense when the deployment allows both backends. */
export function isEnvSwitcherEnabled() {
  return apiMode === "ALL";
}

/** Backend to talk to — pinned by config.json, or the user's pick under "ALL". */
export function getBaseProject() {
  if (apiMode !== "ALL") return apiMode;
  const stored = localStorage.getItem(PROJECT_STORAGE_KEY);
  return BASE_PROJECTS.includes(stored) ? stored : BASE_PROJECTS[0];
}

export function setBaseProject(name) {
  localStorage.setItem(PROJECT_STORAGE_KEY, name);
  window.location.reload();
}
