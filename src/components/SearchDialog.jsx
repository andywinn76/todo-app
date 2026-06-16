"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useLists } from "@/components/ListsProvider";

const DEBOUNCE_MS = 300;

function stripHtml(html) {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const KIND_LABEL = {
  todo: "Todo",
  grocery: "Grocery",
  note: "Note",
  secure_note: "Secure Note",
};

export default function SearchDialog({ open, onClose }) {
  const { setActiveListId } = useLists();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  // Reset and focus when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const doSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const pattern = `%${trimmed}%`;

    const [todosRes, notesRes, groceriesRes] = await Promise.all([
      supabase
        .from("todos")
        .select("id, title, description, list_id, lists(id, name, type)")
        .ilike("title", pattern)
        .limit(15),
      supabase
        .from("notes")
        .select("id, body, list_id, lists(id, name, type)")
        .ilike("body", pattern)
        .limit(5),
      supabase
        .from("grocery_items")
        .select("id, name, list_id, lists(id, name, type)")
        .ilike("name", pattern)
        .limit(15),
    ]);

    const hits = [];

    (todosRes.data || []).forEach((t) => {
      hits.push({
        id: `todo-${t.id}`,
        listId: t.list_id,
        listName: t.lists?.name || "Unknown list",
        listType: t.lists?.type || "todo",
        label: t.title,
        snippet: t.description || null,
        kind: "todo",
      });
    });

    (notesRes.data || []).forEach((n) => {
      const body = stripHtml(n.body || "");
      const idx = body.toLowerCase().indexOf(trimmed.toLowerCase());
      const start = Math.max(0, idx - 40);
      const end = Math.min(body.length, idx + trimmed.length + 80);
      const snippet =
        (start > 0 ? "…" : "") +
        body.slice(start, end) +
        (end < body.length ? "…" : "");
      hits.push({
        id: `note-${n.id}`,
        listId: n.list_id,
        listName: n.lists?.name || "Unknown list",
        listType: n.lists?.type || "note",
        label: n.lists?.name || "Note",
        snippet: snippet.trim(),
        kind: "note",
      });
    });

    (groceriesRes.data || []).forEach((g) => {
      hits.push({
        id: `grocery-${g.id}`,
        listId: g.list_id,
        listName: g.lists?.name || "Unknown list",
        listType: g.lists?.type || "grocery",
        label: g.name,
        snippet: null,
        kind: "grocery",
      });
    });

    setResults(hits);
    setLoading(false);
  }, []);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(() => doSearch(q), DEBOUNCE_MS);
  }

  function handleSelect(hit) {
    setActiveListId(hit.listId);
    onClose();
  }

  if (!open) return null;

  // Group results by listId
  const groups = results.reduce((acc, hit) => {
    if (!acc[hit.listId]) {
      acc[hit.listId] = {
        listName: hit.listName,
        listType: hit.listType,
        hits: [],
      };
    }
    acc[hit.listId].hits.push(hit);
    return acc;
  }, {});
  const groupEntries = Object.entries(groups);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/30 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl ring-1 ring-black/10 overflow-hidden">
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Search across all lists…"
            className="flex-1 text-base outline-none bg-transparent"
          />
          <div className="flex items-center gap-2 shrink-0">
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  inputRef.current?.focus();
                }}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd
              role="button"
              tabIndex={0}
              onClick={onClose}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClose()}
              className="hidden sm:inline-flex items-center justify-center w-9 h-9 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded font-sans cursor-pointer hover:bg-blue-100"
            >
              Esc
            </kbd>
          </div>
        </div>

        {/* Results area */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <p className="px-4 py-3 text-sm text-gray-500">Searching…</p>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-500">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {!loading && !query.trim() && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">
              Type to search todos, notes, and grocery items
            </p>
          )}

          {!loading &&
            groupEntries.map(([listId, group]) => (
              <div key={listId}>
                <div className="px-4 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 uppercase tracking-wide border-b border-gray-100">
                  {group.listName}
                  <span className="ml-2 normal-case font-normal text-gray-400">
                    {KIND_LABEL[group.listType] || group.listType}
                  </span>
                </div>
                {group.hits.map((hit) => (
                  <button
                    key={hit.id}
                    onClick={() => handleSelect(hit)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex flex-col gap-0.5 border-b border-gray-50 last:border-0"
                  >
                    <span className="text-sm font-medium text-gray-800">
                      {hit.label}
                    </span>
                    {hit.snippet && (
                      <span className="text-xs text-gray-400 line-clamp-1">
                        {hit.snippet}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t text-xs text-gray-400">
            Click a result to jump to that list
          </div>
        )}
      </div>
    </div>
  );
}
