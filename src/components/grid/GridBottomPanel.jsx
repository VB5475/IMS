import React from 'react';
import { Download, Copy, Save, Filter, RotateCcw } from 'lucide-react';
import './EnterpriseGrid.css';

export default function BottomControlPanel({
  selectedCount,
  showCustomFilter,
  onToggleCustomFilter,
  onResetFilters,
  onExportExcel,
  onCopy,
  onSave,
}) {
  return (
    <div className="grid-bottom-panel">
      <div className="bottom-panel-left">
        <button className="toolbar-btn" onClick={onExportExcel} title="Export to Excel">
          <Download size={12} strokeWidth={2} />
          Export Excel
        </button>
        <button className="toolbar-btn" onClick={onCopy} disabled={selectedCount === 0} title="Copy Selected">
          <Copy size={12} strokeWidth={2} />
          Copy ({selectedCount})
        </button>
        <button className="toolbar-btn primary" onClick={onSave} disabled={selectedCount === 0} title="Save Selected">
          <Save size={12} strokeWidth={2} />
          Save ({selectedCount})
        </button>
      </div>
      <div className="bottom-panel-right">
        <button className="toolbar-btn" onClick={onToggleCustomFilter} title="Custom Filter">
          <Filter size={12} strokeWidth={2} />
          {showCustomFilter ? 'Hide Filter' : 'Create Filter'}
        </button>
        <button className="toolbar-btn" onClick={onResetFilters} title="Reset All Filters">
          <RotateCcw size={12} strokeWidth={2} />
          Reset
        </button>
      </div>
    </div>
  );
}
