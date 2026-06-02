// EnterpriseFilterPanel — tabular 3-column filter layout
// Dynamic filter controls: GetFilters + GetFilterDetail via the local API layer.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '../../api/useApi';
import { ENDPOINTS, DEFAULT_LOGIN_ID, CBO_MODE } from '../../api/constants';
import { controlTypeMap } from '../../data/dummyData';
import SearchSelect from '../ui/SearchSelect';
import { AlertCircle, Search, Database, RotateCcw, X, Plus, ShoppingCart, FileSpreadsheet } from 'lucide-react';
import './enterprise-filter-query.css';

const COLS = 3;

function getAccentClass(filter) {
  const t = filter.FilterColCtrlType;
  if (t === controlTypeMap.DROPDOWN || t === controlTypeMap.LABEL) {
    return 'efq-cell--fixed';
  }
  return 'efq-cell--editable';
}

/** Build table rows: 3 filters per row; textarea spans full width. */
function buildFilterRows(filters) {
  const rows = [];
  let i = 0;

  while (i < filters.length) {
    const filter = filters[i];

    if (filter.FilterColCtrlType === controlTypeMap.TEXTAREA) {
      rows.push({ type: 'full', items: [filter] });
      i += 1;
      continue;
    }

    const items = [];
    while (items.length < COLS && i < filters.length) {
      if (filters[i].FilterColCtrlType === controlTypeMap.TEXTAREA) break;
      items.push(filters[i]);
      i += 1;
    }
    rows.push({ type: 'row', items });
  }

  return rows;
}

function FilterControl({ filter, value, options, onChange }) {
  const { FilterColCtrlType, FilterCaption, FilterColName } = filter;
  const accent = getAccentClass(filter);

  const handleChange = (e) => onChange(FilterColName, e.target.value);

  const labelEl = (
    <label className="efq-cell__label" htmlFor={`efq-${FilterColName}`} title={FilterCaption}>
      {FilterCaption}
    </label>
  );

  const renderInput = () => {
    switch (FilterColCtrlType) {
      case controlTypeMap.LABEL:
        return <span className="efq-cell__value">{value || '—'}</span>;

      case controlTypeMap.TEXTBOX:
        return (
          <input
            id={`efq-${FilterColName}`}
            type="text"
            className="efq-cell__input"
            value={value || ''}
            onChange={handleChange}
            placeholder={`Enter ${FilterCaption}…`}
            autoComplete="off"
          />
        );

      case controlTypeMap.DATE:
        return (
          <input
            id={`efq-${FilterColName}`}
            type="date"
            className="efq-cell__input efq-cell__input--date"
            value={value || ''}
            onChange={handleChange}
          />
        );

      case controlTypeMap.DROPDOWN:
        return (
          <SearchSelect
            id={`efq-${FilterColName}`}
            className="efq-cell__select"
            value={value || ''}
            onChange={(val) => onChange(FilterColName, val)}
            options={(options || []).map((opt) => {
              if (opt.value !== undefined) {
                return { value: String(opt.value), label: opt.label };
              }
              const valKey = opt.FilterCtrlValueCol || 'IDNumber';
              const labelKey = opt.FilterCtrlDisplayCol || 'Name';
              return { value: String(opt[valKey]), label: opt[labelKey] };
            })}
            placeholder={`Select…`}
            ariaLabel={FilterCaption}
          />
        );

      case controlTypeMap.TEXTAREA:
        return (
          <textarea
            id={`efq-${FilterColName}`}
            className="efq-cell__input efq-cell__input--textarea"
            value={value || ''}
            onChange={handleChange}
            placeholder={`Enter ${FilterCaption}…`}
            rows={2}
          />
        );

      default:
        return <span className="efq-cell__value">{value || '—'}</span>;
    }
  };

  const isTextarea = FilterColCtrlType === controlTypeMap.TEXTAREA;

  return (
    <td
      className={`efq-table__cell ${accent}${isTextarea ? ' efq-table__cell--full' : ''}`}
      colSpan={isTextarea ? COLS : 1}
    >
      <div className={`efq-cell${isTextarea ? ' efq-cell--stacked' : ''}`}>
        {FilterColCtrlType === controlTypeMap.LABEL ? (
          <span className="efq-cell__label">{FilterCaption}</span>
        ) : (
          labelEl
        )}
        <div className="efq-cell__control">{renderInput()}</div>
      </div>
    </td>
  );
}

function FilterTable({ filters, values, dropdownOptions, onChange }) {
  const rows = useMemo(() => buildFilterRows(filters), [filters]);

  return (
    <table className="efq-table">
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={`row-${rowIdx}`} className="efq-table__row">
            {row.type === 'full' ? (
              <FilterControl
                filter={row.items[0]}
                value={values[row.items[0].FilterColName]}
                options={
                  row.items[0].FilterColCtrlType === controlTypeMap.DROPDOWN
                    ? dropdownOptions[row.items[0].FilterParameterID]
                    : undefined
                }
                onChange={onChange}
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
                  />
                ))}
                {row.items.length < COLS
                  && Array.from({ length: COLS - row.items.length }).map((_, i) => (
                    <td key={`pad-${rowIdx}-${i}`} className="efq-table__cell efq-table__cell--empty" aria-hidden="true" />
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
  title = '',
  masterID,
  loginID = DEFAULT_LOGIN_ID,
  funcCode = '',
  divisionID = 0,
  onSearch,
  isSearching = false,
  onFiltersLoaded,
  staticFilters = null,
  actionLabel = 'Search',
  ActionIcon = null,
  onFilterChange = null,
  onOrderItem = null,
  orderItemLabel = 'Order Item',
  OrderItemIcon = null,
}) {
  const { get } = useApi();

  const [filters, setFilters] = useState(staticFilters || []);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [values, setValues] = useState({});
  const [defaults, setDefaults] = useState({});
  const [isLoading, setIsLoading] = useState(staticFilters === null);
  const [errorMsg, setErrorMsg] = useState(null);

  const isEntryMode = staticFilters !== null;
  const ButtonIcon = ActionIcon || (isEntryMode ? Plus : Search);
  const SecondaryIcon = OrderItemIcon || ShoppingCart;
  const runLabel = actionLabel === 'Search' && !isEntryMode ? 'Run Search' : actionLabel;
  const headerLabel = isEntryMode && title ? title : 'Query Builder';
  const headerSubtitle = isEntryMode
    ? `${filters.length} header field${filters.length !== 1 ? 's' : ''}`
    : title;
  const HeaderIcon = isEntryMode ? FileSpreadsheet : Database;

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
  }, [staticFilters, onFiltersLoaded]);

  const fetchFilters = useCallback(async (signal) => {
    if (staticFilters !== null) return;
    if (!masterID) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await get(ENDPOINTS.GET_FILTERS, { prmMasterID: masterID });
      if (signal?.aborted) return;

      const filterList = data?.Links || [];
      setFilters(filterList);
      onFiltersLoaded?.(filterList.length > 0);

      const seed = {};
      filterList.forEach((f) => {
        if (f.FilterCtrlDefaultValue != null && f.FilterCtrlDefaultValue !== '') {
          seed[f.FilterColName] = String(f.FilterCtrlDefaultValue);
        } else if (
          f.FilterCtrlDefaultValue === null
          || (f.FilterCtrlDefaultValue === '' && f.FilterColCtrlType === 4)
        ) {
          seed[f.FilterColName] = 0;
        }
      });
      setValues(seed);
      setDefaults(seed);

      const dropdownFilters = filterList.filter(
        (f) => f.FilterColCtrlType === controlTypeMap.DROPDOWN,
      );

      const optionsMap = {};
      await Promise.all(
        dropdownFilters.map(async (f) => {
          try {
            const detailData = await get(ENDPOINTS.GET_FILTER_DETAIL, {
              prmMasterID: masterID,
              prmFilterParameterName: f.FilterParameterID,
              prmCboMode: CBO_MODE.FILTER,
              prmFuncCode: funcCode,
              prmDivisionID: divisionID,
              prmLoginID: loginID,
            });
            optionsMap[f.FilterParameterID] = detailData?.Links || [];
          } catch {
            optionsMap[f.FilterParameterID] = [];
          }
        }),
      );

      if (signal?.aborted) return;
      setDropdownOptions(optionsMap);
    } catch (err) {
      if (signal?.aborted) return;
      setErrorMsg(err?.message || 'Failed to load filter configuration. Please try again.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [get, masterID, funcCode, divisionID, loginID, staticFilters, onFiltersLoaded]);

  useEffect(() => {
    const controller = new AbortController();
    fetchFilters(controller.signal);
    return () => controller.abort();
  }, [fetchFilters]);

  const handleChange = useCallback((colName, value) => {
    setValues((prev) => ({ ...prev, [colName]: value }));
    onFilterChange?.(colName, value);
  }, [onFilterChange]);

  const handleActionClick = useCallback(() => {
    if (onSearch) onSearch(values, filters);
  }, [onSearch, values, filters]);

  const handleReset = useCallback(() => {
    setValues({ ...defaults });
  }, [defaults]);

  const handleClearAll = useCallback(() => {
    const cleared = {};
    filters.forEach((f) => {
      cleared[f.FilterColName] = '';
    });
    setValues(cleared);
  }, [filters]);

  const activeCriteriaCount = useMemo(
    () => Object.values(values).filter((v) => v != null && v !== '' && String(v) !== '0').length,
    [values],
  );

  const appliedChips = useMemo(() => filters
    .filter((f) => {
      const v = values[f.FilterColName];
      return v != null && v !== '' && String(v) !== '0';
    })
    .map((f) => {
      let display = String(values[f.FilterColName]);
      if (f.FilterColCtrlType === controlTypeMap.DROPDOWN) {
        const opts = dropdownOptions[f.FilterParameterID] || f.staticOptions || [];
        const match = opts.find((o) => {
          const val = o.value ?? o[o.FilterCtrlValueCol || 'IDNumber'];
          return String(val) === String(values[f.FilterColName]);
        });
        if (match) {
          display = match.label || match.Name || match[match.FilterCtrlDisplayCol || 'Name'] || display;
        }
      }
      return { colName: f.FilterColName, caption: f.FilterCaption, display };
    }), [filters, values, dropdownOptions]);

  const handleOrderItemClick = useCallback(() => {
    if (onOrderItem) onOrderItem(values);
  }, [onOrderItem, values]);

  const ActionButton = (
    <button
      type="button"
      className={`efq-btn-run${isEntryMode ? ' efq-btn-run--action' : ''}`}
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

  return (
    <div className="efq-panel">
      <header className="efq-command">
        <div className="efq-command__brand">
          <span className="efq-command__icon" aria-hidden="true">
            <HeaderIcon size={16} strokeWidth={2} />
          </span>
          <div className="efq-command__titles">
            <h2 className="efq-command__label">{headerLabel}</h2>
            {headerSubtitle && (
              <span className="efq-command__subtitle">{headerSubtitle}</span>
            )}
          </div>
        </div>

        {!isLoading && !errorMsg && (onSearch || onOrderItem) && (
          <div className="efq-command__actions">
            {!isEntryMode && filters.length > 0 && (
              <span className="efq-badge">
                <span className="efq-badge__dot" aria-hidden="true" />
                {activeCriteriaCount} criteria
              </span>
            )}
            {!isEntryMode && filters.length > 0 && (
              <button
                type="button"
                className="efq-btn-ghost"
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
                className="efq-btn-ghost efq-btn-order"
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
        )}
      </header>

      {isLoading && (
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

      {!isLoading && errorMsg && (
        <div className="efq-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} />
          <span>{errorMsg}</span>
          <button type="button" className="efq-error__retry" onClick={() => fetchFilters()}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !errorMsg && filters.length > 0 && (
        <>
          <div className="efq-body">
            <FilterTable
              filters={filters}
              values={values}
              dropdownOptions={dropdownOptions}
              onChange={handleChange}
            />
          </div>

          {appliedChips.length > 0 && !isEntryMode && (
            <footer className="efq-applied">
              <span className="efq-applied__label">Applied:</span>
              <div className="efq-applied__chips">
                {appliedChips.map((chip) => (
                  <span key={chip.colName} className="efq-chip">
                    {chip.caption}: {chip.display}
                    <button
                      type="button"
                      className="efq-chip__remove"
                      onClick={() => handleChange(chip.colName, '')}
                      aria-label={`Remove ${chip.caption} filter`}
                    >
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
              <button type="button" className="efq-applied__clear" onClick={handleClearAll}>
                Clear all
              </button>
            </footer>
          )}
        </>
      )}

      {!isLoading && !errorMsg && filters.length === 0 && onSearch && (
        <div className="efq-empty-run">{ActionButton}</div>
      )}
    </div>
  );
}
