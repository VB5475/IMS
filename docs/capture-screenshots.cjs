// capture-screenshots.js — Playwright screenshot capture for IMS docs
const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:5176';
const OUT  = path.join(__dirname, 'screenshots');

const SCREENS = [
  { name: '01_login',             url: '/login',                title: 'Login Page' },
  { name: '02_dashboard',         url: '/',                     title: 'Enterprise Dashboard' },
  { name: '03_report_workspace',  url: '/main/1',               title: 'Report Workspace' },
  { name: '04_txn_entry',         url: '/txn-entry',            title: 'Transaction Entry (Sample Invoice)' },
  { name: '05_purchase_inquiry',  url: '/purchase-inquiry',     title: 'Purchase Inquiry' },
  { name: '06_purchase_order',    url: '/purchase-order',       title: 'Purchase Order' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  for (const screen of SCREENS) {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}${screen.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000); // let async data settle
      const file = path.join(OUT, `${screen.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(`✅  ${screen.title} → ${screen.name}.png`);
    } catch (err) {
      console.warn(`⚠️  ${screen.title} failed: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('\nDone. Screenshots saved to docs/screenshots/');
})();
