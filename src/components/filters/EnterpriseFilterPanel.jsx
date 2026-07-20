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
import { formatColumnDisplayValue, isColumnMandatory, validateColumnValue } from "../../utils/columnValidation";
import { parseNumberInput } from "../../utils/numberFormat";
import GridNumberInput from "../grid/GridNumberInput";
import RequiredFieldMark from "../ui/RequiredFieldMark";
import { handleDateArrowKeys } from "../../utils/dateFormat";
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
}) {
  const { FilterColCtrlType, FilterCaption, FilterColName } = filter;
  const accent = getAccentClass(filter);
  const isView = tone === "view";
  const isFrozen = tone === "frozen";
  const readOnly = isView || isFrozen;
  const isLoading = disabled;
  const blockInteraction = isLoading || readOnly;
  const isDashboard = layout === "dashboard";

  const handleChange = (e) => onChange(FilterColName, e.target.value);

  const handleBlurValidate = (nextValue) => {
    if (readOnly || !filter.columnMeta) return;
    const result = validateColumnValue(nextValue, filter.columnMeta);
    if (!result.valid) alert(result.message);
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
              className="efq-cell__input"
              value={value}
              columnMeta={filter.columnMeta}
              onChange={(next) => onChange(FilterColName, next)}
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
            className="efq-cell__input"
            value={value || ""}
            onChange={handleChange}
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
          // Chromium allows 5–6 digit years when max is unset; always bound to 4-digit years.
          const dateMin = filter.dateMin || "0001-01-01";
          const dateMax = filter.dateMax || "9999-12-31";
          return (
            <input
              id={`efq-${FilterColName}`}
              type="date"
              className="efq-cell__input efq-cell__input--date"
              value={value || ""}
              onChange={(e) => {
                const yearPart = String(e.target.value || "").split("-")[0] || "";
                if (yearPart.length > 4) return;
                handleChange(e);
              }}
              onKeyDown={(e) =>
                handleDateArrowKeys(e, value || "", (next) => onChange(FilterColName, next), {
                  nativeInput: true,
                })
              }
              onBlur={(e) => handleBlurValidate(e.target.value)}
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
              onChange={(e) => onChange(FilterColName, e.target.checked ? 1 : 0)}
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
                onClick={() => onChange(FilterColName, on ? 0 : 1)}
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
            className={`efq-cell__select${readOnly ? ` efq-cell__select--tone-${tone}` : ""}`}
            value={value || ""}
            onChange={(val) => onChange(FilterColName, val)}
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
            className="efq-cell__input efq-cell__input--textarea"
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

  if (isDashboard) {
    return (
      <div
        className={`dfv2-slicer ${accent}${isTextarea ? " dfv2-slicer--full" : ""}${
          tone !== "editable" ? ` dfv2-slicer--tone-${tone}` : ""
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
          {renderInput()}
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
          {renderInput()}
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
          />
        ))}
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
  initialValues = null,
  cascadeResets = null,
  externalValues = null,
  disabled = false,
  fieldTones = null,
  panelRef = null,
  onLastFieldTabForward = null,
  enableKeyboardNav = true,
  apiBaseUrl,
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
  const headerSubtitle = isEntryMode
    ? showEntryMetaLoader
      ? "Loading header fields…"
      : `${filters.length} header field${filters.length !== 1 ? "s" : ""}`
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
        filterList.forEach((f) => {
          if (f.FilterCtrlDefaultValue != null && f.FilterCtrlDefaultValue !== "") {
            seed[f.FilterColName] = String(f.FilterCtrlDefaultValue);
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
    !showDynamicLoader && !showEntryMetaLoader && !errorMsg && (onSearch || onOrderItem);

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
            />
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
