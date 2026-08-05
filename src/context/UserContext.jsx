import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
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
import { ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, OBJ_TYPE } from "../api/constants";

initUserSession();

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => getUserSession());
  const { post } = useApi(API_BASE_URL_IMS);
  const { get } = useApi(API_BASE_URL);

  const login = useCallback(async (authRow, { companyId, yearId, company, year }) => {
    const next = buildSessionFromAuthRow(authRow, { companyId, yearId, company, year });
    setUserSession(next);
    setUser(next);

    // Two best-effort permission calls right after auth succeeds, in parallel.
    // Neither may block login: dmConfig stays null on failure (checks reading
    // it default-deny) and menuRights stays empty (which fails open).
    const dmConfigPromise = post(ENDPOINTS.DM_CONFIG, {
      prmyearid: next.yearId,
      prmloginid: next.loginId,
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
          prmloginid: next.loginId,
          prmcompanyid: next.companyId,
          prmyearid: next.yearId,
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

    const withPermissions = setUserSession({
      ...(dmConfig ? { dmConfig } : {}),
      menuRights,
    });
    setUser(withPermissions);
    return withPermissions;
  }, [post, get]);

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
