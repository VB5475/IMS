// ActionBar — Common sticky bottom action bar for all entry pages.
//
// Built-in pair (shown by default, controlled by showAddCancel prop):
//   • Read mode  → "Add" button     (calls onAdd, enters edit mode)
//   • Edit mode  → "Cancel" button  (calls onCancel, resets + exits edit mode)
//
// Page-specific buttons are passed via the `extraButtons` prop as an array:
//   { key, label, Icon, variant, onClick, disabled, loading, showAlways }
//   Add a separator object { key, separator: true } to insert a divider.
//   By default extra buttons are only rendered in edit mode.
//   Set showAlways: true to show a button regardless of edit mode.
//
// Usage — page that only needs custom buttons (no Add/Cancel):
//   <ActionBar showAddCancel={false} extraButtons={[...]} />

import React from 'react';
import { FilePlus, XCircle } from 'lucide-react';
import './ActionBar.css';

export default function ActionBar({
  // ── Add / Cancel pair ──────────────────────────────────────────────
  showAddCancel = true,
  isEditMode    = false,
  onAdd,
  onCancel,
  addLabel    = 'Add',
  cancelLabel = 'Cancel',

  // ── Extra buttons ──────────────────────────────────────────────────
  // Array of button descriptor objects (see file header for shape).
  extraButtons = [],

  // ── Layout ────────────────────────────────────────────────────────
  // sticky=true → position: sticky; bottom: 0 inside the scroll container.
  sticky = true,
}) {
  const visibleExtras = extraButtons.filter(
    (btn) => btn.showAlways || isEditMode,
  );

  const hasExtras = visibleExtras.some((b) => !b.separator);

  return (
    <footer className={`action-bar${sticky ? ' action-bar--sticky' : ''}`}>
      {/* Page-specific extra buttons */}
      {visibleExtras.map((btn) => {
        if (btn.separator) {
          return <div key={btn.key} className="action-bar__sep" />;
        }
        const Icon = btn.Icon;
        return (
          <button
            key={btn.key}
            type="button"
            className={`action-btn action-btn--${btn.variant || 'secondary'}`}
            onClick={btn.onClick}
            disabled={btn.disabled || false}
            title={btn.label}
          >
            {btn.loading ? (
              <>
                <div className="action-spinner" />
                <span>{btn.label}</span>
              </>
            ) : (
              <>
                {Icon && <Icon size={13} strokeWidth={2} />}
                <span>{btn.label}</span>
              </>
            )}
          </button>
        );
      })}

      {/* Auto-separator between extras and the built-in Add/Cancel */}
      {showAddCancel && hasExtras && (
        <div className="action-bar__sep" />
      )}

      {/* Built-in Add / Cancel */}
      {showAddCancel && (
        isEditMode ? (
          <button
            type="button"
            className="action-btn action-btn--cancel"
            onClick={onCancel}
            title={cancelLabel}
          >
            <XCircle size={13} strokeWidth={2} />
            <span>{cancelLabel}</span>
          </button>
        ) : (
          <button
            type="button"
            className="action-btn action-btn--add"
            onClick={onAdd}
            title={addLabel}
          >
            <FilePlus size={13} strokeWidth={2} />
            <span>{addLabel}</span>
          </button>
        )
      )}
    </footer>
  );
}
