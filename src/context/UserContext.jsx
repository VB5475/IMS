import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  buildSessionFromAuthRow,
  clearUserSession,
  extractDmConfigPermissions,
  getUserSession,
  initUserSession,
  setUserSession,
} from "../session/userSession";
import { useApi } from "../api/useApi";
import { ENDPOINTS, API_BASE_URL_IMS } from "../api/constants";

initUserSession();

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => getUserSession());
  const { post } = useApi(API_BASE_URL_IMS);

  const login = useCallback(async (authRow, { companyId, yearId, company, year }) => {
    const next = buildSessionFromAuthRow(authRow, { companyId, yearId, company, year });
    setUserSession(next);
    setUser(next);

    // Document Log permissions — best-effort, one extra call right after
    // auth succeeds. A failure here must not block login itself; dmConfig
    // just stays null (permission checks default-deny on that).
    try {
      const dmConfigRes = await post(ENDPOINTS.DM_CONFIG, { prmyearid: next.yearId, prmloginid: next.loginId });
      const dmConfig = extractDmConfigPermissions(dmConfigRes);
      if (dmConfig) {
        const withPermissions = setUserSession({ dmConfig });
        setUser(withPermissions);
        return withPermissions;
      }
    } catch (err) {
      console.warn("[UserContext] DM Config fetch failed:", err);
    }
    return next;
  }, [post]);

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
      login,
      logout,
    }),
    [user, login, logout]
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
