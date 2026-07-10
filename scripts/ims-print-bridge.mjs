import http from "http";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const PORT = 9123;
const HOST = "127.0.0.1";
const PS_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "Send-RawToPrinter.ps1");

function runPowerShell(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS_SCRIPT, ...args],
      { windowsHide: true }
    );
    let out = "";
    let err = "";
    proc.stdout.on("data", (chunk) => {
      out += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      err += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(err.trim() || out.trim() || `PowerShell exited ${code}`));
    });
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  try {
    if (req.url === "/health" && req.method === "GET") {
      const out = await runPowerShell(["-Action", "list"]);
      const printers = JSON.parse(out || "[]");
      sendJson(res, 200, { ok: true, printers: Array.isArray(printers) ? printers : [printers] });
      return;
    }

    if (req.url === "/print" && req.method === "POST") {
      const body = await readBody(req);
      const { printer, data } = JSON.parse(body || "{}");
      if (!printer || !data) {
        sendJson(res, 400, { ok: false, error: "printer and data are required" });
        return;
      }
      const encoded = Buffer.from(String(data), "utf8").toString("base64");
      const out = await runPowerShell([
        "-Action",
        "print",
        "-Printer",
        printer,
        "-DataBase64",
        encoded,
      ]);
      const result = JSON.parse(out || "{}");
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err?.message || "Print bridge error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`IMS print bridge listening on http://${HOST}:${PORT}`);
});
