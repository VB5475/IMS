// CFG-01 / CFG-02 — regression suite for the stale-closure "Fix 1 error
// before saving: Configuration" bug (see project_assets_configuration_validation_bug
// memory). Root cause: handleSelectItem's useCallback was missing
// `headerColumns` from its dependency array, so isColumnMandatoryByName()
// always received an empty array and fail-closed, permanently flagging the
// hidden, non-mandatory Configuration field as required. Fixed across all 10
// modules by adding headerColumns to the deps array — this suite exists so a
// future regression on any one module gets caught immediately, not
// rediscovered by a user screenshot.
import { test, expect } from "./fixtures/session.js";
import { ASSET_MODULES } from "./fixtures/assetModules.js";
import { AssetTxnPage } from "./pages/AssetTxnPage.js";

for (const mod of ASSET_MODULES) {
  test(`CFG-01: ${mod.name} — Select Item does not falsely require Configuration`, async ({ page }) => {
    const txn = new AssetTxnPage(page, mod.route);
    await txn.gotoNew();
    await txn.enterEditMode();
    const filled = await txn.fillAllHeaderFields();
    expect(filled.length, "expected at least one header field to be fillable").toBeGreaterThan(0);

    await txn.clickSelectItem();

    const hasConfigError = await txn.hasConfigurationError();
    expect(
      hasConfigError,
      `"${mod.name}" showed a Configuration validation error after filling all header fields (${JSON.stringify(filled)}) — stale-closure regression`
    ).toBe(false);
  });
}
