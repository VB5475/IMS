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
      {isFiltered && (
        <>
          <span className="eg-search__count" aria-live="polite">
            {matchCount}/{totalCount}
          </span>
          <button
            type="button"
            className="eg-search__clear"
            onClick={handleClear}
            aria-label="Clear search"
            title="Clear search"
          >
            <X size={11} strokeWidth={2.5} />
          </button>
        </>
      )}
    </div>
  );
}
