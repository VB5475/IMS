// useWKFMain.js — WKF Main (Workflow approval detail page) data hook.
// See src/pages/wkf-main/constants.js for the module overview + the
// documented gaps in the MRD this hook's request shapes fill in.
//
// ⚠️ DBA-pending — the MRD (Section 5.1) gives an EXPLICIT request shape only
// for the 5 action-button clicks (POST_WKF_ActClicked) and Notes Save
// (prmStrMstJSON only). Header/Detail/Notes List/Track List/Path List are
// documented only as "Page Load (one time called)" with no param names at
// all. Since every one of these clearly needs to know WHICH transaction to
// load, this hook reuses the exact same identifying param names the action
// endpoint documents (prmcompkey/prmstatuskey/prmrowindexkey/prmloginid/
// prmdivid/prmcompanyid/prmyearid) for all of them — a consistent, best-
// effort guess, not a confirmed contract. Live-verify against the real
// backend and correct here if the actual params differ.

import { useCallback, useState } from "react";
import { useApi } from "../api/useApi";
import { API_BASE_URL_IMS } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { resolveDetailColLinks } from "../utils/masterFormUtils";
import { parseApiErrMsg } from "../utils/apiResponse";
import { buildSaveJsonFields } from "../utils/savePayload";
import { WKF_MAIN_CONFIG } from "../pages/wkf-main/constants";

/** Shared identifying params every WKF Main API call needs. */
function buildIdentityParams({ wkfdashkey, wkfdashkeystatus, wkfrowindx }) {
  const session = getUserSession();
  return {
    prmcompkey: String(wkfdashkey ?? ""),
    prmstatuskey: String(wkfdashkeystatus ?? ""),
    prmrowindexkey: String(wkfrowindx ?? ""),
    prmloginid: Number(session.loginId) || 1,
    // ⚠️ DBA-pending — the MRD's prmdivid=[[loggeddivid]] implies a
    // session-level "current division," but this app's own session object
    // (userSession.js) has no such field (Workflow Dashboard itself makes
    // the user pick a Division from a dropdown per search, it's not a
    // global session value) — defaults to 0 until a real source is found.
    prmdivid: Number(session.divisionId) || 0,
    prmcompanyid: Number(session.companyId) || 1,
    prmyearid: Number(session.yearId) || 1,
  };
}

export function useWKFMain() {
  const { post } = useApi(API_BASE_URL_IMS);
  const [isActing, setIsActing] = useState(false);

  const fetchHeader = useCallback(async (keys) => {
    const res = await post(WKF_MAIN_CONFIG.HEADER_ENDPOINT, buildIdentityParams(keys));
    const rows = resolveDetailColLinks(res);
    return rows[0] ?? null;
  }, [post]);

  const fetchDetail = useCallback(async (keys) => {
    const res = await post(WKF_MAIN_CONFIG.DETAIL_ENDPOINT, buildIdentityParams(keys));
    return resolveDetailColLinks(res);
  }, [post]);

  const fetchTrackList = useCallback(async (keys) => {
    const res = await post(WKF_MAIN_CONFIG.TRACK_LIST_ENDPOINT, buildIdentityParams(keys));
    return resolveDetailColLinks(res);
  }, [post]);

  const fetchPathList = useCallback(async (keys) => {
    const res = await post(WKF_MAIN_CONFIG.PATH_LIST_ENDPOINT, buildIdentityParams(keys));
    return resolveDetailColLinks(res);
  }, [post]);

  const fetchNotesList = useCallback(async (keys) => {
    const res = await post(WKF_MAIN_CONFIG.NOTES_LIST_ENDPOINT, buildIdentityParams(keys));
    return resolveDetailColLinks(res);
  }, [post]);

  const fetchButtonVisibility = useCallback(async (keys) => {
    const res = await post(WKF_MAIN_CONFIG.BUTTON_VISIBILITY_ENDPOINT, buildIdentityParams(keys));
    const row = resolveDetailColLinks(res)[0] ?? {};
    const isFlagTrue = (v) => v === 1 || v === "1" || v === true;
    return {
      canfwd: isFlagTrue(row.canfwd ?? row.Canfwd),
      cansendback: isFlagTrue(row.cansendback ?? row.Cansendback),
      canapprove: isFlagTrue(row.canapprove ?? row.Canapprove),
      canrecall: isFlagTrue(row.canrecall ?? row.Canrecall),
      cancomplete: isFlagTrue(row.cancomplete ?? row.Cancomplete),
    };
  }, [post]);

  /** Notes Save — MRD only documents the single payload key `prmStrMstJSON`;
   *  the note row's own content fields (remarks + identifying context) are
   *  an unconfirmed best-effort guess (see module header). */
  const saveNote = useCallback(async (keys, remarks) => {
    const session = getUserSession();
    const payload = buildSaveJsonFields({
      label: "WKF Note Save",
      mst: {
        compkey: String(keys.wkfdashkey ?? ""),
        remarks: String(remarks ?? "").trim(),
        loginid: Number(session.loginId) || 1,
        divisionid: Number(session.divisionId) || 0,
        companyid: Number(session.companyId) || 1,
        yearid: Number(session.yearId) || 1,
      },
    });
    const result = await post(WKF_MAIN_CONFIG.NOTES_SAVE_ENDPOINT, payload);
    return parseApiErrMsg(result);
  }, [post]);

  /** One shared caller for all 5 action buttons — `actionCode` is the exact
   *  `prmbuttonclicked` value the MRD documents (FWD/SENDBACK/APPROVE/
   *  RECALL/COMPLETE). */
  const postAction = useCallback(async (keys, actionCode) => {
    setIsActing(true);
    try {
      const result = await post(WKF_MAIN_CONFIG.ACTION_ENDPOINT, {
        prmbuttonclicked: actionCode,
        ...buildIdentityParams(keys),
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
