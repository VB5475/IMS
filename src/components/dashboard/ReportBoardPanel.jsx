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
import Modal from "../ui/Modal";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DASHBOARD_CONFIG } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useNotification } from "../../context/NotificationContext";
import { useStickerPrinter } from "../../hooks/useStickerPrinter";
import { STICKER_SIZES } from "../../utils/assetQrStickerConstants";
import { resolveAssetQrFields } from "../../utils/assetQrUtils";
import { rbNewPath, RB_ROUTE_PATHS } from "../../constants/rbCodes";
import { buildGridColumns, toEnterpriseDataGridColumns } from "../../utils/gridUtils";
import { useNavigate } from "react-router-dom";
import "./ReportBoardPanel.css";

const PAGE_SIZE_OPTIONS = {
  compact: [5, 8, 10, 15, 20],
  default: [5, 10, 20, 50, 99],
};

const DEFAULT_MASTER_ID = DASHBOARD_CONFIG.DEFAULT_MASTER_ID;
const DEFAULT_SESSION_ID = DASHBOARD_CONFIG.DEFAULT_SESSION_ID;
const DASHBOARD_CART_STORAGE_KEY = "enterpriseDashboardSelectedItems";

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

function buildReportBoardParams(divisionId) {
  const session = getUserSession();
  return {
    ObjType: DASHBOARD_CONFIG.REPORT_OBJ_TYPE,
    ObjName: DASHBOARD_CONFIG.SP_REPORT_DATA,
    JSon: JSON.stringify([
      {
        prmcompanyid: Number(session.companyId) || 1,
        prmyearid: Number(session.yearId) || 1,
        prmloginid: Number(session.loginId) || 1,
        prmsessionid: DEFAULT_SESSION_ID,
        prmmasterid: DEFAULT_MASTER_ID,
        prmdivisionid: Number(divisionId) || 0,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

function buildAstFormListParams() {
  const session = getUserSession();
  return {
    ObjType: DASHBOARD_CONFIG.FORM_LIST_OBJ_TYPE,
    ObjName: DASHBOARD_CONFIG.SP_AST_FORM_LIST,
    JSon: JSON.stringify([
      {
        prmloginid: Number(session.loginId) || 1,
        prmcompanyid: Number(session.companyId) || 1,
        prmyearid: Number(session.yearId) || 1,
        prmsessionid: DEFAULT_SESSION_ID,
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

export default function ReportBoardPanel({ compact = false, fill = compact }) {
  const { get } = useApi(API_BASE_URL);
  const notify = useNotification();
  const navigate = useNavigate();
  const storedCartRef = useRef(readDashboardCart());
  const previousDivisionRef = useRef(storedCartRef.current.divisionId);

  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [columnsLoading, setColumnsLoading] = useState(true);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState(storedCartRef.current.divisionId);
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

  const {
    status: printerStatus,
    printMode,
    printers,
    selectedPrinter,
    selectPrinter,
    stickerSize,
    setStickerSize,
    isPrinterReady,
    isBridgeConnected,
    error: printerError,
    reconnect: reconnectPrinter,
    getQz,
  } = useStickerPrinter();

  const pageSizeOptions = useMemo(
    () => (compact ? PAGE_SIZE_OPTIONS.compact : PAGE_SIZE_OPTIONS.default),
    [compact]
  );
  const [pageSize, setPageSize] = useState(() => (compact ? 8 : 10));

  useEffect(() => {
    setPageSize(compact ? 8 : 10);
  }, [compact]);

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

  const fetchReportBoards = useCallback(
    async (divisionId) => {
      if (!divisionId) {
        setData([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const json = await get(ENDPOINTS.FN_FETCH_DATA, buildReportBoardParams(divisionId));
        setData(Array.isArray(json) ? json : []);
      } catch (err) {
        console.error("[ReportBoardPanel] fetch failed:", err);
        setError("Failed to load report board data.");
        setData([]);
      } finally {
        setLoading(false);
      }
    },
    [get]
  );

  useEffect(() => {
    fetchReportBoards(selectedDivision);
    const previousDivision = previousDivisionRef.current;
    if (previousDivision && previousDivision !== selectedDivision) {
      setSelectedRowKeys([]);
      setCartItems([]);
      setSelectedForm("");
    }
    previousDivisionRef.current = selectedDivision;
  }, [fetchReportBoards, selectedDivision]);

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
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildAstFormListParams());
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
  }, [get]);

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
      const count = await downloadAssetQrCodes(selectedRows, stickerSize);
      notify.success(`Downloaded PDF with ${count} QR code(s).`);
    } catch (err) {
      notify.error(err?.message || "Failed to generate QR codes.");
    } finally {
      setDownloadingQr(false);
    }
  }, [notify, selectedRows, stickerSize]);

  const handlePrintStickers = useCallback(async () => {
    if (selectedRows.length === 0) {
      notify.error("Select at least one row to print stickers.");
      return;
    }
    if (!isPrinterReady) {
      notify.error(
        printMode === "none"
          ? "Run: npm run print-bridge — then click QZ to reconnect."
          : "Select your TSC TA200 printer from the dropdown."
      );
      return;
    }

    setPrintingStickers(true);
    try {
      const { printAssetStickerQrCodes } = await import("../../utils/assetQrStickerPrint");
      const count = await printAssetStickerQrCodes(selectedRows, {
        qz: getQz(),
        printerName: selectedPrinter,
        sizeKey: stickerSize,
        printMode,
      });
      notify.success(`Printed ${count} sticker(s) on ${selectedPrinter}.`);
    } catch (err) {
      notify.error(err?.message || "Sticker print failed.");
    } finally {
      setPrintingStickers(false);
    }
  }, [getQz, isPrinterReady, notify, printMode, selectedPrinter, selectedRows, stickerSize]);

  const printerStatusLabel = useMemo(() => {
    if (printerStatus === "connecting") return "Checking printer…";
    if (isPrinterReady && isBridgeConnected) return `Connected: ${selectedPrinter}`;
    if (isPrinterReady) return `Connected (QZ): ${selectedPrinter}`;
    if (printerStatus === "connected" && printers.length === 0) return "No printers found";
    if (printerStatus === "connected") return "Select TSC printer";
    return "Printer offline";
  }, [isBridgeConnected, isPrinterReady, printerStatus, printers.length, selectedPrinter]);

  const printerStatusClass = useMemo(() => {
    if (isPrinterReady) return "ready";
    if (printerStatus === "connecting") return "checking";
    return "offline";
  }, [isPrinterReady, printerStatus]);

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
            <label htmlFor="rbp-division" className="rbp-panel__pagesize-label">
              Division
            </label>
            <select
              id="rbp-division"
              className="ng-select rbp-panel__pagesize-select rbp-panel__division-select"
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              aria-label="Division"
              disabled={divisionOptions.length === 0}
            >
              {divisionOptions.length === 0 ? (
                <option value="">Select</option>
              ) : (
                divisionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))
              )}
            </select>
            <div
              className={`rbp-panel__printer-status rbp-panel__printer-status--${printerStatusClass}`}
              title={printerError || printerStatusLabel}
            >
              <span className="rbp-panel__printer-dot" aria-hidden="true" />
              <span className="rbp-panel__printer-text">{printerStatusLabel}</span>
              {!isPrinterReady && printerStatus !== "connecting" && (
                <button
                  type="button"
                  className="rbp-panel__printer-retry"
                  onClick={reconnectPrinter}
                  title="Reconnect printer (bridge or QZ Tray)"
                >
                  Retry
                </button>
              )}
            </div>
            {printerStatus === "connected" && printers.length > 0 && (
              <select
                className="ng-select rbp-panel__pagesize-select rbp-panel__printer-select"
                value={selectedPrinter}
                onChange={(e) => selectPrinter(e.target.value)}
                aria-label="Sticker printer"
                title="Sticker printer"
              >
                {printers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            <select
              className="ng-select rbp-panel__pagesize-select rbp-panel__sticker-size-select"
              value={stickerSize}
              onChange={(e) => setStickerSize(e.target.value)}
              aria-label="Sticker size"
              title="Must match your physical label roll (width × height mm)"
            >
              {Object.entries(STICKER_SIZES)
                .sort(([, a], [, b]) => b.width * b.height - a.width * a.height)
                .map(([key, size]) => (
                  <option key={key} value={key}>
                    {size.width}×{size.height} mm
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="rbp-panel__icon-btn rbp-panel__print-btn"
              onClick={handlePrintStickers}
              disabled={printingStickers || !isPrinterReady || selectedRowKeys.length === 0}
              title={
                printingStickers
                  ? "Printing stickers…"
                  : isPrinterReady
                    ? isBridgeConnected
                      ? `Print stickers${selectedRowKeys.length ? ` (${selectedRowKeys.length})` : ""} — TSC via Windows RAW`
                      : `Print stickers${selectedRowKeys.length ? ` (${selectedRowKeys.length})` : ""} — via QZ Tray`
                    : printMode === "none"
                      ? "Print stickers — run: npm run print-bridge in project folder"
                      : "Print stickers — select your TSC TA200 printer"
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
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((n) => (
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
          loading={loading || columnsLoading}
          error={error}
          loaderText="Loading Report Boards…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={pageSizeOptions}
          emptyMessage={selectedDivision ? "No report board data found." : "Select a division."}
          hideHeader
          fill={fill}
          searchable
          selectable
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={handleSelectionChange}
          getRowKey={getReportRowKey}
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
