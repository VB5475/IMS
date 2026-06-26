// SearchSelect.jsx — Reusable searchable combobox (type-to-filter in the same field)

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import "./search-select.css";

/**
 * SearchSelect — combobox with inline typing and filtered dropdown options.
 */
export default function SearchSelect({
  value = "",
  onChange,
  options = [],
  placeholder = "-- Select --",
  searchPlaceholder = "Search...",
  className = "",
  id,
  ariaLabel,
  disabled = false,
  compact = false,
  onBlur,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const optionsListRef = useRef(null);
  const skipBlurRef = useRef(false);
  const suppressOpenRef = useRef(false);

  const selectedOption = options.find((o) => String(o.value) === String(value));
  const selectedLabel = selectedOption ? selectedOption.label : "";

  const filteredOptions = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    const idx = filteredOptions.findIndex((o) => String(o.value) === String(value));
    setFocusedIndex(idx);
  }, [query, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (focusedIndex < 0 || !optionsListRef.current) return;
    const item = optionsListRef.current.children[focusedIndex];
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  const computeDropdownStyle = useCallback(() => {
    if (!inputRef.current) return null;
    const rect = inputRef.current.getBoundingClientRect();
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
      position: "fixed",
      left: `${left}px`,
      width: `${minWidth}px`,
      maxHeight: `${maxHeight}px`,
      ...(dropUp
        ? { bottom: `${window.innerHeight - rect.top + gap}px`, top: "auto" }
        : { top: `${rect.bottom + gap}px`, bottom: "auto" }),
      zIndex: 2147483647,
    };
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      const inWrapper = wrapperRef.current && wrapperRef.current.contains(e.target);
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!inWrapper && !inDropdown) closeDropdown();
    }

    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, [isOpen, closeDropdown]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    setDropdownStyle(computeDropdownStyle());
  }, [isOpen, computeDropdownStyle]);

  useEffect(() => {
    if (!isOpen) return;

    const handleReposition = () => setDropdownStyle(computeDropdownStyle());

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [isOpen, computeDropdownStyle]);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setDropdownStyle(computeDropdownStyle());
    setQuery(selectedLabel);
    setIsOpen(true);
  }, [disabled, computeDropdownStyle, selectedLabel]);

  const handleSelect = useCallback(
    (optValue) => {
      onChange(optValue);
      suppressOpenRef.current = true;
      closeDropdown();
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [onChange, closeDropdown]
  );

  const handleClear = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      onChange("");
      suppressOpenRef.current = true;
      closeDropdown();
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [onChange, closeDropdown]
  );

  const handleInputFocus = useCallback(() => {
    if (disabled) return;
    if (suppressOpenRef.current) { suppressOpenRef.current = false; return; }
    openDropdown();
  }, [disabled, openDropdown]);

  const handleInputChange = useCallback(
    (e) => {
      if (disabled) return;
      const next = e.target.value;
      setQuery(next);
      setIsOpen(true);
      setDropdownStyle(computeDropdownStyle());

      if (!next) {
        onChange("");
        return;
      }

      const exact = options.find((o) => o.label.toLowerCase() === next.toLowerCase());
      if (exact) onChange(exact.value);
    },
    [disabled, computeDropdownStyle, onChange, options]
  );

  const handleInputBlur = useCallback(
    (e) => {
      if (skipBlurRef.current) {
        skipBlurRef.current = false;
        return;
      }

      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (wrapperRef.current?.contains(active)) return;
        if (dropdownRef.current?.contains(active)) return;
        closeDropdown();
        if (onBlur && !disabled) onBlur(e);
      });
    },
    [disabled, onBlur, closeDropdown]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (disabled) return;

      if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        if (options.length === 0) return;
        const currentIdx = options.findIndex((o) => String(o.value) === String(value));
        let nextIdx = currentIdx;
        if (e.key === "ArrowDown") {
          nextIdx = currentIdx < options.length - 1 ? currentIdx + 1 : 0;
          if (currentIdx === -1) nextIdx = 0;
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : options.length - 1;
          if (currentIdx === -1) nextIdx = options.length - 1;
        }
        handleSelect(options[nextIdx].value);
        return;
      }

      if (!isOpen) {
        if (e.key === "Enter") {
          const exact = options.find((o) => o.label.toLowerCase() === query.toLowerCase());
          if (exact) {
            e.preventDefault();
            handleSelect(exact.value);
          }
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setFocusedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
            handleSelect(filteredOptions[focusedIndex].value);
          } else if (filteredOptions.length === 1) {
            handleSelect(filteredOptions[0].value);
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          closeDropdown();
          requestAnimationFrame(() => inputRef.current?.focus());
          break;
        }
        case "Tab": {
          // No preventDefault — Tab moves focus to next field naturally
          if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
            onChange(filteredOptions[focusedIndex].value);
          }
          closeDropdown();
          break;
        }
        default:
          break;
      }
    },
    [disabled, isOpen, openDropdown, query, options, filteredOptions, focusedIndex, handleSelect, closeDropdown]
  );

  const wrapperClass = [
    "search-select",
    compact ? "search-select--compact" : "",
    isOpen ? "search-select--open" : "",
    disabled ? "search-select--disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inputValue = isOpen ? query : selectedLabel || query;

  const dropdownEl = isOpen ? (
    <div
      ref={dropdownRef}
      className="search-select__dropdown search-select__dropdown--portal"
      role="listbox"
      style={dropdownStyle ?? undefined}
      onMouseDown={() => {
        skipBlurRef.current = true;
      }}
    >
      <div className="search-select__options" ref={optionsListRef}>
        {filteredOptions.map((opt, idx) => {
          const isSelected = String(opt.value) === String(value);
          const isFocused = idx === focusedIndex;
          return (
            <div
              key={opt.value}
              className={[
                "search-select__option",
                isSelected ? "search-select__option--selected" : "",
                isFocused ? "search-select__option--focused" : "",
              ]
                .filter(Boolean)
                .join(" ")}
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
      <div className="search-select__field">
        <input
          ref={inputRef}
          type="text"
          className={`search-select__trigger search-select__input${!inputValue && !isOpen ? " search-select__placeholder" : ""}`}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={isOpen ? searchPlaceholder : placeholder}
          aria-label={ariaLabel || placeholder}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          disabled={disabled}
          autoComplete="off"
          title={selectedLabel || placeholder}
        />
        <span className="search-select__icons">
          {value && !disabled && (
            <span
              className="search-select__clear"
              onMouseDown={(e) => {
                skipBlurRef.current = true;
                handleClear(e);
              }}
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
            >
              ×
            </span>
          )}
          <ChevronDown size={12} className="search-select__chevron" />
        </span>
      </div>

      {dropdownEl && createPortal(dropdownEl, document.body)}
    </div>
  );
}
