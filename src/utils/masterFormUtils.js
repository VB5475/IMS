import {
  controlTypeMap,
  isCheckboxColCtrlType,
  isDropdownColCtrlType,
  isTextareaColCtrlType,
} from "../data/dummyData";
import {
  buildColumnMeta,
  isColumnMandatory,
  validateColumnValue,
} from "./columnValidation";

/** Display label for a GET_DETAIL_COL_DATA field. */
export function getMasterFieldLabel(field, labelOverrides = {}) {
  if (!field) return "Field";
  return labelOverrides[field.ColName] ?? field.DisplayName ?? field.ColName ?? "Field";
}

/** Resolve form control type from GET_DETAIL_COL_DATA ColCtrlType. */
export function resolveFieldControlType(field) {
  return field?.ColCtrlType ?? controlTypeMap.TEXTBOX;
}

export function isMasterToggleField(field) {
  return Number(field?.ColCtrlType) === controlTypeMap.TOGGLE;
}

export function isMasterCheckboxField(field) {
  return isCheckboxColCtrlType(field?.ColCtrlType);
}

export function isMasterDropdownField(field) {
  return isDropdownColCtrlType(field?.ColCtrlType);
}

export function isMasterTextareaField(field) {
  return isTextareaColCtrlType(field?.ColCtrlType);
}

export function getToggleValue(raw) {
  return Number(raw) === 1 ? 1 : 0;
}

export function getCheckboxValue(raw) {
  if (raw === true || raw === 1 || raw === "1" || raw === "Y" || raw === "y") return 1;
  return 0;
}

/** Visible detail/grid fields from GET_DETAIL_COL_DATA (ColSeqNo >= 100). */
export function getVisibleGridFields(fieldDefs) {
  return (fieldDefs || [])
    .filter((f) => f.IsVisible && Number(f.ColSeqNo) >= 100)
    .sort((a, b) => Number(a.ColSeqNo) - Number(b.ColSeqNo));
}

/**
 * Dropdown columns that should reload when a parent header field changes
 * (child UpdateKeyColName → parent ColName).
 */
export function buildMasterCascadeDropdownRefresh(fieldDefs) {
  const map = {};
  (fieldDefs || []).forEach((field) => {
    if (!isMasterDropdownField(field)) return;
    const parent = String(field.UpdateKeyColName ?? "").trim();
    const child = field.ColName;
    if (!parent || !child) return;
    if (!map[parent]) map[parent] = [];
    map[parent].push(child);
  });
  return map;
}

/** Visible header fields from GET_DETAIL_COL_DATA (ColSeqNo < 100). */
export function getVisibleHeaderFields(fieldDefs) {
  return (fieldDefs || [])
    .filter((f) => f.IsVisible && Number(f.ColSeqNo) < 100)
    .sort((a, b) => Number(a.ColSeqNo) - Number(b.ColSeqNo));
}

/** Default empty value for a field from ColCtrlType. */
export function getMasterFieldDefaultValue(field) {
  if (isMasterDropdownField(field)) return 0;
  if (isMasterToggleField(field) || isMasterCheckboxField(field)) return 0;
  return "";
}

/** Build initial form values from GET_DETAIL_COL_DATA + save context keys. */
export function buildMasterFormEmpty(fieldDefs, saveContext = {}) {
  const empty = { IDNumber: 0, ...saveContext };
  getVisibleHeaderFields(fieldDefs).forEach((field) => {
    const key = field.ColName;
    if (!key || empty[key] !== undefined) return;
    empty[key] = getMasterFieldDefaultValue(field);
  });
  return empty;
}

/**
 * Cascade map from UpdateKeyColName — parent ColName → child ColNames to clear.
 * e.g. GroupName with UpdateKeyColName "GroupCode" clears when GroupCode changes.
 */
export function buildMasterCascadeResets(fieldDefs) {
  const map = {};
  (fieldDefs || []).forEach((field) => {
    const parent = String(field.UpdateKeyColName ?? "").trim();
    const child = field.ColName;
    if (!parent || !child) return;
    if (!map[parent]) map[parent] = [];
    map[parent].push(child);
  });
  return map;
}

function isTruthyApiFlag(val) {
  if (val === true || val === 1) return true;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "1" || s === "y" || s === "yes";
  }
  return false;
}

/**
 * Lock state from GET_DETAIL_COL_DATA — mirrors EntryGrid column edit rules.
 * View mode → locked; add mode → IsEditAllow; edit mode → IsEditAllow + IsLockOnEditModeAllow.
 */
export function isMasterFieldLocked(field, { isAddMode, isEditMode }) {
  if (!isEditMode) return true;
  if (!isTruthyApiFlag(field?.IsEditAllow)) return true;
  if (!isAddMode && isTruthyApiFlag(field?.IsLockOnEditModeAllow)) return true;
  return false;
}

/** Whether a master field should show the required marker (respects skip lists). */
export function isMasterFieldRequired(field, options = {}) {
  const { skipFields = null, skipMandatoryFor = null } = options;
  const colName = field?.ColName;
  if (!colName) return false;

  const skipSet = skipFields instanceof Set ? skipFields : new Set(skipFields || []);
  const skipMandatorySet =
    skipMandatoryFor instanceof Set ? skipMandatoryFor : new Set(skipMandatoryFor || []);

  if (skipSet.has(colName) || skipMandatorySet.has(colName)) return false;
  if (isMasterToggleField(field) || isMasterCheckboxField(field)) return false;
  return isColumnMandatory(field);
}

function isDropdownEmpty(value) {
  return value == null || value === "" || Number(value) === 0;
}

function isTextEmpty(value) {
  return value == null || String(value).trim() === "";
}

/**
 * Validate master form fields using GET_DETAIL_COL_DATA rules.
 * @returns {string[]} error messages
 */
export function validateMasterFormFields(fields, values, options = {}) {
  const {
    keyMap = {},
    labelOverrides = {},
    skipFields = null,
    skipMandatoryFor = null,
  } = options;

  const skipSet = skipFields instanceof Set ? skipFields : new Set(skipFields || []);
  const skipMandatorySet =
    skipMandatoryFor instanceof Set ? skipMandatoryFor : new Set(skipMandatoryFor || []);

  const errors = [];

  (fields || []).forEach((field) => {
    const colName = field?.ColName;
    if (!colName || skipSet.has(colName)) return;

    const valueKey = keyMap[colName] ?? colName;
    const value = values[valueKey];
    const label = getMasterFieldLabel(field, labelOverrides);
    const isDropdown = isMasterDropdownField(field);
    const columnMeta = {
      ...buildColumnMeta(field),
      isDropdown,
    };
    const isToggle = isMasterToggleField(field);
    const isCheckbox = isMasterCheckboxField(field);
    const mandatory = isColumnMandatory(field) && !skipMandatorySet.has(colName);

    if (mandatory && !isToggle && !isCheckbox) {
      if (isDropdown ? isDropdownEmpty(value) : isTextEmpty(value)) {
        errors.push(`${label} is required.`);
        return;
      }
    }

    const result = validateColumnValue(value, { ...field, columnMeta });
    if (!result.valid) errors.push(result.message);
  });

  return errors;
}

/** Show validateMasterFormFields errors — intended for Save handler only. */
export function alertMasterFormValidationErrors(errors) {
  if (!errors?.length) return false;
  window.alert(errors.join("\n"));
  return true;
}

/** Defer action until after field blur handlers (avoids validation alerts before discard confirm). */
export function runAfterFieldBlur(fn) {
  window.setTimeout(fn, 0);
}
