import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Package, Send } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, OBJ_TYPE, DEFAULT_SESSION_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useNotification } from "../../context/NotificationContext";
import { useItemMaster } from "../../hooks/useItemMaster";
import { useMainGroupMaster } from "../../hooks/useMainGroupMaster";
import { useSubMainGroupMaster } from "../../hooks/useSubMainGroupMaster";
import { useSubGroupMaster } from "../../hooks/useSubGroupMaster";
import { useApprovalRowStatus } from "../../hooks/useApprovalRowStatus";
import { formatTranDate } from "../../utils/dateFormat";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import { createListActionsColumn } from "../../utils/listGridUtils";
import { resolveRowFieldValue } from "../../utils/gridUtils";
import { parseApiErrMsg } from "../../utils/apiResponse";
import ItemMasterForm from "./ItemMasterForm";
import MainGroupMasterForm from "../main-group-master/MainGroupMasterForm";
import SubMainGroupMasterForm from "../sub-main-group-master/SubMainGroupMasterForm";
import SubGroupMasterForm from "../sub-group-master/SubGroupMasterForm";
import { IM_CONFIG } from "./constants";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import "./ItemMasterPage.css";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

// prmisactive is always "1" (active only) — confirmed business rule, not a
// live filter value: this list page has no Active/Inactive toggle to read from.
function buildItemMasterReportParams(selectedId) {
  const params = [
    buildCompanyReportParam(),
    { paramtitle: "Is Active", paramname: "@prmisactive", paramval: "1", paramtext: "Active" },
  ];
  return params;
}

function buildListParams() {
  const today = formatTranDate(new Date(), { invalidValue: "" });
  const session = getUserSession();
  return {
    ObjType: IM_CONFIG.LIST_OBJ_TYPE,
    ObjName: IM_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId,
        prmdivisionid: IM_CONFIG.LIST_DIVISION_ID,
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

export default function ItemMasterPage() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);
  const { post: postWkf } = useApi(API_BASE_URL_IMS);
  const notify = useNotification();

  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs,
    allColumns,
    headerFetching,
    headerError,
    itemTypeOptions,
    mainGroupOptions,
    subMainGroupOptions,
    subGroupOptions,
    taxOptions,
    tranUnitOptions,
    baseUnitOptions,
    fetchEditRecord,
    fetchListRows,
    fetchItemTypeOptions,
    fetchMainGroupOptions,
    fetchSubMainGroupOptions,
    fetchSubGroupLevelOptions,
    fetchStaticDropdowns,
    seedOptionsFromMaster,
  } = useItemMaster();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStats, setSearchStats] = useState({ matchCount: 0, totalCount: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const gridRef = useRef(null);

  // "Approval Initiator" button (WKF) — visibility is a per-login,
  // per-trantype backend flag, same pattern as Purchase Order/Purchase
  // Quotation's. Defaults to "NO" (safe default-deny) until the fetch resolves.
  const [wkfBtnVisible, setWkfBtnVisible] = useState("NO");
  const [sendingApproval, setSendingApproval] = useState(false);

  // The division this page actually uses everywhere it needs one (currently
  // just the WKF send — the list fetch below has its own prmdivisionid line
  // commented out, unrelated to this) — resolved dynamically from the
  // logged-in user's own real division(s) via fn_tbl_fetchuserwsdivision
  // (same SP/pattern PQ, PO, Purchase Indent, CWIP To FA etc. all already
  // use), 2026-08-27 /pm. IM_CONFIG.LIST_DIVISION_ID stays as the seed/
  // fallback value.
  const [effectiveDivisionId, setEffectiveDivisionId] = useState(IM_CONFIG.LIST_DIVISION_ID);

  // AppStatusID-driven row color + Edit/Delete lock, per src/config/approvalStatusConfig.js.
  const getRowState = useApprovalRowStatus("item-master");

  useEffect(() => {
    const session = getUserSession();
    postWkf(ENDPOINTS.WKF_HANDLE_BUTTON_VISIBILITY, {
      prmref_is_trantypeid: IM_CONFIG.WKF_TRAN_TYPE_ID,
      prmloginid: session.loginId,
    })
      .then((res) => {
        const row = Array.isArray(res) ? res[0] : res;
        setWkfBtnVisible(row?.iswkfbtnvisible === "YES" ? "YES" : "NO");
      })
      .catch((err) => {
        console.warn("[ItemMasterPage] WKF button visibility fetch failed:", err);
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
        const first = (rows || [])[0];
        const id = first ? resolveRowFieldValue(first, "divisionid") : null;
        if (id != null) setEffectiveDivisionId(Number(id));
      })
      .catch((err) => console.warn("[ItemMasterPage] User division fetch failed:", err));
  }, [postWkf, get]);

  // Item Master's list rows carry no per-row division field (confirmed live —
  // company-wide admin master; its own list call sends no division param at
  // all) — effectiveDivisionId (the resolved user division, see above) is
  // the only "division" this module has.
  const handleSendForApproval = useCallback(async () => {
    if (!selectedId) {
      notify.error("Select an item before sending it for approval.");
      return;
    }
    const session = getUserSession();
    setSendingApproval(true);
    try {
      const result = await postWkf(ENDPOINTS.WKF_SEND_FOR_APPROVAL, {
        prmref_is_trantypeid: IM_CONFIG.WKF_TRAN_TYPE_ID,
        prmtranid: Number(selectedId),
        prmcolnamesoftranid: "idnumber",
        prmyearid: session.yearId,
        prmloginid: session.loginId,
        prmdivisionid: effectiveDivisionId,
      });
      const { success, message } = parseApiErrMsg(result);
      if (!success) { notify.error(message); return; }
      notify.success(message);
    } catch (err) {
      console.error("[ItemMasterPage] Send for approval failed:", err);
      notify.error(err?.message || "Failed to send for approval. Please try again.");
    } finally {
      setSendingApproval(false);
    }
  }, [selectedId, effectiveDivisionId, postWkf, notify]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editPrefill, setEditPrefill] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editLoadError, setEditLoadError] = useState(null);

  // Quick-add sources for Main Group / Sub Main Group / Sub Group dropdowns —
  // each master module owns its own metadata; fetched lazily the first time
  // its "+" is used. Item Type / Taxability / Tran Unit / Base Unit have no
  // master module yet, so they only get a refresh icon (see ItemMasterForm).
  const mainGroupMaster = useMainGroupMaster();
  const subMainGroupMaster = useSubMainGroupMaster();
  const subGroupMaster = useSubGroupMaster();
  const [mainGroupMetaLoaded, setMainGroupMetaLoaded] = useState(false);
  const [subMainGroupMetaLoaded, setSubMainGroupMetaLoaded] = useState(false);
  const [subGroupMetaLoaded, setSubGroupMetaLoaded] = useState(false);
  const [mainGroupQuickAddOpen, setMainGroupQuickAddOpen] = useState(false);
  const [subMainGroupQuickAddOpen, setSubMainGroupQuickAddOpen] = useState(false);
  const [subGroupQuickAddOpen, setSubGroupQuickAddOpen] = useState(false);
  // Cascade context captured when a quick-add opens, so the right dropdown
  // level gets refreshed on save regardless of what's selected by then.
  const mainGroupQuickAddCtxRef = useRef(0);
  const subMainGroupQuickAddCtxRef = useRef({ itemTypeId: 0, mainGroupId: 0 });
  const subGroupQuickAddCtxRef = useRef({ itemTypeId: 0, mainGroupId: 0, subMainGroupId: 0 });

  usePageHeader({
    title: "Item Master",
    subtitle: "Browse items or create a new inventory item.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => {
    fetchHeaderMeta();
  }, [fetchHeaderMeta]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchListRows(buildListParams());
      setData(rows);
    } catch (err) {
      console.error("[IM] List fetch failed:", err);
      setError("Failed to load Item Master list.");
    } finally {
      setLoading(false);
    }
  }, [fetchListRows]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleItemTypeChange = useCallback(
    (itemTypeId) => { fetchMainGroupOptions(itemTypeId); },
    [fetchMainGroupOptions]
  );

  const handleMainGroupChange = useCallback(
    ({ itemTypeId, mainGroupId }) => { fetchSubMainGroupOptions({ itemTypeId, mainGroupId }); },
    [fetchSubMainGroupOptions]
  );

  const handleSubMainGroupChange = useCallback(
    ({ itemTypeId, mainGroupId, subMainGroupId }) => {
      fetchSubGroupLevelOptions({ itemTypeId, mainGroupId, subMainGroupId });
    },
    [fetchSubGroupLevelOptions]
  );

  // ── Dropdown refresh (re-fetch options for the current cascade context) ──
  const handleRefreshItemType = useCallback(() => {
    fetchItemTypeOptions();
  }, [fetchItemTypeOptions]);

  const handleRefreshMainGroup = useCallback(
    (itemTypeId) => { fetchMainGroupOptions(itemTypeId); },
    [fetchMainGroupOptions]
  );

  const handleRefreshSubMainGroup = useCallback(
    ({ itemTypeId, mainGroupId }) => { fetchSubMainGroupOptions({ itemTypeId, mainGroupId }); },
    [fetchSubMainGroupOptions]
  );

  const handleRefreshSubGroup = useCallback(
    ({ itemTypeId, mainGroupId, subMainGroupId }) => {
      fetchSubGroupLevelOptions({ itemTypeId, mainGroupId, subMainGroupId });
    },
    [fetchSubGroupLevelOptions]
  );

  const handleRefreshStatic = useCallback(() => {
    fetchStaticDropdowns();
  }, [fetchStaticDropdowns]);

  // ── Quick-add (open another master's own form inline, refresh on save) ──
  const handleOpenMainGroupQuickAdd = useCallback(
    (itemTypeId) => {
      mainGroupQuickAddCtxRef.current = itemTypeId;
      if (!mainGroupMetaLoaded) {
        mainGroupMaster.fetchHeaderMeta();
        setMainGroupMetaLoaded(true);
      }
      setMainGroupQuickAddOpen(true);
    },
    [mainGroupMetaLoaded, mainGroupMaster]
  );

  const handleMainGroupQuickAddSaved = useCallback(() => {
    setMainGroupQuickAddOpen(false);
    fetchMainGroupOptions(mainGroupQuickAddCtxRef.current);
  }, [fetchMainGroupOptions]);

  const handleOpenSubMainGroupQuickAdd = useCallback(
    (ctx) => {
      subMainGroupQuickAddCtxRef.current = ctx;
      if (!subMainGroupMetaLoaded) {
        subMainGroupMaster.fetchHeaderMeta();
        setSubMainGroupMetaLoaded(true);
      }
      setSubMainGroupQuickAddOpen(true);
    },
    [subMainGroupMetaLoaded, subMainGroupMaster]
  );

  const handleSubMainGroupQuickAddSaved = useCallback(() => {
    setSubMainGroupQuickAddOpen(false);
    fetchSubMainGroupOptions(subMainGroupQuickAddCtxRef.current);
  }, [fetchSubMainGroupOptions]);

  const handleOpenSubGroupQuickAdd = useCallback(
    (ctx) => {
      subGroupQuickAddCtxRef.current = ctx;
      if (!subGroupMetaLoaded) {
        subGroupMaster.fetchHeaderMeta();
        setSubGroupMetaLoaded(true);
      }
      setSubGroupQuickAddOpen(true);
    },
    [subGroupMetaLoaded, subGroupMaster]
  );

  const handleSubGroupQuickAddSaved = useCallback(() => {
    setSubGroupQuickAddOpen(false);
    fetchSubGroupLevelOptions(subGroupQuickAddCtxRef.current);
  }, [fetchSubGroupLevelOptions]);

  const handleAddNew = useCallback(() => {
    setModalMode("add");
    setEditPrefill(null);
    setEditLoadError(null);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback(
    async (row) => {
      const idNumber = resolveListRowId(row);
      setModalMode("edit");
      setEditPrefill(null);
      setEditLoadError(null);
      setModalOpen(true);
      setEditLoading(true);

      try {
        const session = getUserSession();
        const result = await fetchEditRecord({
          companyId: session.companyId,
          yearId: session.yearId,
          loginId: session.loginId,
          sessionId: DEFAULT_SESSION_ID,
          idNumber,
        });

        if (!result.master || !result.headerValues) {
          setEditLoadError("Record not found.");
          return;
        }

        seedOptionsFromMaster(result.master);
        const { itemtypeid, maingroupid, submaingroupid } = result.headerValues;
        await Promise.all([
          fetchMainGroupOptions(itemtypeid),
          fetchSubMainGroupOptions({ itemTypeId: itemtypeid, mainGroupId: maingroupid }),
          fetchSubGroupLevelOptions({
            itemTypeId: itemtypeid,
            mainGroupId: maingroupid,
            subMainGroupId: submaingroupid,
          }),
        ]);
        setEditPrefill(result);
      } catch (err) {
        setEditLoadError(err?.message || "Failed to load record.");
      } finally {
        setEditLoading(false);
      }
    },
    [
      fetchEditRecord,
      seedOptionsFromMaster,
      fetchMainGroupOptions,
      fetchSubMainGroupOptions,
      fetchSubGroupLevelOptions,
    ]
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditPrefill(null);
    setEditLoadError(null);
  }, []);

  const handleSaved = useCallback(() => {
    handleCloseModal();
    fetchList();
  }, [fetchList, handleCloseModal]);

  const handlePrintParams = useCallback(
    () => buildItemMasterReportParams(selectedId),
    [selectedId]
  );

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Item_Master_export.csv");
  }, []);

  const columns = useMemo(
    () => [
      ...buildListColumnsFromApi({ data, fieldDefs }),
      createListActionsColumn({
        onEdit: handleEdit,
        getEditLabel: (row) => row.itemcode ?? row.itemname ?? "",
        getDeleteLabel: (row) => row.itemcode ?? row.itemname ?? "",
      }),
    ],
    [data, fieldDefs, handleEdit]
  );

  return (
    <div className="workspace-page im-list-page">
      <section className="im-list-panel im-list-panel--fill">
        <ListPanelHeader
          icon={Package}
          title="Item Master"
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
          print={{
            ...PRINT_REPORT_CONFIG["item-master"],
            buildParams: handlePrintParams,
          }}
          onExportCsv={handleExportCsv}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        >
          {wkfBtnVisible === "YES" && (
            <button
              type="button"
              className="im-list__wkf-btn"
              onClick={handleSendForApproval}
              disabled={!selectedId || sendingApproval}
              title="Select an item, then send it for approval"
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
          loaderText="Loading items…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No items found."
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          hideHeader
          deleteProcName={IM_CONFIG.DELETE_PROC_NAME}
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

      <ItemMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        onClose={handleCloseModal}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        allColumns={allColumns}
        defsLoading={headerFetching}
        defsError={headerError}
        itemTypeOptions={itemTypeOptions}
        mainGroupOptions={mainGroupOptions}
        subMainGroupOptions={subMainGroupOptions}
        subGroupOptions={subGroupOptions}
        taxOptions={taxOptions}
        tranUnitOptions={tranUnitOptions}
        baseUnitOptions={baseUnitOptions}
        editPrefill={editPrefill}
        recordLoading={editLoading}
        recordLoadError={editLoadError}
        onItemTypeChange={handleItemTypeChange}
        onMainGroupChange={handleMainGroupChange}
        onSubMainGroupChange={handleSubMainGroupChange}
        onRefreshItemType={handleRefreshItemType}
        onRefreshMainGroup={handleRefreshMainGroup}
        onRefreshSubMainGroup={handleRefreshSubMainGroup}
        onRefreshSubGroup={handleRefreshSubGroup}
        onRefreshStatic={handleRefreshStatic}
        onQuickAddMainGroup={handleOpenMainGroupQuickAdd}
        onQuickAddSubMainGroup={handleOpenSubMainGroupQuickAdd}
        onQuickAddSubGroup={handleOpenSubGroupQuickAdd}
      />

      <MainGroupMasterForm
        isOpen={mainGroupQuickAddOpen}
        mode="add"
        recordId={null}
        onClose={() => setMainGroupQuickAddOpen(false)}
        onSaved={handleMainGroupQuickAddSaved}
        fieldDefs={mainGroupMaster.headerColumns}
        allColumns={mainGroupMaster.allColumns}
        defsLoading={mainGroupMaster.headerFetching}
        defsError={mainGroupMaster.headerError}
        itemTypeOptions={mainGroupMaster.itemTypeOptions}
        fixedAssetAccOptions={mainGroupMaster.fixedAssetAccOptions}
        fetchEditRecord={mainGroupMaster.fetchEditRecord}
        seedOptionsFromMaster={mainGroupMaster.seedOptionsFromMaster}
      />

      <SubMainGroupMasterForm
        isOpen={subMainGroupQuickAddOpen}
        mode="add"
        recordId={null}
        onClose={() => setSubMainGroupQuickAddOpen(false)}
        onSaved={handleSubMainGroupQuickAddSaved}
        fieldDefs={subMainGroupMaster.headerColumns}
        allColumns={subMainGroupMaster.allColumns}
        defsLoading={subMainGroupMaster.headerFetching}
        defsError={subMainGroupMaster.headerError}
        itemTypeOptions={subMainGroupMaster.itemTypeOptions}
        mainGroupOptions={subMainGroupMaster.mainGroupOptions}
        mainGroupLoading={subMainGroupMaster.mainGroupLoading}
        fixedAssetAccOptions={subMainGroupMaster.fixedAssetAccOptions}
        fetchMainGroupByItemType={subMainGroupMaster.fetchMainGroupByItemType}
        fetchEditRecord={subMainGroupMaster.fetchEditRecord}
        seedOptionsFromMaster={subMainGroupMaster.seedOptionsFromMaster}
      />

      <SubGroupMasterForm
        isOpen={subGroupQuickAddOpen}
        mode="add"
        recordId={null}
        onClose={() => setSubGroupQuickAddOpen(false)}
        onSaved={handleSubGroupQuickAddSaved}
        fieldDefs={subGroupMaster.headerColumns}
        allColumns={subGroupMaster.allColumns}
        defsLoading={subGroupMaster.headerFetching}
        defsError={subGroupMaster.headerError}
        fetchEditRecord={subGroupMaster.fetchEditRecord}
      />
    </div>
  );
}
