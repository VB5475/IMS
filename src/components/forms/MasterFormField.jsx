import React, { useCallback, useMemo, useRef, useState, Suspense, lazy } from "react";
import { RefreshCw, Plus } from "lucide-react";
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
import DateInput from "../ui/DateInput";
import { parseDateInputDisplay } from "../../utils/dateFormat";
import { selectInputText } from "../../utils/focusUtils";
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

function resolveDropdownLabel(options, value) {
  if (value == null || value === "") return "";
  const strVal = String(value);
  const match = (options || []).find((opt) => String(opt.value) === strVal);
  return match?.label ?? strVal;
}

/**
 * Renders a single admin master form field driven by GET_DETAIL_COL_DATA metadata.
 * Validation alerts are opt-in via validateOnBlur (default false — admin forms validate on Save only).
 * Dropdown fields (unlocked only) can opt into a trailing "refresh options" icon
 * (onRefresh) and a "quick-add" icon that opens another master's form inline
 * (quickAdd: { label, onAdd }) — onAdd may be omitted to render a disabled,
 * explained button when no master module exists yet for that dropdown.
 * `error` (string message) puts a red border on the control and renders the
 * message directly below it — pass the per-field message from
 * validateApiColumnsByField.
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
  onRefresh = null,
  quickAdd = null,
  error = null,
  // Dropdown-only (like onRefresh/quickAdd above) — greys out the combobox
  // while still showing it, for fields gated on another field's value
  // (e.g. Department disabled until a define-type checkbox is chosen).
  disabled = false,
}) {
  const lastValidRef = useRef(value);
  // Blur validation used to route through notify.error() — a blocking,
  // focus-stealing modal (see EnterpriseFilterPanel.jsx's own fix, same root
  // cause) meant for real save/API failures, not a routine per-field check
  // firing on every date-field Tab-out. Local state instead, rendered the
  // same way the parent-supplied `error` prop already is. (2026-08-21 /pm)
  const [blurError, setBlurError] = useState(null);
  const columnMeta = useMemo(() => buildColumnMeta(field), [field]);
  const controlType = resolveFieldControlType(field);
  const label = getMasterFieldLabel(field, labelOverrides);
  const dateConstraints = useMemo(
    () => (columnMeta?.dataKind === "date" ? getDateInputConstraints(columnMeta) : null),
    [columnMeta]
  );

  const displayValue = formatColumnDisplayValue(value, { ...field, columnMeta });

  const effectiveError = error || blurError;
  const effectiveInputClassName = effectiveError ? `${inputClassName} master-form-input--error` : inputClassName;
  const effectiveTextareaClassName = effectiveError
    ? `${textareaClassName} master-form-textarea--error`
    : textareaClassName;
  const dropdownClassName = effectiveError ? "master-form-dropdown--error" : undefined;

  const revertOnInvalid = useCallback(
    (nextValue) => {
      const shouldValidateOnBlur = validateOnBlur || columnMeta?.dataKind === "date";
      if (!shouldValidateOnBlur) return true;
      const isDropdown = isMasterDropdownField(field);
      const meta = { ...columnMeta, isDropdown: isDropdown || columnMeta?.isDropdown };
      const result = validateColumnValue(
        nextValue,
        { ...field, columnMeta: meta },
        { skipMandatory: true }
      );
      if (!result.valid) {
        setBlurError(result.message);
        // Date fields keep the typed value visible so the user can see and correct it;
        // other field types still revert to the last valid value.
        if (columnMeta?.dataKind !== "date") {
          onChange(lastValidRef.current);
        }
        return false;
      }
      setBlurError(null);
      lastValidRef.current = nextValue;
      return true;
    },
    [validateOnBlur, field, columnMeta, onChange]
  );

  // Clears blurError on any real edit — NOT used inside revertOnInvalid
  // itself, which must leave the just-set message alone through its own
  // auto-revert.
  const emitChange = useCallback(
    (val) => {
      setBlurError(null);
      onChange(val);
    },
    [onChange]
  );

  const handleFocus = useCallback(
    (e) => {
      lastValidRef.current = value;
      selectInputText(e.target);
    },
    [value]
  );

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

  const handleDateFocus = useCallback(() => {
    lastValidRef.current = value;
  }, [value]);

  const handleDateBlur = useCallback(
    (e) => {
      const parsed = parseDateInputDisplay(e.target.value, columnMeta?.inputFormat ?? "");
      if (parsed === null && String(e.target.value || "").trim() !== "") {
        // DateInput already reverted invalid display on blur.
        return;
      }
      revertOnInvalid(parsed ?? "");
    },
    [revertOnInvalid, columnMeta?.inputFormat]
  );

  // Renders the field's control only — locked/type branching lives here so the
  // outer component body (below) can append the error message once, in one
  // place, regardless of which branch produced the control.
  function buildControl() {
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
            onClick={() => emitChange(on ? 0 : 1)}
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
          onChange={(e) => emitChange(e.target.checked ? 1 : 0)}
          aria-label={label}
        />
      );
    }

    if (isMasterDropdownField(field)) {
      const dropdownControl = (
        <SearchSelect
          value={value != null && value !== "" ? String(value) : ""}
          onChange={(val) => emitChange(Number(val) || 0)}
          onBlur={() => revertOnInvalid(value)}
          options={options}
          placeholder={placeholder ?? "Select..."}
          ariaLabel={label}
          className={dropdownClassName}
          disabled={disabled}
        />
      );

      if (!onRefresh && !quickAdd) return dropdownControl;

      return (
        <div className="master-form-dropdown-row">
          {dropdownControl}
          {onRefresh && (
            <button
              type="button"
              className="master-form-icon-btn"
              tabIndex={-1}
              onClick={onRefresh}
              title={`Refresh ${label} options`}
              aria-label={`Refresh ${label} options`}
            >
              <RefreshCw size={12} strokeWidth={2.5} />
            </button>
          )}
          {quickAdd && (
            <button
              type="button"
              className="master-form-icon-btn"
              tabIndex={-1}
              onClick={quickAdd.onAdd}
              disabled={!quickAdd.onAdd}
              title={quickAdd.onAdd ? `Add new ${quickAdd.label}` : `${quickAdd.label} master not available`}
              aria-label={quickAdd.onAdd ? `Add new ${quickAdd.label}` : `${quickAdd.label} master not available`}
            >
              <Plus size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>
      );
    }

    if (controlType === controlTypeMap.DATE || columnMeta?.dataKind === "date") {
      return (
        <DateInput
          className={effectiveInputClassName}
          value={value}
          inputFormat={columnMeta?.inputFormat ?? ""}
          onChange={emitChange}
          onFocus={handleDateFocus}
          onBlur={handleDateBlur}
          min={dateConstraints?.min || undefined}
          max={dateConstraints?.max || undefined}
          aria-label={label}
        />
      );
    }

    if (controlType === controlTypeMap.TEXTAREA) {
      return (
        <textarea
          className={effectiveTextareaClassName}
          value={value ?? ""}
          onChange={(e) => emitChange(e.target.value)}
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
        <Suspense fallback={<input className={effectiveInputClassName} disabled aria-label={label} />}>
          <GridNumberInput
            className={effectiveInputClassName}
            value={value}
            columnMeta={meta}
            onChange={emitChange}
            onFocus={handleFocus}
            onBlur={handleNumericBlur}
            ariaLabel={label}
          />
        </Suspense>
      );
    }

    return (
      <input
        className={effectiveInputClassName}
        type={inputType}
        value={value ?? ""}
        onChange={(e) => emitChange(e.target.value)}
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

  // Must run after every hook above — Rules of Hooks requires this component
  // to call the same hooks in the same order on every render, so this early
  // return can't happen before revertOnInvalid/handleFocus/handleTextBlur/
  // handleNumericBlur/handleDateBlur are declared (moved here 2026-07-29,
  // see project_eslint_rollout memory).
  const custom = customRender?.({ field, value, onChange, locked, columnMeta, label });
  if (custom != null) return custom;

  const control = buildControl();
  if (!effectiveError) return control;
  return (
    <>
      {control}
      <div className="master-form-field-error">{effectiveError}</div>
    </>
  );
}
