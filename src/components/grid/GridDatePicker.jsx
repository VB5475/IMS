import React, { useCallback } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  dateToStoredValue,
  inputFormatToDatePicker,
  parseFlexibleDate,
} from "../../utils/dateFormat";

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
  const dateFormat = inputFormatToDatePicker(inputFormat);
  const selected = parseFlexibleDate(value);
  const min = minDate ? parseFlexibleDate(minDate) : undefined;
  const max = maxDate ? parseFlexibleDate(maxDate) : undefined;

  const handleChange = useCallback(
    (date) => {
      onChange(dateToStoredValue(date));
    },
    [onChange]
  );

  return (
    <div className="eg-datepicker-wrapper">
      <DatePicker
        selected={selected}
        onChange={handleChange}
        dateFormat={dateFormat}
        minDate={min ?? undefined}
        maxDate={max ?? undefined}
        onFocus={onFocus}
        onBlur={onBlur}
        className="cell-input cell-datepicker-input"
        calendarClassName="eg-datepicker-calendar"
        popperClassName="eg-datepicker-popper"
        popperProps={{ strategy: "fixed" }}
        placeholderText={dateFormat.toLowerCase()}
        title={ariaLabel}
        showPopperArrow={false}
        autoComplete="off"
        strictParsing
      />
    </div>
  );
}
