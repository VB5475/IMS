import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Package, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { DEFAULT_SESSION_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useItemMaster } from "../../hooks/useItemMaster";
import { formatTranDate } from "../../utils/dateFormat";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import ItemMasterForm from "./ItemMasterForm";
import { IM_CONFIG } from "./constants";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import "./ItemMasterPage.css";

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
    fetchMainGroupOptions,
    fetchSubMainGroupOptions,
    fetchSubGroupLevelOptions,
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
    () =>
      buildListColumnsFromApi({
        data,
        fieldDefs,
        onEdit: handleEdit,
        renderEditCell: (row, onEdit) => (
          <button
            type="button"
            className="im-list__edit-btn"
            title={`Edit ${row.itemcode ?? row.itemname ?? ""}`}
            aria-label={`Edit ${row.itemcode ?? row.itemname ?? ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(row);
            }}
          >
            <Pencil size={13} strokeWidth={2} />
          </button>
        ),
      }),
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
            <button type="button" className="im-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} /> Add New
            </button>
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
      />
    </div>
  );
}
