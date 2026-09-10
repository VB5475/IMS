// mapEmployee.js — raw ZingHR employee object → our DB row shape.
//
// Only a handful of fields get promoted to real columns (what we'd actually
// query/filter on); everything else — every one of the ~58 flat fields plus
// Attributes[]/Addresses[]/CardCodeDetails[] — is preserved verbatim in
// raw_json, so nothing is ever lost even if ZingHR adds fields we don't
// know about yet.
//
// Dates are stored as ZingHR sends them (e.g. "07 Jul 1988") rather than
// reparsed into a DB date type — the source format isn't ISO and guessing
// at a reparse risks silently corrupting values across locales.

/** Returns null if the record has no EmployeeCode — that's the unique key
 *  every upsert is keyed on, so a record without one can't be stored. */
export function mapEmployee(raw) {
  const employeeCode = raw?.EmployeeCode?.trim?.() || raw?.EmployeeCode;
  if (!employeeCode) return null;

  return {
    employee_code: employeeCode,
    employee_id: raw.EmployeeID ?? null,
    employee_name: raw.EmployeeName ?? null,
    first_name: raw.FirstName ?? null,
    last_name: raw.LastName ?? null,
    email: raw.Email || raw.PersonalEmail || null,
    mobile: raw.Mobile ?? null,
    gender: raw.Gender ?? null,
    date_of_birth: raw.DateofBirth ?? null,
    date_of_joining: raw.DateofJoining ?? null,
    date_of_leaving: raw.DateOfLeaving ?? null,
    employee_status: raw.EmployeeStatus ?? null,
    employment_status: raw.EmploymentStatus ?? null,
    reporting_manager_name: raw.ReportingManagerName ?? null,
    reporting_manager_code: raw.ReportingManagerCode ?? null,
    last_modified: raw.LastModified ?? null,
    raw_json: JSON.stringify(raw),
  };
}
