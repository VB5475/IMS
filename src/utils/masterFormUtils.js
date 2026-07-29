import { buildSaveRowFromColumns, getColDefault } from "../api/constants";
import {
  controlTypeMap,
  isCheckboxColCtrlType,
  isDropdownColCtrlType,
  isTextareaColCtrlType,
  isToggleColCtrlType,
} from "../data/dummyData";
import {
  buildColumnMeta,
  isColumnMandatory,
  pickApiField,
  validateColumnValue,
} from "./columnValidation";
import { resolveRowFieldValue } from "./gridUtils";

/** Display label for a GET_DETAIL_COL_DATA field (DisplayName from API). */
export function getMasterFieldLabel(field, labelOverrides = {}) {
  if (!field) return "Field";
  const colName = pickApiField(field, "ColName", "colname");
  if (colName && labelOverrides[colName]) return labelOverrides[colName];
  const displayName = pickApiField(field, "DisplayName", "displayname");
  if (displayName) return String(displayName);
  if (colName) return String(colName);
  return "Field";
}

/** ColCtrlType from GET_DETAIL_COL_DATA (any API key casing). */
export function getFieldColCtrlType(field) {
  const raw = pickApiField(field, "ColCtrlType", "colctrltype");
  return raw != null && raw !== "" ? Number(raw) : null;
}

/** Resolve form control type from GET_DETAIL_COL_DATA ColCtrlType. */
export function resolveFieldControlType(field) {
  return getFieldColCtrlType(field) ?? controlTypeMap.TEXTBOX;
}

export function isMasterToggleField(field) {
  return isToggleColCtrlType(getFieldColCtrlType(field));
}

export function isMasterCheckboxField(field) {
  return isCheckboxColCtrlType(getFieldColCtrlType(field));
}

export function isMasterDropdownField(field) {
  return isDropdownColCtrlType(getFieldColCtrlType(field));
}

export function isMasterTextareaField(field) {
  return isTextareaColCtrlType(getFieldColCtrlType(field));
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
    .filter(
      (f) =>
        isTruthyApiFlag(pickApiField(f, "IsVisible", "isvisible")) &&
        Number(pickApiField(f, "ColSeqNo", "colseqno")) < 100
    )
    .sort(
      (a, b) =>
        Number(pickApiField(a, "ColSeqNo", "colseqno")) -
        Number(pickApiField(b, "ColSeqNo", "colseqno"))
    );
}

/** Default empty value from GET_DETAIL_COL_DATA ColCtrlType + ColDataType. */
export function getMasterFieldDefaultValue(field) {
  if (isMasterDropdownField(field)) return 0;
  if (isMasterToggleField(field) || isMasterCheckboxField(field)) return 0;
  const colDataType = pickApiField(field, "ColDataType", "colDataType", "coldatatype");
  const typedDefault = getColDefault(colDataType);
  return typedDefault !== null && typedDefault !== undefined ? typedDefault : "";
}

/**
 * Build a master header save row: seed every GET_DETAIL_COL_DATA column (incl. hidden)
 * with ColDataType defaults, then overlay form values.
 */
export function buildMasterHeaderSaveRow(fieldDefs, formValues, { includeHidden = true } = {}) {
  const columnDefs = (fieldDefs || [])
    .filter((field) => {
      if (!field?.ColName) return false;
      if (includeHidden) return true;
      return field.IsVisible && Number(field.ColSeqNo) < 100;
    })
    .map((field) => ({
      key: field.ColName,
      colDataType: pickApiField(field, "ColDataType", "colDataType", "coldatatype") ?? null,
    }));
  return buildSaveRowFromColumns(formValues, columnDefs);
}

/**
 * Build save row with ColDataType defaults, then normalize toggle/checkbox fields.
 */
export function finalizeMasterHeaderSaveRow(
  fieldDefs,
  formValues,
  { includeHidden = true, fieldsToFinalize = null, omitKeys = null } = {}
) {
  const saveRow = buildMasterHeaderSaveRow(fieldDefs, formValues, { includeHidden });

  if (omitKeys?.size) {
    omitKeys.forEach((key) => {
      delete saveRow[key];
    });
  }

  const fields = fieldsToFinalize ?? getVisibleHeaderFields(fieldDefs);
  fields.forEach((field) => {
    const key = field.ColName;
    if (!key || !(key in saveRow)) return;
    if (isMasterToggleField(field)) {
      saveRow[key] = getToggleValue(saveRow[key]);
    }
    if (isMasterCheckboxField(field)) {
      saveRow[key] = getCheckboxValue(saveRow[key]);
    }
  });

  return saveRow;
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
  const isEditAllow = field?.IsEditAllow ?? field?.iseditallow;
  if (!isTruthyApiFlag(isEditAllow)) return true;
  const isLockOnEdit = field?.IsLockOnEditModeAllow ?? field?.islockoneditmodeallow;
  if (!isAddMode && isTruthyApiFlag(isLockOnEdit)) return true;
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


/** Normalize GET_DETAIL_COL_DATA link — API may return PascalCase or camelCase keys. */
export function normalizeDetailColField(field) {
  if (!field || typeof field !== "object") return field;
  const normalized = {
    ...field,
    ColName: pickApiField(field, "ColName", "colname"),
    DisplayName: pickApiField(field, "DisplayName", "displayname"),
    ColCtrlType: pickApiField(field, "ColCtrlType", "colctrltype"),
    ColSeqNo: pickApiField(field, "ColSeqNo", "colseqno"),
    IsVisible: pickApiField(field, "IsVisible", "isvisible"),
    IsMandatory: pickApiField(field, "IsMandatory", "ismandatory"),
    IsValidationReq: pickApiField(field, "IsValidationReq", "isvalidationreq"),
    IsEditAllow: pickApiField(field, "IsEditAllow", "iseditallow"),
    IsLockOnEditModeAllow: pickApiField(field, "IsLockOnEditModeAllow", "islockoneditmodeallow"),
    UpdateKeyColName: pickApiField(field, "UpdateKeyColName", "updatekeycolname"),
    ColDataType: pickApiField(field, "ColDataType", "colDataType", "coldatatype"),
    ObjDetID: pickApiField(field, "ObjDetID", "objdetid"),
    CtrlValueCol: pickApiField(field, "CtrlValueCol", "ctrlvaluecol"),
    CtrlDisplayCol: pickApiField(field, "CtrlDisplayCol", "ctrldisplaycol"),
    InputFormat: pickApiField(field, "InputFormat", "inputformat"),
    ValueMinRange: pickApiField(field, "ValueMinRange", "valueminrange"),
    ValueMaxRange: pickApiField(field, "ValueMaxRange", "valuemaxrange"),
    MinLen: pickApiField(field, "MinLen", "minlen"),
    MaxLen: pickApiField(field, "MaxLen", "maxlen"),
    IsCrossYearEntryAllow: pickApiField(field, "IsCrossYearEntryAllow", "iscrossyearentryallow"),
    IsFutureDateAllow: pickApiField(field, "IsFutureDateAllow", "isfuturedateallow"),
  };
  return normalized;
}

export function normalizeDetailColLinks(links = []) {
  return (links || []).map(normalizeDetailColField);
}

/** Parse GET_DETAIL_COL_DATA payload — array, Links, or Table wrapper. */
export function resolveDetailColLinks(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.Links)) return payload.Links;
  if (Array.isArray(payload?.Table)) return payload.Table;
  return [];
}

/** Map master-fill row to header form values with case-insensitive field lookup. */
export function mapMasterRowToHeaderValues(master, fieldDefs, context = {}) {
  // Save SPs read lowercase keys (PG column casing) — emit lowercase only,
  // a PascalCase duplicate here leaks straight into the save payload.
  const header = {
    idnumber: Number(resolveRowFieldValue(master, "IDNumber") ?? context.idNumber) || 0,
    companyid: Number(context.companyId) || 0,
    yearid: Number(resolveRowFieldValue(master, "YearID") ?? context.yearId) || 0,
    loginid: Number(resolveRowFieldValue(master, "LoginID") ?? context.loginId) || 0,
    sessionid: Number(resolveRowFieldValue(master, "SessionID") ?? context.sessionId) || 0,
    funccode: resolveRowFieldValue(master, "FuncCode") ?? context.funcCode ?? "",
  };

  getVisibleHeaderFields(fieldDefs).forEach((field) => {
    const key = field.ColName;
    if (!key) return;
    const raw = resolveRowFieldValue(master, key);
    if (raw === undefined) return;
    header[key] = raw;
  });

  return header;
}

/** Alerts and returns true if there are validation errors (caller should abort save). */
export function alertMasterFormValidationErrors(errors) {
  if (!errors || errors.length === 0) return false;
  window.alert(errors.join("\n"));
  return true;
}

/** Defers fn until after any in-flight field blur has settled. */
export function runAfterFieldBlur(fn) {
  setTimeout(fn, 0);
}
