import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MapPin } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { createListActionsColumn } from "../../utils/listGridUtils";
import { useLocationMaster } from "../../hooks/useLocationMaster";
import LocationMasterForm from "./LocationMasterForm";
import { LM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./LocationMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

function buildLocationMasterReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  return {
    ObjType: LM_CONFIG.LIST_OBJ_TYPE,
    ObjName: LM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      prmcompanyid: getUserSession().companyId,
    }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

const HIDDEN_COLS = new Set(["idnumber", "systemconfigured"]);

const LABEL_MAP = {
  RegName: "Reg Name",
};

function toLabel(key) {
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  return key.replace(/([A-Z_])/g, " $1").replace(/_/g, "").trim();
}

function buildColumnsFromData(data, onEdit) {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]).filter((k) => !HIDDEN_COLS.has(k));
  return [
    ...keys.map((key) => ({ key, label: toLabel(key), filterable: true, align: "left" })),
    createListActionsColumn({
      onEdit: (row) => { if (row.idnumber) onEdit(row.idnumber); },
      getEditLabel: (row) => row.Location_Code ?? row.Loc_Code ?? "",
      getDeleteLabel: (row) => row.Location_Code ?? row.Loc_Code ?? "",
    }),
  ];
}

export default function LocationMasterPage() {
  const { get } = useApi(API_BASE_URL);

  // Field defs (from GetDetailColData) + dropdown options fetched once — passed down to form
  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs, allColumns, headerFetching, headerError,
    locationTypeOptions, premisesOptions, divisionOptions,
    parentLocationOptions, fetchParentLocationOptions, clearParentLocationOptions,
    fetchEditRecord,
  } = useLocationMaster();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const gridRef = useRef(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editRecordId, setEditRecordId] = useState(null);

  usePageHeader({
    title: "Location Master",
    subtitle: "Browse locations or create a new one.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => { fetchHeaderMeta(); }, [fetchHeaderMeta]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(res ?? res ?? []);
    } catch (err) {
      console.error("[LM] List fetch failed:", err);
      setError("Failed to load Location list.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchList(); }, [fetchList]);

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

  const handleSaved = useCallback(() => {
    setModalOpen(false);
    fetchList();
  }, [fetchList]);

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Location_Master_export.csv");
  }, []);

  const columns = useMemo(() => buildColumnsFromData(data, handleEdit), [data, handleEdit]);

  return (
    <div className="workspace-page lm-list-page">
      <section className="lm-list-panel lm-list-panel--fill">
        <ListPanelHeader
          icon={MapPin}
          title="Location Master"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          print={{
            ...PRINT_REPORT_CONFIG["location-master"],
            buildParams: buildLocationMasterReportParams,
          }}
          onExportCsv={handleExportCsv}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />

        <EnterpriseDataGrid
          ref={gridRef}
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading locations…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No locations found."
          hideHeader
          searchable
          deleteProcName={LM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <LocationMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        allColumns={allColumns}
        defsLoading={headerFetching}
        defsError={headerError}
        locationTypeOptions={locationTypeOptions}
        premisesOptions={premisesOptions}
        divisionOptions={divisionOptions}
        parentLocationOptions={parentLocationOptions}
        fetchParentLocationOptions={fetchParentLocationOptions}
        clearParentLocationOptions={clearParentLocationOptions}
        fetchEditRecord={fetchEditRecord}
      />
    </div>
  );
}
