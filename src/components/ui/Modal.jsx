// Modal.jsx — Generic reusable modal wrapper
// ─────────────────────────────────────────────────────────────────────
// Wraps ANY children in a full-screen overlay + dialog. Works like a
// higher-order component — pass any component as children:
//
//   <Modal isOpen={open} onClose={close} title="Pick Items" size="xl">
//     <TxnEntryGridForm config={config} readOnly initialRows={data} />
//   </Modal>
//
//   <Modal isOpen={open} onClose={close} headerless size="md">
//     <TxnEntryFilterPanel filters={filters} onAddNew={add} />
//   </Modal>
//
// Props:
//   isOpen             — boolean — controls visibility
//   onClose            — () => void — called on Escape key, X button, or Cancel click
//   title              — string — header title text
//   subtitle           — string (optional) — sub-header text
//   icon               — ReactNode (optional) — icon shown in header
//   size               — 'sm' | 'md' | 'lg' | 'xl' | 'full' (default: 'lg')
//   headerless         — boolean (default: false) — hides the built-in header
//   footer             — ReactNode (optional) — custom footer content
//   closeOnOverlayClick — boolean (default: false) — set true ONLY when overlay dismiss is intentional
//   children           — body content (any React component)

import React, { useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import "./modal.css";

const FOCUSABLE = [
  'button:not([disabled])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function Modal({
  isOpen = false,
  onClose,
  title = "",
  subtitle = "",
  icon = null,
  size = "lg",
  headerless = false,
  variant = "default",
  dialogClassName = "",
  footer = null,
  closeOnOverlayClick = false,
  children,
}) {
  const dialogRef = useRef(null);

  // Keyboard handler — Escape closes, Tab is trapped within dialog.
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        if (
          e.target.closest(".search-select--open") ||
          e.target.closest(".search-select__dropdown")
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        // Don't interfere when a nested alert dialog (ConfirmDialog) has focus
        if (document.activeElement?.closest('[role="alertdialog"]')) return;
        const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown, true);
    document.body.style.overflow = "hidden";
    // Auto-focus first focusable element when modal opens
    const t = setTimeout(() => {
      if (!dialogRef.current) return;
      dialogRef.current.querySelector(FOCUSABLE)?.focus();
    }, 80);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title || "Modal dialog"}
      onMouseDown={closeOnOverlayClick ? (e) => { if (e.target === e.currentTarget) onClose?.(); } : undefined}
    >
      <div
        ref={dialogRef}
        className={`modal-dialog modal-dialog--${size} ${headerless ? "modal-dialog--headerless" : ""} ${variant === "enterprise" ? "modal-dialog--enterprise" : ""} ${dialogClassName}`.trim()}
      >
        {/* Header — hidden when headerless */}
        {!headerless && (
          <div className="modal-header">
            <div className="modal-header-left">
              {icon && (
                <span
                  className={`modal-header-icon${variant === "enterprise" ? " modal-header-icon--enterprise" : ""}`}
                >
                  {icon}
                </span>
              )}
              <div>
                <div className="modal-title">{title}</div>
                {subtitle && <div className="modal-subtitle">{subtitle}</div>}
              </div>
            </div>
            <button className="modal-close" onClick={onClose} aria-label="Close modal">
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* Floating close button when headerless */}
        {headerless && (
          <button
            className="modal-close modal-close--floating"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        )}

        {/* Body */}
        <div className="modal-body">{children}</div>

        {/* Footer */}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
