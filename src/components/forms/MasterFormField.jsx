import React, { useCallback, useMemo, useRef, Suspense, lazy } from "react";
import { controlTypeMap } from "../../data/dummyData";
import SearchSelect from "../ui/SearchSelect";
import {
  buildColumnMeta,
  formatColumnDisplayValue,
  getDateInputConstraints,
  resolveColumnMeta,
  validateColumnValue,
} from "../../utils/columnValidation";
import { parseNumberInput } from "../../utils/numberFormat";
import { handleDateArrowKeys, parseFlexibleDate } from "../../utils/dateFormat";
import { useNotification } from "../../context/NotificationContext";
import {
  getCheckboxValue,
  getMasterFieldLabel,
  getToggleValue,
  isMasterCheckboxField,
  isMasterDropdownField,
  isMasterToggleField,
  resolveFieldControlType,
} from "../../utils/masterFormUtils";
import "./MasterFormField.css";

const GridNumberInput = lazy(() => import("../grid/GridNumberInput"));

function toNativeDateInputValue(value) {
  const date = parseFlexibleDate(value);
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveDropdownLabel(options, value) {
  if (value == null || value === "") return "";
  const strVal = String(value);
  const match = (options || []).find((opt) => String(opt.value) === strVal);
  return match?.label ?? strVal;
}

/**
 * Renders a single admin master form field driven by GET_DETAIL_COL_DATA metadata.
 * Validation alerts are opt-in via validateOnBlur (default false — admin forms validate on Save only).
 */
export default function MasterFormField({
  field,
  value,
  onChange,
  locked = false,
  options = [],
  labelOverrides = {},
  inputClassName = "master-form-input",
  textareaClassName = "master-form-textarea",
  valueClassName = "master-form-value",
  toggleClassName = "master-form-toggle",
  inputType = "text",
  maskWhenLocked = false,
  placeholder = null,
  customRender = null,
  validateOnBlur = false,
  autoComplete,
}) {
  const notify = useNotification();
  const lastValidRef = useRef(value);
  const columnMeta = useMemo(() => buildColumnMeta(field), [field]);
  const controlType = resolveFieldControlType(field);
  const label = getMasterFieldLabel(field, labelOverrides);
  const dateConstraints = useMemo(
    () => (columnMeta?.dataKind === "date" ? getDateInputConstraints(columnMeta) : null),
    [columnMeta]
  );

  const custom = customRender?.({ field, value, onChange, locked, columnMeta, label });
  if (custom != null) return custom;

  const displayValue = formatColumnDisplayValue(value, { ...field, columnMeta });

  const revertOnInvalid = useCallback(
    (nextValue) => {
      if (!validateOnBlur) return true;
      const isDropdown = isMasterDropdownField(field);
      const meta = { ...columnMeta, isDropdown: isDropdown || columnMeta?.isDropdown };
      const result = validateColumnValue(
        nextValue,
        { ...field, columnMeta: meta },
        { skipMandatory: true }
      );
      if (!result.valid) {
        notify.error(result.message);
        onChange(lastValidRef.current);
        return false;
      }
      lastValidRef.current = nextValue;
      return true;
    },
    [validateOnBlur, field, columnMeta, onChange, notify]
  );

  const handleFocus = useCallback(() => {
    lastValidRef.current = value;
  }, [value]);

  const handleTextBlur = useCallback(
    (e) => {
      const next = e.target.value;
      if (!revertOnInvalid(next)) return;
      onChange(next);
    },
    [onChange, revertOnInvalid]
  );

  const handleNumericBlur = useCallback(
    (e) => {
      const next = parseNumberInput(e.target.value);
      if (!revertOnInvalid(next)) return;
      onChange(next);
    },
    [onChange, revertOnInvalid]
  );

  const handleDateBlur = useCallback(
    (e) => {
      const next = e.target.value;
      if (!revertOnInvalid(next)) return;
      onChange(next);
    },
    [onChange, revertOnInvalid]
  );

  if (locked) {
    if (maskWhenLocked && inputType === "password") {
      return <span className={valueClassName}>********</span>;
    }

    if (isMasterToggleField(field)) {
      const on = getToggleValue(value);
      return <span className={valueClassName}>{on ? "Yes" : "No"}</span>;
    }

    if (isMasterCheckboxField(field)) {
      const on = getCheckboxValue(value);
      return <span className={valueClassName}>{on ? "Yes" : "No"}</span>;
    }

    if (isMasterDropdownField(field)) {
      const text = resolveDropdownLabel(options, value);
      return <span className={valueClassName}>{text || "—"}</span>;
    }

    if (controlType === controlTypeMap.LABEL) {
      return <span className={valueClassName}>{displayValue || value || "—"}</span>;
    }

    return <span className={valueClassName}>{displayValue || value || "—"}</span>;
  }

  if (isMasterToggleField(field)) {
    const on = getToggleValue(value);
    return (
      <div className="master-form-control--toggle">
        <button
          type="button"
          role="switch"
          aria-checked={on === 1}
          aria-label={label}
          className={`${toggleClassName}${on ? ` ${toggleClassName}--on` : ""}`}
          onClick={() => onChange(on ? 0 : 1)}
        />
        <span className="master-form-toggle-label">{on ? "Yes" : "No"}</span>
      </div>
    );
  }

  if (isMasterCheckboxField(field)) {
    const checked = getCheckboxValue(value) === 1;
    return (
      <input
        type="checkbox"
        className="master-form-checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked ? 1 : 0)}
        aria-label={label}
      />
    );
  }

  if (isMasterDropdownField(field)) {
    return (
      <SearchSelect
        value={value != null && value !== "" ? String(value) : ""}
        onChange={(val) => onChange(Number(val) || 0)}
        onBlur={() => revertOnInvalid(value)}
        options={options}
        placeholder={placeholder ?? "Select..."}
        ariaLabel={label}
      />
    );
  }

  if (controlType === controlTypeMap.DATE || columnMeta?.dataKind === "date") {
    return (
      <input
        type="date"
        className={inputClassName}
        value={toNativeDateInputValue(value)}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={(e) =>
          handleDateArrowKeys(e, toNativeDateInputValue(value), onChange, { nativeInput: true })
        }
        onBlur={handleDateBlur}
        min={dateConstraints?.min || undefined}
        max={dateConstraints?.max || undefined}
        aria-label={label}
        autoComplete="off"
      />
    );
  }

  if (controlType === controlTypeMap.TEXTAREA) {
    return (
      <textarea
        className={textareaClassName}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleTextBlur}
        placeholder={placeholder ?? `Enter ${label}...`}
        rows={3}
        maxLength={
          columnMeta?.dataKind === "varchar" && columnMeta?.maxLen != null
            ? columnMeta.maxLen
            : undefined
        }
        aria-label={label}
      />
    );
  }

  if (controlType === controlTypeMap.LABEL) {
    return <span className={valueClassName}>{displayValue || value || "—"}</span>;
  }

  const meta = resolveColumnMeta({ ...field, columnMeta });
  if (meta?.dataKind === "numeric") {
    return (
      <Suspense fallback={<input className={inputClassName} disabled aria-label={label} />}>
        <GridNumberInput
          className={inputClassName}
          value={value}
          columnMeta={meta}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleNumericBlur}
          ariaLabel={label}
        />
      </Suspense>
    );
  }

  return (
    <input
      className={inputClassName}
      type={inputType}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleTextBlur}
      placeholder={placeholder ?? `Enter ${label}...`}
      autoComplete={autoComplete}
      maxLength={
        columnMeta?.dataKind === "varchar" && columnMeta?.maxLen != null
          ? columnMeta.maxLen
          : undefined
      }
      aria-label={label}
    />
  );
}
