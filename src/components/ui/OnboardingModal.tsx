"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";

/* ─── Types ─────────────────────────────────────────── */

type Step = 0 | 1 | 2 | 3;

const STEP_HEADERS: { bg: string; label: string }[] = [
  { bg: "bg-sunny", label: "Welcome" },
  { bg: "bg-teal", label: "Profile Setup" },
  { bg: "bg-lavender", label: "Your Toolkit" },
  { bg: "bg-coral", label: "All Set" },
];

/* ─── Session / Level helpers ──────────────────────── */

/* ─── Confetti ─────────────────────────────────────── */

const CONFETTI_COLORS = [
  "#C8F31D", // lime
  "#9B72CF", // lavender
  "#E8614D", // coral
  "#5BD4C0", // teal
  "#E0C340", // sunny
  "#0F0F2D", // navy
];

function ConfettiParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    interface Particle {
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      vx: number;
      vy: number;
      rot: number;
      rotSpeed: number;
      opacity: number;
    }

    const particles: Particle[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * -H,
      w: 4 + Math.random() * 6,
      h: 6 + Math.random() * 8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      vx: (Math.random() - 0.5) * 2,
      vy: 1.5 + Math.random() * 3,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
      opacity: 1,
    }));

    let raf: number;
    let frame = 0;
    const maxFrames = 180; // ~3 seconds at 60fps

    function animate() {
      frame++;
      ctx!.clearRect(0, 0, W, H);

      const fadeStart = maxFrames * 0.7;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;
        p.vy += 0.04; // gravity

        if (frame > fadeStart) {
          p.opacity = Math.max(0, 1 - (frame - fadeStart) / (maxFrames - fadeStart));
        }

        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rot * Math.PI) / 180);
        ctx!.globalAlpha = p.opacity;
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx!.restore();
      }

      if (frame < maxFrames) {
        raf = requestAnimationFrame(animate);
      }
    }

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-50"
      aria-hidden="true"
    />
  );
}

/* ─── Feature Cards for Tour ──────────────────────── */

const FEATURES = [
  {
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    title: "Dashboard",
    desc: "Announcements, timetable, and events at a glance.",
    color: "bg-lime-light",
  },
  {
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Growth Hub",
    desc: "CGPA calculator, Pomodoro, flashcards, habits, journal & more.",
    color: "bg-sunny-light",
  },
  {
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
    title: "Events",
    desc: "Register for events, pay online, and download your tickets.",
    color: "bg-coral-light",
  },
  {
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 20c0-2.76-2.24-4-5-4s-5 1.24-5 4m5-7a3 3 0 100-6 3 3 0 000 6z" /><circle cx="12" cy="12" r="10" />
      </svg>
    ),
    title: "Study Groups",
    desc: "Real-time group chat and session scheduling with classmates.",
    color: "bg-teal-light",
  },
  {
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z" /><path d="M9 21h6" />
      </svg>
    ),
    title: "IESA AI",
    desc: "Your AI-powered academic assistant for any question.",
    color: "bg-lavender-light",
  },
  {
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6.5a8.5 8.5 0 00-6-2.5C4.5 4 3 4.5 3 4.5v14s1.5-.5 3-.5a8.5 8.5 0 016 2.5m0-14.5a8.5 8.5 0 016-2.5c1.5 0 3 .5 3 .5v14s-1.5-.5-3-.5a8.5 8.5 0 00-6 2.5m0-14.5v14.5" />
      </svg>
    ),
    title: "Resource Library",
    desc: "Access shared past questions, notes, and study materials.",
    color: "bg-ghost",
  },
];

/* ─── Modal Component ──────────────────────────────── */

interface OnboardingModalProps {
  onComplete: () => void;
  onSkip?: () => void;
  mandatory?: boolean;
}

export function OnboardingModal({ onComplete, onSkip, mandatory = false }: OnboardingModalProps) {
  const { userProfile, getAccessToken, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>(0);

  // True when the user registered via email and already has all required fields —
  // Step 1 should be a read-only confirmation, not an editable save form.
  const isConfirmMode = !mandatory && !!(userProfile?.matricNumber && userProfile?.phone && userProfile?.currentLevel && userProfile?.admissionYear);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [admittedSession, setAdmittedSession] = useState("");
  const [levelConfirmed, setLevelConfirmed] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  const [department, setDepartment] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prefilled = useRef(false);

  // Session data for level calculation
  const [apiSessions, setApiSessions] = useState<string[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [currentSecondYear, setCurrentSecondYear] = useState<number | null>(null);
  const [activeSessionName, setActiveSessionName] = useState("");

  // Fetch sessions
  useEffect(() => {
    setMounted(true);
    (async () => {
      try {
        const res = await fetch(getApiUrl("/api/v1/sessions/"));
        if (res.ok) {
          const list: { isActive: boolean; name: string }[] = await res.json();
          const active = list.find((s) => s.isActive);
          if (active?.name) {
            setActiveSessionName(active.name);
            const sy = parseInt(active.name.split("/")[1]);
            if (!isNaN(sy)) setCurrentSecondYear(sy);
          }
          setApiSessions(list.map((s) => s.name));
        }
      } catch { /* API unavailable */ }
      finally { setSessionsLoading(false); }
    })();
  }, []);

  // Session dropdown options
  const sessionOptions: string[] = (() => {
    const base = currentSecondYear ?? new Date().getFullYear() + 1;
    const generated: string[] = [];
    for (let y = base; y >= base - 5; y--) generated.push(`${y - 1}/${y}`);
    for (const n of apiSessions) if (!generated.includes(n)) generated.push(n);
    return generated.sort((a, b) => b.localeCompare(a));
  })();

  // Level calculation using active session
  const calculateLevel = useCallback(
    (admSession: string): string => {
      const fallbackSecondYear = currentSecondYear ?? (new Date().getFullYear() + 1);
      const admSY = parseInt(admSession.split("/")[1]);
      if (isNaN(admSY)) return "";
      return `${Math.max(100, Math.min(500, (fallbackSecondYear - admSY) * 100 + 100))}L`;
    },
    [currentSecondYear]
  );

  const calculatedLevel = admittedSession ? calculateLevel(admittedSession) : "";
  const derivedAdmissionYear = admittedSession ? parseInt(admittedSession.split("/")[1]) : 0;

  // Pre-fill from existing profile (once)
  useEffect(() => {
    if (prefilled.current || !userProfile) return;
    prefilled.current = true;
    setFirstName(userProfile.firstName || "");
    setLastName(userProfile.lastName || "");
    if (userProfile.matricNumber) setMatricNumber(userProfile.matricNumber);
    if (userProfile.phone) setPhone(userProfile.phone);
    if (userProfile.dateOfBirth) setDateOfBirth(typeof userProfile.dateOfBirth === "string" ? userProfile.dateOfBirth.split("T")[0] : "");
    if (userProfile.admissionYear) {
      const ay = userProfile.admissionYear;
      setAdmittedSession(`${ay - 1}/${ay}`);
      setLevelConfirmed(true);
    }
    if (userProfile.department && userProfile.department !== "Industrial Engineering") {
      setIsExternal(true);
      setDepartment(userProfile.department);
    }
  }, [userProfile]);

  // Reset level confirmation when session changes
  useEffect(() => { setLevelConfirmed(false); }, [admittedSession]);

  // Block Escape key when mandatory
  useEffect(() => {
    if (!mandatory) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") e.preventDefault(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mandatory]);

  // Validate step 1 form
  const validateForm = (): boolean => {
    setFormError("");
    if (!firstName.trim()) { setFormError("First name is required"); return false; }
    if (!lastName.trim()) { setFormError("Last name is required"); return false; }
    if (!matricNumber.trim()) { setFormError("Matric number is required"); return false; }
    if (!/^\d{6}$/.test(matricNumber)) { setFormError("Matric number must be exactly 6 digits"); return false; }
    if (!phone.trim()) { setFormError("Phone number is required"); return false; }
    if (!/^(\+234|0)[789]\d{9}$/.test(phone.replace(/[\s-]/g, ""))) {
      setFormError("Invalid Nigerian phone number (e.g. +2348123456789)");
      return false;
    }
    if (!admittedSession) { setFormError("Please select the session you were admitted"); return false; }
    if (!calculatedLevel) { setFormError("Could not calculate your level \u2014 no active session found"); return false; }
    if (!levelConfirmed) { setFormError("Please confirm your calculated level"); return false; }
    if (!isExternal && !dateOfBirth) { setFormError("Date of birth is required for IPE students"); return false; }
    if (isExternal && !department.trim()) { setFormError("Please enter your department"); return false; }
    return true;
  };

  // Confirm-mode: user already has all data from email registration.
  // Just call complete-registration with existing profile values to set the hasCompletedOnboarding flag.
  const handleConfirmProfile = async () => {
    if (!userProfile) return;
    setSaving(true);
    setFormError("");
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/students/complete-registration"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          matricNumber: userProfile.matricNumber,
          phone: userProfile.phone,
          level: userProfile.currentLevel,
          admissionYear: userProfile.admissionYear,
          department: userProfile.department || "Industrial Engineering",
          dateOfBirth: userProfile.dateOfBirth ? String(userProfile.dateOfBirth).split("T")[0] : undefined,
        }),
      });
      if (res.ok || res.status === 409) {
        await refreshProfile();
        setStep(2);
      } else {
        const err = await res.json().catch(() => ({ detail: "Failed" }));
        setFormError(err.detail || "Something went wrong. Please try again.");
      }
    } catch {
      setFormError("Network error \u2014 please check your connection.");
    } finally {
      setSaving(false);
    }
  };

  // Save profile to backend
  const handleSaveProfile = async () => {
    if (!validateForm()) return;
    setSaving(true);
    setFormError("");
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/students/complete-registration"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          matricNumber: matricNumber.trim(),
          phone: phone.replace(/[\s-]/g, "").trim(),
          level: calculatedLevel,
          admissionYear: derivedAdmissionYear,
          department: isExternal && department.trim() ? department.trim() : "Industrial Engineering",
          dateOfBirth: dateOfBirth || undefined,
        }),
      });

      if (res.ok || res.status === 409) {
        await refreshProfile();
        toast.success("Profile saved!");
        setStep(2);
      } else {
        const err = await res.json().catch(() => ({ detail: "Failed to save profile" }));
        setFormError(err.detail || "Failed to save profile. Please try again.");
      }
    } catch {
      setFormError("Network error \u2014 please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  const inputClass =
    "w-full px-3.5 py-3 bg-snow border-[3px] border-navy rounded-2xl text-navy font-display font-normal text-sm placeholder:text-slate focus:outline-none focus:border-coral transition-all";

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="presentation"
    >
      {/* Backdrop — not clickable when mandatory */}
      <div
        className="absolute inset-0 bg-navy/70 backdrop-blur-sm animate-fade-in"
        onClick={!mandatory && onSkip ? onSkip : undefined}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Welcome onboarding"
        className="relative w-full max-w-lg bg-snow border-[4px] border-navy rounded-3xl shadow-[8px_8px_0_0_#000] max-h-[90vh] overflow-hidden flex flex-col animate-scale-in"
      >
        {/* ─── Header ─── */}
        <div className={`${STEP_HEADERS[step].bg} border-b-[4px] border-navy px-6 py-5`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/40 mb-0.5">
                Step {step + 1} of 4
              </div>
              <h2 className="font-display font-black text-xl text-navy">
                {STEP_HEADERS[step].label}
              </h2>
            </div>
            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {STEP_HEADERS.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    i === step ? "w-6 bg-navy" : i < step ? "w-2 bg-navy/50" : "w-2 bg-navy/20"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* ═══ Step 0: Welcome ═══ */}
          {step === 0 && (
            <div className="text-center space-y-5">
              {/* Decorative diamond */}
              <div className="w-16 h-16 bg-lime border-[3px] border-navy rounded-2xl flex items-center justify-center mx-auto shadow-[4px_4px_0_0_#000]">
                <svg aria-hidden="true" className="w-8 h-8 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
                </svg>
              </div>

              <div>
                <h3 className="font-display font-black text-2xl text-navy mb-2">
                  Welcome to IESA!
                </h3>
                <p className="text-slate text-sm leading-relaxed max-w-sm mx-auto">
                  The official platform of the Industrial Engineering Students&apos; Association, University of Ibadan.
                </p>
              </div>

              <div className="bg-ghost border-[2px] border-navy/10 rounded-2xl p-4 text-left space-y-2.5">
                <p className="font-display font-bold text-sm text-navy">Here&apos;s what we&apos;ll do:</p>
                {["Set up your student profile", "Show you around the platform", "Get you ready to explore"].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-teal/20 flex items-center justify-center shrink-0">
                      <span className="font-display font-black text-[10px] text-teal">{i + 1}</span>
                    </div>
                    <span className="text-sm text-navy/70">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Step 1: Profile Form / Confirmation ═══ */}
          {step === 1 && isConfirmMode && (
            <div className="space-y-3">
              <p className="text-slate text-sm">Your details are already set up. Everything looks good!</p>

              {/* Read-only summary rows */}
              {[
                { label: "Name", value: `${userProfile?.firstName} ${userProfile?.lastName}` },
                { label: "Matric Number", value: userProfile?.matricNumber },
                { label: "Phone", value: userProfile?.phone },
                { label: "Level", value: userProfile?.currentLevel },
                { label: "Birthday", value: userProfile?.dateOfBirth ? new Date(userProfile.dateOfBirth + "T00:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "long" }) : "Not set" },
                { label: "Department", value: userProfile?.department || "Industrial Engineering" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3 bg-ghost border-[2px] border-cloud rounded-2xl">
                  <span className="font-display font-bold text-[10px] uppercase tracking-[0.1em] text-navy/40">{label}</span>
                  <span className="font-display font-medium text-sm text-navy">{value || "—"}</span>
                </div>
              ))}

              {formError && (
                <div className="p-3 border-[2px] border-coral bg-coral-light text-coral text-xs rounded-xl font-medium flex items-start gap-2">
                  <svg aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" /></svg>
                  {formError}
                </div>
              )}
            </div>
          )}

          {step === 1 && !isConfirmMode && (
            <div className="space-y-3">
              <p className="text-slate text-sm">
                {mandatory
                  ? "Complete your profile to get started. All fields are required."
                  : "Review and update your profile details."}
              </p>

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-display font-bold text-[10px] uppercase tracking-[0.1em] text-navy/40">First Name</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-display font-bold text-[10px] uppercase tracking-[0.1em] text-navy/40">Last Name</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className={inputClass} />
                </div>
              </div>

              {/* Matric */}
              <div className="space-y-1.5">
                <label className="font-display font-bold text-[10px] uppercase tracking-[0.1em] text-navy/40">Matric Number</label>
                <input
                  value={matricNumber}
                  onChange={(e) => setMatricNumber(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="236123"
                  maxLength={6}
                  className={inputClass}
                />
                <p className="text-[10px] text-slate">6 digits only</p>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="font-display font-bold text-[10px] uppercase tracking-[0.1em] text-navy/40">Phone Number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 812 345 6789" className={inputClass} />
              </div>

              {/* Date of Birth */}
              <div className="space-y-1.5">
                <label className="font-display font-bold text-[10px] uppercase tracking-[0.1em] text-navy/40">
                  Date of Birth {isExternal ? "(Optional)" : ""}
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  required={!isExternal}
                  aria-label="Date of birth"
                  className={inputClass}
                />
                <p className="text-[10px] text-slate">
                  {isExternal
                    ? "Optional for visiting students. Add it if you want birthday reminders."
                    : "Required for IPE students so we can celebrate your birthday on the platform."}
                </p>
              </div>

              {/* External toggle */}
              <div className="flex items-center justify-between bg-ghost border-2 border-cloud rounded-2xl px-3.5 py-2.5">
                <div>
                  <p className="font-display font-bold text-xs text-navy">Not from Industrial Engineering?</p>
                  <p className="text-[10px] text-slate mt-0.5">Toggle if you&apos;re from a different department</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsExternal(!isExternal); setDepartment(""); }}
                  className={`relative w-12 h-6 rounded-full border-2 transition-all ${isExternal ? "bg-lime border-navy" : "bg-cloud border-cloud"}`}
                  title={isExternal ? "Currently: External student" : "Currently: IPE student"}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-navy transition-all ${isExternal ? "left-6" : "left-0.5"}`} />
                </button>
              </div>

              {isExternal && (
                <div className="space-y-1.5">
                  <label className="font-display font-bold text-[10px] uppercase tracking-[0.1em] text-navy/40">Your Department</label>
                  <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Electrical Engineering" maxLength={200} className={inputClass} />
                  <p className="text-[10px] text-slate">You&apos;ll be able to join IEPOD but some features are IPE-exclusive</p>
                </div>
              )}

              {/* Session admitted */}
              <div className="space-y-1.5">
                <label className="font-display font-bold text-[10px] uppercase tracking-[0.1em] text-navy/40">Session Admitted</label>
                {sessionsLoading ? (
                  <div className={`${inputClass} flex items-center gap-2 text-slate`}>
                    <div className="w-3.5 h-3.5 rounded-full border-[2px] border-navy border-t-transparent animate-spin shrink-0" />
                    Loading sessions...
                  </div>
                ) : (
                  <select
                    value={admittedSession}
                    onChange={(e) => setAdmittedSession(e.target.value)}
                    className={`${inputClass} appearance-none cursor-pointer`}
                    aria-label="Session admitted"
                  >
                    <option value="">Select the session you were admitted</option>
                    {sessionOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-slate">e.g. 2022/2023</p>
              </div>

              {/* Level confirmation */}
              {admittedSession && !sessionsLoading && calculatedLevel && (
                <div className={`p-3.5 rounded-2xl border-[3px] transition-all ${levelConfirmed ? "bg-teal-light border-teal" : "bg-sunny-light border-sunny"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display font-bold text-sm text-navy">
                        Your level: <span className="font-black">{calculatedLevel}</span>
                      </p>
                      <p className="text-[10px] text-navy/60 mt-0.5">
                        Admitted {admittedSession}{activeSessionName ? `, current ${activeSessionName}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLevelConfirmed(!levelConfirmed)}
                      className={`px-3.5 py-1.5 rounded-xl border-[2px] text-xs font-bold transition-all ${levelConfirmed ? "bg-teal border-navy text-navy" : "bg-snow border-navy text-navy hover:bg-ghost"}`}
                    >
                      {levelConfirmed ? "Confirmed" : "Confirm"}
                    </button>
                  </div>
                  {!levelConfirmed && (
                    <p className="text-[10px] text-navy/50 mt-2">Please confirm your level is correct</p>
                  )}
                </div>
              )}

              {/* Form error */}
              {formError && (
                <div className="p-3 border-[2px] border-coral bg-coral-light text-coral text-xs rounded-xl font-medium flex items-start gap-2">
                  <svg aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
                  </svg>
                  {formError}
                </div>
              )}
            </div>
          )}

          {/* ═══ Step 2: Platform Tour ═══ */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-slate text-sm mb-1">
                Here&apos;s your toolkit for academic success at UI.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {FEATURES.map((f, i) => (
                  <div
                    key={i}
                    className={`${f.color} border-[2px] border-navy/10 rounded-2xl p-3.5 ${i % 3 === 0 ? "rotate-[-0.5deg]" : i % 3 === 1 ? "rotate-[0.5deg]" : ""}`}
                  >
                    <div className="w-8 h-8 bg-snow border-[2px] border-navy/15 rounded-xl flex items-center justify-center mb-2 text-navy/70">
                      {f.icon}
                    </div>
                    <h4 className="font-display font-black text-sm text-navy">{f.title}</h4>
                    <p className="text-[11px] text-navy/50 mt-0.5 leading-snug">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Step 3: Done ═══ */}
          {step === 3 && (
            <div className="text-center space-y-5 py-4 relative overflow-hidden">
              {/* Confetti celebration */}
              <ConfettiParticles />
              {/* Celebration icon */}
              <div className="relative w-20 h-20 mx-auto">
                <div className="w-20 h-20 bg-lime border-[4px] border-navy rounded-3xl flex items-center justify-center shadow-[5px_5px_0_0_#000] rotate-[-3deg]">
                  <svg aria-hidden="true" className="w-10 h-10 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <path d="M22 4L12 14.01l-3-3" />
                  </svg>
                </div>
                {/* Mini sparkle */}
                <svg className="absolute -top-2 -right-2 w-5 h-5 text-sunny" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
                </svg>
              </div>

              <div>
                <h3 className="font-display font-black text-2xl text-navy mb-2">
                  You&apos;re All Set!
                </h3>
                <p className="text-slate text-sm leading-relaxed max-w-xs mx-auto">
                  Your profile is complete and your IESA account is ready. Time to explore your dashboard!
                </p>
              </div>

              <div className="bg-ghost border-[2px] border-navy/10 rounded-2xl p-4 text-sm text-navy/60">
                <span className="font-display font-bold text-navy">Tip: </span>
                Check out the Growth Hub for tools like the CGPA Calculator, Pomodoro Timer, and Flashcards.
              </div>
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="px-6 py-5 border-t-[3px] border-navy/10 flex items-center gap-3">
          {step === 0 && (
            <>
              {!mandatory && onSkip && (
                <button
                  onClick={onSkip}
                  className="text-sm font-display font-bold text-navy/40 hover:text-navy/60 transition-colors"
                >
                  Skip for now
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setStep(1)}
                className="bg-lime border-[3px] border-navy press-3 press-navy px-6 py-2.5 rounded-xl font-display font-bold text-sm text-navy transition-all"
              >
                Let&apos;s Go
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <button
                onClick={() => setStep(0)}
                className="text-sm font-display font-bold text-navy/40 hover:text-navy/60 transition-colors"
              >
                Back
              </button>
              <div className="flex-1" />
              <button
                onClick={isConfirmMode ? handleConfirmProfile : handleSaveProfile}
                disabled={saving}
                className="bg-lime border-[3px] border-navy press-3 press-navy px-6 py-2.5 rounded-xl font-display font-bold text-sm text-navy transition-all disabled:opacity-50"
              >
                {saving ? "Saving..." : isConfirmMode ? "Looks Good, Continue" : "Save & Continue"}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex-1" />
              <button
                onClick={() => setStep(3)}
                className="bg-lime border-[3px] border-navy press-3 press-navy px-6 py-2.5 rounded-xl font-display font-bold text-sm text-navy transition-all"
              >
                Almost done
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex-1" />
              <button
                onClick={onComplete}
                className="w-full bg-lime border-[4px] border-navy press-4 press-navy py-3 rounded-2xl font-display font-black text-base text-navy transition-all"
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
