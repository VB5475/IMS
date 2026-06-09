// SearchSelect.jsx — Reusable searchable dropdown component
// ─────────────────────────────────────────────────────────
// Replaces native <select> with a custom dropdown that has
// a search/filter input at the top.

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import './search-select.css';

/**
 * SearchSelect — A searchable select dropdown.
 *
 * Props:
 *   value        — currently selected value (string)
 *   onChange      — (newValue) => void
 *   options       — [{ value, label }]
 *   placeholder   — text when nothing is selected
 *   searchPlaceholder — text inside the search input
 *   className     — additional CSS class on the wrapper
 *   id            — HTML id for accessibility
 *   ariaLabel     — aria-label for the trigger button
 *   disabled      — disables the control
 *   compact       — if true, uses compact sizing (for grid cells)
 *   onBlur        — called when focus leaves the control (not while dropdown is open)
 */
export default function SearchSelect({
  value = '',
  onChange,
  options = [],
  placeholder = '-- Select --',
  searchPlaceholder = 'Search...',
  className = '',
  id,
  ariaLabel,
  disabled = false,
  compact = false,
  onBlur,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionsListRef = useRef(null);

  // Find the label for the currently selected value
  const selectedOption = options.find((o) => String(o.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : '';

  // Filter options by search text
  const filteredOptions = search
    ? options.filter((o) =>
      o.label.toLowerCase().includes(search.toLowerCase())
    )
    : options;

  // ── Reset focusedIndex when search changes or dropdown opens ────────────
  useEffect(() => {
    // Pre-highlight the already-selected item, or default to -1
    const idx = filteredOptions.findIndex(
      (o) => String(o.value) === String(value)
    );
    setFocusedIndex(idx);
  }, [search, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll focused option into view ────────────────────────────────────
  useEffect(() => {
    if (focusedIndex < 0 || !optionsListRef.current) return;
    const item = optionsListRef.current.children[focusedIndex];
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  // ── Compute dropdown position from the trigger element ──────────────────
  const computeDropdownStyle = useCallback(() => {
    if (!triggerRef.current) return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const minWidth = Math.max(rect.width, 200);
    const maxDropHeight = 280;
    const gap = 4;
    const margin = 8;

    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const dropUp = spaceBelow < maxDropHeight && spaceAbove > spaceBelow;
    const available = dropUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(maxDropHeight, Math.max(120, available - margin));

    let left = rect.left;
    const maxLeft = window.innerWidth - minWidth - margin;
    if (left > maxLeft) left = Math.max(margin, maxLeft);
    if (left < margin) left = margin;

    return {
      position: 'fixed',
      left: `${left}px`,
      width: `${minWidth}px`,
      maxHeight: `${maxHeight}px`,
      ...(dropUp
        ? { bottom: `${window.innerHeight - rect.top + gap}px`, top: 'auto' }
        : { top: `${rect.bottom + gap}px`, bottom: 'auto' }),
      zIndex: 2147483647,
    };
  }, []);

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      const inWrapper =
        wrapperRef.current && wrapperRef.current.contains(e.target);
      const inDropdown =
        dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!inWrapper && !inDropdown) {
        setIsOpen(false);
        setSearch('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside, true);
    return () =>
      document.removeEventListener('mousedown', handleClickOutside, true);
  }, [isOpen]);

  // ── Auto-focus search input when opened ─────────────────────────────────
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      const id = requestAnimationFrame(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen]);

  // ── Reposition on scroll/resize while open (portal mode) ─────────────────
  useLayoutEffect(() => {
    if (!isOpen) return;
    setDropdownStyle(computeDropdownStyle());
  }, [isOpen, computeDropdownStyle]);

  useEffect(() => {
    if (!isOpen) return;

    const handleReposition = () => {
      setDropdownStyle(computeDropdownStyle());
    };

    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, computeDropdownStyle]);

  // ── Toggle open/closed ───────────────────────────────────────────────────
  const handleToggle = useCallback(
    (e) => {
      e.stopPropagation();

      if (disabled) return;

      if (!isOpen) {
        setDropdownStyle(computeDropdownStyle());
        setIsOpen(true);
      } else {
        setIsOpen(false);
        setSearch('');
      }
    },
    [disabled, isOpen, computeDropdownStyle]
  );

  const handleSelect = useCallback(
    (optValue) => {
      onChange(optValue);
      setIsOpen(false);
      setSearch('');
      requestAnimationFrame(() => triggerRef.current?.focus());
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e) => {
      e.stopPropagation();
      onChange('');
      setIsOpen(false);
      setSearch('');
      requestAnimationFrame(() => triggerRef.current?.focus());
    },
    [onChange]
  );

  const handleTriggerBlur = useCallback(
    (e) => {
      if (!onBlur || disabled) return;
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (wrapperRef.current?.contains(active)) return;
        if (dropdownRef.current?.contains(active)) return;
        onBlur(e);
      });
    },
    [disabled, onBlur],
  );

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
            handleSelect(filteredOptions[focusedIndex].value);
          } else if (filteredOptions.length === 1) {
            // Fallback: if nothing is focused but only one result exists, select it
            handleSelect(filteredOptions[0].value);
          }
          break;
        }
        case 'Escape': {
          setIsOpen(false);
          setSearch('');
          requestAnimationFrame(() => triggerRef.current?.focus());
          break;
        }
        default:
          break;
      }
    },
    [isOpen, focusedIndex, filteredOptions, handleSelect]
  );

  const wrapperClass = [
    'search-select',
    compact ? 'search-select--compact' : '',
    isOpen ? 'search-select--open' : '',
    disabled ? 'search-select--disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // ── Dropdown element (shared between portal and inline) ──────────────────
  const dropdownEl = isOpen ? (
    <div
      ref={dropdownRef}
      className="search-select__dropdown search-select__dropdown--portal"
      role="listbox"
      style={dropdownStyle ?? undefined}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Search input */}
      <div className="search-select__search-wrap">
        <Search size={14} className="search-select__search-icon" />
        <input
          ref={searchInputRef}
          type="text"
          className="search-select__search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Options list */}
      <div className="search-select__options" ref={optionsListRef}>
        {filteredOptions.map((opt, idx) => {
          const isSelected = String(opt.value) === String(value);
          const isFocused = idx === focusedIndex;
          return (
            <div
              key={opt.value}
              className={[
                'search-select__option',
                isSelected ? 'search-select__option--selected' : '',
                isFocused ? 'search-select__option--focused' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleSelect(opt.value)}
              onMouseEnter={() => setFocusedIndex(idx)}
              role="option"
              aria-selected={isSelected}
              title={opt.label}
            >
              {opt.label}
              {isSelected && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="search-select__check"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          );
        })}
        {filteredOptions.length === 0 && (
          <div className="search-select__empty">No results found</div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className={wrapperClass} ref={wrapperRef} id={id}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        className="search-select__trigger"
        onClick={handleToggle}
        onBlur={handleTriggerBlur}
        aria-label={ariaLabel || placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        title={displayLabel || placeholder}
      >
        <span
          className={`search-select__value ${!displayLabel ? 'search-select__placeholder' : ''
            }`}
        >
          {displayLabel || placeholder}
        </span>
        <span className="search-select__icons">
          {value && !disabled && (
            <span
              className="search-select__clear"
              onClick={handleClear}
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
            >
              ×
            </span>
          )}
          <ChevronDown size={12} className="search-select__chevron" />
        </span>
      </button>

      {/* Dropdown portaled to body — escapes overflow:hidden / sticky ancestors */}
      {dropdownEl && createPortal(dropdownEl, document.body)}
    </div>
  );
}