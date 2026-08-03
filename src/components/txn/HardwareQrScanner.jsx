// HardwareQrScanner.jsx — manual Item Code / Sr No entry + scanned history.
// Hardware machine scanning lives in the parent grid header search field.

import React, { useRef, useState, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { parseQrItemPayload } from "../../utils/qrScanJson";
import "./HardwareQrScanner.css";

export default function HardwareQrScanner({
  disabled = false,
  showHistory = true,
  /** @type {{ id?: string|number, itemcode?: string, srno?: string }[]} */
  history = [],
  onRemoveHistory,
  onScan,
  hint = "Enter Item Code and Sr No, then press Enter or Fetch Item.",
  autoFocusItemcode = true,
}) {
  const [itemcode, setItemcode] = useState("");
  const [srno, setSrno] = useState("");
  const itemcodeRef = useRef(null);
  const srnoRef = useRef(null);

  const commitScanPayload = useCallback((code, serial) => {
    if (disabled) return;
    const nextCode = String(code ?? "").trim();
    const nextSrno = String(serial ?? "").trim();
    if (!nextCode || !nextSrno) return;
    console.log("[QR Scan] manual commit", { itemcode: nextCode, srno: nextSrno });
    setItemcode("");
    setSrno("");
    onScan?.(JSON.stringify({ itemcode: nextCode, srno: nextSrno }));
  }, [disabled, onScan]);

  const commitManual = useCallback(() => {
    commitScanPayload(itemcode, srno);
  }, [commitScanPayload, itemcode, srno]);

  const handleManualKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    const code = String(itemcode).trim();
    const serial = String(srno).trim();
    if (code && serial) {
      commitManual();
      return;
    }
    if (e.currentTarget === itemcodeRef.current && !serial) {
      srnoRef.current?.focus();
      return;
    }
    if (e.currentTarget === srnoRef.current && !code) {
      itemcodeRef.current?.focus();
    }
  };

  const handleManualPaste = (e) => {
    if (disabled) return;
    const text = e.clipboardData?.getData("text") ?? "";
    const parsed = parseQrItemPayload(text);
    if (!parsed) return;
    e.preventDefault();
    commitScanPayload(parsed.itemcode, parsed.srno);
  };

  const bothReady = Boolean(String(itemcode).trim() && String(srno).trim());

  return (
    <div className={`hw-qr${disabled ? " hw-qr--disabled" : ""}`}>
      <div className="hw-qr__manual">
        <div className="hw-qr__fields">
          <div className="hw-qr__field">
            <label className="hw-qr__label" htmlFor="hw-qr-itemcode">
              Item Code
            </label>
            <input
              id="hw-qr-itemcode"
              ref={itemcodeRef}
              type="text"
              className="hw-qr__input"
              value={itemcode}
              onChange={(e) => setItemcode(e.target.value)}
              onKeyDown={handleManualKeyDown}
              onPaste={handleManualPaste}
              placeholder="e.g. ASS000595"
              disabled={disabled}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus={autoFocusItemcode}
              aria-label="Item code"
            />
          </div>

          <div className="hw-qr__field">
            <label className="hw-qr__label" htmlFor="hw-qr-srno">
              Sr No
            </label>
            <input
              id="hw-qr-srno"
              ref={srnoRef}
              type="text"
              className="hw-qr__input"
              value={srno}
              onChange={(e) => setSrno(e.target.value)}
              onKeyDown={handleManualKeyDown}
              onPaste={handleManualPaste}
              placeholder="e.g. S4EUNZ0R200413"
              disabled={disabled}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Serial number"
            />
          </div>
        </div>

        <div className="hw-qr__actions">
          <button
            type="button"
            className="hw-qr__fetch-btn"
            onClick={commitManual}
            disabled={disabled || !bothReady}
          >
            Fetch Item
          </button>
        </div>
      </div>

      {hint ? <p className="hw-qr__hint">{hint}</p> : null}

      {showHistory ? (
        <div className="hw-qr__history">
          <div className="hw-qr__history-header">
            <span className="hw-qr__history-title">Scanned history</span>
            <span className="hw-qr__history-count">{history.length}</span>
          </div>
          {history.length === 0 ? (
            <p className="hw-qr__history-empty">No successful scans yet.</p>
          ) : (
            <ul className="hw-qr__history-list">
              {history.map((item, index) => (
                <li key={item.id ?? `${item.itemcode}-${item.srno}-${index}`} className="hw-qr__history-item">
                  <span className="hw-qr__history-index">{index + 1}</span>
                  <div className="hw-qr__history-meta">
                    <div className="hw-qr__history-row">
                      <span className="hw-qr__history-key">Item</span>
                      <strong className="hw-qr__history-val">{item.itemcode || "—"}</strong>
                    </div>
                    <div className="hw-qr__history-row">
                      <span className="hw-qr__history-key">Sr No</span>
                      <strong className="hw-qr__history-val">{item.srno || "—"}</strong>
                    </div>
                  </div>
                  {onRemoveHistory ? (
                    <button
                      type="button"
                      className="hw-qr__history-remove"
                      onClick={() => onRemoveHistory(item)}
                      disabled={disabled}
                      title="Remove from history and item grid"
                      aria-label={`Remove ${item.itemcode || "item"}`}
                    >
                      <Trash2 size={13} strokeWidth={2.25} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
