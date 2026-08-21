// constants.js — WKF Main (Workflow approval detail page) config.
// Source: MRD_Template4WKFMain.docx (Shivani, 11-Aug-2026).
//
// No RB_MASTER for this module (MRD Section 2: "Master/Header panel (not
// dynamic)") — the header panel's fields are fixed per Section 3's table,
// not RB-metadata-driven like every other module in this app. Only the 3
// grids (Detail / Action Track / User Path) are "dynamic columns" — their
// shape comes from each API's own response, same convention as
// listGridUtils.js's buildListColumnsFromRows.
//
// Reached ONLY via a row click on /workflow-dashboard (WorkflowDashboard.jsx)
// — MRD's "New Form Route: Not Present" + blank "Nav Menu Label" confirmed
// 2026-08-14 (/pm) via AskUserQuestion: no sidebar nav entry for this route.

export const WKF_MAIN_CONFIG = {
  ROUTE_PATH: "/wkfmain",

  // Query-param names carried from the dashboard row click (MRD's legacy
  // "session('wkfdashkey', ...)" phrasing — this SPA uses query params
  // instead of server session state, so a hard reload of /wkfmain still
  // works: the URL itself owns the identity, same convention as this app's
  // other edit routes reading their id from the URL rather than only from
  // router state). `wkfdashkey` (compkey) can contain semicolons
  // (e.g. "IMS;PUR_PO;2;2") — query params handle that safely without extra
  // escaping logic, path segments would not.
  PARAM_DASHKEY: "wkfdashkey",
  PARAM_DASHKEY_STATUS: "wkfdashkeystatus",
  PARAM_ROWINDX: "wkfrowindx",

  // ── APIs (Section 5.1 "Form Structure Detail") ──────────────────────
  HEADER_ENDPOINT: "/API/WKF_GUIInfo_Header/POST_WKF_Info4Header",
  DETAIL_ENDPOINT: "/API/WKF_GUIInfo_Detail/POST_WKF_Info4Detail",
  NOTES_LIST_ENDPOINT: "/API/WKF_GUIInfo_NotesList/POST_WKF_Info4Notes_List",
  NOTES_SAVE_ENDPOINT: "/API/WKF_GUIInfo_NotesSave/POST_WKF_Info4Notes_Save",
  BUTTON_VISIBILITY_ENDPOINT: "/API/WKF_GUIInfo_Button/POST_WKF_Info4Button",
  ACTION_ENDPOINT: "/API/WKF_GUIInfo_Action/POST_WKF_ActClicked",
  TRACK_LIST_ENDPOINT: "/API/WKF_GUIInfo_TrackList/Post_WKF_Info4TrackList",
  PATH_LIST_ENDPOINT: "/API/WKF_GUIInfo_PathList/Post_WKF_Info4PathList",
};

/** Header panel fields (Section 3 table) — fixed, not RB-driven. All
 *  readonly; `pagetitle` renders as the page heading (Control Type "Label"),
 *  everything else as a readonly boxed field (Control Type "Textbox"),
 *  matching the wireframe screenshot.
 *
 *  `visible: false` on status/company/division (2026-08-20 /pm) — resolves
 *  the MRD-vs-wireframe contradiction noted below in the MRD's favor:
 *  Section 3's table marked all three Is Visible=No, but the Section 2
 *  wireframe screenshot drew them anyway; this had been following the
 *  wireframe until now. Omitted `visible` defaults to shown, same
 *  convention as AppShell.jsx's NAV_SECTIONS config. */
export const WKF_HEADER_FIELDS = [
  { key: "tokenno", label: "Ref. Transaction No." },
  { key: "trandate", label: "On Date" },
  { key: "subject", label: "Subject" },
  { key: "status", label: "Status", visible: false },
  { key: "company", label: "Company", visible: false },
  { key: "division", label: "Division", visible: false },
  { key: "initiatorname", label: "Initiator" },
  { key: "currentholder", label: "Current Holder" },
  { key: "lastsender", label: "Last Sender" },
];

/** The 5 "Direct Stamping Keys" action buttons — visibility comes from
 *  POST_WKF_Info4Button's Can* flags; `actionCode` is the exact
 *  `prmbuttonclicked` value POST_WKF_ActClicked expects (Section 5.1). */
export const WKF_ACTION_BUTTONS = [
  { key: "recall", label: "Recall", actionCode: "RECALL", canFlag: "canrecall" },
  { key: "sendback", label: "Send Back", actionCode: "SENDBACK", canFlag: "cansendback" },
  { key: "forward", label: "Forward", actionCode: "FWD", canFlag: "canfwd" },
  { key: "approve", label: "Approve", actionCode: "APPROVE", canFlag: "canapprove" },
  { key: "complete", label: "Complete", actionCode: "COMPLETE", canFlag: "cancomplete" },
];

export const WKF_TABS = [
  { id: "main", label: "Main Content" },
  { id: "track", label: "Action Track" },
  { id: "path", label: "User Path" },
];

/** Shared row -> /wkfmain URL builder — used by both WorkflowDashboard.jsx
 *  (row click) and WKFMainPage.jsx (Previous/Next, wireframe-only, not
 *  described in the MRD's text sections — see WKFMainPage.jsx's own note).
 *  `index` must be the row's position in the FULL unpaginated result set
 *  (2026-08-14 /pm, confirmed via AskUserQuestion), not the visible page. */
export function buildWkfMainSearch(row, index) {
  const params = new URLSearchParams({
    [WKF_MAIN_CONFIG.PARAM_DASHKEY]: String(row?.compkey ?? row?.Compkey ?? ""),
    [WKF_MAIN_CONFIG.PARAM_DASHKEY_STATUS]: String(row?.mast_status ?? row?.Mast_Status ?? ""),
    [WKF_MAIN_CONFIG.PARAM_ROWINDX]: String(index ?? 0),
  });
  return `${WKF_MAIN_CONFIG.ROUTE_PATH}?${params.toString()}`;
}
