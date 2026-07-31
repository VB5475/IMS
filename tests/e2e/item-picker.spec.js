// AIP-01..AIP-09 — Select Item / Main Group / Sub Main Group filter flow,
// rolled out identically across all 10 Assets modules (see
// project_assets_item_picker_maingroup_rollout memory).
//
// AIP-08 is the highest-priority case here: whether the Item Main Group
// filter actually narrows the server-returned item list, or is a silent
// no-op. This was NEVER confirmed server-side during development (the live
// SP gateway behaves permissively and doesn't error either way) — treat an
// "identical row count between two different Main Groups" result as a
// confirmed defect, not an inconclusive pass.
import { test, expect } from "./fixtures/session.js";
import { ASSET_MODULES } from "./fixtures/assetModules.js";
import { AssetTxnPage } from "./pages/AssetTxnPage.js";

for (const mod of ASSET_MODULES) {
  test.describe(mod.name, () => {
    test(`AIP-02: Select Item opens the filter bar, not a pre-loaded item list`, async ({ page }) => {
      const txn = new AssetTxnPage(page, mod.route);
      await txn.gotoNew();
      await txn.enterEditMode();
      await txn.fillAllHeaderFields();
      await txn.clickSelectItem();

      await expect(page.getByText(/Pick a filter above/i)).toBeVisible();
    });

    test(`AIP-03/04: Main Group populates; Sub Main Group starts empty`, async ({ page }) => {
      const txn = new AssetTxnPage(page, mod.route);
      await txn.gotoNew();
      await txn.enterEditMode();
      await txn.fillAllHeaderFields();
      await txn.clickSelectItem();

      await txn.mainGroupSelect().click();
      const mainGroupOptionCount = await page.locator(".search-select__option:visible").count();
      await page.keyboard.press("Escape");
      expect(mainGroupOptionCount, "Item Main Group had no options").toBeGreaterThan(0);

      const subDisabled = await txn.subMainGroupSelect().isDisabled().catch(() => false);
      expect(subDisabled, "Sub Main Group should start disabled until a Main Group is picked").toBe(true);
    });

    test(`AIP-07: Filter with no Main Group selected loads without error`, async ({ page }) => {
      const txn = new AssetTxnPage(page, mod.route);
      await txn.gotoNew();
      await txn.enterEditMode();
      await txn.fillAllHeaderFields();
      await txn.clickSelectItem();
      await txn.clickFilter();

      const stillAwaiting = await page.getByText(/Pick a filter above/i).isVisible().catch(() => false);
      expect(stillAwaiting, "Filter click should replace the awaiting-filter prompt").toBe(false);
    });

    test(`AIP-08 [HIGH PRIORITY]: Main Group filter actually narrows results`, async ({ page }) => {
      const txn = new AssetTxnPage(page, mod.route);
      await txn.gotoNew();
      await txn.enterEditMode();
      await txn.fillAllHeaderFields();
      await txn.clickSelectItem();

      const firstLabel = await txn.selectMainGroupOption(0);
      test.skip(!firstLabel, `${mod.name}: no Main Group options available live — cannot test narrowing`);
      await txn.clickFilter();
      const countA = await txn.itemRowCount();

      // Reopen and pick a different Main Group.
      await txn.closeModal();
      await txn.clickSelectItem();
      const secondLabel = await txn.selectMainGroupOption(1);
      test.skip(!secondLabel, `${mod.name}: only one Main Group option available live — cannot test narrowing`);
      await txn.clickFilter();
      const countB = await txn.itemRowCount();

      console.log(`[AIP-08] ${mod.name}: "${firstLabel}" -> ${countA} rows, "${secondLabel}" -> ${countB} rows`);

      // Hard assertion, not just a logged observation: per the priority brief,
      // an identical count between two different Main Groups is treated as a
      // confirmed defect (server-side filter is a no-op), not an inconclusive
      // result. A coincidental tie on a genuinely tiny catalog is possible but
      // rare enough that failing loud here is the right default — a false
      // positive is cheap to re-check by hand, a missed no-op is not.
      expect(
        countA,
        `${mod.name}: Main Group "${firstLabel}" and "${secondLabel}" both returned ${countA} rows — filter looks like a server-side no-op`
      ).not.toBe(countB);
    });
  });
}
