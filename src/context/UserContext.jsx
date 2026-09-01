import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  buildSessionFromAuthRow,
  clearUserSession,
  extractDmConfigPermissions,
  getUserSession,
  initUserSession,
  setUserSession,
} from "../session/userSession";
import { extractMenuRights, MENU_RIGHTS_SP } from "../session/moduleRights";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, OBJ_TYPE } from "../api/constants";

initUserSession();

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => getUserSession());
  const { post } = useApi(API_BASE_URL_IMS);
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);
  // Share one in-flight request when login and the auth-shell remount both
  // ask for permissions at the same time (e.g. right after a successful login).
  const inflightRef = useRef(null);

  // Best-effort: a failure leaves menuRights as [] (fail-open) and dmConfig as
  // null (default-deny for DM). Called from login and from RequireAuth on every
  // full reload of any authenticated page.
  const refreshPermissions = useCallback(
    async (session = getUserSession()) => {
      if (!session?.isAuthenticated) return session;
      if (inflightRef.current) return inflightRef.current;

      inflightRef.current = (async () => {
        try {
          const dmConfigPromise = post(ENDPOINTS.DM_CONFIG, {
            prmyearid: session.yearId,
            prmloginid: session.loginId,
          })
            .then(extractDmConfigPermissions)
            .catch((err) => {
              console.warn("[UserContext] DM Config fetch failed:", err);
              return null;
            });

          const menuRightsPromise = get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: OBJ_TYPE.FUNCTION,
            ObjName: MENU_RIGHTS_SP,
            JSon: JSON.stringify([
              {
                prmloginid: session.loginId,
                prmcompanyid: session.companyId,
                prmyearid: session.yearId,
              },
            ]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          })
            .then(extractMenuRights)
            .catch((err) => {
              console.warn("[UserContext] Menu rights fetch failed:", err);
              return [];
            });

          const [dmConfig, menuRights] = await Promise.all([dmConfigPromise, menuRightsPromise]);

          if (!getUserSession().isAuthenticated) return getUserSession();

          const withPermissions = setUserSession({
            ...(dmConfig ? { dmConfig } : {}),
            menuRights,
          });
          setUser(withPermissions);
          return withPermissions;
        } finally {
          inflightRef.current = null;
        }
      })();

      return inflightRef.current;
    },
    [post, get]
  );

  const login = useCallback(async (authRow, { companyId, yearId, company, year }) => {
    const next = buildSessionFromAuthRow(authRow, { companyId, yearId, company, year });
    // Clear previous login's permissions until the fetch below fills them.
    const pending = { ...next, menuRights: [], dmConfig: null };
    setUserSession(pending);
    setUser(pending);
    return refreshPermissions(pending);
  }, [refreshPermissions]);

  const logout = useCallback(() => {
    const next = clearUserSession();
    setUser(next);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user.isAuthenticated,
      loginId: user.loginId,
      userId: user.userId,
      userName: user.userName,
      companyId: user.companyId,
      yearId: user.yearId,
      company: user.company,
      year: user.year,
      // Identity changes when rights are (re)fetched — consumers that gate UI
      // on module rights depend on this to recompute.
      menuRights: user.menuRights,
      refreshPermissions,
      login,
      logout,
    }),
    [user, refreshPermissions, login, logout]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}
