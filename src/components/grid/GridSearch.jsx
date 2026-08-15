import React, { useRef } from "react";
import { Search, X } from "lucide-react";
import "./GridSearch.css";

export default function GridSearch({ query, onChange, matchCount, totalCount }) {
  const inputRef = useRef(null);

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  const isFiltered = query.trim().length > 0;
  // matchCount can be narrowed by column filters too (EntryGrid folds those
  // into the same count it passes here), not just this search box's own
  // query — comparing the two counts directly catches that case, where
  // isFiltered (query-only) would otherwise say "nothing's filtered" while
  // the grid is actually showing fewer rows than its raw total.
  const isNarrowed = matchCount !== totalCount;

  return (
    <div className="eg-search" role="search" aria-label="Search rows">
      <span className="eg-search__icon" aria-hidden="true">
        <Search size={12} strokeWidth={2} />
      </span>
      <input
        ref={inputRef}
        type="text"
        className="eg-search__input"
        placeholder="Search…"
        value={query}
        dir="auto"
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search grid rows"
      />
      {/* Raw row count — always visible (2026-08-14, /pm), not just while
          actively searching. Previously this whole badge only rendered when
          the search box itself had text, so a column-filtered-but-not-
          searched grid (and every grid at rest) showed no count at all. */}
      <span className="eg-search__count" aria-live="polite">
        {isNarrowed ? `${matchCount}/${totalCount}` : totalCount}
      </span>
      {isFiltered && (
        <button
          type="button"
          className="eg-search__clear"
          onClick={handleClear}
          aria-label="Clear search"
          title="Clear search"
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
