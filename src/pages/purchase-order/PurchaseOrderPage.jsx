// PurchaseOrderPage.jsx
// Purchase Order listing / landing page.
// Clicking Add New → /purchase-order/new (PurchaseOrderForm in new mode)
// Clicking Edit   → /purchase-order/:id/edit (PurchaseOrderForm in edit mode)

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Send } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, OBJ_TYPE } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useNotification } from "../../context/NotificationContext";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { resolveListRowId } from "../../utils/listColumns";
import { resolveRowFieldValue } from "../../utils/gridUtils";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { useApprovalRowStatus } from "../../hooks/useApprovalRowStatus";
import { PO_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./PurchaseOrderPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

// PO's report SP takes its own param casing (@prmCompanyID/@prmloginID), not
// the shared lowercase @prmcompanyid used by buildCompanyReportParam — don't
// reuse that helper here. Print only ever runs against a selected row (2026-08-17
// /pm — the earlier "no selection = print full list" fallback was removed;
// PurchaseOrderPage's handlePrintParams now blocks + notifies instead).
function buildPurchaseOrderReportParams(selectedId) {
  const session = getUserSession();
  return [
    { paramtitle: "ID", paramname: "@prmidnumber", paramval: String(selectedId), paramtext: String(selectedId) },
    { paramtitle: "Company", paramname: "@prmCompanyID", paramval: String(session.companyId), paramtext: session.company?.companyname ?? session.company?.CompanyName ?? "" },
    { paramtitle: "Login", paramname: "@prmloginID", paramval: String(session.loginId), paramtext: session.userName ?? "" },
  ];
}

function buildListParams() {
  const year = new Date().getFullYear();
  const session = getUserSession();
  return {
    ObjType: PO_CONFIG.LIST_OBJ_TYPE,
    ObjName: PO_CONFIG.SP_PO_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId,
        prmdivisionid: PO_CONFIG.LIST_DIVISION_ID,
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

export default function PurchaseOrderPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);
  const { post: postWkf } = useApi(API_BASE_URL_IMS);
  const notify = useNotification();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedId, setSelectedId] = useState(null);
  const gridRef = useRef(null);

  // "Approval Initiator" button (WKF) — visibility is a per-login,
  // per-trantype backend flag, same pattern as the DMS "Documents" button.
  // Defaults to "NO" (safe default-deny) until the fetch resolves.
  const [wkfBtnVisible, setWkfBtnVisible] = useState("NO");
  const [sendingApproval, setSendingApproval] = useState(false);
  // The list SP returns "division" as a display NAME, not a raw id (live-
  // confirmed 2026-08-12 — no numeric divisionid field on list rows at all),
  // but Send4Approval needs prmdivisionid — fetched once here to resolve the
  // selected row's division name back to its id.
  const [divisionNameToId, setDivisionNameToId] = useState({});

  // appstatusid-driven row color + Edit/Delete lock, per src/config/approvalStatusConfig.js.
  const getRowState = useApprovalRowStatus("purchase-order");

  usePageHeader({
    title: "Purchase Orders",
    subtitle: "Browse purchase orders or create a new one.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => {
    const session = getUserSession();
    postWkf(ENDPOINTS.WKF_HANDLE_BUTTON_VISIBILITY, {
      prmref_is_trantypeid: PO_CONFIG.WKF_TRAN_TYPE_ID,
      prmloginid: session.loginId,
    })
      .then((res) => {
        const row = Array.isArray(res) ? res[0] : res;
        setWkfBtnVisible(row?.iswkfbtnvisible === "YES" ? "YES" : "NO");
      })
      .catch((err) => {
        console.warn("[PurchaseOrderPage] WKF button visibility fetch failed:", err);
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
      .catch((err) => console.warn("[PurchaseOrderPage] Division options fetch failed:", err));
  }, [postWkf, get]);

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: PO_CONFIG.ROUTE_PATH,
        editBtnClass: "po-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[PurchaseOrderPage] list fetch failed:", err);
      setError(err?.message || "Failed to load purchase orders.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleAddNew = useCallback(() => {
    navigate(`${PO_CONFIG.ROUTE_PATH}/new`);
  }, [navigate]);

  const handlePrintParams = useCallback(() => {
    if (selectedId == null) {
      notify.error("Select the row to Print.");
      return null;
    }
    return buildPurchaseOrderReportParams(selectedId);
  }, [selectedId, notify]);

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Purchase_Orders_export.csv");
  }, []);

  const handleSendForApproval = useCallback(async () => {
    if (!selectedId) {
      notify.error("Select a purchase order before sending it for approval.");
      return;
    }
    const row = data.find((r) => String(resolveListRowId(r)) === String(selectedId));
    const divisionName = row ? String(resolveRowFieldValue(row, "division") ?? "").trim().toLowerCase() : "";
    const divisionId = divisionNameToId[divisionName];
    if (!divisionId) {
      notify.error("Could not resolve the division for the selected purchase order. Refresh and try again.");
      return;
    }
    const session = getUserSession();
    setSendingApproval(true);
    try {
      const result = await postWkf(ENDPOINTS.WKF_SEND_FOR_APPROVAL, {
        prmref_is_trantypeid: PO_CONFIG.WKF_TRAN_TYPE_ID,
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
      console.error("[PurchaseOrderPage] Send for approval failed:", err);
      notify.error(err?.message || "Failed to send for approval. Please try again.");
    } finally {
      setSendingApproval(false);
    }
  }, [selectedId, data, divisionNameToId, postWkf, notify]);

  return (
    <div className="workspace-page po-list-page">
      <section className="po-list-panel po-list-panel--compact po-list-panel--fill">
        <ListPanelHeader
          icon={ShoppingCart}
          title="Purchase Orders"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchOrders}
          refreshing={loading}
          print={{
            ...PRINT_REPORT_CONFIG["purchase-order"],
            buildParams: handlePrintParams,
          }}
          onExportCsv={handleExportCsv}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        >
          {wkfBtnVisible === "YES" && (
            <button
              type="button"
              className="po-list__wkf-btn"
              onClick={handleSendForApproval}
              disabled={!selectedId || sendingApproval}
              title="Select a purchase order, then send it for approval"
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
          loaderText="Loading purchase orders…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No purchase orders found."
          hideHeader
          searchable
          deleteProcName={PO_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchOrders}
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
