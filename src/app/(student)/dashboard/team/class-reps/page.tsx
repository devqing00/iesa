"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";

/* ─── Types ─── */
interface ClassRep {
  id: string;
  position: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    matricNumber?: string;
  };
}

/* ─── Helpers ─── */
const ACCENT_CYCLE = [
  { border: "border-l-teal", bg: "bg-teal-light", dot: "bg-teal", iconBg: "bg-teal/30" },
  { border: "border-l-coral", bg: "bg-coral-light", dot: "bg-coral", iconBg: "bg-coral/30" },
  { border: "border-l-lavender", bg: "bg-lavender-light", dot: "bg-lavender", iconBg: "bg-lavender/30" },
  { border: "border-l-sunny", bg: "bg-sunny-light", dot: "bg-sunny", iconBg: "bg-sunny/30" },
];

const LEVEL_COLORS: Record<string, { bg: string; dot: string; active: string }> = {
  All: { bg: "bg-navy", dot: "bg-lime", active: "text-lime" },
  "100L": { bg: "bg-teal-light", dot: "bg-teal", active: "text-navy" },
  "200L": { bg: "bg-coral-light", dot: "bg-coral", active: "text-navy" },
  "300L": { bg: "bg-lavender-light", dot: "bg-lavender", active: "text-navy" },
  "400L": { bg: "bg-sunny-light", dot: "bg-sunny", active: "text-navy" },
  "500L": { bg: "bg-lime-light", dot: "bg-lime-dark", active: "text-navy" },
};

const LEVELS = ["All", "100L", "200L", "300L", "400L", "500L"];

const getLevelFromPosition = (position: string) => {
  const match = position.match(/class_rep_(\d+L)/i);
  return match ? match[1] : "Other";
};

const getPositionLabel = (position: string) => {
  const level = getLevelFromPosition(position);
  return `${level} Class Rep`;
};

/* ─── Main Component ─── */
export default function ClassRepsPage() {
  const { getAccessToken } = useAuth();
  const [classReps, setClassReps] = useState<ClassRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState("All");

  useEffect(() => {
    const fetchClassReps = async () => {
      try {
        const token = await getAccessToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        // Get active session first
        const sessionRes = await fetch(getApiUrl("/api/v1/sessions/active"), { headers });
        if (!sessionRes.ok) { setLoading(false); return; }
        const session = await sessionRes.json();
        const sessionId = session.id || session._id;

        // Get all roles for session, filter class reps
        const rolesRes = await fetch(getApiUrl(`/api/v1/roles?session_id=${sessionId}`), { headers });
        if (rolesRes.ok) {
          const roles = await rolesRes.json();
          const reps = (Array.isArray(roles) ? roles : []).filter(
            (r: ClassRep) => r.position && r.position.startsWith("class_rep_")
          );
          setClassReps(reps);
        }
      } catch (err) {
        console.error("Failed to fetch class reps:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchClassReps();
  }, [getAccessToken]);

  const filteredReps =
    selectedLevel === "All"
      ? classReps
      : classReps.filter((r) => getLevelFromPosition(r.position) === selectedLevel);

  const repsByLevel = classReps.reduce((acc, rep) => {
    const level = getLevelFromPosition(rep.position);
    if (!acc[level]) acc[level] = [];
    acc[level].push(rep);
    return acc;
  }, {} as Record<string, ClassRep[]>);

  return (
    <div className="space-y-6">
      {/* ── section header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-lavender-light text-navy font-display font-bold text-[10px] uppercase tracking-[0.08em] mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-lavender" />
            Representatives
          </div>
          <h2 className="font-display font-black text-2xl md:text-3xl text-navy">Class Representatives</h2>
          <p className="text-sm text-navy/60 font-medium mt-1">Your class reps across all levels</p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cloud border-[3px] border-navy font-display font-bold text-xs text-navy">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
          </svg>
          {filteredReps.length} {filteredReps.length === 1 ? "Rep" : "Reps"}
        </div>
      </div>

      {/* ── level filter ── */}
      <div className="bg-snow border-[4px] border-navy rounded-[1.5rem] p-2 shadow-[6px_6px_0_0_#000]">
        <div className="flex gap-2 overflow-x-auto">
          {LEVELS.map((level) => {
            const isActive = selectedLevel === level;
            const colors = LEVEL_COLORS[level];
            return (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-display font-bold text-xs uppercase tracking-[0.08em] transition-all ${
                  isActive
                    ? `${colors.bg} ${colors.active} border-[3px] border-navy shadow-[3px_3px_0_0_#0F0F2D]`
                    : "border-[3px] border-transparent text-navy/40 hover:text-navy hover:bg-cloud"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isActive ? colors.dot : "bg-navy/20"}`} />
                {level}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── empty ── */}
      {!loading && filteredReps.length === 0 && (
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-12 text-center shadow-[6px_6px_0_0_#000]">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-lavender-light flex items-center justify-center">
            <svg className="w-7 h-7 text-lavender" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122Z" />
            </svg>
          </div>
          <p className="text-navy/60 text-sm font-medium">No class reps assigned yet</p>
          <p className="text-slate text-xs mt-1">Check back once roles have been assigned for the current session.</p>
        </div>
      )}

      {/* ── reps grid ── */}
      {!loading && filteredReps.length > 0 && (
        selectedLevel === "All" ? (
          <div className="space-y-8">
            {Object.entries(repsByLevel)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([level, reps]) => {
                const lc = LEVEL_COLORS[level] || LEVEL_COLORS["100L"];
                return (
                  <div key={level}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${lc.bg} font-display font-bold text-[10px] text-navy uppercase tracking-[0.08em]`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${lc.dot}`} />
                        {level}
                      </span>
                      <span className="font-display font-bold text-xs text-slate">({reps.length} rep{reps.length !== 1 ? "s" : ""})</span>
                      <div className="flex-1 h-[3px] bg-cloud rounded-full" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {reps.map((rep, ri) => (
                        <RepCard key={rep.id} rep={rep} accent={ACCENT_CYCLE[ri % ACCENT_CYCLE.length]} index={ri} />
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredReps.map((rep, i) => (
              <RepCard key={rep.id} rep={rep} accent={ACCENT_CYCLE[i % ACCENT_CYCLE.length]} index={i} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

/* ─── Rep Card ─── */
function RepCard({ rep, accent, index }: { rep: ClassRep; accent: typeof ACCENT_CYCLE[0]; index: number }) {
  const rotations = ["rotate-[0.3deg]", "rotate-[-0.4deg]", "rotate-[0.5deg]", "rotate-[-0.3deg]"];

  return (
    <div className={`bg-snow border-[4px] border-navy border-l-[6px] ${accent.border} rounded-[1.5rem] p-5 shadow-[6px_6px_0_0_#000] ${rotations[index % 4]} hover:rotate-0 transition-transform`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl ${accent.iconBg} flex items-center justify-center flex-shrink-0 border-[3px] border-navy`}>
          <span className="font-display font-black text-lg text-navy">{rep.user.firstName[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-black text-base text-navy">
            {rep.user.firstName} {rep.user.lastName}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${accent.bg} font-display font-bold text-[10px] text-navy uppercase tracking-[0.08em]`}>
              <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
              {getPositionLabel(rep.position)}
            </span>
          </div>
          {rep.user.matricNumber && (
            <p className="text-xs text-slate mt-1">{rep.user.matricNumber}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t-[3px] border-navy/15">
        <a href={`mailto:${rep.user.email}`} className="inline-flex items-center gap-1.5 text-navy/50 hover:text-navy transition-colors text-sm font-medium">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" /><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" /></svg>
          <span className="truncate">{rep.user.email}</span>
        </a>
      </div>
    </div>
  );
}
