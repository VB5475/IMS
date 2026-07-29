// Presentational filter bar for OrderItemModal's `filterBar` slot — pairs
// with useItemPickerGroupFilter (src/hooks/). Extracted 2026-07-29 from 15
// independently copy-pasted instances (5 Purchase modules + 10 Assets
// modules) — see project_assets_item_picker_maingroup_rollout memory.
import { Filter as FilterIcon } from "lucide-react";
import SearchSelect from "../ui/SearchSelect";

export default function ItemPickerGroupFilterBar({
  mainGroupOptions = [],
  subMainGroupOptions = [],
  mainGroupValue,
  subMainGroupValue,
  onMainGroupChange,
  onSubMainGroupChange,
  onFilter,
  filterLoading = false,
}) {
  return (
    <div className="oim-filter-bar">
      <label className="oim-filter-bar__field">
        <span>Item Main Group</span>
        <SearchSelect
          value={mainGroupValue}
          onChange={onMainGroupChange}
          options={mainGroupOptions}
          placeholder="All main groups"
          ariaLabel="Item Main Group"
        />
      </label>
      <label className="oim-filter-bar__field">
        <span>Item Sub Main Group</span>
        <SearchSelect
          value={subMainGroupValue}
          onChange={onSubMainGroupChange}
          options={subMainGroupOptions}
          placeholder="All sub main groups"
          ariaLabel="Item Sub Main Group"
          disabled={!mainGroupValue}
        />
      </label>
      <button
        type="button"
        className="oim-filter-bar__btn"
        onClick={onFilter}
        disabled={filterLoading}
        title="Load items for the selected filters"
      >
        <FilterIcon size={13} strokeWidth={2.5} />
        {filterLoading ? "Filtering…" : "Filter"}
      </button>
    </div>
  );
}
