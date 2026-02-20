"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

export default function StudentLoginPage() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      console.error("Login error:", err);
      if (err instanceof Error) {
        setError(err.message || "Failed to login");
      } else {
        setError("Failed to login");
      }
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
            <div className="w-10 h-10 rounded-2xl bg-lime border-[3px] border-navy shadow-[3px_3px_0_0_#000] flex items-center justify-center">
              <span className="text-navy font-display font-black text-sm">IE</span>
            </div>
            <span className="font-display font-black text-xl text-navy">IESA</span>
          </Link>

          {/* Header */}
          <div className="space-y-3">
            <h1 className="font-display font-black text-2xl md:text-3xl text-navy">Welcome Back</h1>
            <p className="font-display font-normal text-navy/60">
              Sign in to access your student dashboard
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="login-email" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@stu.ui.edu.ng"
                required
                className="w-full px-4 py-3.5 bg-snow border-[3px] border-navy rounded-2xl text-navy font-display font-normal placeholder:text-slate focus:outline-none focus:border-lime focus:shadow-[3px_3px_0_0_#C8F31D] transition-all"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3.5 bg-snow border-[3px] border-navy rounded-2xl text-navy font-display font-normal placeholder:text-slate focus:outline-none focus:border-lime focus:shadow-[3px_3px_0_0_#C8F31D] transition-all"
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
              className="w-full py-3.5 bg-lime border-[3px] border-navy rounded-2xl shadow-[4px_4px_0_0_#0F0F2D] font-display font-black text-navy hover:shadow-[6px_6px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all disabled:opacity-50"
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
        </div>
      </main>

      {/* Right - Decorative Section */}
      <div className="hidden lg:flex flex-1 bg-navy items-center justify-center relative overflow-hidden rounded-l-[2rem]">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-dots opacity-20 pointer-events-none" />

        {/* Diamond Sparkles */}
        <svg className="absolute top-12 right-[15%] w-5 h-5 text-lime/20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="absolute bottom-20 left-[10%] w-4 h-4 text-coral/15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="absolute top-[40%] right-[8%] w-3 h-3 text-sunny/20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>

        {/* Decorative Content */}
        <div className="relative z-10 max-w-md p-12 text-center space-y-8">
          <div className="space-y-4">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-lime/60 flex items-center justify-center gap-2">
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
                <span className="text-lime/40">&#9670;</span>
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
