"use client";

import Link from "next/link";
import type { PaymentItem, UpcomingEvent } from "@/hooks/useData";

/* ─── Types ─────────────────────────────────────────────────────── */

interface DeadlineEntry {
  id: string;
  title: string;
  subtitle: string;
  date: Date;
  daysLeft: number;
  type: "payment" | "event";
  href: string;
  urgency: "overdue" | "urgent" | "soon" | "upcoming";
}

interface DeadlineWidgetProps {
  payments: PaymentItem[];
  events: UpcomingEvent[];
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function getUrgency(daysLeft: number): DeadlineEntry["urgency"] {
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 2) return "urgent";
  if (daysLeft <= 7) return "soon";
  return "upcoming";
}

const urgencyStyles: Record<DeadlineEntry["urgency"], { bg: string; text: string; badge: string; dot: string }> = {
  overdue: { bg: "bg-coral-light", text: "text-coral", badge: "bg-coral text-snow", dot: "bg-coral" },
  urgent: { bg: "bg-sunny-light", text: "text-navy", badge: "bg-sunny text-navy", dot: "bg-sunny" },
  soon: { bg: "bg-lavender-light", text: "text-lavender", badge: "bg-lavender text-snow", dot: "bg-lavender" },
  upcoming: { bg: "bg-ghost", text: "text-slate", badge: "bg-cloud text-navy", dot: "bg-cloud" },
};

function formatCountdown(daysLeft: number): string {
  if (daysLeft < -1) return `${Math.abs(daysLeft)}d overdue`;
  if (daysLeft === -1) return "1d overdue";
  if (daysLeft === 0) return "Today";
  if (daysLeft === 1) return "Tomorrow";
  if (daysLeft <= 7) return `${daysLeft}d left`;
  if (daysLeft <= 30) {
    const weeks = Math.floor(daysLeft / 7);
    return `${weeks}w ${daysLeft % 7}d`;
  }
  return `${daysLeft}d`;
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function DeadlineWidget({ payments, events }: DeadlineWidgetProps) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const entries: DeadlineEntry[] = [];

  // Payment deadlines (unpaid only)
  for (const p of payments) {
    if (p.hasPaid) continue;
    const date = new Date(p.deadline);
    const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft > 60) continue; // Skip far-future deadlines
    entries.push({
      id: `pay-${p._id || p.id}`,
      title: p.title,
      subtitle: `₦${p.amount.toLocaleString()}`,
      date,
      daysLeft,
      type: "payment",
      href: "/dashboard/payments",
      urgency: getUrgency(daysLeft),
    });
  }

  // Event deadlines
  for (const evt of events) {
    const date = new Date(evt.date);
    const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0 || daysLeft > 30) continue;
    entries.push({
      id: `evt-${evt._id || evt.id}`,
      title: evt.title,
      subtitle: evt.location || evt.category || "Event",
      date,
      daysLeft,
      type: "event",
      href: "/dashboard/events",
      urgency: getUrgency(daysLeft),
    });
  }

  // Sort by urgency priority, then by days left
  entries.sort((a, b) => {
    const urgencyOrder = { overdue: 0, urgent: 1, soon: 2, upcoming: 3 };
    const diff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    return diff !== 0 ? diff : a.daysLeft - b.daysLeft;
  });

  if (entries.length === 0) return null;

  const shown = entries.slice(0, 5);

  return (
    <div className="bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2.5 h-6 rounded-full bg-sunny" />
        <h3 className="font-display font-black text-lg text-navy">Deadlines</h3>
        {entries.some((e) => e.urgency === "overdue" || e.urgency === "urgent") && (
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-coral text-snow text-[10px] font-bold">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
            Attention
          </span>
        )}
      </div>

      {/* Entries */}
      <div className="space-y-2">
        {shown.map((entry) => {
          const s = urgencyStyles[entry.urgency];
          return (
            <Link
              key={entry.id}
              href={entry.href}
              className={`flex items-center gap-3 p-3 rounded-2xl ${s.bg} hover:opacity-80 transition-opacity`}
            >
              {/* Dot + type icon */}
              <div className={`w-8 h-8 rounded-xl ${s.badge} flex items-center justify-center shrink-0`}>
                {entry.type === "payment" ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" />
                    <path fillRule="evenodd" d="M22.5 9.75H1.5v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-15 3a.75.75 0 0 0-.75.75v1.5c0 .414.336.75.75.75h3a.75.75 0 0 0 .75-.75v-1.5a.75.75 0 0 0-.75-.75h-3Z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-navy truncate">{entry.title}</p>
                <p className="text-[10px] text-slate truncate">{entry.subtitle}</p>
              </div>

              {/* Countdown badge */}
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${s.badge}`}>
                {formatCountdown(entry.daysLeft)}
              </span>
            </Link>
          );
        })}
      </div>

      {entries.length > 5 && (
        <p className="text-center text-[10px] text-slate font-medium mt-3">
          +{entries.length - 5} more deadlines
        </p>
      )}
    </div>
  );
}
