// usePurchaseQuotationComparison.js — Division → Inquiry cascade, comparison grid
// fetch, and save for the Purchase Quotation Comparison single-page module.
// No RB anywhere (client-confirmed) — every field here is a plain SP call.

import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, OBJ_TYPE, DEFAULT_SESSION_ID } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { formatTranDate } from "../utils/dateFormat";
import { withSaveContextFields, buildSaveJsonFields } from "../utils/savePayload";
import { parseApiErrMsg } from "../utils/apiResponse";
import { PQC_CONFIG } from "../pages/purchase-quotation-comparison/constants";

function firstDefined(row, keys) {
  for (const k of keys) {
    if (row[k] != null && row[k] !== "") return row[k];
  }
  return null;
}

// FN_Fetch_Data returns backend SP errors as a normal 200 OK response body
// (e.g. `[{"ErrCode":"-1","ErrMsg":"42703: column d.poexists does not exist"}]`),
// not a thrown HTTP error — so a broken SP call never lands in a catch block.
// Left unchecked, that single error row gets mapped as if it were real data
// (a blank-label dropdown option whose "id" coerces to 0) — exactly what caused
// the unselectable Inquiry dropdown + stray "0" symptom. Every GET below must
// check for this shape before treating the response as rows.
function isErrorPayload(rows) {
  const row = rows?.[0];
  if (!row || typeof row !== "object") return false;
  return (
    row.ErrCode !== undefined || row.errcode !== undefined ||
    row.ErrMsg !== undefined || row.errmsg !== undefined
  );
}

function extractErrorMessage(rows, fallback) {
  const row = rows?.[0] ?? {};
  const msg = row.ErrMsg ?? row.errmsg;
  return msg ? String(msg) : fallback;
}

export function usePurchaseQuotationComparison() {
  const { get } = useApi(API_BASE_URL);
  const { post } = useApi(API_BASE_URL_IMS);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [inquiryOptions, setInquiryOptions] = useState([]);
  const [isLoadingInquiries, setIsLoadingInquiries] = useState(false);
  const [inquiryOptionsError, setInquiryOptionsError] = useState(null);
  const [inquiryDetails, setInquiryDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [comparisonRows, setComparisonRows] = useState([]);
  const [isLoadingGrid, setIsLoadingGrid] = useState(false);
  const [gridError, setGridError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const fetchDivisionOptions = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PQC_CONFIG.SP_DIVISIONS,
        JSon: JSON.stringify([
          {
            prmuserid: getUserSession().loginId,
            prmcompanyid: getUserSession().companyId,
            prmyearid: getUserSession().yearId,
          },
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      if (isErrorPayload(res)) {
        console.error("[PQC] Division SP returned an error:", extractErrorMessage(res, ""));
        setDivisionOptions([]);
        return;
      }

      setDivisionOptions(
        (res || []).map((r) => ({
          value: String(r.divisionid),
          label: r.divisionname,
        }))
      );
    } catch (err) {
      console.warn("[PQC] Division fetch failed:", err);
      setDivisionOptions([]);
    }
  }, [get]);

  const clearInquiries = useCallback(() => {
    setInquiryOptions([]);
    setInquiryOptionsError(null);
    setInquiryDetails(null);
    setDetailsError(null);
    setComparisonRows([]);
    setGridError(null);
  }, []);

  const fetchInquiryOptions = useCallback(
    async (divisionId) => {
      if (!divisionId || divisionId === "0") {
        setInquiryOptions([]);
        return [];
      }
      setIsLoadingInquiries(true);
      setInquiryOptionsError(null);
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PQC_CONFIG.SP_INQUIRY_LIST,
          JSon: JSON.stringify([
            {
              prmdivisionid: Number(divisionId) || 0,
              prmtrantype: PQC_CONFIG.TRAN_TYPE,
              prmtrandate: formatTranDate(new Date()),
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });

        if (isErrorPayload(res)) {
          const message = extractErrorMessage(res, "Failed to load inquiries for this division.");
          console.error("[PQC] Inquiry list SP returned an error:", message);
          setInquiryOptions([]);
          setInquiryOptionsError(message);
          return [];
        }

        // Field names confirmed live 2026-07-13 against IMS_LIVE (the app's actual
        // default backend project — NOT IMS_PGLIVE, which was tested earlier by
        // mistake and gave a false "broken SP" read): { inquiryno, inquiryid }.
        const opts = (res || []).map((r) => ({
          value: String(firstDefined(r, ["inquiryid", "inqmstid", "inqid", "InqID", "idnumber"])),
          label: String(firstDefined(r, ["inquiryno", "trancode", "TranCode", "inqno"]) ?? ""),
        }));
        setInquiryOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[PQC] Inquiry list fetch failed:", err);
        setInquiryOptions([]);
        setInquiryOptionsError(err?.message || "Failed to load inquiries for this division.");
        return [];
      } finally {
        setIsLoadingInquiries(false);
      }
    },
    [get]
  );

  const fetchInquiryDetails = useCallback(
    async (divisionId, inquiryId) => {
      if (!divisionId || !inquiryId) return null;
      setIsLoadingDetails(true);
      setDetailsError(null);
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PQC_CONFIG.SP_INQUIRY_DETAILS,
          JSon: JSON.stringify([
            {
              prmdivisionid: Number(divisionId) || 0,
              prmtrantype: PQC_CONFIG.TRAN_TYPE,
              prmtrandate: formatTranDate(new Date()),
              prmloginid: getUserSession().loginId,
              prminqid: Number(inquiryId) || 0,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });

        if (isErrorPayload(res)) {
          const message = extractErrorMessage(res, "Failed to load inquiry details.");
          console.error("[PQC] Inquiry details SP returned an error:", message);
          setInquiryDetails(null);
          setDetailsError(message);
          return null;
        }

        // fn_tbl_fetchinqdetails4comparision ignores its own prmdivisionid/prminqid
        // filters server-side (confirmed live — it always returns every inquiry for
        // every division) — res[0] is NOT reliably the selected inquiry. Match the
        // row explicitly by inqmstid instead of trusting array position.
        const targetId = String(Number(inquiryId) || 0);
        const rows = res || [];
        const row =
          rows.find((r) => String(firstDefined(r, ["inqmstid", "inquiryid"])) === targetId) ??
          rows[0] ??
          null;
        setInquiryDetails(row);
        return row;
      } catch (err) {
        console.warn("[PQC] Inquiry details fetch failed:", err);
        setInquiryDetails(null);
        setDetailsError(err?.message || "Failed to load inquiry details.");
        return null;
      } finally {
        setIsLoadingDetails(false);
      }
    },
    [get]
  );

  const fetchComparisonRows = useCallback(
    async (divisionId, inquiryId) => {
      if (!divisionId || !inquiryId) {
        setComparisonRows([]);
        return [];
      }
      setIsLoadingGrid(true);
      setGridError(null);
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PQC_CONFIG.SP_COMPARISON_GRID,
          JSon: JSON.stringify([
            {
              prmdivisionid: Number(divisionId) || 0,
              prmtrantype: PQC_CONFIG.TRAN_TYPE,
              prmtrandate: formatTranDate(new Date()),
              prmloginid: getUserSession().loginId,
              prminqid: Number(inquiryId) || 0,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        if (isErrorPayload(res)) {
          const message = extractErrorMessage(res, "Failed to load quotation comparison data.");
          console.error("[PQC] Comparison grid SP returned an error:", message);
          setGridError(message);
          setComparisonRows([]);
          return [];
        }

        const rows = res || [];
        setComparisonRows(rows);
        return rows;
      } catch (err) {
        console.error("[PQC] Comparison grid fetch failed:", err);
        setGridError(err?.message || "Failed to load quotation comparison data.");
        setComparisonRows([]);
        return [];
      } finally {
        setIsLoadingGrid(false);
      }
    },
    [get]
  );

  /** rows: full item×supplier matrix, each carrying a selection status flag. */
  const saveComparison = useCallback(
    async (divisionId, rows) => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const session = getUserSession();
        const detRows = rows.map((row) => ({
          ...row,
          loginid: session.loginId,
          sessionid: DEFAULT_SESSION_ID,
        }));

        const payload = await withSaveContextFields(
          buildSaveJsonFields({ label: "PQC", det: detRows }),
          { divisionId, isEdit: false }
        );

        const result = await post(PQC_CONFIG.SAVE_ENDPOINT, payload);
        const { success, message } = parseApiErrMsg(result);
        if (!success) throw new Error(message);
        return { success: true, message };
      } catch (err) {
        const message = err?.message || "Save failed. Please try again.";
        setSaveError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [post]
  );

  return {
    divisionOptions,
    fetchDivisionOptions,
    inquiryOptions,
    isLoadingInquiries,
    inquiryOptionsError,
    fetchInquiryOptions,
    clearInquiries,
    inquiryDetails,
    isLoadingDetails,
    detailsError,
    fetchInquiryDetails,
    comparisonRows,
    isLoadingGrid,
    gridError,
    fetchComparisonRows,
    saveComparison,
    isSaving,
    saveError,
  };
}
