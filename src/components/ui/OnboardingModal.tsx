"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";

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

/* ─── Session / Level helpers ──────────────────────── */

function generateAdmissionSessions(): { label: string; admissionYear: number }[] {
  const currentYear = new Date().getFullYear();
  const sessions = [];
  for (let i = 0; i < 5; i++) {
    const startYear = currentYear - i;
    const endYear = startYear + 1;
    sessions.push({
      label: `${startYear}/${endYear}`,
      admissionYear: endYear,
    });
  }
  return sessions.reverse();
}

function computeLevel(admissionYear: number): string {
  const currentYear = new Date().getFullYear();
  const levelNum = Math.max(100, Math.min(500, (currentYear - admissionYear) * 100 + 100));
  return `${levelNum}L`;
}

/* ─── Feature Cards for Tour ──────────────────────── */

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    title: "Dashboard",
    desc: "Announcements, timetable, and events at a glance.",
    color: "bg-lime-light",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Growth Hub",
    desc: "CGPA calculator, Pomodoro, flashcards, habits, journal & more.",
    color: "bg-sunny-light",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
    title: "Events",
    desc: "Register for events, pay online, and download your tickets.",
    color: "bg-coral-light",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 20c0-2.76-2.24-4-5-4s-5 1.24-5 4m5-7a3 3 0 100-6 3 3 0 000 6z" /><circle cx="12" cy="12" r="10" />
      </svg>
    ),
    title: "Study Groups",
    desc: "Real-time group chat and session scheduling with classmates.",
    color: "bg-teal-light",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z" /><path d="M9 21h6" />
      </svg>
    ),
    title: "IESA AI",
    desc: "Your AI-powered academic assistant for any question.",
    color: "bg-lavender-light",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
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
  onSkip: () => void;
}

export function OnboardingModal({ onComplete, onSkip }: OnboardingModalProps) {
  const { userProfile } = useAuth();
  const [step, setStep] = useState<Step>(0);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [admissionSession, setAdmissionSession] = useState("");
  const [mounted, setMounted] = useState(false);

  const sessions = generateAdmissionSessions();

  // Pre-fill from existing profile
  useEffect(() => {
    setMounted(true);
    if (userProfile) {
      setFirstName(userProfile.firstName || "");
      setLastName(userProfile.lastName || "");
      if (userProfile.matricNumber) setMatricNumber(userProfile.matricNumber);
      if (userProfile.phone) setPhone(userProfile.phone);
      if (userProfile.admissionYear) {
        const match = sessions.find(s => s.admissionYear === userProfile.admissionYear);
        if (match) setAdmissionSession(match.label);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const selectedAdmissionYear = sessions.find(s => s.label === admissionSession)?.admissionYear;
  const computedLevel = selectedAdmissionYear ? computeLevel(selectedAdmissionYear) : "";



  if (!mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="presentation"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-navy/70 backdrop-blur-sm animate-fade-in" />

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
                <svg className="w-8 h-8 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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

          {/* ═══ Step 1: Profile Confirmation ═══ */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-slate text-sm">Here&apos;s the profile we have on file for you. Head to your Profile page if anything needs updating.</p>

              {/* Profile fields — read-only */}
              <div className="bg-ghost border-[2px] border-navy/10 rounded-2xl divide-y divide-navy/8 overflow-hidden">
                {[
                  { label: "Full Name", value: [firstName, lastName].filter(Boolean).join(" ") || null },
                  { label: "Matric Number", value: matricNumber || null },
                  { label: "Phone", value: phone || null },
                  { label: "Admitted Session", value: admissionSession || null },
                  { label: "Current Level", value: computedLevel || null },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3 gap-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-navy/40 shrink-0">{label}</span>
                    <span className={`text-sm font-display font-bold text-right ${value ? "text-navy" : "text-slate/50 italic font-normal"}`}>
                      {value ?? "Not set"}
                    </span>
                  </div>
                ))}
              </div>

              {computedLevel && (
                <div className="bg-lime/20 border-[2px] border-lime/50 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-teal shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-xs font-display font-bold text-navy">
                    You&apos;re a <span className="text-teal">{computedLevel}</span> student — admitted {admissionSession}.
                  </p>
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
                  <svg className="w-10 h-10 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
              <button
                onClick={onSkip}
                className="text-sm font-display font-bold text-navy/40 hover:text-navy/60 transition-colors"
              >
                Skip for now
              </button>
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
                onClick={() => setStep(2)}
                className="bg-lime border-[3px] border-navy press-3 press-navy px-6 py-2.5 rounded-xl font-display font-bold text-sm text-navy transition-all"
              >
                Looks good, continue
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
