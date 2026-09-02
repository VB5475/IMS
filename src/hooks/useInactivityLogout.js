// useInactivityLogout.js — forces logout once the shared auto-logout budget
// (src/utils/activityClock.js) hits zero. As of 2026-09-01 that budget is
// driven purely by tab visibility, not mouse/keyboard activity: it only
// depletes while this tab is backgrounded, and freezes the instant it's
// focused again — see activityClock.js for the full rationale. This hook
// just polls the shared budget and acts on it; useAutoLogoutCountdown.js
// reads the same budget to drive the header display, so the two can never
// drift apart.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { getRemainingMs, resetAutoLogoutBudget } from "../utils/activityClock";

const CHECK_INTERVAL_MS = 5000;

export function useInactivityLogout() {
  const { isAuthenticated, logout } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    resetAutoLogoutBudget();

    const intervalId = setInterval(() => {
      if (getRemainingMs() <= 0) {
        logout();
        navigate("/login", { replace: true });
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, logout, navigate]);
}
