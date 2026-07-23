// constants.js — Asset Depreciation Percentage (AstDepPerc) config module.
// Single-page RB-driven config grid — one row per ledger Account, no
// list/add/edit flow. RB metadata + column data resolved live against
// IMS_LIVE 2026-07-16 (see /tl handoff notes): RBID 10160,
// SaveProcName pr_rb_astdepperc_save.

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const PAGE_TITLE = "Asset Depreciation Percentage";

export const ADP_CONFIG = {
  RB_MASTER: RB_CODES.ASSET_DEPRECIATION_PERCENTAGE,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSET_DEPRECIATION_PERCENTAGE),
  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_astdepPerc",

  SAVE_ENDPOINT: "/API/AstDepPerc/Post_RB_AstDepPerc_Save",

  STORAGE_HEADER_META: "adpHeaderMeta",
};

// DBA-pending (2026-07-17, verified against live GetDetailColData?prmMasterID=10160):
// this RB has every non-idnumber column typed ColCtrlType=0 (Label), including
// the 12 rate fields that ARE flagged IsEditAllow=1. EntryGrid.jsx's editable-mode
// switch(col.controlType) returns a plain label for case 0 unconditionally — it
// does not fall back to a text input even when IsEditAllow=1 and the data type is
// numeric. Net effect: right now nothing in this grid renders as an actual input,
// not just the two account-lookup columns flagged read-only.
//
// Column-by-column fix needed in the RB detail-column definition for rb_astdepPerc
// (objdetid values from the live response, so DBA can target rows directly):
//   - account       (objdetid 80899): correctly Label/ColCtrlType=0, IsEditAllow=0 — no change.
//   - depsaccid      (objdetid 80900, displayname "depreciation account"): its own
//     ctrlsqlsource="account"/ctrlvaluecol="depsaccid"/ctrldisplaycol="acname" is a
//     dropdown-lookup definition — needs ColCtrlType=4 (Dropdown) AND IsEditAllow=1.
//   - accudepsaccid  (objdetid 80901, displayname "accu. dep. account"): same shape
//     as depsaccid — ColCtrlType=4, IsEditAllow=1.
//   - the 12 rate columns, lifeperiodinmonth_/wdvpercentage_/slmpercentage_/
//     uptopercentage_ x {cmact,itact,mgmact} (objdetid 80902-80913): already
//     IsEditAllow=1, just need ColCtrlType=1 (TextBox) instead of 0.
//
// Note: row-level GET_MASTER_DATA_FILL data uses different key names for the two
// account fields ("depreciationaccount"/"accudepaccount", the display code string)
// than the column metadata does ("depsaccid"/"accudepsaccid", the FK id) — that
// mismatch is expected (display column vs. edit-value column) and not itself a bug.
//
// A blind IsEditAllow-only override was tried first and rejected (2026-07-17) —
// it didn't work because ColCtrlType=0 short-circuits to a label in EntryGrid
// regardless of IsEditAllow, and it wasn't grounded in a verified per-column diff
// against the live RB. This block replaced it once the live diff above was
// confirmed and no one on the team has IMS_LIVE DB access to apply the real fix.
//
// TEMPORARY SHIM — approved 2026-07-17 pending DBA access. Corrects the raw
// GetDetailColData column list (same field names the API returns) for exactly
// the columns above, before buildGridColumns() consumes them, so the grid is
// usable today. DELETE THIS BLOCK (and its one call site in
// useAssetDepreciationPercentage.js) once DBA applies the real fix by the
// objdetid list above — this must not become permanent scaffolding.
export const ADP_RB_SHIM = {
  depsaccid: { colctrltype: 4, iseditallow: true },
  accudepsaccid: { colctrltype: 4, iseditallow: true },
  lifeperiodinmonth_cmact: { colctrltype: 1 },
  wdvpercentage_cmact: { colctrltype: 1 },
  slmpercentage_cmact: { colctrltype: 1 },
  uptopercentage_cmact: { colctrltype: 1 },
  lifeperiodinmonth_itact: { colctrltype: 1 },
  wdvpercentage_itact: { colctrltype: 1 },
  slmpercentage_itact: { colctrltype: 1 },
  uptopercentage_itact: { colctrltype: 1 },
  lifeperiodinmonth_mgmact: { colctrltype: 1 },
  wdvpercentage_mgmact: { colctrltype: 1 },
  slmpercentage_mgmact: { colctrltype: 1 },
  uptopercentage_mgmact: { colctrltype: 1 },
};
