// PIActionBar.jsx
// Bottom action bar for Purchase Inquiry Detail.
// Buttons: Document F6 | Save & Print | Save | Cancel | Close

import React from 'react';
import { FileText, Printer, Save, X, LogOut } from 'lucide-react';
import './PIActionBar.css';

export default function PIActionBar({
  onDocument,
  onSaveAndPrint,
  onSave,
  onCancel,
  onClose,
  isSaving = false,
}) {
  return (
    <div className="pi-action-bar">
      <button
        type="button"
        className="pi-action-btn pi-action-btn--secondary"
        onClick={onDocument}
        title="Document (F6)"
      >
        <FileText size={13} strokeWidth={2} />
        Document F6
      </button>

      <div className="pi-action-bar__sep" />

      <button
        type="button"
        className="pi-action-btn pi-action-btn--print"
        onClick={onSaveAndPrint}
        disabled={isSaving}
        title="Save &amp; Print"
      >
        <Printer size={13} strokeWidth={2} />
        Save &amp; Print
      </button>

      <button
        type="button"
        className="pi-action-btn pi-action-btn--save"
        onClick={onSave}
        disabled={isSaving}
        title="Save"
      >
        {isSaving ? (
          <><div className="pi-action-spinner" /><span>Saving…</span></>
        ) : (
          <><Save size={13} strokeWidth={2} /><span>Save</span></>
        )}
      </button>

      <button
        type="button"
        className="pi-action-btn pi-action-btn--cancel"
        onClick={onCancel}
        disabled={isSaving}
        title="Cancel"
      >
        <X size={13} strokeWidth={2} />
        Cancel
      </button>

      <div className="pi-action-bar__sep" />

      <button
        type="button"
        className="pi-action-btn pi-action-btn--close"
        onClick={onClose}
        title="Close"
      >
        <LogOut size={13} strokeWidth={2} />
        Close
      </button>
    </div>
  );
}
