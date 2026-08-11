from pathlib import Path
import re

FILL_HANDLER = '''  const handleFillDetail = useCallback(async () => {{
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues, headerColumns);
    if (missingFields.length > 0) {{
      setFormErrors(missingFields);
      return;
    }}

    setFormErrors([]);
    setActiveTab("items");
    setIsFillingDetail(true);
    setIsGridLoading(true);

    try {{
      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) {{
        notify.error("Item grid columns could not be loaded.");
        return;
      }}

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {{
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: {config}.SP_ITEM_PICKER,
        JSon: JSON.stringify([{builder}(headerValues)]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      }});
      const items = Array.isArray(rowRes) ? rowRes : [];
      if (items.length === 0) {{
        itemGridRef.current?.clearRows?.();
        notify.info("No items found for the selected header filters.");
        return;
      }}

      itemGridRef.current?.clearRows?.();
      items.forEach((item) => addItemRow(mapPickerToItemRow(item, allColumns)));
      notify.success(`${{items.length}} item${{items.length === 1 ? "" : "s"}} loaded into the grid.`);
    }} catch (err) {{
      console.error("[{tag}] Fill Detail failed:", err);
      notify.error(err?.message || "Failed to fill detail items.");
    }} finally {{
      setIsFillingDetail(false);
      setIsGridLoading(false);
    }}
  }}, [getLive, headerColumns, ensureItemColumns, allColumns, addItemRow, notify]);

  const handleSelectListShortcut = useCallback(() => {{
    if (activeTab === "items") handleFillDetail();
  }}, [activeTab, handleFillDetail]);'''


def patch_form(path, tag, config, builder):
    p = Path(path)
    text = p.read_text(encoding="utf-8")

    text = text.replace(
        'import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";',
        'import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";',
    )
    text = text.replace(
        'import { AlertCircle, Trash2, Package, Printer, Save } from "lucide-react";',
        'import { AlertCircle, Trash2, ListPlus, Printer, Save } from "lucide-react";',
    )
    text = re.sub(
        r'const OrderItemModal = lazy\(\(\) => import\("\.\./\.\./components/txn/OrderItemModal"\)\);\n'
        r'import ItemPickerGroupFilterBar from "\.\./\.\./components/txn/ItemPickerGroupFilterBar";\n',
        "",
        text,
        count=1,
    )
    text = re.sub(
        r'import \{ useItemPickerGroupFilter \} from "\.\./\.\./hooks/useItemPickerGroupFilter";\n',
        "",
        text,
        count=1,
    )
    text = text.replace(
        "import {\n  buildGridColumns,\n  isLockOnEditModeCol,",
        "import {\n  isLockOnEditModeCol,",
    )

    old_state = f"""  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);
  const groupFilter = useItemPickerGroupFilter({{
    spMainGroup: {config}.SP_ITEM_MAIN_GROUP,
    spSubMainGroup: {config}.SP_ITEM_SUB_MAIN_GROUP,
    formTag: {config}.FORM_TAG,
  }});

  const [isEditMode, setIsEditMode] = useState(false);"""
    new_state = """  const [isFillingDetail, setIsFillingDetail] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);"""
    if old_state not in text:
        raise SystemExit(f"{tag}: state block not found")
    text = text.replace(old_state, new_state, 1)

    start = text.index("  const handleSelectItem = useCallback(async () => {")
    end = text.index("  const handleDeleteSelected = useCallback(() => {", start)
    new_handlers = FILL_HANDLER.format(config=config, builder=builder, tag=tag) + "\n\n"
    text = text[:start] + new_handlers + text[end:]

    text = text.replace(
        """    setItemSelectionCount,
    setItemModalOpen,
    setItemModalItems,
    setItemModalColumns,
    setItemModalLoading,
    setItemModalError,
    setFilterResetKey,""",
        """    setItemSelectionCount,
    setFilterResetKey,""",
    )

    text = text.replace("blocked: itemModalOpen,", "blocked: isFillingDetail,")
    text = text.replace(
        """  useEntryFormKeyboard({
    blocked: isFillingDetail,
    isEditMode,
    isSaving,
    addDisabled: filterBusy,""",
        """  useEntryFormKeyboard({
    blocked: isFillingDetail,
    isEditMode,
    isSaving: isSaving || isFillingDetail,
    addDisabled: filterBusy,""",
    )

    btn_re = re.compile(
        r'              <button\n'
        r'                ref=\{selectItemBtnRef\}\n'
        r'                type="button"\n'
        r'                className="eg-tab-btn"\n'
        r'                onClick=\{handleSelectItem\}\n'
        r'                disabled=\{!isEditMode\}\n'
        r'                title="[^"]*"\n'
        r'              >\n'
        r'                <Package size=\{12\} strokeWidth=\{2\.5\} />\n'
        r'                Select Item\n'
        r'              </button>',
    )
    new_btn = """              <button
                ref={selectItemBtnRef}
                type="button"
                className="eg-tab-btn"
                onClick={handleFillDetail}
                disabled={!isEditMode || isFillingDetail}
                title="Fill detail items from header filters (Tab here after header fields)"
              >
                <ListPlus size={12} strokeWidth={2.5} />
                {isFillingDetail ? "Filling…" : "Fill Detail"}
              </button>"""
    if not btn_re.search(text):
        raise SystemExit(f"{tag}: Select Item button not found")
    text = btn_re.sub(new_btn, text, count=1)

    text = text.replace(
        'emptyMessage="No items yet. Click Select Item above."',
        'emptyMessage="No items yet. Click Fill Detail above."',
    )
    text = text.replace(
        "loading={isGridLoading || isFetching}",
        "loading={isGridLoading || isFetching || isFillingDetail}",
    )

    modal_re = re.compile(
        r"\n      <Suspense fallback=\{null\}>\n"
        r"        <OrderItemModal[\s\S]*?"
        r"      </Suspense>\n",
    )
    if not modal_re.search(text):
        raise SystemExit(f"{tag}: OrderItemModal block not found")
    text = modal_re.sub("\n", text, count=1)

    leftovers = [
        x
        for x in [
            "OrderItemModal",
            "groupFilter",
            "itemModalOpen",
            "handleSelectItem",
            "Package",
            "buildGridColumns",
            "ItemPickerGroupFilterBar",
            "useItemPickerGroupFilter",
            "lazy",
            "Suspense",
        ]
        if x in text
    ]
    if leftovers:
        print(f"{tag} WARN leftovers:", leftovers)

    p.write_text(text, encoding="utf-8")
    print(f"{tag}: patched")


patch_form(
    r"d:/IMS/IMS/src/pages/assets-employee-return/AssetsEmployeeReturnForm.jsx",
    "AER",
    "AER_CONFIG",
    "buildAerItemPickerJsonPayload",
)
patch_form(
    r"d:/IMS/IMS/src/pages/assets-returnable-gate-pass-in/AssetsReturnableGatePassInForm.jsx",
    "ARGI",
    "ARGI_CONFIG",
    "buildArgiItemPickerJsonPayload",
)

# constants
aer = Path(r"d:/IMS/IMS/src/pages/assets-employee-return/constants.js")
aer_t = aer.read_text(encoding="utf-8")
old = """    // Magroup / submagroup filters not used in Select Item UI — SP still expects the params.
    prmmagroupid: 0,
    prmsubmagroupid: 0,
  };
}"""
new = """    // Magroup / submagroup filters removed from UI — SP still expects the params.
    prmmagroupid: 0,
    prmsubmagroupid: 0,
    prmsearchtext: "",
    prmotherstr: "",
    prmjson: "[]",
  };
}"""
if old not in aer_t:
    # try without em dash variants by locating keys
    if "prmmagroupid: 0,\n    prmsubmagroupid: 0,\n  };" in aer_t and "prmsearchtext" not in aer_t[aer_t.find("buildAerItemPickerJsonPayload"):aer_t.find("buildAerListJsonPayload")]:
        aer_t = aer_t.replace(
            "    prmmagroupid: 0,\n    prmsubmagroupid: 0,\n  };",
            '    prmmagroupid: 0,\n    prmsubmagroupid: 0,\n    prmsearchtext: "",\n    prmotherstr: "",\n    prmjson: "[]",\n  };',
            1,
        )
    else:
        raise SystemExit("AER constants pattern not found")
else:
    aer_t = aer_t.replace(old, new, 1)
aer.write_text(aer_t, encoding="utf-8")
print("AER constants updated")

argi = Path(r"d:/IMS/IMS/src/pages/assets-returnable-gate-pass-in/constants.js")
argi_t = argi.read_text(encoding="utf-8")
old_argi = """    prmconfigid: pickHeaderInt(headerValues, "configid", "ConfigID"),
    prmissuetypeid: ARGI_CONFIG.ISSUE_TYPE_ID,
  };
}"""
new_argi = """    prmconfigid: pickHeaderInt(headerValues, "configid", "ConfigID"),
    prmissuetypeid: ARGI_CONFIG.ISSUE_TYPE_ID,
    // Magroup / submagroup filters removed from UI — SP still expects the params.
    prmmagroupid: 0,
    prmsubmagroupid: 0,
    prmsearchtext: "",
    prmotherstr: "",
    prmjson: "[]",
  };
}"""
if old_argi not in argi_t:
    raise SystemExit("ARGI payload end not found")
argi.write_text(argi_t.replace(old_argi, new_argi, 1), encoding="utf-8")
print("ARGI constants updated")
print("done")
