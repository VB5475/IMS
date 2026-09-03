import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ArrowRight,
  FileText,
  PackageCheck,
  Printer,
  QrCode,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import EnterpriseDataGrid from "../grid/EnterpriseDataGrid";
import GridSearch from "../grid/GridSearch";
import GridRowCount from "../grid/GridRowCount";
import SearchSelect from "../ui/SearchSelect";
import Modal from "../ui/Modal";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL, DASHBOARD_CONFIG } from "../../api/constants";
import { DASHBOARD_ASSIGN_OPTIONS } from "../../pages/dashboard/constants";
import { getUserSession } from "../../session/userSession";
import { useNotification } from "../../context/NotificationContext";
import { resolveAssetQrFields } from "../../utils/assetQrUtils";
import { rbNewPath, RB_ROUTE_PATHS } from "../../constants/rbCodes";
import { buildGridColumns, toEnterpriseDataGridColumns } from "../../utils/gridUtils";
import { useNavigate } from "react-router-dom";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "../../constants/tableConfig";
import "./ReportBoardPanel.css";

const DEFAULT_MASTER_ID = DASHBOARD_CONFIG.DEFAULT_MASTER_ID;
const DEFAULT_SESSION_ID = DASHBOARD_CONFIG.DEFAULT_SESSION_ID;
const DASHBOARD_CART_STORAGE_KEY = "enterpriseDashboardSelectedItems";

function resolveSessionId(sessionId) {
  const fromProp = Number(sessionId) || 0;
  if (fromProp > 0) return fromProp;
  const fromSession = Number(getUserSession()?.sessionId) || 0;
  if (fromSession > 0) return fromSession;
  return DEFAULT_SESSION_ID;
}

function readDashboardCart() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(DASHBOARD_CART_STORAGE_KEY) || "null");
    return {
      divisionId: String(parsed?.divisionId ?? ""),
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      selectedForm: String(parsed?.selectedForm ?? ""),
    };
  } catch {
    return { divisionId: "", items: [], selectedForm: "" };
  }
}

function resolveValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (value != null && value !== "") return value;
  }
  return fallback;
}

function mapDivisionOptions(rows) {
  const options = (rows || []).map((row) => ({
    value: String(resolveValue(row, ["fromdivisionid"], "0")),
    label: String(resolveValue(row, ["fromdivision"], "")),
  }));

  const seen = new Set();
  return options.filter((option) => {
    if (!option.label || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function buildDivisionParams() {
  const session = getUserSession();
  return {
    ObjType: 2,
    ObjName: "fn_tbl_fetchuserwsfromdivision",
    JSon: JSON.stringify([
      {
        prmuserid: Number(session.loginId) || 1,
        prmcompanyid: Number(session.companyId) || 1,
        prmyearid: Number(session.yearId) || 1,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

function buildReportBoardParams(divisionId, sessionId, filters = {}, pagination = {}) {
  const session = getUserSession();
  const pageNumber = Math.max(1, Number(pagination.pageNumber) || 1);
  const pageSize = Math.max(1, Number(pagination.pageSize) || DEFAULT_PAGE_SIZE);
  return {
    ObjType: DASHBOARD_CONFIG.REPORT_OBJ_TYPE,
    ObjName: DASHBOARD_CONFIG.SP_REPORT_DATA,
    JSon: JSON.stringify([
      {
        prmcompanyid: Number(session.companyId) || 1,
        prmyearid: Number(session.yearId) || 1,
        prmloginid: Number(session.loginId) || 1,
        prmsessionid: resolveSessionId(sessionId),
        prmmasterid: DEFAULT_MASTER_ID,
        prmdivisionid: Number(divisionId) || 0,
        prmmaingroupid: Number(filters.mainGroupId) || 0,
        prmsubmaingroupid: Number(filters.subMainGroupId) || 0,
        prmsearchtext: "",
        prmOptionType: filters.assignStatus || DASHBOARD_CONFIG.DEFAULT_ASSIGN_STATUS,
        prmPageNumber: pageNumber,
        prmPageSize: pageSize,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

function resolveTotalRowCount(rows, pageNumber, pageSize) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return 0;

  const first = list[0];
  for (const key of [
    "totalgridrowcount",
    "TotalGridRowCount",
    "totalrecords",
    "TotalRecords",
    "totalcount",
    "TotalCount",
    "recordcount",
    "RecordCount",
  ]) {
    const total = Number(first?.[key]);
    if (Number.isFinite(total) && total >= 0) return total;
  }

  const safePage = Math.max(1, Number(pageNumber) || 1);
  const safeSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
  if (list.length < safeSize) {
    return (safePage - 1) * safeSize + list.length;
  }
  // Full page — allow Next; exact total comes from API when available.
  return safePage * safeSize + 1;
}

function buildMainGroupParams(divisionId) {
  const session = getUserSession();
  return {
    ObjType: 2,
    ObjName: DASHBOARD_CONFIG.SP_MAIN_GROUP,
    JSon: JSON.stringify([
      {
        prmcompanyid: Number(session.companyId) || 1,
        prmdivisionid: Number(divisionId) || 0,
        prmyearid: Number(session.yearId) || 1,
        prmloginid: Number(session.loginId) || 1,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

function buildSubMainGroupParams(divisionId, mainGroupId) {
  const session = getUserSession();
  return {
    ObjType: 2,
    ObjName: DASHBOARD_CONFIG.SP_SUB_MAIN_GROUP,
    JSon: JSON.stringify([
      {
        prmcompanyid: Number(session.companyId) || 1,
        prmdivisionid: Number(divisionId) || 0,
        prmyearid: Number(session.yearId) || 1,
        prmloginid: Number(session.loginId) || 1,
        prmmaingroupid: Number(mainGroupId) || 0,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
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
    value: String(
      resolveValue(row, ["submaingroupid", "subgroupid", "SubMainGroupID", "idnumber"], "0")
    ),
    label: String(
      resolveValue(row, ["submaingroup", "subgroup", "submaingroupname", "SubMainGroupName"], "")
    ),
  }));

  const seen = new Set();
  return options.filter((option) => {
    if (!option.label || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function buildAstFormListParams(sessionId) {
  const session = getUserSession();
  return {
    ObjType: DASHBOARD_CONFIG.FORM_LIST_OBJ_TYPE,
    ObjName: DASHBOARD_CONFIG.SP_AST_FORM_LIST,
    JSon: JSON.stringify([
      {
        prmloginid: Number(session.loginId) || 1,
        prmcompanyid: Number(session.companyId) || 1,
        prmyearid: Number(session.yearId) || 1,
        prmsessionid: resolveSessionId(sessionId),
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

function buildRbMetaParams(rbCode) {
  return {
    ObjType: 2,
    ObjName: DASHBOARD_CONFIG.SP_RB_META,
    JSon: JSON.stringify([{ prmrbcode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

function mapAstFormOptions(rows) {
  const options = (rows || []).map((row) => {
    const id = String(resolveValue(row, ["formrbcode", "FormRBCode", "FORMRBCODE"], "")).trim();
    const label = String(
      resolveValue(row, ["formname", "FormName", "FORMNAME"], id || "Untitled form")
    ).trim();
    return { id, label };
  });

  const seen = new Set();
  return options.filter((option) => {
    if (!option.id || seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
}

function getReportRowKey(row, index) {
  const { itemcode, srno } = resolveAssetQrFields(row);
  if (itemcode && srno) return `${itemcode}|${srno}`;
  return `row-${index}`;
}

export default function ReportBoardPanel({
  compact = false,
  fill = compact,
  sessionId = 0,
}) {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);
  const notify = useNotification();
  const navigate = useNavigate();
  const storedCartRef = useRef(readDashboardCart());
  const previousDivisionRef = useRef(storedCartRef.current.divisionId);

  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [columnsLoading, setColumnsLoading] = useState(true);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState(storedCartRef.current.divisionId);
  const [mainGroupOptions, setMainGroupOptions] = useState([]);
  const [selectedMainGroup, setSelectedMainGroup] = useState("");
  const [subMainGroupOptions, setSubMainGroupOptions] = useState([]);
  const [selectedSubMainGroup, setSelectedSubMainGroup] = useState("");
  const [assignStatus, setAssignStatus] = useState(DASHBOARD_CONFIG.DEFAULT_ASSIGN_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState(() =>
    storedCartRef.current.items.map((item) => String(item.key))
  );
  const [cartItems, setCartItems] = useState(storedCartRef.current.items);
  const [selectedForm, setSelectedForm] = useState(storedCartRef.current.selectedForm);
  const [entryForms, setEntryForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [printingStickers, setPrintingStickers] = useState(false);
  const [printSizeKey, setPrintSizeKey] = useState("50x50");
  const [stickersPerPage, setStickersPerPage] = useState(1);

  // 2026-08-14 (/pm): was a locally reinvented compact/default page-size
  // split (8/10, own option arrays) — now the same shared table config every
  // list page uses, in both compact and full-width rendering modes.
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRowCount, setTotalRowCount] = useState(0);
  // 2026-08-17 (/pm) — search moved from the grid's own row into this
  // toolbar, before Division (same "search in the title/toolbar row"
  // pattern rolled out to every list page, see project_search_titlebar_rollout.md).
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStats, setSearchStats] = useState({ matchCount: 0, totalCount: 0 });

  useEffect(() => {
    if (!selectedDivision) return;
    sessionStorage.setItem(
      DASHBOARD_CART_STORAGE_KEY,
      JSON.stringify({
        divisionId: selectedDivision,
        items: cartItems,
        selectedForm,
      })
    );
  }, [cartItems, selectedDivision, selectedForm]);

  useEffect(
    () => () => {
      sessionStorage.removeItem(DASHBOARD_CART_STORAGE_KEY);
    },
    []
  );

  const fetchReportColumns = useCallback(async () => {
    try {
      setColumnsLoading(true);
      const metaData = await get(
        ENDPOINTS.FN_FETCH_DATA,
        buildRbMetaParams(DASHBOARD_CONFIG.RB_DETAIL)
      );
      const tableRow = metaData?.[0];
      if (!tableRow) {
        throw new Error(`No RB metadata returned for ${DASHBOARD_CONFIG.RB_DETAIL}.`);
      }

      const meta = {
        RBID: tableRow.rbid ?? tableRow.RBID,
        SaveProcName: tableRow.saveprocname ?? tableRow.SaveProcName,
      };
      localStorage.setItem(DASHBOARD_CONFIG.STORAGE_DETAIL_META, JSON.stringify(meta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: meta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      const apiColumns = Array.isArray(colData) ? colData : [];
      const gridColumns = buildGridColumns(apiColumns, {}, { filterable: true, allEditable: false });
      setColumns(toEnterpriseDataGridColumns(gridColumns));
    } catch (err) {
      console.error("[ReportBoardPanel] column meta fetch failed:", err);
      setColumns([]);
      setError(err?.message || "Failed to load report board columns.");
    } finally {
      setColumnsLoading(false);
    }
  }, [get]);

  const fetchDivisions = useCallback(async () => {
    try {
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildDivisionParams());
      const options = mapDivisionOptions(json);
      setDivisionOptions(options);
      setSelectedDivision((current) =>
        options.some((option) => option.value === current) ? current : options[0]?.value || ""
      );
      return options;
    } catch (err) {
      console.error("[ReportBoardPanel] division fetch failed:", err);
      setDivisionOptions([]);
      setSelectedDivision("");
      throw err;
    }
  }, [get]);

  const fetchMainGroups = useCallback(async (divisionId) => {
    if (!divisionId) {
      setMainGroupOptions([]);
      setSelectedMainGroup("");
      setSubMainGroupOptions([]);
      setSelectedSubMainGroup("");
      return [];
    }
    try {
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildMainGroupParams(divisionId));
      const options = mapMainGroupOptions(json);
      setMainGroupOptions(options);
      setSelectedMainGroup((current) =>
        options.some((option) => option.value === current) ? current : ""
      );
      return options;
    } catch (err) {
      console.error("[ReportBoardPanel] main group fetch failed:", err);
      setMainGroupOptions([]);
      setSelectedMainGroup("");
      return [];
    }
  }, [get]);

  const fetchSubMainGroups = useCallback(async (divisionId, mainGroupId = 0) => {
    if (!divisionId) {
      setSubMainGroupOptions([]);
      setSelectedSubMainGroup("");
      return [];
    }
    try {
      const json = await get(
        ENDPOINTS.FN_FETCH_DATA,
        buildSubMainGroupParams(divisionId, mainGroupId)
      );
      const options = mapSubMainGroupOptions(json);
      setSubMainGroupOptions(options);
      setSelectedSubMainGroup((current) =>
        options.some((option) => option.value === current) ? current : ""
      );
      return options;
    } catch (err) {
      console.error("[ReportBoardPanel] sub main group fetch failed:", err);
      setSubMainGroupOptions([]);
      setSelectedSubMainGroup("");
      return [];
    }
  }, [get]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await Promise.all([fetchReportColumns(), fetchDivisions()]);
      } catch (err) {
        if (!active) return;
        setError("Failed to load divisions.");
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchDivisions, fetchReportColumns]);

  useEffect(() => {
    fetchMainGroups(selectedDivision);
  }, [fetchMainGroups, selectedDivision]);

  useEffect(() => {
    fetchSubMainGroups(selectedDivision, selectedMainGroup || 0);
  }, [fetchSubMainGroups, selectedDivision, selectedMainGroup]);

  const fetchReportBoards = useCallback(
    async (divisionId, filters, pageNumber, rowsPerPage) => {
      if (!divisionId) {
        setData([]);
        setTotalRowCount(0);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const json = await get(
          ENDPOINTS.FN_FETCH_DATA,
          buildReportBoardParams(divisionId, sessionId, filters, {
            pageNumber,
            pageSize: rowsPerPage,
          })
        );
        const rows = Array.isArray(json) ? json : [];
        setData(rows);
        setTotalRowCount(resolveTotalRowCount(rows, pageNumber, rowsPerPage));
      } catch (err) {
        console.error("[ReportBoardPanel] fetch failed:", err);
        setError("Failed to load report board data.");
        setData([]);
        setTotalRowCount(0);
      } finally {
        setLoading(false);
      }
    },
    [get, sessionId]
  );

  useEffect(() => {
    fetchReportBoards(
      selectedDivision,
      {
        mainGroupId: selectedMainGroup,
        subMainGroupId: selectedSubMainGroup,
        assignStatus,
      },
      currentPage,
      pageSize
    );
    const previousDivision = previousDivisionRef.current;
    if (previousDivision && previousDivision !== selectedDivision) {
      setSelectedRowKeys([]);
      setCartItems([]);
      setSelectedForm("");
    }
    previousDivisionRef.current = selectedDivision;
  }, [
    assignStatus,
    currentPage,
    fetchReportBoards,
    pageSize,
    selectedDivision,
    selectedMainGroup,
    selectedSubMainGroup,
  ]);

  // Group resets happen in the change handlers, not in an effect, so a
  // division switch triggers a single batched refetch instead of two.
  const handleDivisionChange = useCallback((value) => {
    setCurrentPage(1);
    setSelectedDivision(value);
    setSelectedMainGroup("");
    setSelectedSubMainGroup("");
    setMainGroupOptions([]);
    setSubMainGroupOptions([]);
  }, []);

  const handleMainGroupChange = useCallback((value) => {
    setCurrentPage(1);
    setSelectedMainGroup(value);
    setSelectedSubMainGroup("");
  }, []);

  const handleSubMainGroupChange = useCallback((value) => {
    setCurrentPage(1);
    setSelectedSubMainGroup(value);
  }, []);

  const handleAssignStatusChange = useCallback((value) => {
    setCurrentPage(1);
    setAssignStatus(value);
  }, []);

  const handlePageSizeChange = useCallback((nextSize) => {
    setCurrentPage(1);
    setPageSize(nextSize);
  }, []);

  const selectedRows = useMemo(() => {
    const keySet = new Set(selectedRowKeys.map(String));
    return data.filter((row, index) => keySet.has(String(getReportRowKey(row, index))));
  }, [data, selectedRowKeys]);

  const handleSelectionChange = useCallback(
    (nextKeys) => {
      const normalizedKeys = nextKeys.map(String);
      const keySet = new Set(normalizedKeys);
      const nextItems = data
        .map((row, index) => ({
          key: String(getReportRowKey(row, index)),
          row,
        }))
        .filter((item) => keySet.has(item.key));
      setSelectedRowKeys(normalizedKeys);
      setCartItems(nextItems);
      if (nextItems.length === 0) setSelectedForm("");
    },
    [data]
  );

  const handleRemoveCartItem = useCallback((key) => {
    const normalizedKey = String(key);
    setSelectedRowKeys((current) => current.filter((itemKey) => String(itemKey) !== normalizedKey));
    setCartItems((current) => {
      const next = current.filter((item) => String(item.key) !== normalizedKey);
      if (next.length === 0) setSelectedForm("");
      return next;
    });
  }, []);

  const handleClearCart = useCallback(() => {
    setSelectedRowKeys([]);
    setCartItems([]);
    setSelectedForm("");
  }, []);

  const fetchAstFormList = useCallback(async () => {
    try {
      setFormsLoading(true);
      setFormsError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildAstFormListParams(sessionId));
      const options = mapAstFormOptions(json);
      setEntryForms(options);
      setSelectedForm((current) =>
        options.some((option) => option.id === current) ? current : ""
      );
      return options;
    } catch (err) {
      console.error("[ReportBoardPanel] asset form list fetch failed:", err);
      setEntryForms([]);
      setFormsError("Failed to load entry forms.");
      return [];
    } finally {
      setFormsLoading(false);
    }
  }, [get, sessionId]);

  useEffect(() => {
    if (!cartOpen) return undefined;
    let active = true;
    (async () => {
      if (!active) return;
      await fetchAstFormList();
    })();
    return () => {
      active = false;
    };
  }, [cartOpen, fetchAstFormList]);

  const handleUseSelectedForm = useCallback(() => {
    if (!selectedForm) {
      notify.error("Select a form for entry.");
      return;
    }
    if (cartItems.length === 0) {
      notify.error("Select at least one dashboard item.");
      return;
    }
    if (!RB_ROUTE_PATHS[selectedForm]) {
      notify.error("Selected form is not available in the app yet.");
      return;
    }
    const formLabel =
      entryForms.find((form) => form.id === selectedForm)?.label ?? selectedForm;
    notify.success(
      `${formLabel} selected for ${cartItems.length} item${cartItems.length === 1 ? "" : "s"}.`
    );
    setCartOpen(false);
    navigate(rbNewPath(selectedForm), {
      state: {
        fromDashboardCart: true,
        divisionId: selectedDivision,
        cartItems,
        formRbCode: selectedForm,
      },
    });
  }, [
    cartItems,
    entryForms,
    navigate,
    notify,
    selectedDivision,
    selectedForm,
  ]);

  const handleDownloadQrCodes = useCallback(async () => {
    if (selectedRows.length === 0) {
      notify.error("Select at least one row to download QR codes.");
      return;
    }
    setDownloadingQr(true);
    try {
      const { downloadAssetQrCodes } = await import("../../utils/assetQrPrint");
      const count = await downloadAssetQrCodes(selectedRows, printSizeKey, stickersPerPage);
      notify.success(`Downloaded PDF with ${count} QR code(s).`);
    } catch (err) {
      notify.error(err?.message || "Failed to generate QR codes.");
    } finally {
      setDownloadingQr(false);
    }
  }, [notify, selectedRows, printSizeKey, stickersPerPage]);

  const handlePrintStickers = useCallback(async () => {
    if (selectedRows.length === 0) {
      notify.error("Select at least one row to print stickers.");
      return;
    }

    setPrintingStickers(true);
    try {
      const { printAssetStickersBrowser } = await import("../../utils/assetQrBrowserPrint");
      const count = await printAssetStickersBrowser(selectedRows, printSizeKey, stickersPerPage);
      notify.success(`Opened print dialog for ${count} sticker(s).`);
    } catch (err) {
      notify.error(err?.message || "Sticker print failed.");
    } finally {
      setPrintingStickers(false);
    }
  }, [notify, selectedRows, printSizeKey, stickersPerPage]);

  const cartFooter = (
    <div className="rbp-cart__footer">
      <button
        type="button"
        className="rbp-cart__footer-btn rbp-cart__footer-btn--ghost"
        onClick={() => setCartOpen(false)}
      >
        Close
      </button>
      <button
        type="button"
        className="rbp-cart__footer-btn rbp-cart__footer-btn--primary"
        onClick={handleUseSelectedForm}
        disabled={!selectedForm || cartItems.length === 0}
      >
        Continue with selected form
        <ArrowRight size={14} strokeWidth={2.25} />
      </button>
    </div>
  );

  const gridBottomControls = useMemo(
    () => (
      <>
        <label htmlFor="rbp-print-size" className="rbp-panel__pagesize-label">
          Print size
        </label>
        <select
          id="rbp-print-size"
          className="ng-select rbp-panel__pagesize-select"
          value={printSizeKey}
          onChange={(e) => setPrintSizeKey(e.target.value)}
          aria-label="Print size"
        >
          <option value="50x50">50 x 50</option>
          <option value="50x20">50 x 20</option>
        </select>
        <label htmlFor="rbp-stickers-per-page" className="rbp-panel__pagesize-label">
          Per page
        </label>
        <select
          id="rbp-stickers-per-page"
          className="ng-select rbp-panel__pagesize-select"
          value={stickersPerPage}
          onChange={(e) => setStickersPerPage(Number(e.target.value))}
          aria-label="Stickers per page"
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rbp-panel__icon-btn rbp-panel__print-btn"
          onClick={handlePrintStickers}
          disabled={printingStickers || selectedRowKeys.length === 0}
          title={
            printingStickers
              ? "Preparing stickers…"
              : `Print stickers${selectedRowKeys.length ? ` (${selectedRowKeys.length})` : ""} — ${printSizeKey} mm`
          }
          aria-label={
            printingStickers
              ? "Printing stickers"
              : `Print stickers${selectedRowKeys.length ? `, ${selectedRowKeys.length} selected` : ""}`
          }
        >
          <Printer size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="rbp-panel__icon-btn rbp-panel__qr-btn rbp-panel__qr-btn--secondary"
          onClick={handleDownloadQrCodes}
          disabled={downloadingQr || selectedRowKeys.length === 0}
          title={
            downloadingQr
              ? "Generating QR codes PDF…"
              : `Download QR codes PDF${selectedRowKeys.length ? ` (${selectedRowKeys.length} selected)` : ""}`
          }
          aria-label={
            downloadingQr
              ? "Generating QR codes PDF"
              : `Download QR codes PDF${selectedRowKeys.length ? `, ${selectedRowKeys.length} selected` : ""}`
          }
        >
          <QrCode size={14} strokeWidth={2} />
        </button>
        <label htmlFor="rbp-page-size" className="rbp-panel__pagesize-label">
          Rows per page
        </label>
        <select
          id="rbp-page-size"
          className="ng-select rbp-panel__pagesize-select"
          value={pageSize}
          onChange={(e) => handlePageSizeChange(Number(e.target.value))}
          aria-label="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </>
    ),
    [
      downloadingQr,
      handleDownloadQrCodes,
      handlePageSizeChange,
      handlePrintStickers,
      pageSize,
      printingStickers,
      printSizeKey,
      stickersPerPage,
      selectedRowKeys.length,
    ]
  );

  return (
    <>
      <section
        className={`rbp-panel ${fill ? "rbp-panel--fill" : ""} ${compact ? "rbp-panel--compact" : ""}`}
      >
        <header className="rbp-panel__header">
          <div className="rbp-panel__title-area">
            <div className="rbp-panel__title">
              <FileText size={14} strokeWidth={2} />
              <span>Report Boards</span>
            </div>
            <button
              type="button"
              className="rbp-panel__icon-btn rbp-panel__cart-btn"
              onClick={() => setCartOpen(true)}
              title={`See Cart${cartItems.length ? ` (${cartItems.length} selected)` : ""}`}
              aria-label={`See Cart${cartItems.length ? `, ${cartItems.length} selected` : ""}`}
            >
              <ShoppingCart size={14} strokeWidth={2} />
              {cartItems.length > 0 && (
                <span className="rbp-panel__cart-count">{cartItems.length}</span>
              )}
            </button>
          </div>
          <div className="rbp-panel__toolbar">
            <div className="rbp-panel__toolbar-inner">
              <GridSearch
                query={searchQuery}
                onChange={setSearchQuery}
              />
              <GridRowCount
                matchCount={searchStats.matchCount}
                totalCount={searchStats.totalCount}
              />
              <div className="rbp-panel__filter-field">
                <label htmlFor="rbp-division" className="rbp-panel__pagesize-label">
                  Division
                </label>
                <SearchSelect
                  id="rbp-division"
                  className="rbp-panel__filter-select rbp-panel__division-select"
                  value={selectedDivision}
                  onChange={handleDivisionChange}
                  options={divisionOptions}
                  placeholder="Select"
                  searchPlaceholder="Search division…"
                  ariaLabel="Division"
                  disabled={divisionOptions.length === 0}
                  compact
                />
              </div>
              <div className="rbp-panel__filter-field">
                <label htmlFor="rbp-main-group" className="rbp-panel__pagesize-label">
                  Main Group
                </label>
                <SearchSelect
                  id="rbp-main-group"
                  className="rbp-panel__filter-select rbp-panel__group-select"
                  value={selectedMainGroup}
                  onChange={handleMainGroupChange}
                  options={mainGroupOptions}
                  placeholder="All"
                  searchPlaceholder="Search main group…"
                  ariaLabel="Main Group"
                  disabled={!selectedDivision}
                  compact
                />
              </div>
              <div className="rbp-panel__filter-field">
                <label htmlFor="rbp-sub-main-group" className="rbp-panel__pagesize-label">
                  Sub Main Group
                </label>
                <SearchSelect
                  id="rbp-sub-main-group"
                  className="rbp-panel__filter-select rbp-panel__group-select"
                  value={selectedSubMainGroup}
                  onChange={handleSubMainGroupChange}
                  options={subMainGroupOptions}
                  placeholder="All"
                  searchPlaceholder="Search sub main group…"
                  ariaLabel="Sub Main Group"
                  disabled={!selectedDivision}
                  compact
                />
              </div>
              <div className="rbp-panel__assign-radios" role="radiogroup" aria-label="Assignment status">
                {DASHBOARD_ASSIGN_OPTIONS.map((option) => (
                  <label key={option.value} className="rbp-panel__assign-option">
                    <input
                      type="radio"
                      name="rbp-assign-status"
                      value={option.value}
                      checked={assignStatus === option.value}
                      onChange={() => handleAssignStatusChange(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </header>

        <EnterpriseDataGrid
          title=""
          columns={columns}
          data={data}
          loading={loading || columnsLoading}
          error={error}
          loaderText="Loading Report Boards…"
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          paginationMode="server"
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          totalRowCount={totalRowCount}
          emptyMessage={selectedDivision ? "No report board data found." : "Select a division."}
          hideHeader
          fill={fill}
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          selectable
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={handleSelectionChange}
          getRowKey={getReportRowKey}
          bottomPanelExtras={gridBottomControls}
        />
      </section>

      <Modal
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Selected Items Cart"
        subtitle={`${cartItems.length} item${cartItems.length === 1 ? "" : "s"} ready for entry`}
        icon={<ShoppingCart size={16} strokeWidth={2} />}
        size="xl"
        variant="enterprise"
        dialogClassName="rbp-cart-modal"
        footer={cartFooter}
      >
        <div className="rbp-cart">
          <section className="rbp-cart__items">
            <div className="rbp-cart__section-header">
              <div>
                <h3>Selected items</h3>
                <p>Review the assets selected from the dashboard.</p>
              </div>
              {cartItems.length > 0 && (
                <button type="button" className="rbp-cart__clear-btn" onClick={handleClearCart}>
                  <Trash2 size={13} />
                  Clear cart
                </button>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="rbp-cart__empty">
                <ShoppingCart size={30} strokeWidth={1.5} />
                <strong>Your cart is empty</strong>
                <span>Select rows from the Report Boards grid to add items.</span>
              </div>
            ) : (
              <div className="rbp-cart__table-wrap">
                <table className="rbp-cart__table">
                  <thead>
                    <tr>
                      <th aria-label="Remove" />
                      {columns.map((col) => (
                        <th key={col.key}>{col.label || col.key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.map(({ key, row }) => (
                      <tr key={key}>
                        <td>
                          <button
                            type="button"
                            className="rbp-cart__remove-btn"
                            onClick={() => handleRemoveCartItem(key)}
                            title="Remove item from cart"
                            aria-label={`Remove ${resolveValue(row, ["itemname", "itemcode"], "item")}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                        {columns.map((col) => {
                          const raw = resolveValue(row, [col.key], "");
                          const display =
                            typeof col.render === "function"
                              ? col.render(raw, row)
                              : raw === "" || raw == null
                                ? "—"
                                : String(raw);
                          return <td key={col.key}>{display}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="rbp-cart__forms">
            <div className="rbp-cart__section-header">
              <div>
                <h3>Choose entry form</h3>
                <p>Select where these items should be used.</p>
              </div>
            </div>
            {formsLoading ? (
              <div className="rbp-cart__empty">
                <strong>Loading forms…</strong>
                <span>Fetching available entry forms.</span>
              </div>
            ) : formsError ? (
              <div className="rbp-cart__empty">
                <strong>Could not load forms</strong>
                <span>{formsError}</span>
                <button
                  type="button"
                  className="rbp-cart__clear-btn"
                  onClick={fetchAstFormList}
                >
                  Retry
                </button>
              </div>
            ) : entryForms.length === 0 ? (
              <div className="rbp-cart__empty">
                <strong>No forms available</strong>
                <span>No asset entry forms were returned for this user.</span>
              </div>
            ) : (
              <div className="rbp-cart__form-grid">
                {entryForms.map((form) => {
                  const active = selectedForm === form.id;
                  const routeReady = Boolean(RB_ROUTE_PATHS[form.id]);
                  return (
                    <button
                      key={form.id}
                      type="button"
                      className={`rbp-cart__form-btn${active ? " rbp-cart__form-btn--active" : ""}`}
                      onClick={() => setSelectedForm(form.id)}
                      disabled={cartItems.length === 0 || !routeReady}
                      title={
                        routeReady
                          ? form.label
                          : `${form.label} (route not configured yet)`
                      }
                      aria-pressed={active}
                    >
                      <span className="rbp-cart__form-icon">
                        <PackageCheck size={16} strokeWidth={2} />
                      </span>
                      <span>
                        <strong>{form.label}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </Modal>
    </>
  );
}
