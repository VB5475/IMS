import React from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import "./NotificationBar.css";

const VARIANTS = {
  success: { Icon: CheckCircle2,  label: "Success" },
  error:   { Icon: XCircle,       label: "Error"   },
  warning: { Icon: AlertTriangle, label: "Warning" },
  info:    { Icon: Info,          label: "Info"    },
};

export default function NotificationBar({ type = "info", message, onDismiss }) {
  const { Icon, label } = VARIANTS[type] ?? VARIANTS.info;

  return (
    <div
      className={`n-toast n-toast--${type}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      {/* Icon badge */}
      <span className="n-toast__icon-wrap" aria-hidden="true">
        <Icon size={17} strokeWidth={2.2} />
      </span>

      {/* Text */}
      <div className="n-toast__body">
        <span className="n-toast__label">{label}</span>
        <span className="n-toast__msg">{message}</span>
      </div>

      {/* Dismiss */}
      <button
        type="button"
        className="n-toast__close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X size={13} strokeWidth={2.5} />
      </button>
    </div>
  );
}
