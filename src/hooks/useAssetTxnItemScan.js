import { useState, useCallback, useRef } from "react";
import { ENDPOINTS, OBJ_TYPE } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { buildGridColumns, isTruthyApiFlag } from "../utils/gridUtils";
import { validateApiColumnsByField } from "../utils/columnValidation";
import { parseQrItemPayload } from "../utils/qrScanJson";
import { gridHasScannedItem, normalizeAssetQrSearchJson } from "../utils/assetTxnItemScan";

/**
 * QR scan + serial-number search for asset transaction item pickers (AEI/ADI pattern).
 */
export function useAssetTxnItemScan({
  logTag,
  spItemPicker,
  spRbMeta,
  rbItemPickerCode,
  rbMetaParamKey = "prmrbcode",
  buildItemPickerJsonPayload,
  headerColumns,
  headerValuesRef,
  allColumns,
  itemGridRef,
  ensureItemColumns,
  addItemRow,
  setActiveTab,
  isEditMode,
  getLive,
  notify,
  setFieldErrors,
  setFormErrors,
  mapPickerToItemRow,
  itemModalColumns,
  setItemModalOpen,
  setItemModalItems,
  setItemModalColumns,
  setItemModalError,
}) {
  const [itemModalScanMode, setItemModalScanMode] = useState(false);
  const [scanQrLoading, setScanQrLoading] = useState(false);
  const [scanQrError, setScanQrError] = useState(null);
  const [lastQrItem, setLastQrItem] = useState(null);
  const [headerScanValue, setHeaderScanValue] = useState("");
  const [srSearchValue, setSrSearchValue] = useState("");

  const headerScanRef = useRef(null);
  const srSearchRef = useRef(null);
  const pendingScanSrNoRef = useRef("");

  const resetScanState = useCallback(() => {
    pendingScanSrNoRef.current = "";
    setItemModalScanMode(false);
    setScanQrLoading(false);
    setScanQrError(null);
    setLastQrItem(null);
    setHeaderScanValue("");
    setSrSearchValue("");
  }, []);

  const onSelectItemOpen = useCallback(() => {
    setItemModalScanMode(false);
  }, []);

  const fetchItemPickerColumns = useCallback(async () => {
    const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: OBJ_TYPE.FUNCTION,
      ObjName: spRbMeta,
      JSon: JSON.stringify([{ [rbMetaParamKey]: rbItemPickerCode }]),
      p_ErrCode: -1,
      p_ErrMsg: "",
    });
    const rbRow = rbRes?.[0];
    if (!rbRow) throw new Error("Could not load item picker configuration.");

    const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
      prmMasterID: rbRow.rbid,
      prmLoginID: getUserSession().loginId,
    });
    return buildGridColumns(colRes || [], {}, {
      filterable: false,
      allEditable: false,
    });
  }, [getLive, spRbMeta, rbItemPickerCode, rbMetaParamKey]);

  const recordLastScannedItem = useCallback((srNo, mappedRows, sourceRows = []) => {
    const last = sourceRows[sourceRows.length - 1] || mappedRows[mappedRows.length - 1] || {};
    const itemName = String(
      last.itemname ?? last.ItemName ?? last.itemdesc ?? last.ItemDesc
      ?? last.description ?? last.Description ?? last.itemcode ?? last.ItemCode
      ?? "Item"
    ).trim();
    const qrItem = {
      itemcode: String(last.itemcode ?? last.ItemCode ?? "").trim(),
      srno: String(srNo ?? "").trim(),
      itemname: itemName,
      rowIds: mappedRows.map((r) => r.id),
    };
    setLastQrItem(qrItem);
    return qrItem;
  }, []);

  const closeItemModal = useCallback(() => {
    setItemModalOpen(false);
    if (itemModalScanMode) {
      pendingScanSrNoRef.current = "";
      setItemModalScanMode(false);
    }
  }, [itemModalScanMode, setItemModalOpen]);

  const isScanPickerRowDisabled = useCallback((row) => {
    return gridHasScannedItem(
      itemGridRef.current?.getRows?.() ?? [],
      row.itemcode ?? row.ItemCode,
      row.assetsrno ?? row.Assetsrno ?? row.srno ?? row.SrNo
    );
  }, [itemGridRef]);

  const restoreSrSearchFocus = useCallback(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!srSearchRef.current || srSearchRef.current.disabled) return;
        srSearchRef.current.focus();
      }, 0);
    });
  }, []);

  const focusHeaderScanField = useCallback(() => {
    if (!isEditMode) return;
    setActiveTab("items");
    requestAnimationFrame(() => {
      headerScanRef.current?.focus();
      headerScanRef.current?.select?.();
    });
  }, [isEditMode, setActiveTab]);

  const restoreHeaderScanFocus = useCallback(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!headerScanRef.current || headerScanRef.current.disabled) return;
        headerScanRef.current.focus();
      }, 0);
    });
  }, []);

  const handleScanHistorySubmit = useCallback(async (rawSrNo) => {
    const srNo = String(rawSrNo ?? "").trim();
    if (!srNo) {
      const msg = "Enter Sr No.";
      setScanQrError(msg);
      notify.toastError(msg);
      return;
    }

    const headerValues = headerValuesRef.current;
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValues, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    if (Object.keys(headerErrorMap).length > 0) {
      setFormErrors(["Please fix the highlighted field(s) below."]);
      return;
    }
    setFormErrors([]);
    setScanQrError(null);
    setScanQrLoading(true);

    try {
      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) {
        notify.toastError("Item grid columns could not be loaded.");
        return;
      }

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: spItemPicker,
        JSon: JSON.stringify([{
          ...buildItemPickerJsonPayload(headerValues, {
            maGroupId: 0,
            subMaGroupId: 0,
            itemNameSearch: "",
            qrJson: "",
            otherStr: srNo,
          }),
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });

      const rows = rowRes || [];
      if (rows.length === 0) {
        const msg = "No item found for this Sr No.";
        setScanQrError(msg);
        notify.toastError(msg);
        return;
      }

      const pickerColumns = itemModalColumns.length > 0
        ? itemModalColumns
        : await fetchItemPickerColumns();

      if (rows.length === 1) {
        const mappedRow = mapPickerToItemRow(rows[0], allColumns);
        const gridRowsNow = itemGridRef.current?.getRows?.() ?? [];
        if (gridHasScannedItem(
          gridRowsNow,
          mappedRow.itemcode ?? mappedRow.ItemCode,
          mappedRow.assetsrno ?? mappedRow.Assetsrno ?? mappedRow.srno ?? mappedRow.SrNo
        )) {
          const msg = "Item is already added";
          setScanQrError(msg);
          notify.toastError(msg);
          return;
        }

        setActiveTab("items");
        addItemRow(mappedRow);
        const entry = recordLastScannedItem(srNo, [mappedRow], rows);
        setSrSearchValue("");
        setScanQrError(null);
        notify.toastSuccess(`Added: ${entry.itemname || srNo}`);
        return;
      }

      pendingScanSrNoRef.current = srNo;
      setItemModalScanMode(true);
      setItemModalColumns(pickerColumns);
      setItemModalItems(rows);
      setItemModalError(null);
      setItemModalOpen(true);
      setSrSearchValue("");
      setScanQrError(null);
    } catch (err) {
      console.error(`[${logTag}] Manual search item fetch failed:`, err);
      const msg = err?.message || "Failed to fetch item for Sr No.";
      setScanQrError(msg);
      notify.toastError(msg);
    } finally {
      setScanQrLoading(false);
      restoreSrSearchFocus();
    }
  }, [
    headerColumns,
    ensureItemColumns,
    getLive,
    spItemPicker,
    buildItemPickerJsonPayload,
    headerValuesRef,
    allColumns,
    addItemRow,
    recordLastScannedItem,
    fetchItemPickerColumns,
    itemModalColumns,
    mapPickerToItemRow,
    itemGridRef,
    notify,
    restoreSrSearchFocus,
    setFieldErrors,
    setFormErrors,
    setItemModalColumns,
    setItemModalItems,
    setItemModalError,
    setItemModalOpen,
    setActiveTab,
    logTag,
  ]);

  const handleScanQrSubmit = useCallback(async (rawText) => {
    const { qrJson, error } = normalizeAssetQrSearchJson(rawText);
    if (error) {
      notify.toastError(error);
      restoreHeaderScanFocus();
      return;
    }

    const headerValues = headerValuesRef.current;
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValues, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    if (Object.keys(headerErrorMap).length > 0) {
      setFormErrors(["Please fix the highlighted field(s) below."]);
      restoreHeaderScanFocus();
      return;
    }
    setFormErrors([]);
    setScanQrError(null);

    let scannedMeta = {};
    try { scannedMeta = JSON.parse(qrJson); } catch { /* keep empty */ }
    const existingRows = itemGridRef.current?.getRows?.() ?? [];
    if (gridHasScannedItem(existingRows, scannedMeta.itemcode, scannedMeta.srno)) {
      const msg = "Item is already added";
      notify.toastError(msg);
      setHeaderScanValue("");
      restoreHeaderScanFocus();
      return;
    }

    setScanQrLoading(true);
    try {
      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) {
        notify.toastError("Item grid columns could not be loaded.");
        return;
      }

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: spItemPicker,
        JSon: JSON.stringify([{
          ...buildItemPickerJsonPayload(headerValues, {
            maGroupId: 0,
            subMaGroupId: 0,
            itemNameSearch: "",
            qrJson,
          }),
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });

      const rows = rowRes || [];
      if (rows.length === 0) {
        const msg = "No item found for this QR JSON.";
        notify.toastError(msg);
        return;
      }

      const gridRowsNow = itemGridRef.current?.getRows?.() ?? [];
      const mappedRows = rows
        .map((item) => mapPickerToItemRow(item, allColumns))
        .filter((row) => !gridHasScannedItem(
          gridRowsNow,
          row.itemcode ?? row.ItemCode,
          row.assetsrno ?? row.Assetsrno ?? row.srno ?? row.SrNo
        ));

      if (mappedRows.length === 0) {
        const msg = "Item is already added";
        notify.toastError(msg);
        setHeaderScanValue("");
        return;
      }

      setActiveTab("items");
      mappedRows.forEach((row) => addItemRow(row));

      const last = rows[rows.length - 1] || {};
      const itemName = String(
        last.itemname ?? last.ItemName ?? last.itemdesc ?? last.ItemDesc
        ?? last.description ?? last.Description ?? last.itemcode ?? last.ItemCode
        ?? scannedMeta.itemcode ?? "Item"
      ).trim();
      recordLastScannedItem(
        scannedMeta.srno ?? last.assetsrno ?? last.Assetsrno ?? last.srno ?? last.SrNo ?? "",
        mappedRows,
        rows
      );
      setHeaderScanValue("");

      notify.toastSuccess(
        mappedRows.length === 1
          ? `Added: ${itemName}`
          : `Added ${mappedRows.length} items · ${itemName}`
      );
    } catch (err) {
      console.error(`[${logTag}] Scan QR item fetch failed:`, err);
      const msg = err?.message || "Failed to fetch item for QR JSON.";
      notify.toastError(msg);
    } finally {
      setScanQrLoading(false);
      restoreHeaderScanFocus();
    }
  }, [
    headerColumns,
    ensureItemColumns,
    getLive,
    spItemPicker,
    buildItemPickerJsonPayload,
    headerValuesRef,
    allColumns,
    addItemRow,
    notify,
    restoreHeaderScanFocus,
    recordLastScannedItem,
    mapPickerToItemRow,
    itemGridRef,
    setFieldErrors,
    setFormErrors,
    setActiveTab,
    logTag,
  ]);

  const commitSrSearch = useCallback((raw) => {
    const value = String(raw ?? "").trim();
    if (!value) return;
    setSrSearchValue("");
    handleScanHistorySubmit(value);
  }, [handleScanHistorySubmit]);

  const handleSrSearchKeyDown = useCallback((e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    if (!isEditMode || scanQrLoading) return;
    commitSrSearch(srSearchValue);
  }, [isEditMode, scanQrLoading, commitSrSearch, srSearchValue]);

  const handleSrSearchPaste = useCallback((e) => {
    if (!isEditMode || scanQrLoading) return;
    const text = e.clipboardData?.getData("text") ?? "";
    if (!String(text).trim()) return;
    e.preventDefault();
    commitSrSearch(text);
  }, [isEditMode, scanQrLoading, commitSrSearch]);

  const commitHeaderScan = useCallback((raw) => {
    const value = String(raw ?? "").trim();
    if (!value) return;
    setHeaderScanValue("");
    const parsed = parseQrItemPayload(value);
    if (parsed) {
      handleScanQrSubmit(JSON.stringify(parsed));
      return;
    }
    handleScanQrSubmit(value);
  }, [handleScanQrSubmit]);

  const handleHeaderScanKeyDown = useCallback((e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    if (!isEditMode || scanQrLoading) return;
    commitHeaderScan(headerScanValue);
  }, [isEditMode, scanQrLoading, commitHeaderScan, headerScanValue]);

  const handleHeaderScanPaste = useCallback((e) => {
    if (!isEditMode || scanQrLoading) return;
    const text = e.clipboardData?.getData("text") ?? "";
    if (!String(text).trim()) return;
    e.preventDefault();
    commitHeaderScan(text);
  }, [isEditMode, scanQrLoading, commitHeaderScan]);

  const syncLastQrItemWithGridRows = useCallback((rows) => {
    const livingIds = new Set((rows || []).map((r) => r.id));

    setLastQrItem((current) => {
      if (!current) return current;
      if (current.rowIds?.length) {
        return current.rowIds.some((id) => livingIds.has(id)) ? current : null;
      }
      const code = String(current.itemcode ?? "").trim().toLowerCase();
      const serial = String(current.srno ?? "").trim().toLowerCase();
      const stillThere = (rows || []).some((row) => {
        const rowCode = String(row.itemcode ?? row.ItemCode ?? "").trim().toLowerCase();
        const rowSrno = String(
          row.assetsrno ?? row.Assetsrno ?? row.srno ?? row.SrNo ?? ""
        ).trim().toLowerCase();
        return rowCode === code && rowSrno === serial;
      });
      return stillThere ? current : null;
    });
  }, []);

  const handleGridRowsChange = useCallback((rows) => {
    syncLastQrItemWithGridRows(rows);
  }, [syncLastQrItemWithGridRows]);

  const wrapInsertItems = useCallback(async (selectedItems, baseInsert) => {
    if (!selectedItems?.length) return;
    await baseInsert(selectedItems);

    const pendingSrNo = pendingScanSrNoRef.current;
    if (!pendingSrNo) return;

    const mappedRows = selectedItems.map((item) => mapPickerToItemRow(item, allColumns));
    const entry = recordLastScannedItem(pendingSrNo, mappedRows, selectedItems);
    pendingScanSrNoRef.current = "";
    setItemModalScanMode(false);
    notify.toastSuccess(
      mappedRows.length === 1
        ? `Added: ${entry.itemname || pendingSrNo}`
        : `Added ${mappedRows.length} items · ${entry.itemname || pendingSrNo}`
    );
  }, [allColumns, mapPickerToItemRow, recordLastScannedItem, notify]);

  return {
    itemModalScanMode,
    scanQrLoading,
    scanQrError,
    lastQrItem,
    headerScanValue,
    srSearchValue,
    headerScanRef,
    srSearchRef,
    resetScanState,
    onSelectItemOpen,
    closeItemModal,
    isScanPickerRowDisabled,
    focusHeaderScanField,
    handleGridRowsChange,
    wrapInsertItems,
    setHeaderScanValue,
    setSrSearchValue,
    setScanQrError,
    handleHeaderScanKeyDown,
    handleHeaderScanPaste,
    handleSrSearchKeyDown,
    handleSrSearchPaste,
  };
}
