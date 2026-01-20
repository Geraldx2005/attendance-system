import { useEffect, useRef, useState } from "react";

export default function SearchBar({
  placeholder = "Search…",
  onSearch,
  delay = 300,
}) {
  const [query, setQuery] = useState("");
  const lastValueRef = useRef("");

  useEffect(() => {
    const trimmed = query.trim();

    // skip if value hasn't actually changed
    if (trimmed === lastValueRef.current) return;

    const t = setTimeout(() => {
      lastValueRef.current = trimmed;
      onSearch(trimmed);
    }, delay);

    return () => clearTimeout(t);
  }, [query, delay, onSearch]);

  return (
    <div
      className="
        w-80 h-8
        flex items-center gap-2
        px-2
        bg-nero-700
        border border-nero-600
        rounded-md
        focus-within:border-nero-400
      "
    >
      <svg
        className="w-4 h-4 text-nero-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
        />
      </svg>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="
          flex-1
          bg-transparent
          outline-none
          text-sm
          text-nero-300
          placeholder-nero-450
        "
      />

      {query && (
        <button
          onClick={() => {
            setQuery("");
            lastValueRef.current = "";
            onSearch("");
          }}
          className="text-nero-400 hover:text-nero-300"
        >
          ✕
        </button>
      )}
    </div>
  );
}
