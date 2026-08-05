// TransporterMasterPage.jsx — Transporter Master listing / landing page.
// Clicking Add New → /admin/master/transporter-master/new
// Clicking Edit   → /admin/master/transporter-master/:id/edit

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
import RefreshButton from "../../components/ui/RefreshButton";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { formatTranDate } from "../../utils/dateFormat";
import { TM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./TransporterMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";

function buildTransporterMasterReportParams() {
  return [buildCompanyReportParam()];
}

// SP_LIST's real signature (DBA-confirmed 2026-08-04) is
// fn_tbl_rb_transportermst_list(@prmcompanyid, @prmdivisionid, @prmyearid,
// @prmfromdate, @prmtodate, @prmloginid) — the previous call only sent 3 of
// the 6 params (missing prmyearid/prmfromdate/prmtodate), which is why the
// list never resolved live (see project_transporter_master memory).
function buildListParams() {
  const today = formatTranDate(new Date(), { invalidValue: "" });
  const session = getUserSession();
  return {
    ObjType: TM_CONFIG.LIST_OBJ_TYPE,
    ObjName: TM_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId,
        prmdivisionid: TM_CONFIG.LIST_DIVISION_ID,
        prmyearid: session.yearId,
        prmfromdate: today,
        prmtodate: today,
        prmloginid: session.loginId,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function TransporterMasterPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Transporter Master",
    subtitle: "Browse transporters or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: TM_CONFIG.ROUTE_PATH,
        editBtnClass: "tm-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[TM] list fetch failed:", err);
      setError(err?.message || "Failed to load Transporter Master records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleAddNew = useCallback(() => {
    navigate(`${TM_CONFIG.ROUTE_PATH}/new`);
  }, [navigate]);

  return (
    <div className="workspace-page tm-list-page">
      <section className="tm-list-panel tm-list-panel--fill">
        <header className="tm-list-panel__header">
          <div className="tm-list-panel__title">
            <Truck size={14} strokeWidth={2} />
            <span>Transporter Master</span>
          </div>
          <div className="tm-list-panel__toolbar">
            <button type="button" className="tm-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <RefreshButton onClick={fetchList} loading={loading} />
            <PrintReportButton
              reportTitle="Transporter Master Report"
              reportFileName="TODO_TransporterMaster.rpt"
              buildParams={buildTransporterMasterReportParams}
            />
            <label htmlFor="tm-list-page-size" className="tm-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="tm-list-page-size"
              className="ng-select tm-list-panel__pagesize-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </header>

        <EnterpriseDataGrid
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading Transporter Master records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Transporter Master records found."
          hideHeader
          searchable
          fill
        />
      </section>
    </div>
  );
}
