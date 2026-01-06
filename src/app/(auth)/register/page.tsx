"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

// Hydration helper
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function RegisterPage() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getSnapshot,
    getServerSnapshot
  );
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [level, setLevel] = useState("100L");
  const [admissionYear, setAdmissionYear] = useState(
    new Date().getFullYear().toString()
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      setError("");

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      const token = await firebaseUser.getIdToken();

      let nameParts: string[] = [];
      if (firebaseUser.displayName) {
        nameParts = firebaseUser.displayName.split(" ");
        setFirstName(nameParts[0] || "");
        setLastName(nameParts.slice(1).join(" ") || "");
      }
      if (firebaseUser.email) {
        setEmail(firebaseUser.email);
      }

      const response = await fetch(getApiUrl("/api/users"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          email: firebaseUser.email || email,
          firstName: firstName.trim() || nameParts?.[0] || "",
          lastName: lastName.trim() || nameParts?.slice(1).join(" ") || "",
          matricNumber: matricNumber.trim(),
          phone: phone.trim(),
          level: level,
          admissionYear: parseInt(admissionYear),
          role: "student",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create account");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Google registration error:", err);
      if (err instanceof Error) {
        if (err.message.includes("popup-closed-by-user")) {
          setError("Sign-in cancelled. Please try again.");
        } else {
          setError(err.message || "Failed to sign in with Google");
        }
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateForm = (): boolean => {
    setError("");

    const emailRegex = /@stu\.ui\.edu\.ng$/;
    if (!email) {
      setError("Email is required");
      return false;
    }
    if (!emailRegex.test(email)) {
      setError("Please use your institutional email (@stu.ui.edu.ng)");
      return false;
    }

    if (!password) {
      setError("Password is required");
      return false;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    if (!firstName.trim()) {
      setError("First name is required");
      return false;
    }
    if (!lastName.trim()) {
      setError("Last name is required");
      return false;
    }

    if (!matricNumber.trim()) {
      setError("Matric number is required");
      return false;
    }
    if (!/^\d{6}$/.test(matricNumber)) {
      setError("Matric number must be exactly 6 digits");
      return false;
    }

    if (!phone.trim()) {
      setError("Phone number is required");
      return false;
    }
    if (!/^(\+234|0)[789]\d{9}$/.test(phone)) {
      setError("Invalid Nigerian phone number");
      return false;
    }

    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const firebaseUser = userCredential.user;
      const token = await firebaseUser.getIdToken();

      const response = await fetch(getApiUrl("/api/users"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          email: email,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          matricNumber: matricNumber.trim(),
          phone: phone.trim(),
          level: level,
          admissionYear: parseInt(admissionYear),
          role: "student",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create account");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Registration error:", err);

      if (err instanceof Error) {
        if (err.message.includes("email-already-in-use")) {
          setError("This email is already registered. Please log in instead.");
        } else if (err.message.includes("weak-password")) {
          setError("Password is too weak. Please use a stronger password.");
        } else if (err.message.includes("invalid-email")) {
          setError("Invalid email format");
        } else {
          setError(err.message || "Registration failed. Please try again.");
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-text-primary border-t-transparent"></div>
      </div>
    );
  }

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
        <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />

        {/* Decorative Content */}
        <div className="relative z-10 max-w-sm p-12 space-y-8">
          <div className="space-y-4">
            <span className="text-label-sm text-cream/60 dark:text-charcoal/60 flex items-center gap-2">
              <span>✦</span> Join IESA
            </span>
            <h2 className="font-display text-display-md text-cream dark:text-charcoal">
              Create Your Account
            </h2>
            <p className="text-body text-cream/70 dark:text-charcoal/70 leading-relaxed">
              Join the Industrial Engineering Students&apos; Association and
              access exclusive resources.
            </p>
          </div>

          {/* Benefits List */}
          <div className="space-y-4">
            {[
              "Access course materials",
              "Stay updated with events",
              "Connect with peers",
              "Track your progress",
            ].map((benefit, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-cream/80 dark:text-charcoal/80"
              >
                <span className="text-cream/40 dark:text-charcoal/40">◆</span>
                <span className="text-body text-sm">{benefit}</span>
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

      {/* Right - Form Section */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-xl space-y-8 py-8">
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
              <span>✦</span> Student Registration
            </span>
            <h1 className="font-display text-display-sm">Create Account</h1>
            <p className="text-body text-text-secondary">
              Register with your institutional email
            </p>
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
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
                or register with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-8">
            {/* Account Section */}
            <div className="space-y-4">
              <h2 className="text-label text-text-muted flex items-center gap-2">
                <span>01</span>
                <span>Account</span>
              </h2>

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
                <p className="text-xs text-text-muted">
                  Must end with @stu.ui.edu.ng
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Personal Info Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-label text-text-muted flex items-center gap-2">
                <span>02</span>
                <span>Personal Info</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
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
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required
                    className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-label-sm text-text-muted">
                  Matric Number
                </label>
                <input
                  type="text"
                  value={matricNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setMatricNumber(value);
                  }}
                  placeholder="236856"
                  required
                  maxLength={6}
                  className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
                />
                <p className="text-xs text-text-muted">6 digits only</p>
              </div>

              <div className="space-y-2">
                <label className="text-label-sm text-text-muted">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 812 345 6789"
                  required
                  className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
                />
              </div>
            </div>

            {/* Academic Info Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-label text-text-muted flex items-center gap-2">
                <span>03</span>
                <span>Academic Info</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    Current Level
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    aria-label="Current Level"
                    className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
                  >
                    <option value="100L">100 Level</option>
                    <option value="200L">200 Level</option>
                    <option value="300L">300 Level</option>
                    <option value="400L">400 Level</option>
                    <option value="500L">500 Level</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    Admission Year
                  </label>
                  <input
                    type="number"
                    value={admissionYear}
                    onChange={(e) => setAdmissionYear(e.target.value)}
                    min={new Date().getFullYear() - 6}
                    max={new Date().getFullYear()}
                    placeholder="2024"
                    required
                    className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
                  />
                </div>
              </div>
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
              disabled={isSubmitting}
              className="btn-editorial btn-editorial-plus w-full disabled:opacity-50"
            >
              {isSubmitting ? "Creating Account..." : "+ Create Account +"}
            </button>
          </form>

          {/* Links */}
          <div className="pt-6 border-t border-border space-y-4">
            <p className="text-body text-text-secondary text-center">
              Already have an account?{" "}
              <Link href="/login" className="text-text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          {/* Help Info */}
          <div className="page-frame p-4">
            <div className="flex items-start gap-3">
              <span className="text-text-muted">◆</span>
              <p className="text-sm text-text-secondary">
                Use your institutional email ending with{" "}
                <strong className="text-text-primary">@stu.ui.edu.ng</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
