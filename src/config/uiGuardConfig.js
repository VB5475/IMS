// uiGuardConfig.js — single on/off switch for the right-click / DevTools-
// shortcut deterrent (see src/hooks/useUiGuard.js).
//
// isAllow: "No"  -> guard ACTIVE: right-click and common DevTools shortcuts
//                    (F12, Ctrl+Shift+I/J/C, Ctrl+U) are blocked, each shows
//                    a toast explaining why.
// isAllow: "YES" -> guard OFF: normal browser behavior, nothing blocked.
//
// This only blocks the common entry points — it cannot prevent DevTools
// from being opened via the browser's own menu (no browser lets a page do
// that). It's a deterrent for casual users, not a security control.

export const UI_GUARD_CONFIG = {
  isAllow: "Yes",
};
