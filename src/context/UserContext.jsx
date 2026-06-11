import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  buildSessionFromAuthRow,
  clearUserSession,
  getUserSession,
  initUserSession,
  setUserSession,
} from "../session/userSession";

initUserSession();

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => getUserSession());

  const login = useCallback((authRow, { companyId, yearId }) => {
    const next = buildSessionFromAuthRow(authRow, { companyId, yearId });
    setUserSession(next);
    setUser(next);
    return next;
  }, []);

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
