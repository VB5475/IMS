import React from "react";
import { ClipboardList, CheckCircle2, Clock3 } from "lucide-react";
import "./TaskBoardPanel.css";

const TASKS = [
  { id: 1, title: "Review Q1 Performance", status: "Pending", time: "Today", tone: "warning" },
  { id: 2, title: "Update HR Policies", status: "Completed", time: "Yesterday", tone: "success" },
  {
    id: 3,
    title: "Client Onboarding — Tech Solutions",
    status: "In Progress",
    time: "Tomorrow",
    tone: "info",
  },
];

const STATUS_ICON = {
  Completed: CheckCircle2,
  Pending: Clock3,
  "In Progress": Clock3,
};

export default function TaskBoardPanel() {
  return (
    <section className="tbp-panel">
      <header className="tbp-panel__header">
        <ClipboardList size={14} strokeWidth={2} />
        <span>Task Board</span>
      </header>
      <ul className="tbp-list">
        {TASKS.map((task) => {
          const Icon = STATUS_ICON[task.status] || Clock3;
          return (
            <li key={task.id} className="tbp-item">
              <div className="tbp-item__main">
                <h4>{task.title}</h4>
                <p>{task.time}</p>
              </div>
              <div className={`tbp-item__status tbp-item__status--${task.tone}`}>
                <Icon size={16} strokeWidth={2} />
                <span>{task.status}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
