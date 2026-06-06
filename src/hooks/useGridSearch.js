// useGridSearch.js — Custom hook for the Search button data pipeline
// ─────────────────────────────────────────────────────────────────────
// Orchestrates: GET_MASTER_DETAIL → GET_DETAIL_COL_DATA →
// GET_FILTER_DETAIL(cboMode="C") → GET_PARAMETERS → proc string →
// GET_MASTER_DATA_FILL → { columns, rows }
//
// All API calls go through useApi().get(endpoint, params).
// URLSearchParams serialisation is handled inside useApi — callers
// just pass a plain { key: value } object.

import { useState, useCallback } from 'react';
import { useApi } from '../api/useApi';
import { ENDPOINTS, API_BASE_URL } from '../api/constants';
import { REPORT_WORKSPACE_CONFIG } from '../pages/report-workspace/constants';
import {
  formatParamValue,
  fetchDropdownOptions,
  buildGridColumns,
} from '../utils/gridUtils';

// ── Hook ─────────────────────────────────────────────────────────────

export function useGridSearch(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [masterDetail, setMasterDetail] = useState(null);

  // ── 1. Fetch & store master detail ────────────────────────────────
  const fetchMasterDetail = useCallback(async (masterID) => {
    try {
      const data = await get(ENDPOINTS.GET_MASTER_DETAIL, { prmMasterID: masterID });
      const detail = data?.Links?.[0] || null;
      if (detail) {
        setMasterDetail(detail);
        localStorage.setItem(REPORT_WORKSPACE_CONFIG.STORAGE_MASTER_DETAIL, JSON.stringify(detail));
        console.log('%c[MasterDetail] Stored:', 'color:#6366f1;font-weight:600', detail);
      }
      return detail;
    } catch (err) {
      console.error('[MasterDetail] Failed to fetch:', err);
      return null;
    }
  }, [get]);

  // ── 2. Main search pipeline ────────────────────────────────────────
  const handleSearch = useCallback(async (filterValues, filterDefs, masterID) => {
    setIsSearching(true);
    setSearchError(null);

    try {
      // ── Step A: Column definitions ───────────────────────────────
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, { prmMasterID: masterID, prmLoginID: REPORT_WORKSPACE_CONFIG.LOGIN_ID });
      const apiColumns = colData?.Links || [];
      console.log('%c[Search] Columns:', 'color:#6366f1;font-weight:600', apiColumns.length);

      // ── Step B: Dropdown options for ColCtrlType=4 columns ──────
      const storedDetail = JSON.parse(localStorage.getItem(REPORT_WORKSPACE_CONFIG.STORAGE_MASTER_DETAIL) || '{}');
      const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, masterID, {
        funcCode: storedDetail.FuncCode || '',
        divisionID: filterValues?.DivisionID || 0,
      });

      // ── Step C: Transform to GridForm column shape ───────────────
      const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, { filterable: true, allEditable: false });
      setColumns(gridColumns);
      console.log('%c[Search] Grid columns built:', 'color:#22c55e;font-weight:600', gridColumns.length);

      // ── Step D: Procedure parameters ────────────────────────────
      const storedMaster = JSON.parse(localStorage.getItem(REPORT_WORKSPACE_CONFIG.STORAGE_MASTER_DETAIL) || '{}');
      const queryName = storedMaster.QueryName || '';

      if (!queryName) throw new Error('No QueryName found in master detail. Please reload the page.');

      const paramData = await get(ENDPOINTS.GET_PARAMETERS, { prmProcedure: queryName });
      const paramList = paramData?.Links || [];
      console.log('%c[Search] Parameters:', 'color:#6366f1;font-weight:600', paramList.length);

      // ── Step E: Build procedure call string ──────────────────────
      const paramValues = paramList.map(param => {
        const paramName = param?.PARAMETER_NAME?.trim();
        const dataType = param?.DATA_TYPE?.toLowerCase()?.trim();

        switch (paramName) {
          case '@prmCompanyID': return String(REPORT_WORKSPACE_CONFIG.COMPANY_ID);
          case '@prmYearID': return String(REPORT_WORKSPACE_CONFIG.YEAR_ID);
          case '@prmLoginID': return String(REPORT_WORKSPACE_CONFIG.LOGIN_ID);
          case '@prmSessionID': return String(REPORT_WORKSPACE_CONFIG.SESSION_ID);
          case '@prmIsRptGroupSelected': return "''";
          case '@prmRptGroupID': return "''";
        }

        const matchingFilter = (filterDefs || []).find(f => f.FilterParameterName === paramName);
        if (matchingFilter) {
          return formatParamValue(filterValues[matchingFilter.FilterColName], dataType);
        }

        return dataType === 'numeric' ? '0' : "''";
      });

      const procString = `${queryName} ${paramValues.join(',')}`;
      console.log('%c[Search] Proc string:', 'color:#f59e0b;font-weight:600', procString);

      // ── Step F: Grid row data ────────────────────────────────────
      const rowData = await get(ENDPOINTS.GET_MASTER_DATA_FILL, { prmProcedure: procString });
      const apiRows = (rowData?.Links || []).map((row, idx) => ({
        ...row,
        id: row.ObjDetID ?? row.id ?? idx + 1,
      }));

      setRows(apiRows);
      setHasSearched(true);
      console.log('%c[Search] Data loaded:', 'color:#22c55e;font-weight:600',
        `${apiRows.length} rows, ${gridColumns.length} columns`);

    } catch (err) {
      console.error('[Search] Pipeline failed:', err);
      setSearchError(err?.message || 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [get]);

  // ── 3. Save selected rows ──────────────────────────────────────────
  const saveSelectedRows = useCallback(async (selectedRows) => {
    try {
      setIsSearching(true);
      setSearchError(null);

      const storedDetail = JSON.parse(localStorage.getItem(REPORT_WORKSPACE_CONFIG.STORAGE_MASTER_DETAIL) || '{}');
      const dataSaveProcName = storedDetail.DataSaveProcName || '';

      console.log('[Save] Selected rows:', selectedRows);

      const result = await get(ENDPOINTS.RB_REPORTBOARD_DETAIL_SAVE, {
        TrackSysName: '',
        strRBSaveProcName: dataSaveProcName,
        strJson: JSON.stringify(selectedRows),
        prmErrCode: -1,
        prmErrMsg: '',
      });

      console.log('%c[Save] Response:', 'color:#22c55e;font-weight:600', result);
      alert('Saved successfully!');
    } catch (err) {
      console.error('[Save] Failed:', err);
      setSearchError(err?.message || 'Save failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [get]);

  return {
    columns,
    rows,
    isSearching,
    searchError,
    hasSearched,
    masterDetail,
    fetchMasterDetail,
    handleSearch,
    saveSelectedRows,
  };
}
