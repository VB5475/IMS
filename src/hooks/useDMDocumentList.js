// useDMDocumentList.js — DM Document List (DMS module, standalone master).
// Two independently RB-driven grids: Grid 2 "Docs" (rb_dm_tranwisedocs,
// editable, the only one saved) and Grid 1 "Reference Documents"
// (rb_dm_tranwiseredocs, read-only, fetched on demand via the "Reference
// Documents" toggle). See constants.js for confirmed vs. open items.

import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, OBJ_TYPE, buildSaveRowFromColumns } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { withSaveContextFields, buildSaveJsonFields } from "../utils/savePayload";
import { resolveDetailColLinks, normalizeDetailColLinks } from "../utils/masterFormUtils";
import { buildGridColumns } from "../utils/gridUtils";
import { DM_DOCLIST_CONFIG as CFG } from "../pages/dm-document-list/constants";

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

export function useDMDocumentList() {
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

      // Grid 2 "Docs" — editable, dropdown cells for Document Type/Sub
      // Type/Category (ctrlsqlsource is empty for the first two live, so
      // options are supplied manually here rather than relying on the
      // generic GetFilterDetail resolver, which this app treats as
      // unreliable — see project conventions).
      setDocsColumns(
        buildGridColumns(
          docsCols,
          {
            [CFG.DOCTYPE_COL]: docTypeOpts,
            [CFG.SUBTYPE_COL]: docSubTypeOpts,
            [CFG.CATEGORY_COL]: categoryOpts,
          },
          { filterable: false, allEditable: true }
        )
      );
      // Grid 1 "Reference Documents" — read-only display, no dropdowns needed.
      setRefColumns(buildGridColumns(refCols, {}, { filterable: false, allEditable: false }));
    } catch (err) {
      console.error("[DMDocumentList] fetchHeaderMeta failed:", err);
      setMetaError(err?.message || "Failed to load Document List configuration.");
    } finally {
      setMetaFetching(false);
    }
  }, [get, fetchColumnsForRb]);

  /** "Reference Documents" button — fetches Grid 1's read-only rows. Param
   *  names are a best-guess pending DBA confirmation, see constants.js. */
  const fetchReferenceDocs = useCallback(async () => {
    const session = getUserSession();
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: CFG.SP_SHOW_DOC_LIST,
        JSon: JSON.stringify([{
          prmtranid: 0,
          prmreftrantypeid: 0,
          prmrefdepartmentid: 0,
          prmloginid: session.loginId,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      return resolveDetailColLinks(res) || [];
    } catch (err) {
      console.warn("[DMDocumentList] Reference Documents fetch failed:", err);
      return [];
    }
  }, [get]);

  /** Saves Grid 2 ("Docs") rows only — Grid 1 is read-only, never saved. */
  const saveDocs = useCallback(
    async (rows) => {
      setIsSaving(true);
      try {
        const session = getUserSession();
        const mstRows = rows.map((row) =>
          buildSaveRowFromColumns(row, docsColumns, {
            companyid: session.companyId,
            yearid: session.yearId,
            loginid: session.loginId,
            funccode: CFG.FORM_TAG,
          })
        );
        const payload = withSaveContextFields(
          buildSaveJsonFields({ label: CFG.FORM_TAG, mst: mstRows }),
          { divisionId: 0, isEdit: false }
        );
        return await post(CFG.SAVE_ENDPOINT, payload);
      } finally {
        setIsSaving(false);
      }
    },
    [post, docsColumns]
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
    isSaving,
  };
}
