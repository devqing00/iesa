"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

// Hydration helper
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function StudentLoginPage() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getSnapshot,
    getServerSnapshot
  );
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);

      // Let AuthContext handle the user profile sync

      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Google sign-in error:", err);
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError.code === "auth/popup-closed-by-user") {
        setError("Sign-in cancelled. Please try again.");
      } else {
        setError(firebaseError.message || "Failed to sign in with Google");
      }
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);

      // Let AuthContext handle the user profile sync

      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Login error:", err);
      const firebaseError = err as { code?: string; message?: string };
      if (
        firebaseError.code === "auth/invalid-credential" ||
        firebaseError.code === "auth/user-not-found"
      ) {
        setError("Account not found. Please register first.");
      } else if (firebaseError.code === "auth/wrong-password") {
        setError("Incorrect password");
      } else if (firebaseError.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else {
        setError(firebaseError.message || "Failed to login");
      }
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Left - Form Section */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-8 h-8 relative">
              {theme === "light" ? (
                <Image
                  src="/assets/images/logo.svg"
                  alt="IESA"
                  fill
                  className="object-contain"
                />
              ) : (
                <Image
                  src="/assets/images/logo-light.svg"
                  alt="IESA"
                  fill
                  className="object-contain"
                />
              )}
            </div>
            <span className="font-display text-xl">IESA</span>
          </Link>

          {/* Header */}
          <div className="space-y-2">
            <span className="text-label-sm text-text-muted flex items-center gap-2">
              <span>✦</span> Student Portal
            </span>
            <h1 className="font-display text-display-sm">Welcome Back</h1>
            <p className="text-body text-text-secondary">
              Sign in to access your student dashboard
            </p>
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border bg-bg-card text-text-primary text-body hover:bg-bg-secondary transition-colors disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-bg-primary text-text-muted text-label-sm">
                or continue with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-label-sm text-text-muted">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@stu.ui.edu.ng"
                required
                className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-label-sm text-text-muted">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
              />
            </div>

            {error && (
              <div className="p-4 border border-error bg-error/10 text-error text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-editorial btn-editorial-plus w-full disabled:opacity-50"
            >
              {loading ? "Signing in..." : "+ Sign In +"}
            </button>
          </form>

          {/* Links */}
          <div className="pt-6 border-t border-border space-y-4">
            <p className="text-body text-text-secondary text-center">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-text-primary hover:underline"
              >
                Register
              </Link>
            </p>
            <div className="text-center">
              <Link
                href="/admin/login"
                className="text-label-sm text-text-muted hover:text-text-secondary transition-colors inline-flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
                Admin Portal
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Right - Decorative Section */}
      <div className="hidden lg:flex flex-1 bg-charcoal dark:bg-cream items-center justify-center relative overflow-hidden">
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="absolute top-6 right-6 p-2 text-cream dark:text-charcoal hover:opacity-70 transition-opacity z-10"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
              />
            </svg>
          )}
        </button>

        {/* Background Pattern */}
        <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />

        {/* Decorative Content */}
        <div className="relative z-10 max-w-md p-12 text-center space-y-8">
          <div className="space-y-4">
            <span className="text-label-sm text-cream/60 dark:text-charcoal/60 flex items-center justify-center gap-2">
              <span>✦</span> IESA Platform
            </span>
            <h2 className="font-display text-display-md text-cream dark:text-charcoal">
              Student Portal
            </h2>
            <p className="text-body text-cream/70 dark:text-charcoal/70 leading-relaxed">
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
              <div
                key={i}
                className="flex items-center gap-3 text-cream/80 dark:text-charcoal/80"
              >
                <span className="text-cream/40 dark:text-charcoal/40">◆</span>
                <span className="text-body text-sm">{feature}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-8 border-t border-cream/20 dark:border-charcoal/20">
            <p className="text-label-sm text-cream/50 dark:text-charcoal/50">
              University of Ibadan, Nigeria
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
