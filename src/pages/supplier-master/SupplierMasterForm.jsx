// SupplierMasterForm.jsx
// Supplier Master entry form (add / edit).
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — Core header fields (always visible)
//   2. Tab bar — Contacts | Transporter Detail | TDS Deduction | Bank Information | Consignee Detail
//   3. ActionBar — Add / Save / Cancel

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
import { useSupplierMaster } from "../../hooks/useSupplierMaster";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
  DEFAULT_LOGIN_ID,
  getColDefault,
  buildSaveRowFromColumns,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import {
  isLockOnEditModeCol,
  syncHeaderFilterWithApiCol,
  buildHeaderColMap,
  resolveHeaderApiCol,
} from "../../utils/gridUtils";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { usePageHeader } from "../../context/PageHeaderContext";
import {
  SM_CONFIG,
  SM_CORE_FIELDS,
  SM_CONTACTS_FIELDS,
  SM_TRANSPORTER_FIELDS,
  SM_TDS_FIELDS,
  SM_BANK_FIELDS,
  SM_CHECKBOX_OVERRIDE_FIELDS,
  SM_FILTER_CASCADE_RESETS,
  SM_TABS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  controlTypeMap,
} from "./constants";
import "./SupplierMasterPage.css";

let _smTempId = -1;
const nextTempId = () => _smTempId--;

function isTdsChecked(headerValues) {
  const v = headerValues?.tds;
  return v === 1 || v === "1" || v === true;
}

export default function SupplierMasterForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const notify = useNotification();
  const navigate = useNavigate();

  const [formErrors, setFormErrors] = useState([]);
  const filterPanelRef = useRef(null);
  const consigneeGridRef = useRef(null);
  const queuedConsigneeRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);
  const { post } = useApi(API_BASE_URL_IMS);

  const {
    headerColumns, headerFetching, headerError, headerDropdownOptions, fetchHeaderMeta,
    detailColumns, detailAllColumns, detailFetching, detailError, fetchDetailMeta,
    stateOptions, cityOptions, fetchStateOptions, fetchCityOptions, clearStates, clearCities,
    fetchEditRecord,
  } = useSupplierMaster(API_BASE_URL);

  usePageHeader({
    title: isEditRoute ? PAGE_TITLE : PAGE_TITLE_NEW,
    subtitle: "Admin › Master › Supplier",
    showBack: true,
    backTo: "/admin/master/supplier-master",
  });

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const session = getUserSession();

  const buildEmptyHeaderValues = useCallback(() => ({
    supcode: "", supname: "", catrgoryid: 0, accountgroupid: 0, partyname: "",
    address: "", mailingaddress: "", countryid: 0, stateid: 0, cityid: 0,
    zipcode: "", district: "", msmedate: null, msmeno: "", registrationtypeid: 0,
    gstno: "", currencyid: 0, crlimit: "", creditamt: "",
    contactperson: "", designation: "", emailaddress: "", mobileno: "",
    transporterid: 0, transpoterdestinationid: 0,
    tds: 0, deducteetypeid: 0, nopid: 0,
    bankname: "", bankaddress: "", branch: "", beneficiaryname: "",
    bankmobileno: "", accountno: "", accounttype: "", ifsccode: "",
    companyid: DEFAULT_COMPANY_ID,
    yearid: SM_CONFIG.DIVISION_YEAR_ID,
    loginid: session.loginId,
    sessionid: DEFAULT_SESSION_ID,
    idnumber: recordId,
  }), [recordId, session.loginId]);

  const headerValuesRef = useRef(buildEmptyHeaderValues());

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);
  const [isEditMode, setIsEditMode] = useState(!isEditRoute);
  const [activeTab, setActiveTab] = useState("contacts");
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    fetchHeaderMeta();
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta]);

  const loadEditRecord = useCallback(async () => {
    if (editRecordLoadedRef.current) return;
    editRecordLoadedRef.current = true;
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const { master, headerValues, consigneeRows } = await fetchEditRecord({
        companyId: DEFAULT_COMPANY_ID,
        yearId: SM_CONFIG.DIVISION_YEAR_ID,
        loginId: DEFAULT_LOGIN_ID,
        sessionId: DEFAULT_SESSION_ID,
        idNumber: recordId,
      });
      if (!master || !headerValues) {
        setRecordLoadError("Record not found.");
        return;
      }
      headerValuesRef.current = { ...buildEmptyHeaderValues(), ...headerValues };
      setLoadedMasterRow(master);
      if (headerValues.countryid) void fetchStateOptions(headerValues.countryid);
      if (headerValues.stateid) void fetchCityOptions(headerValues.stateid);
      queuedConsigneeRowsRef.current = consigneeRows || [];
      if (consigneeGridRef.current?.loadRows) {
        consigneeGridRef.current.loadRows(queuedConsigneeRowsRef.current);
        queuedConsigneeRowsRef.current = [];
      }
      setFilterResetKey((k) => k + 1);
    } catch (err) {
      console.error("[SM] loadEditRecord failed:", err);
      setRecordLoadError(err?.message || "Failed to load record.");
    } finally {
      setRecordLoading(false);
    }
  }, [fetchEditRecord, recordId, buildEmptyHeaderValues, fetchStateOptions, fetchCityOptions]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || headerColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, headerColumns.length, loadEditRecord]);

  useEffect(() => {
    if (detailColumns.length > 0 && consigneeGridRef.current && queuedConsigneeRowsRef.current.length > 0) {
      consigneeGridRef.current.loadRows?.(queuedConsigneeRowsRef.current);
      queuedConsigneeRowsRef.current = [];
    }
  }, [detailColumns]);

  const filterInitialValues = useMemo(() => ({ trandate: todayISO }), [todayISO]);

  // ── DROPDOWN_OPTIONS_BY_COL — same pattern as Purchase Order: always attach
  // the fully-fetched options list regardless of lock/edit state. State/City
  // come from the cascading fetches; everything else from the generic
  // GET_FILTER_DETAIL mechanism (headerDropdownOptions).
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    ...headerDropdownOptions,
    stateid: stateOptions,
    cityid: cityOptions,
  }), [headerDropdownOptions, stateOptions, cityOptions]);

  const buildFilterDef = useCallback(
    (filter, apiColMap) => {
      const apiCol = resolveHeaderApiCol(filter, apiColMap);
      const lockOnEditMode = apiCol ? isLockOnEditModeCol(apiCol) : false;
      let def = syncHeaderFilterWithApiCol(filter, apiCol, { lockOnEditMode });

      if (apiCol) {
        def.FilterColCtrlType = SM_CHECKBOX_OVERRIDE_FIELDS.has(filter.FilterParameterID)
          ? controlTypeMap.CHECKBOX
          : (apiCol.colctrltype ?? filter.FilterColCtrlType);
      }

      const staticOptions = DROPDOWN_OPTIONS_BY_COL[filter.FilterParameterID];
      if (staticOptions) def.staticOptions = staticOptions;

      return def;
    },
    [DROPDOWN_OPTIONS_BY_COL]
  );

  function buildBlockFilters(fieldSet) {
    if (headerColumns.length === 0) return [];
    const apiColMap = buildHeaderColMap(headerColumns);
    return headerColumns
      .filter((c) => fieldSet.has(c.colname))
      .map((c) => buildFilterDef({ FilterParameterID: c.colname }, apiColMap));
  }

  const syncedCoreFilters = useMemo(
    () => buildBlockFilters(SM_CORE_FIELDS),
    [headerColumns, buildFilterDef]
  );
  const syncedContactsFilters = useMemo(
    () => buildBlockFilters(SM_CONTACTS_FIELDS),
    [headerColumns, buildFilterDef]
  );
  const syncedTransporterFilters = useMemo(
    () => buildBlockFilters(SM_TRANSPORTER_FIELDS),
    [headerColumns, buildFilterDef]
  );
  const syncedTdsFilters = useMemo(
    () => buildBlockFilters(SM_TDS_FIELDS),
    [headerColumns, buildFilterDef]
  );
  const syncedBankFilters = useMemo(
    () => buildBlockFilters(SM_BANK_FIELDS),
    [headerColumns, buildFilterDef]
  );

  const fieldTonesFor = useCallback(
    (filters, extraLockedFields = new Set()) => {
      const tones = {};
      filters.forEach((f) => {
        let tone = "editable";
        if (!isEditMode) tone = "view";
        else if (isEditRoute && f.lockOnEditMode) tone = "frozen";
        else if (extraLockedFields.has(f.FilterParameterID)) tone = "frozen";
        tones[f.FilterParameterID] = tone;
      });
      return tones;
    },
    [isEditMode, isEditRoute]
  );

  const coreFieldTones = useMemo(() => fieldTonesFor(syncedCoreFilters), [syncedCoreFilters, fieldTonesFor]);
  const contactsFieldTones = useMemo(() => fieldTonesFor(syncedContactsFilters), [syncedContactsFilters, fieldTonesFor]);
  const transporterFieldTones = useMemo(() => fieldTonesFor(syncedTransporterFilters), [syncedTransporterFilters, fieldTonesFor]);
  // TDS gate — Deductee Type / NOP are frozen unless the tds checkbox is checked.
  const tdsFieldTones = useMemo(() => {
    const locked = isTdsChecked(headerValuesRef.current) ? new Set() : new Set(["deducteetypeid", "nopid"]);
    return fieldTonesFor(syncedTdsFilters, locked);
  }, [syncedTdsFilters, fieldTonesFor, headerValuesRef.current?.tds]);
  const bankFieldTones = useMemo(() => fieldTonesFor(syncedBankFilters), [syncedBankFilters, fieldTonesFor]);

  const [, forceRerender] = useState(0);

  const handleFilterChange = useCallback(
    async (colName, val) => {
      headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

      if (colName === "countryid") {
        headerValuesRef.current.stateid = 0;
        headerValuesRef.current.cityid = 0;
        clearCities();
        if (val && val !== "0") void fetchStateOptions(val);
        else clearStates();
        return { stateid: "", cityid: "" };
      }

      if (colName === "stateid") {
        headerValuesRef.current.cityid = 0;
        if (val && val !== "0") void fetchCityOptions(val);
        else clearCities();
        return { cityid: "" };
      }

      if (colName === "tds") {
        // Re-render so tdsFieldTones re-evaluates the Deductee Type / NOP lock.
        forceRerender((n) => n + 1);
        if (!val || val === "0" || val === false) {
          headerValuesRef.current.deducteetypeid = 0;
          headerValuesRef.current.nopid = 0;
          return { deducteetypeid: "", nopid: "" };
        }
        return undefined;
      }

      return undefined;
    },
    [fetchStateOptions, fetchCityOptions, clearStates, clearCities]
  );

  // ── Consignee grid — direct-entry, no item picker (rows are typed in) ────
  const addConsigneeRow = useCallback(() => {
    const row = { id: nextTempId() };
    detailAllColumns.forEach(({ key, colDataType }) => {
      row[key] = getColDefault(colDataType);
    });
    if (consigneeGridRef.current) consigneeGridRef.current.addRow(row);
    else queuedConsigneeRowsRef.current.push(row);
  }, [detailAllColumns]);

  const handleDeleteConsigneeSelected = useCallback(() => {
    if (!consigneeGridRef.current) return;
    const selected = consigneeGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    consigneeGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  // Consignee grid's own Country → State → City cascade. EntryGrid's dropdown
  // options are column-level, not per-row, so this refreshes the shared
  // stateOptions/cityOptions to match whichever row's Country/State was most
  // recently changed — a known simplification (rows editing different
  // countries simultaneously will momentarily see the last-changed row's
  // list) rather than a true per-row filtered option set.
  const prevConsigneeRowsRef = useRef([]);
  const handleConsigneeRowsChange = useCallback((rows) => {
    const prev = prevConsigneeRowsRef.current;
    const prevById = new Map(prev.map((r) => [String(r.id), r]));
    rows.forEach((row) => {
      const before = prevById.get(String(row.id));
      if (!before) return;
      if (before.countryid !== row.countryid) {
        if (row.countryid && row.countryid !== 0) void fetchStateOptions(row.countryid);
        if (row.stateid || row.cityid) {
          consigneeGridRef.current?.updateRow?.(row.id, { stateid: 0, cityid: 0 });
        }
      } else if (before.stateid !== row.stateid) {
        if (row.stateid && row.stateid !== 0) void fetchCityOptions(row.stateid);
        if (row.cityid) {
          consigneeGridRef.current?.updateRow?.(row.id, { cityid: 0 });
        }
      }
    });
    prevConsigneeRowsRef.current = rows;
  }, [fetchStateOptions, fetchCityOptions]);

  const consigneeGridConfig = useMemo(() => ({
    columns: detailColumns,
    pagination: { pageSize: 50, pageSizeOptions: [25, 50, 100] },
  }), [detailColumns]);

  // ── Save ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const hv = headerValuesRef.current;
    const headerFieldNames = new Set([
      ...SM_CORE_FIELDS, ...SM_CONTACTS_FIELDS, ...SM_TRANSPORTER_FIELDS,
      ...SM_TDS_FIELDS, ...SM_BANK_FIELDS,
    ]);
    const headerColsToValidate = headerColumns.filter((c) => headerFieldNames.has(c.colname));
    const headerErrors = validateApiColumns(hv, headerColsToValidate, {
      zeroValidFields: new Set(["tds"]),
    });

    const consigneeRows = consigneeGridRef.current?.getRows?.() ?? [];
    const consigneeErrors = validateGridRows(consigneeRows, detailColumns);

    const allErrors = [...headerErrors, ...consigneeErrors];
    if (allErrors.length > 0) {
      setFormErrors(allErrors);
      return false;
    }

    const masterColumnDefs = headerColumns.map((col) => ({
      key: col.colname,
      colDataType: col.coldatatype || null,
    }));
    const mstRow = buildSaveRowFromColumns(hv, masterColumnDefs, {
      loginid: session.loginId,
      sessionid: DEFAULT_SESSION_ID,
    });

    const consigneeSaveRows = consigneeRows.map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, detailAllColumns, {
        loginid: session.loginId,
        sessionid: DEFAULT_SESSION_ID,
      })
    );

    const payload = withSaveContextFields(
      buildSaveJsonFields({
        label: "SM",
        mst: mstRow,
        extra: { prmStrConsigneeJSON: JSON.stringify(consigneeSaveRows) },
      }),
      { divisionId: 0, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await post(SM_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
      navigate("/admin/master/supplier-master");
      return true;
    } catch (err) {
      console.error("[SM Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [headerColumns, detailColumns, detailAllColumns, isEditRoute, session, post, notify, navigate]);

  const handleCancel = useCallback(() => {
    if (isEditRoute) { navigate("/admin/master/supplier-master"); return; }
    setDiscardOpen(true);
  }, [isEditRoute, navigate]);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    navigate("/admin/master/supplier-master");
  }, [navigate]);

  const enterEditMode = useCallback(() => setIsEditMode(true), []);

  const combinedError = headerError || detailError || recordLoadError;
  const headerMetaReady = headerColumns.length > 0;
  const filterPanelLoading = headerFetching || detailFetching;

  const smExtraButtons = useMemo(() => [
    {
      Icon: Save,
      variant: "save",
      onClick: () => handleSave(),
      disabled: isSaving,
      loading: isSaving,
      accessKey: "s",
      title: "Save (Alt+S)",
    },
  ], [handleSave, isSaving]);

  return (
    <div className="workspace-page sm-page">
      <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
      <ConfirmDialog
        isOpen={discardOpen}
        message="Discard changes and go back to the list?"
        onConfirm={handleDiscardConfirm}
        onCancel={() => setDiscardOpen(false)}
      />

      <section className="workspace-page__filters">
        {combinedError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{combinedError}</span>
            <button type="button" onClick={() => { fetchHeaderMeta(); fetchDetailMeta(); }}>
              Retry
            </button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            panelRef={filterPanelRef}
            title="Supplier Detail"
            staticFilters={syncedCoreFilters}
            initialValues={filterInitialValues}
            cascadeResets={SM_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            isSearching={filterPanelLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterPanelLoading || !headerMetaReady}
            fieldTones={coreFieldTones}
          />
        )}
      </section>

      <section className="sm-grid-section">
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {SM_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`grid-tab ${activeTab === t.id ? "grid-tab--active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {activeTab === "consignee" && (
            <div className="grid-tabbar__controls">
              <button type="button" className="eg-tab-btn" onClick={addConsigneeRow} disabled={!isEditMode}>
                + Add Row
              </button>
              <button
                type="button"
                className="eg-tab-btn eg-tab-btn--danger"
                onClick={handleDeleteConsigneeSelected}
                disabled={!isEditMode}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {activeTab === "contacts" && (
          <div className="sm-tab-pane sm-tab-pane--active sm-sub-panel">
            <EnterpriseFilterPanel
              key={`contacts-${filterResetKey}`}
              title="Contacts"
              staticFilters={syncedContactsFilters}
              initialValues={filterInitialValues}
              onFilterChange={handleFilterChange}
              isSearching={filterPanelLoading}
              isMetaLoading={!headerMetaReady || recordLoading}
              disabled={filterPanelLoading || !headerMetaReady}
              fieldTones={contactsFieldTones}
            />
          </div>
        )}

        {activeTab === "transporter" && (
          <div className="sm-tab-pane sm-tab-pane--active sm-sub-panel">
            <EnterpriseFilterPanel
              key={`transporter-${filterResetKey}`}
              title="Transporter Detail"
              staticFilters={syncedTransporterFilters}
              initialValues={filterInitialValues}
              onFilterChange={handleFilterChange}
              isSearching={filterPanelLoading}
              isMetaLoading={!headerMetaReady || recordLoading}
              disabled={filterPanelLoading || !headerMetaReady}
              fieldTones={transporterFieldTones}
            />
          </div>
        )}

        {activeTab === "tds" && (
          <div className="sm-tab-pane sm-tab-pane--active sm-sub-panel">
            <EnterpriseFilterPanel
              key={`tds-${filterResetKey}`}
              title="TDS Deduction"
              staticFilters={syncedTdsFilters}
              initialValues={filterInitialValues}
              onFilterChange={handleFilterChange}
              isSearching={filterPanelLoading}
              isMetaLoading={!headerMetaReady || recordLoading}
              disabled={filterPanelLoading || !headerMetaReady}
              fieldTones={tdsFieldTones}
            />
          </div>
        )}

        {activeTab === "bank" && (
          <div className="sm-tab-pane sm-tab-pane--active sm-sub-panel">
            <EnterpriseFilterPanel
              key={`bank-${filterResetKey}`}
              title="Bank Information"
              staticFilters={syncedBankFilters}
              initialValues={filterInitialValues}
              onFilterChange={handleFilterChange}
              isSearching={filterPanelLoading}
              isMetaLoading={!headerMetaReady || recordLoading}
              disabled={filterPanelLoading || !headerMetaReady}
              fieldTones={bankFieldTones}
            />
          </div>
        )}

        <div className={`sm-tab-pane${activeTab === "consignee" ? " sm-tab-pane--active" : ""}`}>
          <EntryGrid
            ref={consigneeGridRef}
            config={consigneeGridConfig}
            title=""
            hideBottomPanel
            readOnly={isEditRoute && !isEditMode}
            emptyMessage="No consignees yet. Click + Add Row above."
            onRowsChange={handleConsigneeRowsChange}
            existingRecordEdit={isEditRoute && isEditMode}
          />
        </div>
      </section>

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditMode}
        onCancel={handleCancel}
        addLabel={isEditRoute ? "Edit" : "Add"}
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={smExtraButtons}
      />
    </div>
  );
}
