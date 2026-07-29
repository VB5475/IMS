// Generic Page Object for the 10 "Assets Item Picker" transaction modules
// (assets-client-allocation, assets-department-issue, etc.) — they share an
// identical header-fields-then-grid shape, so one POM parameterized by route
// covers all 10 rather than duplicating per-module classes.
export class AssetTxnPage {
  constructor(page, routePath) {
    this.page = page;
    this.routePath = routePath;
  }

  async gotoNew() {
    await this.page.goto(`${this.routePath}/new`, { waitUntil: "networkidle" });
    await this.page.waitForTimeout(1500);
  }

  async enterEditMode() {
    const addBtn = this.page.getByRole("button", { name: /^Add$/i });
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
    }
    // Header SearchSelects only mount once RB metadata finishes loading —
    // a flat sleep after clicking Add raced this on slower live-backend
    // responses (observed as a 0-triggers-found failure on Revaluation).
    // Wait for the real DOM signal instead of guessing a duration.
    await this.page.locator(".search-select__trigger").first().waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
  }

  /**
   * Some modules (e.g. Stock Transfer) pop a ConfirmDialog ("Changing X will
   * clear all item rows. Proceed?") when a routing field changes — harmless
   * to confirm since the grid is always empty at this point in a fresh Add
   * flow. But the SAME .cdlg-overlay markup is also used for the destructive
   * "Discard changes and reset the form?" dialog (confirmLabel="Discard") —
   * confirming THAT one exits edit mode entirely. Must distinguish by
   * message text, not blindly click .cdlg__btn--confirm for any overlay.
   */
  async dismissClearRowsConfirmIfPresent() {
    const overlay = this.page.locator(".cdlg-overlay");
    if (!(await overlay.isVisible({ timeout: 500 }).catch(() => false))) return false;
    const message = (await overlay.locator(".cdlg__message").textContent().catch(() => "")) || "";
    if (/clear all item rows/i.test(message)) {
      await overlay.locator(".cdlg__btn--confirm").click();
    } else {
      // Any other dialog (e.g. "Discard changes and reset the form?") —
      // cancel it, don't confirm, so we don't accidentally exit edit mode.
      await overlay.locator(".cdlg__btn--cancel").click();
    }
    await this.page.waitForTimeout(300);
    return true;
  }

  /** One left-to-right pass filling every enabled, still-empty SearchSelect. */
  async _fillFieldsPass() {
    const count = await this.page.locator(".search-select__trigger").count();
    const filled = [];
    for (let i = 0; i < count; i++) {
      const trigger = this.page.locator(".search-select__trigger").nth(i);
      if (await trigger.isDisabled().catch(() => true)) continue;
      // Skip fields that already carry a real value (nothing to do, and
      // re-clicking a filled field on some modules just reopens/reselects
      // the same option harmlessly, but skipping is cheaper and avoids
      // needlessly re-triggering cascade-reset confirm dialogs). Checked via
      // the input's actual value, NOT a "search-select__placeholder" CSS
      // class — that class turned out to be applied inconsistently across
      // modules/fields (some genuinely-empty fields never carry it), which
      // caused real empty fields to be wrongly skipped as "already filled".
      const isEmpty = ((await trigger.inputValue().catch(() => "")) || "").trim() === "";
      if (!isEmpty) continue;

      await this.dismissClearRowsConfirmIfPresent();
      await trigger.click({ timeout: 5000 }).catch(async () => {
        await this.dismissClearRowsConfirmIfPresent();
        await trigger.click();
      });
      // Dropdown options render via a React portal — stale/closed portal
      // instances from earlier fields can linger in the DOM, so a bare
      // ".first()" can resolve to a hidden leftover instead of the current
      // one. Filter to :visible explicitly (Playwright CSS extension).
      const option = this.page.locator(".search-select__option:visible").first();
      const optionAppeared = await option.isVisible({ timeout: 4000 }).catch(() => false);
      if (optionAppeared) {
        const label = (await option.textContent())?.trim();
        await option.click();
        filled.push(label);
      } else {
        // Close the empty dropdown by moving focus away with Tab — NOT
        // Escape (this app's form-level keydown handler also treats Escape
        // as "cancel/discard the whole Add flow", see class doc above) and
        // NOT a body-corner click (can land on the sidebar and misbehave).
        await this.page.keyboard.press("Tab");
      }
      await this.page.waitForTimeout(200);
      await this.dismissClearRowsConfirmIfPresent();
    }
    return filled;
  }

  /**
   * Fills every enabled header SearchSelect with its first real option.
   * Some modules (Stock Transfer) reset earlier fields via a cascade when a
   * later field changes ("clear rows" confirm) — so this re-passes over all
   * fields until nothing is left to fill or Select Item is enabled, rather
   * than assuming one left-to-right pass is sufficient everywhere.
   */
  async fillAllHeaderFields() {
    let allFilled = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      const filledThisPass = await this._fillFieldsPass();
      allFilled = allFilled.concat(filledThisPass);
      const selectItemEnabled = await this.selectItemButton().isEnabled().catch(() => false);
      if (selectItemEnabled || filledThisPass.length === 0) break;
    }
    return allFilled;
  }

  selectItemButton() {
    return this.page.getByRole("button", { name: /Select Item/i });
  }

  async clickSelectItem() {
    await this.selectItemButton().click();
    await this.page.waitForTimeout(1200);
  }

  /** Any visible validation/error banner text on the page (not inside the modal). */
  async pageErrorTexts() {
    return this.page.locator(".master-modal-error, [class*='alert-panel'], .oim-state").allTextContents();
  }

  hasConfigurationError() {
    return this.page.getByText("Configuration", { exact: true }).isVisible().catch(() => false);
  }

  mainGroupSelect() {
    return this.page.locator(".oim-filter-bar__field").first().locator(".search-select__trigger");
  }

  subMainGroupSelect() {
    return this.page.locator(".oim-filter-bar__field").nth(1).locator(".search-select__trigger");
  }

  filterButton() {
    return this.page.locator(".oim-filter-bar__btn");
  }

  async selectMainGroupOption(index = 0) {
    await this.mainGroupSelect().click();
    await this.page.waitForTimeout(300);
    const options = this.page.locator(".search-select__option:visible");
    const count = await options.count();
    if (count <= index) {
      await this.page.keyboard.press("Escape");
      return null;
    }
    const label = (await options.nth(index).textContent())?.trim();
    await options.nth(index).click();
    return label;
  }

  async clickFilter() {
    await this.filterButton().click();
    await this.page.waitForTimeout(1500);
  }

  itemRows() {
    return this.page.locator(".oim-state, .oim table tbody tr, [class*='oim'] tbody tr");
  }

  async itemRowCount() {
    // Modal grid rows — the OrderItemModal renders an EnterpriseDataGrid-style
    // table; count generic tbody rows scoped to the modal container.
    return this.page.locator(".modal, [role='dialog']").locator("tbody tr").count();
  }

  async closeModal() {
    // Modal.jsx's keydown handler closes on Escape (confirmed in source) — no
    // close-button lookup needed.
    await this.page.keyboard.press("Escape");
    await this.page.waitForTimeout(300);
  }
}
