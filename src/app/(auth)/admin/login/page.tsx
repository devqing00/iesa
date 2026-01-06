"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getApiUrl } from "@/lib/api";

// Hydration helper
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function AdminLoginPage() {
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!email.includes("@iesa.ui.edu.ng")) {
        setError("Admin accounts must use @iesa.ui.edu.ng email");
        setLoading(false);
        return;
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      const idToken = await user.getIdToken();

      const response = await fetch(getApiUrl("/api/users"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          firebaseUid: user.uid,
          email: user.email,
          role: "admin",
          department: "Industrial Engineering",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to sync user with database");
      }

      const userData = await response.json();

      if (userData.role !== "admin") {
        await auth.signOut();
        setError("Access denied. This login is for administrators only.");
        setLoading(false);
        return;
      }

      router.push("/admin");
    } catch (err: unknown) {
      console.error("Admin login error:", err);
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
      {/* Left - Decorative Section (Admin themed) */}
      <div className="hidden lg:flex flex-1 bg-charcoal dark:bg-cream items-center justify-center relative overflow-hidden">
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="absolute top-6 left-6 p-2 text-cream dark:text-charcoal hover:opacity-70 transition-opacity z-10"
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
        <div className="absolute inset-0 bg-cross-grid opacity-20 pointer-events-none" />

        {/* Decorative Content */}
        <div className="relative z-10 max-w-md p-12 text-center space-y-8">
          <div className="space-y-4">
            <span className="text-label-sm text-cream/60 dark:text-charcoal/60 flex items-center justify-center gap-2">
              <span>✦</span> Administrator Access
            </span>
            <h2 className="font-display text-display-md text-cream dark:text-charcoal">
              Admin Portal
            </h2>
            <p className="text-body text-cream/70 dark:text-charcoal/70 leading-relaxed">
              Manage students, announcements, events, and platform settings.
            </p>
          </div>

          {/* Admin Features */}
          <div className="space-y-4 text-left">
            {[
              "Student management",
              "Payment verification",
              "Announcements & events",
              "Platform analytics",
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

          {/* Warning */}
          <div className="p-4 border border-cream/20 dark:border-charcoal/20 space-y-2">
            <p className="text-label-sm text-cream/60 dark:text-charcoal/60 flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              Restricted Access
            </p>
            <p className="text-xs text-cream/50 dark:text-charcoal/50">
              This portal is for authorized administrators only.
            </p>
          </div>

          {/* Footer */}
          <div className="pt-8 border-t border-cream/20 dark:border-charcoal/20">
            <p className="text-label-sm text-cream/50 dark:text-charcoal/50">
              University of Ibadan, Nigeria
            </p>
          </div>
        </div>
      </div>

      {/* Right - Form Section */}
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
              <span>✦</span> Admin Portal
            </span>
            <h1 className="font-display text-display-sm">
              Administrator Login
            </h1>
            <p className="text-body text-text-secondary">
              Sign in to manage the platform
            </p>
          </div>

          {/* Info Card */}
          <div className="page-frame p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-text-muted shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                />
              </svg>
              <p className="text-sm text-text-secondary">
                <strong className="text-text-primary">First time?</strong>{" "}
                Register first with your admin email, then login.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-label-sm text-text-muted">
                Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@iesa.ui.edu.ng"
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
              Need an admin account?{" "}
              <Link
                href="/admin/register"
                className="text-text-primary hover:underline"
              >
                Register
              </Link>
            </p>
            <div className="text-center">
              <Link
                href="/login"
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
                    d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                  />
                </svg>
                Student Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
