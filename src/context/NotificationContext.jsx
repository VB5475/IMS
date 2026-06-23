import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import NotificationBar from "../components/ui/NotificationBar";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {

  // ── Non-blocking toast (success / error / warning / info) ─────────
  const [notification, setNotification] = useState(null);
  const timerRef = useRef(null);

  const show = useCallback((type, message) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setNotification({ type, message });
    timerRef.current = setTimeout(() => {
      setNotification(null);
      timerRef.current = null;
    }, 3000);
  }, []);

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setNotification(null);
  }, []);

  // ── Public API ─────────────────────────────────────────────────────
  const notify = {
    /** Green toast — save success, auto-dismiss after 3 s */
    success: (message) => show("success", message),
    /** Red toast — API / catch errors, auto-dismiss after 3 s */
    error:   (message) => show("error",   message),
    /** Amber toast — soft warnings, auto-dismiss after 3 s */
    warning: (message) => show("warning", message),
    /** Blue toast — informational, auto-dismiss after 3 s */
    info:    (message) => show("info",    message),
  };

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      {notification && (
        <NotificationBar
          type={notification.type}
          message={notification.message}
          onDismiss={dismissToast}
        />
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used inside NotificationProvider");
  return ctx;
}
