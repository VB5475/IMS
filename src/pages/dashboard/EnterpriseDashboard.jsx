import React from "react";
import ReportBoardPanel from "../../components/dashboard/ReportBoardPanel";
import "./EnterpriseDashboard.css";

export default function EnterpriseDashboard() {
  return (
    <div className="ent-dashboard ent-dashboard--fill">
      <ReportBoardPanel compact />
    </div>
  );
}
