"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  type: "announcement" | "event" | "resource";
  link: string;
  priority?: string;
  category?: string;
  startDate?: string;
  createdAt?: string;
}

interface SearchResponse {
  query: string;
  total: number;
  results: {
    announcements?: SearchResult[];
    events?: SearchResult[];
    resources?: SearchResult[];
  };
}

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  announcement: { label: "Announcement", color: "text-coral", bg: "bg-coral-light" },
  event: { label: "Event", color: "text-lavender", bg: "bg-lavender-light" },
  resource: { label: "Resource", color: "text-teal", bg: "bg-teal-light" },
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const data = await api.get<SearchResponse>(
        `/api/v1/search?q=${encodeURIComponent(q)}&limit=8`
      );
      const flat: SearchResult[] = [
        ...(data.results.announcements || []),
        ...(data.results.events || []),
        ...(data.results.resources || []),
      ];
      setResults(flat);
      setTotal(data.total);
    } catch {
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (link: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(link);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-ghost border-[3px] border-navy/20 rounded-xl px-2.5 lg:px-3 py-2.5 text-sm text-slate hover:border-navy/40 hover:bg-cloud transition-all"
        aria-label="Open search"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
        </svg>
        <span className="hidden lg:inline">Search...</span>
        <kbd className="hidden lg:inline-flex items-center text-[10px] font-bold text-navy/30 bg-snow border border-navy/15 rounded px-1.5 py-0.5 ml-4">
          {typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "⌘" : "Ctrl"}K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Search Dialog */}
      <div className="fixed inset-x-4 top-[10%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-xl z-200">
        <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[10px_10px_0_0_#000] overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b-[3px] border-navy/10">
            <svg className="w-5 h-5 text-slate shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              className="flex-1 bg-transparent text-navy font-medium text-base placeholder:text-slate focus:outline-none"
              placeholder="Search announcements, events, resources..."
            />
            {loading && (
              <div className="w-5 h-5 border-[2px] border-lime border-t-transparent rounded-full animate-spin" />
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-slate border border-navy/15 rounded px-2 py-0.5 hover:bg-cloud"
            >
              ESC
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {query.length < 2 ? (
              <div className="px-5 py-8 text-center text-sm text-slate">
                Type at least 2 characters to search
              </div>
            ) : results.length === 0 && !loading ? (
              <div className="px-5 py-8 text-center text-sm text-slate">
                No results found for &quot;{query}&quot;
              </div>
            ) : (
              <div className="py-2">
                {results.map((item) => {
                  const meta = TYPE_LABELS[item.type] || TYPE_LABELS.announcement;
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      onClick={() => handleSelect(item.link)}
                      className="w-full text-left px-5 py-3 hover:bg-ghost transition-colors flex items-start gap-3"
                    >
                      <span className={`text-label-sm px-2 py-0.5 rounded-lg ${meta.bg} ${meta.color} mt-0.5 shrink-0`}>
                        {meta.label}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-navy text-sm truncate">{item.title}</p>
                        {item.snippet && (
                          <p className="text-xs text-slate line-clamp-2 mt-0.5">{item.snippet}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
                {total > results.length && (
                  <p className="px-5 py-3 text-xs text-slate text-center">
                    Showing {results.length} of {total} results
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
