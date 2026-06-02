import React from 'react';
import { Lightbulb, ArrowRight } from 'lucide-react';
import './DecisionPanel.css';

export default function DecisionPanel() {
  return (
    <section className="dec-panel">
      <header className="dec-panel__header">
        <Lightbulb size={14} strokeWidth={2} />
        <span>Decision Insights</span>
      </header>
      <div className="dec-panel__body">
        <article className="dec-alert dec-alert--primary">
          <h4>Resource Allocation Needed</h4>
          <p>
            The &quot;QC Sample Status&quot; board has a high number of pending items. Consider
            re-allocating team members.
          </p>
          <button type="button" className="dec-alert__action">
            Take Action <ArrowRight size={14} />
          </button>
        </article>
        <article className="dec-alert dec-alert--success">
          <h4>Efficiency Target Met</h4>
          <p>
            Short term goals for Q2 are currently tracking 15% ahead of schedule across all major
            boards.
          </p>
        </article>
      </div>
    </section>
  );
}
