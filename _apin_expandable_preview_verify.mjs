import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext();
await context.addInitScript(() => {
  localStorage.setItem("ims_user_session", JSON.stringify({
    isAuthenticated: true, loginId: 1, companyId: 1, yearId: 2,
    company: { companyid: 1, companyname: "Test Co" },
    year: { yearid: 2, yearname: "2026-27" },
  }));
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(err.message));
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

await page.goto("http://localhost:5176/assets-part-indent", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const fromDateInput = page.locator(".apin-filter-field").nth(1).locator("input.date-input-field, input");
await fromDateInput.click();
await fromDateInput.fill("").catch(() => {});
await fromDateInput.pressSequentially("01012020", { delay: 30 }).catch(() => {});
await page.locator("h1, .ent-page-title").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.waitForTimeout(300);

const divTrigger = page.locator(".apin-filter-field").first().locator(".search-select__trigger, input");
await divTrigger.click().catch(() => {});
await page.waitForTimeout(600);
await page.locator(".search-select__option, [role='option']").first().click();
await page.waitForTimeout(400);
await page.locator("button:has-text('Search')").click();
await page.waitForTimeout(2500);

const masterSection = page.locator("text=Master Items").locator("xpath=ancestor::section[1]");
const masterCheckboxes = masterSection.locator("tbody input[type='checkbox']");

// Select 2 master rows to get 2 groups in the preview.
await masterCheckboxes.nth(0).click();
await page.waitForTimeout(600);
await masterCheckboxes.nth(1).click();
await page.waitForTimeout(600);

console.log("Toolbar count:", await page.locator(".apin-selection-toolbar__count").innerText());

await page.locator("button:has-text('Preview Selection')").click();
await page.waitForTimeout(700);

await page.screenshot({ path: "apin_expand_1_collapsed.png", fullPage: true });

// Expect 2 collapsed panels (CollapsibleGrid defaults to collapsed).
const panelHeaders = page.locator(".modal-body .cg-header");
const panelCount = await panelHeaders.count();
console.log("Collapsible panel headers found:", panelCount);
for (let i = 0; i < panelCount; i++) {
  console.log(`  Panel [${i}] text:`, (await panelHeaders.nth(i).innerText()).replace(/\s+/g, " "));
}

// Expand the first panel.
await panelHeaders.nth(0).click();
await page.waitForTimeout(600);
await page.screenshot({ path: "apin_expand_2_first_expanded.png", fullPage: true });

// Expand the second panel too.
await panelHeaders.nth(1).click();
await page.waitForTimeout(600);
await page.screenshot({ path: "apin_expand_3_both_expanded.png", fullPage: true });

console.log("\nPage errors:", errors.length ? errors : "none");
await browser.close();
