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

// Select ONE master row (the very first one -- same "Chair Handle" the user reported).
const masterSection = page.locator("text=Master Items").locator("xpath=ancestor::section[1]");
await masterSection.locator("tbody input[type='checkbox']").first().click();
await page.waitForTimeout(800);

console.log("Immediately after picking 1 master row (auto-select default):", await page.locator(".apin-selection-toolbar__count").innerText());

const detailSection = page.locator("text=Matching Transactions").locator("xpath=ancestor::section[1]");
const rowsBefore = await detailSection.locator("tbody tr").allInnerTexts();
console.log("\nAll matching detail rows (should all start CHECKED by default):");
rowsBefore.forEach((t, i) => console.log(`  [${i}]`, t.replace(/\s+/g, " | ")));

const detailCheckboxes = detailSection.locator("tbody input[type='checkbox']");
const checkedStatesBefore = [];
for (let i = 0; i < await detailCheckboxes.count(); i++) {
  checkedStatesBefore.push(await detailCheckboxes.nth(i).isChecked());
}
console.log("\nCheckbox states BEFORE any manual click:", checkedStatesBefore);

// Now click exactly ONE row's checkbox -- the user's described action.
console.log("\n--- Clicking row [0]'s checkbox once (simulating 'I selected only one') ---");
await detailCheckboxes.nth(0).click();
await page.waitForTimeout(400);

const checkedStatesAfter = [];
for (let i = 0; i < await detailCheckboxes.count(); i++) {
  checkedStatesAfter.push(await detailCheckboxes.nth(i).isChecked());
}
console.log("Checkbox states AFTER clicking row [0] once:", checkedStatesAfter);
console.log("Toolbar count after that single click:", await page.locator(".apin-selection-toolbar__count").innerText());

await browser.close();
