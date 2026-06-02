import React from 'react';
import { FileText, ClipboardList, Receipt, TrendingUp } from 'lucide-react';
import './KpiStrip.css';

const KPI_ITEMS = [
  { label: 'Total Reports', value: '142', trend: '+12%', trendType: 'up', icon: FileText },
  { label: 'Pending Tasks', value: '8', trend: '-3%', trendType: 'down', icon: ClipboardList },
  { label: 'Open Invoices', value: '23', trend: '+5%', trendType: 'up', icon: Receipt },
  { label: 'Revenue MTD', value: '₹4.2L', trend: '+18%', trendType: 'up', icon: TrendingUp },
];

export default function KpiStrip() {
  return (
    <section className="kpi-strip" aria-label="Key metrics">
      {KPI_ITEMS.map(({ label, value, trend, trendType, icon: Icon }) => (
        <article key={label} className="kpi-card">
          <div className="kpi-card__body">
            <span className="kpi-card__label">{label}</span>
            <div className="kpi-card__row">
              <span className="kpi-card__value">{value}</span>
              <span className={`kpi-card__trend kpi-card__trend--${trendType}`}>{trend}</span>
            </div>
          </div>
          <div className="kpi-card__icon">
            <Icon size={18} strokeWidth={1.5} />
          </div>
        </article>
      ))}
    </section>
  );
}
