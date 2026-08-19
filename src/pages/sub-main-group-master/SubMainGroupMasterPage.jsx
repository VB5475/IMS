import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Layers } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { createListActionsColumn } from "../../utils/listGridUtils";
import { useSubMainGroupMaster } from "../../hooks/useSubMainGroupMaster";
import SubMainGroupMasterForm from "./SubMainGroupMasterForm";
import { SMGM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./SubMainGroupMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

function buildSubMainGroupReportParams(selectedId) {
  const params = [buildCompanyReportParam()];
  return params;
}

function resolveSubMainGroupRowId(row) {
  return row?.IDNumber ?? row?.idnumber ?? null;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function todayFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

function buildListParams() {
  const today = todayFormatted();
  const session = getUserSession();
  return {
    ObjType: SMGM_CONFIG.LIST_OBJ_TYPE,
    ObjName: SMGM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      prmcompanyid: session.companyId,
      prmdivisionid: SMGM_CONFIG.LIST_DIVISION_ID,
      prmfromdate: today,
      prmtodate: today,
    }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

const HIDDEN_COLS = new Set(["IDNumber", "idnumber", "SystemConfigured", "systemconfigured"]);

const LABEL_MAP = {
  ISAutoCodeGen: "Auto Code Gen",
  RegName: "Reg Name",
};

function toLabel(key) {
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  return key.replace(/([A-Z])/g, " $1").trim();
}

function buildColumnsFromData(data, onEdit) {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]).filter((k) => !HIDDEN_COLS.has(k));
  return [
    ...keys.map((key) => ({ key, label: toLabel(key), filterable: true, align: "left" })),
    createListActionsColumn({
      onEdit: (row) => {
        const id = row.IDNumber ?? row.idnumber;
        if (id) onEdit(id);
      },
      getEditLabel: (row) => row.SubMainGroupCode ?? row.submaingroupcode ?? "",
      getDeleteLabel: (row) => row.SubMainGroupCode ?? row.submaingroupcode ?? "",
    }),
  ];
}

export default function SubMainGroupMasterPage() {
  const { get } = useApi(API_BASE_URL);

  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs, allColumns, headerFetching, headerError,
    itemTypeOptions, mainGroupOptions, mainGroupLoading, fixedAssetAccOptions,
    fetchMainGroupByItemType, fetchEditRecord, seedOptionsFromMaster,
  } = useSubMainGroupMaster();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStats, setSearchStats] = useState({ matchCount: 0, totalCount: 0 });
  const gridRef = useRef(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editRecordId, setEditRecordId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  usePageHeader({
    title: "Sub Main Group Master",
    subtitle: "Browse sub main groups or create a new one.",
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
      console.error("[SMGM] List fetch failed:", err);
      setError("Failed to load Sub Main Group list.");
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

  const columns = useMemo(() => buildColumnsFromData(data, handleEdit), [data, handleEdit]);

  const handlePrintParams = useCallback(
    () => buildSubMainGroupReportParams(selectedId),
    [selectedId]
  );

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Sub_Main_Group_Master_export.csv");
  }, []);

  return (
    <div className="workspace-page smgm-list-page">
      <section className="smgm-list-panel smgm-list-panel--fill">
        <ListPanelHeader
          icon={Layers}
          title="Sub Main Group Master"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
          print={{
            ...PRINT_REPORT_CONFIG["sub-main-group-master"],
            buildParams: handlePrintParams,
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
          loaderText="Loading sub main groups…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No sub main groups found."
          hideHeader
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          deleteProcName={SMGM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
          selectable
          singleSelect
          selectedRowKeys={selectedId != null ? [String(selectedId)] : []}
          onSelectionChange={(keys) => setSelectedId(keys[0] != null ? keys[0] : null)}
          getRowKey={(row) => String(resolveSubMainGroupRowId(row) ?? "")}
        />
      </section>

      <SubMainGroupMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        allColumns={allColumns}
        defsLoading={headerFetching}
        defsError={headerError}
        itemTypeOptions={itemTypeOptions}
        mainGroupOptions={mainGroupOptions}
        mainGroupLoading={mainGroupLoading}
        fixedAssetAccOptions={fixedAssetAccOptions}
        fetchMainGroupByItemType={fetchMainGroupByItemType}
        fetchEditRecord={fetchEditRecord}
        seedOptionsFromMaster={seedOptionsFromMaster}
      />
    </div>
  );
}
