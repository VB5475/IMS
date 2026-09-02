import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Map } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { createListActionsColumn, isAlwaysHiddenColumnKey } from "../../utils/listGridUtils";
import { useStateMaster } from "../../hooks/useStateMaster";
import StateMasterForm from "./StateMasterForm";
import { STM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./StateMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

// State Master's report takes no parameters — same as Sub Group Master.
function buildStateReportParams() {
  return [];
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function todayFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

// ⚠️ CONFIRM with DBA — fn_tbl_rb_statemst_list's exact signature wasn't given
// directly, but its sibling fn_tbl_rb_countrymst_list (same MRD family, same
// day) is confirmed to need @prmyearid/@prmloginid too (2026-08-17 /pm), so
// they're included here defensively rather than waiting to hit the same bug.
function buildListParams() {
  const today = todayFormatted();
  const session = getUserSession();
  return {
    ObjType: STM_CONFIG.LIST_OBJ_TYPE,
    ObjName: STM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      prmcompanyid: session.companyId,
      prmdivisionid: STM_CONFIG.LIST_DIVISION_ID,
      prmyearid: session.yearId,
      prmfromdate: today,
      prmtodate: today,
      prmloginid: session.loginId,
    }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

const HIDDEN_COLS = new Set(["idnumber", "countryid", "statetypeid", "typeid"]);

const LABEL_MAP = {
  countryname: "Country",
  statecode: "Code",
  statename: "Name",
  regname: "Reg Name",
  statetypename: "State Type",
  typename: "State Type",
  tinno: "Tin No",
};

function toLabel(key) {
  return LABEL_MAP[key] ?? key;
}

function buildColumnsFromData(data, onEdit) {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]).filter((k) => !HIDDEN_COLS.has(k) && !isAlwaysHiddenColumnKey(k));
  return [
    ...keys.map((key) => ({
      key,
      label: toLabel(key),
      filterable: true,
      align: "left",
    })),
    createListActionsColumn({
      onEdit: (row) => { if (row.idnumber) onEdit(row.idnumber); },
      getEditLabel: (row) => row.statecode ?? "",
      getDeleteLabel: (row) => row.statecode ?? "",
    }),
  ];
}

export default function StateMasterPage() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs, allColumns, headerFetching, headerError,
    countryOptions, stateTypeOptions,
    fetchEditRecord,
  } = useStateMaster();

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

  usePageHeader({
    title: "State Master",
    subtitle: "Browse states or create a new one.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => { fetchHeaderMeta(); }, [fetchHeaderMeta]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(res ?? []);
    } catch (err) {
      console.error("[STM] List fetch failed:", err);
      setError("Failed to load State list.");
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

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "State_Master_export.csv");
  }, []);

  return (
    <div className="workspace-page stm-list-page">
      <section className="stm-list-panel stm-list-panel--fill">
        <ListPanelHeader
          icon={Map}
          title="State Master"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
          print={{
            ...PRINT_REPORT_CONFIG["state-master"],
            buildParams: buildStateReportParams,
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
          loaderText="Loading states…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No states found."
          hideHeader
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          deleteProcName={STM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <StateMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        allColumns={allColumns}
        defsLoading={headerFetching}
        defsError={headerError}
        countryOptions={countryOptions}
        stateTypeOptions={stateTypeOptions}
        fetchEditRecord={fetchEditRecord}
      />
    </div>
  );
}
