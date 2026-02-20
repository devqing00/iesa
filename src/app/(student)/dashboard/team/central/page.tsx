"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";

/* ─── Types ─── */
interface Executive {
  position: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    matricNumber?: string;
    profilePhotoURL?: string;
  };
  assignedAt: string;
}

/* ─── Helpers ─── */
const POSITION_LABELS: Record<string, string> = {
  president: "President",
  vice_president: "Vice President",
  general_secretary: "General Secretary",
  assistant_general_secretary: "Asst. General Secretary",
  financial_secretary: "Financial Secretary",
  treasurer: "Treasurer",
  director_of_socials: "Director of Socials",
  director_of_sports: "Director of Sports",
  director_of_welfare: "Director of Welfare",
  pro: "Public Relations Officer",
};
const getPositionLabel = (pos: string) =>
  POSITION_LABELS[pos] || pos.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const ACCENT_CYCLE = [
  { border: "border-l-coral", bg: "bg-coral-light", dot: "bg-coral", iconBg: "bg-coral/30" },
  { border: "border-l-teal", bg: "bg-teal-light", dot: "bg-teal", iconBg: "bg-teal/30" },
  { border: "border-l-lavender", bg: "bg-lavender-light", dot: "bg-lavender", iconBg: "bg-lavender/30" },
  { border: "border-l-sunny", bg: "bg-sunny-light", dot: "bg-sunny", iconBg: "bg-sunny/30" },
  { border: "border-l-lime", bg: "bg-lime-light", dot: "bg-lime", iconBg: "bg-lime/30" },
];

/* ─── Component ─── */
export default function CentralExcosPage() {
  const { getAccessToken } = useAuth();
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExecutives = async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(getApiUrl("/api/v1/roles/executives"), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setExecutives(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to fetch executives:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchExecutives();
  }, [getAccessToken]);

  const president = executives.find((e) => e.position === "president");
  const others = executives.filter((e) => e.position !== "president");

  return (
    <div className="space-y-6">
      {/* ── section header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-coral-light text-navy font-display font-bold text-[10px] uppercase tracking-[0.08em] mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-coral" />
            Leadership
          </div>
          <h2 className="font-display font-black text-2xl md:text-3xl text-navy">Central Executives</h2>
          <p className="text-sm text-navy/60 font-medium mt-1">The leadership team guiding our department</p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cloud border-[3px] border-navy font-display font-bold text-xs text-navy">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
          </svg>
          {executives.length} Members
        </div>
      </div>

      {/* ── loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── empty state ── */}
      {!loading && executives.length === 0 && (
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-12 text-center shadow-[6px_6px_0_0_#000]">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-coral-light flex items-center justify-center">
            <svg className="w-7 h-7 text-coral" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z" />
            </svg>
          </div>
          <p className="text-navy/60 text-sm font-medium">No executive positions assigned yet</p>
          <p className="text-slate text-xs mt-1">Check back once the admin has assigned roles for the current session.</p>
        </div>
      )}

      {!loading && president && (
        /* ── president hero card ── */
        <div className="bg-navy border-[4px] border-lime rounded-[2rem] p-6 md:p-8 shadow-[8px_8px_0_0_#000] rotate-[-0.3deg] hover:rotate-0 transition-transform relative overflow-hidden">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-lime flex items-center justify-center flex-shrink-0 border-[3px] border-lime-dark">
              <span className="font-display font-black text-2xl md:text-3xl text-navy">
                {president.user.firstName[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-lime/20 font-display font-bold text-[10px] text-lime uppercase tracking-[0.08em] mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-lime" />
                President
              </span>
              <h3 className="font-display font-black text-xl md:text-2xl text-lime">
                {president.user.firstName} {president.user.lastName}
              </h3>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <a href={`mailto:${president.user.email}`} className="inline-flex items-center gap-1.5 text-lime/60 hover:text-lime transition-colors text-sm font-medium">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" /><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" /></svg>
                  {president.user.email}
                </a>
                {president.user.matricNumber && (
                  <span className="text-lime/50 text-sm font-medium">{president.user.matricNumber}</span>
                )}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-lime/8" />
          <div className="absolute top-3 right-4 text-lime/15">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
          </div>
        </div>
      )}

      {/* ── other excos grid ── */}
      {!loading && others.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {others.map((exco, i) => {
            const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
            const rotations = ["rotate-[0.4deg]", "rotate-[-0.3deg]", "rotate-[0.5deg]", "rotate-[-0.4deg]"];
            return (
              <div
                key={exco.user.id}
                className={`bg-snow border-[4px] border-navy border-l-[6px] ${accent.border} rounded-[1.5rem] p-5 shadow-[6px_6px_0_0_#000] ${rotations[i % rotations.length]} hover:rotate-0 transition-transform`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${accent.iconBg} flex items-center justify-center flex-shrink-0 border-[3px] border-navy`}>
                    <span className="font-display font-black text-lg text-navy">{exco.user.firstName[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-black text-base text-navy">
                      {exco.user.firstName} {exco.user.lastName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${accent.bg} font-display font-bold text-[10px] text-navy uppercase tracking-[0.08em]`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                        {getPositionLabel(exco.position)}
                      </span>
                      {exco.user.matricNumber && (
                        <span className="font-display font-bold text-[10px] text-slate uppercase tracking-[0.08em]">{exco.user.matricNumber}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t-[3px] border-navy/15">
                  <a href={`mailto:${exco.user.email}`} className="inline-flex items-center gap-1.5 text-navy/50 hover:text-navy transition-colors text-sm font-medium">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" /><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" /></svg>
                    <span className="truncate">{exco.user.email}</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

