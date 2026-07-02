/**
 * Account Master form grid layout — MRD wireframe (2 / 3 column rows).
 * Resolves fields from GET_DETAIL_COL_DATA by ColName / DisplayName hints.
 */

import { isMasterCheckboxField, isMasterToggleField } from "../../utils/masterFormUtils";
import { pickApiField } from "../../utils/columnValidation";

/** Layout slot → API colname / label hints. */
export const AM_LAYOUT_SLOTS = {
  acccode: ["acccode", "accountcode", "code"],
  group_id: ["group_id", "groupid", "groupcode"],
  acname: ["acname", "accountname"],
  regname: ["regname", "regionalname", "regname"],
  accclsid: ["accclsid", "classification", "acclass"],
  saccode: ["saccode", "sacid", "sac"],
  currencyid: ["currencyid", "currency", "currid"],
  countryid: ["countryid"],
  stated: ["stated", "stateid"],
  cityid: ["cityid"],
  zip: ["zip", "zipcode", "pincode", "postal"],
  panno: ["panno", "pan"],
  gstno: ["gstno", "gstin", "gst"],
  isdaybook: ["isdaybook"],
  costcenter: ["costcenter", "ccapp", "costcenterapp", "iscostcenter"],
  tds: ["tds", "tdsapp", "istds", "tdsapply"],
  isactive: ["isactive", "active"],
  linkref: ["refaccount", "refac", "linkref", "refaccountid", "linkaccount"],
  alldivision: ["alldivision", "alldivisionflag"],
  division: ["divisionid", "division"],
};

/** MRD screen arrangement. */
export const AM_FORM_LAYOUT = {
  accountDetails: {
    title: "Account Details",
    rows2: [
      ["acccode", "group_id"],
      ["acname", "regname"],
    ],
    row3: ["accclsid", "saccode", "currencyid"],
  },
  /** MRD — location + tax + ref-account fields share one section title. */
  linkRef: {
    title: "Link With Ref. Account",
    locationRow3: ["countryid", "stated", "cityid"],
    taxRow3: ["zip", "panno", "gstno"],
  },
  flags: ["isdaybook", "costcenter", "tds", "isactive"],
};

export function buildAmFieldMap(fields) {
  const map = {};
  (fields || []).forEach((field) => {
    const colName = pickApiField(field, "ColName", "colname");
    if (colName) map[colName] = field;
  });
  return map;
}

function fieldMatchesHint(field, hint) {
  const h = hint.toLowerCase();
  const col = String(pickApiField(field, "ColName", "colname") ?? "").toLowerCase();
  const label = String(pickApiField(field, "DisplayName", "displayname") ?? "").toLowerCase();
  return col === h || col.includes(h) || label.includes(h);
}

/** Resolve one layout slot to a GET_DETAIL_COL_DATA field. */
export function resolveAmLayoutField(fieldMap, slotId) {
  const hints = AM_LAYOUT_SLOTS[slotId] ?? [slotId];
  for (const hint of hints) {
    for (const key of Object.keys(fieldMap)) {
      if (key.toLowerCase() === hint.toLowerCase()) return fieldMap[key];
    }
    for (const field of Object.values(fieldMap)) {
      if (fieldMatchesHint(field, hint)) return field;
    }
  }
  return null;
}

export function resolveAmLayoutRow(fieldMap, slotIds, used) {
  return slotIds
    .map((slotId) => {
      const field = resolveAmLayoutField(fieldMap, slotId);
      const colName = field ? pickApiField(field, "ColName", "colname") : null;
      if (!field || !colName || used.has(colName)) return null;
      used.add(colName);
      return field;
    })
    .filter(Boolean);
}

function chunkPairs(fields) {
  const rows = [];
  for (let i = 0; i < fields.length; i += 2) {
    rows.push(fields.slice(i, i + 2));
  }
  return rows;
}

function isDivisionField(field) {
  const col = String(pickApiField(field, "ColName", "colname") ?? "").toLowerCase();
  const label = String(pickApiField(field, "DisplayName", "displayname") ?? "").toLowerCase();
  return col.includes("division") || label.includes("division");
}

function isLinkRefField(field) {
  const col = String(pickApiField(field, "ColName", "colname") ?? "").toLowerCase();
  const label = String(pickApiField(field, "DisplayName", "displayname") ?? "").toLowerCase();
  if (AM_LAYOUT_SLOTS.linkref.some((hint) => fieldMatchesHint(field, hint))) return true;
  return (
    (label.includes("ref") && (label.includes("account") || label.includes(" a/c"))) ||
    col.includes("refaccount") ||
    col.includes("refac")
  );
}

function fieldColName(field) {
  return pickApiField(field, "ColName", "colname");
}

/**
 * Unmapped fields fall into remainderRows2 (2-column).
 */
export function buildAccountMasterLayout(coreFields) {
  const fieldMap = buildAmFieldMap(coreFields);
  const used = new Set();

  const accountRows2 = AM_FORM_LAYOUT.accountDetails.rows2
    .map((row) => resolveAmLayoutRow(fieldMap, row, used))
    .filter((row) => row.length > 0);

  const classificationRow3 = resolveAmLayoutRow(
    fieldMap,
    AM_FORM_LAYOUT.accountDetails.row3,
    used
  );
  const locationRow3 = resolveAmLayoutRow(
    fieldMap,
    AM_FORM_LAYOUT.linkRef.locationRow3,
    used
  );
  const taxRow3 = resolveAmLayoutRow(fieldMap, AM_FORM_LAYOUT.linkRef.taxRow3, used);
  const flagFields = resolveAmLayoutRow(fieldMap, AM_FORM_LAYOUT.flags, used);

  const linkRefFields = coreFields.filter((f) => {
    const col = fieldColName(f);
    return col && !used.has(col) && isLinkRefField(f);
  });
  linkRefFields.forEach((f) => {
    const col = fieldColName(f);
    if (col) used.add(col);
  });
  const linkRefRows2 = chunkPairs(linkRefFields);

  const allDivisionField = resolveAmLayoutField(fieldMap, "alldivision");
  if (allDivisionField) {
    const col = fieldColName(allDivisionField);
    if (col) used.add(col);
  }

  const divisionFields = coreFields.filter((f) => {
    const col = fieldColName(f);
    return col && !used.has(col) && isDivisionField(f);
  });
  divisionFields.forEach((f) => {
    const col = fieldColName(f);
    if (col) used.add(col);
  });

  let remainder = coreFields.filter((f) => {
    const col = fieldColName(f);
    return col && !used.has(col);
  });
  const extraFlags = remainder.filter(
    (f) => isMasterToggleField(f) || isMasterCheckboxField(f)
  );
  extraFlags.forEach((f) => {
    const col = fieldColName(f);
    if (col) used.add(col);
  });
  remainder = remainder.filter((f) => !extraFlags.includes(f));

  return {
    accountRows2,
    classificationRow3,
    locationRow3,
    taxRow3,
    flagFields: [...flagFields, ...extraFlags],
    linkRefRows2,
    allDivisionField,
    divisionFields,
    remainderRows2: chunkPairs(remainder),
  };
}
