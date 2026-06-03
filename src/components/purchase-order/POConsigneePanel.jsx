// POConsigneePanel.jsx
// Consignee section — matches ERP screenshot:
//   Consignee: ○ Own Consignee  ○ Third Party Customer
//   Name [dropdown]   Del. Loc. [text]   Address [textarea]

import React, { useState, useCallback } from 'react';
import SearchSelect from '../ui/SearchSelect';
import './POConsigneePanel.css';

const CONSIGNEE_OPTIONS = [
  { value: 'own',   label: 'Own Consignee'       },
  { value: 'third', label: 'Third Party Customer' },
];

export default function POConsigneePanel({
  nameOptions = [],
  onChange,
}) {
  const [consigneeType, setConsigneeType] = useState('own');
  const [name,          setName]          = useState('');
  const [delLoc,        setDelLoc]        = useState('');
  const [address,       setAddress]       = useState('');

  const handleTypeChange = useCallback((value) => {
    setConsigneeType(value);
    onChange?.({ consigneeType: value, name, delLoc, address });
  }, [name, delLoc, address, onChange]);

  const handleField = useCallback((key, value) => {
    const updates = { consigneeType, name, delLoc, address, [key]: value };
    if (key === 'name')    setName(value);
    if (key === 'delLoc')  setDelLoc(value);
    if (key === 'address') setAddress(value);
    onChange?.(updates);
  }, [consigneeType, name, delLoc, address, onChange]);

  return (
    <div className="poc-panel">
      {/* Section header */}
      <div className="poc-panel__header">Consignee</div>

      {/* Radio options */}
      <div className="poc-panel__body">
        <div className="poc-radio-group">
          {CONSIGNEE_OPTIONS.map((opt) => (
            <label key={opt.value} className="poc-radio-item">
              <input
                type="radio"
                name="po-consignee-type"
                value={opt.value}
                checked={consigneeType === opt.value}
                onChange={() => handleTypeChange(opt.value)}
                className="poc-radio-item__input"
              />
              <span className="poc-radio-item__label">{opt.label}</span>
            </label>
          ))}
        </div>

        {/* Name / Del. Loc. / Address */}
        <div className="poc-fields">
          <div className="poc-field">
            <label className="poc-field__label" htmlFor="poc-name">Name</label>
            <div className="poc-field__control poc-field__control--select">
              <SearchSelect
                id="poc-name"
                value={name}
                onChange={(v) => handleField('name', v)}
                options={nameOptions}
                placeholder="-- Select --"
                ariaLabel="Consignee Name"
              />
            </div>
          </div>

          <div className="poc-field">
            <label className="poc-field__label" htmlFor="poc-delloc">Del. Loc.</label>
            <input
              id="poc-delloc"
              type="text"
              className="poc-field__input"
              value={delLoc}
              onChange={(e) => handleField('delLoc', e.target.value)}
              placeholder="Delivery Location"
            />
          </div>

          <div className="poc-field poc-field--wide">
            <label className="poc-field__label" htmlFor="poc-address">Address</label>
            <textarea
              id="poc-address"
              className="poc-field__textarea"
              value={address}
              onChange={(e) => handleField('address', e.target.value)}
              placeholder="Address"
              rows={2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
