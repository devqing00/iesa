"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getApiUrl } from "@/lib/api";

// Hydration helper
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function AdminRegisterPage() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getSnapshot,
    getServerSnapshot
  );
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!formData.email.includes("@iesa.ui.edu.ng")) {
      setError("Admin email must end with @iesa.ui.edu.ng");
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
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
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: "admin",
          department: "Industrial Engineering",
          hasCompletedOnboarding: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create admin profile");
      }

      router.push("/admin");
    } catch (err: unknown) {
      console.error("Admin registration error:", err);
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError.code === "auth/email-already-in-use") {
        setError("This email is already registered");
      } else if (firebaseError.code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters");
      } else if (firebaseError.code === "auth/invalid-email") {
        setError("Invalid email address");
      } else {
        setError(firebaseError.message || "Failed to register");
      }
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Left - Decorative Section */}
      <div className="hidden lg:flex w-2/5 bg-charcoal dark:bg-cream items-center justify-center relative overflow-hidden">
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
        <div className="relative z-10 max-w-sm p-12 space-y-8">
          <div className="space-y-4">
            <span className="text-label-sm text-cream/60 dark:text-charcoal/60 flex items-center gap-2">
              <span>✦</span> Administrator Registration
            </span>
            <h2 className="font-display text-display-md text-cream dark:text-charcoal">
              Join the Team
            </h2>
            <p className="text-body text-cream/70 dark:text-charcoal/70 leading-relaxed">
              Create an administrator account to help manage the IESA platform.
            </p>
          </div>

          {/* Requirements */}
          <div className="space-y-4">
            <p className="text-label-sm text-cream/60 dark:text-charcoal/60">
              Requirements
            </p>
            {[
              "Valid @iesa.ui.edu.ng email",
              "Approval from existing admin",
              "Department authorization",
            ].map((req, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-cream/80 dark:text-charcoal/80"
              >
                <span className="text-cream/40 dark:text-charcoal/40">◆</span>
                <span className="text-body text-sm">{req}</span>
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
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
              Important Notice
            </p>
            <p className="text-xs text-cream/50 dark:text-charcoal/50">
              Admin accounts have elevated privileges. Misuse will result in
              immediate revocation.
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
              <span>✦</span> Admin Registration
            </span>
            <h1 className="font-display text-display-sm">
              Create Admin Account
            </h1>
            <p className="text-body text-text-secondary">
              Register as a new administrator
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-label-sm text-text-muted">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  placeholder="John"
                  required
                  className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-label-sm text-text-muted">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  placeholder="Doe"
                  required
                  className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-label-sm text-text-muted">
                Admin Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="admin@iesa.ui.edu.ng"
                required
                className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
              />
              <p className="text-xs text-text-muted">
                Must end with @iesa.ui.edu.ng
              </p>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-label-sm text-text-muted">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
              />
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-label-sm text-text-muted">
                Confirm Password
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 border border-error bg-error/10 text-error text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-editorial btn-editorial-plus w-full disabled:opacity-50"
            >
              {loading ? "Creating Account..." : "+ Create Account +"}
            </button>
          </form>

          {/* Links */}
          <div className="pt-6 border-t border-border space-y-4">
            <p className="text-body text-text-secondary text-center">
              Already have an account?{" "}
              <Link
                href="/admin/login"
                className="text-text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
            <div className="text-center">
              <Link
                href="/register"
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
                Student Registration
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
