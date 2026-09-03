import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Send } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, OBJ_TYPE } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useNotification } from "../../context/NotificationContext";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { resolveListRowId } from "../../utils/listColumns";
import { resolveRowFieldValue } from "../../utils/gridUtils";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { useApprovalRowStatus } from "../../hooks/useApprovalRowStatus";
import { QTN_CONFIG, formatTranDate, ENTRY_FORM_LABEL } from "./constants";
import "./PurchaseQuotationPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

function buildPurchaseQuotationReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListDateRange() {
  const now = new Date();
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    prmfromdate: formatTranDate(`${fyStartYear}-04-01`),
    prmtodate: formatTranDate(`${fyStartYear + 1}-03-31`),
  };
}

function buildListParams() {
  const session = getUserSession();
  return {
    ObjType: QTN_CONFIG.LIST_OBJ_TYPE,
    ObjName: QTN_CONFIG.SP_QUOTATION_LIST,
    JSon: JSON.stringify([
      {
        // ...buildListDateRange(),
        prmcompanyid: session.companyId,
        prmdivisionid: 0,
        prmyearid: session.yearId,
        ...buildListDateRange(),
        prmloginid: session.loginId,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function PurchaseQuotationPage() {
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
  // per-trantype backend flag, same pattern as Purchase Order's.
  // Defaults to "NO" (safe default-deny) until the fetch resolves.
  const [wkfBtnVisible, setWkfBtnVisible] = useState("NO");
  const [sendingApproval, setSendingApproval] = useState(false);
  // The list SP may only return "division" as a display NAME, not a raw id
  // (confirmed true for Purchase Order's own list SP) — fetched once here to
  // resolve the selected row's division name back to its id, used only as a
  // fallback when the row has no direct numeric divisionid of its own.
  const [divisionNameToId, setDivisionNameToId] = useState({});

  // appstatusid-driven row color + Edit/Delete lock, per src/config/approvalStatusConfig.js.
  const getRowState = useApprovalRowStatus("purchase-quotation");

  usePageHeader({
    title: "Purchase Quotation",
    subtitle: "Browse purchase quotations or create a new one.",
  });

  useEffect(() => {
    const session = getUserSession();
    postWkf(ENDPOINTS.WKF_HANDLE_BUTTON_VISIBILITY, {
      prmref_is_trantypeid: QTN_CONFIG.WKF_TRAN_TYPE_ID,
      prmloginid: session.loginId,
    })
      .then((res) => {
        const row = Array.isArray(res) ? res[0] : res;
        setWkfBtnVisible(row?.iswkfbtnvisible === "YES" ? "YES" : "NO");
      })
      .catch((err) => {
        console.warn("[PurchaseQuotationPage] WKF button visibility fetch failed:", err);
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
      .catch((err) => console.warn("[PurchaseQuotationPage] Division options fetch failed:", err));
  }, [postWkf, get]);

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: QTN_CONFIG.ROUTE_PATH,
        editBtnClass: "pq-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[PurchaseQuotationPage] list fetch failed:", err);
      setError(err?.message || "Failed to load purchase quotations.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const handleAddNew = useCallback(() => {
    navigate(`${QTN_CONFIG.ROUTE_PATH}/new`);
  }, [navigate]);

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Purchase_Quotations_export.csv");
  }, []);

  const handleSendForApproval = useCallback(async () => {
    if (!selectedId) {
      notify.error("Select a purchase quotation before sending it for approval.");
      return;
    }
    const row = data.find((r) => String(resolveListRowId(r)) === String(selectedId));

    // Prefer a direct numeric divisionid on the row itself; only fall back to
    // the name→id lookup (needed for Purchase Order, whose list SP has no raw
    // id) if the row doesn't carry one.
    const directDivisionId = Number(resolveRowFieldValue(row, "divisionid"));
    let divisionId = Number.isFinite(directDivisionId) && directDivisionId > 0 ? directDivisionId : null;
    if (!divisionId) {
      const divisionName = row ? String(resolveRowFieldValue(row, "division") ?? "").trim().toLowerCase() : "";
      divisionId = divisionNameToId[divisionName];
    }
    if (!divisionId) {
      notify.error("Could not resolve the division for the selected purchase quotation. Refresh and try again.");
      return;
    }

    const session = getUserSession();
    setSendingApproval(true);
    try {
      const result = await postWkf(ENDPOINTS.WKF_SEND_FOR_APPROVAL, {
        prmref_is_trantypeid: QTN_CONFIG.WKF_TRAN_TYPE_ID,
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
      console.error("[PurchaseQuotationPage] Send for approval failed:", err);
      notify.error(err?.message || "Failed to send for approval. Please try again.");
    } finally {
      setSendingApproval(false);
    }
  }, [selectedId, data, divisionNameToId, postWkf, notify]);

  return (
    <div className="workspace-page pq-list-page">
      <section className="pq-list-panel pq-list-panel--compact pq-list-panel--fill">
        <ListPanelHeader
          icon={ClipboardList}
          title="Purchase Quotations"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchQuotations}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
          print={{
            ...PRINT_REPORT_CONFIG["purchase-quotation"],
            buildParams: buildPurchaseQuotationReportParams,
          }}
          onExportCsv={handleExportCsv}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        >
          {wkfBtnVisible === "YES" && (
            <button
              type="button"
              className="pq-list__wkf-btn"
              onClick={handleSendForApproval}
              disabled={!selectedId || sendingApproval}
              title="Select a purchase quotation, then send it for approval"
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
          loaderText="Loading quotations…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No purchase quotations found."
          hideHeader
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          deleteProcName={QTN_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchQuotations}
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
