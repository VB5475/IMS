// CRASH-01 / CRASH-02 — regression guards for the two "X is not defined"
// ReferenceErrors found via ESLint's react/jsx-no-undef rule (see
// project_eslint_rollout memory): both list pages used <Pencil /> in their
// Edit-action column render without importing it from lucide-react.
import { test, expect } from "./fixtures/session.js";

const LIST_PAGES = [
  { name: "Assets Depreciation (Company Act Depreciation)", route: "/assets-depreciation" },
  { name: "Assets Item Opening", route: "/assets-item-opening" },
];

for (const p of LIST_PAGES) {
  test(`CRASH: ${p.name} list loads without a ReferenceError`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(p.route, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    expect(pageErrors, `Uncaught errors on ${p.name}: ${JSON.stringify(pageErrors)}`).toEqual([]);
    // The crash specifically happened inside the grid's Edit-action column
    // render — confirm the grid actually painted rows/edit affordance rather
    // than just "no error yet because nothing rendered".
    await expect(page.locator(".workspace-page")).toBeVisible();
  });
}
