import React, { useCallback } from "react";
import {
  dateToStoredValue,
  parseFlexibleDate,
  toNativeDateInputValue,
} from "../../utils/dateFormat";
import DateInput from "../ui/DateInput";

export default function GridDatePicker({
  value,
  inputFormat = "",
  minDate,
  maxDate,
  onChange,
  onFocus,
  onBlur,
  ariaLabel,
}) {
  const commitNativeValue = useCallback(
    (next) => {
      if (!next) {
        onChange("");
        return;
      }
      const date = parseFlexibleDate(next);
      onChange(date ? dateToStoredValue(date) : "");
    },
    [onChange]
  );

  return (
    <DateInput
      className="cell-input cell-datepicker-input"
      value={value}
      inputFormat={inputFormat}
      onChange={commitNativeValue}
      min={minDate ? toNativeDateInputValue(minDate) : undefined}
      max={maxDate ? toNativeDateInputValue(maxDate) : undefined}
      title={ariaLabel}
      aria-label={ariaLabel}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}
