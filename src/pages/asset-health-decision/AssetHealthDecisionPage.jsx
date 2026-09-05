import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import GridSearch from "../../components/grid/GridSearch";
import GridRowCount from "../../components/grid/GridRowCount";
import SearchSelect from "../../components/ui/SearchSelect";
import { useApi } from "../../api/useApi";
import { API_BASE_URL, ENDPOINTS } from "../../api/constants";
import { getStoredSessionId, getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildGridColumns, toEnterpriseDataGridColumns } from "../../utils/gridUtils";
import { AHD_CONFIG } from "./constants";
import "./AssetHealthDecisionPage.css";

function resolveValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (value != null && value !== "") return value;
  }
  return fallback;
}

function resolveSessionId(sessionId) {
  const fromProp = Number(sessionId) || 0;
  if (fromProp > 0) return fromProp;
  const fromSession = Number(getUserSession()?.sessionId) || 0;
  if (fromSession > 0) return fromSession;
  return AHD_CONFIG.DEFAULT_SESSION_ID;
}

function buildFetchParams(objName, jsonRow, objType = AHD_CONFIG.OBJ_TYPE) {
  return {
    ObjType: objType,
    ObjName: objName,
    JSon: JSON.stringify([jsonRow]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

function buildDivisionParams() {
  const session = getUserSession();
  return buildFetchParams(AHD_CONFIG.SP_DIVISION, {
    prmuserid: Number(session.loginId) || 1,
    prmcompanyid: Number(session.companyId) || 1,
    prmyearid: Number(session.yearId) || 1,
  });
}

function buildMainGroupParams(divisionId) {
  const session = getUserSession();
  return buildFetchParams(AHD_CONFIG.SP_MAIN_GROUP, {
    prmcompanyid: Number(session.companyId) || 1,
    prmdivisionid: Number(divisionId) || 0,
    prmyearid: Number(session.yearId) || 1,
    prmloginid: Number(session.loginId) || 1,
  });
}

function buildSubMainGroupParams(divisionId, mainGroupId) {
  const session = getUserSession();
  return buildFetchParams(AHD_CONFIG.SP_SUB_MAIN_GROUP, {
    prmcompanyid: Number(session.companyId) || 1,
    prmdivisionid: Number(divisionId) || 0,
    prmyearid: Number(session.yearId) || 1,
    prmloginid: Number(session.loginId) || 1,
    prmmaingroupid: Number(mainGroupId) || 0,
  });
}

function buildDataParams(filters, sessionId) {
  const session = getUserSession();
  return buildFetchParams(AHD_CONFIG.SP_DATA, {
    prmcompanyid: Number(session.companyId) || 1,
    prmyearid: Number(session.yearId) || 1,
    prmloginid: Number(session.loginId) || 1,
    prmsessionid: resolveSessionId(sessionId),
    prmmasterid: AHD_CONFIG.DEFAULT_MASTER_ID,
    prmdivisionid: Number(filters.divisionId) || 0,
    prmmaingroupid: Number(filters.mainGroupId) || 0,
    prmsubmaingroupid: Number(filters.subMainGroupId) || 0,
    prmsearchtext: String(filters.searchText ?? ""),
  });
}

function mapDivisionOptions(rows) {
  const options = (rows || []).map((row) => ({
    value: String(resolveValue(row, ["fromdivisionid", "divisionid", "DivisionID"], "0")),
    label: String(resolveValue(row, ["fromdivision", "divisionname", "DivisionName"], "")),
  }));

  const seen = new Set();
  return options.filter((option) => {
    if (!option.label || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function mapMainGroupOptions(rows) {
  const options = (rows || []).map((row) => ({
    value: String(resolveValue(row, ["maingroupid", "MainGroupID", "idnumber"], "0")),
    label: String(resolveValue(row, ["maingroup", "maingroupname", "MainGroupName", "groupname"], "")),
  }));

  const seen = new Set();
  return options.filter((option) => {
    if (!option.label || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function mapSubMainGroupOptions(rows) {
  const options = (rows || []).map((row) => ({
    value: String(resolveValue(row, ["submaingroupid", "SubMainGroupID", "idnumber"], "0")),
    label: String(resolveValue(row, ["submaingroup", "submaingroupname", "SubMainGroupName", "groupname"], "")),
  }));

  const seen = new Set();
  return options.filter((option) => {
    if (!option.label || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function ensureRows(result, sourceName) {
  const rows = Array.isArray(result) ? result : [];
  const errorRow = rows.find((row) => String(row?.ErrCode ?? row?.errcode ?? "") === "-1");
  if (errorRow) {
    throw new Error(errorRow.ErrMsg ?? errorRow.errmsg ?? `Failed to load ${sourceName}.`);
  }
  return rows;
}

function getRowKey(row, index) {
  const id = resolveValue(row, ["idnumber", "IDNumber", "masterid", "MasterID"], "");
  if (id !== "") return String(id);
  const itemCode = resolveValue(row, ["itemcode", "ItemCode"], "");
  const srNo = resolveValue(row, ["srno", "SrNo"], "");
  if (itemCode && srNo) return `${itemCode}|${srNo}`;
  return `row-${index}`;
}

export default function AssetHealthDecisionPage() {
  const sessionId = getStoredSessionId();
  const { get } = useApi(API_BASE_URL);
  const session = useMemo(() => getUserSession(), []);

  const [columns, setColumns] = useState([]);
  const [data, setData] = useState([]);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [mainGroupOptions, setMainGroupOptions] = useState([]);
  const [subMainGroupOptions, setSubMainGroupOptions] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedMainGroup, setSelectedMainGroup] = useState("");
  const [selectedSubMainGroup, setSelectedSubMainGroup] = useState("");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [columnsLoading, setColumnsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  usePageHeader({
    title: "Asset Health Decision",
    subtitle: "Review asset health decisions by division and group.",
    showBack: true,
    backTo: "/",
  });

  const fetchFunction = useCallback(async (params, sourceName) => {
    const result = await get(ENDPOINTS.FN_FETCH_DATA, params);
    return ensureRows(result, sourceName);
  }, [get]);

  const loadColumns = useCallback(async () => {
    setColumnsLoading(true);
    try {
      const rbRows = await fetchFunction(
        buildFetchParams(AHD_CONFIG.SP_RB_META, {
          prmrbcode: AHD_CONFIG.RB_CODE,
        }),
        "asset health decision metadata"
      );
      const rbId = rbRows[0]?.rbid ?? rbRows[0]?.RBID;
      if (!rbId) {
        throw new Error(`No RB metadata returned for ${AHD_CONFIG.RB_CODE}.`);
      }

      const apiColumns = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbId,
        prmLoginID: Number(session.loginId) || 1,
      });
      const builtColumns = buildGridColumns(apiColumns || [], {}, {
        filterable: true,
        allEditable: false,
      });
      setColumns(toEnterpriseDataGridColumns(builtColumns));
    } catch (err) {
      console.error("[AHD] column fetch failed:", err);
      setColumns([]);
      setError(err?.message || "Failed to load Asset Health Decision columns.");
    } finally {
      setColumnsLoading(false);
    }
  }, [fetchFunction, get, session.loginId]);

  const loadDivisions = useCallback(async () => {
    const rows = await fetchFunction(buildDivisionParams(), "divisions");
    const options = mapDivisionOptions(rows);
    setDivisionOptions(options);
    setSelectedDivision((current) =>
      options.some((option) => option.value === current) ? current : options[0]?.value || ""
    );
    return options;
  }, [fetchFunction]);

  const loadMainGroups = useCallback(async (divisionId) => {
    if (!divisionId) {
      setMainGroupOptions([]);
      setSelectedMainGroup("");
      return [];
    }
    const rows = await fetchFunction(buildMainGroupParams(divisionId), "main groups");
    const options = mapMainGroupOptions(rows);
    setMainGroupOptions(options);
    setSelectedMainGroup((current) =>
      options.some((option) => option.value === current) ? current : ""
    );
    return options;
  }, [fetchFunction]);

  const loadSubMainGroups = useCallback(async (divisionId, mainGroupId = 0) => {
    if (!divisionId) {
      setSubMainGroupOptions([]);
      setSelectedSubMainGroup("");
      return [];
    }
    const rows = await fetchFunction(
      buildSubMainGroupParams(divisionId, mainGroupId),
      "sub main groups"
    );
    const options = mapSubMainGroupOptions(rows);
    setSubMainGroupOptions(options);
    setSelectedSubMainGroup((current) =>
      options.some((option) => option.value === current) ? current : ""
    );
    return options;
  }, [fetchFunction]);

  const loadData = useCallback(async (filters) => {
    if (!filters.divisionId) {
      setData([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchFunction(buildDataParams(filters, sessionId), "asset health decision data");
      setData(rows);
    } catch (err) {
      console.error("[AHD] data fetch failed:", err);
      setError(err?.message || "Failed to load Asset Health Decision data.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, sessionId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await Promise.all([loadColumns(), loadDivisions()]);
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Failed to load Asset Health Decision.");
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadColumns, loadDivisions]);

  useEffect(() => {
    if (!selectedDivision) {
      setMainGroupOptions([]);
      setSubMainGroupOptions([]);
      setSelectedMainGroup("");
      setSelectedSubMainGroup("");
      return;
    }
    let active = true;
    (async () => {
      try {
        await loadMainGroups(selectedDivision);
        if (!active) return;
        await loadSubMainGroups(selectedDivision, 0);
      } catch (err) {
        if (!active) return;
        console.error("[AHD] group filter load failed:", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedDivision, loadMainGroups, loadSubMainGroups]);

  useEffect(() => {
    if (!selectedDivision) return;
    loadSubMainGroups(selectedDivision, selectedMainGroup || 0);
  }, [selectedDivision, selectedMainGroup, loadSubMainGroups]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchText(searchText), 400);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    loadData({
      divisionId: selectedDivision,
      mainGroupId: selectedMainGroup,
      subMainGroupId: selectedSubMainGroup,
      searchText: debouncedSearchText,
    });
  }, [loadData, selectedDivision, selectedMainGroup, selectedSubMainGroup, debouncedSearchText]);

  const handleDivisionChange = useCallback((value) => {
    setSelectedDivision(value);
    setSelectedMainGroup("");
    setSelectedSubMainGroup("");
  }, []);

  const handleMainGroupChange = useCallback((value) => {
    setSelectedMainGroup(value);
    setSelectedSubMainGroup("");
  }, []);

  return (
    <div className="workspace-page workspace-page--fill ahd-page">
      <section className="ahd-page__toolbar">
        <div className="ahd-page__title">
          <Activity size={14} strokeWidth={2} />
          <span>Asset Health Decision</span>
        </div>
        <div className="ahd-page__toolbar-inner">
          <GridSearch
            query={searchText}
            onChange={setSearchText}
          />
          <GridRowCount matchCount={data.length} totalCount={data.length} />
          <div className="ahd-page__filters">
            <label htmlFor="ahd-division" className="ahd-page__label">
              Division
            </label>
            <SearchSelect
              id="ahd-division"
              className="ahd-page__select"
              value={selectedDivision}
              onChange={handleDivisionChange}
              options={divisionOptions}
              placeholder="Select"
              searchPlaceholder="Search division…"
              ariaLabel="Division"
              disabled={divisionOptions.length === 0}
              compact
            />
            <label htmlFor="ahd-main-group" className="ahd-page__label">
              Main Group
            </label>
            <SearchSelect
              id="ahd-main-group"
              className="ahd-page__select"
              value={selectedMainGroup}
              onChange={handleMainGroupChange}
              options={mainGroupOptions}
              placeholder="All"
              searchPlaceholder="Search main group…"
              ariaLabel="Main Group"
              disabled={!selectedDivision}
              compact
            />
            <label htmlFor="ahd-sub-main-group" className="ahd-page__label">
              Sub Main Group
            </label>
            <SearchSelect
              id="ahd-sub-main-group"
              className="ahd-page__select"
              value={selectedSubMainGroup}
              onChange={setSelectedSubMainGroup}
              options={subMainGroupOptions}
              placeholder="All"
              searchPlaceholder="Search sub main group…"
              ariaLabel="Sub Main Group"
              disabled={!selectedDivision}
              compact
            />
          </div>
        </div>
      </section>

      <section className="workspace-page__grid ahd-page__grid">
        <EnterpriseDataGrid
          title=""
          columns={columns}
          data={data}
          loading={loading || columnsLoading}
          error={error}
          loaderText="Loading Asset Health Decision…"
          emptyMessage={selectedDivision ? "No asset health decision data found." : "Select a division."}
          hideHeader
          hidePagination
          fill
          getRowKey={getRowKey}
        />
      </section>
    </div>
  );
}
