// ColumnFilter.jsx — Shared column filter popup for GridForm & NormalGrid
//
// Props:
//   col            — column definition object { key, name/label, filterType, dropdownOptions? }
//   allRows        — full unfiltered data array (used to derive unique values for 'list' type)
//   value          — current filter value for this column
//                    • 'list'   → Set of selected string values
//                    • 'date'   → { type: 'range', from: '', to: '' }
//                    • 'number' → { type: 'numrange', min: '', max: '' }
//                    • 'text'   → string
//   onChange       — (colKey, newValue) => void   called on every change (live for text/date/number)
//   onClear        — (colKey) => void
//   onClose        — () => void
//   anchorRef      — ref to the trigger element (used for positioning)
//   getDisplayLabel — optional (col, rawValue) => string  to resolve dropdown labels for 'list' type
//
// filterType values:
//   'list'    — searchable checkbox list (default when not specified)
//   'date'    — from/to date range
//   'number'  — min/max numeric range
//   'text'    — simple contains text input

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Filter, Calendar, Hash, Type } from 'lucide-react';
import './column-filter.css';

const ICONS = {
    list: <Filter size={13} />,
    date: <Calendar size={13} />,
    number: <Hash size={13} />,
    text: <Type size={13} />,
};

export default function ColumnFilter({
    col,
    allRows = [],
    value,
    onChange,
    onClear,
    onClose,
    anchorRef,
    getDisplayLabel,
}) {
    const filterType = col.filterType || 'list';
    const colKey = col.key;
    const colName = col.name || col.label || colKey;

    const popupRef = useRef(null);
    const [search, setSearch] = useState('');
    const [style, setStyle] = useState({});

    // ── Position popup below/above the anchor ──────────────────────────
    useEffect(() => {
        if (!anchorRef?.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropUp = spaceBelow < 320 && rect.top > 320;
        setStyle({
            position: 'fixed',
            left: `${Math.min(rect.left, window.innerWidth - 250)}px`,
            width: '240px',
            zIndex: 9999,
            ...(dropUp
                ? { bottom: `${window.innerHeight - rect.top + 6}px` }
                : { top: `${rect.bottom + 6}px` }),
        });
    }, [anchorRef]);

    // ── Close on outside click ──────────────────────────────────────────
    useEffect(() => {
        function handleOut(e) {
            const inPopup = popupRef.current && popupRef.current.contains(e.target);
            const inAnchor = anchorRef?.current && anchorRef.current.contains(e.target);
            if (!inPopup && !inAnchor) onClose();
        }
        document.addEventListener('mousedown', handleOut);
        return () => document.removeEventListener('mousedown', handleOut);
    }, [onClose, anchorRef]);

    // ── Escape key ─────────────────────────────────────────────────────
    useEffect(() => {
        function handleKey(e) { if (e.key === 'Escape') onClose(); }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // ── Derive unique values for list filter ───────────────────────────
    const uniqueValues = useCallback(() => {
        if (filterType !== 'list') return [];
        if (col.dropdownOptions?.length) {
            return col.dropdownOptions.map(opt => {
                if (typeof opt === 'string') return opt;
                if (opt.value !== undefined) return String(opt.value);
                return String(opt.ObjDetID ?? opt);
            });
        }
        const vals = new Set(allRows.map(r => String(r[colKey] ?? '')).filter(Boolean));
        return Array.from(vals).sort();
    }, [filterType, col.dropdownOptions, allRows, colKey]);

    const resolveLabel = useCallback((rawVal) => {
        if (getDisplayLabel) return getDisplayLabel(col, rawVal);
        if (col.dropdownOptions?.length) {
            const opt = col.dropdownOptions.find(o => {
                const v = typeof o === 'object' ? String(o.value ?? o.ObjDetID ?? o) : o;
                return v === rawVal;
            });
            if (opt) return typeof opt === 'object' ? (opt.label || opt.Name || rawVal) : opt;
        }
        return rawVal;
    }, [getDisplayLabel, col]);

    // ─────────────────────────────────────────────────────────────────────
    // Render helpers per filter type
    // ─────────────────────────────────────────────────────────────────────

    const renderList = () => {
        const all = uniqueValues();
        const filtered = search ? all.filter(v => resolveLabel(v).toLowerCase().includes(search.toLowerCase())) : all;
        const current = (value instanceof Set) ? value : new Set();
        const allSelected = filtered.length > 0 && filtered.every(v => current.has(v));

        const toggle = (val) => {
            const next = new Set(current);
            if (next.has(val)) next.delete(val); else next.add(val);
            onChange(colKey, next);
        };

        const toggleAll = () => {
            const next = new Set(current);
            if (allSelected) { filtered.forEach(v => next.delete(v)); }
            else { filtered.forEach(v => next.add(v)); }
            onChange(colKey, next);
        };

        return (
            <>
                <div className="cf-search">
                    <input
                        autoFocus
                        type="text"
                        placeholder="Search values…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Escape' && (search ? setSearch('') : onClose())}
                    />
                </div>
                <div className="cf-list">
                    {filtered.length > 0 && (
                        <div className="cf-item cf-item--all" onClick={toggleAll}>
                            <input type="checkbox" readOnly checked={allSelected} />
                            <label>(select all)</label>
                        </div>
                    )}
                    {filtered.map(val => (
                        <div key={val} className="cf-item" onClick={() => toggle(val)}>
                            <input type="checkbox" readOnly checked={current.has(val)} />
                            <label title={resolveLabel(val)}>{resolveLabel(val)}</label>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div className="cf-empty">No values found</div>
                    )}
                </div>
            </>
        );
    };

    const renderDate = () => {
        const from = value?.from || '';
        const to = value?.to || '';
        const set = (field, val) => {
            const base = value?.type === 'range' ? value : { type: 'range', from: '', to: '' };
            onChange(colKey, { ...base, [field]: val });
        };
        return (
            <div className="cf-date-range">
                <div className="cf-date-field">
                    <label>From</label>
                    <input type="date" value={from} onChange={e => set('from', e.target.value)} />
                </div>
                <div className="cf-date-field">
                    <label>To</label>
                    <input type="date" value={to} onChange={e => set('to', e.target.value)} />
                </div>
            </div>
        );
    };

    const renderNumber = () => {
        const min = value?.min ?? '';
        const max = value?.max ?? '';
        const set = (field, val) => {
            const base = value?.type === 'numrange' ? value : { type: 'numrange', min: '', max: '' };
            onChange(colKey, { ...base, [field]: val });
        };
        return (
            <div className="cf-num-range">
                <div className="cf-range-row">
                    <span>Min</span>
                    <input type="number" placeholder="No min" value={min} onChange={e => set('min', e.target.value)} />
                </div>
                <div className="cf-range-row">
                    <span>Max</span>
                    <input type="number" placeholder="No max" value={max} onChange={e => set('max', e.target.value)} />
                </div>
            </div>
        );
    };

    const renderText = () => {
        const txt = typeof value === 'string' ? value : '';
        return (
            <div className="cf-text-input">
                <input
                    autoFocus
                    type="text"
                    placeholder={`Filter ${colName}…`}
                    value={txt}
                    onChange={e => onChange(colKey, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter') onClose(); }}
                />
            </div>
        );
    };

    const body = {
        list: renderList,
        date: renderDate,
        number: renderNumber,
        text: renderText,
    }[filterType] || renderList;

    const popup = (
        <div className="cf-popup" ref={popupRef} style={style} role="dialog" aria-label={`Filter ${colName}`}>
            <div className="cf-header">
                <span className="cf-header-icon" aria-hidden="true">{ICONS[filterType]}</span>
                <span>Filter: {colName}</span>
            </div>
            {body()}
            <div className="cf-footer">
                <button className="cf-btn" onClick={() => { onClear(colKey); onClose(); }}>Clear</button>
                <button className="cf-btn cf-btn--primary" onClick={onClose}>Close</button>
            </div>
        </div>
    );

    return createPortal(popup, document.body);
}

// ── Utility: apply a ColumnFilter value to a data array ──────────────────
// Import this in both GridForm and NormalGrid to share filter evaluation logic.
export function applyColumnFilterValue(data, colKey, filterValue, col) {
    if (!filterValue) return data;

    if (filterValue instanceof Set) {
        if (filterValue.size === 0) return data;
        return data.filter(r => filterValue.has(String(r[colKey] ?? '')));
    }

    if (filterValue.type === 'range') {
        const { from, to } = filterValue;
        if (!from && !to) return data;
        return data.filter(r => {
            const val = r[colKey];
            if (val == null || val === '') return false;
            const dateStr = typeof val === 'string' && val.includes('T') ? val.split('T')[0] : val;
            const dateVal = new Date(dateStr);
            if (isNaN(dateVal)) return false;
            if (from && dateVal < new Date(from)) return false;
            if (to) {
                const end = new Date(to); end.setHours(23, 59, 59, 999);
                if (dateVal > end) return false;
            }
            return true;
        });
    }

    if (filterValue.type === 'numrange') {
        const { min, max } = filterValue;
        if (min === '' && max === '') return data;
        return data.filter(r => {
            const n = Number(r[colKey]);
            if (isNaN(n)) return false;
            if (min !== '' && n < Number(min)) return false;
            if (max !== '' && n > Number(max)) return false;
            return true;
        });
    }

    if (typeof filterValue === 'string') {
        const lower = filterValue.toLowerCase();
        return data.filter(r => String(r[colKey] ?? '').toLowerCase().includes(lower));
    }

    return data;
}

// ── Utility: check if a filter value is "active" (non-empty) ─────────────
export function isFilterActive(filterValue) {
    if (!filterValue) return false;
    if (filterValue instanceof Set) return filterValue.size > 0;
    if (filterValue?.type === 'range') return !!(filterValue.from || filterValue.to);
    if (filterValue?.type === 'numrange') return filterValue.min !== '' || filterValue.max !== '';
    if (typeof filterValue === 'string') return filterValue.length > 0;
    return false;
}