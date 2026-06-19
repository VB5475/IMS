import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { MapPin, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import MasterFormPanel from "../../components/masters/MasterFormPanel";
import { withSaveContextFields } from "../../utils/savePayload";
import {
  API_BASE_URL_IMS,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../../api/constants";
import { LM_CONFIG, LM_HEADER_FILTERS } from "./constants";

const CASCADE_FIELDS = ["Loc_Code", "Location_Name", "Address1", "City", "State", "Country", "Zipcode"];

function buildEmpty() {
  return {
    IDNumber: 0, LocationType: 0, ParentIDNumber: 0,
    Loc_Code: "", Location_Name: "", Address1: "",
    City: "", State: "", Zipcode: "", Country: "",
    CompanyID: DEFAULT_COMPANY_ID,
    YearID:    LM_CONFIG.CONFIG_YEAR_ID,
    LoginID:   DEFAULT_LOGIN_ID,
    SessionID: DEFAULT_SESSION_ID,
    FuncCode:  LM_CONFIG.RB_MASTER,
  };
}

export default function LocationMasterModal({
  isOpen, mode, recordId, onClose, onSaved,
  headerFetching, headerError,
  locationTypeOptions, premisesOptions,
  fetchEditRecord,
}) {
  const isAddMode = mode === "add";

  const [isEditMode,      setIsEditMode]      = useState(true);
  const [filterResetKey,  setFilterResetKey]  = useState(0);
  const [recordLoading,   setRecordLoading]   = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving,        setIsSaving]        = useState(false);
  const [saveError,       setSaveError]       = useState(null);
  const [externalValues,  setExternalValues]  = useState(null);
  const headerValuesRef = useRef(buildEmpty());

  // Reset all local state each time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    setRecordLoadError(null);
    setExternalValues(null);
    setFilterResetKey((k) => k + 1);
    headerValuesRef.current = buildEmpty();
  }, [isOpen, isAddMode]);

  // Load existing record when opening in edit mode
  useEffect(() => {
    if (!isOpen || isAddMode || !recordId) return;
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
        if (!master || !headerValues) { setRecordLoadError("Record not found."); return; }
        headerValuesRef.current = { ...buildEmpty(), ...headerValues };
        setExternalValues({ ...headerValues });
      })
      .catch((err) => setRecordLoadError(err?.message || "Failed to load record."))
      .finally(() => setRecordLoading(false));
  }, [isOpen, isAddMode, recordId, fetchEditRecord]);

  const syncedFilters = useMemo(() =>
    LM_HEADER_FILTERS.map((f) => {
      if (f.FilterParameterID === "LocationType")   return { ...f, staticOptions: locationTypeOptions };
      if (f.FilterParameterID === "ParentIDNumber") return { ...f, staticOptions: premisesOptions };
      return f;
    }),
  [locationTypeOptions, premisesOptions]);

  const filterFieldTones = useMemo(() => {
    const tones = {};
    syncedFilters.forEach((f) => {
      let tone = "editable";
      if (!isEditMode)                          tone = "view";
      else if (!isAddMode && f.lockOnEditMode)  tone = "frozen";
      tones[f.FilterColName]    = tone;
      if (f.FilterParameterID) tones[f.FilterParameterID] = tone;
    });
    tones["_addressDivider"] = "view";
    return tones;
  }, [syncedFilters, isEditMode, isAddMode]);

  const handleFilterChange = useCallback((colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };
    if (colName === "ParentIDNumber") {
      const cleared = Object.fromEntries(CASCADE_FIELDS.map((f) => [f, ""]));
      headerValuesRef.current = { ...headerValuesRef.current, ...cleared };
      setExternalValues(cleared);
    }
  }, []);

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
        { divisionId: 0, isEdit: !isAddMode }
      );
      console.log("%c[LM Modal Save] Payload:", "color:#f59e0b;font-weight:700", payload);
      const res    = await fetch(`${API_BASE_URL_IMS}${LM_CONFIG.SAVE_ENDPOINT}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert("Location saved successfully!");
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("[LM Modal Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [validate, isAddMode, onSaved, onClose]);

  const handleClose = useCallback(() => {
    if (isEditMode && !window.confirm("Discard changes?")) return;
    onClose();
  }, [isEditMode, onClose]);

  const handleCancelEdit = useCallback(() => {
    if (!window.confirm("Discard changes?")) return;
    if (isAddMode) { onClose(); return; }
    setIsEditMode(false);
    setFilterResetKey((k) => k + 1);
    setExternalValues({ ...headerValuesRef.current });
    setSaveError(null);
  }, [isAddMode, onClose]);

  const footer = useMemo(() => {
    if (!isEditMode) {
      return (
        <button
          type="button"
          className="master-modal-btn master-modal-btn--edit"
          onClick={() => setIsEditMode(true)}
        >
          <Pencil size={13} strokeWidth={2} />
          Edit
        </button>
      );
    }
    return (
      <div className="master-modal-footer-actions">
        <button
          type="button"
          className="master-modal-btn master-modal-btn--cancel"
          onClick={handleCancelEdit}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="master-modal-btn master-modal-btn--save"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Save size={13} strokeWidth={2} />
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    );
  }, [isEditMode, isSaving, handleCancelEdit, handleSave]);

  const combinedError = headerError || recordLoadError;
  const isLoading     = headerFetching || recordLoading;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isAddMode ? "New Location" : "Edit Location"}
      subtitle="Admin › Company › Location Master"
      icon={<MapPin size={16} strokeWidth={2} />}
      size="md"
      variant="enterprise"
      footer={footer}
    >
      {isLoading ? (
        <div className="master-modal-loader">Loading…</div>
      ) : combinedError ? (
        <div className="master-modal-error">
          <AlertCircle size={14} strokeWidth={2} />
          {combinedError}
        </div>
      ) : (
        <>
          <MasterFormPanel
            key={filterResetKey}
            title="Location"
            hideHeader
            staticFilters={syncedFilters}
            initialValues={headerValuesRef.current}
            externalValues={externalValues}
            isMetaLoading={false}
            disabled={false}
            fieldTones={filterFieldTones}
            onFilterChange={isEditMode ? handleFilterChange : undefined}
          />
          {saveError && (
            <div className="master-modal-save-error">
              <AlertCircle size={14} strokeWidth={2} />
              {saveError}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
