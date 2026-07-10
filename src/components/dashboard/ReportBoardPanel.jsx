import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FileText, QrCode, Printer } from "lucide-react";
import EnterpriseDataGrid from "../grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useNotification } from "../../context/NotificationContext";
import { useStickerPrinter } from "../../hooks/useStickerPrinter";
import { STICKER_SIZES } from "../../utils/assetQrStickerConstants";
import { resolveAssetQrFields } from "../../utils/assetQrUtils";
import "./ReportBoardPanel.css";

const REPORT_COLUMNS = [
  {
    key: "itemcode",
    label: "Item Code",
    width: "12%",
    filterable: true,
  },
  {
    key: "itemname",
    label: "Item Name",
    width: "26%",
    minWidth: 240,
    filterable: true,
    align: "left",
  },
  {
    key: "newmln",
    label: "MLN",
    width: "12%",
    filterable: true,
  },
  {
    key: "baseqty",
    label: "Qty",
    width: "8%",
    align: "right",
    filterable: true,
    filterType: "number",
    render: (value) => Number(value ?? 0).toFixed(2),
  },
  {
    key: "baseunit",
    label: "Unit",
    width: "10%",
    filterable: true,
    align: "left",
  },
  {
    key: "assetsrno",
    label: "Asset Sr No",
    width: "12%",
    filterable: true,
  },
  {
    key: "remark",
    label: "Remark",
    width: "20%",
    minWidth: 180,
    filterable: true,
    align: "left",
  },
];

const PAGE_SIZE_OPTIONS = {
  compact: [5, 8, 10, 15, 20],
  default: [5, 10, 20, 50, 99],
};

const DEFAULT_MASTER_ID = 1;
const DEFAULT_SESSION_ID = 1;

function resolveValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (value != null && value !== "") return value;
  }
  return fallback;
}

function mapDivisionOptions(rows) {
  const options = (rows || []).map((row) => ({
    value: String(
      resolveValue(
        row,
        ["fromdivisionid"],
        "0"
      )
    ),
    label: String(
      resolveValue(
        row,
        [
          "fromdivision",

        ],
        ""
      )
    ),
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
    ObjType: 2,
    ObjName: "fn_tbl_fetch_adb_aststockissue",
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

function getReportRowKey(row, index) {
  const { itemcode, srno } = resolveAssetQrFields(row);
  if (itemcode && srno) return `${itemcode}|${srno}`;
  return `row-${index}`;
}

export default function ReportBoardPanel({ compact = false, fill = compact }) {
  const { get } = useApi(API_BASE_URL);
  const notify = useNotification();

  const [data, setData] = useState([]);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
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

  const fetchDivisions = useCallback(async () => {
    try {
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildDivisionParams());
      const options = mapDivisionOptions(json);
      setDivisionOptions(options);
      setSelectedDivision((current) => current || options[0]?.value || "");
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
        await fetchDivisions();
      } catch (err) {
        if (!active) return;
        setError("Failed to load divisions.");
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchDivisions]);

  const fetchReportBoards = useCallback(async (divisionId) => {
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
  }, [get]);

  useEffect(() => {
    fetchReportBoards(selectedDivision);
    setSelectedRowKeys([]);
  }, [fetchReportBoards, selectedDivision]);

  const selectedRows = useMemo(() => {
    const keySet = new Set(selectedRowKeys.map(String));
    return data.filter((row, index) => keySet.has(String(getReportRowKey(row, index))));
  }, [data, selectedRowKeys]);

  const handleDownloadQrCodes = useCallback(async () => {
    if (selectedRows.length === 0) {
      notify.error("Select at least one row to download QR codes.");
      return;
    }
    setDownloadingQr(true);
    try {
      const { downloadAssetQrCodes } = await import("../../utils/assetQrPrint");
      const count = await downloadAssetQrCodes(selectedRows);
      notify.success(`Downloaded PDF with ${count} QR code(s).`);
    } catch (err) {
      notify.error(err?.message || "Failed to generate QR codes.");
    } finally {
      setDownloadingQr(false);
    }
  }, [notify, selectedRows]);

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

  return (
    <section
      className={`rbp-panel ${fill ? "rbp-panel--fill" : ""} ${compact ? "rbp-panel--compact" : ""}`}
    >
      <header className="rbp-panel__header">
        <div className="rbp-panel__title">
          <FileText size={14} strokeWidth={2} />
          <span>Report Boards</span>
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
            className="rbp-panel__print-btn"
            onClick={handlePrintStickers}
            disabled={printingStickers || !isPrinterReady || selectedRowKeys.length === 0}
            title={
              isPrinterReady
                ? isBridgeConnected
                  ? "Print directly to TSC via Windows RAW"
                  : "Print via QZ Tray (check Remember on Allow prompt)"
                : printMode === "none"
                  ? "Run: npm run print-bridge in project folder"
                  : "Select your TSC TA200 printer"
            }
          >
            <Printer size={14} strokeWidth={2} />
            <span>
              {printingStickers
                ? "Printing…"
                : `Print${selectedRowKeys.length ? ` (${selectedRowKeys.length})` : ""}`}
            </span>
          </button>
          <button
            type="button"
            className="rbp-panel__qr-btn rbp-panel__qr-btn--secondary"
            onClick={handleDownloadQrCodes}
            disabled={downloadingQr || selectedRowKeys.length === 0}
            title="Download QR codes PDF for selected assets"
          >
            <QrCode size={14} strokeWidth={2} />
            <span>
              {downloadingQr ? "Generating…" : `PDF${selectedRowKeys.length ? ` (${selectedRowKeys.length})` : ""}`}
            </span>
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
        columns={REPORT_COLUMNS}
        data={data}
        loading={loading}
        error={error}
        loaderText="Loading Report Boards…"
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        pageSizeOptions={pageSizeOptions}
        emptyMessage={selectedDivision ? "No report board data found." : "Select a division."}
        hideHeader
        fill={fill}
        selectable
        selectedRowKeys={selectedRowKeys}
        onSelectionChange={setSelectedRowKeys}
        getRowKey={getReportRowKey}
      />
    </section>
  );
}
