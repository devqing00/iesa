"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { isInstitutionalEmail } from "@/lib/emailUtils";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/Input";

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading, signUpWithEmail } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [admittedSession, setAdmittedSession] = useState("");
  const [levelConfirmed, setLevelConfirmed] = useState(false);
  const [isExternalStudent, setIsExternalStudent] = useState(false);
  const [department, setDepartment] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const submittingRef = useRef(false); // synchronous guard against double-submission
  const [currentSecondYear, setCurrentSecondYear] = useState<number | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [apiSessionNames, setApiSessionNames] = useState<string[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Fetch sessions to get the active session's second year for level calculation
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch(getApiUrl("/api/v1/sessions/"));
        if (res.ok) {
          const sessions: { isActive: boolean; name: string }[] = await res.json();
          const active = sessions.find((s) => s.isActive);
          if (active?.name) {
            setSessionName(active.name);
            // Extract SECOND year from active session (e.g., "2025/2026" → 2026)
            const secondYear = parseInt(active.name.split("/")[1]);
            if (!isNaN(secondYear)) setCurrentSecondYear(secondYear);
          }
          // Collect all session names from API for the dropdown
          setApiSessionNames(sessions.map((s) => s.name));
        }
      } catch {
        // API unavailable — level calculation will be blocked
      } finally {
        setSessionsLoading(false);
      }
    };
    fetchSessions();
  }, []);

  /**
   * Build the session options shown in the dropdown.
   * Always generate 6 sessions ending at currentSecondYear (covering 100L–500L).
   * Merge in any extra sessions returned by the API.
   */
  const sessionOptions: string[] = (() => {
    const baseSecondYear = currentSecondYear ?? new Date().getFullYear() + 1;
    const generated: string[] = [];
    for (let y = baseSecondYear; y >= baseSecondYear - 5; y--) {
      generated.push(`${y - 1}/${y}`);
    }
    // add any API sessions not already in the generated list
    for (const name of apiSessionNames) {
      if (!generated.includes(name)) generated.push(name);
    }
    return generated.sort((a, b) => b.localeCompare(a)); // newest first
  })();

  /**
   * Calculate academic level from the admitted session.
   * Formula: level = (currentSecondYear - admittedSecondYear) * 100 + 100
   * Both values are the SECOND year of their respective sessions.
   * Clamped between 100L and 500L.
   * Returns "" if currentSecondYear hasn't loaded yet (prevents wrong calc).
   */
  const calculateLevel = (admSession: string): string => {
    if (currentSecondYear === null) return "";
    const admSecondYear = parseInt(admSession.split("/")[1]);
    if (isNaN(admSecondYear)) return "";
    const yearDiff = currentSecondYear - admSecondYear;
    const levelNum = Math.max(100, Math.min(500, yearDiff * 100 + 100));
    return `${levelNum}L`;
  };

  const calculatedLevel = admittedSession ? calculateLevel(admittedSession) : "";
  // admissionYear for storage = second year of the admitted session
  const derivedAdmissionYear = admittedSession ? parseInt(admittedSession.split("/")[1]) : 0;

  // Reset confirmation when admitted session changes
  useEffect(() => {
    setLevelConfirmed(false);
  }, [admittedSession]);

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const validateForm = (): boolean => {
    setError("");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) { setError("Email is required"); return false; }
    if (!emailRegex.test(email)) { setError("Please enter a valid email address"); return false; }
    if (!password) { setError("Password is required"); return false; }
    if (password.length < 8) { setError("Password must be at least 8 characters with uppercase, lowercase, and a number"); return false; }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) { setError("Password must include uppercase, lowercase, and a number"); return false; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return false; }
    if (!firstName.trim()) { setError("First name is required"); return false; }
    if (!lastName.trim()) { setError("Last name is required"); return false; }
    if (!matricNumber.trim()) { setError("Matric number is required"); return false; }
    if (!/^\d{6}$/.test(matricNumber)) { setError("Matric number must be exactly 6 digits"); return false; }
    if (!phone.trim()) { setError("Phone number is required"); return false; }
    if (!/^(\+234|0)[789]\d{9}$/.test(phone)) { setError("Invalid Nigerian phone number"); return false; }
    if (!admittedSession) { setError("Session admitted is required"); return false; }
    if (!/^\d{4}\/\d{4}$/.test(admittedSession)) { setError("Session must be in format YYYY/YYYY (e.g. 2022/2023)"); return false; }
    if (!levelConfirmed) { setError("Please confirm your calculated level"); return false; }
    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return; // synchronous guard — state updates are async
    if (!validateForm()) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await signUpWithEmail(email, password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        matricNumber: matricNumber.trim(),
        phone: phone.trim(),
        level: calculatedLevel,
        admissionYear: derivedAdmissionYear,
        department: isExternalStudent && department.trim() ? department.trim() : "Industrial Engineering",
      });
      setRegistrationSuccess(true);
      toast.success("Account created!", { description: "Verification email sent. Check your inbox." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message || "Registration failed. Please try again." : "An unexpected error occurred. Please try again.";
      setError(msg);
      toast.error("Registration failed", { description: msg });
      // Only re-enable on failure
      submittingRef.current = false;
      setIsSubmitting(false);
    }
    // No finally — on success we intentionally keep isSubmitting true to lock the button
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ghost">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-navy border-t-transparent"></div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-3.5 bg-snow border-[3px] border-navy rounded-2xl text-navy font-display font-normal placeholder:text-slate focus:outline-none focus:border-coral transition-all";

  return (
    <div className="min-h-screen bg-ghost flex">
      {/* Left - Decorative Section */}
      <div className="hidden lg:flex w-2/5 bg-navy items-center justify-center relative overflow-hidden rounded-r-[2rem]">
        <div className="absolute inset-0 bg-dots opacity-20 pointer-events-none" />

        {/* Diamond Sparkles */}
        <svg className="absolute top-16 left-[12%] w-5 h-5 text-navy/12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="absolute bottom-24 right-[15%] w-4 h-4 text-coral/15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="absolute top-[60%] left-[8%] w-3 h-3 text-sunny/20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>

        <div className="relative z-10 max-w-sm p-12 space-y-8">
          <div className="space-y-4">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-snow/50 flex items-center gap-2">
              <span>&#10022;</span> Join IESA
            </span>
            <h2 className="font-display font-black text-3xl md:text-4xl text-snow">
              Create Your Account
            </h2>
            <p className="font-display font-normal text-snow/70 leading-relaxed">
              Join the Industrial Engineering Students&apos; Association and access exclusive resources.
            </p>
          </div>

          <div className="space-y-4">
            {["Access course materials", "Stay updated with events", "Connect with peers", "Track your progress"].map((benefit, i) => (
              <div key={i} className="flex items-center gap-3 text-snow/80">
                <span className="text-snow/30">&#9670;</span>
                <span className="font-display font-normal text-sm">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-snow/20">
            <p className="font-display font-bold text-xs uppercase tracking-wider text-snow/50">University of Ibadan, Nigeria</p>
          </div>
        </div>
      </div>

      {/* Right - Form / Success Section */}
      <main id="main-content" className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-xl space-y-8 py-8">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <Image src="/assets/images/logo.svg" alt="IESA Logo" width={40} height={40} className="object-contain" />
            </div>
            <span className="font-display font-black text-xl text-navy">IESA</span>
          </Link>

          {/* Success screen — shown after registration completes, while navigation is in progress */}
          {registrationSuccess ? (
            <div className="bg-teal-light border-[4px] border-navy rounded-3xl p-10 shadow-[8px_8px_0_0_#000] text-center space-y-6">
              <div className="w-16 h-16 mx-auto bg-teal border-[3px] border-navy rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="font-display font-black text-2xl text-navy">Account Created!</h2>
                <p className="font-display font-normal text-navy/70">
                  Taking you to your dashboard&hellip;
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-navy/50 text-sm">
                <div className="w-4 h-4 rounded-full border-[2px] border-navy border-t-transparent animate-spin" />
                <span className="font-display">Loading dashboard</span>
              </div>
            </div>
          ) : (
          <>
          {/* Header */}
          <div className="space-y-2">
            <h1 className="font-display font-black text-2xl md:text-3xl text-navy">Create Account</h1>
            <p className="font-display font-normal text-navy/60">Register with any email you own</p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-8">
            {/* Account Section */}
            <div className="space-y-4">
              <h2 className="font-display font-bold text-xs text-slate uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-lime border-[2px] border-navy flex items-center justify-center text-xs font-bold text-navy">1</span>
                <span>Account</span>
              </h2>

              <div className="space-y-2">
                <label htmlFor="register-email" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Email</label>
                <input id="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@stu.ui.edu.ng/you@gmail.com" required className={inputClass} />
                {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                  <div className="flex items-center gap-2">
                    {isInstitutionalEmail(email) ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-light border-[2px] border-navy text-navy font-display font-bold text-label-sm">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>
                        Institutional Email
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-lavender-light border-[2px] border-navy text-navy font-display font-bold text-label-sm">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                        Personal Email
                      </span>
                    )}
                    <span className="text-xs text-slate">You can add the other type later in your profile</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="register-password" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Password</label>
                  <PasswordInput id="register-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} className={inputClass} />
                  <p className="text-xs text-slate">Min 8 chars, uppercase, lowercase & number</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="register-confirm-password" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Confirm Password</label>
                  <PasswordInput id="register-confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={8} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Personal Info Section */}
            <div className="space-y-4 pt-4 border-t-[3px] border-cloud">
              <h2 className="font-display font-bold text-xs text-slate uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-lavender border-[2px] border-navy flex items-center justify-center text-xs font-bold text-navy">2</span>
                <span>Personal Info</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="register-first-name" className="font-display font-bold text-xs uppercase tracking-wider text-slate">First Name</label>
                  <input id="register-first-name" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" required className={inputClass} />
                </div>
                <div className="space-y-2">
                  <label htmlFor="register-last-name" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Last Name</label>
                  <input id="register-last-name" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" required className={inputClass} />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="register-matric-number" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Matric Number</label>
                <input id="register-matric-number" type="text" value={matricNumber} onChange={(e) => { const value = e.target.value.replace(/\D/g, "").slice(0, 6); setMatricNumber(value); }} placeholder="236123" required maxLength={6} className={inputClass} />
                <p className="text-xs text-slate">6 digits only</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="register-phone" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Phone Number</label>
                <input id="register-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 812 345 6789" required className={inputClass} />
              </div>
            </div>

            {/* Academic Info Section */}
            <div className="space-y-4 pt-4 border-t-[3px] border-cloud">
              <h2 className="font-display font-bold text-xs text-slate uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-teal border-2 border-navy flex items-center justify-center text-xs font-bold text-navy">3</span>
                <span>Academic Info</span>
              </h2>

              {/* External student toggle */}
              <div className="flex items-center justify-between bg-ghost border-2 border-cloud rounded-2xl px-4 py-3">
                <div>
                  <p className="font-display font-bold text-xs text-navy">Not from Industrial Engineering?</p>
                  <p className="text-[11px] text-slate mt-0.5">Toggle if you&apos;re from a different department</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsExternalStudent(!isExternalStudent); setDepartment(""); }}
                  className={`relative w-12 h-6 rounded-full border-2 transition-all ${
                    isExternalStudent ? "bg-lime border-navy" : "bg-cloud border-cloud"
                  }`}
                  title={isExternalStudent ? "Currently: External student" : "Currently: IPE student"}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-navy transition-all ${
                    isExternalStudent ? "left-6" : "left-0.5"
                  }`} />
                </button>
              </div>

              {isExternalStudent && (
                <div className="space-y-2">
                  <label htmlFor="register-department" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Your Department</label>
                  <input
                    id="register-department"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Electrical Engineering"
                    required={isExternalStudent}
                    maxLength={200}
                    className={inputClass}
                  />
                  <p className="text-xs text-slate">You&apos;ll be able to join IEPOD but some features are IPE-exclusive</p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="register-admitted-session" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Session Admitted</label>
                {sessionsLoading ? (
                  <div className={`${inputClass} flex items-center gap-2 text-slate`}>
                    <div className="w-4 h-4 rounded-full border-[2px] border-navy border-t-transparent animate-spin shrink-0" />
                    Loading sessions...
                  </div>
                ) : (
                  <select
                    id="register-admitted-session"
                    value={admittedSession}
                    onChange={(e) => setAdmittedSession(e.target.value)}
                    required
                    className={`${inputClass} appearance-none cursor-pointer`}
                  >
                    <option value="">Select the session you were admitted</option>
                    {sessionOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-slate">The academic session you were admitted to UI (e.g. 2022/2023)</p>
              </div>

              {/* Calculated Level Confirmation */}
              {admittedSession && !sessionsLoading && (
                calculatedLevel ? (
                  <div className={`p-4 rounded-2xl border-[3px] transition-all ${
                    levelConfirmed
                      ? "bg-teal-light border-teal"
                      : "bg-sunny-light border-sunny"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-display font-bold text-sm text-navy">
                          Your calculated level: <span className="font-black text-base">{calculatedLevel}</span>
                        </p>
                        <p className="text-xs text-navy/60 mt-1">
                          Admitted {admittedSession}{sessionName ? `, current session ${sessionName}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLevelConfirmed(!levelConfirmed)}
                        className={`px-4 py-2 rounded-xl border-[2px] text-xs font-bold transition-all ${
                          levelConfirmed
                            ? "bg-teal border-navy text-navy"
                            : "bg-snow border-navy text-navy hover:bg-ghost"
                        }`}
                      >
                        {levelConfirmed ? "Confirmed" : "Confirm"}
                      </button>
                    </div>
                    {!levelConfirmed && (
                      <p className="text-xs text-navy/50 mt-2">
                        Please confirm your level is correct before proceeding
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl border-[3px] bg-coral-light border-coral">
                    <p className="text-sm font-bold text-navy">Could not calculate level</p>
                    <p className="text-xs text-navy/60 mt-1">No active academic session found. Please contact an admin.</p>
                  </div>
                )
              )}
            </div>

            {error && (
              <div role="alert" className="p-4 border-[3px] border-coral bg-coral-light text-coral text-sm rounded-2xl font-medium">
                {error}
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="w-full py-3.5 bg-lime border-[3px] border-navy rounded-2xl press-3 press-navy font-display font-black text-navy transition-all disabled:opacity-50">
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          {/* Links */}
          <div className="pt-6 border-t-[3px] border-cloud">
            <p className="font-display font-normal text-navy/60 text-center">
              Already have an account?{" "}
              <Link href="/login" className="text-navy font-bold hover:underline">Sign in</Link>
            </p>
          </div>

          {/* Help Info */}
          <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[3px_3px_0_0_#000]">
            <div className="flex items-start gap-3">
              <span className="text-teal">&#9670;</span>
              <p className="text-sm text-navy/60">
                You can register with any email you own — institutional or personal.
                A verification email will be sent after registration.
              </p>
            </div>
          </div>
          </>
          )}
        </div>
      </main>
    </div>
  );
}
