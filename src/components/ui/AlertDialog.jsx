import React, { useRef, useEffect } from "react";
import { XCircle, CheckCircle2 } from "lucide-react";
import "./ConfirmDialog.css";

const ICONS = {
  danger:  XCircle,
  success: CheckCircle2,
};

/** Blocking success/error dialog (single OK button) — replaces the toast for both. */
export default function AlertDialog({ isOpen, type = "danger", message, okLabel = "OK", onOk }) {
  const okRef = useRef(null);
  const Icon = ICONS[type] ?? ICONS.danger;

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => okRef.current?.focus(), 80);
    document.body.style.overflow = "hidden";

    const handleKey = (e) => {
      if (e.key !== "Escape" && e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      onOk();
    };
    document.addEventListener("keydown", handleKey, true);

    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey, true);
    };
  }, [isOpen, onOk]);

  if (!isOpen) return null;

  return (
    <div
      className="cdlg-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="adlg-msg"
    >
      <div className={`cdlg cdlg--${type}`}>
        <div className="cdlg__body">
          <span className="cdlg__icon" aria-hidden="true">
            <Icon size={20} strokeWidth={1.8} />
          </span>
          <p id="adlg-msg" className="cdlg__message">{message}</p>
        </div>

        <div className="cdlg__footer">
          <button
            ref={okRef}
            type="button"
            className={`cdlg__btn cdlg__btn--confirm cdlg__btn--${type}`}
            onClick={onOk}
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
