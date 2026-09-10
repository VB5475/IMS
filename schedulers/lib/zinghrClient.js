// zinghrClient.js — thin client for ZingHR's employee master details API.
// Only ever logs err.message on failure, never the raw axios error object —
// that object's `config.data` is the request body we just sent, which
// includes the bearer Token, and would leak it into logs/stdout otherwise.

import axios from "axios";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createZingHrClient(config) {
  const http = axios.create({
    timeout: config.syncRequestTimeoutMs,
    headers: { "Content-Type": "application/json" },
  });

  async function fetchEmployeePageOnce({ fromDate, toDate, pageNumber, pageSize }) {
    const response = await http.post(config.zingHrApiUrl, {
      SubscriptionName: config.zingHrSubscriptionName,
      Token: config.zingHrToken,
      Fromdate: fromDate,
      ToDate: toDate,
      PageSize: pageSize,
      PageNumber: pageNumber,
    });

    const data = response.data;
    if (!data || Number(data.Code) !== 1) {
      throw new Error(
        `ZingHR API returned an error (page ${pageNumber}): ${data?.Message ?? "unknown error"} [Code=${data?.Code}]`
      );
    }
    return data;
  }

  /** Fetches one page, retrying on failure up to config.syncMaxRetries times
   *  with a linearly increasing delay between attempts. */
  async function fetchEmployeePage(params) {
    let lastError;
    for (let attempt = 0; attempt <= config.syncMaxRetries; attempt++) {
      try {
        return await fetchEmployeePageOnce(params);
      } catch (err) {
        lastError = err;
        if (attempt === config.syncMaxRetries) break;
        const delay = config.syncRetryDelayMs * (attempt + 1);
        console.warn(
          `[zinghr] page ${params.pageNumber} attempt ${attempt + 1}/${config.syncMaxRetries + 1} failed: ${err.message}. Retrying in ${delay}ms…`
        );
        await sleep(delay);
      }
    }
    throw new Error(`[zinghr] page ${params.pageNumber} failed after ${config.syncMaxRetries + 1} attempts: ${lastError.message}`);
  }

  return { fetchEmployeePage };
}
