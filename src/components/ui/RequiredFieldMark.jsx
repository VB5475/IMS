/** Red asterisk for fields marked IsMandatory in GET_DETAIL_COL_DATA. */
export default function RequiredFieldMark() {
  return (
    <span className="field-required-mark" aria-hidden="true" title="Required">
      *
    </span>
  );
}
