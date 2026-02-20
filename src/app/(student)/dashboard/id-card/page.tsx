"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

/* ─── types ─── */
interface StudentData {
  full_name: string;
  matric_number: string;
  level: string;
  session: string;
  department: string;
  payment_status: string;
  profilePicture?: string;
}

/* ─── helpers ─── */
const getAccessToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
};

/* ─── page ─── */
export default function IDCardPage() {
  const { user } = useAuth();

  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [cardFlipped, setCardFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isPaid = studentData?.payment_status === "paid";
  const validityYear = new Date().getFullYear() + 1;

  /* ─── fetch ─── */
  const fetchStudentData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      setLoading(true);
      const r = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/users/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.ok) {
        const d = await r.json();
        const fallbackName = user ? `${user.firstName} ${user.lastName}` : "Student";
        setStudentData({
          full_name: d.full_name || fallbackName,
          matric_number: d.matric_number || "N/A",
          level: d.level || "N/A",
          session: d.session || "N/A",
          department: d.department || "Industrial & Production Engineering",
          payment_status: d.payment_status || "unpaid",
          profilePicture: d.profilePicture,
        });
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [user?.firstName, user?.lastName]);

  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]);

  /* ─── download ─── */
  const handleDownload = async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      setDownloading(true);
      const r = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/student-document`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.ok) {
        const blob = await r.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `IESA_ID_${studentData?.matric_number || "card"}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch {
      /* silent */
    } finally {
      setDownloading(false);
    }
  };

  /* ─── skeleton ─── */
  if (loading) {
    return (
      <div className="min-h-screen bg-ghost p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* hero skeleton */}
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-7 h-44 bg-cloud rounded-[2rem] animate-pulse" />
            <div className="col-span-12 md:col-span-5 grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-cloud rounded-[1.5rem] animate-pulse" />
              ))}
            </div>
          </div>
          {/* card skeleton */}
          <div className="flex justify-center">
            <div className="w-[380px] h-[240px] bg-cloud rounded-[2rem] animate-pulse" />
          </div>
          {/* features skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-cloud rounded-[1.5rem] animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ghost p-4 sm:p-6 lg:p-8 overflow-x-hidden relative">
      {/* ── diamond sparkles ── */}
      {[
        "top-12 left-[8%] w-5 h-5 text-teal/15",
        "top-28 right-[12%] w-4 h-4 text-coral/12",
        "top-[40%] left-[5%] w-6 h-6 text-lavender/14",
        "top-[55%] right-[8%] w-5 h-5 text-sunny/16",
        "bottom-28 left-[15%] w-4 h-4 text-lime/12",
        "bottom-16 right-[18%] w-5 h-5 text-teal/10",
      ].map((cls, i) => (
        <svg key={i} className={`fixed ${cls} pointer-events-none z-0`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
        </svg>
      ))}

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* ── back link ── */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-display font-bold text-navy hover:text-teal transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Back to Dashboard
        </Link>

        {/* ════════════════════════════════════════
            BENTO HERO — teal theme
        ════════════════════════════════════════ */}
        <div className="grid grid-cols-12 gap-4">
          {/* left: title card */}
          <div className="col-span-12 md:col-span-7 bg-teal border-[6px] border-navy rounded-[2rem] p-8 shadow-[10px_10px_0_0_#000] rotate-[-0.4deg] hover:rotate-0 transition-transform relative overflow-hidden">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/70 mb-2">
              Student Identification
            </div>
            <h1 className="font-display font-black text-3xl sm:text-4xl text-navy leading-tight">
              Your Digital{" "}
              <span className="brush-highlight brush-coral">ID Card</span>
            </h1>
            <p className="text-sm text-navy/80 mt-3 max-w-md font-medium leading-relaxed">
              Official IESA digital identification — verify your membership, download your
              card, and access exclusive student features.
            </p>
            {/* decorative circle */}
            <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-navy/8" />
          </div>

          {/* right: 2×2 stats grid */}
          <div className="col-span-12 md:col-span-5 grid grid-cols-2 gap-3">
            {/* status */}
            <div className="bg-teal-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
              <div className="w-8 h-8 rounded-xl bg-teal/30 flex items-center justify-center mb-2">
                <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Status</div>
              <div className="font-display font-black text-lg text-navy">Active</div>
            </div>

            {/* verified */}
            <div className="bg-lavender-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[-0.6deg] hover:rotate-0 transition-transform">
              <div className="w-8 h-8 rounded-xl bg-lavender/30 flex items-center justify-center mb-2">
                <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Verified</div>
              <div className="font-display font-black text-lg text-navy">Yes</div>
            </div>

            {/* payment */}
            <div className="bg-coral-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[0.7deg] hover:rotate-0 transition-transform">
              <div className="w-8 h-8 rounded-xl bg-coral/30 flex items-center justify-center mb-2">
                <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.5 4A1.5 1.5 0 001 5.5V6h18v-.5A1.5 1.5 0 0017.5 4h-15zM19 8.5H1v6A1.5 1.5 0 002.5 16h15a1.5 1.5 0 001.5-1.5v-6zM3 13.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm4.75-.75a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" />
                </svg>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Payment</div>
              <div className={`font-display font-black text-lg ${isPaid ? "text-teal" : "text-coral"}`}>
                {isPaid ? "Paid" : "Unpaid"}
              </div>
            </div>

            {/* format */}
            <div className="bg-sunny-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
              <div className="w-8 h-8 rounded-xl bg-sunny/30 flex items-center justify-center mb-2">
                <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm4.75 6.75a.75.75 0 00-1.5 0v2.546l-.943-1.048a.75.75 0 10-1.114 1.004l2.25 2.5a.75.75 0 001.114 0l2.25-2.5a.75.75 0 00-1.114-1.004l-.943 1.048V8.75z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Format</div>
              <div className="font-display font-black text-lg text-navy">PDF</div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════
            ID CARD PREVIEW — 3D flip
        ════════════════════════════════════════ */}
        <div className="flex flex-col items-center gap-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">
            Click card to flip
          </div>

          <div
            ref={cardRef}
            className="cursor-pointer"
            style={{ perspective: "1000px" }}
            onClick={() => setCardFlipped(!cardFlipped)}
          >
            <div
              className="relative w-[370px] sm:w-[420px] transition-transform duration-700"
              style={{
                transformStyle: "preserve-3d",
                transform: cardFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* ── FRONT ── */}
              <div
                className="bg-snow border-[5px] border-navy rounded-[1.5rem] shadow-[10px_10px_0_0_#000] overflow-hidden"
                style={{ backfaceVisibility: "hidden" }}
              >
                {/* header bar */}
                <div className="bg-navy px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-display font-black text-lg text-lime tracking-wide">IESA</div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-lime/60">
                      Industrial Engineering Students&apos; Association
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-lime/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-lime" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                    </svg>
                  </div>
                </div>

                {/* body */}
                <div className="px-5 py-4 flex gap-4">
                  {/* QR code placeholder */}
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 bg-ghost border-[3px] border-navy rounded-xl flex items-center justify-center">
                      <svg className="w-12 h-12 text-navy/30" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
                        <path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM13 13a1 1 0 011-1h3a1 1 0 110 2h-1v2a1 1 0 11-2 0v-2h-1a1 1 0 01-1-1z" />
                      </svg>
                    </div>
                  </div>

                  {/* info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* photo + name */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl border-[3px] border-navy bg-teal-light flex-shrink-0 overflow-hidden">
                        {studentData?.profilePicture ? (
                          <img
                            src={studentData.profilePicture}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-navy/40" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-black text-sm text-navy truncate">
                          {studentData?.full_name || "Student Name"}
                        </div>
                        <div className="text-[10px] font-bold text-slate tracking-wide">
                          {studentData?.matric_number}
                        </div>
                      </div>
                    </div>

                    {/* details row */}
                    <div className="flex gap-3 text-[10px] font-bold text-navy/70">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                        {studentData?.level} Level
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-lavender" />
                        {studentData?.session}
                      </span>
                    </div>
                  </div>
                </div>

                {/* footer */}
                <div className={`px-5 py-2 flex items-center justify-between ${isPaid ? "bg-teal-light" : "bg-coral-light"}`}>
                  <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-navy/60">
                    Valid until {validityYear}
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg ${isPaid ? "bg-teal/20 text-teal" : "bg-coral/20 text-coral"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? "bg-teal" : "bg-coral"}`} />
                    <span className="text-[9px] font-bold uppercase tracking-[0.08em]">
                      {isPaid ? "Dues Paid" : "Dues Unpaid"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── BACK ── */}
              <div
                className="absolute inset-0 bg-navy border-[5px] border-teal rounded-[1.5rem] shadow-[10px_10px_0_0_#000] overflow-hidden"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                {/* magnetic stripe */}
                <div className="h-10 bg-navy-light mt-4" />

                <div className="px-5 py-4 space-y-4">
                  {/* department */}
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-lime/50 mb-1">
                      Department
                    </div>
                    <div className="font-display font-bold text-sm text-lime">
                      {studentData?.department}
                    </div>
                  </div>

                  {/* card ID */}
                  <div className="bg-navy-light/50 rounded-xl px-4 py-3">
                    <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-lime/40 mb-1">
                      Card ID
                    </div>
                    <div className="font-mono text-xs text-lime/70 tracking-widest">
                      IESA-{studentData?.matric_number?.replace(/\//g, "-") || "XXXX"}-
                      {new Date().getFullYear()}
                    </div>
                  </div>

                  {/* University */}
                  <div className="text-center pt-2">
                    <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-lime/40">
                      University of Ibadan
                    </div>
                    <div className="text-[8px] text-lime/30 mt-0.5">
                      Faculty of Technology
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════
            ACTION BUTTONS
        ════════════════════════════════════════ */}
        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-lime border-[4px] border-navy shadow-[5px_5px_0_0_#0F0F2D] px-8 py-3.5 rounded-2xl font-display font-black text-base text-navy hover:shadow-[8px_8px_0_0_#0F0F2D] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {downloading ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Downloading…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                  <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                </svg>
                Download PDF
              </>
            )}
          </button>

          <button
            onClick={fetchStudentData}
            className="bg-navy border-[4px] border-teal shadow-[5px_5px_0_0_#000] px-6 py-3.5 rounded-2xl font-display font-black text-base text-teal hover:scale-105 transition-all inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.451a.75.75 0 000-1.5H4.5a.75.75 0 00-.75.75v3.75a.75.75 0 001.5 0v-2.033a7.002 7.002 0 0011.943-3.05.75.75 0 00-1.449-.388.75.75 0 01-.432.316zM4.688 8.576a5.5 5.5 0 019.201-2.466l.312.311H11.75a.75.75 0 000 1.5h3.75a.75.75 0 00.75-.75V3.422a.75.75 0 00-1.5 0v2.033A7.002 7.002 0 002.807 8.506a.75.75 0 001.449.388.75.75 0 01.432-.318z" clipRule="evenodd" />
            </svg>
            Refresh
          </button>
        </div>

        {/* ════════════════════════════════════════
            FEATURES BENTO GRID
        ════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* QR Verification */}
          <div className="bg-teal-light border-[4px] border-navy rounded-[1.5rem] p-5 shadow-[6px_6px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
            <div className="w-10 h-10 rounded-xl bg-teal/25 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-navy" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
                <path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM13 13a1 1 0 011-1h3a1 1 0 110 2h-1v2a1 1 0 11-2 0v-2h-1a1 1 0 01-1-1z" />
              </svg>
            </div>
            <div className="font-display font-black text-sm text-navy mb-1">QR Verification</div>
            <div className="text-[11px] text-navy/60 font-medium leading-relaxed">
              Scan to instantly verify membership status
            </div>
          </div>

          {/* Payment Status */}
          <div className="bg-coral-light border-[4px] border-navy rounded-[1.5rem] p-5 shadow-[6px_6px_0_0_#000] rotate-[0.6deg] hover:rotate-0 transition-transform">
            <div className="w-10 h-10 rounded-xl bg-coral/25 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-navy" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.5 4A1.5 1.5 0 001 5.5V6h18v-.5A1.5 1.5 0 0017.5 4h-15zM19 8.5H1v6A1.5 1.5 0 002.5 16h15a1.5 1.5 0 001.5-1.5v-6zM3 13.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm4.75-.75a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" />
              </svg>
            </div>
            <div className="font-display font-black text-sm text-navy mb-1">Payment Status</div>
            <div className="text-[11px] text-navy/60 font-medium leading-relaxed">
              Live dues payment status on your card
            </div>
          </div>

          {/* PDF Download */}
          <div className="bg-lavender-light border-[4px] border-navy rounded-[1.5rem] p-5 shadow-[6px_6px_0_0_#000] rotate-[-0.4deg] hover:rotate-0 transition-transform">
            <div className="w-10 h-10 rounded-xl bg-lavender/25 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-navy" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
              </svg>
            </div>
            <div className="font-display font-black text-sm text-navy mb-1">PDF Download</div>
            <div className="text-[11px] text-navy/60 font-medium leading-relaxed">
              Download a print-ready copy anytime
            </div>
          </div>

          {/* Secure */}
          <div className="bg-sunny-light border-[4px] border-navy rounded-[1.5rem] p-5 shadow-[6px_6px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
            <div className="w-10 h-10 rounded-xl bg-sunny/25 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-navy" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="font-display font-black text-sm text-navy mb-1">Secure</div>
            <div className="text-[11px] text-navy/60 font-medium leading-relaxed">
              Encrypted data with tamper protection
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════
            PROFILE UPDATE NOTICE
        ════════════════════════════════════════ */}
        <div className="bg-navy border-[4px] border-teal rounded-[2rem] p-6 shadow-[8px_8px_0_0_#000] flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-lime/15 flex-shrink-0 flex items-center justify-center">
            <svg className="w-5 h-5 text-lime" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-display font-black text-sm text-lime mb-1">
              Need to update your profile?
            </div>
            <p className="text-[11px] text-lime/60 font-medium leading-relaxed">
              Changes to your name or photo will automatically reflect on your ID card.
            </p>
          </div>
          <Link
            href="/dashboard/profile"
            className="bg-transparent border-[3px] border-lime px-5 py-2.5 rounded-xl font-display font-bold text-sm text-lime hover:bg-lime hover:text-navy transition-all flex-shrink-0"
          >
            Go to Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
