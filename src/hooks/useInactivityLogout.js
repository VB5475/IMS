// useInactivityLogout.js — forces logout after INACTIVITY_LIMIT_MS with no
// real user activity. Activity only updates a ref (no re-render, no timer
// churn on high-frequency events like mousemove) — a single interval checks
// elapsed idle time against the limit.
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";

const INACTIVITY_LIMIT_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 5000;
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "wheel"];

export function useInactivityLogout() {
  const { isAuthenticated, logout } = useUser();
  const navigate = useNavigate();
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    markActive();

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));

    const intervalId = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= INACTIVITY_LIMIT_MS) {
        logout();
        navigate("/login", { replace: true });
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
      clearInterval(intervalId);
    };
  }, [isAuthenticated, logout, navigate]);
}
