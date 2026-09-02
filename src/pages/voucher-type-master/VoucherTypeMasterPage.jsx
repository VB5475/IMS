import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Ticket } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { createListActionsColumn, isAlwaysHiddenColumnKey } from "../../utils/listGridUtils";
import { useVoucherTypeMaster } from "../../hooks/useVoucherTypeMaster";
import VoucherTypeMasterForm from "./VoucherTypeMasterForm";
import { VTM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./VoucherTypeMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

// Voucher Type Master's report takes no parameters — same as State/Sub Group Master.
function buildVoucherTypeReportParams() {
  return [];
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function todayFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

// ⚠️ CONFIRM with DBA — fn_tbl_rb_vouchertypemst_list's exact signature wasn't
// live-verified; following the same param shape MRD §7 lists (and the one
// Country/State Master's sibling list SPs actually needed).
function buildListParams() {
  const today = todayFormatted();
  const session = getUserSession();
  return {
    ObjType: VTM_CONFIG.LIST_OBJ_TYPE,
    ObjName: VTM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      prmcompanyid: session.companyId,
      prmdivisionid: VTM_CONFIG.LIST_DIVISION_ID,
      prmyearid: session.yearId,
      prmfromdate: today,
      prmtodate: today,
      prmloginid: session.loginId,
    }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

const HIDDEN_COLS = new Set(["idnumber", "moduleid", "levyid"]);

const LABEL_MAP = {
  modulename: "Module",
  vouchertype: "Voucher Type",
  vouchertypepre: "Voucher Type Prefix",
  levyname: "Levy Formula",
  levyformulaname: "Levy Formula",
  isconversion: "Is Conversion",
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
      getEditLabel: (row) => row.vouchertype ?? "",
      getDeleteLabel: (row) => row.vouchertype ?? "",
    }),
  ];
}

export default function VoucherTypeMasterPage() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs, allColumns, headerFetching, headerError,
    moduleOptions, levyFormulaOptions,
    fetchEditRecord,
  } = useVoucherTypeMaster();

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
    title: "Voucher Type Master",
    subtitle: "Browse voucher types or create a new one.",
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
      console.error("[VTM] List fetch failed:", err);
      setError("Failed to load Voucher Type list.");
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
    exportRowsToCsv(rows, columns, "Voucher_Type_Master_export.csv");
  }, []);

  return (
    <div className="workspace-page vtm-list-page">
      <section className="vtm-list-panel vtm-list-panel--fill">
        <ListPanelHeader
          icon={Ticket}
          title="Voucher Type Master"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
          print={{
            ...PRINT_REPORT_CONFIG["voucher-type-master"],
            buildParams: buildVoucherTypeReportParams,
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
          loaderText="Loading voucher types…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No voucher types found."
          hideHeader
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          deleteProcName={VTM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <VoucherTypeMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        allColumns={allColumns}
        defsLoading={headerFetching}
        defsError={headerError}
        moduleOptions={moduleOptions}
        levyFormulaOptions={levyFormulaOptions}
        fetchEditRecord={fetchEditRecord}
      />
    </div>
  );
}
