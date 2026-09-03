const BRIDGE_URL = "http://127.0.0.1:9123";

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
