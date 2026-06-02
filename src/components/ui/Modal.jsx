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
//   isOpen    — boolean — controls visibility
//   onClose   — () => void — called on Escape key or overlay/close-btn click
//   title     — string — header title text
//   subtitle  — string (optional) — sub-header text
//   icon      — ReactNode (optional) — icon shown in header
//   size      — 'sm' | 'md' | 'lg' | 'xl' | 'full' (default: 'lg')
//   headerless — boolean (default: false) — hides the built-in header
//   footer    — ReactNode (optional) — custom footer content
//   children  — body content (any React component)

import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import './modal.css';

export default function Modal({
  isOpen = false,
  onClose,
  title = '',
  subtitle = '',
  icon = null,
  size = 'lg',
  headerless = false,
  variant = 'default',
  footer = null,
  children,
}) {
  // Close on Escape key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll while modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Modal dialog'}
    >
      <div className={`modal-dialog modal-dialog--${size} ${headerless ? 'modal-dialog--headerless' : ''} ${variant === 'enterprise' ? 'modal-dialog--enterprise' : ''}`}>

        {/* Header — hidden when headerless */}
        {!headerless && (
          <div className="modal-header">
            <div className="modal-header-left">
              {icon && (
                <span className={`modal-header-icon${variant === 'enterprise' ? ' modal-header-icon--enterprise' : ''}`}>
                  {icon}
                </span>
              )}
              <div>
                <div className="modal-title">{title}</div>
                {subtitle && <div className="modal-subtitle">{subtitle}</div>}
              </div>
            </div>
            <button
              className="modal-close"
              onClick={onClose}
              aria-label="Close modal"
            >
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
        <div className="modal-body">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
