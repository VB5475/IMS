import React from "react";
import EnterpriseFilterPanel from "./EnterpriseFilterPanel";
import "./DashboardFilterPanelV2.css";

/**
 * Dashboard presentation variant for EnterpriseFilterPanel.
 * All filter behavior remains in the shared panel; this wrapper only adds
 * dashboard-specific visual hierarchy and responsive styling.
 */
export default function DashboardFilterPanelV2(props) {
  return (
    <div className="dashboard-filter-v2">
      <EnterpriseFilterPanel {...props} layout="dashboard" />
    </div>
  );
}
