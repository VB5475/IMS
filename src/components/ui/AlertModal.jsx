import React, { useRef, useEffect } from "react";
import { XCircle, AlertTriangle, Info, CheckCircle2, X } from "lucide-react";
import "./AlertModal.css";

const VARIANTS = {
  error:   { Icon: XCircle,       label: "Validation Errors" },
  warning: { Icon: AlertTriangle, label: "Warning"           },
  info:    { Icon: Info,          label: "Information"       },
  success: { Icon: CheckCircle2,  label: "Success"           },
};

export default function AlertModal({ type = "error", title, messages = [], onDismiss }) {
  const okRef = useRef(null);
  const { Icon, label } = VARIANTS[type] ?? VARIANTS.error;
  const displayTitle = title ?? label;

  useEffect(() => {
    const t = setTimeout(() => okRef.current?.focus(), 80);
    document.body.style.overflow = "hidden";

    const handleKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onDismiss();
    };
    document.addEventListener("keydown", handleKey, true);

    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey, true);
    };
  }, [onDismiss]);

  return (
    <div className="vdlg-overlay" role="alertdialog" aria-modal="true" aria-labelledby="vdlg-title">
      <div className={`vdlg vdlg--${type}`}>

        {/* Type-coloured header */}
        <div className="vdlg__head">
          <div className="vdlg__head-left">
            <span className="vdlg__icon" aria-hidden="true">
              <Icon size={15} strokeWidth={2.2} />
            </span>
            <span id="vdlg-title" className="vdlg__title">{displayTitle}</span>
          </div>
          <button className="vdlg__close" onClick={onDismiss} aria-label="Close">
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div className="vdlg__body">
          {messages.length === 1 ? (
            <p className="vdlg__single">{messages[0]}</p>
          ) : (
            <ul className="vdlg__list" aria-label="Issues to fix">
              {messages.map((msg, i) => (
                <li key={i} className="vdlg__item">
                  <span className="vdlg__dot" aria-hidden="true" />
                  <span>{msg}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="vdlg__footer">
          <button ref={okRef} type="button" className="vdlg__ok" onClick={onDismiss}>
            OK
          </button>
        </div>

      </div>
    </div>
  );
}
