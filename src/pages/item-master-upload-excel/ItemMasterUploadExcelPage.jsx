// ItemMasterUploadExcelPage.jsx — Item Master Upload Excel listing
// Add New → /admin/master/item-master-upload-excel/new

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { createDeleteActionColumn } from "../../utils/listGridUtils";
import { IMUE_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./ItemMasterUploadExcelPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import ListPanelHeader from "../../components/list/ListPanelHeader";

function buildImueReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatListDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

function buildListParams() {
  const session = getUserSession();
  return {
    ObjType: IMUE_CONFIG.LIST_OBJ_TYPE,
    ObjName: IMUE_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      prmcompanyid: session.companyId,
      prmdivisionid: IMUE_CONFIG.LIST_DIVISION_ID,
      prmloginid: session.loginId,
      prmyearid: session.yearId,
    }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

const HIDDEN_COLS = new Set(["idnumber"]);

function toLabel(key) {
  return key.replace(/([A-Z])/g, " $1").trim();
}

function buildColumnsFromData(data) {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]).filter((k) => !HIDDEN_COLS.has(k));
  return [
    ...keys.map((key) => ({
      key,
      label: toLabel(key),
      filterable: true,
      align: "left",
      ...(key.toLowerCase().includes("date") ? { render: (v) => formatListDate(v) } : {}),
    })),
    createDeleteActionColumn({
      getDeleteLabel: (row) => row.trancode ?? row.itemcode ?? "",
    }),
  ];
}

export default function ItemMasterUploadExcelPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Item Master Upload Excel",
    subtitle: "Create item master entries from Excel upload.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(() => buildColumnsFromData(data), [data]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(json ?? []);
    } catch (err) {
      console.error("[IMUE] list fetch failed:", err);
      setError("Failed to load Item Master Upload Excel records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleAddNew = useCallback(
    () => navigate(`${IMUE_CONFIG.ROUTE_PATH}/new`),
    [navigate],
  );

  return (
    <div className="workspace-page imue-list-page">
      <section className="imue-list-panel imue-list-panel--fill">
        <ListPanelHeader
          icon={FileSpreadsheet}
          title="Item Master Upload Excel"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          print={{
            reportTitle: "Item Master Upload Excel Report",
            reportFileName: "TODO_ItemMasterUploadExcel.rpt",
            buildParams: buildImueReportParams,
          }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />

        <EnterpriseDataGrid
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading Item Master Upload Excel records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No records found. Upload a new Excel batch to get started."
          hideHeader
          searchable
          deleteProcName={IMUE_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
