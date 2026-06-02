import React, { useState, useEffect, useMemo } from 'react';

import { useNavigate } from 'react-router-dom';

import { FileText, ExternalLink } from 'lucide-react';

import EnterpriseDataGrid from '../grid/EnterpriseDataGrid';

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



export default function ReportBoardPanel({

  compact = false,

  showViewAll = false,

  showPanelHeader = true,

  fill = compact,

}) {

  const [data, setData] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  const navigate = useNavigate();



  const pageSizeOptions = useMemo(

    () => (compact ? PAGE_SIZE_OPTIONS.compact : PAGE_SIZE_OPTIONS.default),

    [compact],

  );

  const [pageSize, setPageSize] = useState(() => (compact ? 8 : 10));



  useEffect(() => {

    setPageSize(compact ? 8 : 10);

  }, [compact]);



  useEffect(() => {

    const fetchData = async () => {

      try {

        setLoading(true);

        const response = await fetch(

          'http://122.179.135.100:8095/ERPWS_TB/webservice/WsIMS.asmx/FN_Fetch_Data' +

            '?ObjType=2&ObjName=Fn_tbl_FetchReportBoardSummaryUserWise' +

            '&JSon=[%20{%20%22prmUserID%22%20%3A%201%2C%20%22prmSubDesgID%22%20%3A%200%2C' +

            '%20%22prmOnDate%22%20%3A%20%222026-05-25T00%3A00%3A00%22%20}%20]' +

            '&p_ErrCode=-1&p_ErrMsg=%22%22',

        );

        if (!response.ok) throw new Error('Network response was not ok');

        const jsonData = await response.json();

        const processedData = (jsonData?.Table || []).map((row) => ({

          ...row,

          Team: row.Team || 'Default Team',

        }));

        setData(processedData);

      } catch (err) {

        console.error('Error fetching ReportList data:', err);

        setError('Failed to load reports.');

      } finally {

        setLoading(false);

      }

    };

    fetchData();

  }, []);



  return (

    <div className={`rbp-panel ${fill ? 'rbp-panel--fill' : ''} ${compact ? 'rbp-panel--compact' : ''}`}>

      <div className={`rbp-panel__header ${!showPanelHeader ? 'rbp-panel__header--toolbar-only' : ''}`}>

        {showPanelHeader && (

          <div className="rbp-panel__title-row">

            <FileText size={14} strokeWidth={2} />

            <span>Report Boards</span>

          </div>

        )}

        <div className="rbp-panel__header-actions">

          <div className="rbp-page-size">

            <label htmlFor="rbp-page-size">Rows per page</label>

            <select

              id="rbp-page-size"

              className="rbp-page-size__select"

              value={pageSize}

              onChange={(e) => setPageSize(Number(e.target.value))}

              aria-label="Rows per page"

            >

              {pageSizeOptions.map((n) => (

                <option key={n} value={n}>{n}</option>

              ))}

            </select>

          </div>

          {showViewAll && showPanelHeader && (

            <button type="button" className="rbp-panel__link" onClick={() => navigate('/')}>

              View All <ExternalLink size={12} />

            </button>

          )}

        </div>

      </div>

      <EnterpriseDataGrid

        title=""

        columns={REPORT_COLUMNS}

        data={data}

        loading={loading}

        error={error}

        onRowClick={(row) => navigate(`/main/${row.ReportBoardID}`)}

        loaderText="Loading Reports…"

        pageSize={pageSize}

        onPageSizeChange={setPageSize}

        pageSizeOptions={pageSizeOptions}

        emptyMessage="No reports found."

        hideHeader

        fill={fill}

      />

    </div>

  );

}

