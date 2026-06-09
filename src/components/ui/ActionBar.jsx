// ActionBar — Common sticky bottom action bar for all entry pages.
//
// Built-in pair (controlled by showAddCancel):
//   • Read mode  → "Add" button     (calls onAdd)
//   • Edit mode  → "Cancel" button  (calls onCancel)
//
// extraButtons — page-specific actions; set showAlways for read-mode buttons.
// accessKey on buttons enables Alt+key shortcuts (browser-native + form handlers).

import React from 'react';
import { FilePlus, XCircle } from 'lucide-react';
import './ActionBar.css';

export default function ActionBar({
  showAddCancel = true,
  isEditMode = false,
  onAdd,
  onCancel,
  addLabel = 'Add',
  cancelLabel = 'Cancel',
  addAccessKey = 'a',
  cancelAccessKey = 'n',
  extraButtons = [],
  sticky = true,
  alignEnd = false,
  addButtonRef = null,
  cancelButtonRef = null,
}) {
  const visibleExtras = extraButtons.filter(
    (btn) => btn.showAlways || isEditMode,
  );

  const trailingClose = visibleExtras.find((b) => b.key === 'close' && !b.separator);
  const mainExtras = visibleExtras.filter((b) => b.key !== 'close');

  const hasExtras = mainExtras.some((b) => !b.separator);

  const renderButton = (btn) => {
    if (btn.separator) {
      return <div key={btn.key} className="action-bar__sep" />;
    }
    const Icon = btn.Icon;
    return (
      <button
        key={btn.key}
        ref={btn.buttonRef || null}
        type="button"
        className={`action-btn action-btn--${btn.variant || 'secondary'}`}
        onClick={btn.onClick}
        disabled={btn.disabled || false}
        title={btn.title || btn.label}
        accessKey={btn.accessKey}
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
  };

  return (
    <footer
      className={[
        'action-bar',
        sticky ? 'action-bar--sticky' : '',
        alignEnd ? 'action-bar--align-end' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="action-bar__inner">
        {mainExtras.map(renderButton)}

        {showAddCancel && hasExtras && (
          <div className="action-bar__sep" />
        )}

        {showAddCancel && (
          isEditMode ? (
            <button
              ref={cancelButtonRef}
              type="button"
              className="action-btn action-btn--cancel"
              onClick={onCancel}
              title={`${cancelLabel} (Alt+${cancelAccessKey?.toUpperCase()})`}
              accessKey={cancelAccessKey}
            >
              <XCircle size={13} strokeWidth={2} />
              <span>{cancelLabel}</span>
            </button>
          ) : (
            <button
              ref={addButtonRef}
              type="button"
              className="action-btn action-btn--add"
              onClick={onAdd}
              title={`${addLabel} (Alt+${addAccessKey?.toUpperCase()})`}
              accessKey={addAccessKey}
            >
              <FilePlus size={13} strokeWidth={2} />
              <span>{addLabel}</span>
            </button>
          )
        )}

        {trailingClose && (
          <>
            {(hasExtras || showAddCancel) && <div className="action-bar__sep" />}
            {renderButton(trailingClose)}
          </>
        )}
      </div>
    </footer>
  );
}
