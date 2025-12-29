"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState } from "react";

const ANNOUNCEMENTS = [
  {
    id: 1,
    title: "General Meeting Scheduled",
    date: "2025-01-10",
    content:
      "The monthly general meeting will be held at the main auditorium on Jan 10th, 4pm. All students are expected to attend. Please come with your ID card and be punctual. Agenda includes elections and project updates.",
    author: "IESA Secretary",
    status: "unread",
  },
  {
    id: 2,
    title: "Departmental T-Shirt Collection",
    date: "2025-01-05",
    content:
      "T-shirt collection for all paid students starts Jan 5th at the IESA office. Bring your payment receipt. Sizes are limited, so come early!",
    author: "Welfare Director",
    status: "read",
  },
  {
    id: 3,
    title: "Career Fair Registration Open",
    date: "2025-01-02",
    content:
      "Register for the upcoming Career Fair via the Events page. Limited slots available! Early registration is advised.",
    author: "PRO",
    status: "unread",
  },
];

export default function AnnouncementsPage() {
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const [readStatus, setReadStatus] = useState<Record<number, boolean>>(() => {
    const obj: Record<number, boolean> = {};
    ANNOUNCEMENTS.forEach((a) => {
      obj[a.id] = a.status === "read";
    });
    return obj;
  });

  const filtered = ANNOUNCEMENTS.filter((a) =>
    filter === "all"
      ? true
      : filter === "read"
      ? readStatus[a.id]
      : !readStatus[a.id]
  );

  const markAsRead = (id: number) => {
    setReadStatus((s: Record<number, boolean>) => ({ ...s, [id]: true }));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader title="Announcements" />
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 md:space-y-8">
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full text-xs font-bold ${
              filter === "all"
                ? "bg-primary text-white"
                : "bg-foreground/5 text-foreground/60"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-4 py-2 rounded-full text-xs font-bold ${
              filter === "unread"
                ? "bg-primary text-white"
                : "bg-foreground/5 text-foreground/60"
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setFilter("read")}
            className={`px-4 py-2 rounded-full text-xs font-bold ${
              filter === "read"
                ? "bg-primary text-white"
                : "bg-foreground/5 text-foreground/60"
            }`}
          >
            Read
          </button>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold font-heading text-foreground mb-2">
          Latest Announcements
        </h2>
        <div className="space-y-4">
          {filtered.map((a) => (
            <div
              key={a.id}
              className={`bg-background/60 backdrop-blur-xl border border-foreground/10 rounded-xl p-4 md:p-6 relative ${
                !readStatus[a.id] ? "ring-2 ring-primary/30" : ""
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-primary font-bold text-xs md:text-sm bg-primary/10 px-3 py-1 rounded-full">
                  {a.date}
                </span>
                <span className="text-foreground/50 text-xs">
                  by {a.author}
                </span>
                {!readStatus[a.id] && (
                  <span className="ml-auto text-xs bg-primary text-white px-2 py-0.5 rounded-full">
                    Unread
                  </span>
                )}
              </div>
              <h3 className="font-bold text-lg text-foreground mb-1">
                {a.title}
              </h3>
              <p className="text-foreground/70 text-sm md:text-base line-clamp-2">
                {a.content.slice(0, 80)}
                {a.content.length > 80 ? "..." : ""}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    if (openId === a.id) {
                      setOpenId(null);
                    } else {
                      setOpenId(a.id);
                      markAsRead(a.id);
                    }
                  }}
                  className="text-primary font-bold text-xs hover:underline"
                >
                  {openId === a.id ? "Hide Details" : "Read Details"}
                </button>
              </div>
              {openId === a.id && (
                <div className="mt-4 bg-background/50 border border-foreground/10 rounded-md p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-bold text-xs bg-primary/10 px-3 py-1 rounded-full">
                        {a.date}
                      </span>
                      <span className="text-foreground/50 text-xs">by {a.author}</span>
                    </div>
                    <button
                      onClick={() => setOpenId(null)}
                      className="text-foreground/60 hover:text-primary text-sm font-medium"
                    >
                      Hide
                    </button>
                  </div>
                  <h4 className="font-semibold text-lg text-foreground mb-2">
                    {a.title}
                  </h4>
                  <p className="text-foreground/80 text-sm md:text-base whitespace-pre-line">
                    {a.content}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
