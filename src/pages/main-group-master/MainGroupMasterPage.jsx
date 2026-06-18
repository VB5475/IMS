import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Plus, Edit2 } from "lucide-react";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
} from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { MGM_CONFIG } from "./constants";
import "./MainGroupMasterPage.css";

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function todayFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

function buildListParams() {
  const today = todayFormatted();
  return {
    ObjType: MGM_CONFIG.LIST_OBJ_TYPE,
    ObjName: MGM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      PrmCompanyID:  DEFAULT_COMPANY_ID,
      prmDivisionID: MGM_CONFIG.LIST_DIVISION_ID,
      prmFromDate:   today,
      prmToDate:     today,
    }]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

export default function MainGroupMasterPage() {
  const navigate    = useNavigate();
  const { get }     = useApi(API_BASE_URL);
  const [rows,      setRows]      = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState(null);
  const [pageSize,  setPageSize]  = useState(20);

  usePageHeader({
    title:    "Main Group Master",
    subtitle: "Admin › Master › Item",
  });

  const loadList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setRows(res?.Table || res?.Links || []);
    } catch (err) {
      console.error("[MGM] List fetch failed:", err);
      setError(err?.message || "Failed to load Main Group list.");
    } finally {
      setIsLoading(false);
    }
  }, [get]);

  useEffect(() => { loadList(); }, [loadList]);

  const visibleRows = rows.slice(0, pageSize);

  return (
    <div className="mgm-list-page">
      <div className="mgm-list-panel mgm-list-panel--fill">

        <div className="mgm-list-panel__header">
          <span className="mgm-list-panel__title">Main Group Master</span>
          <div className="mgm-list-panel__toolbar">
            <label className="mgm-list-panel__pagesize-label">Rows:</label>
            <select
              className="mgm-list-panel__pagesize-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button
              type="button"
              className="mgm-list-panel__add-btn"
              onClick={() => navigate("/admin/main-group-master/new")}
            >
              <Plus size={13} /> New
            </button>
          </div>
        </div>

        {isLoading && <div className="mgm-list-loading">Loading…</div>}

        {error && (
          <div className="mgm-list-error">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {!isLoading && !error && (
          <div className="mgm-list-table-wrap">
            <table className="mgm-list-table">
              <thead>
                <tr>
                  <th>Item Type</th>
                  <th>Main Group Code</th>
                  <th>Main Group Name</th>
                  <th>Short Code</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="mgm-list-empty">No records found.</td>
                  </tr>
                ) : (
                  visibleRows.map((row, idx) => (
                    <tr key={row.IDNumber ?? idx}>
                      <td>{row.ItemTypeName ?? row.ItemTypeID ?? "—"}</td>
                      <td>{row.MainGroupCode ?? "—"}</td>
                      <td>{row.MainGroupName ?? "—"}</td>
                      <td>{row.MainGroupShortCode ?? "—"}</td>
                      <td>
                        <button
                          type="button"
                          className="mgm-list__edit-btn"
                          title="Edit"
                          onClick={() => navigate(`/admin/main-group-master/${row.IDNumber}/edit`)}
                        >
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
