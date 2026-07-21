// userSession.js — persisted session readable outside React (hooks, utils, API helpers)

const STORAGE_KEY = "ims_user_session";

export const DEFAULT_USER_SESSION = {
  isAuthenticated: false,
  loginId: 1,
  userId: "Admin",
  userName: "Administrator",
  companyId: 1,
  yearId: 1,
  company: null,
  year: null,
  userGroupId: null,
  desgId: null,
  departmentId: null,
  isAdminUser: false,
  isDepartmentHead: false,
  isDivisionHead: false,
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
    };
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/** Hydrate in-memory session from localStorage (call once on app boot). */
export function initUserSession() {
  const stored = readStoredSession();
  if (stored) currentSession = stored;
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
  return currentSession;
}

// The live auth SP (Fn_tbl_FetchUserAuthenitcationDetail) returns lowercase
// PG-style keys (loginid, userid, username, ...) — read those first, with a
// PascalCase fallback only for safety against any legacy/SQL-Server caller.
function pickAuthField(row, lowerKey, pascalKey) {
  if (row?.[lowerKey] !== undefined && row[lowerKey] !== null && row[lowerKey] !== "") return row[lowerKey];
  if (row?.[pascalKey] !== undefined && row[pascalKey] !== null && row[pascalKey] !== "") return row[pascalKey];
  return undefined;
}

function isTruthyAuthFlag(value) {
  if (value === true || value === 1 || value === "1") return true;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return false;
}

/** Map auth API row + login selections into session fields. */
export function buildSessionFromAuthRow(row, { companyId, yearId, company, year }) {
  return {
    isAuthenticated: true,
    loginId: Number(pickAuthField(row, "loginid", "LoginID")) || DEFAULT_USER_SESSION.loginId,
    userId: pickAuthField(row, "userid", "UserID") ?? DEFAULT_USER_SESSION.userId,
    userName: pickAuthField(row, "username", "UserName") ?? DEFAULT_USER_SESSION.userName,
    companyId: Number(companyId) || DEFAULT_USER_SESSION.companyId,
    yearId: Number(yearId) || DEFAULT_USER_SESSION.yearId,
    company: company ?? null,
    year: year ?? null,
    userGroupId: pickAuthField(row, "usergroupid", "UserGroupID") ?? null,
    desgId: pickAuthField(row, "desgid", "DesgID") ?? null,
    departmentId: pickAuthField(row, "departmentid", "DepartmentID") ?? null,
    isAdminUser: isTruthyAuthFlag(pickAuthField(row, "isadminuser", "IsAdminUser")),
    isDepartmentHead: isTruthyAuthFlag(pickAuthField(row, "isdepartmenthead", "IsDepartmentHead")),
    isDivisionHead: isTruthyAuthFlag(pickAuthField(row, "isdivisionhead", "IsDivisionHead")),
  };
}
