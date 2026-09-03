import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import SearchSelect from "../../components/ui/SearchSelect";
import { useApi } from "../../api/useApi";
import { API_BASE_URL, ENDPOINTS } from "../../api/constants";
import { getStoredSessionId, getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildGridColumns, toEnterpriseDataGridColumns } from "../../utils/gridUtils";
import { isNumericColumnDef } from "../../utils/columnValidation";
import { FAR_CONFIG } from "./constants";
import "./FarPage.css";

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
  return FAR_CONFIG.DEFAULT_SESSION_ID;
}

function buildFetchParams(objName, jsonRow, objType = FAR_CONFIG.OBJ_TYPE) {
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
  return buildFetchParams(FAR_CONFIG.SP_DIVISION, {
    prmuserid: Number(session.loginId) || 1,
    prmcompanyid: Number(session.companyId) || 1,
    prmyearid: Number(session.yearId) || 1,
  });
}

function buildDataParams(divisionId, sessionId) {
  const session = getUserSession();
  return buildFetchParams(FAR_CONFIG.SP_DATA, {
    prmcompanyid: Number(session.companyId) || 1,
    prmyearid: Number(session.yearId) || 1,
    prmloginid: Number(session.loginId) || 1,
    prmsessionid: resolveSessionId(sessionId),
    prmmasterid: FAR_CONFIG.DEFAULT_MASTER_ID,
    prmdivisionid: Number(divisionId) || 0,
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

export default function FarPage() {
  const sessionId = getStoredSessionId();
  const { get } = useApi(API_BASE_URL);
  const session = useMemo(() => getUserSession(), []);

  const [columns, setColumns] = useState([]);
  const [gridColumns, setGridColumns] = useState([]);
  const [data, setData] = useState([]);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState("");
  const [columnsLoading, setColumnsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const numericTotalColumns = useMemo(
    () => gridColumns.filter((col) => col.key !== "cb" && isNumericColumnDef(col)),
    [gridColumns]
  );

  usePageHeader({
    title: "FAR",
    subtitle: "Fixed asset register by division.",
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
        buildFetchParams(FAR_CONFIG.SP_RB_META, {
          prmrbcode: FAR_CONFIG.RB_CODE,
        }),
        "FAR metadata"
      );
      const rbId = rbRows[0]?.rbid ?? rbRows[0]?.RBID;
      if (!rbId) {
        throw new Error(`No RB metadata returned for ${FAR_CONFIG.RB_CODE}.`);
      }

      const apiColumns = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbId,
        prmLoginID: Number(session.loginId) || 1,
      });
      const builtColumns = buildGridColumns(apiColumns || [], {}, {
        filterable: true,
        allEditable: false,
      });
      setGridColumns(builtColumns);
      setColumns(toEnterpriseDataGridColumns(builtColumns));
    } catch (err) {
      console.error("[FAR] column fetch failed:", err);
      setGridColumns([]);
      setColumns([]);
      setError(err?.message || "Failed to load FAR columns.");
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

  const loadData = useCallback(async (divisionId) => {
    if (!divisionId) {
      setData([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchFunction(buildDataParams(divisionId, sessionId), "FAR data");
      setData(rows);
    } catch (err) {
      console.error("[FAR] data fetch failed:", err);
      setError(err?.message || "Failed to load FAR data.");
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
        setError(err?.message || "Failed to load FAR.");
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadColumns, loadDivisions]);

  useEffect(() => {
    loadData(selectedDivision);
  }, [loadData, selectedDivision]);

  return (
    <div className="workspace-page workspace-page--fill far-page">
      <section className="far-page__toolbar">
        <div className="far-page__title">
          <Landmark size={14} strokeWidth={2} />
          <span>FAR</span>
        </div>
        <div className="far-page__filters">
          <label htmlFor="far-division" className="far-page__label">
            Division
          </label>
          <SearchSelect
            id="far-division"
            className="far-page__select"
            value={selectedDivision}
            onChange={setSelectedDivision}
            options={divisionOptions}
            placeholder="Select"
            searchPlaceholder="Search division…"
            ariaLabel="Division"
            disabled={divisionOptions.length === 0}
            compact
          />
        </div>
      </section>

      <section className="workspace-page__grid far-page__grid">
        <EnterpriseDataGrid
          title=""
          columns={columns}
          data={data}
          loading={loading || columnsLoading}
          error={error}
          loaderText="Loading FAR…"
          emptyMessage={selectedDivision ? "No FAR data found." : "Select a division."}
          hideHeader
          hidePagination
          showNumericColumnTotals
          numericTotalColumns={numericTotalColumns}
          fill
          variant="dashboard-v2"
          getRowKey={getRowKey}
        />
      </section>
    </div>
  );
}
