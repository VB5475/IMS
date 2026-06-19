import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertCircle, Save } from "lucide-react";
import MasterFormPanel from "../../components/masters/MasterFormPanel";
import ActionBar from "../../components/ui/ActionBar";
import { useLocationMaster } from "../../hooks/useLocationMaster";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  API_BASE_URL_IMS,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { withSaveContextFields } from "../../utils/savePayload";
import { LM_CONFIG, LM_HEADER_FILTERS } from "./constants";
import "./LocationMasterPage.css";

// Fields to clear when Premises (ParentIDNumber) changes — per MRD cascade spec
const CASCADE_FIELDS = ["Loc_Code", "Location_Name", "Address1", "City", "State", "Country", "Zipcode"];

function queryEditableFilterFields(panel) {
  if (!panel) return [];
  return Array.from(
    panel.querySelectorAll(
      "input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), .search-select__trigger:not([disabled])"
    )
  );
}

function buildEmptyHeaderValues(recordId) {
  return {
    IDNumber:       recordId,
    LocationType:   0,
    ParentIDNumber: 0,
    Loc_Code:       "",
    Location_Name:  "",
    Address1:       "",
    City:           "",
    State:          "",
    Zipcode:        "",
    Country:        "",
    CompanyID:      DEFAULT_COMPANY_ID,
    YearID:         LM_CONFIG.CONFIG_YEAR_ID,
    LoginID:        DEFAULT_LOGIN_ID,
    SessionID:      DEFAULT_SESSION_ID,
    FuncCode:       LM_CONFIG.RB_MASTER,
  };
}

export default function LocationMasterForm() {
  const { id: routeId } = useParams();
  const navigate        = useNavigate();
  const isNewRoute      = !routeId || routeId === "new";
  const recordId        = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute     = !isNewRoute && recordId > 0;

  const {
    headerFetching, headerError, fetchHeaderMeta,
    locationTypeOptions, premisesOptions,
    fetchEditRecord,
  } = useLocationMaster();

  usePageHeader({
    title:    isNewRoute ? "New Location" : "Edit Location",
    subtitle: "Admin › Company › Location Master",
    showBack: true,
    backTo:   "/admin/company/location-master",
  });

  // ── Refs ──────────────────────────────────────────────────────────────────
  const filterPanelRef  = useRef(null);
  const addButtonRef    = useRef(null);
  const cancelButtonRef = useRef(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [isEditMode,      setIsEditMode]      = useState(false);
  const [filterResetKey,  setFilterResetKey]  = useState(0);
  const [recordLoading,   setRecordLoading]   = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving,        setIsSaving]        = useState(false);
  const [saveError,       setSaveError]       = useState(null);
  const [externalValues,  setExternalValues]  = useState(null);

  const headerValuesRef = useRef(buildEmptyHeaderValues(recordId));

  // ── Edit mode helpers ─────────────────────────────────────────────────────
  const focusFirstEditableFilterField = useCallback(() => {
    const fields = queryEditableFilterFields(filterPanelRef.current);
    if (fields.length > 0) { fields[0].focus(); return true; }
    return false;
  }, []);

  const enterEditModeWithFocus = useCallback(() => {
    setIsEditMode(true);
    setTimeout(() => focusFirstEditableFilterField(), 50);
  }, [focusFirstEditableFilterField]);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  // ── Mount: load header metadata ──────────────────────────────────────────
  useEffect(() => { fetchHeaderMeta(); }, [fetchHeaderMeta]);

  // ── Edit route: load saved record ────────────────────────────────────────
  useEffect(() => {
    if (!isEditRoute) return;
    setRecordLoading(true);
    setRecordLoadError(null);
    fetchEditRecord({
      companyId: DEFAULT_COMPANY_ID,
      yearId:    LM_CONFIG.CONFIG_YEAR_ID,
      loginId:   DEFAULT_LOGIN_ID,
      sessionId: DEFAULT_SESSION_ID,
      idNumber:  recordId,
    })
      .then(({ master, headerValues }) => {
        if (!master || !headerValues) {
          setRecordLoadError("Record not found.");
          return;
        }
        headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };
        setExternalValues({ ...headerValues });
      })
      .catch((err) => setRecordLoadError(err?.message || "Failed to load record."))
      .finally(() => setRecordLoading(false));
  }, [isEditRoute, recordId, fetchEditRecord]);

  // ── Build syncedFilters — inject dropdown options ─────────────────────────
  const syncedFilters = useMemo(() =>
    LM_HEADER_FILTERS.map((f) => {
      if (f.FilterParameterID === "LocationType")   return { ...f, staticOptions: locationTypeOptions };
      if (f.FilterParameterID === "ParentIDNumber") return { ...f, staticOptions: premisesOptions };
      return f;
    }),
  [locationTypeOptions, premisesOptions]);

  const headerMetaReady = !headerFetching;
  const filterBusy      = headerFetching;

  // ── Per-field tones (view / editable / frozen per MRD LockOnEdit) ─────────
  const filterFieldTones = useMemo(() => {
    const tones = {};
    syncedFilters.forEach((f) => {
      let tone = "editable";
      if (!isEditMode)                          tone = "view";
      else if (isEditRoute && f.lockOnEditMode) tone = "frozen";
      tones[f.FilterColName]    = tone;
      if (f.FilterParameterID) tones[f.FilterParameterID] = tone;
    });
    // Section divider is always view-only regardless of mode
    tones["_addressDivider"] = "view";
    return tones;
  }, [syncedFilters, isEditMode, isEditRoute]);

  // ── Field change + cascade ────────────────────────────────────────────────
  const handleFilterChange = useCallback((colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

    if (colName === "ParentIDNumber") {
      const cleared = Object.fromEntries(CASCADE_FIELDS.map((f) => [f, ""]));
      headerValuesRef.current = { ...headerValuesRef.current, ...cleared };
      setExternalValues(cleared);
    }
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const hv = headerValuesRef.current;
    const missing = [];
    if (!hv.LocationType   || hv.LocationType === 0)   missing.push("Location Type");
    if (!hv.ParentIDNumber || hv.ParentIDNumber === 0) missing.push("Premises");
    if (!hv.Loc_Code?.trim())                          missing.push("Location Code");
    if (!hv.Location_Name?.trim())                     missing.push("Location Name");
    if (!hv.Address1?.trim())                          missing.push("Address");
    if (!hv.City?.trim())                              missing.push("City");
    if (!hv.State?.trim())                             missing.push("State");
    if (!hv.Zipcode?.trim())                           missing.push("Zip");
    if (!hv.Country?.trim())                           missing.push("Country");
    return missing;
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const missing = validate();
    if (missing.length > 0) {
      alert(`Please fill in required fields:\n${missing.join("\n")}`);
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    try {
      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([{ ...headerValuesRef.current }]),
          prmStrDetJSON: JSON.stringify([]),
        },
        { divisionId: 0, isEdit: isEditRoute }
      );
      console.log("%c[LM Save] Payload:", "color:#f59e0b;font-weight:700", payload);

      const res    = await fetch(`${API_BASE_URL_IMS}${LM_CONFIG.SAVE_ENDPOINT}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      console.log("%c[LM Save] Response:", "color:#22c55e;font-weight:700", result);
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert("Location saved successfully!");

      if (isNewRoute) {
        headerValuesRef.current = buildEmptyHeaderValues(0);
        setExternalValues(null);
      }
      setSaveError(null);
      setFilterResetKey((k) => k + 1);
      exitEditMode();
    } catch (err) {
      console.error("[LM Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [validate, isEditRoute, isNewRoute, exitEditMode]);

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (!window.confirm("Discard changes?")) return;
    if (isNewRoute) {
      navigate("/admin/company/location-master");
    } else {
      exitEditMode();
      setFilterResetKey((k) => k + 1);
      setExternalValues({ ...headerValuesRef.current });
      setSaveError(null);
    }
  }, [isNewRoute, navigate, exitEditMode]);

  // ── Keyboard shortcuts (Alt+A / Alt+S / Alt+N / Esc) ─────────────────────
  useEntryFormKeyboard({
    isEditMode,
    isSaving,
    addDisabled: filterBusy,
    onAdd:    enterEditModeWithFocus,
    onSave:   handleSave,
    onCancel: handleCancel,
  });

  // ── ActionBar extra buttons ────────────────────────────────────────────────
  const lmExtraButtons = useMemo(() => [
    {
      key:       "save",
      label:     isSaving ? "Saving…" : "Save",
      Icon:      Save,
      variant:   "save",
      onClick:   handleSave,
      disabled:  isSaving,
      loading:   isSaving,
      accessKey: "s",
      title:     FORM_SHORTCUT_TITLES.save,
    },
  ], [isSaving, handleSave]);

  // ── Render ────────────────────────────────────────────────────────────────
  const combinedError = headerError || recordLoadError;

  if (headerFetching || recordLoading) {
    return (
      <div className="workspace-page">
        <div className="lm-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="workspace-page workspace-page--master">
      <section className="workspace-page__filters master-form-wrapper">
        {combinedError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{combinedError}</span>
          </div>
        ) : (
          <MasterFormPanel
            key={filterResetKey}
            panelRef={filterPanelRef}
            title="Location"
            staticFilters={syncedFilters}
            initialValues={headerValuesRef.current}
            externalValues={externalValues}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterBusy || !headerMetaReady}
            fieldTones={filterFieldTones}
            onFilterChange={isEditMode ? handleFilterChange : undefined}
          />
        )}

        {saveError && (
          <div className="workspace-error" style={{ maxWidth: 680, width: "100%" }}>
            <AlertCircle size={16} strokeWidth={2} />
            <span>{saveError}</span>
          </div>
        )}
      </section>

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        addLabel="Edit"
        addAccessKey="a"
        addButtonRef={addButtonRef}
        onCancel={handleCancel}
        cancelAccessKey="n"
        cancelButtonRef={cancelButtonRef}
        extraButtons={lmExtraButtons}
      />
    </div>
  );
}
