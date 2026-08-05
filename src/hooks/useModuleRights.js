// useModuleRights — rights for the module the user is currently on.
//
// Resolves the RB code from the matched route id first (module routes set
// `id` to the RB code) and falls back to the pathname, so it works for both
// rbModule routes and plain rbLeaf pages. Pass an explicit rbCode to ask
// about a module other than the current one.

import { useMemo } from "react";
import { useLocation, useMatches } from "react-router-dom";
import { findRbByPath, findRbFromMatches } from "../constants/rbCodes";
import { getModuleRights } from "../session/moduleRights";
import { useUser } from "../context/UserContext";

export function useModuleRights(rbCode) {
  const matches = useMatches();
  const { pathname } = useLocation();
  const { menuRights } = useUser();

  return useMemo(() => {
    const rb = rbCode ?? findRbFromMatches(matches) ?? findRbByPath(pathname);
    return getModuleRights(rb);
    // menuRights is not read directly — it is the signal that the underlying
    // rights table changed (login / logout) and the lookup must run again.
  }, [rbCode, matches, pathname, menuRights]);
}

export default useModuleRights;
