// Company — admin module config (MRD_Template4Company.docx)

export const CO_CONFIG = {
  RB_MASTER: "RB_CompanyMst",
  FORM_TAG: "RB_CompanyMst",
  TRAN_BOOK: "MCOMPANY",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_MASTER_FILL: "fn_tbl_RB_CompanyMst",

  /** MRD §3 — dropdown SPs via FN_FETCH_DATA (ObjType 2). */
  SP_COUNTRY: "Fn_tbl_CountryMst_Fatch",
  SP_STATE: "Fn_tbl_StateMst_Fatch",
  SP_CITY: "Fn_tbl_CityMst_Fatch",
  SP_CURRENCY: "Fn_tbl_CURRENCY_Fatch",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "Fn_tbl_CompanyMst_List",
  LIST_DIVISION_ID: 0,

  SAVE_ENDPOINT: "/API/PurCompany/Post_RB_CompanyMst_Save",
  STORAGE_HEADER_META: "coHeaderMeta",
};

/** Main + responsible geo dropdowns (same country/state/city SPs). */
export const CO_COUNTRY_COLS = ["CountryID", "ResPersonCountryID"];
export const CO_STATE_COLS = ["StateID", "ResPersonStateID"];
export const CO_CITY_COLS = ["CityID", "ResPersonCityID"];

export const CO_DOCUMENTED_DROPDOWN_COLS = [
  ...CO_COUNTRY_COLS,
  ...CO_STATE_COLS,
  ...CO_CITY_COLS,
  "BasCurrencyID",
  "BaseCurrencyID",
];

/** Layout name → API ColName when they differ. */
export const CO_LAYOUT_FIELD_ALIASES = {
  BaseCurrencyID: ["BasCurrencyID", "BaseCurrencyID"],
  BasCurrencyID: ["BasCurrencyID", "BaseCurrencyID"],
};

export function resolveCoLayoutField(fieldMap, layoutName) {
  if (!layoutName) return null;
  const candidates = [
    layoutName,
    ...(CO_LAYOUT_FIELD_ALIASES[layoutName] ?? []),
  ];
  for (const name of candidates) {
    if (fieldMap[name]) return fieldMap[name];
  }
  return null;
}

/** Correct API metadata labels that are wrong for Company RB. */
export const CO_LABEL_OVERRIDES = {
  Designation: "Designation",
};

/**
 * MRD / screen mockup — two-column layout with inline field pairs.
 * Left: header + Contact & Currency. Right: Responsible (full height).
 */
export const CO_FORM_LAYOUT = {
  left: {
    main: {
      rows: [
        ["Code"],
        ["Name"],
        ["Address"],
        ["CountryID", "StateID"],
        ["CityID", "Zip"],
      ],
    },
    contact: {
      title: "Contact & Currency Detail",
      rows: [
        ["Phone1"],
        ["Phone2"],
        ["Fax"],
        ["WebSite"],
        ["BaseCurrencyID"],
      ],
    },
  },
  right: {
    responsible: {
      title: "Responsible",
      rows: [
        ["PersonName"],
        ["Designation"],
        ["Address1"],
        ["Address2"],
        ["Address3"],
        ["Address4"],
        ["Address5"],
        ["CompleteAddress"],
        ["ResPersonCountryID"],
        ["ResPersonStateID", "ResPersonCityID"],
        ["ResPersonContNo"],
      ],
    },
  },
};

/** Flat field list for validation / save (layout order). */
export function getCoLayoutFieldNames(fieldMap = null) {
  const names = [];
  const pushRow = (row) => {
    row.forEach((layoutName) => {
      if (fieldMap) {
        const field = resolveCoLayoutField(fieldMap, layoutName);
        if (field) names.push(field.ColName);
      } else {
        names.push(layoutName);
      }
    });
  };
  CO_FORM_LAYOUT.left.main.rows.forEach(pushRow);
  CO_FORM_LAYOUT.left.contact.rows.forEach(pushRow);
  CO_FORM_LAYOUT.right.responsible.rows.forEach(pushRow);
  return names;
}

/** MRD §2 — cascade field clears. */
export const CO_CASCADE_RESETS = {
  CountryID: ["StateID", "CityID"],
  StateID: ["CityID"],
  ResPersonCountryID: ["ResPersonStateID", "ResPersonCityID"],
  ResPersonStateID: ["ResPersonCityID"],
};

export const CO_CASCADE_DROPDOWN_REFRESH = {
  CountryID: ["StateID", "CityID"],
  StateID: ["CityID"],
  ResPersonCountryID: ["ResPersonStateID", "ResPersonCityID"],
  ResPersonStateID: ["ResPersonCityID"],
};

/** Parent form value when calling state/city SPs (main + responsible use same APIs). */
export const CO_DROPDOWN_PARENT_BINDINGS = {
  StateID: { sp: "state", parentCol: "CountryID", param: "prmCountryID" },
  CityID: { sp: "city", parentCol: "StateID", param: "prmStateID" },
  ResPersonStateID: {
    sp: "state",
    parentCol: "ResPersonCountryID",
    param: "prmCountryID",
  },
  ResPersonCityID: {
    sp: "city",
    parentCol: "ResPersonStateID",
    param: "prmStateID",
  },
};
