import { chromium } from "playwright";

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

await page.goto("http://localhost:5176/admin/user-master", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

// Search for "asharma" — should have been "asharma33446" per my earlier report,
// or the truncated "asharma334" if the 10-char limit silently clipped it.
const searchBox = page.locator('input[placeholder*="Search"]').last();
await searchBox.fill("Amisha");
await page.waitForTimeout(700);
await page.screenshot({ path: "_um_verify_1.png", fullPage: true });

const rowsText = await page.locator("tbody tr").allTextContents();
console.log("MATCHING ROWS:", JSON.stringify(rowsText));

// Open the edit form for the matched row to see the actual stored User ID.
await page.locator("tbody tr").first().locator("a, td").first().click().catch(() => {});
const editBtn = page.locator("tbody tr").first().locator('button, a[title*="Edit" i]').first();
await editBtn.click();
await page.waitForTimeout(1200);
await page.screenshot({ path: "_um_verify_2_edit.png", fullPage: true });
const userIdField = page.locator(".um-form-row", { hasText: "User ID" }).first().locator("input").first();
const actualUserId = await userIdField.inputValue().catch(() => "N/A");
console.log("ACTUAL STORED User ID for Amisha Sharma:", JSON.stringify(actualUserId));

await browser.close();
