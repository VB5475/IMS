// useWKFMain.js — WKF Main (Workflow approval detail page) data hook.
// See src/pages/wkf-main/constants.js for the module overview + the
// documented gaps in the MRD this hook's request shapes fill in.
//
// Request shapes below match the revised MRD (Section 5.1, 15-Aug-2026)
// — Header/Detail/Notes List/Track List/Path List all confirmed as
// prmcompkey + prmloginid only; Action additionally takes prmrecordindex.
// Notes List has no explicit shape documented, so it reuses the same
// shared params as a best-effort guess (unconfirmed).

import { useCallback, useState } from "react";
import { useApi } from "../api/useApi";
import { API_BASE_URL_IMS } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { resolveDetailColLinks } from "../utils/masterFormUtils";
import { parseApiErrMsg, isErrorOnlyRow } from "../utils/apiResponse";
import { callWithRetry } from "../utils/apiRetry";
import { WKF_MAIN_CONFIG } from "../pages/wkf-main/constants";

/** Shared identifying params every WKF Main API call needs. */
function buildIdentityParams({ wkfdashkey }) {
  const session = getUserSession();
  return {
    prmcompkey: String(wkfdashkey ?? ""),
    prmloginid: Number(session.loginId) || 1,
  };
}

/** Detail/Track/Path/Notes rows, with a lone {ErrCode,ErrMsg} sentinel (a
 *  proc's "no data / bad key" envelope, e.g. IMS_LIVE's "Transaction Key is
 *  not numeric") stripped to [] so it shows the grid's empty state instead of
 *  rendering as a junk ErrCode/ErrMsg row. Same convention as DOP's
 *  mapDetailRowsToGridRows. */
function toGridRows(res) {
  const rows = resolveDetailColLinks(res);
  if (rows.length === 1 && isErrorOnlyRow(rows[0])) return [];
  return rows;
}

export function useWKFMain() {
  const { post } = useApi(API_BASE_URL_IMS);
  const [isActing, setIsActing] = useState(false);

  // Read-only fetches (header/detail/track/path/notes/button-visibility) —
  // retried on transient network failure via callWithRetry. postAction and
  // saveNote below are real mutations and must never retry (a lost-response
  // Save/Action retried blind risks double-submitting it).
  const fetchHeader = useCallback(async (keys) => {
    const res = await callWithRetry(() => post(WKF_MAIN_CONFIG.HEADER_ENDPOINT, buildIdentityParams(keys)));
    const row = resolveDetailColLinks(res)[0] ?? null;
    // Surface a backend error envelope (e.g. IMS_LIVE's "Transaction Key is
    // not numeric...") as a real error instead of returning it as a header
    // row — otherwise every field silently reads "—" with no explanation.
    if (row && isErrorOnlyRow(row)) {
      throw new Error(String(row.ErrMsg ?? row.errmsg ?? "Failed to load workflow header.").trim());
    }
    return row;
  }, [post]);

  const fetchDetail = useCallback(async (keys) => {
    const res = await callWithRetry(() => post(WKF_MAIN_CONFIG.DETAIL_ENDPOINT, buildIdentityParams(keys)));
    return toGridRows(res);
  }, [post]);

  const fetchTrackList = useCallback(async (keys) => {
    const res = await callWithRetry(() => post(WKF_MAIN_CONFIG.TRACK_LIST_ENDPOINT, buildIdentityParams(keys)));
    return toGridRows(res);
  }, [post]);

  const fetchPathList = useCallback(async (keys) => {
    const res = await callWithRetry(() => post(WKF_MAIN_CONFIG.PATH_LIST_ENDPOINT, buildIdentityParams(keys)));
    return toGridRows(res);
  }, [post]);

  const fetchNotesList = useCallback(async (keys) => {
    const res = await callWithRetry(() => post(WKF_MAIN_CONFIG.NOTES_LIST_ENDPOINT, buildIdentityParams(keys)));
    return toGridRows(res);
  }, [post]);

  const fetchButtonVisibility = useCallback(async (keys) => {
    const res = await callWithRetry(() => post(WKF_MAIN_CONFIG.BUTTON_VISIBILITY_ENDPOINT, buildIdentityParams(keys)));
    const row = resolveDetailColLinks(res)[0] ?? {};
    const isFlagTrue = (v) => v === 1 || v === "1" || v === true;
    return {
      canfwd: isFlagTrue(row.canfwd ?? row.Canfwd),
      cansendback: isFlagTrue(row.cansendback ?? row.Cansendback),
      canapprove: isFlagTrue(row.canapprove ?? row.Canapprove),
      canreject: isFlagTrue(row.canreject ?? row.Canreject),
      canrecall: isFlagTrue(row.canrecall ?? row.Canrecall),
      cancomplete: isFlagTrue(row.cancomplete ?? row.Cancomplete),
      canaddnote: isFlagTrue(row.canaddnote ?? row.Canaddnote),
    };
  }, [post]);

  /** Notes Save — MRD's confirmed payload: prmcompkey, prmnote, prmloginid. */
  const saveNote = useCallback(async (keys, remarks) => {
    const result = await post(WKF_MAIN_CONFIG.NOTES_SAVE_ENDPOINT, {
      prmnote: String(remarks ?? "").trim(),
      ...buildIdentityParams(keys),
    });
    return parseApiErrMsg(result);
  }, [post]);

  /** One shared caller for all 5 action buttons — `actionCode` is the exact
   *  `prmbuttonclicked` value the MRD documents (FWD/SENDBACK/APPROVE/
   *  RECALL/COMPLETE). prmrecordindex is Action-specific — no other call
   *  in this hook takes a row index. `currSrno` is undocumented in either
   *  MRD version — live-discovered 2026-08-15: the backend proc
   *  (pr_WKF_Act_ReCall etc.) errors without it ("expects parameter
   *  '@prmCURRSRNO', which was not supplied"). Sourced from the Header
   *  response's `curr_srno` field. Sent as lowercase `prmcurrsrno` — this
   *  API's param-matching is case-sensitive on the key (same gotcha hit
   *  before in useDocumentLog.js's guid params: prmguid/prmref_trantypeid/
   *  prmtranid all had to be lowercased to be recognized). */
  const postAction = useCallback(async (keys, actionCode, currSrno) => {
    setIsActing(true);
    try {
      const result = await post(WKF_MAIN_CONFIG.ACTION_ENDPOINT, {
        prmbuttonclicked: actionCode,
        ...buildIdentityParams(keys),
        prmrecordindex: String(keys.wkfrowindx ?? ""),
        prmcurrsrno: String(currSrno ?? ""),
      });
      return parseApiErrMsg(result);
    } finally {
      setIsActing(false);
    }
  }, [post]);

  return {
    fetchHeader,
    fetchDetail,
    fetchTrackList,
    fetchPathList,
    fetchNotesList,
    fetchButtonVisibility,
    saveNote,
    postAction,
    isActing,
  };
}
