// userSession.js — persisted session readable outside React (hooks, utils, API helpers)

const STORAGE_KEY = "ims_user_session";

export const DEFAULT_USER_SESSION = {
  isAuthenticated: false,
  loginId: 1,
  userId: "Admin",
  userName: "Administrator",
  companyId: 1,
  yearId: 1,
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

/** Map auth API row + login selections into session fields. */
export function buildSessionFromAuthRow(row, { companyId, yearId }) {
  return {
    isAuthenticated: true,
    loginId: Number(row.LoginID) || DEFAULT_USER_SESSION.loginId,
    userId: row.UserID ?? DEFAULT_USER_SESSION.userId,
    userName: row.UserName ?? DEFAULT_USER_SESSION.userName,
    companyId: Number(companyId) || DEFAULT_USER_SESSION.companyId,
    yearId: Number(yearId) || DEFAULT_USER_SESSION.yearId,
    userGroupId: row.UserGroupID ?? null,
    desgId: row.DesgID ?? null,
    departmentId: row.DepartmentID ?? null,
    isAdminUser: Boolean(row.IsAdminUser),
    isDepartmentHead: Boolean(row.IsDepartmentHead),
    isDivisionHead: Boolean(row.IsDivisionHead),
  };
}
