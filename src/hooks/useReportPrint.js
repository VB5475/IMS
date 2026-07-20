// useReportPrint.js — Shared "Print Report" hook
// POSTs to /API/Report/GenerateReport (Crystal Reports PDF gateway) and opens
// the returned PDF blob in a new tab. Shared by every list page's Print
// button so the request shape and blob-handling logic exist in one place.

import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { API_BASE_URL_IMS, ENDPOINTS } from "../api/constants";

/** Extract a usable error message from a failed report response (may be a JSON blob, not a PDF). */
async function resolveBlobErrorMessage(blob, fallback) {
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text);
    return parsed?.message || parsed?.Message || fallback;
  } catch {
    return fallback;
  }
}

export function useReportPrint() {
  const { post } = useApi(API_BASE_URL_IMS);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState(null);

  /**
   * @param {{ reportTitle: string, reportFileName: string, jsonParameters?: Array<{paramtitle:string,paramname:string,paramval:string,paramtext?:string}>, outputFormat?: string }} opts
   */
  const printReport = useCallback(
    async ({ reportTitle, reportFileName, jsonParameters = [], outputFormat = "pdf" }) => {
      setPrinting(true);
      setError(null);
      try {
        const blob = await post(
          ENDPOINTS.GENERATE_REPORT,
          {
            reporttitle: reportTitle,
            reportfilename: reportFileName,
            isaddreporttitle: "1",
            recordselectionformula: "",
            reportoutputformat: outputFormat,
            jsonparameters: jsonParameters,
          },
          {},
          { responseType: "blob" }
        );

        if (!blob?.type?.includes("pdf")) {
          const message = await resolveBlobErrorMessage(blob, "Report generation failed.");
          throw new Error(message);
        }

        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener");
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (err) {
        const message = err?.message || "Failed to generate report.";
        setError(message);
        throw new Error(message);
      } finally {
        setPrinting(false);
      }
    },
    [post]
  );

  return { printReport, printing, error };
}
