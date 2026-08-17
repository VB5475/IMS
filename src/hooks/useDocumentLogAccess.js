// useDocumentLogAccess.js — shared Document Log (F6) integration hook.
//
// 2026-08-13 (/pm): extracted out of PurchaseIndentForm.jsx, which was the
// only module wired up to Document Log and had every bit of this logic
// (permission gates, GUID issuance, button-visibility fetch, post-save
// document linking) written inline. Rolling Document Log out to 8 more
// modules (5 Purchase-flow transaction forms + Item/Supplier/Customer
// Master) made that duplication real — this hook is what every one of them
// (including Indent itself, refactored onto it) now shares.
//
// Two integration shapes consume this hook differently:
// - "Transaction" forms (Indent + Purchase Inquiry/Quotation/Order/GRN/
//   Voucher) have an ActionBar `extraButtons` array and F6 via
//   useEntryFormKeyboard's `onDocuments` — they spread `documentsButtonEntry`
//   into their buttons array and wire `handleOpenDocuments` to `onDocuments`.
// - "Master" forms (Item/Supplier/Customer) have no ActionBar/F6 — they build
//   their own footer button from `isDocumentLogEnabled` directly instead.
//
// 2026-08-17 (/pm): the app-wide convention is now hide/show ONLY — no
// disabled state anywhere. `documentsButtonEntry` (and every master form's
// own button) gates on `isDocumentLogEnabled` (rights AND Add/Edit mode
// active), not just rights alone — a prior version showed the button
// whenever rights allowed even outside Add/Edit mode (a no-op click), and
// master forms additionally rendered a disabled+explanatory-title button
// instead of hiding it. Both are gone now; every consumer shows the button
// only when it's actually clickable.

import { useState, useCallback, useEffect, useRef } from "react";
import { FileText } from "lucide-react";
import { useUser } from "../context/UserContext";
import { useNotification } from "../context/NotificationContext";
import { ENDPOINTS } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { parseApiErrMsg } from "../utils/apiResponse";
import { FORM_SHORTCUT_TITLES } from "../constants/formShortcuts";
import { DOCUMENT_LOG_CONFIG as DOC_LOG_CFG } from "../components/txn/documentLogConfig";

/**
 * @param {object} params
 * @param {number} params.tranTypeId - the module's own DM_TRAN_TYPE_ID.
 * @param {number} params.refDepartmentId - DM Department Master id this
 *   module's Document Log scopes to (1="PURCHASE", 6="ADMIN", ...).
 * @param {number} params.recordId - current tranid/idnumber; 0 = new/unsaved.
 * @param {() => number} params.getDivisionId - read fresh at link-time
 *   (not closed over), since it can change while a form is open.
 * @param {boolean} params.isEditMode - the module's own Add/Edit-active flag.
 * @param {(url: string, body?: object) => Promise<any>} params.postSave -
 *   the module's own postSave from useApi(API_BASE_URL_IMS).
 * @param {string} [params.logLabel] - console.warn prefix, e.g. "[PO]".
 */
export function useDocumentLogAccess({
  tranTypeId,
  refDepartmentId,
  recordId,
  getDivisionId,
  isEditMode,
  postSave,
  logLabel = "[DocLog]",
}) {
  const { user } = useUser();
  const notify = useNotification();

  // Must be read reactively via useUser(), not a getUserSession() snapshot —
  // RequireAuth (App.jsx) re-fetches DM_Config asynchronously on every full
  // page reload, not just a fresh login, and doesn't block rendering while
  // that fetch is in flight. A static snapshot read here could catch
  // dmConfig still null on a hard reload landed directly on a Document-Log
  // page, and since it wouldn't be a subscribed value, this hook would never
  // re-render once the fetch resolved.
  const dmConfig = user.dmConfig;
  const dmConfigAllows = dmConfig?.isdmrequired === "Y" && dmConfig?.isdmdbbased === "Y";

  const [docBtnVisible, setDocBtnVisible] = useState("NO");
  const [docGuid, setDocGuid] = useState("");
  const [docModalOpen, setDocModalOpen] = useState(false);
  const docModalRef = useRef(null);

  const isDocumentLogEnabled = dmConfigAllows && docBtnVisible === "YES" && isEditMode;

  const handleOpenDocuments = useCallback(() => {
    if (!isDocumentLogEnabled) return;
    setDocModalOpen(true);
  }, [isDocumentLogEnabled]);

  // tranId: the real recordId in edit mode, 0 for a new/unsaved record.
  const fetchDocGuid = useCallback(async (tranId = 0) => {
    try {
      const res = await postSave(ENDPOINTS.DM_HANDLE_GUID, {
        prmguid: "1",
        prmref_trantypeid: tranTypeId,
        prmtranid: Number(tranId) || 0,
      });
      const row = Array.isArray(res) ? res[0] : res;
      const guid = row?.guid ?? row?.Guid ?? row?.GUID ?? row?.guId;
      if (guid) setDocGuid(String(guid));
    } catch (err) {
      console.warn(`${logLabel} DM HandleGUID fetch failed:`, err);
    }
  }, [postSave, tranTypeId, logLabel]);

  const resetDocGuid = useCallback(() => setDocGuid(""), []);

  const fetchDocBtnVisible = useCallback(async () => {
    try {
      const res = await postSave(ENDPOINTS.DM_HANDLE_BUTTON_VISIBILITY, {
        prmref_trantypeid: tranTypeId,
        prmloginid: getUserSession().loginId,
      });
      const row = Array.isArray(res) ? res[0] : res;
      const visible = row?.isdmbtnvisible ?? row?.IsDMBtnVisible;
      setDocBtnVisible(visible === "YES" ? "YES" : "NO");
    } catch (err) {
      console.warn(`${logLabel} DM HandleButtonVisibility fetch failed:`, err);
      setDocBtnVisible("NO");
    }
  }, [postSave, tranTypeId, logLabel]);

  // Fires once per (tranTypeId, recordId) pair, alongside whatever else the
  // caller's own mount effect does — deliberately self-contained so wiring
  // a new module in doesn't require touching its existing mount effect.
  useEffect(() => {
    fetchDocGuid(recordId);
    fetchDocBtnVisible();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, tranTypeId]);

  // Links any documents saved against docGuid (before this record had a real
  // id) to the now-real, just-saved id. Best-effort: a failure here must
  // never block the caller's own save success (it already succeeded).
  const linkDocsToTransaction = useCallback(
    async (realTranId) => {
      if (!docGuid || !realTranId) return;
      try {
        const session = getUserSession();
        const result = await postSave(DOC_LOG_CFG.UPDATE_ON_TRAN_SAVE_ENDPOINT, {
          prmtrantypeid: tranTypeId,
          prmguid: docGuid,
          prmtranid: Number(realTranId) || 0,
          prmyearid: session.yearId,
          prmloginid: session.loginId,
          prmdivisionid: Number(getDivisionId?.()) || 0,
        });
        const { success, message } = parseApiErrMsg(result);
        if (!success) console.warn(`${logLabel} DM_Doc_UpdateOnTranSave failed:`, message);
      } catch (err) {
        console.warn(`${logLabel} DM_Doc_UpdateOnTranSave failed:`, err);
      }
    },
    [postSave, docGuid, tranTypeId, getDivisionId, logLabel]
  );

  // Called right after the caller's own save succeeds. Consolidates saving
  // any document rows staged in the modal but never explicitly submitted via
  // its own Save button, then links pre-save-staged docs to the real id.
  // Both steps are best-effort — neither can undo the caller's own save,
  // which has already succeeded by the time this runs.
  const finalizeSave = useCallback(
    async (savedTranId) => {
      try {
        const docResult = await docModalRef.current?.saveDocuments?.(savedTranId);
        if (docResult?.success === false) {
          notify.error(docResult.message || "Document save failed.");
        } else if (docResult?.count) {
          notify.success(`Saved ${docResult.count} document row(s).`);
        }
      } catch (err) {
        console.warn(`${logLabel} Document save failed:`, err);
      }
      if (savedTranId) await linkDocsToTransaction(savedTranId);
    },
    [linkDocsToTransaction, notify, logLabel]
  );

  // ActionBar-ready descriptor for "transaction"-shaped forms — hide/show
  // only, gated on isDocumentLogEnabled (rights AND Add/Edit mode active).
  // `null` when the caller shouldn't render it at all.
  const documentsButtonEntry = isDocumentLogEnabled
    ? {
        key: "documents",
        label: "Documents",
        Icon: FileText,
        variant: "secondary",
        onClick: handleOpenDocuments,
        title: FORM_SHORTCUT_TITLES.documents,
      }
    : null;

  return {
    dmConfigAllows,
    docBtnVisible,
    isDocumentLogEnabled,
    docModalRef,
    docModalOpen,
    setDocModalOpen,
    handleOpenDocuments,
    docGuid,
    fetchDocGuid,
    resetDocGuid,
    documentsButtonEntry,
    finalizeSave,
  };
}
