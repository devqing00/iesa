"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { getTimeGreeting } from "@/lib/greeting";
import {
  useStudentDashboard,
  type Announcement,
  type UpcomingEvent,
  type PaymentItem,
  type ClassSession,
} from "@/hooks/useData";
import { StudentDashboardSkeleton } from "@/components/ui/Skeleton";
import dynamic from "next/dynamic";
const OnboardingModal = dynamic(
  () => import("@/components/ui/OnboardingModal").then((m) => m.OnboardingModal),
  { ssr: false }
);
import { getQuoteOfTheDay } from "@/lib/quotes";
import { getApiUrl } from "@/lib/api";
import { isExternalStudent } from "@/lib/studentAccess";
import DeadlineWidget from "@/components/dashboard/DeadlineWidget";

/* ─── Page Component ────────────────────────────────────────────── */

export default function StudentDashboardPage() {
  const { user, userProfile, getAccessToken, refreshProfile } = useAuth();
  const enabled = !!user;

  const { data, isLoading: loading } = useStudentDashboard(enabled);
  const external = isExternalStudent(userProfile?.department);

  // ── All hooks must be called unconditionally before any early return
  //    (React Rules of Hooks). Derived values use optional chaining so
  //    they are safe to compute even when data is undefined.
  const announcements: Announcement[] = useMemo(
    () => data?.announcements ?? [],
    [data],
  );

  const events: UpcomingEvent[] = useMemo(
    () => data?.events ?? [],
    [data],
  );

  const payments: PaymentItem[] = useMemo(
    () => data?.payments ?? [],
    [data],
  );

  const classes: ClassSession[] = useMemo(
    () => data?.todayClasses ?? [],
    [data],
  );

  // ── Onboarding localStorage keys scoped to the logged-in user so that
  //    other users / dev testing on the same browser never prevent the
  //    modal from appearing for a freshly-registered account.
  const uidKey = user?.id ?? "anon";
  const modalSeenKey = `iesa_onboarding_seen_${uidKey}`;
  const bannerDismissedKey = `iesa_onboarding_dismissed_${uidKey}`;
  const externalWelcomeKey = `iesa_external_welcome_dismissed_${uidKey}`;

  // Banner dismissed: start as false, read from localStorage after we have uid
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(false);

  // External welcome banner: separate from onboarding, only for external students
  const [externalWelcomeDismissed, setExternalWelcomeDismissed] = useState<boolean>(true);

  // Modal: start as false, then enable once we confirm it hasn't been seen
  // for THIS user. Starting as false avoids a brief flash if the user already
  // dismissed it in a previous session.
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(false);

  // Sync both flags from user-keyed localStorage once uid is known.
  useEffect(() => {
    if (!user?.id) return;
    try {
      if (localStorage.getItem(bannerDismissedKey) === "1") {
        setOnboardingDismissed(true);
      }
      if (localStorage.getItem(modalSeenKey) !== "1") {
        setShowOnboardingModal(true);
      }
      // External welcome: show until explicitly dismissed
      if (localStorage.getItem(externalWelcomeKey) !== "1") {
        setExternalWelcomeDismissed(false);
      }
    } catch { /* localStorage unavailable */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Full-page shimmer skeleton while initial data loads (after all hooks)
  if (loading && !data) return <StudentDashboardSkeleton />;

  const greeting = getTimeGreeting;
  const quoteOfTheDay = getQuoteOfTheDay();

  const getContextTagline = () => {
    if (loading) return "";
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6;

    if (isWeekend) {
      if (pendingPayments.length > 0)
        return `Weekend mode — but ${pendingPayments.length} pending due${pendingPayments.length > 1 ? "s" : ""} still needs attention.`;
      return "Weekend — a good time to get ahead or recharge.";
    }

    if (pendingPayments.length > 0 && todayClasses.length > 0)
      return `${todayClasses.length} class${todayClasses.length > 1 ? "es" : ""} on today's schedule · ${pendingPayments.length} pending due${pendingPayments.length > 1 ? "s" : ""}.`;

    if (pendingPayments.length > 0)
      return `You have ${pendingPayments.length} pending due${pendingPayments.length > 1 ? "s" : ""} — clear ${pendingPayments.length > 1 ? "them" : "it"} today.`;

    if (todayClasses.length > 0)
      return `${todayClasses.length === 1 ? "One class" : `${todayClasses.length} classes`} on today's schedule. Stay sharp.`;

    if (events.length > 0) {
      const next = events[0];
      const daysUntil = Math.ceil(
        (new Date(next.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil === 0) return `Event today: ${next.title}.`;
      if (daysUntil === 1) return `Event tomorrow: ${next.title}.`;
      if (daysUntil <= 7) return `Coming up in ${daysUntil} days: ${next.title}.`;
    }

    return "You're all clear — make today count!";
  };

  const pendingPayments = payments.filter((p) => !p.hasPaid);

  const getTodayClasses = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = days[new Date().getDay()];
    return classes
      .filter((c) => c.day === today)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const todayClasses = getTodayClasses();

  /* ── Event color cycling ── */
  const eventColors = [
    { bg: "bg-coral", text: "text-snow", dateBg: "bg-snow", dateText: "text-coral" },
    { bg: "bg-lavender-light", text: "text-navy", dateBg: "bg-lavender", dateText: "text-snow" },
    { bg: "bg-teal-light", text: "text-navy", dateBg: "bg-teal", dateText: "text-snow" },
    { bg: "bg-sunny-light", text: "text-navy", dateBg: "bg-sunny", dateText: "text-navy" },
  ];

  /* ── Class card color cycling ── */
  const classColors = [
    { bg: "bg-lavender", border: "border-navy", text: "text-snow", sub: "text-snow/70", timeBg: "bg-snow/20", timeTxt: "text-snow", tagBg: "bg-snow/20", tagTxt: "text-snow" },
    { bg: "bg-snow", border: "border-navy", text: "text-navy", sub: "text-slate", timeBg: "bg-cloud", timeTxt: "text-navy", tagBg: "bg-cloud", tagTxt: "text-slate" },
    { bg: "bg-teal-light", border: "border-navy", text: "text-navy", sub: "text-navy/60", timeBg: "bg-teal/20", timeTxt: "text-navy", tagBg: "bg-teal/20", tagTxt: "text-navy/70" },
    { bg: "bg-snow", border: "border-navy", text: "text-navy", sub: "text-slate", timeBg: "bg-cloud", timeTxt: "text-navy", tagBg: "bg-cloud", tagTxt: "text-slate" },
    { bg: "bg-coral-light", border: "border-navy", text: "text-navy", sub: "text-navy/60", timeBg: "bg-coral/20", timeTxt: "text-navy", tagBg: "bg-coral/20", tagTxt: "text-navy/70" },
    { bg: "bg-snow", border: "border-navy", text: "text-navy", sub: "text-slate", timeBg: "bg-cloud", timeTxt: "text-navy", tagBg: "bg-cloud", tagTxt: "text-slate" },
  ];

  /* ── Onboarding completeness ── */
  const profileMissing: string[] = [];
  if (userProfile) {
    if (!userProfile.level && !userProfile.currentLevel) profileMissing.push("level");
    if (!userProfile.matricNumber) profileMissing.push("matric number");
    if (!userProfile.phone) profileMissing.push("phone number");
    if (!userProfile.emailVerified) profileMissing.push("email verification");
  }
  // Hide banner if backend says onboarding is complete OR if user has dismissed it
  const showOnboarding =
    !onboardingDismissed &&
    !userProfile?.hasCompletedOnboarding &&
    profileMissing.length > 0;

  // Show modal when onboarding is incomplete and hasn't been seen/skipped
  const shouldShowModal =
    !userProfile?.hasCompletedOnboarding &&
    showOnboardingModal &&
    !!userProfile;

  const dismissOnboarding = () => {
    setOnboardingDismissed(true);
    try { localStorage.setItem(bannerDismissedKey, "1"); } catch { /* ignore */ }
  };

  const dismissExternalWelcome = () => {
    setExternalWelcomeDismissed(true);
    try { localStorage.setItem(externalWelcomeKey, "1"); } catch { /* ignore */ }
  };

  const handleOnboardingSkip = () => {
    setShowOnboardingModal(false);
    try { localStorage.setItem(modalSeenKey, "1"); } catch { /* ignore */ }
  };

  const handleOnboardingComplete = async () => {
    setShowOnboardingModal(false);
    try { localStorage.setItem(modalSeenKey, "1"); } catch { /* ignore */ }

    // Mark onboarding complete on the backend so the banner / profile badge update too.
    // Only attempt if we have the minimum required fields; if anything is missing the
    // user will still be prompted on the profile page (which gives richer error messages).
    const admissionYear = userProfile?.admissionYear;
    const matricNumber  = userProfile?.matricNumber || "";
    const phone         = userProfile?.phone        || "";

    if (!admissionYear || !matricNumber || !phone) {
      // Profile is incomplete — skip the backend call. The profile page will guide
      // the user through completing their details when they visit it.
      return;
    }

    try {
      const token = await getAccessToken();

      // Recalculate level from admissionYear + active session (prevents stale/wrong level).
      // Fall back to stored level, then to a safe default so the validator never receives "".
      const activeSession     = data?.activeSession;
      const currentSecondYear = activeSession ? parseInt(activeSession.split("/")[1]) : null;
      const storedLevel       = (userProfile?.currentLevel || userProfile?.level || "").toString();
      const level             = currentSecondYear
        ? `${Math.max(100, Math.min(500, (currentSecondYear - admissionYear) * 100 + 100))}L`
        : storedLevel || "100L";

      const res = await fetch(getApiUrl("/api/v1/students/complete-registration"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName:    userProfile?.firstName || "",
          lastName:     userProfile?.lastName  || "",
          matricNumber,
          phone,
          level,
          admissionYear,
        }),
      });

      // 409 = already completed (e.g. double-call) — treat as success.
      // Any other non-ok status means the update failed; skip refreshProfile so
      // hasCompletedOnboarding stays consistent with the actual DB state.
      if (res.ok || res.status === 409) {
        await refreshProfile();
      }
    } catch {
      // Network error — localStorage still prevents the modal re-appearing locally,
      // but hasCompletedOnboarding stays false until the user completes via profile page.
    }
  };

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Dashboard" />

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">

        {/* ═══ ONBOARDING MODAL ═══ */}
        {shouldShowModal && (
          <OnboardingModal
            onComplete={handleOnboardingComplete}
            onSkip={handleOnboardingSkip}
          />
        )}

        {/* ═══ ONBOARDING BANNER ═══ */}
        {showOnboarding && (
          <div className="mb-5 bg-sunny border-[4px] border-navy rounded-3xl p-5 md:p-6 shadow-[6px_6px_0_0_#000] relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-coral/15 pointer-events-none" />
            <svg className="absolute top-3 right-16 w-5 h-5 text-navy/10 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <button
              onClick={dismissOnboarding}
              aria-label="Dismiss onboarding banner"
              className="absolute md:hidden top-4 right-4 w-7 h-7 rounded-lg bg-navy/10 hover:bg-navy/20 flex items-center justify-center transition-colors z-10"
            >
              <svg className="w-3.5 h-3.5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-snow border-[3px] border-navy rounded-2xl flex items-center justify-center shrink-0 shadow-[3px_3px_0_0_#000]">
                <svg className="w-6 h-6 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-black text-lg text-navy leading-tight">Complete your profile</h3>
                <p className="text-sm text-navy/70 mt-1">
                  Add your {profileMissing.slice(0, 3).join(", ")}{profileMissing.length > 3 ? ` and ${profileMissing.length - 3} more` : ""} to get the full IESA experience.
                </p>
              </div>
              <Link
                href="/dashboard/profile"
                className="bg-navy border-[3px] border-navy px-5 py-2.5 rounded-xl font-display font-bold text-sm text-lime press-3 press-black shrink-0"
              >
                Go to Profile
              </Link>
              <button
              onClick={dismissOnboarding}
              aria-label="Dismiss onboarding banner"
              className="hidden md:flex w-7 h-7 rounded-lg bg-navy/10 hover:bg-navy/20 items-center justify-center transition-colors z-10"
            >
              <svg className="w-3.5 h-3.5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            </div>
          </div>
        )}

        {/* ═══ EXTERNAL STUDENT WELCOME BANNER ═══ */}
        {external && !externalWelcomeDismissed && (
          <div className="mb-5 bg-lavender-light border-[4px] border-navy rounded-3xl p-5 md:p-6 shadow-[6px_6px_0_0_#000] relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-lavender/15 pointer-events-none" />
            <svg className="absolute top-3 right-16 w-5 h-5 text-lavender/20 pointer-events-none" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <button
              onClick={dismissExternalWelcome}
              aria-label="Dismiss welcome banner"
              className="absolute md:hidden top-4 right-4 w-7 h-7 rounded-lg bg-navy/10 hover:bg-navy/20 flex items-center justify-center transition-colors z-10"
            >
              <svg className="w-3.5 h-3.5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-lavender border-[3px] border-navy rounded-2xl flex items-center justify-center shrink-0 shadow-[3px_3px_0_0_#000]">
                <svg className="w-6 h-6 text-snow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-black text-lg text-navy leading-tight">Welcome to IESA!</h3>
                <p className="text-sm text-navy/70 mt-1">
                  As a visiting student you have access to <span className="font-bold text-navy">Announcements</span>, <span className="font-bold text-navy">IEPOD</span>, <span className="font-bold text-navy">Growth Tools</span>, and your <span className="font-bold text-navy">Profile</span>. Start with IEPOD to get oriented!
                </p>
              </div>
              <Link
                href="/dashboard/iepod"
                className="bg-navy border-[3px] border-navy px-5 py-2.5 rounded-xl font-display font-bold text-sm text-lime press-3 press-black shrink-0"
              >
                Go to IEPOD
              </Link>
              <button
                onClick={dismissExternalWelcome}
                aria-label="Dismiss welcome banner"
                className="hidden md:flex w-7 h-7 rounded-lg bg-navy/10 hover:bg-navy/20 items-center justify-center transition-colors z-10"
              >
                <svg className="w-3.5 h-3.5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            ROW 1 — Hero Bento: Greeting (8 cols) + Classes Today (4 cols)
            ═══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-5">

          {/* — Greeting Hero — */}
          <div className={`${external ? "lg:col-span-12" : "lg:col-span-8"} bg-navy border-[3px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[230px] flex flex-col justify-between`}>
            {/* Decorative shapes */}
            <div className="absolute top-6 right-8 w-20 h-20 rounded-full bg-coral/15 pointer-events-none" />
            <div className="absolute bottom-8 right-32 w-10 h-10 rounded-lg bg-lavender/10 rotate-12 pointer-events-none" />
            <div className="absolute top-1/2 right-16 w-6 h-6 rounded-full bg-teal/15 pointer-events-none" />
            {/* Diamond sparkle */}
            <svg className="absolute top-5 right-24 w-5 h-5 text-navy/12 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <svg className="absolute bottom-12 right-12 w-4 h-4 text-coral/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>

            <div className="relative z-10">
              <p className="text-ghost/35 text-[10px] font-bold tracking-[0.2em] uppercase mb-3">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <h1 className="font-display font-black text-4xl md:text-5xl lg:text-[3.5rem] text-ghost leading-[0.95]">
                {greeting()},
                <br />
                <span className="text-snow">{userProfile?.firstName || user?.email?.split("@")[0]}</span>
              </h1>
              {!loading && (
                <p className="text-ghost/55 text-sm font-medium mt-3 leading-snug">
                  {getContextTagline()}
                </p>
              )}
            </div>
            <div className="relative z-10 flex flex-wrap items-center gap-2 mt-6">
              {userProfile?.level && (
                <span className="text-[10px] font-bold text-navy bg-lime rounded-full px-3 py-1 uppercase tracking-wider">
                  {userProfile.level} Level
                </span>
              )}
              {external ? (
                <span className="text-[10px] font-bold text-navy bg-lavender rounded-full px-3 py-1 uppercase tracking-wider">
                  {userProfile?.department ?? "External"}
                </span>
              ) : (
                <>
                  <span className="text-[10px] font-bold text-navy bg-teal rounded-full px-3 py-1 uppercase tracking-wider">
                    {todayClasses.length} class{todayClasses.length !== 1 ? "es" : ""} today
                  </span>
                  {pendingPayments.length > 0 && (
                    <span className="text-[10px] font-bold text-navy bg-coral rounded-full px-3 py-1 uppercase tracking-wider">
                      {pendingPayments.length} pending due{pendingPayments.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* — Classes Today Counter — only for IPE students */}
          {!external && (
          <div className="lg:col-span-4 bg-coral border-[3px] border-navy rounded-[2rem] p-8 relative overflow-hidden flex flex-col justify-between min-h-[230px] shadow-[3px_3px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
            {/* Decorative shapes */}
            <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-navy/10 pointer-events-none" />
            <svg className="absolute top-4 right-5 w-5 h-5 text-navy/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>

            <div className="relative z-10">
              <p className="text-snow/70 text-[10px] font-bold tracking-[0.15em] uppercase mb-1">Classes Today</p>
              <p className="font-display font-black text-8xl md:text-[6.5rem] text-snow leading-none">
                {loading ? "--" : String(todayClasses.length).padStart(2, "0")}
              </p>
            </div>
            <Link href="/dashboard/timetable" className="relative z-10 inline-flex items-center gap-2 text-snow/80 text-xs font-bold hover:text-snow transition-colors group mt-4">
              View full timetable
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
          )}
        </div>

        {/* ═══ IEPOD PROMO BANNER (IPE students only) ═══ */}
        {!external && (
          <Link
            href="/dashboard/iepod"
            className="block bg-coral border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000] mb-5 relative overflow-hidden group hover:shadow-[6px_6px_0_0_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-snow/20 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6 text-snow" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-black text-base text-snow">IEPOD — Orientation Hub</h3>
                <p className="text-snow/60 text-xs font-medium truncate">Complete quizzes, join a team, and get oriented with Industrial Engineering</p>
              </div>
              <svg className="w-5 h-5 text-snow/40 shrink-0 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </div>
            <svg className="absolute top-3 right-8 w-4 h-4 text-snow/10 pointer-events-none" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
          </Link>
        )}

        {/* ═══ EXTERNAL STUDENT QUICK ACCESS ═══ */}
        {external && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Link href="/dashboard/announcements" className="bg-sunny-light border-[3px] border-navy rounded-2xl p-4 press-3 press-black group">
              <div className="w-9 h-9 rounded-xl bg-sunny/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-sunny" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.25 9a6.75 6.75 0 0113.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 01-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 11-7.48 0 24.585 24.585 0 01-4.831-1.244.75.75 0 01-.298-1.205A8.217 8.217 0 005.25 9.75V9zm4.502 8.9a2.25 2.25 0 004.496 0 25.057 25.057 0 01-4.496 0z" />
                </svg>
              </div>
              <p className="font-display font-black text-sm text-navy">Announcements</p>
              <p className="text-[10px] text-slate mt-0.5">Stay updated</p>
            </Link>

            <Link href="/dashboard/iepod" className="bg-lavender-light border-[3px] border-navy rounded-2xl p-4 press-3 press-black group">
              <div className="w-9 h-9 rounded-xl bg-lavender/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM15.75 9.75a3 3 0 116 0 3 3 0 01-6 0zM2.25 9.75a3 3 0 116 0 3 3 0 01-6 0zM6.31 15.117A6.745 6.745 0 0112 12a6.745 6.745 0 016.709 7.498.75.75 0 01-.372.568A12.696 12.696 0 0112 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 01-.372-.568 6.787 6.787 0 011.019-4.38z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="font-display font-black text-sm text-navy">IEPOD</p>
              <p className="text-[10px] text-slate mt-0.5">Orientation</p>
            </Link>

            <Link href="/dashboard/growth" className="bg-teal-light border-[3px] border-navy rounded-2xl p-4 press-3 press-black group">
              <div className="w-9 h-9 rounded-xl bg-teal/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-teal" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M15.22 6.268a.75.75 0 01.968-.432l5.942 2.28a.75.75 0 01.431.97l-2.28 5.941a.75.75 0 11-1.4-.537l1.63-4.251-1.086.483a11.2 11.2 0 00-5.45 5.174.75.75 0 01-1.199.19L9 12.31l-6.22 6.22a.75.75 0 11-1.06-1.06l6.75-6.75a.75.75 0 011.06 0l3.606 3.605a12.694 12.694 0 015.68-4.973l1.086-.484-4.251-1.631a.75.75 0 01-.432-.97z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="font-display font-black text-sm text-navy">Growth Hub</p>
              <p className="text-[10px] text-slate mt-0.5">Build habits</p>
            </Link>

            <Link href="/dashboard/profile" className="bg-coral-light border-[3px] border-navy rounded-2xl p-4 press-3 press-black group">
              <div className="w-9 h-9 rounded-xl bg-coral/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-coral" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="font-display font-black text-sm text-navy">Profile</p>
              <p className="text-[10px] text-slate mt-0.5">Your details</p>
            </Link>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            ROW 4 — Main Content Bento: Schedule (8) + Sidebar (4)
            ═══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-5">

          {/* ── LEFT: Schedule + Announcements stacked (8 cols) ── */}
          <div className={external ? "lg:col-span-12 flex flex-col gap-4" : "lg:col-span-8 flex flex-col gap-4"}>

            {/* Today's Schedule Card — IPE students only */}
            {!external && (
            <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-8 rounded-full bg-teal" />
                  <h3 className="font-display font-black text-xl text-navy">Today&apos;s Schedule</h3>
                </div>
                <Link href="/dashboard/timetable" className="text-xs font-bold text-slate hover:text-navy transition-colors flex items-center gap-1">
                  Full timetable
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
              {loading
                ? <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-cloud rounded-2xl animate-pulse" />)}</div>
                : todayClasses.length === 0
                ? <div className="text-center py-12 bg-teal-light rounded-2xl border-[3px] border-navy/10">
                    <div className="w-14 h-14 rounded-2xl bg-teal/20 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-teal" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-navy">No classes scheduled today</p>
                    <p className="text-xs text-slate mt-1">Enjoy your free time!</p>
                  </div>
                : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {todayClasses.slice(0, 6).map((cls, i) => {
                      const c = classColors[i % classColors.length];
                      return (
                        <div
                          key={cls._id || i}
                          className={`flex items-center gap-4 p-4 rounded-2xl border-[3px] ${c.border} ${c.bg} transition-all press-3 press-black`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-display font-black text-sm ${c.timeBg} ${c.timeTxt}`}>
                            {cls.startTime}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${c.text}`}>{cls.courseCode}</p>
                            <p className={`text-[10px] truncate ${c.sub}`}>
                              {cls.venue} &middot; {cls.startTime}–{cls.endTime}
                            </p>
                          </div>
                          <span className={`text-[10px] font-bold rounded-full px-2.5 py-1 shrink-0 ${c.tagBg} ${c.tagTxt}`}>
                            {cls.classType}
                          </span>
                        </div>
                      );
                    })}
                  </div>
              }
            </div>
            )}

            {/* Announcements Card */}
            <div className="flex-1 bg-sunny-light border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[-0.3deg] hover:rotate-0 transition-transform">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-8 rounded-full bg-sunny" />
                  <h3 className="font-display font-black text-xl text-navy">Announcements</h3>
                </div>
                <Link href="/dashboard/announcements" className="text-xs font-bold text-navy/50 hover:text-navy transition-colors flex items-center gap-1">
                  View all
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-sunny/20 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-10 bg-snow rounded-2xl border-[3px] border-navy/10">
                  <p className="text-sm text-slate">No announcements yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {announcements.slice(0, 5).map((ann, idx) => (
                    <Link
                      key={ann.id || ann._id}
                      href="/dashboard/announcements"
                      className="flex items-center gap-4 p-4 rounded-2xl bg-snow hover:bg-ghost transition-colors group border-[2px] border-transparent hover:border-navy/10"
                    >
                      <span className="font-display font-black text-lg text-navy/20 w-8 text-center shrink-0">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-navy group-hover:text-navy transition-colors truncate">
                          {ann.title}
                        </p>
                        <p className="text-[10px] text-slate mt-0.5">
                          {new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} &middot; {ann.category}
                        </p>
                      </div>
                      {ann.priority === "urgent" && (
                        <span className="text-[10px] font-bold text-snow bg-coral rounded-full px-2.5 py-0.5 shrink-0">URGENT</span>
                      )}
                      <svg className="w-4 h-4 text-slate group-hover:text-navy transition-colors shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* CTA Cards — side by side on lg+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* First CTA: IESA AI (IPE) or IEPOD (External) */}
              {external ? (
                <Link href="/dashboard/iepod" className="block bg-navy border-[3px] border-navy rounded-3xl p-6 relative overflow-hidden group">
                  <svg className="absolute top-4 right-5 w-5 h-5 text-lime/20 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
                  </svg>
                  <div className="w-10 h-10 rounded-xl bg-lime/20 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-lime" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
                      <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
                    </svg>
                  </div>
                  <h3 className="font-display font-black text-lg text-ghost mb-1">IEPOD</h3>
                  <p className="text-ghost/40 text-xs font-medium mb-3">Orientation programme — quizzes, teams &amp; more</p>
                  <span className="inline-flex items-center gap-1.5 text-lime text-xs font-bold group-hover:gap-2.5 transition-all">
                    Go to IEPOD
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                    </svg>
                  </span>
                </Link>
              ) : (
              /* IESA AI CTA */
              <Link href="/dashboard/iesa-ai" className="block bg-navy border-[3px] border-navy rounded-3xl p-6 relative overflow-hidden group">
                <svg className="absolute top-4 right-5 w-5 h-5 text-lavender/20 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
                </svg>
                <div className="w-10 h-10 rounded-xl bg-lavender/20 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5Z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="font-display font-black text-lg text-ghost mb-1">IESA AI</h3>
                <p className="text-ghost/40 text-xs font-medium mb-3">Ask anything about the department</p>
                <span className="inline-flex items-center gap-1.5 text-lavender text-xs font-bold group-hover:gap-2.5 transition-all">
                  Start chatting
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </span>
              </Link>
              )}

              {/* Growth CTA */}
              <Link href="/dashboard/growth" className="block bg-teal border-[3px] border-navy rounded-3xl p-6 relative overflow-hidden group shadow-[4px_4px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
                <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-navy/10 pointer-events-none" />
                <svg className="absolute top-3 right-4 w-4 h-4 text-navy/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
                </svg>
                <h3 className="font-display font-black text-xl text-navy mb-1 relative z-10">Growth Tools</h3>
                <p className="text-navy/60 text-xs font-medium relative z-10 mb-3">CGPA, planner, goals &amp; more</p>
                <span className="inline-flex items-center gap-1.5 text-navy text-xs font-bold relative z-10 group-hover:gap-2.5 transition-all bg-snow/30 rounded-full px-3 py-1.5">
                  Explore
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </span>
              </Link>
            </div>
          </div>

          {/* ── RIGHT: Stacked sidebar cards (4 cols) — IPE students only ── */}
          {!external && (
          <div className="lg:col-span-4 space-y-4">

            {/* Smart Deadline Widget */}
            {!loading && <DeadlineWidget payments={payments} events={events} />}

            {/* Pending Dues Card */}
            <div className="bg-coral-light border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-6 rounded-full bg-coral" />
                  <h3 className="font-display font-black text-lg text-navy">Pending Dues</h3>
                </div>
                <Link href="/dashboard/payments" className="text-[10px] font-bold text-navy/50 hover:text-navy transition-colors uppercase tracking-wider">
                  Pay
                  <svg className="w-3 h-3 inline ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 bg-snow/50 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : pendingPayments.length === 0 ? (
                <div className="bg-teal-light rounded-2xl p-5 text-center border-[3px] border-navy/10">
                  <svg className="w-8 h-8 text-teal mx-auto mb-2" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm font-bold text-teal">All clear!</p>
                  <p className="text-xs text-slate mt-1">No pending dues</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingPayments.slice(0, 3).map((p) => (
                    <div key={p._id || p.id} className="bg-snow rounded-2xl p-4 border-[3px] border-navy">
                      <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em] mb-2">{p.title}</p>
                      <div className="flex items-end justify-between">
                        <p className="font-display font-black text-2xl text-navy">&#8358;{p.amount.toLocaleString()}</p>
                        <span className="text-[10px] font-medium text-coral">
                          Due {new Date(p.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                  ))}
                  {pendingPayments.length > 3 && (
                    <Link href="/dashboard/payments" className="block text-center text-xs font-bold text-coral hover:underline py-2">
                      +{pendingPayments.length - 3} more dues
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Upcoming Events Card */}
            <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-6 rounded-full bg-lavender" />
                  <h3 className="font-display font-black text-lg text-navy">Upcoming</h3>
                </div>
                <Link href="/dashboard/events" className="text-[10px] font-bold text-slate hover:text-navy transition-colors uppercase tracking-wider">
                  All
                  <svg className="w-3 h-3 inline ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-14 bg-cloud rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <p className="text-sm text-slate text-center py-6">No upcoming events</p>
              ) : (
                <div className="space-y-2">
                  {events.slice(0, 4).map((evt, i) => {
                    const ec = eventColors[i % eventColors.length];
                    return (
                      <div key={evt.id || evt._id} className={`flex items-center gap-3 p-3 rounded-2xl ${ec.bg} transition-colors`}>
                        <div className={`w-11 h-11 rounded-xl ${ec.dateBg} flex flex-col items-center justify-center shrink-0`}>
                          <span className={`text-[9px] font-bold leading-none ${ec.dateText}`}>
                            {new Date(evt.date).toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
                          </span>
                          <span className={`text-base font-bold leading-none ${ec.dateText}`}>
                            {new Date(evt.date).getDate()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${ec.text}`}>{evt.title}</p>
                          {evt.location && (
                            <p className={`text-[10px] truncate ${ec.text} opacity-60`}>{evt.location}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Study Groups Card */}
            <Link
              href="/dashboard/growth/study-groups"
              className="block bg-lavender border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] group hover:shadow-[6px_6px_0_0_#000] hover:-translate-x-px hover:-translate-y-px transition-all"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-snow/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-snow" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-2.659a30.76 30.76 0 0 1-1.087-.082C2.905 18.027 1.5 16.308 1.5 14.39V6.385c0-1.918 1.405-3.637 3.413-3.727h0Z" />
                    <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display font-black text-base text-snow">Study Groups</h3>
                  <p className="text-snow/50 text-[10px] font-medium">Chat, schedule sessions &amp; share resources</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-snow/70 text-xs font-bold group-hover:text-snow group-hover:gap-2.5 transition-all">
                Open groups
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </span>
            </Link>

          </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            QUOTE OF THE DAY
            ═══════════════════════════════════════════════════════════ */}
        <div className="mt-5 bg-ghost border-[3px] border-navy/10 rounded-3xl px-6 py-5 md:px-8 md:py-6 relative overflow-hidden">
          <svg className="absolute top-3 left-4 w-4 h-4 text-lavender/20 pointer-events-none" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
          </svg>
          <svg className="absolute bottom-4 right-6 w-3 h-3 text-coral/15 pointer-events-none" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
          </svg>
          <div className="flex items-start gap-3 md:gap-4">
            <div className="shrink-0 w-8 h-8 rounded-xl bg-lavender/15 flex items-center justify-center mt-0.5">
              <svg className="w-4 h-4 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.69 11 13.2 11 15c0 1.866-1.567 3.5-3.5 3.5-.924 0-1.88-.378-2.917-1.179zM14.583 17.321C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C19.591 11.69 21 13.2 21 15c0 1.866-1.567 3.5-3.5 3.5-.924 0-1.88-.378-2.917-1.179z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm md:text-base text-navy font-medium leading-relaxed italic">&ldquo;{quoteOfTheDay.text}&rdquo;</p>
              <p className="text-xs text-slate mt-2 font-medium">&mdash; {quoteOfTheDay.author}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
