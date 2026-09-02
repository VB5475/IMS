// useAutoLogoutCountdown.js — read-only display companion to
// useInactivityLogout.js. Ticks once a second (a countdown display is
// expected to update periodically) and reads the same shared activityClock
// budget, so the header timer and the actual enforcement can never drift
// apart from each other.
import { useEffect, useState } from "react";
import { useUser } from "../context/UserContext";
import { INACTIVITY_LIMIT_MS, getRemainingMs } from "../utils/activityClock";

const TICK_MS = 1000;

export function useAutoLogoutCountdown() {
  const { isAuthenticated } = useUser();
  const [remainingMs, setRemainingMs] = useState(INACTIVITY_LIMIT_MS);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const tick = () => setRemainingMs(getRemainingMs());
    tick();

    const intervalId = setInterval(tick, TICK_MS);
    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  return remainingMs;
}
