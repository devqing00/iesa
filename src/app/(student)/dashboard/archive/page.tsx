"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

/* ─── Types ──────────────────────────────────────────────── */

interface SessionItem {
  id: string;
  name: string;
  isActive: boolean;
}

interface Announcement {
  _id: string;
  title: string;
  priority: string;
  createdAt: string;
}

interface EventItem {
  _id: string;
  title: string;
  startDate: string;
  category?: string;
}

interface ArchiveData {
  announcements: Announcement[];
  events: EventItem[];
}

/* ─── Component ──────────────────────────────────────────── */

export default function ArchivePage() {
  const { showHelp, openHelp, closeHelp } = useToolHelp("archive");
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<ArchiveData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"announcements" | "events">("announcements");

  // Fetch all sessions
  useEffect(() => {
    (async () => {
      try {
        const list = await api.get<SessionItem[]>("/api/v1/sessions");
        setSessions(list);
      } catch {
        setSessions([]);
      }
    })();
  }, []);

  // Fetch data for selected session
  useEffect(() => {
    if (!selectedId) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [ann, ev] = await Promise.all([
          api.get<Announcement[]>(`/api/v1/announcements?session_id=${selectedId}&limit=100`).catch(() => []),
          api.get<EventItem[]>(`/api/v1/events?session_id=${selectedId}&limit=100`).catch(() => []),
        ]);
        if (!cancelled) setData({ announcements: ann, events: ev });
      } catch {
        if (!cancelled) setData({ announcements: [], events: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <ToolHelpModal toolId="archive" isOpen={showHelp} onClose={closeHelp} />
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-black text-display-lg text-navy">
            Session <span className="brush-highlight">Archive</span>
          </h1>
          <p className="mt-2 text-slate text-body">
            Browse announcements and events from past academic sessions.
          </p>
        </div>
        <HelpButton onClick={openHelp} />
      </div>

      {/* Session Picker */}
      <div className="mb-8">
        <label htmlFor="session-select" className="block text-sm font-bold text-navy mb-2">
          Select a Session
        </label>
        <div className="flex flex-wrap gap-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-slate">Loading sessions...</p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                className={`px-4 py-2 rounded-xl border-[3px] font-display font-bold text-sm transition-all ${
                  s.id === selectedId
                    ? "border-navy bg-lime shadow-[4px_4px_0_0_#000]"
                    : s.isActive
                    ? "border-navy/30 bg-lime-light hover:bg-lime/40"
                    : "border-navy/20 bg-ghost hover:bg-cloud"
                }`}
              >
                {s.name}
                {s.isActive && (
                  <span className="ml-2 text-[10px] font-bold text-teal uppercase">Active</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Content Area */}
      {!selectedId ? (
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-12 shadow-[8px_8px_0_0_#000] text-center">
          <svg className="w-16 h-16 mx-auto text-navy/15 mb-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z" />
            <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
          </svg>
          <p className="font-display font-bold text-navy/40 text-lg">
            Select a session above to browse its archive
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-navy border-t-transparent" />
        </div>
      ) : data ? (
        <div>
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {([
              { key: "announcements" as const, label: "Announcements", count: data.announcements.length, color: "bg-coral-light text-coral" },
              { key: "events" as const, label: "Events", count: data.events.length, color: "bg-lavender-light text-lavender" },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-2 rounded-xl border-[3px] font-display font-bold text-sm transition-all ${
                  tab === t.key
                    ? "border-navy bg-snow shadow-[3px_3px_0_0_#000]"
                    : "border-navy/15 bg-ghost hover:bg-cloud"
                }`}
              >
                {t.label}
                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.color}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
            {tab === "announcements" && (
              <ArchiveList
                items={data.announcements}
                empty="No announcements for this session"
                renderItem={(item) => (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-navy text-sm">{item.title}</p>
                      <p className="text-xs text-slate mt-0.5">
                        {new Date(item.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}
                      </p>
                    </div>
                    <span className={`text-label-sm px-2 py-0.5 rounded-lg shrink-0 ${
                      item.priority === "urgent" ? "bg-coral-light text-coral" :
                      item.priority === "high" ? "bg-sunny-light text-navy" :
                      "bg-ghost text-slate"
                    }`}>
                      {item.priority}
                    </span>
                  </div>
                )}
              />
            )}

            {tab === "events" && (
              <ArchiveList
                items={data.events}
                empty="No events for this session"
                renderItem={(item) => (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-navy text-sm">{item.title}</p>
                      <p className="text-xs text-slate mt-0.5">
                        {item.startDate
                          ? new Date(item.startDate).toLocaleDateString("en-NG", { dateStyle: "medium" })
                          : "No date"}
                      </p>
                    </div>
                    {item.category && (
                      <span className="text-label-sm px-2 py-0.5 rounded-lg bg-lavender-light text-lavender shrink-0">
                        {item.category}
                      </span>
                    )}
                  </div>
                )}
              />
            )}

          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Generic List ───────────────────────────────────────── */

function ArchiveList<T extends { _id: string }>({
  items,
  empty,
  renderItem,
}: {
  items: T[];
  empty: string;
  renderItem: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) {
    return <p className="text-slate text-sm py-8 text-center">{empty}</p>;
  }
  return (
    <div className="divide-y divide-navy/5">
      {items.map((item) => (
        <div key={item._id} className="py-3 first:pt-0 last:pb-0">
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}
