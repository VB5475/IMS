// useDocumentLog.js — Document Log (F6 modal inside transaction forms).
// Replaces useDMDocumentList.js after the 2026-07-30 scope correction: this
// is no longer a standalone master, it's tied to whichever transaction
// record opened it (tranId passed in by the caller). See
// components/txn/documentLogConfig.js for the "why" and for the real API
// contract confirmed 2026-07-30 via the actual DM API spec doc.

import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, OBJ_TYPE, buildSaveRowFromColumns } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { resolveDetailColLinks, normalizeDetailColLinks } from "../utils/masterFormUtils";
import { isErrorOnlyRow } from "../utils/apiResponse";
import { buildGridColumns } from "../utils/gridUtils";
import { DOCUMENT_LOG_CONFIG as CFG } from "../components/txn/documentLogConfig";

// Overrides the axios instance's default `Content-Type: application/json`
// so it recomputes the correct multipart boundary header for FormData
// bodies instead — required for SAVE_ENDPOINT (see documentLogConfig.js).
const MULTIPART_CONFIG = { headers: { "Content-Type": undefined } };

function mapIdNameRows(rows, labelKeys) {
  return (rows || [])
    .map((r) => {
      const value = r.idnumber ?? r.IDNumber ?? r.IdNumber;
      if (value == null || value === "") return null;
      let label;
      for (const key of labelKeys) {
        if (r[key] != null && r[key] !== "") { label = r[key]; break; }
      }
      const num = Number(value);
      return { value: Number.isFinite(num) ? String(Math.round(num)) : String(value), label: String(label ?? value) };
    })
    .filter(Boolean);
}

/** Builds the multipart body SAVE_ENDPOINT actually expects: a `jsonstring`
 *  field (a JSON-encoded STRING, not a JSON request body) wrapping context
 *  + the row data (itself JSON-stringified again — "prmstrmstjson to
 *  contain dm_Tranwisedocs columns" per the DM API doc), plus an optional
 *  `file` field. One file per call (multipart semantics) — a document row
 *  and its file (if any) always travel together in the same request. */
function buildDocFormData({ mode, yearId, loginId, divisionId, mstRow, file }) {
  const formData = new FormData();
  formData.append(
    "jsonstring",
    JSON.stringify({
      prmmode: mode,
      prmyearid: String(yearId),
      prmloginid: String(loginId),
      prmdivisionid: String(divisionId),
      prmstrmstjson: JSON.stringify([mstRow]),
    })
  );
  if (file) formData.append("file", file);
  return formData;
}

export function useDocumentLog() {
  const { get } = useApi(API_BASE_URL);
  const { post } = useApi(API_BASE_URL_IMS);

  const [docsColumns, setDocsColumns] = useState([]);
  const [refColumns, setRefColumns] = useState([]);
  const [metaFetching, setMetaFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);

  const [docTypeOptions, setDocTypeOptions] = useState([]);
  const [docSubTypeOptions, setDocSubTypeOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);

  const [isSaving, setIsSaving] = useState(false);

  const fetchColumnsForRb = useCallback(
    async (rbCode) => {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: CFG.LIST_OBJ_TYPE,
        ObjName: CFG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: rbCode }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = resolveDetailColLinks(metaData)[0] ?? metaData?.[0];
      const rbid = tableRow?.RBID ?? tableRow?.rbid;
      if (!rbid) throw new Error(`No RB metadata returned for ${rbCode}.`);

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbid,
        prmLoginID: getUserSession().loginId,
      });
      return normalizeDetailColLinks(resolveDetailColLinks(colData));
    },
    [get]
  );

  /** Fetch both grids' column metadata + the 3 dropdown catalogs, in parallel. */
  const fetchHeaderMeta = useCallback(async () => {
    setMetaFetching(true);
    setMetaError(null);
    try {
      const [docsCols, refCols, docTypeRes, docSubTypeRes, categoryRes] = await Promise.all([
        fetchColumnsForRb(CFG.RB_TRANDETAIL),
        fetchColumnsForRb(CFG.RB_REFERENCEDETAIL),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: CFG.LIST_OBJ_TYPE,
          ObjName: CFG.SP_DOCUMENT_TYPE,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: CFG.LIST_OBJ_TYPE,
          ObjName: CFG.SP_DOCUMENT_SUBTYPE,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: CFG.LIST_OBJ_TYPE,
          ObjName: CFG.SP_CATEGORY,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }),
      ]);

      const docTypeOpts = mapIdNameRows(resolveDetailColLinks(docTypeRes), ["name", "Name"]);
      const docSubTypeOpts = mapIdNameRows(resolveDetailColLinks(docSubTypeRes), ["name", "Name"]);
      const categoryOpts = (resolveDetailColLinks(categoryRes) || [])
        .map((r) => {
          const value = r.categorytypeid ?? r.CategoryTypeID;
          if (value == null) return null;
          return { value: String(Math.round(Number(value))), label: String(r.category ?? r.Category ?? value) };
        })
        .filter(Boolean);

      setDocTypeOptions(docTypeOpts);
      setDocSubTypeOptions(docSubTypeOpts);
      setCategoryOptions(categoryOpts);

      // Both grids' raw RB columns now carry ~25 extra visible+mandatory
      // system/audit columns (idnumber, guid, tranid, ref_trantypeid,
      // ref_departmentid, sessionid, etc. — see documentLogConfig.js's "RB
      // CHANGED UPSTREAM" note) that were never meant to be user-facing
      // fields. Whitelist down to the real content columns before building
      // grid columns — the system ones still get correct VALUES, just via
      // the save context (saveDocs/uploadDoc) instead of a blank input.
      const whitelistedDocsCols = docsCols.filter((c) => CFG.GRID_ROW_COLS.includes(c.colname));
      const whitelistedRefCols = refCols.filter((c) => CFG.GRID_ROW_COLS.includes(c.colname));

      // Grid 2 "Docs" — editable, dropdown cells for Document Type/Sub
      // Type/Category (ctrlsqlsource is empty for the first two live, so
      // options are supplied manually here rather than relying on the
      // generic GetFilterDetail resolver, which this app treats as
      // unreliable — see project conventions).
      setDocsColumns(
        buildGridColumns(
          whitelistedDocsCols,
          {
            [CFG.DOCTYPE_COL]: docTypeOpts,
            [CFG.SUBTYPE_COL]: docSubTypeOpts,
            [CFG.CATEGORY_COL]: categoryOpts,
          },
          { filterable: false, allEditable: true }
        )
      );
      // Grid 1 "Reference Documents" — read-only display, no dropdowns needed.
      setRefColumns(buildGridColumns(whitelistedRefCols, {}, { filterable: false, allEditable: false }));
    } catch (err) {
      console.error("[DocumentLog] fetchHeaderMeta failed:", err);
      setMetaError(err?.message || "Failed to load Document Log configuration.");
    } finally {
      setMetaFetching(false);
    }
  }, [get, fetchColumnsForRb]);

  /** Reference Documents — fetched ONLY on explicit "Reference Document"
   *  button click (no auto-load on modal open, per the user's spec: the
   *  grid starts empty and stays empty until this is called). Scoped to
   *  (login, transaction type, GUID, tranid) — a plain 4-named-arg FUNCTION,
   *  live-confirmed on IMS_LIVE (executes cleanly; returns `[ ]` — table is
   *  empty, brand-new feature). Not deployed on IMS_PGLIVE yet. */
  const fetchReferenceDocs = useCallback(
    async ({ refTranTypeId = 0, guid = "", tranId = 0 } = {}) => {
      const session = getUserSession();
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: CFG.SP_FETCH_DOC_DATA,
          JSon: JSON.stringify([{
            prmloginid: session.loginId,
            prmref_trantypeid: Number(refTranTypeId) || 0,
            prmguid: guid || "",
            prmtranid: Number(tranId) || 0,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const rows = resolveDetailColLinks(res) || [];
        // The function returns a bare {ErrCode,ErrMsg} envelope as its one
        // and only "row" when there's genuinely nothing to show — without
        // this filter it renders as a real but blank row (dashes everywhere)
        // with a live View button attached.
        if (rows.length === 1 && isErrorOnlyRow(rows[0])) return [];
        return rows;
      } catch (err) {
        console.warn("[DocumentLog] Reference Documents fetch failed:", err);
        return [];
      }
    },
    [get]
  );

  /** Saves Grid 2 ("Docs") rows, one SAVE_ENDPOINT call per row (multipart,
   *  no file — metadata-only rows added via "Add Row"/manual entry, not
   *  the per-row "Upload" action which attaches a real file, see uploadDoc
   *  below). Returns one raw result per row for the caller to inspect. */
  const saveDocs = useCallback(
    async (rows, tranId = 0, divisionId = 0, refTranTypeId = 0) => {
      setIsSaving(true);
      try {
        const session = getUserSession();
        const results = [];
        for (const row of rows) {
          const mstRow = buildSaveRowFromColumns(row, docsColumns, {
            companyid: session.companyId,
            yearid: session.yearId,
            loginid: session.loginId,
            funccode: CFG.FORM_TAG,
            tranid: Number(tranId) || 0,
            // Newly-mandatory on the RB (see documentLogConfig.js's "RB
            // CHANGED UPSTREAM" note) — must be supplied explicitly now.
            ref_trantypeid: Number(refTranTypeId) || 0,
            ref_departmentid: CFG.DEFAULT_REF_DEPARTMENT_ID,
          });
          const formData = buildDocFormData({
            mode: "A",
            yearId: session.yearId,
            loginId: session.loginId,
            divisionId,
            mstRow,
          });
          // eslint-disable-next-line no-await-in-loop -- each call must carry
          // its own row/file pair; the endpoint takes one file per request.
          results.push(await post(CFG.SAVE_ENDPOINT, formData, {}, MULTIPART_CONFIG));
        }
        return results;
      } finally {
        setIsSaving(false);
      }
    },
    [post, docsColumns]
  );

  /** Mints a fresh GUID for a single document upload — per explicit user
   *  spec, a NEW guid is generated on EVERY upload (not the one page-level
   *  docGuid reused across the whole unsaved transaction). Same endpoint/
   *  casing as PurchaseIndentForm.jsx's fetchDocGuid (lowercase field names
   *  — confirmed live 2026-07-30, see project_indent_dm_handle_guid memory).
   *  Best-effort: a failure here must never block the upload, so it falls
   *  back to an empty string rather than throwing. */
  const fetchNewDocGuid = useCallback(
    async ({ refTranTypeId = 0, tranId = 0 } = {}) => {
      const session = getUserSession();
      try {
        const res = await post(ENDPOINTS.DM_HANDLE_GUID, {
          prmguid: "1",
          prmref_trantypeid: Number(refTranTypeId) || 0,
          prmtranid: Number(tranId) || 0,
        });
        const row = Array.isArray(res) ? res[0] : res;
        const guid = row?.guid ?? row?.Guid ?? row?.GUID ?? row?.guId;
        return guid ? String(guid) : "";
      } catch (err) {
        console.warn("[DocumentLog] fetchNewDocGuid failed:", err);
        return "";
      }
    },
    [post]
  );

  /** "Upload" per-row action — same SAVE_ENDPOINT as saveDocs, but for
   *  exactly one row with a real file attached. Mints its own fresh `guid`
   *  (see fetchNewDocGuid above) and sends it as part of the row's own
   *  `guid` column — a real column on rb_dm_tranwisedocs, per the DM API
   *  doc's "Prmstrmstjson to contain dm_Tranwisedocs columns" note. */
  const uploadDoc = useCallback(
    async (row, file, tranId = 0, divisionId = 0, refTranTypeId = 0) => {
      const session = getUserSession();
      const guid = await fetchNewDocGuid({ refTranTypeId, tranId });
      const mstRow = buildSaveRowFromColumns(row, docsColumns, {
        companyid: session.companyId,
        yearid: session.yearId,
        loginid: session.loginId,
        funccode: CFG.FORM_TAG,
        tranid: Number(tranId) || 0,
        guid,
        // Newly-mandatory on the RB (see documentLogConfig.js's "RB CHANGED
        // UPSTREAM" note) — must be supplied explicitly now.
        ref_trantypeid: Number(refTranTypeId) || 0,
        ref_departmentid: CFG.DEFAULT_REF_DEPARTMENT_ID,
      });
      const formData = buildDocFormData({
        mode: "A",
        yearId: session.yearId,
        loginId: session.loginId,
        divisionId,
        mstRow,
        file,
      });
      return post(CFG.SAVE_ENDPOINT, formData, {}, MULTIPART_CONFIG);
    },
    [post, docsColumns, fetchNewDocGuid]
  );

  /** "View" button — per the DM API doc, a SUCCESSFUL call returns the raw
   *  file itself ("Document sent to response"), not JSON; only a failure
   *  returns the familiar {ErrCode,ErrMsg} envelope. Both arrive as a Blob
   *  when responseType is "blob", so the only way to tell them apart is to
   *  try reading it as JSON text — a real file's bytes won't parse. */
  const viewDoc = useCallback(
    async (docId) => {
      const session = getUserSession();
      let blob;
      try {
        blob = await post(
          CFG.VIEW_ENDPOINT,
          { prmdocid: Number(docId) || 0, prmloginid: session.loginId },
          {},
          { responseType: "blob" }
        );
      } catch {
        // HTTP-level failure (404/500/etc.) — the endpoint isn't reachable
        // at all, so there's no error envelope to parse. Fail gracefully
        // rather than surfacing the raw axios message.
        return { isError: true, message: "Failed to load document." };
      }
      try {
        const text = await blob.text();
        const parsed = JSON.parse(text);
        const row = Array.isArray(parsed) ? parsed[0] : parsed;
        return { isError: true, message: row?.ErrMsg ?? row?.errmsg ?? "Document not found." };
      } catch {
        return { isError: false, blob };
      }
    },
    [post]
  );

  /** NEW per the DM API doc — links documents uploaded against a temporary
   *  GUID (before the parent transaction had a real TranID) to the real
   *  TranID once the transaction actually saves. Built for availability;
   *  NOT yet called from any transaction's save flow — see
   *  documentLogConfig.js for why that's a deliberate follow-up, not an
   *  oversight. */
  const updateDocsOnTranSave = useCallback(
    async ({ tranTypeId, guid, tranId, divisionId }) => {
      const session = getUserSession();
      return post(CFG.UPDATE_ON_TRAN_SAVE_ENDPOINT, {
        prmtrantypeid: tranTypeId,
        prmguid: guid,
        prmtranid: tranId,
        prmyearid: session.yearId,
        prmloginid: session.loginId,
        prmdivisionid: divisionId,
      });
    },
    [post]
  );

  return {
    docsColumns,
    refColumns,
    metaFetching,
    metaError,
    fetchHeaderMeta,
    docTypeOptions,
    docSubTypeOptions,
    categoryOptions,
    fetchReferenceDocs,
    saveDocs,
    uploadDoc,
    viewDoc,
    updateDocsOnTranSave,
    isSaving,
  };
}
