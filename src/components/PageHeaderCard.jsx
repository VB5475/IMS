import React from 'react';
import './PageHeaderCard.css';

export default function PageHeaderCard({ title, description, action }) {
  return (
    <section className="page-header-card">
      <div>
        <h2 className="page-header-card__title">{title}</h2>
        {description && <p className="page-header-card__desc">{description}</p>}
      </div>
      {action}
    </section>
  );
}
