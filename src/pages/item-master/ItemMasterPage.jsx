import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Package, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
import RefreshButton from "../../components/ui/RefreshButton";
import { DEFAULT_SESSION_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useItemMaster } from "../../hooks/useItemMaster";
import { useMainGroupMaster } from "../../hooks/useMainGroupMaster";
import { useSubMainGroupMaster } from "../../hooks/useSubMainGroupMaster";
import { useSubGroupMaster } from "../../hooks/useSubGroupMaster";
import { formatTranDate } from "../../utils/dateFormat";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import { createListActionsColumn } from "../../utils/listGridUtils";
import ItemMasterForm from "./ItemMasterForm";
import MainGroupMasterForm from "../main-group-master/MainGroupMasterForm";
import SubMainGroupMasterForm from "../sub-main-group-master/SubMainGroupMasterForm";
import SubGroupMasterForm from "../sub-group-master/SubGroupMasterForm";
import { IM_CONFIG } from "./constants";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import "./ItemMasterPage.css";
import { useModuleRights } from "../../hooks/useModuleRights";

// prmisactive is always "1" (active only) — confirmed business rule, not a
// live filter value: this list page has no Active/Inactive toggle to read from.
function buildItemMasterReportParams() {
  return [
    buildCompanyReportParam(),
    { paramtitle: "Is Active", paramname: "@prmisactive", paramval: "1", paramtext: "Active" },
  ];
}

function buildListParams() {
  const today = formatTranDate(new Date(), { invalidValue: "" });
  return {
    ObjType: IM_CONFIG.LIST_OBJ_TYPE,
    ObjName: IM_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        // prmcompanyid: DEFAULT_COMPANY_ID,
        // prmdivisionid: IM_CONFIG.LIST_DIVISION_ID,
        // prmfromdate: today,
        // prmtodate: today,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function ItemMasterPage() {
  const { canInsert } = useModuleRights();
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
        <header className="im-list-panel__header">
          <div className="im-list-panel__title">
            <Package size={14} strokeWidth={2} />
            <span>Item Master</span>
          </div>
          <div className="im-list-panel__toolbar">
            {canInsert && (
              <button type="button" className="im-list-panel__add-btn" onClick={handleAddNew}>
                <Plus size={14} strokeWidth={2.5} /> Add New
              </button>
            )}
            <RefreshButton onClick={fetchList} loading={loading} />
            <PrintReportButton
              reportTitle="Item Master Report"
              reportFileName="RptPrintItems_PG.rpt"
              buildParams={buildItemMasterReportParams}
            />
            <label htmlFor="im-list-page-size" className="im-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="im-list-page-size"
              className="ng-select im-list-panel__pagesize-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
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
          loaderText="Loading items…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No items found."
          searchable
          hideHeader
          deleteProcName={IM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
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
