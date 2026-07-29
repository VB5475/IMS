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
      // ArrowUp/ArrowDown mean two different things depending on whether the
      // calendar popup is open: closed, they shift the stored date by a day
      // (handleDateArrowKeys, same as the header's native date inputs); open,
      // they must be left untouched so react-datepicker's own internal
      // day-focus navigation runs. react-datepicker calls this onKeyDown prop
      // unconditionally BEFORE its own internal handling (it never checks
      // defaultPrevented), so our handleDateArrowKeys call was never actually
      // blocking its logic — but committing our own onChange for every arrow
      // press changes the `selected` prop out from under it, which resets its
      // internal preSelection-navigation tracking and breaks Enter's
      // select-and-close (confirmed live 2026-07-24: pressing an arrow key
      // then Enter no longer closed the calendar). Checking the picker's own
      // isCalendarOpen() (a live read of its internal state, not a value that
      // can lag behind a React re-render) avoids stepping on it entirely.
      if (datePickerRef.current?.isCalendarOpen?.()) return;
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
        // The real cause of "calendar never closes" (confirmed live 2026-07-24):
        // react-datepicker auto-opens on any focus event by default. The
        // grid's own Enter-key row navigation (gridKeyboardNav.js) blurs the
        // current cell then refocuses a cell in the same column — which, in a
        // single-row grid, wraps right back to the SAME date cell — so the
        // instant the calendar closes from selecting a date, that refocus
        // reopens it, making it look like it never closed at all. Disabling
        // auto-open-on-focus leaves opening to an explicit click or the
        // Space-key handler above, which is what a grid cell should do.
        preventOpenOnFocus
      />
    </div>
  );
}
