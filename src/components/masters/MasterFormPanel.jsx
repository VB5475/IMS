// MasterFormPanel — center-aligned Label | Value row layout for master forms.
// Drop-in replacement for EnterpriseFilterPanel on master-only pages.
// Scoped to .mfp-* namespace — does NOT affect transaction form pages.
// Pass `footer` prop (JSX) to render Save/Cancel actions inside the card.

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FileSpreadsheet } from "lucide-react";
import SearchSelect from "../ui/SearchSelect";
import RequiredFieldMark from "../ui/RequiredFieldMark";
import Loader from "../ui/Loader";
import { controlTypeMap } from "../../data/dummyData";
import "./master-form-panel.css";

// ── Field control: renders the appropriate input based on tone + type ────────

function FieldControl({ filter, value, options, onChange, tone = "editable" }) {
  const { FilterColCtrlType, FilterCaption, FilterColName } = filter;
  const readOnly = tone === "view" || tone === "frozen";

  const emit = (val) => onChange?.(FilterColName, val);

  // ── LABEL ──
  if (FilterColCtrlType === controlTypeMap.LABEL) {
    return <span className="mfp-value-text">{value || "—"}</span>;
  }

  // ── CHECKBOX (controlTypeMap.CHECKBOX = 3) ──
  if (FilterColCtrlType === controlTypeMap.CHECKBOX) {
    if (readOnly) {
      return (
        <span className="mfp-value-text">
          {value ? "Yes" : "No"}
        </span>
      );
    }
    return (
      <label className="mfp-checkbox-wrap">
        <input
          type="checkbox"
          className="mfp-checkbox"
          id={`mfp-${FilterColName}`}
          checked={!!value}
          onChange={(e) => emit(e.target.checked)}
        />
        <span className="mfp-checkbox-label">{value ? "Yes" : "No"}</span>
      </label>
    );
  }

  // ── TEXTBOX ──
  if (FilterColCtrlType === controlTypeMap.TEXTBOX) {
    if (readOnly) {
      return (
        <span className={`mfp-value-text${!value ? " mfp-value-text--empty" : ""}`}>
          {value || "—"}
        </span>
      );
    }
    return (
      <input
        id={`mfp-${FilterColName}`}
        type="text"
        className="mfp-input"
        value={value || ""}
        onChange={(e) => emit(e.target.value)}
        placeholder={`Enter ${FilterCaption}…`}
        autoComplete="off"
      />
    );
  }

  // ── DATE ──
  if (FilterColCtrlType === controlTypeMap.DATE) {
    if (readOnly) {
      return <span className="mfp-value-text">{value || "—"}</span>;
    }
    return (
      <input
        id={`mfp-${FilterColName}`}
        type="date"
        className="mfp-input mfp-input--date"
        value={value || ""}
        onChange={(e) => emit(e.target.value)}
      />
    );
  }

  // ── DROPDOWN ──
  if (FilterColCtrlType === controlTypeMap.DROPDOWN) {
    if (readOnly) {
      const match = (options || []).find((opt) => {
        const v = opt.value ?? opt[opt.FilterCtrlValueCol || "IDNumber"];
        return String(v) === String(value);
      });
      const label = match
        ? (match.label || match.Name || match[match.FilterCtrlDisplayCol || "Name"])
        : null;
      return (
        <span className={`mfp-value-text${!label ? " mfp-value-text--empty" : ""}`}>
          {label || "—"}
        </span>
      );
    }
    return (
      <SearchSelect
        id={`mfp-${FilterColName}`}
        value={value || ""}
        onChange={(val) => emit(val)}
        options={(options || []).map((opt) => {
          if (opt.value !== undefined) return { value: String(opt.value), label: opt.label };
          const valKey  = opt.FilterCtrlValueCol   || "IDNumber";
          const lblKey  = opt.FilterCtrlDisplayCol || "Name";
          return { value: String(opt[valKey]), label: opt[lblKey] };
        })}
        placeholder="Select…"
        ariaLabel={FilterCaption}
      />
    );
  }

  // ── TEXTAREA ──
  if (FilterColCtrlType === controlTypeMap.TEXTAREA) {
    if (readOnly) {
      return <span className="mfp-value-text">{value || "—"}</span>;
    }
    return (
      <textarea
        id={`mfp-${FilterColName}`}
        className="mfp-textarea"
        value={value || ""}
        onChange={(e) => emit(e.target.value)}
        placeholder={`Enter ${FilterCaption}…`}
        rows={2}
      />
    );
  }

  // fallback
  return <span className="mfp-value-text">{value != null ? String(value) : "—"}</span>;
}

// ── MasterFormPanel ──────────────────────────────────────────────────────────

export default function MasterFormPanel({
  title          = "",
  staticFilters  = [],
  initialValues  = null,
  externalValues = null,
  disabled       = false,
  fieldTones     = null,
  onFilterChange = null,
  isMetaLoading  = false,
  panelRef       = null,
  footer         = null,   // optional JSX rendered inside card footer (Save/Cancel)
}) {
  const [values, setValues] = useState(initialValues || {});
  const initialApplied = useRef(false);

  // Apply initialValues once on mount (re-applied when component remounts via key)
  useEffect(() => {
    if (initialValues && !initialApplied.current) {
      setValues(initialValues);
      initialApplied.current = true;
    }
  }, [initialValues]);

  // Sync parent-pushed values (auto-fill, cancel-reset, edit-load)
  useEffect(() => {
    if (!externalValues) return;
    setValues((prev) => ({ ...prev, ...externalValues }));
  }, [externalValues]);

  const handleChange = useCallback((colName, val) => {
    setValues((prev) => ({ ...prev, [colName]: val }));
    onFilterChange?.(colName, val);
  }, [onFilterChange]);

  // Build dropdown option map from staticFilters
  const dropdownOptions = useMemo(() => {
    const map = {};
    staticFilters.forEach((f) => {
      if (f.FilterColCtrlType === controlTypeMap.DROPDOWN && f.staticOptions) {
        map[f.FilterParameterID] = f.staticOptions;
      }
    });
    return map;
  }, [staticFilters]);

  const getTone = useCallback((filter) => {
    if (disabled) return "view";
    if (fieldTones?.[filter.FilterColName])    return fieldTones[filter.FilterColName];
    if (fieldTones?.[filter.FilterParameterID]) return fieldTones[filter.FilterParameterID];
    return "editable";
  }, [fieldTones, disabled]);

  return (
    <div className="mfp-panel" ref={panelRef}>

      {/* ── Header ── */}
      <header className="mfp-header">
        <div className="mfp-header__brand">
          <span className="mfp-header__icon" aria-hidden="true">
            <FileSpreadsheet size={16} strokeWidth={2} />
          </span>
          <div>
            <h2 className="mfp-header__label">{title || "Master Form"}</h2>
            {!isMetaLoading && (
              <span className="mfp-header__subtitle">
                {staticFilters.length} header field{staticFilters.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Meta loading ── */}
      {isMetaLoading && (
        <div className="mfp-meta-loading">
          <Loader text="Loading header fields…" />
        </div>
      )}

      {/* ── Field rows ── */}
      {!isMetaLoading && (
        <div className="mfp-body">
          {staticFilters.map((filter, idx) => {
            const tone      = getTone(filter);
            const value     = values[filter.FilterColName];
            const options   = filter.FilterColCtrlType === controlTypeMap.DROPDOWN
              ? dropdownOptions[filter.FilterParameterID]
              : undefined;
            const isLast    = idx === staticFilters.length - 1;

            return (
              <div
                key={filter.FilterParameterID || filter.FilterColName}
                className={[
                  "mfp-row",
                  !isLast             ? "mfp-row--bordered"     : "",
                  tone !== "editable" ? `mfp-row--tone-${tone}` : "",
                ].filter(Boolean).join(" ")}
              >
                <label
                  className="mfp-row__label"
                  htmlFor={`mfp-${filter.FilterColName}`}
                >
                  {/* inner span groups text + asterisk so they wrap together */}
                  <span className="mfp-row__label-inner">
                    {filter.FilterCaption}
                    {filter.isRequired && <RequiredFieldMark />}
                  </span>
                </label>

                <div className="mfp-row__control">
                  <FieldControl
                    filter={filter}
                    value={value}
                    options={options}
                    onChange={handleChange}
                    tone={tone}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Card footer (Save / Cancel actions) ── */}
      {footer && (
        <div className="mfp-footer">
          {footer}
        </div>
      )}
    </div>
  );
}
