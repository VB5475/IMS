import React, { useRef, useEffect } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import "./ConfirmDialog.css";

const ICONS = {
  danger:  Trash2,
  warning: AlertTriangle,
};

export default function ConfirmDialog({
  isOpen,
  message,
  confirmLabel = "Discard",
  cancelLabel  = "Keep Editing",
  type         = "danger",
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  const Icon = ICONS[type] ?? ICONS.danger;

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => cancelRef.current?.focus(), 80);
    document.body.style.overflow = "hidden";

    const handleKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    };
    document.addEventListener("keydown", handleKey, true);

    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey, true);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="cdlg-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cdlg-msg"
    >
      <div className={`cdlg cdlg--${type}`}>
        <div className="cdlg__body">
          <span className="cdlg__icon" aria-hidden="true">
            <Icon size={20} strokeWidth={1.8} />
          </span>
          <p id="cdlg-msg" className="cdlg__message">{message}</p>
        </div>

        <div className="cdlg__footer">
          <button
            ref={cancelRef}
            type="button"
            className="cdlg__btn cdlg__btn--cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`cdlg__btn cdlg__btn--confirm cdlg__btn--${type}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
