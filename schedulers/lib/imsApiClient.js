// imsApiClient.js — thin client for the IMS REST gateway (/API/Values),
// used at the end of a sync run to tell IMS the newly-synced ZingHR data is
// ready to be pulled into its own tables.
//
// Same request shape as the frontend's ENDPOINTS.API_VALUES calls (see
// src/api/constants.js and docs/IMS_API_Reference.md, API 4.13):
//   POST {IMS_API_BASE_URL}/API/Values
//   { ObjType, ObjName, JSon: [...], p_ErrCode, p_ErrMsg }
// ObjType 1 = stored procedure — matches the project-wide convention that a
// "pr_"-prefixed ObjName is called with OBJ_TYPE.PROCEDURE (see
// TxnEntryPage.jsx's pr_fetch_departmentdata_ims / pr_fetch_supplierdata_ims
// calls), same as "fn_"-prefixed names use OBJ_TYPE.FUNCTION (2).

import axios from "axios";

const TRANSFER_SP_NAME = "pr_Transfer_IMSEmpSync";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createImsApiClient(config) {
  const http = axios.create({
    baseURL: config.imsApiBaseUrl,
    timeout: config.syncRequestTimeoutMs,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
  });

  async function transferEmpSyncOnce() {
    const response = await http.post("/API/Values", {
      ObjType: 1,
      ObjName: TRANSFER_SP_NAME,
      JSon: [{}],
      p_ErrCode: -1,
      p_ErrMsg: "",
    });
    return response.data;
  }

  /** Notifies IMS that the ZingHR sync completed, retrying like fetchEmployeePage does. */
  async function transferEmpSync() {
    let lastError;
    for (let attempt = 0; attempt <= config.syncMaxRetries; attempt++) {
      try {
        return await transferEmpSyncOnce();
      } catch (err) {
        lastError = err;
        if (attempt === config.syncMaxRetries) break;
        const delay = config.syncRetryDelayMs * (attempt + 1);
        console.warn(
          `[ims-api] ${TRANSFER_SP_NAME} attempt ${attempt + 1}/${config.syncMaxRetries + 1} failed: ${err.message}. Retrying in ${delay}ms…`
        );
        await sleep(delay);
      }
    }
    throw new Error(
      `[ims-api] ${TRANSFER_SP_NAME} failed after ${config.syncMaxRetries + 1} attempts: ${lastError.message}`
    );
  }

  return { transferEmpSync };
}
