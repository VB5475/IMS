import React from "react";
import { QrCode, Search } from "lucide-react";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import "./assetTxnScanControls.css";

export default function AssetTxnScanControls({
  idPrefix = "asset-txn",
  isEditMode,
  scanQrLoading,
  scanQrError,
  headerScanValue,
  srSearchValue,
  lastQrItem,
  headerScanRef,
  srSearchRef,
  onHeaderScanChange,
  onSrSearchChange,
  onHeaderScanKeyDown,
  onHeaderScanPaste,
  onSrSearchKeyDown,
  onSrSearchPaste,
}) {
  return (
    <>
      <label
        className={`asset-txn-qr-search${!isEditMode ? " asset-txn-qr-search--disabled" : ""}${scanQrLoading ? " asset-txn-qr-search--busy" : ""}`}
        title={FORM_SHORTCUT_TITLES.scanQr}
      >
        <span className="asset-txn-qr-search__icon" aria-hidden="true">
          <QrCode size={16} strokeWidth={2.4} />
        </span>
        <input
          id={`${idPrefix}-header-qr-scan`}
          ref={headerScanRef}
          type="text"
          className="asset-txn-qr-search__input"
          value={headerScanValue}
          onChange={onHeaderScanChange}
          onKeyDown={onHeaderScanKeyDown}
          onPaste={onHeaderScanPaste}
          placeholder={scanQrLoading ? "Fetching…" : "Scan QR code…"}
          disabled={!isEditMode}
          readOnly={scanQrLoading}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Scan QR with hardware scanner"
        />
        <kbd className="asset-txn-qr-search__kbd">Ctrl+Q</kbd>
      </label>

      <label
        className={`asset-txn-qr-search asset-txn-sr-search${!isEditMode ? " asset-txn-qr-search--disabled" : ""}${scanQrLoading ? " asset-txn-qr-search--busy" : ""}`}
        title="Search by serial number"
      >
        <span className="asset-txn-qr-search__icon" aria-hidden="true">
          <Search size={16} strokeWidth={2.4} />
        </span>
        <input
          id={`${idPrefix}-header-sr-search`}
          ref={srSearchRef}
          type="text"
          className="asset-txn-qr-search__input"
          value={srSearchValue}
          onChange={onSrSearchChange}
          onKeyDown={onSrSearchKeyDown}
          onPaste={onSrSearchPaste}
          placeholder={scanQrLoading ? "Fetching…" : "Search by serial number"}
          disabled={!isEditMode}
          readOnly={scanQrLoading}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Search by serial number"
          aria-invalid={Boolean(scanQrError)}
        />
      </label>
      {scanQrError ? (
        <span className="asset-txn-sr-search__error" role="alert">{scanQrError}</span>
      ) : null}

      {lastQrItem?.itemcode || lastQrItem?.srno ? (
        <span className="asset-txn-last-qr" title="Last scanned item">
          <span className="asset-txn-last-qr__label">Last scan</span>
          {lastQrItem.itemcode ? (
            <span className="asset-txn-last-qr__pair">
              <span className="asset-txn-last-qr__key">Item</span>
              <strong>{lastQrItem.itemcode}</strong>
            </span>
          ) : null}
          {lastQrItem.srno ? (
            <span className="asset-txn-last-qr__pair">
              <span className="asset-txn-last-qr__key">Sr No</span>
              <strong>{lastQrItem.srno}</strong>
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
}
