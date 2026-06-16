import React, { useCallback, useState } from "react";
import {
  formatNumber,
  handleNumericKeyDown,
  parseNumberInput,
  sanitizeNumericInput,
} from "../../utils/numberFormat";

/**
 * Numeric grid cell: formatted display on blur, raw editable value on focus.
 * Stored row value stays unformatted for save/API.
 */
export default function GridNumberInput({
  value,
  columnMeta,
  onChange,
  onFocus,
  onBlur,
  ariaLabel,
  className = "cell-input cell-number-input",
  id,
  disabled = false,
  readOnly = false,
  tabIndex = 0,
}) {
  const [isFocused, setIsFocused] = useState(false);

  const inputFormat = columnMeta?.inputFormat ?? "";
  const decimalPlaces = columnMeta?.decimalPlaces ?? 0;

  const rawValue = value === null || value === undefined ? "" : String(value);
  const displayValue = formatNumber(rawValue, inputFormat, decimalPlaces);

  const commitValue = useCallback(
    (next) => {
      onChange(sanitizeNumericInput(next, decimalPlaces));
    },
    [onChange, decimalPlaces]
  );

  const handleFocus = useCallback(
    (e) => {
      if (readOnly || disabled) return;
      setIsFocused(true);
      onFocus?.(e);
    },
    [onFocus, readOnly, disabled]
  );

  const handleBlur = useCallback(
    (e) => {
      setIsFocused(false);
      commitValue(e.target.value);
      onBlur?.(e);
    },
    [onBlur, commitValue]
  );

  const handleChange = useCallback(
    (e) => {
      commitValue(e.target.value);
    },
    [commitValue]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (readOnly || disabled) return;
      handleNumericKeyDown(e, decimalPlaces);
    },
    [decimalPlaces, readOnly, disabled]
  );

  const handlePaste = useCallback(
    (e) => {
      if (readOnly || disabled) return;
      e.preventDefault();
      const input = e.target;
      const pasted = e.clipboardData.getData("text") || "";
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const merged = `${input.value.slice(0, start)}${pasted}${input.value.slice(end)}`;
      commitValue(merged);
    },
    [commitValue, readOnly, disabled]
  );

  return (
    <input
      id={id}
      className={className}
      type="text"
      inputMode="decimal"
      value={isFocused ? rawValue : displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      aria-label={ariaLabel}
      autoComplete="off"
      disabled={disabled}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : tabIndex}
    />
  );
}
