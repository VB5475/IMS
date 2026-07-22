import React, { useCallback, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  dateToStoredValue,
  handleDateArrowKeys,
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
  const datePickerRef = useRef(null);

  const handleChange = useCallback(
    (date) => {
      onChange(dateToStoredValue(date));
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e) => {
      // The grid's own keyboard handler defers Space to the focused input
      // (see handleGridKeyboardEvent) since normal text cells type a literal
      // space — but this input is a date field with no such use for Space,
      // so open the calendar here instead of leaving Space as a no-op.
      if (e.key === " ") {
        e.preventDefault();
        datePickerRef.current?.setOpen(true);
        return;
      }
      handleDateArrowKeys(e, value, onChange);
    },
    [value, onChange]
  );

  return (
    <div className="eg-datepicker-wrapper">
      <DatePicker
        ref={datePickerRef}
        selected={selected}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
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
