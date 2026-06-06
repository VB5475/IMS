import React from 'react';
import KpiStrip from '../../components/KpiStrip';
import ReportBoardPanel from '../../components/dashboard/ReportBoardPanel';
import TaskBoardPanel from '../../components/dashboard/TaskBoardPanel';
import DecisionPanel from '../../components/dashboard/DecisionPanel';
import './EnterpriseDashboard.css';

export default function EnterpriseDashboard() {
  return (
    <div className="ent-dashboard ent-dashboard--fill">
      <KpiStrip />
      <div className="ent-dashboard__main">
        <div className="ent-dashboard__left">
          <ReportBoardPanel compact />
        </div>
        <div className="ent-dashboard__right">
          <TaskBoardPanel />
          <DecisionPanel />
        </div>
      </div>
    </div>
  );
}
