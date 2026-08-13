// useDocumentLog.js — Document Log (F6 modal inside transaction forms).
// Replaces useDMDocumentList.js after the 2026-07-30 scope correction: this
// is no longer a standalone master, it's tied to whichever transaction
// record opened it (tranId passed in by the caller). See
// components/txn/documentLogConfig.js for the "why" and for the real API
// contract confirmed 2026-07-30 via the actual DM API spec doc.

import { useState, useCallback, useRef } from "react";
import { useApi } from "../api/useApi";
import { ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, buildSaveRowFromColumns, nowStoredValue } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { resolveDetailColLinks, normalizeDetailColLinks } from "../utils/masterFormUtils";
import { isErrorOnlyRow } from "../utils/apiResponse";
import { buildGridColumns } from "../utils/gridUtils";
import { DOCUMENT_LOG_CONFIG as CFG } from "../components/txn/documentLogConfig";

// Overrides the axios instance's default `Content-Type: application/json`
// so it recomputes the correct multipart boundary header for FormData
// bodies instead — required for SAVE_ENDPOINT (see documentLogConfig.js).
const MULTIPART_CONFIG = { headers: { "Content-Type": undefined } };

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
  const [categoryOptions, setCategoryOptions] = useState([]);

  const [isSaving, setIsSaving] = useState(false);

  // Sub Type options are no longer a flat catalog (see SP_DOCUMENT_SUBTYPE's
  // note in documentLogConfig.js) — cached per documentTypeId instead, keyed
  // loosely since refTranTypeId/refDepartmentId are constant for the life of
  // one modal session.
  const docSubTypeCacheRef = useRef(new Map());

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

  /** Fetch both grids' column metadata + the 3 dropdown catalogs, in parallel.
   *  Document Type is now scoped (refTranTypeId/refDepartmentId), per the
   *  2026-07-31 API replacement — see documentLogConfig.js's SP_DOCUMENT_TYPE
   *  note. Caller passes the same values it already threads through for the
   *  Reference Document/Refresh buttons. */
  const fetchHeaderMeta = useCallback(async ({ refTranTypeId = 0, refDepartmentId = CFG.PURCHASE_REF_DEPARTMENT_ID } = {}) => {
    setMetaFetching(true);
    setMetaError(null);
    try {
      const session = getUserSession();
      // Sub Type is deliberately NOT fetched here anymore — it's a genuine
      // per-row cascade now (see SP_DOCUMENT_SUBTYPE's note in
      // documentLogConfig.js), fetched on demand via fetchDocSubTypeOptions
      // whenever a row's own Document Type value changes.
      const [docsCols, refCols, docTypeRes, categoryRes] = await Promise.all([
        fetchColumnsForRb(CFG.RB_TRANDETAIL),
        fetchColumnsForRb(CFG.RB_REFERENCEDETAIL),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: CFG.LIST_OBJ_TYPE,
          ObjName: CFG.SP_DOCUMENT_TYPE,
          JSon: JSON.stringify([{
            prmloginid: session.loginId,
            prmref_trantypeid: Number(refTranTypeId) || 0,
            prmref_departmentid: Number(refDepartmentId) || 0,
          }]),
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

      // The new scoped function returns documenttypeid/documenttype (NOT
      // idnumber/name like the old, unscoped fn_tbl_dm_documenttype_list did
      // — which, live-checked 2026-07-31, was actually returning the
      // TRANSACTION type list, not document types at all) — mapIdNameRows
      // doesn't fit this shape, so map it directly here, same pattern as
      // categoryOpts below.
      const docTypeOpts = (resolveDetailColLinks(docTypeRes) || [])
        .map((r) => {
          const value = r.documenttypeid ?? r.DocumentTypeID;
          if (value == null) return null;
          return { value: String(Math.round(Number(value))), label: String(r.documenttype ?? r.DocumentType ?? value) };
        })
        .filter(Boolean);
      const categoryOpts = (resolveDetailColLinks(categoryRes) || [])
        .map((r) => {
          const value = r.categorytypeid ?? r.CategoryTypeID;
          if (value == null) return null;
          return { value: String(Math.round(Number(value))), label: String(r.category ?? r.Category ?? value) };
        })
        .filter(Boolean);

      setDocTypeOptions(docTypeOpts);
      setCategoryOptions(categoryOpts);

      // Both grids' raw RB columns now carry ~25 extra visible+mandatory
      // system/audit columns (idnumber, guid, tranid, ref_trantypeid,
      // ref_departmentid, sessionid, etc. — see documentLogConfig.js's "RB
      // CHANGED UPSTREAM" note) that were never meant to be user-facing
      // fields. Whitelist down to the real content columns before building
      // grid columns — the system ones still get correct VALUES, just via
      // the save context (saveDocs) instead of a blank input.
      const whitelistedDocsCols = docsCols.filter((c) => CFG.GRID_ROW_COLS.includes(c.colname));
      const whitelistedRefCols = refCols.filter((c) => CFG.GRID_ROW_COLS.includes(c.colname));

      // Grid 2 "Docs" — editable, dropdown cells for Document Type/Sub
      // Type/Category (ctrlsqlsource is empty for the first two live, so
      // options are supplied manually here rather than relying on the
      // generic GetFilterDetail resolver, which this app treats as
      // unreliable — see project conventions). Sub Type starts with an empty
      // static list — it has no flat catalog anymore, see rowOptionsKey patch
      // below.
      const builtDocsCols = buildGridColumns(
        whitelistedDocsCols,
        {
          [CFG.DOCTYPE_COL]: docTypeOpts,
          [CFG.CATEGORY_COL]: categoryOpts,
        },
        { filterable: false, allEditable: true }
      );
      // Sub Type is a per-row cascade (see SP_DOCUMENT_SUBTYPE's note) — its
      // options come from each row's OWN CFG.SUBTYPE_ROW_OPTIONS_KEY field
      // (populated by DocumentLogModal's onCellEvent handler via
      // fetchDocSubTypeOptions below) instead of a single static list.
      setDocsColumns(
        builtDocsCols.map((c) =>
          c.key === CFG.SUBTYPE_COL ? { ...c, rowOptionsKey: CFG.SUBTYPE_ROW_OPTIONS_KEY } : c
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
   *  (login, transaction type, tranid).
   *
   *  2026-08-12 /pm: swapped from the FN_Fetch_Data/
   *  fn_tbl_rb_dm_trnwisedocs_fetch_DocData function call to a dedicated
   *  POST endpoint (DM_DOC_LIST_REF), same request/response shape as
   *  DM_HANDLE_GUID/DM_HANDLE_BUTTON_VISIBILITY (api/constants.js) — plain
   *  JSON object body, lowercase field names, no guid param. Response shape
   *  not yet live-verified; resolveDetailColLinks tolerates a bare array, an
   *  object with a top-level `.Table`, or `.Links`, so this stays defensive
   *  either way — adjust here once the real shape is confirmed. */
  const fetchReferenceDocs = useCallback(
    async ({ refTranTypeId = 0, tranId = 0 } = {}) => {
      const session = getUserSession();
      try {
        const res = await post(ENDPOINTS.DM_DOC_LIST_REF, {
          prmloginid: session.loginId,
          prmref_trantypeid: Number(refTranTypeId) || 0,
          prmtranid: Number(tranId) || 0,
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
    [post]
  );

  /** "Refresh" button (Docs section) — fetches documents ALREADY uploaded
   *  for this transaction, appended into the same Docs grid (tagged and
   *  excluded from Save, see DocumentLogModal.jsx).
   *
   *  2026-08-12 /pm: swapped from the FN_Fetch_Data/
   *  fn_tbl_rb_dm_tranwisedocs_showdoclist function call to a dedicated POST
   *  endpoint (DM_DOC_LIST), same shape as DM_DOC_LIST_REF above but keeps
   *  prmtranguid (unlike Reference Documents) — Refresh still needs to match
   *  documents staged against a not-yet-saved record's GUID. Response shape
   *  not yet live-verified; see fetchReferenceDocs' note above. */
  const fetchUploadedDocs = useCallback(
    async ({ refTranTypeId = 0, tranId = 0, guid = "" } = {}) => {
      const session = getUserSession();
      try {
        const res = await post(ENDPOINTS.DM_DOC_LIST, {
          prmloginid: session.loginId,
          prmref_trantypeid: Number(refTranTypeId) || 0,
          prmtranid: Number(tranId) || 0,
          prmtranguid: guid || "",
        });
        const rows = resolveDetailColLinks(res) || [];
        if (rows.length === 1 && isErrorOnlyRow(rows[0])) return [];
        return rows;
      } catch (err) {
        console.warn("[DocumentLog] Uploaded Docs fetch failed:", err);
        return [];
      }
    },
    [post]
  );

  /** Sub Type per-row cascade — called from DocumentLogModal's onCellEvent
   *  whenever a Docs row's own Document Type value changes. Live-confirmed
   *  via curl: prmdocumenttypeid=0 returns `[ ]` (genuinely empty, not "all"),
   *  a real id returns exactly the matching subtype(s) — so a documentTypeId
   *  of 0 is short-circuited here rather than sent (saves a guaranteed-empty
   *  round trip). Cached per documentTypeId since refTranTypeId/
   *  refDepartmentId don't change within one modal session. */
  const fetchDocSubTypeOptions = useCallback(
    async ({ refTranTypeId = 0, refDepartmentId = CFG.PURCHASE_REF_DEPARTMENT_ID, documentTypeId = 0 } = {}) => {
      const docTypeId = Number(documentTypeId) || 0;
      if (!docTypeId) return [];
      const cacheKey = `${refTranTypeId}:${refDepartmentId}:${docTypeId}`;
      if (docSubTypeCacheRef.current.has(cacheKey)) return docSubTypeCacheRef.current.get(cacheKey);
      const session = getUserSession();
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: CFG.LIST_OBJ_TYPE,
          ObjName: CFG.SP_DOCUMENT_SUBTYPE,
          JSon: JSON.stringify([{
            prmloginid: session.loginId,
            prmref_trantypeid: Number(refTranTypeId) || 0,
            prmref_departmentid: Number(refDepartmentId) || 0,
            prmdocumenttypeid: docTypeId,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const rows = resolveDetailColLinks(res) || [];
        const opts = rows
          .map((r) => {
            const value = r.documentsubtypeid ?? r.DocumentSubTypeID;
            if (value == null) return null;
            return { value: String(Math.round(Number(value))), label: String(r.documentsubtype ?? r.DocumentSubType ?? value) };
          })
          .filter(Boolean);
        docSubTypeCacheRef.current.set(cacheKey, opts);
        return opts;
      } catch (err) {
        console.warn("[DocumentLog] Sub Type fetch failed:", err);
        return [];
      }
    },
    [get]
  );

  /** Saves Grid 2 ("Docs") rows, one SAVE_ENDPOINT call per row (multipart).
   *  Returns one raw result per row for the caller to inspect. Takes the
   *  SAME shared per-transaction `guid` as Refresh/Reference Document —
   *  previously omitted entirely (flagged gap); now included so
   *  DM_Doc_UpdateOnTranSave can link these rows to the real tranid once the
   *  parent transaction saves (see PurchaseIndentForm.jsx).
   *
   *  REVERSED 2026-07-31 (explicit user instruction): "Upload" used to call
   *  this same endpoint immediately, on its own, the moment a file was
   *  picked — separate from clicking the modal's own Save button. Now Upload
   *  only STAGES the file locally on the row (DocumentLogModal.jsx's
   *  handleFileSelected sets `row._file` — leading-underscore convention,
   *  see buildSaveRowFromColumns' guard in api/constants.js, so it never
   *  itself leaks into a payload), and this function is the ONE place that
   *  actually calls the API — for every row, whether it carries a staged
   *  `_file` (an "uploaded" row with a real attachment) or not (a plain
   *  metadata-only row). The file-metadata columns (documentname/filename/
   *  fileext/filesize) are already set on the row by handleFileSelected at
   *  staging time, so they flow through via buildSaveRowFromColumns' own
   *  row-field passthrough — no separate derivation needed here. */
  const saveDocs = useCallback(
    async (rows, tranId = 0, divisionId = 0, refTranTypeId = 0, guid = "", refDepartmentId = CFG.PURCHASE_REF_DEPARTMENT_ID) => {
      setIsSaving(true);
      try {
        const session = getUserSession();
        const results = [];
        const nowStamp = nowStoredValue();
        for (const row of rows) {
          const mstRow = buildSaveRowFromColumns(row, docsColumns, {
            companyid: session.companyId,
            yearid: session.yearId,
            loginid: session.loginId,
            funccode: CFG.FORM_TAG,
            tranid: Number(tranId) || 0,
            guid,
            // Newly-mandatory on the RB (see documentLogConfig.js's "RB
            // CHANGED UPSTREAM" note) — must be supplied explicitly now.
            ref_trantypeid: Number(refTranTypeId) || 0,
            ref_departmentid: Number(refDepartmentId) || 0,
            // Confirmed via the real stored-proc signature 2026-07-30 (see
            // documentLogConfig.js) — idnumber/createdby/createddate/
            // updatedby/updatedate were previously never sent at all.
            idnumber: 0,
            createdby: session.loginId,
            createddate: nowStamp,
            updatedby: session.loginId,
            updateddate: nowStamp,
            versionno: 1,
          });
          const formData = buildDocFormData({
            mode: "A",
            yearId: session.yearId,
            loginId: session.loginId,
            divisionId,
            mstRow,
            file: row._file || undefined,
          });
          // Each call must carry its own row/file pair; the endpoint takes
          // one file per request.
          results.push(await post(CFG.SAVE_ENDPOINT, formData, {}, MULTIPART_CONFIG));
        }
        return results;
      } finally {
        setIsSaving(false);
      }
    },
    [post, docsColumns]
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
    categoryOptions,
    fetchReferenceDocs,
    fetchUploadedDocs,
    fetchDocSubTypeOptions,
    saveDocs,
    viewDoc,
    updateDocsOnTranSave,
    isSaving,
  };
}
