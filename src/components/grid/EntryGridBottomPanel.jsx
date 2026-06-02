// Bottom toolbar for EntryGrid — matches EnterpriseGrid / GridBottomPanel styling.

import React from 'react';
import { Download, Copy, Save } from 'lucide-react';

export default function TxnEntryBottomPanel({
  selectedCount,
  onExportExcel,
  onCopy,
  onSave,
}) {
  return (
    <div className="grid-bottom-panel">
      <div className="bottom-panel-left">
        <button
          type="button"
          className="toolbar-btn"
          onClick={onExportExcel}
          title="Export to Excel"
        >
          <Download size={12} strokeWidth={2} />
          Export Excel
        </button>

        <button
          type="button"
          className="toolbar-btn"
          onClick={onCopy}
          disabled={selectedCount === 0}
          title="Copy Selected"
        >
          <Copy size={12} strokeWidth={2} />
          Copy ({selectedCount})
        </button>

        <button
          type="button"
          className="toolbar-btn primary"
          onClick={onSave}
          disabled={selectedCount === 0}
          title="Save Selected"
        >
          <Save size={12} strokeWidth={2} />
          Save ({selectedCount})
        </button>
      </div>
    </div>
  );
}
