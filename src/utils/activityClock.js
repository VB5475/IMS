// activityClock.js — auto-logout countdown driven by TAB VISIBILITY, not by
// mouse/keyboard activity (2026-09-01 /pm — replaces the earlier
// activity-event-based design entirely, per explicit product decision:
// "if the tab is visible, the countdown pauses even if I'm not touching
// anything; if I switch away, it resumes counting down from where it was").
//
// Only time spent with the tab BACKGROUNDED (document.visibilityState ===
// "hidden") counts against the 20-minute budget. Coming back to the tab
// freezes the countdown at whatever it was; switching away again resumes it
// from that exact point — there is no "reset to full" trigger of any kind,
// the budget only ever depletes until it hits zero.
//
// A single module-level `visibilitychange` listener drives this (ES modules
// are cached per tab, so this is naturally one shared instance) — both
// useInactivityLogout.js (enforcement) and useAutoLogoutCountdown.js
// (header display) read the exact same state via getRemainingMs(), so they
// can never drift apart from each other.
export const INACTIVITY_LIMIT_MS = 20 * 60 * 1000;

let remainingMs = INACTIVITY_LIMIT_MS;
let hiddenSince = typeof document !== "undefined" && document.visibilityState === "hidden" ? Date.now() : null;

function handleVisibilityChange() {
  if (document.visibilityState === "hidden") {
    hiddenSince = Date.now();
    return;
  }
  if (hiddenSince != null) {
    remainingMs = Math.max(0, remainingMs - (Date.now() - hiddenSince));
    hiddenSince = null;
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

/** Current remaining budget, accounting for any in-progress hidden period. */
export function getRemainingMs() {
  if (hiddenSince != null) {
    return Math.max(0, remainingMs - (Date.now() - hiddenSince));
  }
  return remainingMs;
}

/** Resets the budget to full — call once per fresh authenticated session (login). */
export function resetAutoLogoutBudget() {
  remainingMs = INACTIVITY_LIMIT_MS;
  hiddenSince = typeof document !== "undefined" && document.visibilityState === "hidden" ? Date.now() : null;
}
