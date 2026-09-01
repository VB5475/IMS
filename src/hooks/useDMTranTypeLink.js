// useDMTranTypeLink.js — DM Tran Type Link (DMS module).
// Single header field ("From" Tran Type, live-mislabeled + wrongly typed as
// Textbox — both overridden client-side) filters a grid of existing "To"
// Tran Type link rows, fetched live per selected From id. See
// pages/dm-tran-type-link/constants.js for the full investigation this
// module's shape was derived from.

import { useState, useCallback, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL } from "../api/constants";
import { getUserSession } from "../session/userSession";
import {
  normalizeDetailColLinks,
  resolveDetailColLinks,
} from "../utils/masterFormUtils";
import { buildGridColumns, fetchDropdownOptions } from "../utils/gridUtils";
import { TTLINK_CONFIG } from "../pages/dm-tran-type-link/constants";

// Hand-picked grid columns — RB's own isvisible/iseditallow/ColCtrlType
// flags for this table have proven unreliable, repeatedly, in one day (see
// constants.js header), so this whitelist is the real visibility decision
// for the grid, not the live flags.
//
// GRID_TO_COL (ref_trantypeidto) is a PERMANENT, LOCKED-IN override as of
// 2026-08-04 — do not re-derive its rendering from a fresh RB pull. Its
// live shape cycled through 3 different states in a single day (hidden →
// visible+Textbox → visible+read-only-Textbox), and chasing each flip
// produced a worse UI every time (hidden loses the info entirely; a raw
// numeric id with no label is worse than either). Per explicit instruction,
// this is now hand-maintained regardless of what RB says: always visible,
// always an editable Dropdown (real Tran Type picker, options from the same
// merged per-department list the header field uses). The actual fix is
// DBA ticket RB-20199-001, not another round of syncing to a live pull.
const GRID_WHITELIST_COLS = [
  // TTLINK_CONFIG.GRID_TO_COL,
  TTLINK_CONFIG.GRID_PARTS1_COL,
  TTLINK_CONFIG.GRID_PARTS2_COL,
  TTLINK_CONFIG.GRID_STATUS_COL,
  TTLINK_CONFIG.GRID_TO_NAME_COL,
  TTLINK_CONFIG.GRID_FROM_NAME_COL,
  TTLINK_CONFIG.GRID_REFNO_COL,
  TTLINK_CONFIG.GRID_SUBJECT_COL,
];
// Read-only regardless of buildGridColumns' allEditable:true — the
// backend-computed display columns, never real inputs. GRID_TO_COL is
// deliberately NOT in this set (see the locked-in override note above).
const GRID_READ_ONLY_COLS = new Set([
  TTLINK_CONFIG.GRID_TO_NAME_COL,
  TTLINK_CONFIG.GRID_FROM_NAME_COL,
  TTLINK_CONFIG.GRID_REFNO_COL,
  TTLINK_CONFIG.GRID_SUBJECT_COL,
]);

function mapIdNameRows(rows) {
  return (rows || [])
    .map((r) => {
      const value = r.idnumber ?? r.IDNumber ?? r.IdNumber;
      if (value == null || value === "") return null;
      const label = r.trantype ?? r.TranType ?? String(value);
      const num = Number(value);
      return { value: Number.isFinite(num) ? String(Math.round(num)) : String(value), label: String(label) };
    })
    .filter(Boolean);
}

/** Dedupe by value, first occurrence wins. */
function dedupeOptions(options) {
  const seen = new Set();
  const out = [];
  for (const opt of options) {
    if (seen.has(opt.value)) continue;
    seen.add(opt.value);
    out.push(opt);
  }
  return out;
}

export function useDMTranTypeLink() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [rawColumns, setRawColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [gridColumns, setGridColumns] = useState([]);
  const [tranTypeOptions, setTranTypeOptions] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: TTLINK_CONFIG.LIST_OBJ_TYPE,
        ObjName: TTLINK_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: TTLINK_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = resolveDetailColLinks(metaData)[0] ?? metaData?.[0];
      const rbid = tableRow?.rbid ?? tableRow?.RBID;
      if (!rbid) throw new Error("No DM Tran Type Link RB metadata returned.");

      const hdrMeta = { RBID: rbid, SaveProcName: tableRow?.saveprocname ?? tableRow?.SaveProcName };
      localStorage.setItem(TTLINK_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      const cols = resolveDetailColLinks(colData);
      setRawColumns(cols);
      setAllColumns(cols.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));

      const normalized = normalizeDetailColLinks(cols);
      const fromCol = normalized.find((c) => c.ColName === TTLINK_CONFIG.HEADER_FROM_COL);
      setHeaderColumns(
        fromCol
          ? [{ ...fromCol, ColCtrlType: 4, DisplayName: TTLINK_CONFIG.LABEL_OVERRIDES[TTLINK_CONFIG.HEADER_FROM_COL] }]
          : []
      );

      // No unscoped "all Tran Types" SP exists — merge per-department
      // results instead (see constants.js file header). Resolved before
      // gridColumns is built so the To Tran Type dropdown has real options
      // from the start, not an empty list baked in at build time.
      const deptRes = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: TTLINK_CONFIG.LIST_OBJ_TYPE,
        ObjName: TTLINK_CONFIG.SP_DEPARTMENT,
        JSon: JSON.stringify([{}]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const departments = resolveDetailColLinks(deptRes);
      const perDeptResults = await Promise.all(
        departments.map((d) =>
          get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: TTLINK_CONFIG.LIST_OBJ_TYPE,
            ObjName: TTLINK_CONFIG.SP_TRAN_TYPE,
            JSon: JSON.stringify([{  }]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          }).catch(() => [])
        )
      );
      const merged = dedupeOptions(
        perDeptResults.flatMap((res) => mapIdNameRows(resolveDetailColLinks(res)))
      ).sort((a, b) => Number(a.value) - Number(b.value));
      setTranTypeOptions(merged);

      const gridRawCols = cols
        .filter((c) => GRID_WHITELIST_COLS.includes(c.colname))
        .map((c) => ({
          ...c,
          // RB currently mismarks isvisible for several of these columns
          // (e.g. ref_trantypeidto/parts1/parts2 flagged hidden even though
          // this grid needs them) — force visible since GRID_WHITELIST_COLS
          // is itself the real visibility decision here, not RB's flag.
          isvisible: true,
          // docuploadon is RB-flagged ismandatory:1, which would show a
          // misleading required-asterisk on a column we've forced read-only
          // (it's a computed display name, never user-entered).
          ismandatory: GRID_READ_ONLY_COLS.has(c.colname) ? false : c.ismandatory,
          displayname: TTLINK_CONFIG.LABEL_OVERRIDES[c.colname] ?? c.displayname,
        }));

      // GetFilterDetail (this app's generic RB-driven dropdown resolver,
      // keyed by each column's ObjDetID) works live for this RB's Status
      // column, unlike the other DMS RBs noted elsewhere as failing it —
      // confirmed via curl before wiring this in.
      const gridDropdownOptions = await fetchDropdownOptions(get, gridRawCols, rbid, {
        funcCode: TTLINK_CONFIG.RB_MASTER,
      });
      // GRID_TO_COL's options come from the merged per-department Tran Type
      // list above, not RB/GetFilterDetail — locked-in override, see
      // GRID_WHITELIST_COLS' comment.
      gridDropdownOptions[TTLINK_CONFIG.GRID_TO_COL] = merged;

      setGridColumns(
        buildGridColumns(gridRawCols, gridDropdownOptions, {
          filterable: false,
          allEditable: true,
          controlTypeOverrides: { [TTLINK_CONFIG.GRID_TO_COL]: 4 },
        })
          .map((col) => (GRID_READ_ONLY_COLS.has(col.key) ? { ...col, isEditAllow: false } : col))
          // Row-selection checkbox column and Delete removed for this module
          // only, per explicit user request — buildGridColumns() always
          // prepends this column, no shared opt to suppress it.
          .filter((col) => col.key !== "cb")
      );
    } catch (err) {
      console.error("[TTLink] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load DM Tran Type Link configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  /** Existing link rows for the selected "From" Tran Type — confirmed live, real data. */
  const fetchLinkRows = useCallback(
    async (fromTranTypeId) => {
      if (!fromTranTypeId) return [];
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: TTLINK_CONFIG.LIST_OBJ_TYPE,
        ObjName: TTLINK_CONFIG.SP_GRID_DATA,
        JSon: JSON.stringify([{ prmIdnumber: Number(fromTranTypeId) }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rows = resolveDetailColLinks(res);
      return rows.map((r, index) => {
        const idnumber = Number(r.IDNumber ?? r.idnumber) || 0;
        return {
          id: idnumber || `new_${index}`,
          idnumber,
          [TTLINK_CONFIG.HEADER_FROM_COL]: Number(fromTranTypeId),
          [TTLINK_CONFIG.GRID_TO_COL]: Number(r.Ref_TranTypeIDTo ?? r.ref_trantypeidto) || 0,
          // [TTLINK_CONFIG.GRID_PARTS1_COL]: Number(r.Ref_TranTypePartsID1 ?? r.ref_trantypepartsid1) || 0,
          // [TTLINK_CONFIG.GRID_PARTS2_COL]: Number(r.Ref_TranTypePartsID2 ?? r.ref_trantypepartsid2) || 0,
          [TTLINK_CONFIG.GRID_STATUS_COL]: String(r.Status ?? r.status ?? "").trim(),
          [TTLINK_CONFIG.GRID_TO_NAME_COL]: String(r.DocUploadOn ?? r.docuploadon ?? "").trim(),
          // [TTLINK_CONFIG.GRID_FROM_NAME_COL]: String(r.DocViewedBy ?? r.docviewedby ?? "").trim(),
          [TTLINK_CONFIG.GRID_REFNO_COL]: String(r.RefNo ?? r.refno ?? "").trim(),
          [TTLINK_CONFIG.GRID_SUBJECT_COL]: String(r.Subject ?? r.subject ?? "").trim(),
        };
      });
    },
    [get]
  );

  return {
    headerColumns,
    rawColumns,
    allColumns,
    gridColumns,
    tranTypeOptions,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchLinkRows,
  };
}
