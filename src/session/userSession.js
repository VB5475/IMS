// userSession.js — persisted session readable outside React (hooks, utils, API helpers)

const STORAGE_KEY = "ims_user_session";
/** Login `sessionid` — written on auth, cleared on logout; used by Enterprise Dashboard. */
const SESSION_ID_STORAGE_KEY = "ims_login_session_id";

export const DEFAULT_USER_SESSION = {
  isAuthenticated: false,
  loginId: 1,
  userId: "Admin",
  userName: "Administrator",
  companyId: 1,
  yearId: 1,
  sessionId: 0,
  company: null,
  year: null,
  userGroupId: null,
  desgId: null,
  departmentId: null,
  isAdminUser: false,
  isDepartmentHead: false,
  isDivisionHead: false,
  // Document Log permission flags (rb_dm_config, fetched once at login via
  // ENDPOINTS.DM_CONFIG) — null until fetched, or if the fetch fails/errors,
  // so any permission check reading this defaults to deny rather than crash.
  dmConfig: null,
// Per-module form rights (fn_tbl_fetchloginusermenudetail). Refetched on login
// and on every full reload of any authenticated page (RequireAuth remount).
// Read through session/moduleRights.js, which fails open on an empty list —
// see UNRESTRICTED there for why.
  menuRights: [],
};

let currentSession = { ...DEFAULT_USER_SESSION };

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_USER_SESSION,
      ...parsed,
      isAuthenticated: Boolean(parsed?.isAuthenticated),
      sessionId:
        Number(parsed?.sessionId)
        || Number(localStorage.getItem(SESSION_ID_STORAGE_KEY))
        || 0,
    };
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  writeStoredSessionId(session?.sessionId);
}

function writeStoredSessionId(sessionId) {
  const id = Number(sessionId) || 0;
  if (id > 0) {
    localStorage.setItem(SESSION_ID_STORAGE_KEY, String(id));
  } else {
    localStorage.removeItem(SESSION_ID_STORAGE_KEY);
  }
}

/** Login session id from localStorage (Enterprise Dashboard). */
export function getStoredSessionId() {
  const fromKey = Number(localStorage.getItem(SESSION_ID_STORAGE_KEY)) || 0;
  if (fromKey > 0) return fromKey;
  return Number(getUserSession()?.sessionId) || 0;
}

/** Hydrate in-memory session from localStorage (call once on app boot). */
export function initUserSession() {
  const stored = readStoredSession();
  if (stored) {
    currentSession = stored;
    writeStoredSessionId(stored.sessionId);
  }
  return currentSession;
}

/** Current session snapshot — safe to call from hooks, utils, and event handlers. */
export function getUserSession() {
  return currentSession;
}

export function setUserSession(partial) {
  currentSession = { ...currentSession, ...partial };
  if (currentSession.isAuthenticated) {
    writeStoredSession(currentSession);
  }
  return currentSession;
}

export function clearUserSession() {
  currentSession = { ...DEFAULT_USER_SESSION, isAuthenticated: false };
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSION_ID_STORAGE_KEY);
  return currentSession;
}

function pickRow(row, ...keys) {
  if (!row || typeof row !== "object") return undefined;
  for (const key of keys) {
    if (key in row && row[key] != null && row[key] !== "") return row[key];
    const lower = String(key).toLowerCase();
    const found = Object.keys(row).find((k) => k.toLowerCase() === lower);
    if (found !== undefined && row[found] != null && row[found] !== "") {
      return row[found];
    }
  }
  return undefined;
}

/**
 * Filters a Post_RB_DM_Config response down to exactly the 2 confirmed
 * permission flags (user-confirmed 2026-07-30) — everything else the
 * response carries (errcode/errmsg or anything else) is dropped, not just
 * the housekeeping fields. Returns null if the row is missing or the call
 * itself errored (errcode present and not 1) — callers should treat null
 * as "no permissions known" (default-deny).
 */
export function extractDmConfigPermissions(res) {
  const row = Array.isArray(res) ? res[0] : res;
  if (!row || typeof row !== "object") return null;

  const errcode = pickRow(row, "errcode", "ErrCode");
  if (errcode != null && Number(errcode) !== 1) return null;

  return {
    isdmrequired: pickRow(row, "isdmrequired", "IsDMRequired") ?? null,
    isdmdbbased: pickRow(row, "isdmdbbased", "IsDMDBBased") ?? null,
  };
}

function toBoolFlag(value) {
  if (typeof value === "boolean") return value;
  const n = Number(value);
  if (!Number.isNaN(n)) return n === 1;
  return Boolean(value);
}

/** Map auth API row + login selections into session fields. */
export function buildSessionFromAuthRow(row, { companyId, yearId, company, year }) {
  return {
    isAuthenticated: true,
    loginId:
      Number(pickRow(row, "idnumber", "loginid", "LoginID", "IDNumber"))
      || DEFAULT_USER_SESSION.loginId,
    userId: pickRow(row, "userid", "UserID") ?? DEFAULT_USER_SESSION.userId,
    userName: pickRow(row, "username", "UserName") ?? DEFAULT_USER_SESSION.userName,
    companyId: Number(companyId) || DEFAULT_USER_SESSION.companyId,
    yearId: Number(yearId) || DEFAULT_USER_SESSION.yearId,
    sessionId: Number(pickRow(row, "sessionid", "SessionID")) || 0,
    company: company ?? null,
    year: year ?? null,
    userGroupId:
      pickRow(row, "groupidnumber", "usergroupid", "UserGroupID") ?? null,
    desgId: pickRow(row, "desgid", "DesgID") ?? null,
    departmentId:
      pickRow(row, "deptid", "departmentid", "DepartmentID") ?? null,
    isAdminUser: toBoolFlag(pickRow(row, "isadminuser", "IsAdminUser")),
    isDepartmentHead: toBoolFlag(
      pickRow(row, "isdepthead", "isdepartmenthead", "IsDepartmentHead")
    ),
    isDivisionHead: toBoolFlag(
      pickRow(row, "isdivisionhead", "IsDivisionHead")
    ),
  };
}
