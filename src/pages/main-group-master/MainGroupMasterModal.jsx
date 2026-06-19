import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Tag, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import MasterFormPanel from "../../components/masters/MasterFormPanel";
import { withSaveContextFields } from "../../utils/savePayload";
import {
  API_BASE_URL_IMS,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../../api/constants";
import { MGM_CONFIG, MGM_HEADER_FILTERS } from "./constants";

function buildEmpty() {
  return {
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
}

export default function MainGroupMasterModal({
  isOpen, mode, recordId, onClose, onSaved,
  headerFetching, headerError,
  itemTypeOptions, fixedAssetAccOptions,
  fetchEditRecord, seedOptionsFromMaster,
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
      yearId:    MGM_CONFIG.CONFIG_YEAR_ID,
      loginId:   DEFAULT_LOGIN_ID,
      sessionId: DEFAULT_SESSION_ID,
      idNumber:  recordId,
    })
      .then(({ master, headerValues }) => {
        if (!master || !headerValues) { setRecordLoadError("Record not found."); return; }
        headerValuesRef.current = { ...buildEmpty(), ...headerValues };
        seedOptionsFromMaster?.(master);
        setExternalValues({ ...headerValues });
      })
      .catch((err) => setRecordLoadError(err?.message || "Failed to load record."))
      .finally(() => setRecordLoading(false));
  }, [isOpen, isAddMode, recordId, fetchEditRecord, seedOptionsFromMaster]);

  const syncedFilters = useMemo(() =>
    MGM_HEADER_FILTERS.map((f) => {
      if (f.FilterParameterID === "ItemTypeID")         return { ...f, staticOptions: itemTypeOptions };
      if (f.FilterParameterID === "FixedAssetAccountID") return { ...f, staticOptions: fixedAssetAccOptions };
      return f;
    }),
  [itemTypeOptions, fixedAssetAccOptions]);

  const filterFieldTones = useMemo(() => {
    const tones = {};
    syncedFilters.forEach((f) => {
      let tone = "editable";
      if (!isEditMode)                          tone = "view";
      else if (!isAddMode && f.lockOnEditMode)  tone = "frozen";
      tones[f.FilterColName]    = tone;
      if (f.FilterParameterID) tones[f.FilterParameterID] = tone;
    });
    // MainGroupShortCode is always view-only — auto-filled from UsedCodeInCodeGeneration
    tones["MainGroupShortCode"] = "view";
    return tones;
  }, [syncedFilters, isEditMode, isAddMode]);

  const handleFilterChange = useCallback((colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };
    if (colName === "UsedCodeInCodeGeneration") {
      const sc = val === true ? (headerValuesRef.current.MainGroupCode || "") : "";
      headerValuesRef.current.MainGroupShortCode = sc;
      setExternalValues({ MainGroupShortCode: sc });
    }
  }, []);

  const validate = useCallback(() => {
    const hv = headerValuesRef.current;
    const missing = [];
    if (!hv.ItemTypeID || hv.ItemTypeID === 0) missing.push("Item Type");
    if (!hv.MainGroupCode?.trim())             missing.push("Main Group Code");
    if (!hv.MainGroupName?.trim())             missing.push("Main Group Name");
    if (!hv.MainGroupShortName?.trim())        missing.push("Main Group Short Name");
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
      console.log("%c[MGM Modal Save] Payload:", "color:#f59e0b;font-weight:700", payload);
      const res    = await fetch(`${API_BASE_URL_IMS}${MGM_CONFIG.SAVE_ENDPOINT}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert("Main Group saved successfully!");
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("[MGM Modal Save] Failed:", err);
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
      title={isAddMode ? "New Main Group" : "Edit Main Group"}
      subtitle="Admin › Master › Item › Main Group Master"
      icon={<Tag size={16} strokeWidth={2} />}
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
            title="Main Group"
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
