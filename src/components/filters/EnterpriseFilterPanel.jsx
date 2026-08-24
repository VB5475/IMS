// EnterpriseFilterPanel — tabular 3-column filter layout
// Dynamic filter controls: GetFilters + GetFilterDetail via the local API layer.

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, CBO_MODE } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { controlTypeMap } from "../../data/dummyData";
import { getCheckboxValue, getToggleValue } from "../../utils/masterFormUtils";
import SearchSelect from "../ui/SearchSelect";
import { bindFormKeyboardNav } from "../../utils/formKeyboardNav";
import { selectInputText } from "../../utils/focusUtils";
import { formatColumnDisplayValue, getDateInputConstraints, isColumnMandatory, validateColumnValue } from "../../utils/columnValidation";
import { parseNumberInput } from "../../utils/numberFormat";
import GridNumberInput from "../grid/GridNumberInput";
import RequiredFieldMark from "../ui/RequiredFieldMark";
import DateInput from "../ui/DateInput";
import {
  AlertCircle,
  Search,
  Database,
  RotateCcw,
  X,
  Plus,
  ShoppingCart,
  FileSpreadsheet,
  SlidersHorizontal,
} from "lucide-react";
import Loader from "../ui/Loader";
import RefreshButton from "../ui/RefreshButton";
import "./enterprise-filter-query.css";

const COLS = 3;

function formatFilterDisplayValue(value, filter) {
  const formatted = formatColumnDisplayValue(value, filter.columnMeta ?? filter);
  if (formatted) return formatted;
  return value != null && value !== "" ? String(value) : "";
}

function getAccentClass(filter) {
  const t = filter.FilterColCtrlType;
  if (t === controlTypeMap.DROPDOWN || t === controlTypeMap.LABEL) {
    return "efq-cell--fixed";
  }
  return "efq-cell--editable";
}

/** Build table rows: 3 filters per row; textarea spans full width. */
function buildFilterRows(filters) {
  const rows = [];
  let i = 0;

  while (i < filters.length) {
    const filter = filters[i];

    if (filter.FilterColCtrlType === controlTypeMap.TEXTAREA) {
      rows.push({ type: "full", items: [filter] });
      i += 1;
      continue;
    }

    const items = [];
    while (items.length < COLS && i < filters.length) {
      if (filters[i].FilterColCtrlType === controlTypeMap.TEXTAREA) break;
      items.push(filters[i]);
      i += 1;
    }
    rows.push({ type: "row", items });
  }

  return rows;
}

/** Hover tooltip: caption, plus current value when present (helps truncated fields). */
function buildControlTooltip(caption, displayValue) {
  const label = String(caption || "").trim();
  const display = String(displayValue ?? "").trim();
  if (display && display !== "—" && display !== label) {
    return label ? `${label}: ${display}` : display;
  }
  return label || display || undefined;
}

function resolveDropdownDisplay(options, value) {
  if (value == null || value === "") return "";
  const strVal = String(value);
  const mapped = (options || []).map((opt) => {
    if (opt.value !== undefined) {
      return { value: String(opt.value), label: opt.label };
    }
    const valKey = opt.filterctrlvaluecol || "IDNumber";
    const labelKey = opt.filterctrldisplaycol || "Name";
    return { value: String(opt[valKey]), label: opt[labelKey] };
  });
  const match = mapped.find((opt) => opt.value === strVal);
  return match?.label ?? strVal;
}

function FilterControl({
  filter,
  value,
  options,
  onChange,
  disabled = false,
  tone = "editable",
  layout = "table",
  error = null,
}) {
  const { FilterColCtrlType, FilterCaption, FilterColName } = filter;
  // Blur validation used to route through notify.error() — NotificationContext
  // implements that as a blocking, focus-stealing modal (AlertDialog), meant
  // for real save/API failures, not routine per-field checks. Firing it on
  // every Tab-out (a) interrupted normal keyboard flow — reported as "tab
  // focus is broken" — and (b) since notify's alert is a single shared piece
  // of state, a field's blur validation racing with the next field's own
  // (e.g. Tab immediately lands on another empty mandatory field) could
  // clobber the first message before it was ever seen. Local state instead:
  // scoped to this one field, rendered the same inline way as the parent-
  // supplied `error` prop, no shared state to race. (2026-08-21 /pm)
  const [blurError, setBlurError] = useState(null);
  const lastValidValueRef = useRef(value);
  const accent = getAccentClass(filter);
  const isView = tone === "view";
  const isFrozen = tone === "frozen";
  const readOnly = isView || isFrozen;
  const isLoading = disabled;
  const blockInteraction = isLoading || readOnly;
  const isDashboard = layout === "dashboard";
  const effectiveError = error || blurError;
  const inputErrorClass = effectiveError ? " efq-cell__input--error" : "";
  const selectErrorClass = effectiveError ? " efq-cell__select--error" : "";

  // Clears blurError on any real edit — NOT used for the auto-revert inside
  // handleBlurValidate itself, which must leave the just-set message alone.
  const emitChange = (val) => {
    if (blurError) setBlurError(null);
    onChange(FilterColName, val);
  };

  const handleChange = (e) => emitChange(e.target.value);

  const handleBlurValidate = (nextValue) => {
    if (readOnly || !filter.columnMeta) return;
    const result = validateColumnValue(nextValue, filter.columnMeta);
    if (!result.valid) {
      setBlurError(result.message);
      // Date fields keep the typed value visible so the user can see and
      // correct it. Non-date fields revert to the last valid value too, but
      // ONLY for an actual format/range violation (garbage the user typed) —
      // never for an empty value. validateColumnValue skips every
      // format/range check once the value is empty (see its own early
      // return), so an empty-and-invalid result is always the mandatory
      // check failing, i.e. the user deliberately cleared the field. Forcing
      // the old value back there fights that intent — the field would look
      // like it refuses to be cleared. Leave it empty; the inline message
      // already explains why Save will block.
      const isEmpty = nextValue == null || nextValue === "";
      if (filter.columnMeta?.dataKind !== "date" && !isEmpty) {
        onChange(FilterColName, lastValidValueRef.current ?? "");
      }
      return false;
    }
    setBlurError(null);
    lastValidValueRef.current = nextValue;
    return true;
  };

  const isRequired = isColumnMandatory(filter);

  const displayForTooltip = (() => {
    if (FilterColCtrlType === controlTypeMap.DROPDOWN) {
      return resolveDropdownDisplay(options, value);
    }
    if (FilterColCtrlType === controlTypeMap.CHECKBOX || FilterColCtrlType === controlTypeMap.CHECKBOX_ALT) {
      return getCheckboxValue(value) === 1 ? "Yes" : "No";
    }
    if (FilterColCtrlType === controlTypeMap.TOGGLE) {
      return getToggleValue(value) === 1 ? "Yes" : "No";
    }
    return formatFilterDisplayValue(value, filter);
  })();

  const controlTooltip = buildControlTooltip(FilterCaption, displayForTooltip);
  const labelTooltip = FilterCaption || undefined;

  const labelEl = (
    <label
      className={isDashboard ? "dfv2-slicer__label" : "efq-cell__label"}
      htmlFor={`efq-${FilterColName}`}
      title={labelTooltip}
    >
      <span className="field-caption">
        <span className={isDashboard ? "dfv2-slicer__label-text" : "efq-cell__label-text"}>
          {FilterCaption}
        </span>
        {isRequired && <RequiredFieldMark />}
      </span>
    </label>
  );

  const renderInput = () => {
    switch (FilterColCtrlType) {
      case controlTypeMap.LABEL: {
        const display = formatFilterDisplayValue(value, filter);
        return (
          <span className="efq-cell__value" title={controlTooltip}>
            {display || "—"}
          </span>
        );
      }

      case controlTypeMap.TEXTBOX: {
        if (readOnly) {
          const display = formatFilterDisplayValue(value, filter);
          return (
            <span className="efq-cell__value" title={controlTooltip}>
              {display || "—"}
            </span>
          );
        }
        if (filter.columnMeta?.dataKind === "numeric") {
          return (
            <GridNumberInput
              id={`efq-${FilterColName}`}
              className={`efq-cell__input${inputErrorClass}`}
              value={value}
              columnMeta={filter.columnMeta}
              onChange={(next) => emitChange(next)}
              onBlur={(e) => handleBlurValidate(parseNumberInput(e.target.value))}
              ariaLabel={FilterCaption}
              title={controlTooltip}
              disabled={isLoading}
            />
          );
        }
        return (
          <input
            id={`efq-${FilterColName}`}
            type="text"
            className={`efq-cell__input${inputErrorClass}`}
            value={value || ""}
            onChange={handleChange}
            onFocus={(e) => selectInputText(e.target)}
            onBlur={(e) => handleBlurValidate(e.target.value)}
            placeholder={`Enter ${FilterCaption}…`}
            title={controlTooltip}
            autoComplete="off"
            disabled={isLoading}
            tabIndex={0}
            maxLength={
              filter.columnMeta?.dataKind === "varchar" && filter.columnMeta?.maxLen != null
                ? filter.columnMeta.maxLen
                : undefined
            }
          />
        );
      }

      case controlTypeMap.DATE:
        if (isView || isFrozen) {
          const display = formatFilterDisplayValue(value, filter);
          return (
            <span className="efq-cell__value" title={controlTooltip}>
              {display || "—"}
            </span>
          );
        }
        {
          const dateConstraints = filter.columnMeta
            ? getDateInputConstraints(filter.columnMeta)
            : { min: filter.dateMin ?? null, max: filter.dateMax ?? null };
          const dateMin = dateConstraints.min || filter.dateMin || "0001-01-01";
          const dateMax = dateConstraints.max || filter.dateMax || "9999-12-31";
          const dateInputFormat = filter.columnMeta?.inputFormat ?? "";
          return (
            <DateInput
              id={`efq-${FilterColName}`}
              className={`efq-cell__input efq-cell__input--date${inputErrorClass}`}
              value={value || ""}
              inputFormat={dateInputFormat}
              onChange={(next) => {
                const yearPart = String(next || "").split("-")[0] || "";
                if (yearPart.length > 4) return;
                emitChange(next);
              }}
              onFocus={() => {
                lastValidValueRef.current = value || "";
              }}
              onBlur={() => {
                handleBlurValidate(value || "");
              }}
              min={dateMin}
              max={dateMax}
              title={controlTooltip}
              readOnly={readOnly}
              disabled={isLoading}
              tabIndex={readOnly ? -1 : 0}
            />
          );
        }

      case controlTypeMap.CHECKBOX:
      case controlTypeMap.CHECKBOX_ALT:
        if (readOnly) {
          const checked = getCheckboxValue(value) === 1;
          return (
            <span className="efq-cell__value" title={controlTooltip}>
              {checked ? "Yes" : "No"}
            </span>
          );
        }
        return (
          <div className="efq-cell__checkbox-wrap" title={controlTooltip}>
            <input
              id={`efq-${FilterColName}`}
              type="checkbox"
              className="efq-cell__checkbox"
              checked={getCheckboxValue(value) === 1}
              ref={(el) => {
                if (el) el.indeterminate = !!filter.indeterminate;
              }}
              onChange={(e) => emitChange(e.target.checked ? 1 : 0)}
              disabled={isLoading}
              tabIndex={0}
              aria-label={FilterCaption}
              title={controlTooltip}
            />
          </div>
        );

      case controlTypeMap.TOGGLE:
        if (readOnly) {
          const on = getToggleValue(value) === 1;
          return (
            <span className="efq-cell__value" title={controlTooltip}>
              {on ? "Yes" : "No"}
            </span>
          );
        }
        {
          const on = getToggleValue(value) === 1;
          return (
            <div className="efq-cell__toggle-wrap" title={controlTooltip}>
              <button
                type="button"
                role="switch"
                id={`efq-${FilterColName}`}
                aria-checked={on === 1}
                aria-label={FilterCaption}
                title={controlTooltip}
                className={`efq-cell__toggle${on ? " efq-cell__toggle--on" : ""}`}
                onClick={() => emitChange(on ? 0 : 1)}
                disabled={isLoading}
                tabIndex={0}
              />
              <span className="efq-cell__toggle-label" title={controlTooltip}>
                {on ? "Yes" : "No"}
              </span>
            </div>
          );
        }

      case controlTypeMap.DROPDOWN:
        return (
          <SearchSelect
            id={`efq-${FilterColName}`}
            className={`efq-cell__select${readOnly ? ` efq-cell__select--tone-${tone}` : ""}${selectErrorClass}`}
            value={value || ""}
            onChange={(val) => emitChange(val)}
            options={(options || []).map((opt) => {
              if (opt.value !== undefined) {
                return { value: String(opt.value), label: opt.label };
              }
              const valKey = opt.filterctrlvaluecol || "IDNumber";
              const labelKey = opt.filterctrldisplaycol || "Name";
              return { value: String(opt[valKey]), label: opt[labelKey] };
            })}
            placeholder={`Select…`}
            ariaLabel={FilterCaption}
            title={controlTooltip}
            disabled={blockInteraction}
          />
        );

      case controlTypeMap.TEXTAREA:
        if (readOnly) {
          return (
            <span
              className="efq-cell__value efq-cell__value--textarea"
              title={controlTooltip}
            >
              {value || "—"}
            </span>
          );
        }
        return (
          <textarea
            id={`efq-${FilterColName}`}
            className={`efq-cell__input efq-cell__input--textarea${inputErrorClass}`}
            value={value || ""}
            onChange={handleChange}
            onBlur={(e) => handleBlurValidate(e.target.value)}
            placeholder={`Enter ${FilterCaption}…`}
            title={controlTooltip}
            rows={2}
            disabled={isLoading}
            tabIndex={0}
            maxLength={
              filter.columnMeta?.dataKind === "varchar" && filter.columnMeta?.maxLen != null
                ? filter.columnMeta.maxLen
                : undefined
            }
          />
        );

      default:
        return (
          <span className="efq-cell__value" title={controlTooltip}>
            {value || "—"}
          </span>
        );
    }
  };

  const isTextarea = FilterColCtrlType === controlTypeMap.TEXTAREA;

  // Wrapper renders unconditionally (not swapped in only when effectiveError
  // is truthy) — the moment a keystroke clears blurError mid-typing, error
  // flipping false would otherwise change the input's DOM parent from this
  // div to .efq-cell__control directly, and React remounts (not just
  // re-renders) an element whose ancestor structure changed, dropping focus
  // the instant the user starts fixing the field. Only the message node
  // itself is conditional now; the input's ancestor chain never moves.
  const controlContent = (
    <div className="efq-field-stack">
      {renderInput()}
      {effectiveError && <div className="efq-field-error">{effectiveError}</div>}
    </div>
  );

  if (isDashboard) {
    return (
      <div
        className={`dfv2-slicer ${accent}${isTextarea ? " dfv2-slicer--full" : ""}${tone !== "editable" ? ` dfv2-slicer--tone-${tone}` : ""
          }`}
        title={controlTooltip}
      >
        {FilterColCtrlType === controlTypeMap.LABEL ? (
          <span className="dfv2-slicer__label" title={labelTooltip}>
            <span className="field-caption">
              <span className="dfv2-slicer__label-text">{FilterCaption}</span>
              {isRequired && <RequiredFieldMark />}
            </span>
          </span>
        ) : (
          labelEl
        )}
        <div className="dfv2-slicer__control" title={controlTooltip}>
          {controlContent}
        </div>
      </div>
    );
  }

  return (
    <td
      className={`efq-table__cell ${accent}${isTextarea ? " efq-table__cell--full" : ""}${tone !== "editable" ? ` efq-table__cell--tone-${tone}` : ""}`}
      colSpan={isTextarea ? COLS : 1}
      title={controlTooltip}
    >
      <div
        className={`efq-cell${isTextarea ? " efq-cell--stacked" : ""}${tone !== "editable" ? ` efq-cell--tone-${tone}` : ""}`}
      >
        {FilterColCtrlType === controlTypeMap.LABEL ? (
          <span className="efq-cell__label" title={labelTooltip}>
            <span className="field-caption">
              <span className="efq-cell__label-text">{FilterCaption}</span>
              {isRequired && <RequiredFieldMark />}
            </span>
          </span>
        ) : (
          labelEl
        )}
        <div className="efq-cell__control" title={controlTooltip}>
          {controlContent}
        </div>
      </div>
    </td>
  );
}

function FilterTable({
  filters,
  values,
  dropdownOptions,
  onChange,
  disabled = false,
  fieldTones = null,
  layout = "table",
  fieldErrors = null,
  // Extra content (e.g. Workflow Dashboard's status buttons, 2026-08-17
  // /pm) rendered as additional flex items in the SAME row as the filter
  // controls — dashboard layout only; .dfv2-slicers already flex-wraps, so
  // this just joins that same row instead of needing its own section below.
  children = null,
}) {
  const rows = useMemo(() => buildFilterRows(filters), [filters]);

  const getFieldTone = useCallback(
    (filter) => {
      const requestedTone =
        fieldTones?.[filter.FilterColName] ??
        fieldTones?.[filter.FilterParameterID] ??
        "editable";
      if (requestedTone === "editable" && filter.isEditAllow === false) return "view";
      return requestedTone;
    },
    [fieldTones]
  );

  if (layout === "dashboard") {
    return (
      <div className="dfv2-slicers">
        {filters.map((filter) => (
          <FilterControl
            key={filter.FilterParameterID}
            filter={filter}
            value={values[filter.FilterColName]}
            options={
              filter.FilterColCtrlType === controlTypeMap.DROPDOWN
                ? dropdownOptions[filter.FilterParameterID]
                : undefined
            }
            onChange={onChange}
            disabled={disabled}
            tone={getFieldTone(filter)}
            layout="dashboard"
            error={fieldErrors?.[filter.FilterColName]}
          />
        ))}
        {children}
      </div>
    );
  }

  return (
    <table className="efq-table">
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={`row-${rowIdx}`} className="efq-table__row">
            {row.type === "full" ? (
              <FilterControl
                filter={row.items[0]}
                value={values[row.items[0].FilterColName]}
                options={
                  row.items[0].FilterColCtrlType === controlTypeMap.DROPDOWN
                    ? dropdownOptions[row.items[0].FilterParameterID]
                    : undefined
                }
                onChange={onChange}
                disabled={disabled}
                tone={getFieldTone(row.items[0])}
                error={fieldErrors?.[row.items[0].FilterColName]}
              />
            ) : (
              <>
                {row.items.map((filter) => (
                  <FilterControl
                    key={filter.FilterParameterID}
                    filter={filter}
                    value={values[filter.FilterColName]}
                    options={
                      filter.FilterColCtrlType === controlTypeMap.DROPDOWN
                        ? dropdownOptions[filter.FilterParameterID]
                        : undefined
                    }
                    onChange={onChange}
                    disabled={disabled}
                    tone={getFieldTone(filter)}
                    error={fieldErrors?.[filter.FilterColName]}
                  />
                ))}
                {row.items.length < COLS &&
                  Array.from({ length: COLS - row.items.length }).map((_, i) => (
                    <td
                      key={`pad-${rowIdx}-${i}`}
                      className="efq-table__cell efq-table__cell--empty"
                      aria-hidden="true"
                    />
                  ))}
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function EnterpriseFilterPanel({
  title = "",
  layout = "table",
  masterID,
  loginID = getUserSession().loginId,
  funcCode = "",
  divisionID = 0,
  onSearch,
  isSearching = false,
  isMetaLoading = false,
  metaLoadingText = "Loading header fields…",
  onFiltersLoaded,
  staticFilters = null,
  actionLabel = "Search",
  ActionIcon = null,
  onFilterChange = null,
  onOrderItem = null,
  orderItemLabel = "Order Item",
  OrderItemIcon = null,
  // "Refresh" button, beside Search (2026-08-14 /pm) — opt-in, same shared
  // RefreshButton component list pages already use. Distinct from onSearch:
  // the caller decides what "refresh" means (e.g. Workflow Dashboard calls a
  // separate refresh endpoint first, then re-runs its own onSearch).
  onRefresh = null,
  refreshLabel = "Refresh",
  isRefreshing = false,
  initialValues = null,
  cascadeResets = null,
  externalValues = null,
  disabled = false,
  fieldTones = null,
  fieldErrors = null,
  panelRef = null,
  onLastFieldTabForward = null,
  enableKeyboardNav = true,
  apiBaseUrl,
  children = null,
}) {
  const { get } = useApi(apiBaseUrl);

  const [filters, setFilters] = useState(staticFilters || []);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [values, setValues] = useState({});
  const [defaults, setDefaults] = useState({});
  const [isLoading, setIsLoading] = useState(staticFilters === null);
  const [errorMsg, setErrorMsg] = useState(null);
  const initialValuesAppliedRef = useRef(false);

  const isEntryMode = staticFilters !== null;
  const isDashboardLayout = layout === "dashboard";
  const ButtonIcon = ActionIcon || (isEntryMode ? Plus : Search);
  const SecondaryIcon = OrderItemIcon || ShoppingCart;
  const runLabel = actionLabel === "Search" && !isEntryMode ? "Run Search" : actionLabel;
  const headerLabel = isDashboardLayout && title
    ? title
    : isEntryMode && title
      ? title
      : "Query Builder";
  const HeaderIcon = isEntryMode ? FileSpreadsheet : Database;
  const showEntryMetaLoader = isEntryMode && isMetaLoading;
  const showDynamicLoader = !isEntryMode && isLoading;
  // Entry-mode subtitle used to show a "N header fields" count under the
  // title — removed app-wide per user request (2026-08-03); only the
  // loading state (not a count) still shows here.
  const headerSubtitle = isEntryMode
    ? showEntryMetaLoader
      ? "Loading header fields…"
      : null
    : title;

  useEffect(() => {
    if (staticFilters === null) return;
    setFilters(staticFilters);
    onFiltersLoaded?.(staticFilters.length > 0);
    const optMap = {};
    staticFilters.forEach((f) => {
      if (f.FilterColCtrlType === controlTypeMap.DROPDOWN && f.staticOptions) {
        optMap[f.FilterParameterID] = f.staticOptions;
      }
    });
    setDropdownOptions(optMap);
    if (initialValues && !initialValuesAppliedRef.current) {
      setValues(initialValues);
      setDefaults(initialValues);
      initialValuesAppliedRef.current = true;
    }
  }, [staticFilters, onFiltersLoaded, initialValues]);

  const fetchFilters = useCallback(
    async (signal) => {
      if (staticFilters !== null) return;
      if (!masterID) return;

      setIsLoading(true);
      setErrorMsg(null);
      try {
        const data = await get(ENDPOINTS.GET_FILTERS, { prmMasterID: masterID });
        if (signal?.aborted) return;

        const filterList = data || [];
        setFilters(filterList);
        onFiltersLoaded?.(filterList.length > 0);

        const seed = {};
        // Dropdown fields seeded from an RB-configured FilterCtrlDefaultValue —
        // tracked separately so the default can be revoked below once we know
        // how many options that dropdown actually resolves to.
        const dropdownDefaultSeeded = new Set();
        filterList.forEach((f) => {
          if (f.FilterCtrlDefaultValue != null && f.FilterCtrlDefaultValue !== "") {
            seed[f.FilterColName] = String(f.FilterCtrlDefaultValue);
            if (f.FilterColCtrlType === controlTypeMap.DROPDOWN) {
              dropdownDefaultSeeded.add(f.FilterColName);
            }
          } else if (
            f.FilterCtrlDefaultValue === null ||
            (f.FilterCtrlDefaultValue === "" && f.FilterColCtrlType === controlTypeMap.DROPDOWN)
          ) {
            seed[f.FilterColName] = 0;
          }
        });
        setValues(seed);
        setDefaults(seed);

        const dropdownFilters = filterList.filter(
          (f) => f.FilterColCtrlType === controlTypeMap.DROPDOWN
        );

        const optionsMap = {};
        await Promise.all(
          dropdownFilters.map(async (f) => {
            try {
              const detailData = await get(ENDPOINTS.GET_FILTER_DETAIL, {
                prmmasterid: masterID,
                prmfilterparametername: f.FilterParameterID,
                prmcbomode: CBO_MODE.FILTER,
                prmfunccode: funcCode,
                prmdivisionid: divisionID,
                prmloginid: loginID,
              });
              optionsMap[f.FilterParameterID] = detailData || [];
            } catch {
              optionsMap[f.FilterParameterID] = [];
            }
          })
        );

        if (signal?.aborted) return;
        setDropdownOptions(optionsMap);

        // A dropdown may only keep an auto-applied default when it resolves to
        // exactly one option — with 2+ options the user must choose explicitly
        // (client requirement 2026-07-24), even though RB configured a default.
        if (dropdownDefaultSeeded.size > 0) {
          const revoke = {};
          dropdownFilters.forEach((f) => {
            if (!dropdownDefaultSeeded.has(f.FilterColName)) return;
            const optCount = (optionsMap[f.FilterParameterID] || []).length;
            if (optCount !== 1) revoke[f.FilterColName] = "";
          });
          if (Object.keys(revoke).length > 0) {
            setValues((prev) => ({ ...prev, ...revoke }));
            setDefaults((prev) => ({ ...prev, ...revoke }));
          }
        }
      } catch (err) {
        if (signal?.aborted) return;
        setErrorMsg(err?.message || "Failed to load filter configuration. Please try again.");
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [get, masterID, funcCode, divisionID, loginID, staticFilters, onFiltersLoaded]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchFilters(controller.signal);
    return () => controller.abort();
  }, [fetchFilters]);

  useEffect(() => {
    if (!onLastFieldTabForward || !panelRef?.current) return undefined;

    const panel = panelRef.current;
    const selector = [
      "input:not([disabled]):not([readonly])",
      "textarea:not([disabled]):not([readonly])",
      "button[role='switch']:not([disabled])",
      ".search-select__trigger:not([disabled])",
    ].join(", ");

    const bindLastFieldTab = () => {
      const fields = [...panel.querySelectorAll(selector)].filter((el) => el.offsetParent !== null);
      const last = fields[fields.length - 1];
      if (!last) return undefined;

      const onKeyDown = (e) => {
        if (e.key === "Tab" && !e.shiftKey) {
          e.preventDefault();
          onLastFieldTabForward();
        }
      };

      last.addEventListener("keydown", onKeyDown);
      return () => last.removeEventListener("keydown", onKeyDown);
    };

    const cleanup = bindLastFieldTab();
    return cleanup;
  }, [panelRef, onLastFieldTabForward, filters, disabled, fieldTones]);

  useEffect(() => {
    const root = panelRef?.current;
    if (!root || disabled || !enableKeyboardNav) return undefined;
    return bindFormKeyboardNav(root, { enabled: true });
  }, [panelRef, disabled, enableKeyboardNav, filters, fieldTones]);

  // Focus-loss recovery (PM 2026-07-24 — "tab focus loses, sometimes"): many
  // pages wire an async cascade-loading flag (e.g. "fetching a dependent
  // dropdown's options") straight into this panel's shared `disabled` prop.
  // When that flips true, every field disables at once — including whichever
  // one the user is currently on — and the browser force-blurs a field that
  // becomes disabled while focused, with no successor focus target. That's a
  // real, timing-dependent (hence "sometimes") loss of keyboard position.
  // Track the last field focused while enabled; once `disabled` clears again,
  // restore focus to it, but ONLY if focus is still sitting on <body> (i.e.
  // truly lost) — never overrides a deliberate cascade-focus call (e.g.
  // focusFieldAfterCascade) that already moved focus somewhere on purpose.
  const lastFocusedIdRef = useRef(null);
  useEffect(() => {
    const root = panelRef?.current;
    if (!root) return undefined;
    const onFocusIn = (e) => {
      const el = e.target?.closest?.('[id^="efq-"]');
      if (el) lastFocusedIdRef.current = el.id;
    };
    root.addEventListener("focusin", onFocusIn);
    return () => root.removeEventListener("focusin", onFocusIn);
  }, [panelRef]);

  const prevDisabledRef = useRef(disabled);
  useEffect(() => {
    const wasDisabled = prevDisabledRef.current;
    prevDisabledRef.current = disabled;
    if (!wasDisabled || disabled) return;

    const targetId = lastFocusedIdRef.current;
    const root = panelRef?.current;
    if (!targetId || !root) return;

    requestAnimationFrame(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      const target =
        root.querySelector(`#${targetId} .search-select__trigger`) || root.querySelector(`#${targetId}`);
      target?.focus?.();
    });
  }, [disabled, panelRef]);

  useEffect(() => {
    if (!externalValues) return;
    setValues((prev) => ({ ...prev, ...externalValues }));
  }, [externalValues]);

  const handleChange = useCallback(
    (colName, value) => {
      setValues((prev) => {
        const next = { ...prev, [colName]: value };
        const resetFields = cascadeResets?.[colName];
        if (resetFields) {
          resetFields.forEach((field) => {
            next[field] = "";
          });
        }
        return next;
      });

      const applyPatch = (patch) => {
        if (patch && typeof patch === "object" && !(patch instanceof Promise)) {
          setValues((prev) => ({ ...prev, ...patch }));
        }
      };

      applyPatch(onFilterChange?.(colName, value));
      cascadeResets?.[colName]?.forEach((field) => {
        applyPatch(onFilterChange?.(field, ""));
      });
    },
    [onFilterChange, cascadeResets]
  );

  const handleActionClick = useCallback(() => {
    if (onSearch) onSearch(values, filters);
  }, [onSearch, values, filters]);

  const handleRefreshClick = useCallback(() => {
    if (onRefresh) onRefresh(values, filters);
  }, [onRefresh, values, filters]);

  const handleReset = useCallback(() => {
    setValues({ ...defaults });
  }, [defaults]);

  const handleClearAll = useCallback(() => {
    const cleared = {};
    filters.forEach((f) => {
      cleared[f.FilterColName] = "";
    });
    setValues(cleared);
  }, [filters]);

  const activeCriteriaCount = useMemo(
    () => Object.values(values).filter((v) => v != null && v !== "" && String(v) !== "0").length,
    [values]
  );

  const appliedChips = useMemo(
    () =>
      filters
        .filter((f) => {
          const v = values[f.FilterColName];
          return v != null && v !== "" && String(v) !== "0";
        })
        .map((f) => {
          let display = String(values[f.FilterColName]);
          if (
            f.FilterColCtrlType === controlTypeMap.CHECKBOX
            || f.FilterColCtrlType === controlTypeMap.CHECKBOX_ALT
          ) {
            display = getCheckboxValue(values[f.FilterColName]) === 1 ? "Yes" : "No";
          } else if (f.FilterColCtrlType === controlTypeMap.TOGGLE) {
            display = getToggleValue(values[f.FilterColName]) === 1 ? "Yes" : "No";
          } else if (f.FilterColCtrlType === controlTypeMap.DROPDOWN) {
            const opts = dropdownOptions[f.FilterParameterID] || f.staticOptions || [];
            const match = opts.find((o) => {
              const val = o.value ?? o[o.filterctrlvaluecol || "IDNumber"];
              return String(val) === String(values[f.FilterColName]);
            });
            if (match) {
              display =
                match.label || match.Name || match[match.filterctrldisplaycol || "Name"] || display;
            }
          } else if (
            f.FilterColCtrlType === controlTypeMap.DATE
            || f.FilterColCtrlType === controlTypeMap.LABEL
            || f.FilterColCtrlType === controlTypeMap.TEXTBOX
          ) {
            const formatted = formatFilterDisplayValue(values[f.FilterColName], f);
            if (formatted) display = formatted;
          }
          return { colName: f.FilterColName, caption: f.FilterCaption, display };
        }),
    [filters, values, dropdownOptions]
  );

  const handleOrderItemClick = useCallback(() => {
    if (onOrderItem) onOrderItem(values);
  }, [onOrderItem, values]);

  const ActionButton = (
    <button
      type="button"
      className={`efq-btn-run${isEntryMode ? " efq-btn-run--action" : ""}`}
      onClick={handleActionClick}
      disabled={isSearching}
      title={runLabel}
      aria-label={runLabel}
    >
      {isSearching ? (
        <>
          <span className="efq-btn-run__spinner" aria-hidden="true" />
          <span>{runLabel}…</span>
        </>
      ) : (
        <>
          <ButtonIcon size={15} strokeWidth={2.5} />
          <span>{runLabel}</span>
        </>
      )}
    </button>
  );

  const showToolbarActions =
    !showDynamicLoader && !showEntryMetaLoader && !errorMsg && (onSearch || onOrderItem || onRefresh);

  const ToolbarActions = showToolbarActions && (
    <div className={isDashboardLayout ? "dfv2-filter-bar__actions" : "efq-command__actions"}>
      {!isEntryMode && filters.length > 0 && !isDashboardLayout && (
        <span className="efq-badge">
          <span className="efq-badge__dot" aria-hidden="true" />
          {activeCriteriaCount} criteria
        </span>
      )}
      {!isEntryMode && filters.length > 0 && (
        <button
          type="button"
          className={isDashboardLayout ? "dfv2-btn-reset" : "efq-btn-ghost"}
          onClick={handleReset}
          disabled={isSearching}
          title="Reset to defaults"
        >
          <RotateCcw size={14} strokeWidth={2} />
          Reset
        </button>
      )}
      {onOrderItem && (
        <button
          type="button"
          className={`${isDashboardLayout ? "dfv2-btn-reset" : "efq-btn-ghost"} efq-btn-order`}
          onClick={handleOrderItemClick}
          disabled={isSearching}
          title={orderItemLabel}
          aria-label={orderItemLabel}
        >
          <SecondaryIcon size={14} strokeWidth={2.5} />
          {orderItemLabel}
        </button>
      )}
      {onRefresh && (
        <RefreshButton
          onClick={handleRefreshClick}
          loading={isRefreshing}
          label={refreshLabel}
          disabled={isSearching}
        />
      )}
      {onSearch && ActionButton}
    </div>
  );

  return (
    <div
      className={`efq-panel${isDashboardLayout ? " efq-panel--dashboard" : ""}`}
      ref={panelRef}
    >
      {isDashboardLayout && !showDynamicLoader && !showEntryMetaLoader && !errorMsg && filters.length > 0 && (
        <div className="dfv2-filter-bar__header">
          <div className="dfv2-filter-bar__title">
            <span className="dfv2-filter-bar__icon" aria-hidden="true">
              <SlidersHorizontal size={15} strokeWidth={2.2} />
            </span>
            <h2 className="dfv2-filter-bar__heading">{headerLabel}</h2>
          </div>
          {ToolbarActions}
        </div>
      )}

      {!isDashboardLayout && (
        <header className="efq-command">
          <div className="efq-command__brand">
            <span className="efq-command__icon" aria-hidden="true">
              <HeaderIcon size={16} strokeWidth={2} />
            </span>
            <div className="efq-command__titles">
              <h2 className="efq-command__label">{headerLabel}</h2>
              {headerSubtitle && <span className="efq-command__subtitle">{headerSubtitle}</span>}
            </div>
          </div>

          {ToolbarActions}
        </header>
      )}

      {showDynamicLoader && (
        <div className="efq-loading" role="status" aria-label="Loading filters">
          <table className="efq-table">
            <tbody>
              <tr className="efq-table__row">
                {[1, 2, 3].map((n) => (
                  <td key={n} className="efq-table__cell">
                    <div className="efq-skeleton-cell">
                      <div className="efq-skeleton efq-skeleton--label" />
                      <div className="efq-skeleton" />
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="efq-table__row">
                {[1, 2, 3].map((n) => (
                  <td key={n} className="efq-table__cell">
                    <div className="efq-skeleton-cell">
                      <div className="efq-skeleton efq-skeleton--label" />
                      <div className="efq-skeleton" />
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {showEntryMetaLoader && (
        <div className="efq-body efq-body--meta-loading" role="status" aria-label={metaLoadingText}>
          <Loader text={metaLoadingText} />
        </div>
      )}

      {!showDynamicLoader && !showEntryMetaLoader && errorMsg && (
        <div className="efq-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} />
          <span>{errorMsg}</span>
          <button type="button" className="efq-error__retry" onClick={() => fetchFilters()}>
            Retry
          </button>
        </div>
      )}

      {!showDynamicLoader && !showEntryMetaLoader && !errorMsg && filters.length > 0 && (
        <>
          <div className={`efq-body${isDashboardLayout ? " efq-body--dashboard" : ""}`}>
            <FilterTable
              filters={filters}
              values={values}
              dropdownOptions={dropdownOptions}
              onChange={handleChange}
              disabled={disabled}
              fieldTones={fieldTones}
              layout={layout}
              fieldErrors={fieldErrors}
            >
              {children}
            </FilterTable>
          </div>

          {appliedChips.length > 0 && !isEntryMode && (
            <footer className={isDashboardLayout ? "dfv2-applied" : "efq-applied"}>
              <span className={isDashboardLayout ? "dfv2-applied__label" : "efq-applied__label"}>
                Active filters
              </span>
              <div className={isDashboardLayout ? "dfv2-applied__chips" : "efq-applied__chips"}>
                {appliedChips.map((chip) => (
                  <span
                    key={chip.colName}
                    className={isDashboardLayout ? "dfv2-chip" : "efq-chip"}
                  >
                    {chip.caption}: {chip.display}
                    <button
                      type="button"
                      className={isDashboardLayout ? "dfv2-chip__remove" : "efq-chip__remove"}
                      onClick={() => handleChange(chip.colName, "")}
                      aria-label={`Remove ${chip.caption} filter`}
                    >
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
              <button
                type="button"
                className={isDashboardLayout ? "dfv2-applied__clear" : "efq-applied__clear"}
                onClick={handleClearAll}
              >
                Clear all
              </button>
            </footer>
          )}
        </>
      )}

      {!showDynamicLoader &&
        !showEntryMetaLoader &&
        !errorMsg &&
        filters.length === 0 &&
        onSearch && <div className="efq-empty-run">{ActionButton}</div>}
    </div>
  );
}
