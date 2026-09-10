import React from "react";
import { ShieldOff } from "lucide-react";
import ReportBoardPanel from "../../components/dashboard/ReportBoardPanel";
import { getStoredSessionId } from "../../session/userSession";
import { getModuleRights } from "../../session/moduleRights";
import { RB_CODES } from "../../constants/rbCodes";
import "./EnterpriseDashboard.css";

// 2026-09-09 /pm — this widget is the only real consumer of rb_aststkadbdtl
// (see ReportBoardPanel's RB-meta fetch), but unlike its HOME siblings
// (Asset Summary, Asset Health Decision, Workflow Dashboard — each its own
// RB-gated route via rbLeaf/RequireModuleAccess) it lived at "/", which is
// never RB-gated, so a login's real AllowView flag for this code was fetched
// but never enforced. Checking it here brings it in line with the others.
export default function EnterpriseDashboard() {
  const sessionId = getStoredSessionId();
  const canView = getModuleRights(RB_CODES.DASHBOARD_AST_STOCK_DETAIL).canView;

  if (!canView) {
    return (
      <div className="ent-dashboard ent-dashboard--fill ent-dashboard--denied">
        <ShieldOff size={28} strokeWidth={1.75} />
        <p>You do not have permission to open that page.</p>
      </div>
    );
  }

  return (
    <div className="ent-dashboard ent-dashboard--fill">
      <ReportBoardPanel compact sessionId={sessionId} />
    </div>
  );
}
