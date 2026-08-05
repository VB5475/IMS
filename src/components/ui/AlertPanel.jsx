import React from "react";
import { XCircle, AlertTriangle, Info, CheckCircle2, X } from "lucide-react";
import "./AlertPanel.css";

const VARIANTS = {
  error:   { Icon: XCircle,       summaryPrefix: "Fix" },
  warning: { Icon: AlertTriangle, summaryPrefix: "Review" },
  info:    { Icon: Info,          summaryPrefix: "" },
  success: { Icon: CheckCircle2,  summaryPrefix: "" },
};

// No auto-dismiss timer, by design (PM 2026-07-24) — validation alerts must stay
// on screen until the user explicitly closes them or the next Save click
// clears/replaces them (each page's save handler resets formErrors on click).
export default function AlertPanel({ type = "error", title, errors = [], onDismiss }) {
  if ((!errors || errors.length === 0) && !title) return null;

  const { Icon, summaryPrefix } = VARIANTS[type] ?? VARIANTS.error;
  const count = errors.length;
  const heading = title
    ? title
    : `${summaryPrefix} ${count} error${count === 1 ? "" : "s"} before saving`.trim();

  return (
    <div className={`alp alp--${type}`} role="alert" aria-live="assertive">
      <div className="alp__head">
        <span className="alp__icon" aria-hidden="true">
          <Icon size={14} strokeWidth={2.2} />
        </span>
        <span className="alp__title">{heading}</span>
        <button
          type="button"
          className="alp__close"
          onClick={onDismiss}
          aria-label="Dismiss errors"
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      </div>

      <ul className="alp__list">
        {errors.map((msg, i) => (
          <li key={i} className="alp__item">
            <span className="alp__dot" aria-hidden="true" />
            <span>{msg}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
