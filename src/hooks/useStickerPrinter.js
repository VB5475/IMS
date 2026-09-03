import { useState, useEffect, useCallback, useRef } from "react";

const PRINTER_STORAGE_KEY = "ims_sticker_printer";
const STICKER_SIZE_STORAGE_KEY = "ims_sticker_size";

let qzSecurityConfigured = false;

function configureQzSecurity(qz) {
  if (qzSecurityConfigured) return;
  qzSecurityConfigured = true;

  qz.security.setCertificatePromise((resolve, reject) => {
    fetch("/qz-tray-certificate.txt", { cache: "no-store" })
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then(resolve)
      .catch(() =>
        fetch("https://demo.qz.io/assets/signing/digital-certificate.txt", {
          cache: "no-store",
        })
          .then((res) => (res.ok ? res.text() : Promise.reject()))
          .then(resolve)
          .catch(reject)
      );
  });

  qz.security.setSignaturePromise(() => (resolve) => resolve());
}

function loadSavedPrinterName() {
  return localStorage.getItem(PRINTER_STORAGE_KEY) || "";
}

function pickTscPrinter(printers) {
  return printers.find((name) => /tsc/i.test(name)) || printers[0] || "";
}

function applyPrinterSelection(list, setSelectedPrinterState) {
  if (list.length === 0) {
    setSelectedPrinterState("");
    return;
  }
  const saved = loadSavedPrinterName();
  if (saved && list.includes(saved)) {
    setSelectedPrinterState(saved);
    return;
  }
  const preferred = pickTscPrinter(list);
  setSelectedPrinterState(preferred);
  localStorage.setItem(PRINTER_STORAGE_KEY, preferred);
}

export function useStickerPrinter() {
  const [status, setStatus] = useState("connecting");
  const [printMode, setPrintMode] = useState("none");
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinterState] = useState(loadSavedPrinterName);
  const [stickerSize, setStickerSizeState] = useState(
    () => localStorage.getItem(STICKER_SIZE_STORAGE_KEY) || "100x50"
  );
  const [error, setError] = useState(null);

  const qzRef = useRef(null);
  const mountedRef = useRef(true);

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;

    setStatus((prev) => (prev === "connected" ? prev : "connecting"));
    setError(null);

    try {
      const qzModule = await import("qz-tray");
      const qz = qzModule.default;
      configureQzSecurity(qz);
      qzRef.current = qz;

      if (!qz.websocket.isActive()) {
        await qz.websocket.connect({ retries: 3, delay: 1 });
      }

      const found = await qz.printers.find();
      if (!mountedRef.current) return;

      const list = Array.isArray(found) ? found : [];
      setPrintMode("qz");
      setPrinters(list);
      setStatus("connected");

      if (list.length === 0) {
        setSelectedPrinterState("");
        setError("No printers found. Check TSC TA200 is installed in Windows.");
        return;
      }

      applyPrinterSelection(list, setSelectedPrinterState);
    } catch (err) {
      if (!mountedRef.current) return;
      qzRef.current = null;
      setPrintMode("none");
      setPrinters([]);
      setStatus("disconnected");
      setError("Install and start QZ Tray from qz.io/download, then click QZ to reconnect.");
      if (import.meta.env.DEV) {
        console.info("[StickerPrinter] unavailable:", err?.message || err);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      const qz = qzRef.current;
      if (qz?.websocket?.isActive()) {
        qz.websocket.disconnect().catch(() => {});
      }
    };
  }, [connect]);

  const selectPrinter = useCallback((name) => {
    setSelectedPrinterState(name);
    if (name) localStorage.setItem(PRINTER_STORAGE_KEY, name);
    else localStorage.removeItem(PRINTER_STORAGE_KEY);
  }, []);

  const setStickerSize = useCallback((size) => {
    setStickerSizeState(size);
    localStorage.setItem(STICKER_SIZE_STORAGE_KEY, size);
  }, []);

  const isConnected = status === "connected";
  const isPrinterReady =
    isConnected && Boolean(selectedPrinter) && printers.includes(selectedPrinter);

  return {
    status,
    printMode,
    printers,
    selectedPrinter,
    selectPrinter,
    stickerSize,
    setStickerSize,
    isPrinterReady,
    isQzConnected: isConnected && printMode === "qz",
    isBridgeConnected: isConnected && printMode === "bridge",
    error,
    reconnect: connect,
    getQz: () => qzRef.current,
  };
}
