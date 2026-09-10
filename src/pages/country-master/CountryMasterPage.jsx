import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Globe } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { createListActionsColumn, isAlwaysHiddenColumnKey } from "../../utils/listGridUtils";
import { useCountryMaster } from "../../hooks/useCountryMaster";
import CountryMasterForm from "./CountryMasterForm";
import { CTM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./CountryMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

// Country Master's report takes no parameters — same as Sub Group Master.
function buildCountryReportParams() {
  return [];
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function todayFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

// Live SP signature (DBA-confirmed 2026-08-17 /pm):
// fn_tbl_rb_countrymst_list(@prmcompanyid, @prmdivisionid, @prmyearid,
// @prmfromdate, @prmtodate, @prmloginid) — prmyearid/prmloginid were
// missing from the initial payload (copied from Sub Group Master's template,
// whose list SP doesn't take them).
function buildListParams() {
  const today = todayFormatted();
  const session = getUserSession();
  return {
    ObjType: CTM_CONFIG.LIST_OBJ_TYPE,
    ObjName: CTM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      prmcompanyid: session.companyId,
      prmdivisionid: CTM_CONFIG.LIST_DIVISION_ID,
      prmyearid: session.yearId,
      prmfromdate: today,
      prmtodate: today,
      prmloginid: session.loginId,
    }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

const HIDDEN_COLS = new Set(["idnumber"]);

const LABEL_MAP = {
  countrycode: "Code",
  countryname: "Name",
  regname: "Reg Name",
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
      getEditLabel: (row) => row.countrycode ?? "",
      getDeleteLabel: (row) => row.countrycode ?? "",
    }),
  ];
}

export default function CountryMasterPage() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs, allColumns, headerFetching, headerError,
    fetchEditRecord,
  } = useCountryMaster();

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
    title: "Country Master",
    subtitle: "Browse countries or create a new one.",
  });

  useEffect(() => { fetchHeaderMeta(); }, [fetchHeaderMeta]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(res ?? []);
    } catch (err) {
      console.error("[CTM] List fetch failed:", err);
      setError("Failed to load Country list.");
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
    exportRowsToCsv(rows, columns, "Country_Master_export.csv");
  }, []);

  return (
    <div className="workspace-page ctm-list-page">
      <section className="ctm-list-panel ctm-list-panel--fill">
        <ListPanelHeader
          icon={Globe}
          title="Country Master"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
          print={{
            ...PRINT_REPORT_CONFIG["country-master"],
            buildParams: buildCountryReportParams,
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
          loaderText="Loading countries…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No countries found."
          hideHeader
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          deleteProcName={CTM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <CountryMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        allColumns={allColumns}
        defsLoading={headerFetching}
        defsError={headerError}
        fetchEditRecord={fetchEditRecord}
      />
    </div>
  );
}
