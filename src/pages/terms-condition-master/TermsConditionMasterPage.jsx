// TermsConditionMasterPage.jsx — Terms and Condition Master (2026-09-07 /pm)
// Flat master, same list+modal pattern as Voucher Type Master / Country
// Master (list page renders the Add/Edit modal inline, one route, no
// separate Add/Edit URL). See constants.js for the open items (description
// locked per RB flag, no delete proc, Save endpoint unknown).
//
// 2026-09-08 /tl — Edit now fetches the record fresh via
// fn_tbl_rb_termnconditionmst (SP_EDIT, keyed on the row's idnumber as
// prmmasterid), same pattern Customer Master uses (recordId + fetchEditRecord
// passed to the modal, which loads on open) — superseding the original
// build's assumption that this master had no per-record fetch function.
//
// Delete intentionally has no deleteProcName wired — the RB's own
// deleteprocname is empty (not configured server-side), and guessing a
// name for a destructive action isn't safe the way guessing a routing path
// is. EnterpriseDataGrid renders the Delete button disabled by default
// when deleteProcName is omitted, which is the correct state here.
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ScrollText } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL, OBJ_TYPE } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { createListActionsColumn, isAlwaysHiddenColumnKey } from "../../utils/listGridUtils";
import { useTermsConditionMaster } from "../../hooks/useTermsConditionMaster";
import TermsConditionMasterForm from "./TermsConditionMasterForm";
import { TCM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./TermsConditionMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { exportRowsToCsv } from "../../utils/csvExport";

function buildListParams() {
  const session = getUserSession();
  return {
    ObjType: OBJ_TYPE.FUNCTION,
    ObjName: TCM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      prmcompanyid: session.companyId,
      prmdivisionid: TCM_CONFIG.LIST_DIVISION_ID,
      prmyearid: session.yearId,
      prmloginid: session.loginId,
    }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

// Keys per the LIST call's actual response shape (fn_tbl_rb_termnconditionmst_list,
// live-confirmed 2026-09-08 /tl) — this differs from the EDIT call's shape
// (fn_tbl_rb_termnconditionmst, which returns termstype/termstypeid/yearid/
// funccode/etc.): the list SP returns "terms type" (with a space, no id) plus
// created/updated audit columns instead.
const HIDDEN_COLS = new Set(["idnumber"]);

const LABEL_MAP = {
  "terms type": "Terms Type",
  code: "Code",
  description: "Description",
  "created by": "Created By",
  "created date": "Created Date",
  "updated by": "Updated By",
  "updated date": "Updated Date",
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
      onEdit: (row) => onEdit(row),
      getEditLabel: (row) => row.code ?? "",
      getDeleteLabel: (row) => row.code ?? "",
    }),
  ];
}

export default function TermsConditionMasterPage() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs, allColumns, headerFetching, headerError,
    dropdownOptions, fetchEditRecord,
  } = useTermsConditionMaster();

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
    title: "Terms and Condition Master",
    subtitle: "Browse terms and conditions or create a new one.",
  });

  useEffect(() => { fetchHeaderMeta(); }, [fetchHeaderMeta]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(res ?? []);
    } catch (err) {
      console.error("[TCM] List fetch failed:", err);
      setError("Failed to load Terms and Condition list.");
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

  const handleEdit = useCallback((row) => {
    setModalMode("edit");
    setEditRecordId(row?.idnumber ?? null);
    setModalOpen(true);
  }, []);

  const handleSaved = useCallback(() => {
    setModalOpen(false);
    fetchList();
  }, [fetchList]);

  const columns = useMemo(() => buildColumnsFromData(data, handleEdit), [data, handleEdit]);

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Terms_Condition_Master_export.csv");
  }, []);

  return (
    <div className="workspace-page tcm-list-page">
      <section className="tcm-list-panel tcm-list-panel--fill">
        <ListPanelHeader
          icon={ScrollText}
          title="Terms and Condition Master"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
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
          loaderText="Loading terms and conditions…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No terms and conditions found."
          hideHeader
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          fill
        />
      </section>

      <TermsConditionMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        allColumns={allColumns}
        defsLoading={headerFetching}
        defsError={headerError}
        dropdownOptions={dropdownOptions}
        fetchEditRecord={fetchEditRecord}
      />
    </div>
  );
}
