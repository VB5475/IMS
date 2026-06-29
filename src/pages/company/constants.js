// Company — admin module config (MRD_Template4Company.docx)

export const CO_CONFIG = {
  RB_MASTER: "rb_companymst",
  FORM_TAG:  "rb_companymst",
  TRAN_BOOK: "MCOMPANY",

  CONFIG_YEAR_ID:  2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META:    "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_companymst",

  /** Dropdown SPs — called directly (not via RB GetFilterDetail). */
  SP_COUNTRY:  "fn_tbl_countrymst_fatch",
  SP_STATE:    "fn_tbl_statemst_fatch",
  SP_CITY:     "fn_tbl_citymst_fatch",
  SP_CURRENCY: "fn_tbl_currency_fatch",

  LIST_OBJ_TYPE:    2,
  SP_LIST:          "fn_tbl_companymst_list",
  LIST_DIVISION_ID: 0,

  SAVE_ENDPOINT:       "/API/PurCompany/Post_RB_CompanyMst_Save",
  STORAGE_HEADER_META: "coHeaderMeta",
};

/**
 * Two-column form layout.
 * All field names match PG lowercase colnames returned by the RB.
 */
export const CO_FORM_LAYOUT = {
  left: {
    main: {
      rows: [
        ["code"],
        ["name"],
        ["address"],
        ["countryid", "stateid"],
        ["cityid", "zip"],
      ],
    },
    contact: {
      title: "Contact & Currency Detail",
      rows: [
        ["phone1"],
        ["phone2"],
        ["fax"],
        ["website"],
        ["bascurrencyid"],
      ],
    },
  },
  right: {
    responsible: {
      title: "Responsible",
      rows: [
        ["personname"],
        ["designation"],
        ["address1"],
        ["address2"],
        ["address3"],
        ["address4"],
        ["address5"],
        ["completeaddress"],
        ["respersoncountryid"],
        ["respersonstateid", "respersoncityid"],
        ["respersoncontno"],
      ],
    },
  },
};

/**
 * Display-label overrides — key is lowercase PG colname, value is the label to show.
 * Used by getMasterFieldLabel when the RB displayname is wrong or missing.
 */
export const CO_LABEL_OVERRIDES = {
  designation: "Designation",
};

/**
 * Cascade field clears — lowercase PG colnames.
 * When a parent changes, child fields are reset to 0/empty.
 */
export const CO_CASCADE_RESETS = {
  countryid:           ["stateid", "cityid"],
  stateid:             ["cityid"],
  respersoncountryid:  ["respersonstateid", "respersoncityid"],
  respersonstateid:    ["respersoncityid"],
};

/**
 * Cascade dropdown refresh — lowercase PG colnames.
 * When a parent changes, these child dropdown lists are re-fetched.
 */
export const CO_CASCADE_DROPDOWN_REFRESH = {
  countryid:           ["stateid"],
  stateid:             ["cityid"],
  respersoncountryid:  ["respersonstateid"],
  respersonstateid:    ["respersoncityid"],
};

/**
 * Which SP to call and which parent value to read when refreshing a child dropdown.
 * Keys and parentCol are lowercase PG colnames.
 */
export const CO_DROPDOWN_PARENT_BINDINGS = {
  stateid:           { sp: "state", parentCol: "countryid",          param: "prmCountryID" },
  cityid:            { sp: "city",  parentCol: "stateid",            param: "prmStateID"   },
  respersonstateid:  { sp: "state", parentCol: "respersoncountryid", param: "prmCountryID" },
  respersoncityid:   { sp: "city",  parentCol: "respersonstateid",   param: "prmStateID"   },
};

/** Known dropdown colnames — lowercase PG. */
export const CO_COUNTRY_COLS  = ["countryid",  "respersoncountryid"];
export const CO_STATE_COLS    = ["stateid",     "respersonstateid"];
export const CO_CITY_COLS     = ["cityid",      "respersoncityid"];
export const CO_DOCUMENTED_DROPDOWN_COLS = [
  ...CO_COUNTRY_COLS,
  ...CO_STATE_COLS,
  ...CO_CITY_COLS,
  "bascurrencyid",
  "basecurrencyid",
];

/**
 * Currency alias — the RB may spell this with or without the 'e'.
 * Keys and values are lowercase PG colnames.
 */
export const CO_LAYOUT_FIELD_ALIASES = {
  bascurrencyid:  ["bascurrencyid", "basecurrencyid"],
  basecurrencyid: ["bascurrencyid", "basecurrencyid"],
};

/**
 * Resolve a layout field name (now lowercase) against a fieldMap keyed by colname.
 * Falls back to currency aliases when needed.
 */
export function resolveCoLayoutField(fieldMap, layoutName) {
  if (!layoutName) return null;
  const lower = layoutName.toLowerCase();
  const candidates = [lower, ...(CO_LAYOUT_FIELD_ALIASES[lower] ?? [])];
  for (const name of candidates) {
    if (fieldMap[name]) return fieldMap[name];
  }
  return null;
}

/** Ordered flat field list for validation / save — keyed by lowercase colname. */
export function getCoLayoutFieldNames(fieldMap = null) {
  const names = [];
  const pushRow = (row) => {
    row.forEach((layoutName) => {
      if (fieldMap) {
        const field = resolveCoLayoutField(fieldMap, layoutName);
        if (field) names.push(field.colname);
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
