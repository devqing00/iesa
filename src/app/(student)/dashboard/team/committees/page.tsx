"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";

/* ─── Types ─── */
interface Committee {
  position: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    matricNumber?: string;
  };
  assignedAt?: string;
}

/* ─── Helpers ─── */
const COMMITTEE_COLORS = [
  { bg: "bg-teal-light", dot: "bg-teal", iconBg: "bg-teal/30", border: "border-l-teal", label: "Academic" },
  { bg: "bg-coral-light", dot: "bg-coral", iconBg: "bg-coral/30", border: "border-l-coral", label: "Welfare" },
  { bg: "bg-lavender-light", dot: "bg-lavender", iconBg: "bg-lavender/30", border: "border-l-lavender", label: "Sports" },
  { bg: "bg-sunny-light", dot: "bg-sunny", iconBg: "bg-sunny/30", border: "border-l-sunny", label: "Socials" },
];

const COMMITTEE_ICONS = [
  // Academic — book
  <svg key="a" className="w-5 h-5 text-navy" fill="currentColor" viewBox="0 0 20 20"><path d="M10.75 16.82A7.462 7.462 0 0115 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0018 15.06v-11a.75.75 0 00-.546-.721A9.006 9.006 0 0015 3a8.999 8.999 0 00-4.25 1.065v12.757zM9.25 4.065A8.999 8.999 0 005 3c-.85 0-1.673.118-2.454.339A.75.75 0 002 4.06v11a.75.75 0 00.954.721A7.506 7.506 0 015 15.5c1.579 0 3.042.487 4.25 1.32V4.065z" /></svg>,
  // Welfare — heart
  <svg key="w" className="w-5 h-5 text-navy" fill="currentColor" viewBox="0 0 20 20"><path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 01-.692 0l-.002-.001z" /></svg>,
  // Sports — trophy
  <svg key="s" className="w-5 h-5 text-navy" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 1c-1.716 0-3.408.106-5.07.31C3.806 1.45 3 2.414 3 3.517V16.75A2.25 2.25 0 005.25 19h9.5A2.25 2.25 0 0017 16.75V3.517c0-1.103-.806-2.068-1.93-2.207A41.403 41.403 0 0010 1zM5.99 8.75h1.06a2.5 2.5 0 015.9 0h1.06a.75.75 0 010 1.5H5.99a.75.75 0 010-1.5z" clipRule="evenodd" /></svg>,
  // Socials — sparkles
  <svg key="so" className="w-5 h-5 text-navy" fill="currentColor" viewBox="0 0 20 20"><path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.238a1 1 0 000 1.962l1.192.238a1 1 0 01.785.785l.238 1.192a1 1 0 001.962 0l.238-1.192a1 1 0 01.785-.785l1.192-.238a1 1 0 000-1.962l-1.192-.238a1 1 0 01-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.683a1 1 0 01.633.633l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684zM13.949 13.684a1 1 0 00-1.898 0l-.184.551a1 1 0 01-.632.633l-.551.183a1 1 0 000 1.898l.551.183a1 1 0 01.633.633l.183.551a1 1 0 001.898 0l.184-.551a1 1 0 01.632-.633l.551-.183a1 1 0 000-1.898l-.551-.184a1 1 0 01-.633-.632l-.183-.551z" /></svg>,
];

const getCommitteeLabel = (position: string) => {
  const map: Record<string, string> = {
    committee_academic: "Academic",
    committee_welfare: "Welfare",
    committee_sports: "Sports",
    committee_socials: "Socials",
  };
  return map[position] || position;
};

const getCommitteeIndex = (position: string) => {
  const positions = ["committee_academic", "committee_welfare", "committee_sports", "committee_socials"];
  return positions.indexOf(position);
};

/* ─── Main Component ─── */
export default function CommitteesPage() {
  const { getAccessToken } = useAuth();
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCommittees = async () => {
      try {
        const token = await getAccessToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(getApiUrl("/api/v1/roles/committees"), { headers });
        if (res.ok) {
          const data = await res.json();
          setCommittees(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to fetch committees:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCommittees();
  }, [getAccessToken]);

  return (
    <div className="space-y-6">
      {/* ── section header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-light text-navy font-display font-bold text-[10px] uppercase tracking-[0.08em] mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal" />
            Committees
          </div>
          <h2 className="font-display font-black text-2xl md:text-3xl text-navy">Committee Heads</h2>
          <p className="text-sm text-navy/60 font-medium mt-1">Leading various committees to serve student interests</p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cloud border-[3px] border-navy font-display font-bold text-xs text-navy">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M1 2.75A.75.75 0 011.75 2h16.5a.75.75 0 010 1.5H18v8.75A2.75 2.75 0 0115.25 15h-1.072l.798 3.06a.75.75 0 01-1.452.38L13.41 18H6.59l-.114.44a.75.75 0 01-1.452-.38L5.822 15H4.75A2.75 2.75 0 012 12.25V3.5h-.25A.75.75 0 011 2.75z" clipRule="evenodd" /></svg>
          {committees.length} Active
        </div>
      </div>

      {/* ── loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── empty ── */}
      {!loading && committees.length === 0 && (
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-12 text-center shadow-[4px_4px_0_0_#000]">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-teal-light flex items-center justify-center">
            <svg className="w-7 h-7 text-teal" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M1 2.75A.75.75 0 011.75 2h16.5a.75.75 0 010 1.5H18v8.75A2.75 2.75 0 0115.25 15h-1.072l.798 3.06a.75.75 0 01-1.452.38L13.41 18H6.59l-.114.44a.75.75 0 01-1.452-.38L5.822 15H4.75A2.75 2.75 0 012 12.25V3.5h-.25A.75.75 0 011 2.75z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-navy/60 text-sm font-medium">No committee heads assigned yet</p>
          <p className="text-slate text-xs mt-1">Committee positions will appear here once assigned for the current session.</p>
        </div>
      )}

      {/* ── committee cards — bento grid ── */}
      {!loading && committees.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {committees.map((committee) => {
            const i = getCommitteeIndex(committee.position);
            const color = COMMITTEE_COLORS[i] || COMMITTEE_COLORS[0];
            const icon = COMMITTEE_ICONS[i] || COMMITTEE_ICONS[0];
            const rotations = ["rotate-[-0.4deg]", "rotate-[0.5deg]", "rotate-[0.3deg]", "rotate-[-0.5deg]"];
            const label = getCommitteeLabel(committee.position);

            return (
              <div
                key={committee.user.id}
                className={`bg-snow border-[4px] border-navy border-l-[6px] ${color.border} rounded-[1.5rem] p-5 shadow-[4px_4px_0_0_#000] ${rotations[i % 4]} hover:rotate-0 transition-transform`}
              >
                {/* top row */}
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-2xl ${color.iconBg} flex items-center justify-center flex-shrink-0 border-[3px] border-navy`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${color.bg} font-display font-bold text-[10px] text-navy uppercase tracking-[0.08em] mb-1`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                      {label}
                    </span>
                    <h3 className="font-display font-black text-lg text-navy">
                      {committee.user.firstName} {committee.user.lastName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-display font-bold text-[10px] text-slate uppercase tracking-[0.08em]">
                        {label} Committee Head
                      </span>
                    </div>
                    {committee.user.matricNumber && (
                      <p className="text-xs text-slate mt-1">{committee.user.matricNumber}</p>
                    )}
                  </div>
                </div>

                {/* contact */}
                <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t-[3px] border-navy/15">
                  <a href={`mailto:${committee.user.email}`} className="inline-flex items-center gap-1.5 text-navy/50 hover:text-navy transition-colors text-sm font-medium">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" /><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" /></svg>
                    <span className="truncate">{committee.user.email}</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── info notice ── */}
      <div className="bg-navy border-[4px] border-teal rounded-[2rem] p-6 shadow-[3px_3px_0_0_#000] relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-lime/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-lime" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="font-display font-black text-sm text-lime">Want to join a committee?</h4>
            <p className="text-xs text-lime/60 mt-1">Reach out to the committee head or the IESA Central team to express your interest.</p>
          </div>
        </div>
        <div className="absolute -bottom-5 -right-5 w-20 h-20 rounded-full bg-lime/8" />
      </div>
    </div>
  );
}
