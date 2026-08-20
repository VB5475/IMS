// Full ZingHR -> IMS User Master sync.
// 1. Pages through ZingHR's GetEmployeeMasterDetails to pull all employees.
// 2. POSTs each one directly to IMS's Post_RB_GenUserMst_Save, cloning the
//    exact payload shape captured from a real successful UI-driven save
//    (see _um_capture_payload.mjs output) so field names/types/context
//    values match precisely instead of being hand-reconstructed.
import fs from "fs";

const SCRATCH = "C:/Users/ADMINI~1/AppData/Local/Temp/claude/d--Hardik-Shah-CAI-Projects-IMS/9b86d445-2bbc-48c0-ac9c-e6f00d56604c/scratchpad";
const ZING_URL = "https://portal.zinghr.com/2015/route/EmployeeDetails/GetEmployeeMasterDetails";
const ZING_TOKEN = "c94e40b60ee24e36a35b47796dec2c9d";
const IMS_SAVE_URL = "http://122.179.135.100:8095/IMS_LIVE/API/GenUserMst/Post_RB_GenUserMst_Save";

const PAGE_SIZE = 2000;
const CONCURRENCY = 8;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

// ── 1. Fetch all employees from ZingHR ──────────────────────────────────
async function fetchAllEmployees() {
  const all = new Map(); // EmployeeID -> employee, de-dupes across pages
  let pageNumber = 1;
  let total = Infinity;
  while (all.size < total) {
    const res = await fetch(ZING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        SubscriptionName: "IMSPLGROUP",
        Token: ZING_TOKEN,
        Fromdate: "01-05-2022",
        ToDate: "10-05-2022",
        PageSize: PAGE_SIZE,
        PageNumber: pageNumber,
      }),
    });
    const data = await res.json();
    total = Number(data.TotalEmployeeCount) || total;
    const batch = data.Employees || [];
    if (batch.length === 0) break;
    batch.forEach((e) => all.set(e.EmployeeID, e));
    log(`ZingHR page ${pageNumber}: got ${batch.length}, running total ${all.size}/${total}`);
    pageNumber++;
    if (pageNumber > 20) break; // sanity guard
  }
  return [...all.values()];
}

// ── 2. Sync one employee into IMS User Master ───────────────────────────
function buildSaveRow(emp) {
  const userId = `e${emp.EmployeeID}`.slice(0, 10);
  const username = String(emp.EmployeeName || `${emp.FirstName} ${emp.LastName}`).replace(/\s+/g, " ").trim();
  return {
    idnumber: 0,
    desgid: 1,
    userid: userId,
    username,
    pwd: "Test@12345",
    groupid: 10171,
    email: emp.Email || "",
    deptid: 1,
    isadminuser: 0,
    isdivisionhead: 0,
    isdepthead: 0,
    locationid: 47,
    logdate: new Date().toISOString().slice(0, 19),
    loginid: 1,
    sessionid: 88,
    yearid: 2,
    compuniquekey: "",
    entrystatus: 0,
    funccode: "rb_genusermst",
    verifypwd: "Test@12345",
  };
}

async function syncOne(emp, attempt = 1) {
  const row = buildSaveRow(emp);
  const payload = {
    prmStrMstJSON: JSON.stringify([row]),
    prmStrDetJSON: "[]",
    prmYearID: 2,
    prmLoginID: 1,
    prmDivisionID: 0,
    prmMode: "A",
    prmIPAddress: "",
    prmOtherInfo: "",
  };
  try {
    const res = await fetch(IMS_SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    const entry = Array.isArray(parsed) ? parsed[0] : parsed;
    const errCode = entry?.ErrCode ?? entry?.errcode;
    const errMsg = entry?.ErrMsg ?? entry?.errmsg ?? text;
    if (String(errCode) === "1") {
      const idMatch = String(errMsg).match(/ID\[\s*(\d+)\s*\]/i);
      return { employeeId: emp.EmployeeID, name: row.username, userid: row.userid, success: true, id: idMatch ? idMatch[1] : null, reason: null };
    }
    return { employeeId: emp.EmployeeID, name: row.username, userid: row.userid, success: false, id: null, reason: String(errMsg).slice(0, 300) };
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000));
      return syncOne(emp, attempt + 1);
    }
    return { employeeId: emp.EmployeeID, name: row.username, userid: row.userid, success: false, id: null, reason: `Network/script error: ${err.message}` };
  }
}

// Simple bounded-concurrency pool.
async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let done = 0;
  async function runner() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
      done++;
      if (done % 250 === 0 || done === items.length) {
        const s = results.slice(0, i + 1).filter((r) => r?.success).length;
        log(`Progress: ${done}/${items.length} processed, ${s} succeeded so far`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, runner));
  return results;
}

async function main() {
  log("Fetching all employees from ZingHR...");
  const employees = await fetchAllEmployees();
  log(`Fetched ${employees.length} unique employees from ZingHR.`);
  fs.writeFileSync(`${SCRATCH}/zinghr_all_employees.json`, JSON.stringify(employees));

  log(`Starting IMS sync, concurrency=${CONCURRENCY}...`);
  const results = await runPool(employees, syncOne, CONCURRENCY);

  fs.writeFileSync(`${SCRATCH}/zinghr_sync_results.json`, JSON.stringify(results, null, 2));

  const successResults = results.filter((r) => r.success);
  const failResults = results.filter((r) => !r.success);
  log("=== FINAL SUMMARY ===");
  log("Total processed:", results.length);
  log("Success count:", successResults.length);
  log("Failed count:", failResults.length);

  // Aggregate failure reasons so a repeated cause doesn't flood the log.
  const reasonCounts = {};
  failResults.forEach((r) => {
    reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
  });
  log("Failure reason breakdown:", JSON.stringify(reasonCounts, null, 2));
}

main().catch((err) => {
  log("FATAL ERROR:", err);
  process.exit(1);
});
