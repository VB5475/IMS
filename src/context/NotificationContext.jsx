import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import NotificationBar from "../components/ui/NotificationBar";
import AlertDialog from "../components/ui/AlertDialog";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {

  // ── Non-blocking toast (warning / info only) ────────────────────────
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

  // ── Blocking success/error dialog (OK button, no auto-dismiss) ──────
  const [alert, setAlert] = useState(null); // { type: "success" | "danger", message }

  const dismissAlert = useCallback(() => setAlert(null), []);

  // ── Public API ─────────────────────────────────────────────────────
  const notify = {
    /** Blocking success dialog — save success, dismissed via OK button */
    success: (message) => setAlert({ type: "success", message }),
    /** Blocking error dialog — API / catch errors, dismissed via OK button */
    error:   (message) => setAlert({ type: "danger",  message }),
    /** Amber toast — soft warnings, auto-dismiss after 3 s */
    warning: (message) => show("warning", message),
    /** Blue toast — informational, auto-dismiss after 3 s */
    info:    (message) => show("info",    message),
    /** Green toast — non-blocking success, auto-dismiss after 3 s */
    toastSuccess: (message) => show("success", message),
    /** Red toast — non-blocking error, auto-dismiss after 3 s */
    toastError:   (message) => show("error",   message),
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
      <AlertDialog
        isOpen={alert != null}
        type={alert?.type}
        message={alert?.message}
        onOk={dismissAlert}
      />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used inside NotificationProvider");
  return ctx;
}
