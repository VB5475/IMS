// Auth bypass for all specs — this app has no test-mode login, so every spec
// seeds localStorage["ims_user_session"] before first navigation, matching
// DEFAULT_USER_SESSION's shape (src/session/userSession.js). Extends the base
// `test`/`expect` so specs just `import { test, expect } from "../fixtures/session.js"`.
import { test as base, expect } from "@playwright/test";

export const SESSION = {
  isAuthenticated: true,
  loginId: 1,
  userId: "Admin",
  userName: "Administrator",
  companyId: 1,
  yearId: 1,
  sessionId: 88,
  company: { companyId: 1, companyName: "Test Co" },
  year: { yearId: 1, yearName: "2026-27" },
  userGroupId: 1,
  desgId: null,
  departmentId: null,
  isAdminUser: true,
  isDepartmentHead: false,
  isDivisionHead: false,
};

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((session) => {
      localStorage.setItem("ims_user_session", JSON.stringify(session));
    }, SESSION);
    page.on("pageerror", (err) => {
      // Surface uncaught runtime errors (e.g. "X is not defined") as visible
      // test output instead of a silent white-screen the assertions might miss.
      console.error(`[pageerror] ${err.message}`);
    });
    await use(page);
  },
});

export { expect };
