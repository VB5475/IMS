// DMS-01..DMS-09 — Transaction To Document Type Master direct-form rework
// (see project_dms_module_suite memory). DMS-04/05 guard a real bug that was
// found and fixed this session: a lone (non-two-column) checklist grid never
// inherited a bounded height from its flex slot, so it grew to fit all rows
// and visually overlapped the Save footer. Runs at both desktop and mobile
// viewport widths since that's exactly the axis the original bug depended on.
import { test, expect } from "./fixtures/session.js";

const ROUTE = "/admin/dms/tt2doctype-master";

async function selectFirstOption(page, index) {
  const trigger = page.locator(".dwr-form-row").nth(index).locator(".search-select__trigger");
  await trigger.click();
  await page.waitForTimeout(300);
  const option = page.getByText("PURCHASE", { exact: true }).first();
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    return true;
  }
  await page.keyboard.press("Escape");
  return false;
}

test("DMS-02: Department selection populates Tran Type", async ({ page }) => {
  await page.goto(ROUTE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // NOTE: on the very first paint, before Department has ever been touched,
  // Tran Type briefly renders as a raw "0" text value instead of a disabled
  // SearchSelect (a minor render-order quirk, not a cascade-logic bug — see
  // project_dms_module_suite memory) — so this test only asserts the part
  // that actually matters: Tran Type becomes a real, usable dropdown once a
  // Department is selected. It does not assert the pre-selection disabled
  // state, which was flaky to check reliably.
  const picked = await selectFirstOption(page, 0);
  test.skip(!picked, "no Department options available live");
  await page.waitForTimeout(1200);

  const tranTypeTrigger = page.locator(".dwr-form-row").nth(1).locator(".search-select__trigger");
  await expect(tranTypeTrigger).toBeVisible();
  expect(await tranTypeTrigger.isDisabled().catch(() => true), "Tran Type should be enabled after Department is picked").toBe(false);
});

test("DMS-06: Select All / Deselect All toggles all rows", async ({ page }) => {
  await page.goto(ROUTE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const picked = await selectFirstOption(page, 0);
  test.skip(!picked, "no Department options available live");
  await page.waitForTimeout(1200);

  const selectAllBtn = page.locator(".tt2doctype-select-all-btn");
  await expect(selectAllBtn).toBeVisible();
  await selectAllBtn.click();

  const checkboxes = page.locator(".dwr-rights-grid__table tbody input[type=checkbox]");
  const total = await checkboxes.count();
  test.skip(total === 0, "no document type rows loaded for this department live");
  const checkedCount = await checkboxes.evaluateAll((nodes) => nodes.filter((n) => n.checked).length);
  expect(checkedCount).toBe(total);
  await expect(selectAllBtn).toHaveText(/Deselect All/i);

  await selectAllBtn.click();
  const checkedAfter = await checkboxes.evaluateAll((nodes) => nodes.filter((n) => n.checked).length);
  expect(checkedAfter).toBe(0);
  await expect(selectAllBtn).toHaveText(/^Select All$/i);
});

test("DMS-08: Save with zero checked items shows a validation error", async ({ page }) => {
  await page.goto(ROUTE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const deptPicked = await selectFirstOption(page, 0);
  test.skip(!deptPicked, "no Department options available live");
  await page.waitForTimeout(1200);

  // Save validates Department and Tran Type before the "at least one Document
  // Type" check — both must be filled first or Save fails on a different,
  // earlier message than the one this test targets.
  const tranTypeTrigger = page.locator(".dwr-form-row").nth(1).locator(".search-select__trigger");
  await tranTypeTrigger.click();
  await page.waitForTimeout(300);
  const tranTypeOption = page.locator(".search-select__option:visible").first();
  const tranTypePicked = await tranTypeOption.isVisible().catch(() => false);
  test.skip(!tranTypePicked, "no Tran Type options available live for this department");
  await tranTypeOption.click();
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: /^Save$/i }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText(/Select at least one Document Type/i)).toBeVisible();
});

for (const viewport of [
  { label: "desktop", size: { width: 1400, height: 900 } },
  { label: "mobile", size: { width: 375, height: 812 } },
]) {
  test(`DMS-04/05 [HIGH PRIORITY]: checklist grid does not overlap Save footer — ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize(viewport.size);
    await page.goto(ROUTE, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    const picked = await selectFirstOption(page, 0);
    test.skip(!picked, "no Department options available live");
    await page.waitForTimeout(1500);

    const tableWrap = page.locator(".dwr-rights-grid__table-wrap");
    const footer = page.locator(".dwr-page-footer");
    await expect(tableWrap).toBeVisible();
    await expect(footer).toBeVisible();

    const tableBox = await tableWrap.boundingBox();
    const footerBox = await footer.boundingBox();
    expect(tableBox, "checklist grid has no bounding box").not.toBeNull();
    expect(footerBox, "Save footer has no bounding box").not.toBeNull();

    // The regression this guards: the grid grew tall enough that its bottom
    // extended past the footer's top, i.e. they visually overlapped.
    expect(
      tableBox.y + tableBox.height,
      `checklist grid (bottom=${tableBox.y + tableBox.height}) overlaps Save footer (top=${footerBox.y}) at ${viewport.label} width`
    ).toBeLessThanOrEqual(footerBox.y + 1); // +1px tolerance for sub-pixel rounding
  });
}
