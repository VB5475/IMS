const BRIDGE_URL = "http://127.0.0.1:9123";
const HEALTH_TIMEOUT_MS = 2000;

export async function checkPrintBridge() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const res = await fetch(`${BRIDGE_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.ok) return null;
    return json;
  } catch {
    return null;
  }
}

export async function printRawToWindowsPrinter(printerName, tsplData) {
  const res = await fetch(`${BRIDGE_URL}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ printer: printerName, data: tsplData }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || "Windows RAW print failed.");
  }
  return json;
}
