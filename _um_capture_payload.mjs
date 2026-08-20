import { chromium } from "playwright";
import fs from "fs";

const SCRATCH = "C:/Users/ADMINI~1/AppData/Local/Temp/claude/d--Hardik-Shah-CAI-Projects-IMS/9b86d445-2bbc-48c0-ac9c-e6f00d56604c/scratchpad";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext();
await context.addInitScript(() => {
  localStorage.setItem(
    "ims_user_session",
    JSON.stringify({
      isAuthenticated: true, loginId: 1, companyId: 1, yearId: 2,
      company: { companyId: 1, companyName: "Test Co" },
      year: { yearId: 2, yearName: "2025-26" },
    })
  );
});
const page = await context.newPage();

let capturedRequest = null;
let capturedResponse = null;
page.on("request", (req) => {
  if (req.url().includes("Post_RB_GenUserMst_Save")) {
    capturedRequest = { url: req.url(), method: req.method(), headers: req.headers(), postData: req.postData() };
  }
});
page.on("response", async (res) => {
  if (res.url().includes("Post_RB_GenUserMst_Save")) {
    try { capturedResponse = await res.text(); } catch {}
  }
});

await page.goto("http://localhost:5176/admin/user-master", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.locator('button:has-text("Entry Form"), button:has-text("Add")').first().click();
await page.waitForTimeout(900);

async function fillByLabel(labelText, value) {
  const field = page.locator(".um-form-row", { hasText: labelText }).first();
  await field.locator("input").first().fill(value);
}
async function pickByLabel(labelText) {
  const field = page.locator(".um-form-row", { hasText: labelText }).first();
  await field.locator(".search-select__trigger, select").first().click();
  await page.waitForTimeout(350);
  await page.locator(".search-select__option").first().click();
  await page.waitForTimeout(250);
}

await pickByLabel("Designation");
await fillByLabel("User ID", "capturetest001");
await fillByLabel("User Name", "Capture Test Employee");
await pickByLabel("Group Name");
await fillByLabel("Email Address", "capturetest001@example.invalid");
await pickByLabel("Dept Name");
await pickByLabel("Location Name");
await fillByLabel("Password", "Test@12345");
await fillByLabel("Verify Password", "Test@12345");

await page.locator('button:has-text("Save")').click();
await page.waitForTimeout(1800);
await page.screenshot({ path: `${SCRATCH.replace("C:/Users/ADMINI~1/AppData/Local/Temp/claude/d--Hardik-Shah-CAI-Projects-IMS/9b86d445-2bbc-48c0-ac9c-e6f00d56604c/scratchpad", "d:/Hardik Shah CAI/Projects/IMS")}/_um_capture_result.png`, fullPage: true }).catch(() => {});

fs.writeFileSync(`${SCRATCH}/um_captured_request.json`, JSON.stringify(capturedRequest, null, 2));
fs.writeFileSync(`${SCRATCH}/um_captured_response.json`, capturedResponse || "null");

console.log("CAPTURED REQUEST:", JSON.stringify(capturedRequest, null, 2));
console.log("CAPTURED RESPONSE:", capturedResponse);

await browser.close();
