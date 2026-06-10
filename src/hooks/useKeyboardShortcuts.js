// useKeyboardShortcuts — configurable Alt+key shortcut bindings.
//
// config shape:
//   Record<string, { handler: () => void, enabled?: boolean }>
//   Key is a single lowercase letter, e.g. 'a', 's', 'n', 'c'.
//   enabled defaults to true when omitted.
//
// options:
//   disabled — boolean, global guard (e.g. while a modal is open)
//
// Example:
//   useKeyboardShortcuts({
//     a: { handler: enterEditMode, enabled: !isEditMode },
//     s: { handler: handleSave,    enabled: isEditMode && !isSaving },
//     n: { handler: handleCancel,  enabled: isEditMode },
//     c: { handler: handleClose,   enabled: true },
//   }, { disabled: modalOpen });
//
// To make shortcuts user-overridable in the future, load the config from
// localStorage (e.g. 'ims_shortcuts_po') and merge with the module default.

import { useEffect } from 'react';

export function useKeyboardShortcuts(config, { disabled = false } = {}) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (disabled) return;
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const key = e.key.toLowerCase();
      const binding = config[key];
      if (!binding) return;
      if (binding.enabled === false) return;
      e.preventDefault();
      binding.handler?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [config, disabled]);
}
