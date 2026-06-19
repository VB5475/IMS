import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Tag, Plus, Pencil, Save, AlertCircle } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import Modal from "../../components/ui/Modal";
import MasterFormPanel from "../../components/masters/MasterFormPanel";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID, DEFAULT_LOGIN_ID, DEFAULT_SESSION_ID,
} from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useMainGroupMaster } from "../../hooks/useMainGroupMaster";
import { withSaveContextFields } from "../../utils/savePayload";
import { MGM_CONFIG, MGM_HEADER_FILTERS } from "./constants";
import "./MainGroupMasterPage.css";

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function todayFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

function buildListParams() {
  const today = todayFormatted();
  return {
    ObjType: MGM_CONFIG.LIST_OBJ_TYPE,
    ObjName: MGM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      PrmCompanyID:  DEFAULT_COMPANY_ID,
      prmDivisionID: MGM_CONFIG.LIST_DIVISION_ID,
      prmFromDate:   today,
      prmToDate:     today,
    }]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

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

function buildMGMColumns(onEdit) {
  return [
    { key: "ItemTypeName",       label: "Item Type",       width: "18%", filterable: true, align: "left" },
    { key: "MainGroupCode",      label: "Main Group Code", width: "18%", filterable: true, align: "left" },
    { key: "MainGroupName",      label: "Main Group Name", width: "28%", filterable: true, align: "left" },
    { key: "MainGroupShortName", label: "Short Name",      width: "15%", filterable: true, align: "left" },
    { key: "MainGroupShortCode", label: "Short Code",      width: "13%", filterable: true, align: "left" },
    {
      key: "_actions",
      label: "Edit",
      width: "8%",
      align: "center",
      render: (_value, row) => (
        <button
          type="button"
          className="mgm-list__edit-btn"
          title={`Edit ${row.MainGroupCode ?? ""}`}
          aria-label={`Edit ${row.MainGroupCode ?? ""}`}
          onClick={(e) => { e.stopPropagation(); onEdit(row.IDNumber); }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function MainGroupMasterPage() {
  const { get } = useApi(API_BASE_URL);

  // Dropdown options fetched once on mount — not re-fetched on every modal open
  const {
    headerFetching, headerError, fetchHeaderMeta,
    itemTypeOptions, fixedAssetAccOptions,
    fetchEditRecord, seedOptionsFromMaster,
  } = useMainGroupMaster();

  // ── List state ─────────────────────────────────────────────────────────────
  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [pageSize, setPageSize] = useState(8);

  // ── Modal visibility ───────────────────────────────────────────────────────
  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalMode,    setModalMode]    = useState("add");   // "add" | "edit"
  const [editRecordId, setEditRecordId] = useState(null);

  // ── Form state (lives here — no separate Modal file) ───────────────────────
  const isAddMode = modalMode === "add";
  const [isEditMode,      setIsEditMode]      = useState(true);
  const [filterResetKey,  setFilterResetKey]  = useState(0);
  const [recordLoading,   setRecordLoading]   = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving,        setIsSaving]        = useState(false);
  const [saveError,       setSaveError]       = useState(null);
  const [externalValues,  setExternalValues]  = useState(null);
  const headerValuesRef = useRef(buildEmpty());

  usePageHeader({
    title:    "Main Group Master",
    subtitle: "Browse main groups or create a new one.",
    showBack: true,
    backTo:   "/",
  });

  useEffect(() => { fetchHeaderMeta(); }, [fetchHeaderMeta]);

  // ── List fetch ─────────────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(res?.Table ?? res?.Links ?? []);
    } catch (err) {
      console.error("[MGM] List fetch failed:", err);
      setError("Failed to load Main Group list.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // ── Open modal handlers ────────────────────────────────────────────────────
  const handleAddNew = useCallback(() => {
    setModalMode("add");
    setEditRecordId(null);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((idNumber) => {
    setModalMode("edit");
    setEditRecordId(idNumber);
    setModalOpen(true);
  }, []);

  // ── Reset form state each time modal opens ─────────────────────────────────
  useEffect(() => {
    if (!modalOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    setRecordLoadError(null);
    setExternalValues(null);
    setFilterResetKey((k) => k + 1);
    headerValuesRef.current = buildEmpty();
  }, [modalOpen, isAddMode]);

  // ── Load record when opening in edit mode ──────────────────────────────────
  useEffect(() => {
    if (!modalOpen || isAddMode || !editRecordId) return;
    setRecordLoading(true);
    setRecordLoadError(null);
    fetchEditRecord({
      companyId: DEFAULT_COMPANY_ID,
      yearId:    MGM_CONFIG.CONFIG_YEAR_ID,
      loginId:   DEFAULT_LOGIN_ID,
      sessionId: DEFAULT_SESSION_ID,
      idNumber:  editRecordId,
    })
      .then(({ master, headerValues }) => {
        if (!master || !headerValues) { setRecordLoadError("Record not found."); return; }
        headerValuesRef.current = { ...buildEmpty(), ...headerValues };
        seedOptionsFromMaster?.(master);
        setExternalValues({ ...headerValues });
      })
      .catch((err) => setRecordLoadError(err?.message || "Failed to load record."))
      .finally(() => setRecordLoading(false));
  }, [modalOpen, isAddMode, editRecordId, fetchEditRecord, seedOptionsFromMaster]);

  // ── Wire dropdown options into filter definitions ──────────────────────────
  const syncedFilters = useMemo(() =>
    MGM_HEADER_FILTERS.map((f) => {
      if (f.FilterParameterID === "ItemTypeID")          return { ...f, staticOptions: itemTypeOptions };
      if (f.FilterParameterID === "FixedAssetAccountID") return { ...f, staticOptions: fixedAssetAccOptions };
      return f;
    }),
  [itemTypeOptions, fixedAssetAccOptions]);

  // ── Per-field edit tones ───────────────────────────────────────────────────
  const filterFieldTones = useMemo(() => {
    const tones = {};
    syncedFilters.forEach((f) => {
      let tone = "editable";
      if (!isEditMode)                         tone = "view";
      else if (!isAddMode && f.lockOnEditMode) tone = "frozen";
      tones[f.FilterColName]    = tone;
      if (f.FilterParameterID) tones[f.FilterParameterID] = tone;
    });
    tones["MainGroupShortCode"] = "view"; // always read-only — auto-filled
    return tones;
  }, [syncedFilters, isEditMode, isAddMode]);

  // ── Handle field changes ───────────────────────────────────────────────────
  const handleFilterChange = useCallback((colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };
    if (colName === "UsedCodeInCodeGeneration") {
      const sc = val === true ? (headerValuesRef.current.MainGroupCode || "") : "";
      headerValuesRef.current.MainGroupShortCode = sc;
      setExternalValues({ MainGroupShortCode: sc });
    }
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const hv = headerValuesRef.current;
    const missing = [];
    if (!hv.ItemTypeID || hv.ItemTypeID === 0) missing.push("Item Type");
    if (!hv.MainGroupCode?.trim())             missing.push("Main Group Code");
    if (!hv.MainGroupName?.trim())             missing.push("Main Group Name");
    if (!hv.MainGroupShortName?.trim())        missing.push("Main Group Short Name");
    return missing;
  }, []);

  // ── Save ───────────────────────────────────────────────────────────────────
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
      console.log("%c[MGM Save] Payload:", "color:#f59e0b;font-weight:700", payload);
      const res    = await fetch(`${API_BASE_URL_IMS}${MGM_CONFIG.SAVE_ENDPOINT}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert("Main Group saved successfully!");
      setModalOpen(false);
      fetchList();
    } catch (err) {
      console.error("[MGM Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [validate, isAddMode, fetchList]);

  // ── Modal close ────────────────────────────────────────────────────────────
  const handleModalClose = useCallback(() => {
    if (isEditMode && !window.confirm("Discard changes?")) return;
    setModalOpen(false);
  }, [isEditMode]);

  const handleCancelEdit = useCallback(() => {
    if (!window.confirm("Discard changes?")) return;
    if (isAddMode) { setModalOpen(false); return; }
    setIsEditMode(false);
    setFilterResetKey((k) => k + 1);
    setExternalValues({ ...headerValuesRef.current });
    setSaveError(null);
  }, [isAddMode]);

  // ── Modal footer buttons ───────────────────────────────────────────────────
  const modalFooter = useMemo(() => {
    if (!isEditMode) {
      return (
        <button
          type="button"
          className="master-modal-btn master-modal-btn--edit"
          onClick={() => setIsEditMode(true)}
        >
          <Pencil size={13} strokeWidth={2} /> Edit
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

  const columns       = useMemo(() => buildMGMColumns(handleEdit), [handleEdit]);
  const combinedError = headerError || recordLoadError;
  const isLoading     = headerFetching || recordLoading;

  return (
    <div className="workspace-page mgm-list-page">

      {/* ── List panel ── */}
      <section className="mgm-list-panel mgm-list-panel--fill">
        <header className="mgm-list-panel__header">
          <div className="mgm-list-panel__title">
            <Tag size={14} strokeWidth={2} />
            <span>Main Group Master</span>
          </div>
          <div className="mgm-list-panel__toolbar">
            <button type="button" className="mgm-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} /> Add New
            </button>
            <label htmlFor="mgm-list-page-size" className="mgm-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="mgm-list-page-size"
              className="ng-select mgm-list-panel__pagesize-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </header>

        <EnterpriseDataGrid
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading main groups…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No main groups found."
          hideHeader
          fill
        />
      </section>

      {/* ── Add / Edit — Modal UI component used directly ── */}
      <Modal
        isOpen={modalOpen}
        onClose={handleModalClose}
        title={isAddMode ? "New Main Group" : "Edit Main Group"}
        subtitle="Admin › Master › Item › Main Group Master"
        icon={<Tag size={16} strokeWidth={2} />}
        size="md"
        variant="enterprise"
        footer={modalFooter}
      >
        {isLoading ? (
          <div className="master-modal-loader">Loading…</div>
        ) : combinedError ? (
          <div className="master-modal-error">
            <AlertCircle size={14} strokeWidth={2} /> {combinedError}
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
                <AlertCircle size={14} strokeWidth={2} /> {saveError}
              </div>
            )}
          </>
        )}
      </Modal>

    </div>
  );
}
