// useTermsConditionMaster.js — RB metadata, column defs, and dropdown
// options for the Terms and Condition Master modal.
//
// Reuses the SAME generic fetchDropdownOptions/GET_FILTER_DETAIL mechanism
// every transaction form (PO, PI, GRN) uses for its dropdown columns,
// instead of hardcoding a one-off "Terms Type" fetch the way Voucher Type
// Master hardcoded Module/Levy Formula — this RB's termstypeid column
// already carries everything that mechanism needs (objdetid, ctrlsqlsource),
// live-confirmed to return 31 real options.
import { useState, useCallback, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL, OBJ_TYPE, DEFAULT_SESSION_ID } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { fetchDropdownOptions } from "../utils/gridUtils";
import { TCM_CONFIG } from "../pages/terms-condition-master/constants";

export function useTermsConditionMaster() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);
  const [dropdownOptions, setDropdownOptions] = useState({});

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: TCM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: TCM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Terms and Condition Master RB metadata returned.");
      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(TCM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      const apiColumns = colData || [];
      setHeaderColumns(apiColumns);
      setAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));

      const opts = await fetchDropdownOptions(get, apiColumns, hdrMeta.RBID, {
        funcCode: TCM_CONFIG.RB_MASTER,
        divisionID: 0,
        existingRecordEdit: false,
      });
      setDropdownOptions(opts);
    } catch (err) {
      console.error("[TCM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Terms and Condition Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // Per-record fetch for Edit — fn_tbl_rb_termnconditionmst(prmcompanyid,
  // prmyearid, prmloginid, prmsessionid, prmmasterid). Same FN_FETCH_DATA/
  // JSon call shape as the list (see TermsConditionMasterPage.jsx), just a
  // different SP + an added prmmasterid keyed on the row's idnumber.
  const fetchEditRecord = useCallback(async (idNumber) => {
    const session = getUserSession();
    const res = await get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: OBJ_TYPE.FUNCTION,
      ObjName: TCM_CONFIG.SP_EDIT,
      JSon: JSON.stringify([{
        prmcompanyid: session.companyId,
        prmyearid: session.yearId,
        prmloginid: session.loginId,
        prmsessionid: session.sessionId || DEFAULT_SESSION_ID,
        prmmasterid: idNumber,
      }]),
      p_ErrCode: -1,
      p_ErrMsg: "",
    });
    return res?.[0] ?? null;
  }, [get]);

  return {
    headerColumns, allColumns, headerFetching, headerError, fetchHeaderMeta,
    dropdownOptions, fetchEditRecord,
  };
}
