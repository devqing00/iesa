"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { api } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      await api.post(
        "/api/v1/auth/reset-password",
        { token, newPassword: password },
        { skipAuth: true, showErrorToast: false }
      );
      setSuccess(true);
      toast.success("Password reset successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset password";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-6">
        <div className="w-16 h-16 bg-coral-light border-[3px] border-navy rounded-2xl flex items-center justify-center">
          <svg className="w-8 h-8 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="space-y-3">
          <h1 className="font-display font-black text-2xl text-navy">Invalid Reset Link</h1>
          <p className="font-display font-normal text-navy/60">
            This password reset link is invalid or missing. Please request a new one.
          </p>
        </div>
        <Link href="/forgot-password" className="inline-block py-3 px-6 bg-lime border-[3px] border-navy rounded-2xl press-3 press-navy font-display font-black text-navy text-sm transition-all">
          Request New Link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div className="w-16 h-16 bg-teal-light border-[3px] border-navy rounded-2xl flex items-center justify-center">
          <svg className="w-8 h-8 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-3">
          <h1 className="font-display font-black text-2xl text-navy">Password Reset!</h1>
          <p className="font-display font-normal text-navy/60">
            Your password has been updated successfully. You can now sign in with your new password.
          </p>
        </div>
        <Link href="/login" className="inline-block py-3.5 px-8 bg-lime border-[3px] border-navy rounded-2xl press-3 press-navy font-display font-black text-navy transition-all">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <h1 className="font-display font-black text-2xl md:text-3xl text-navy">Reset Password</h1>
        <p className="font-display font-normal text-navy/60">
          Enter your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="new-password" className="font-display font-bold text-xs uppercase tracking-wider text-slate">
            New Password
          </label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            className="w-full px-4 py-3.5 bg-snow border-[3px] border-navy rounded-2xl text-navy font-display font-normal placeholder:text-slate focus:outline-none focus:border-coral transition-all"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-password" className="font-display font-bold text-xs uppercase tracking-wider text-slate">
            Confirm Password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
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
          {loading ? "Resetting..." : "Set New Password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-ghost flex">
      <main id="main-content" className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <Image src="/assets/images/logo.svg" alt="IESA Logo" width={40} height={40} className="object-contain" />
            </div>
            <span className="font-display font-black text-xl text-navy">IESA</span>
          </Link>

          <Suspense fallback={<div className="animate-pulse h-40 bg-cloud rounded-2xl" />}>
            <ResetPasswordForm />
          </Suspense>

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
        <svg className="absolute top-12 right-[15%] w-5 h-5 text-lime/12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="absolute bottom-20 left-[10%] w-4 h-4 text-coral/15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>

        <div className="relative z-10 max-w-md p-12 text-center space-y-8">
          <div className="space-y-4">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-snow/50 flex items-center justify-center gap-2">
              <span>&#10022;</span> IESA Platform
            </span>
            <h2 className="font-display font-black text-3xl md:text-4xl text-snow">
              New Password
            </h2>
            <p className="font-display font-normal text-snow/70 leading-relaxed">
              Choose a strong password with at least 8 characters, including uppercase, lowercase, numbers, and special characters.
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
