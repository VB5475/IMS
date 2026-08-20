import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DatePicker from "react-datepicker";
import { Calendar } from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";
import {
  clampNativeDateValue,
  formatDateInputDisplay,
  getDateDisplayConfig,
  getTextDateInputProps,
  inputFormatToDatePicker,
  parseDateInputDisplay,
  parseFlexibleDate,
  resolveDateInputFormat,
  toNativeDateInputValue,
} from "../../utils/dateFormat";
import "./DateInput.css";

function computeCalendarPopperStyle(anchorEl, popperEl) {
  if (!anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();
  const gap = 4;
  const margin = 8;
  const popperWidth = popperEl?.offsetWidth || 252;
  const popperHeight = popperEl?.offsetHeight || 320;

  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const spaceAbove = rect.top - gap;
  const dropUp = spaceBelow < popperHeight && spaceAbove > spaceBelow;

  let left = rect.left;
  if (left + popperWidth > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - popperWidth - margin);
  }
  if (left < margin) left = margin;

  return {
    position: "fixed",
    left: `${left}px`,
    zIndex: 2147483647,
    ...(dropUp
      ? { bottom: `${window.innerHeight - rect.top + gap}px`, top: "auto" }
      : { top: `${rect.bottom + gap}px`, bottom: "auto" }),
  };
}

export default function DateInput({
  value,
  onChange,
  inputFormat = "",
  className = "",
  id,
  min,
  max,
  disabled,
  readOnly,
  tabIndex,
  title,
  "aria-label": ariaLabel,
  onFocus,
  onBlur,
  autoComplete = "off",
}) {
  const wrapRef = useRef(null);
  const popperRef = useRef(null);
  const draftRef = useRef(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [popperStyle, setPopperStyle] = useState(null);
  const [draftText, setDraftText] = useState(null);
  const isEditing = draftText !== null;

  const resolvedFormat = useMemo(() => resolveDateInputFormat(inputFormat), [inputFormat]);
  const nativeValue = toNativeDateInputValue(value);
  const committedDisplay = formatDateInputDisplay(value, resolvedFormat);
  const shownValue = isEditing ? draftText : committedDisplay;
  const displayConfig = useMemo(() => getDateDisplayConfig(resolvedFormat), [resolvedFormat]);
  const pickerFormat = displayConfig.pickerFormat || inputFormatToDatePicker(resolvedFormat);
  const selected = parseFlexibleDate(nativeValue);
  const minDate = min ? parseFlexibleDate(min) : undefined;
  const maxDate = max ? parseFlexibleDate(max) : undefined;

  const commitNativeValue = useCallback(
    (next) => {
      onChange?.(clampNativeDateValue(next ?? "", min, max));
    },
    [onChange, min, max]
  );

  const commitDraftText = useCallback(
    (text) => {
      const parsed = parseDateInputDisplay(text, resolvedFormat);
      if (parsed === null && String(text ?? "").trim() !== "") {
        setDraftText(null);
        draftRef.current = null;
        return false;
      }
      commitNativeValue(parsed ?? "");
      setDraftText(null);
      draftRef.current = null;
      return true;
    },
    [resolvedFormat, commitNativeValue]
  );

  const handleSegmentChange = useCallback(
    (next) => {
      commitNativeValue(next);
      const nextDisplay = formatDateInputDisplay(next, resolvedFormat);
      draftRef.current = nextDisplay;
      setDraftText(nextDisplay);
    },
    [commitNativeValue, resolvedFormat]
  );

  const textProps = useMemo(
    () =>
      getTextDateInputProps(nativeValue, handleSegmentChange, {
        inputFormat: resolvedFormat,
        min,
        max,
      }),
    [nativeValue, handleSegmentChange, resolvedFormat, min, max]
  );

  const repositionPopper = useCallback(() => {
    setPopperStyle(computeCalendarPopperStyle(wrapRef.current, popperRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!calendarOpen) return;
    repositionPopper();
    requestAnimationFrame(repositionPopper);
  }, [calendarOpen, repositionPopper]);

  useEffect(() => {
    if (!calendarOpen) return undefined;

    const handleOutside = (e) => {
      const inWrap = wrapRef.current?.contains(e.target);
      const inPopper = popperRef.current?.contains(e.target);
      if (!inWrap && !inPopper) setCalendarOpen(false);
    };

    window.addEventListener("scroll", repositionPopper, true);
    window.addEventListener("resize", repositionPopper);
    document.addEventListener("mousedown", handleOutside, true);
    return () => {
      window.removeEventListener("scroll", repositionPopper, true);
      window.removeEventListener("resize", repositionPopper);
      document.removeEventListener("mousedown", handleOutside, true);
    };
  }, [calendarOpen, repositionPopper]);

  const handleCalendarSelect = useCallback(
    (date) => {
      if (!date) {
        commitNativeValue("");
        setDraftText(null);
      } else {
        const next = toNativeDateInputValue(date);
        commitNativeValue(next);
        const nextDisplay = formatDateInputDisplay(next, resolvedFormat);
        draftRef.current = nextDisplay;
        setDraftText(nextDisplay);
      }
      setCalendarOpen(false);
    },
    [commitNativeValue, resolvedFormat]
  );

  const handleFocus = useCallback(
    (e) => {
      const initial = formatDateInputDisplay(value, resolvedFormat);
      draftRef.current = initial;
      setDraftText(initial);
      textProps.onFocus?.(e);
      onFocus?.(e);
    },
    [textProps, onFocus, value, resolvedFormat]
  );

  const handleBlur = useCallback(
    (e) => {
      commitDraftText(draftRef.current ?? e.target.value);
      onBlur?.(e);
    },
    [commitDraftText, onBlur]
  );

  const handleChange = useCallback((e) => {
    draftRef.current = e.target.value;
    setDraftText(e.target.value);
  }, []);

  const handleInputKeyDown = useCallback(
    (e) => {
      if (readOnly || disabled) return;
      if (e.key === " " && !e.defaultPrevented) {
        e.preventDefault();
        setCalendarOpen(true);
      }
      if (e.key === "Tab" && draftRef.current !== null) {
        commitDraftText(draftRef.current ?? e.target.value);
      }
      textProps.onKeyDown?.(e);
    },
    [disabled, readOnly, textProps, commitDraftText]
  );

  const showCalendar = !readOnly && !disabled;

  const calendarPopper =
    showCalendar && calendarOpen && popperStyle
      ? createPortal(
          <div
            ref={popperRef}
            className="date-input-calendar-popper"
            style={popperStyle}
          >
            <DatePicker
              inline
              selected={selected}
              onChange={handleCalendarSelect}
              minDate={minDate ?? undefined}
              maxDate={maxDate ?? undefined}
              dateFormat={pickerFormat}
              calendarClassName="date-input-calendar"
            />
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className={`date-input-wrap${calendarOpen ? " date-input-wrap--open" : ""}`} ref={wrapRef}>
        <input
          type="text"
          className={`date-input-field${isEditing ? " date-input-field--editing" : ""}${className ? ` ${className}` : ""}`}
          id={id}
          value={shownValue}
          disabled={disabled}
          readOnly={readOnly}
          tabIndex={tabIndex}
          title={title}
          aria-label={ariaLabel}
          autoComplete={autoComplete}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          onClick={textProps.onClick}
          onMouseUp={textProps.onMouseUp}
          onKeyDown={handleInputKeyDown}
          data-date-segment-input={textProps["data-date-segment-input"]}
          data-date-input-format={textProps["data-date-input-format"]}
          maxLength={textProps.maxLength}
          placeholder={textProps.placeholder}
        />
        {showCalendar && (
          <button
            type="button"
            className="date-input-calendar-btn"
            tabIndex={-1}
            title="Open calendar"
            aria-label="Open calendar"
            onClick={() => setCalendarOpen((open) => !open)}
          >
            <Calendar size={14} strokeWidth={2} />
          </button>
        )}
      </div>
      {calendarPopper}
    </>
  );
}
