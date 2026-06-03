// GridEmptyState.jsx
// Shown in the grid area before any rows are added.
// Common component — drop it wherever an entry grid starts empty.
//
// Props:
//   addLabel  {string}        — label on the "Add New" button  (default "Add New")
//   getLabel  {string|null}   — label on the "Get Item" button; omit if not present on this page

import React from 'react';
import { PackageSearch } from 'lucide-react';
import './GridEmptyState.css';

export default function GridEmptyState({ addLabel = 'Add New', getLabel = null }) {
  return (
    <div className="ges-wrap">
      <PackageSearch size={38} strokeWidth={1.3} className="ges-icon" />
      <p className="ges-title">No items added yet</p>
      <p className="ges-msg">
        Click <strong>{addLabel}</strong> to add a row manually
        {getLabel && <>, or pick items using <strong>{getLabel}</strong></>}.
      </p>
    </div>
  );
}
