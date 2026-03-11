"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await sendPasswordReset(email);
      setSent(true);
      toast.success("Check your email for a reset link");
    } catch {
      // Always show success to prevent email enumeration
      setSent(true);
      toast.success("Check your email for a reset link");
    } finally {
      setLoading(false);
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

          {!sent ? (
            <>
              {/* Header */}
              <div className="space-y-3">
                <h1 className="font-display font-black text-2xl md:text-3xl text-navy">Forgot Password</h1>
                <p className="font-display font-normal text-navy/60">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="reset-email" className="font-display font-bold text-xs uppercase tracking-wider text-slate">
                    Email Address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-4 py-3.5 bg-snow border-[3px] border-navy rounded-2xl text-navy font-display font-normal placeholder:text-slate focus:outline-none focus:border-coral transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-lime border-[3px] border-navy rounded-2xl press-3 press-navy font-display font-black text-navy transition-all disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </>
          ) : (
            /* Success State */
            <div className="space-y-6">
              <div className="w-16 h-16 bg-teal-light border-[3px] border-navy rounded-2xl flex items-center justify-center">
                <svg aria-hidden="true" className="w-8 h-8 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="space-y-3">
                <h1 className="font-display font-black text-2xl text-navy">Check Your Email</h1>
                <p className="font-display font-normal text-navy/60">
                  If an account exists with <strong className="text-navy">{email}</strong>, we&apos;ve sent a password reset link. Check your inbox and spam folder.
                </p>
              </div>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-navy font-display font-bold text-sm hover:underline"
              >
                Try a different email
              </button>
            </div>
          )}

          {/* Links */}
          <div className="pt-6 border-t-[3px] border-cloud space-y-4">
            <p className="font-display font-normal text-navy/60 text-center">
              Remember your password?{" "}
              <Link href="/login" className="text-navy font-bold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Right - Decorative Section */}
      <div className="hidden lg:flex flex-1 bg-navy items-center justify-center relative overflow-hidden rounded-l-[2rem]">
        <div className="absolute inset-0 bg-dots opacity-20 pointer-events-none" />
        <svg aria-hidden="true" className="absolute top-12 right-[15%] w-5 h-5 text-lime/12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg aria-hidden="true" className="absolute bottom-20 left-[10%] w-4 h-4 text-coral/15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>

        <div className="relative z-10 max-w-md p-12 text-center space-y-8">
          <div className="space-y-4">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-snow/50 flex items-center justify-center gap-2">
              <span>&#10022;</span> IESA Platform
            </span>
            <h2 className="font-display font-black text-3xl md:text-4xl text-snow">
              Password Recovery
            </h2>
            <p className="font-display font-normal text-snow/70 leading-relaxed">
              Don&apos;t worry — it happens to the best of us. We&apos;ll help you get back into your account.
            </p>
          </div>

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
