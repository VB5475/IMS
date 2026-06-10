// TxnFooterTotals — reusable read-only totals strip for transaction forms.
// Used by PurchaseOrderForm, and ready for PurchaseInquiryForm etc.
//
// Props:
//   fields  — Array<{ key: string, label: string }>
//   values  — Record<string, string | number>  (populated from save/fetch response)

import React from 'react';
import './TxnFooterTotals.css';

export default function TxnFooterTotals({ fields = [], values = {} }) {
  return (
    <section className="txn-footer-totals">
      {fields.map(({ key, label }) => (
        <div key={key} className="txn-footer-totals__field">
          <span className="txn-footer-totals__label">{label}</span>
          <input
            type="text"
            readOnly
            className="txn-footer-totals__input"
            value={values[key] ?? '0.00'}
            aria-label={label}
            tabIndex={-1}
          />
        </div>
      ))}
    </section>
  );
}
