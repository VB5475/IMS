// useUiGuard.js — right-click / DevTools-shortcut deterrent, gated by
// UI_GUARD_CONFIG.isAllow (src/config/uiGuardConfig.js). Blocks the common
// entry points (context menu, F12, Ctrl+Shift+I/J/C, Ctrl+U) and shows a
// toast — it cannot prevent DevTools being opened via the browser's own
// menu, no page-level script can. Deterrent only, not a security control.
import { useEffect, useCallback } from "react";
import { useNotification } from "../context/NotificationContext";
import { UI_GUARD_CONFIG } from "../config/uiGuardConfig";

function isGuardActive() {
  return UI_GUARD_CONFIG.isAllow === "No";
}

function isDevToolsShortcut(e) {
  if (e.key === "F12") return true;
  const modifier = e.ctrlKey || e.metaKey;
  if (!modifier) return false;
  if (e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) return true;
  if (!e.shiftKey && (e.key === "U" || e.key === "u")) return true;
  return false;
}

export function useUiGuard() {
  const notify = useNotification();

  const handleContextMenu = useCallback(
    (e) => {
      if (!isGuardActive()) return;
      e.preventDefault();
      notify.warning("Right click is Disabled");
    },
    [notify]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!isGuardActive() || !isDevToolsShortcut(e)) return;
      e.preventDefault();
      e.stopPropagation();
      notify.warning("Inspect Element is disabled");
    },
    [notify]
  );

  useEffect(() => {
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [handleContextMenu, handleKeyDown]);
}
