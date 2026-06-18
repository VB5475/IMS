import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertCircle, Save, X, Edit2 } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import { useMainGroupMaster } from "../../hooks/useMainGroupMaster";
import {
  API_BASE_URL_IMS,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { MGM_CONFIG, MGM_HEADER_FILTERS } from "./constants";
import "./MainGroupMasterPage.css";

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

  const [isEditMode,      setIsEditMode]      = useState(isNewRoute);
  const [recordLoading,   setRecordLoading]   = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving,        setIsSaving]        = useState(false);
  const [saveError,       setSaveError]       = useState(null);

  // externalValues drives auto-fill into the panel without remounting
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
        // Seed the panel with loaded values
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

  // ── Per-field tones (view / editable / frozen per MRD LockOnEdit) ────────
  const filterFieldTones = useMemo(() => {
    const tones = {};
    syncedFilters.forEach((f) => {
      let tone = "editable";
      if (!isEditMode)                          tone = "view";
      else if (isEditRoute && f.lockOnEditMode) tone = "frozen";
      tones[f.FilterColName]     = tone;
      if (f.FilterParameterID)  tones[f.FilterParameterID] = tone;
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
      const payload = {
        prmStrMstJSON: JSON.stringify([{ ...headerValuesRef.current }]),
        prmStrDetJSON: JSON.stringify([]),
      };
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
      navigate("/admin/main-group-master");
    } catch (err) {
      console.error("[MGM Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [validate, navigate]);

  const handleCancel = useCallback(() => {
    if (!window.confirm("Discard changes?")) return;
    navigate("/admin/main-group-master");
  }, [navigate]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (headerFetching || recordLoading) {
    return <div className="mgm-page"><div className="mgm-loading">Loading…</div></div>;
  }

  if (headerError || recordLoadError) {
    return (
      <div className="mgm-page">
        <div className="mgm-error">
          <AlertCircle size={16} /> {headerError || recordLoadError}
        </div>
      </div>
    );
  }

  return (
    <div className="mgm-page">
      <div className="mgm-form-panel">

        <div className="mgm-panel-header">
          <span className="mgm-panel-title">Main Group Master</span>
          <div className="mgm-panel-toolbar">
            {!isEditMode && isEditRoute && (
              <button type="button" className="mgm-btn mgm-btn--secondary" onClick={() => setIsEditMode(true)}>
                <Edit2 size={13} /> Edit
              </button>
            )}
            {isEditMode && (
              <>
                <button type="button" className="mgm-btn mgm-btn--primary" onClick={handleSave} disabled={isSaving}>
                  <Save size={13} /> {isSaving ? "Saving…" : "Save"}
                </button>
                <button type="button" className="mgm-btn mgm-btn--secondary" onClick={handleCancel} disabled={isSaving}>
                  <X size={13} /> Cancel
                </button>
              </>
            )}
          </div>
        </div>

        <EnterpriseFilterPanel
          title="Main Group"
          staticFilters={syncedFilters}
          initialValues={headerValuesRef.current}
          externalValues={externalValues}
          fieldTones={filterFieldTones}
          onFilterChange={isEditMode ? handleFilterChange : undefined}
          actionLabel=""
        />

        {saveError && (
          <div className="mgm-save-error">
            <AlertCircle size={14} /> {saveError}
          </div>
        )}
      </div>
    </div>
  );
}
