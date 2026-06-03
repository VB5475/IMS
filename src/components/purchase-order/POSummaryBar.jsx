// POSummaryBar.jsx
// Horizontal summary strip — sticky footer of the Purchase Order form.
// Two currency rows (USD / INR), fields spread left-to-right.
// PO Approval checkbox + approver + date sits in the same footer bar.

import React, { useState, useCallback } from 'react';
import './POSummaryBar.css';

const FIELDS = [
  { key: 'itemTotal',      label: 'Item Total'      },
  { key: 'discount',       label: 'Discount'        },
  { key: 'freightCharges', label: 'Freight Charges' },
  { key: 'taxDutyTotal',   label: 'Tax/Duty Total'  },
  { key: 'roundOff',       label: 'Round Off'       },
  { key: 'totalAmount',    label: 'Total Amount'    },
];

const CURRENCIES = ['USD', 'INR'];

const emptyRow = () => ({
  itemTotal: '0.00', discount: '0.00', freightCharges: '0.00',
  taxDutyTotal: '0.00', roundOff: '0.00', totalAmount: '0.00',
});

export default function POSummaryBar() {
  const [values, setValues] = useState({ USD: emptyRow(), INR: emptyRow() });
  const [poApproval,   setPoApproval]   = useState(false);
  const [approvedBy,   setApprovedBy]   = useState('');
  const [approvalDate, setApprovalDate] = useState('');

  const handleChange = useCallback((currency, key, value) => {
    setValues((prev) => ({
      ...prev,
      [currency]: { ...prev[currency], [key]: value },
    }));
  }, []);

  return (
    <div className="posb-bar">

      {/* Currency rows */}
      <div className="posb-rows">
        {CURRENCIES.map((cur) => (
          <div key={cur} className="posb-row">
            <span className="posb-row__cur">{cur}</span>
            {FIELDS.map((field) => (
              <div key={field.key} className="posb-cell">
                <span className="posb-cell__label">{field.label}</span>
                <input
                  type="text"
                  className="posb-cell__input"
                  value={values[cur][field.key]}
                  onChange={(e) => handleChange(cur, field.key, e.target.value)}
                  aria-label={`${field.label} ${cur}`}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* PO Approval */}
      <div className="posb-approval">
        <label className="posb-approval__check">
          <input
            type="checkbox"
            checked={poApproval}
            onChange={(e) => setPoApproval(e.target.checked)}
            className="posb-approval__checkbox"
          />
          <span className="posb-approval__label">PO Approval</span>
        </label>
        <input
          type="text"
          className="posb-approval__input"
          value={approvedBy}
          onChange={(e) => setApprovedBy(e.target.value)}
          placeholder="Approved by"
          aria-label="Approved by"
        />
        <input
          type="date"
          className="posb-approval__input"
          value={approvalDate}
          onChange={(e) => setApprovalDate(e.target.value)}
          aria-label="Approval date"
        />
      </div>

    </div>
  );
}
