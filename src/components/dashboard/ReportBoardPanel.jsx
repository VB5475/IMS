import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import EnterpriseDataGrid from '../grid/EnterpriseDataGrid';
import { useApi } from '../../api/useApi';
import { ENDPOINTS, API_BASE_URL_OLD } from '../../api/constants';
import { DASHBOARD_CONFIG } from '../../pages/dashboard/constants';
import './ReportBoardPanel.css';

const REPORT_COLUMNS = [
  {
    key: 'ReportBoardName',
    label: 'Board Name',
    width: '36%',
    filterable: true,
    isLink: true,
  },
  {
    key: 'Overdue',
    label: 'Over Due',
    width: '14%',
    badge: (value) => (value > 0 ? 'danger' : 'neutral'),
  },
  {
    key: 'ShortTerm',
    label: 'Short Term',
    width: '14%',
    badge: (value) => (value > 0 ? 'warning' : 'neutral'),
  },
  {
    key: 'LongTerm',
    label: 'Long Term',
    width: '14%',
    badge: (value) => (value > 0 ? 'success' : 'neutral'),
  },
  {
    key: 'Team',
    label: 'Team',
    width: '22%',
    filterable: true,
    align: 'left',
  },
];

const PAGE_SIZE_OPTIONS = {
  compact: [5, 8, 10, 15, 20],
  default: [5, 10, 20, 50, 99],
};

function buildReportBoardParams() {
  return {
    ObjType: DASHBOARD_CONFIG.REPORT_OBJ_TYPE,
    ObjName: DASHBOARD_CONFIG.SP_REPORT_BOARDS,
    JSon: JSON.stringify([
      {
        prmUserID: DASHBOARD_CONFIG.LOGIN_ID,
        prmSubDesgID: DASHBOARD_CONFIG.DEFAULT_SUB_DESG_ID,
        prmOnDate: '2026-05-25T00:00:00',
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: '',
  };
}

export default function ReportBoardPanel({ compact = false, fill = compact }) {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL_OLD);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pageSizeOptions = useMemo(
    () => (compact ? PAGE_SIZE_OPTIONS.compact : PAGE_SIZE_OPTIONS.default),
    [compact],
  );
  const [pageSize, setPageSize] = useState(() => (compact ? 8 : 10));

  useEffect(() => {
    setPageSize(compact ? 8 : 10);
  }, [compact]);

  const fetchReportBoards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildReportBoardParams());
      const rows = (json?.Table || []).map((row) => ({
        ...row,
        Team: row.Team || 'Default Team',
      }));
      setData(rows);
    } catch (err) {
      console.error('[ReportBoardPanel] fetch failed:', err);
      setError('Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchReportBoards();
  }, [fetchReportBoards]);

  const handleRowClick = useCallback(
    (row) => navigate(`/main/${row.ReportBoardID}`),
    [navigate],
  );

  return (
    <section
      className={`rbp-panel ${fill ? 'rbp-panel--fill' : ''} ${compact ? 'rbp-panel--compact' : ''}`}
    >
      <header className="rbp-panel__header">
        <div className="rbp-panel__title">
          <FileText size={14} strokeWidth={2} />
          <span>Report Boards</span>
        </div>
        <div className="rbp-panel__toolbar">
          <label htmlFor="rbp-page-size" className="rbp-panel__pagesize-label">
            Rows per page
          </label>
          <select
            id="rbp-page-size"
            className="ng-select rbp-panel__pagesize-select"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </header>

      <EnterpriseDataGrid
        title=""
        columns={REPORT_COLUMNS}
        data={data}
        loading={loading}
        error={error}
        onRowClick={handleRowClick}
        loaderText="Loading Reports…"
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        pageSizeOptions={pageSizeOptions}
        emptyMessage="No reports found."
        hideHeader
        fill={fill}
      />
    </section>
  );
}
