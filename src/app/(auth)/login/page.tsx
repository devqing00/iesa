"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/Input";

export default function StudentLoginPage() {
  const { signInWithEmail, signInWithGoogle, sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  /* ── Forgot password inline state ── */
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      toast.success("Welcome back!", { description: "Redirecting to your dashboard..." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message || "Failed to login" : "Failed to login";
      setError(msg);
      // Only toast for unexpected errors, not credential errors (already shown inline)
      if (!msg.includes("Incorrect") && !msg.includes("password") && !msg.includes("email")) {
        toast.error("Login failed", { description: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const success = await signInWithGoogle();
      if (success) {
        toast.success("Welcome!", { description: "Redirecting to your dashboard..." });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message || "Google sign-in failed" : "Google sign-in failed";
      if (!msg.includes("popup-closed")) {
        setError(msg);
        toast.error("Sign-in failed", { description: msg });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await sendPasswordReset(forgotEmail);
      setForgotSent(true);
      toast.success("Check your email for a reset link");
    } catch {
      // Always show success to prevent email enumeration
      setForgotSent(true);
      toast.success("Check your email for a reset link");
    } finally {
      setForgotLoading(false);
    }
  };

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

          {showForgot ? (
            /* ── Forgot Password Inline ── */
            <div className="space-y-6">
              <div className="space-y-3">
                <h1 className="font-display font-black text-2xl md:text-3xl text-navy">Reset Password</h1>
                <p className="font-display font-normal text-navy/60">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>
              </div>

              {!forgotSent ? (
                <form onSubmit={handleForgotPassword} className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="forgot-email" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Email</label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full px-4 py-3.5 bg-snow border-[3px] border-navy rounded-2xl text-navy font-display font-normal placeholder:text-slate focus:outline-none focus:border-coral transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3.5 bg-lime border-[3px] border-navy rounded-2xl press-3 press-navy font-display font-black text-navy transition-all disabled:opacity-50"
                  >
                    {forgotLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-teal-light border-[3px] border-teal rounded-2xl">
                    <p className="font-display font-medium text-sm text-navy">
                      If an account exists with <strong>{forgotEmail}</strong>, a reset link has been sent. Check your inbox and spam folder.
                    </p>
                  </div>
                  <button
                    onClick={() => { setForgotSent(false); setForgotEmail(""); }}
                    className="text-navy font-display font-bold text-sm hover:underline"
                  >
                    Try a different email
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}
                className="w-full py-2 font-display font-bold text-sm text-slate hover:text-navy transition-colors"
              >
                &larr; Back to login
              </button>
            </div>
          ) : (
            /* ── Login Form ── */
            <>
              <div className="space-y-3">
                <h1 className="font-display font-black text-2xl md:text-3xl text-navy">Welcome Back</h1>
                <p className="font-display font-normal text-navy/60">Sign in to access your student dashboard</p>
              </div>

              {/* Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 py-3.5 bg-snow border-[3px] border-navy rounded-2xl press-3 press-navy font-display font-bold text-navy transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {googleLoading ? "Signing in..." : "Continue with Google"}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-[3px] bg-cloud" />
                <span className="font-display font-bold text-xs uppercase tracking-wider text-slate">or</span>
                <div className="flex-1 h-[3px] bg-cloud" />
              </div>

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
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setForgotEmail(email); }}
                      className="font-display font-bold text-xs text-navy/60 hover:text-navy hover:underline transition-colors"
                    >
                      Forgot password?
                    </button>
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
                  <div role="alert" className="p-4 border-[3px] border-coral bg-coral-light rounded-2xl">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-coral shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-coral text-sm font-medium">{error}</p>
                        {(error.includes("Incorrect") || error.includes("credentials")) && (
                          <button
                            type="button"
                            onClick={() => { setShowForgot(true); setForgotEmail(email); }}
                            className="text-xs font-display font-bold text-navy/60 hover:text-navy hover:underline mt-2 transition-colors"
                          >
                            Forgot your password? Reset it here &rarr;
                          </button>
                        )}
                        {error.includes("register") && (
                          <a
                            href="/register"
                            className="text-xs font-display font-bold text-navy/60 hover:text-navy hover:underline mt-2 inline-block transition-colors"
                          >
                            Create an account &rarr;
                          </a>
                        )}
                      </div>
                    </div>
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

              {/* Links */}
              <div className="pt-6 border-t-[3px] border-cloud space-y-4">
                <p className="font-display font-normal text-navy/60 text-center">
                  Don&apos;t have an account?{" "}
                  <Link href="/register" className="text-navy font-bold hover:underline">
                    Register
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Right - Decorative Section */}
      <div className="hidden lg:flex flex-1 bg-navy items-center justify-center relative overflow-hidden rounded-l-[2rem]">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-dots opacity-20 pointer-events-none" />

        {/* Diamond Sparkles */}
        <svg className="absolute top-12 right-[15%] w-5 h-5 text-navy/12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="absolute bottom-20 left-[10%] w-4 h-4 text-coral/15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="absolute top-[40%] right-[8%] w-3 h-3 text-sunny/20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>

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
