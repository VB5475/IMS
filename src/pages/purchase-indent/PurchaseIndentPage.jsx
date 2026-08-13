// PurchaseIndentPage.jsx
// Purchase Indent listing / landing page.
// Clicking Add New → /purchase-indent/new  (PurchaseIndentForm in new mode)
// Clicking Edit   → /purchase-indent/:id/edit (PurchaseIndentForm in edit mode)

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { resolveListRowId } from "../../utils/listColumns";
import { IND_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./PurchaseIndentPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

// Selected row (via the grid's single-select checkbox) narrows the print to
// just that record — prmidnumber omitted entirely prints the full list, same
// as before this feature existed.
function buildPurchaseIndentReportParams(selectedId) {
  const params = [buildCompanyReportParam()];
  if (selectedId != null) {
    params.push({ paramtitle: "ID", paramname: "@prmidnumber", paramval: String(selectedId), paramtext: String(selectedId) });
  }
  return params;
}

function buildListParams() {
  const year = new Date().getFullYear();
  const session = getUserSession();
  return {
    ObjType: IND_CONFIG.LIST_OBJ_TYPE,
    ObjName: IND_CONFIG.SP_INDENT_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId,
        prmdivisionid: IND_CONFIG.LIST_DIVISION_ID,
        prmyearid: session.yearId,
        prmfromdate: `01-Jan-${year}`,
        prmtodate: `31-Dec-${year}`,
        prmloginid: session.loginId,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function PurchaseIndentPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedId, setSelectedId] = useState(null);
  const gridRef = useRef(null);

  usePageHeader({
    title: "Purchase Indents",
    subtitle: "Browse purchase indents or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: IND_CONFIG.ROUTE_PATH,
        editBtnClass: "ind-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchIndents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[PurchaseIndentPage] list fetch failed:", err);
      setError(err?.message || "Failed to load purchase indents.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchIndents();
  }, [fetchIndents]);

  const handleAddNew = useCallback(() => {
    navigate(`${IND_CONFIG.ROUTE_PATH}/new`);
  }, [navigate]);

  const handlePrintParams = useCallback(
    () => buildPurchaseIndentReportParams(selectedId),
    [selectedId]
  );

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Purchase_Indents_export.csv");
  }, []);

  return (
    <div className="workspace-page ind-list-page">
      <section className="ind-list-panel ind-list-panel--fill">
        <ListPanelHeader
          icon={ClipboardList}
          title="Purchase Indents"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchIndents}
          refreshing={loading}
          print={{
            ...PRINT_REPORT_CONFIG["purchase-indent"],
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
          loaderText="Loading purchase indents…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No purchase indents found."
          hideHeader
          searchable
          deleteProcName={IND_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchIndents}
          fill
          selectable
          singleSelect
          selectedRowKeys={selectedId != null ? [String(selectedId)] : []}
          onSelectionChange={(keys) => setSelectedId(keys[0] != null ? keys[0] : null)}
          getRowKey={(row) => String(resolveListRowId(row) ?? "")}
        />
      </section>
    </div>
  );
}
