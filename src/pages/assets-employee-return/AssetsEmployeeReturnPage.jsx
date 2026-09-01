import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, Send } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  OBJ_TYPE,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useNotification } from "../../context/NotificationContext";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { resolveListRowId } from "../../utils/listColumns";
import { resolveRowFieldValue } from "../../utils/gridUtils";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { useApprovalRowStatus } from "../../hooks/useApprovalRowStatus";
import { AER_CONFIG, ENTRY_FORM_LABEL, buildAerListJsonPayload } from "./constants";
import "./AssetsEmployeeReturnPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { exportRowsToCsv } from "../../utils/csvExport";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";

function buildAerReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  return {
    ObjType: AER_CONFIG.LIST_OBJ_TYPE,
    ObjName: AER_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildAerListJsonPayload()]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AssetsEmployeeReturnPage() {
  const navigate = useNavigate();
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);
  const { post: postWkf } = useApi(API_BASE_URL_IMS);
  const notify = useNotification();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStats, setSearchStats] = useState({ matchCount: 0, totalCount: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const gridRef = useRef(null);

  // "Approval Initiator" button (WKF) — visibility is a per-login,
  // per-trantype backend flag, same pattern as Purchase Order's. Routes on
  // From Division (fromdivisionid) per 2026-08-25 /pm confirmation.
  const [wkfBtnVisible, setWkfBtnVisible] = useState("NO");
  const [sendingApproval, setSendingApproval] = useState(false);
  const [divisionNameToId, setDivisionNameToId] = useState({});

  // appstatusid-driven row color + Edit/Delete lock, per src/config/approvalStatusConfig.js.
  const getRowState = useApprovalRowStatus("assets-employee-return");

  usePageHeader({
    title: "Assets Employee Return",
    subtitle: "Return assets and issued items from employees.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => {
    const session = getUserSession();
    postWkf(ENDPOINTS.WKF_HANDLE_BUTTON_VISIBILITY, {
      prmref_is_trantypeid: AER_CONFIG.WKF_TRAN_TYPE_ID,
      prmloginid: session.loginId,
    })
      .then((res) => {
        const row = Array.isArray(res) ? res[0] : res;
        setWkfBtnVisible(row?.iswkfbtnvisible === "YES" ? "YES" : "NO");
      })
      .catch((err) => {
        console.warn("[AssetsEmployeeReturnPage] WKF button visibility fetch failed:", err);
        setWkfBtnVisible("NO");
      });

    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: OBJ_TYPE.FUNCTION,
      ObjName: "fn_tbl_fetchuserwsdivision",
      JSon: JSON.stringify([{
        prmuserid: session.loginId,
        prmcompanyid: session.companyId,
        prmyearid: session.yearId,
      }]),
      p_ErrCode: -1,
      p_ErrMsg: "",
    })
      .then((rows) => {
        const map = {};
        (rows || []).forEach((row) => {
          const id = resolveRowFieldValue(row, "divisionid");
          const name = resolveRowFieldValue(row, "divisionname") ?? resolveRowFieldValue(row, "division");
          if (id != null && name) map[String(name).trim().toLowerCase()] = Number(id);
        });
        setDivisionNameToId(map);
      })
      .catch((err) => console.warn("[AssetsEmployeeReturnPage] Division options fetch failed:", err));
  }, [postWkf, get]);

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: AER_CONFIG.ROUTE_PATH,
        editBtnClass: "aer-list__edit-btn",
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
      console.error("[AER] list fetch failed:", err);
      setError(err?.message || "Failed to load Assets Employee Return records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(() => navigate(`${AER_CONFIG.ROUTE_PATH}/new`), [navigate]);

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Assets_Employee_Return_export.csv");
  }, []);

  const handleSendForApproval = useCallback(async () => {
    if (!selectedId) {
      notify.error("Select a record before sending it for approval.");
      return;
    }
    const row = data.find((r) => String(resolveListRowId(r)) === String(selectedId));

    const directDivisionId = Number(resolveRowFieldValue(row, "fromdivisionid"));
    let divisionId = Number.isFinite(directDivisionId) && directDivisionId > 0 ? directDivisionId : null;
    if (!divisionId) {
      // Live-confirmed 2026-08-31: the list SP returns a plain "division"
      // column (matches PO's list-page pattern), never "fromdivision" —
      // that fallback alone always missed, which silently blocked Send For
      // Approval before it ever reached the API.
      const divisionName = row
        ? String(
            resolveRowFieldValue(row, "fromdivision")
              ?? resolveRowFieldValue(row, "fromdivisionname")
              ?? resolveRowFieldValue(row, "division")
              ?? resolveRowFieldValue(row, "divisionname")
              ?? ""
          ).trim().toLowerCase()
        : "";
      divisionId = divisionNameToId[divisionName];
    }
    if (!divisionId) {
      notify.error("Could not resolve the division for the selected record. Refresh and try again.");
      return;
    }

    const session = getUserSession();
    setSendingApproval(true);
    try {
      const result = await postWkf(ENDPOINTS.WKF_SEND_FOR_APPROVAL, {
        prmref_is_trantypeid: AER_CONFIG.WKF_TRAN_TYPE_ID,
        prmtranid: Number(selectedId),
        prmcolnamesoftranid: "idnumber",
        prmyearid: session.yearId,
        prmloginid: session.loginId,
        prmdivisionid: divisionId,
      });
      const { success, message } = parseApiErrMsg(result);
      if (!success) { notify.error(message); return; }
      notify.success(message);
    } catch (err) {
      console.error("[AssetsEmployeeReturnPage] Send for approval failed:", err);
      notify.error(err?.message || "Failed to send for approval. Please try again.");
    } finally {
      setSendingApproval(false);
    }
  }, [selectedId, data, divisionNameToId, postWkf, notify]);

  return (
    <div className="workspace-page aer-list-page">
      <section className="aer-list-panel aer-list-panel--fill">
        <ListPanelHeader
          icon={RotateCcw}
          title="Assets Employee Return"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
          print={{
            ...PRINT_REPORT_CONFIG["assets-employee-return"],
            buildParams: buildAerReportParams,
          }}
          onExportCsv={handleExportCsv}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        >
          {wkfBtnVisible === "YES" && (
            <button
              type="button"
              className="aer-list__wkf-btn"
              onClick={handleSendForApproval}
              disabled={!selectedId || sendingApproval}
              title="Select a record, then send it for approval"
            >
              <Send size={13} strokeWidth={2.5} />
              {sendingApproval ? "Sending…" : "Approval Initiator"}
            </button>
          )}
        </ListPanelHeader>

        <EnterpriseDataGrid
          ref={gridRef}
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading Assets Employee Return records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Employee Return records found."
          hideHeader
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          deleteProcName={AER_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
          selectable
          singleSelect
          selectedRowKeys={selectedId != null ? [String(selectedId)] : []}
          onSelectionChange={(keys) => setSelectedId(keys[0] != null ? keys[0] : null)}
          getRowKey={(row) => String(resolveListRowId(row) ?? "")}
          getRowState={getRowState}
        />
      </section>
    </div>
  );
}
