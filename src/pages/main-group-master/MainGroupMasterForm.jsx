import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertCircle, Save } from "lucide-react";
import MasterFormPanel from "../../components/masters/MasterFormPanel";
import ActionBar from "../../components/ui/ActionBar";
import { useMainGroupMaster } from "../../hooks/useMainGroupMaster";
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
import { MGM_CONFIG, MGM_HEADER_FILTERS } from "./constants";
import "./MainGroupMasterPage.css";

// Collect all focusable fields inside the filter panel (same helper as PV/Indent).
function queryEditableFilterFields(panel) {
  if (!panel) return [];
  return Array.from(
    panel.querySelectorAll(
      "input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), .search-select__trigger:not([disabled])"
    )
  );
}

export default function MainGroupMasterForm() {
  const { id: routeId } = useParams();
  const navigate        = useNavigate();
  const isNewRoute      = !routeId || routeId === "new";
  const recordId        = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute     = !isNewRoute && recordId > 0;

  const {
    headerFetching, headerError, fetchHeaderMeta,
    itemTypeOptions, fixedAssetAccOptions,
    fetchEditRecord, seedOptionsFromMaster,
  } = useMainGroupMaster();

  usePageHeader({
    title:    isNewRoute ? "New Main Group" : "Edit Main Group",
    subtitle: "Admin › Master › Item › Main Group Master",
    showBack: true,
    backTo:   "/admin/main-group-master",
  });

  // ── Refs ──────────────────────────────────────────────────────────────────
  const filterPanelRef  = useRef(null);
  const addButtonRef    = useRef(null);
  const cancelButtonRef = useRef(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [isEditMode,      setIsEditMode]      = useState(false);   // always start in view
  const [filterResetKey,  setFilterResetKey]  = useState(0);
  const [recordLoading,   setRecordLoading]   = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving,        setIsSaving]        = useState(false);
  const [saveError,       setSaveError]       = useState(null);
  const [externalValues,  setExternalValues]  = useState(null);

  const headerValuesRef = useRef({
    IDNumber:                 recordId,
    ItemTypeID:               0,
    MainGroupCode:            "",
    MainGroupName:            "",
    MainGroupShortName:       "",
    UsedCodeInCodeGeneration: false,
    MainGroupShortCode:       "",
    FixedAssetAccountID:      0,
    CompanyID:                DEFAULT_COMPANY_ID,
    YearID:                   MGM_CONFIG.CONFIG_YEAR_ID,
    LoginID:                  DEFAULT_LOGIN_ID,
    SessionID:                DEFAULT_SESSION_ID,
    FuncCode:                 MGM_CONFIG.RB_MASTER,
  });

  // ── Edit mode helpers (same pattern as PV / Indent) ──────────────────────
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
      yearId:    MGM_CONFIG.CONFIG_YEAR_ID,
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
        seedOptionsFromMaster(master);
        setExternalValues({ ...headerValues });
      })
      .catch((err) => setRecordLoadError(err?.message || "Failed to load record."))
      .finally(() => setRecordLoading(false));
  }, [isEditRoute, recordId, fetchEditRecord, seedOptionsFromMaster]);

  // ── Build syncedFilters — inject dropdown options ────────────────────────
  const syncedFilters = useMemo(() =>
    MGM_HEADER_FILTERS.map((f) => {
      if (f.FilterParameterID === "ItemTypeID")
        return { ...f, staticOptions: itemTypeOptions };
      if (f.FilterParameterID === "FixedAssetAccountID")
        return { ...f, staticOptions: fixedAssetAccOptions };
      return f;
    }),
  [itemTypeOptions, fixedAssetAccOptions]);

  // ── Derived flags ─────────────────────────────────────────────────────────
  const headerMetaReady = !headerFetching;
  const filterBusy      = headerFetching;

  // ── Per-field tones (view / editable / frozen per MRD LockOnEdit) ────────
  const filterFieldTones = useMemo(() => {
    const tones = {};
    syncedFilters.forEach((f) => {
      let tone = "editable";
      if (!isEditMode)                          tone = "view";
      else if (isEditRoute && f.lockOnEditMode) tone = "frozen";
      tones[f.FilterColName]    = tone;
      if (f.FilterParameterID) tones[f.FilterParameterID] = tone;
    });
    // MainGroupShortCode is always view-only — auto-fill, never user-editable
    tones["MainGroupShortCode"] = "view";
    return tones;
  }, [syncedFilters, isEditMode, isEditRoute]);

  // ── Field change + auto-fill ─────────────────────────────────────────────
  const handleFilterChange = useCallback((colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

    if (colName === "UsedCodeInCodeGeneration") {
      const sc = val === true ? (headerValuesRef.current.MainGroupCode || "") : "";
      headerValuesRef.current.MainGroupShortCode = sc;
      setExternalValues({ MainGroupShortCode: sc });
    }
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const hv = headerValuesRef.current;
    const missing = [];
    if (!hv.ItemTypeID || hv.ItemTypeID === 0) missing.push("Item Type");
    if (!hv.MainGroupCode?.trim())             missing.push("Main Group Code");
    if (!hv.MainGroupName?.trim())             missing.push("Main Group Name");
    if (!hv.MainGroupShortName?.trim())        missing.push("Main Group Short Name");
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
      console.log("%c[MGM Save] Payload:", "color:#f59e0b;font-weight:700", payload);

      const res    = await fetch(`${API_BASE_URL_IMS}${MGM_CONFIG.SAVE_ENDPOINT}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      console.log("%c[MGM Save] Response:", "color:#22c55e;font-weight:700", result);
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert("Main Group saved successfully!");

      if (isNewRoute) {
        // Reset to blank — ready for the next new entry
        headerValuesRef.current = {
          IDNumber:                 0,
          ItemTypeID:               0,
          MainGroupCode:            "",
          MainGroupName:            "",
          MainGroupShortName:       "",
          UsedCodeInCodeGeneration: false,
          MainGroupShortCode:       "",
          FixedAssetAccountID:      0,
          CompanyID:                DEFAULT_COMPANY_ID,
          YearID:                   MGM_CONFIG.CONFIG_YEAR_ID,
          LoginID:                  DEFAULT_LOGIN_ID,
          SessionID:                DEFAULT_SESSION_ID,
          FuncCode:                 MGM_CONFIG.RB_MASTER,
        };
        setExternalValues(null);
      }
      // Exit edit mode — form shows saved values (or blank) in view/disabled state.
      // User clicks Edit to start a new/next entry. Same pattern as PV / PO.
      setSaveError(null);
      setFilterResetKey((k) => k + 1);
      exitEditMode();
    } catch (err) {
      console.error("[MGM Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [validate, isEditRoute, isNewRoute, exitEditMode]);

  // ── Cancel ────────────────────────────────────────────────────────────────
  // New route: navigate back to list. Edit route: exit edit mode + reset panel.
  const handleCancel = useCallback(() => {
    if (!window.confirm("Discard changes?")) return;
    if (isNewRoute) {
      navigate("/admin/main-group-master");
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

  // ── ActionBar extra buttons — Save (shown only in edit mode) ────────────
  const mgmExtraButtons = useMemo(() => [
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
        <div className="mgm-loading">Loading…</div>
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
            title="Main Group"
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
        extraButtons={mgmExtraButtons}
      />
    </div>
  );
}
