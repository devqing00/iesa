"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { TwoFactorRequiredError } from "@/context/AuthContext";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/Input";

export default function StudentLoginPage() {
  const { signInWithEmail, complete2FALogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ── 2FA state ── */
  const [twoFaStep, setTwoFaStep] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const twoFaInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      toast.success("Welcome back!", { description: "Redirecting to your dashboard..." });
    } catch (err: unknown) {
      if (err instanceof TwoFactorRequiredError) {
        setTempToken(err.tempToken);
        setTwoFaStep(true);
        setLoading(false);
        return;
      }
      const msg = err instanceof Error ? err.message || "Failed to login" : "Failed to login";
      setError(msg);
      toast.error("Login failed", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  /* ── Auto-focus 2FA input ── */
  useEffect(() => {
    if (twoFaStep) twoFaInputRef.current?.focus();
  }, [twoFaStep]);

  /* ── Submit 2FA code ── */
  const handle2FASubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (twoFaCode.length !== 6 || loading) return;
    setError("");
    setLoading(true);

    try {
      await complete2FALogin(tempToken, twoFaCode);
      toast.success("Welcome back!", { description: "Redirecting to your dashboard..." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message || "Invalid code" : "Invalid code";
      setError(msg);
      setTwoFaCode("");
      toast.error("Verification failed", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  /* ── Auto-submit when 6 digits entered ── */
  const handle2FARef = useRef(handle2FASubmit);
  handle2FARef.current = handle2FASubmit;
  useEffect(() => {
    if (twoFaCode.length === 6 && !loading) {
      handle2FARef.current();
    }
  }, [twoFaCode, loading]);

  return (
    <div className="min-h-screen bg-ghost flex">
      {/* Left - Form Section */}
      <main id="main-content" className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <Image src="/assets/images/logo.svg" alt="IESA Logo" width={40} height={40} className="object-contain" />
            </div>
            <span className="font-display font-black text-xl text-navy">IESA</span>
          </Link>

          {/* Header */}
          <div className="space-y-3">
            <h1 className="font-display font-black text-2xl md:text-3xl text-navy">
              {twoFaStep ? "Two-Factor Verification" : "Welcome Back"}
            </h1>
            <p className="font-display font-normal text-navy/60">
              {twoFaStep
                ? "One more step to verify your identity"
                : "Sign in to access your student dashboard"}
            </p>
          </div>

          {/* Form */}
          {!twoFaStep ? (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="login-email" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Email</label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3.5 bg-snow border-[3px] border-navy rounded-2xl text-navy font-display font-normal placeholder:text-slate focus:outline-none focus:border-coral transition-all"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Password</label>
                  <Link href="/forgot-password" className="font-display font-bold text-xs text-navy/60 hover:text-navy hover:underline transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3.5 bg-snow border-[3px] border-navy rounded-2xl text-navy font-display font-normal placeholder:text-slate focus:outline-none focus:border-coral transition-all"
                />
              </div>

              {error && (
                <div role="alert" className="p-4 border-[3px] border-coral bg-coral-light text-coral text-sm rounded-2xl font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-lime border-[3px] border-navy rounded-2xl press-3 press-navy font-display font-black text-navy transition-all disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          ) : (
            /* ── 2FA Verification Step ── */
            <form onSubmit={handle2FASubmit} className="space-y-6">
              <div className="p-4 bg-lavender-light border-[3px] border-lavender rounded-2xl">
                <p className="font-display font-medium text-sm text-navy">
                  Enter the 6-digit code from your authenticator app, or a backup code.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="2fa-code" className="font-display font-bold text-xs uppercase tracking-wider text-slate">
                  Verification Code
                </label>
                <input
                  ref={twoFaInputRef}
                  id="2fa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8))}
                  placeholder="000000"
                  className="w-full px-4 py-3.5 bg-snow border-[3px] border-navy rounded-2xl text-navy font-display font-bold text-center text-xl tracking-[0.3em] placeholder:text-slate placeholder:font-normal placeholder:tracking-[0.3em] focus:outline-none focus:border-coral transition-all"
                />
              </div>

              {error && (
                <div role="alert" className="p-4 border-[3px] border-coral bg-coral-light text-coral text-sm rounded-2xl font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || twoFaCode.length < 6}
                className="w-full py-3.5 bg-lime border-[3px] border-navy rounded-2xl press-3 press-navy font-display font-black text-navy transition-all disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Sign In"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setTwoFaStep(false);
                  setTempToken("");
                  setTwoFaCode("");
                  setError("");
                }}
                className="w-full py-2 font-display font-bold text-sm text-slate hover:text-navy transition-colors"
              >
                ← Back to login
              </button>
            </form>
          )}

          {/* Links */}
          <div className="pt-6 border-t-[3px] border-cloud space-y-4">
            <p className="font-display font-normal text-navy/60 text-center">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-navy font-bold hover:underline">
                Register
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Right - Decorative Section */}
      <div className="hidden lg:flex flex-1 bg-navy items-center justify-center relative overflow-hidden rounded-l-[2rem]">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-dots opacity-20 pointer-events-none" />

        {/* Diamond Sparkles */}
        <svg className="absolute top-12 right-[15%] w-5 h-5 text-navy/12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="absolute bottom-20 left-[10%] w-4 h-4 text-coral/15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="absolute top-[40%] right-[8%] w-3 h-3 text-sunny/20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>

        {/* Decorative Content */}
        <div className="relative z-10 max-w-md p-12 text-center space-y-8">
          <div className="space-y-4">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-snow/50 flex items-center justify-center gap-2">
              <span>&#10022;</span> IESA Platform
            </span>
            <h2 className="font-display font-black text-3xl md:text-4xl text-snow">
              Student Portal
            </h2>
            <p className="font-display font-normal text-snow/70 leading-relaxed">
              Access your courses, track your payments, view announcements, and
              connect with fellow students.
            </p>
          </div>

          {/* Feature List */}
          <div className="space-y-4 text-left">
            {[
              "Course enrollment & timetable",
              "Payment history & receipts",
              "Announcements & events",
              "Student resources",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-snow/80">
                <span className="text-snow/30">&#9670;</span>
                <span className="font-display font-normal text-sm">{feature}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-8 border-t border-snow/20">
            <p className="font-display font-bold text-xs uppercase tracking-wider text-snow/50">
              University of Ibadan, Nigeria
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
