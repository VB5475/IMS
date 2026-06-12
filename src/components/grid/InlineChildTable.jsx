// InlineChildTable.jsx — backward-compatible wrapper for CollapsibleGrid inline variant.
import CollapsibleGrid from "./CollapsibleGrid";

export default function InlineChildTable(props) {
  return <CollapsibleGrid variant="inline" {...props} />;
}
