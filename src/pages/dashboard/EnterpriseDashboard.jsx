import React from "react";
import ReportBoardPanel from "../../components/dashboard/ReportBoardPanel";
import { getStoredSessionId } from "../../session/userSession";
import "./EnterpriseDashboard.css";

export default function EnterpriseDashboard() {
  const sessionId = getStoredSessionId();

  return (
    <div className="ent-dashboard ent-dashboard--fill">
      <ReportBoardPanel compact sessionId={sessionId} />
    </div>
  );
}
