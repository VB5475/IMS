// AIM-01 / AIM-02 — Asset Item Master was removed entirely (see
// project_asset_item_master memory, removed 2026-07-29). This guards against
// the two failure modes of an incomplete removal: a dangling nav entry, and
// a crash on the now-unregistered route.
import { test, expect } from "./fixtures/session.js";

test("AIM-01: Asset Item Master nav entry is gone", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const navEntry = page.getByRole("link", { name: "Asset Item Master" });
  await expect(navEntry).toHaveCount(0);
});

test("AIM-02 [HIGH PRIORITY]: old route does not crash the app", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.goto("/account/master/asset-item-master", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  expect(pageErrors, `Uncaught errors navigating to the removed route: ${JSON.stringify(pageErrors)}`).toEqual([]);

  // No route matches -> react-router should render *something* (a 404 view,
  // or a redirect to a known page) rather than a blank document.
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.trim().length, "page rendered nothing at all for the removed route").toBeGreaterThan(0);
});
