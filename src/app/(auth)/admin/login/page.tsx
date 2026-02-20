"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function AdminLoginPage() {
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
      console.error("Admin login error:", err);
      if (err instanceof Error) {
        setError(err.message || "Failed to login");
      } else {
        setError("Failed to login");
      }
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3.5 bg-snow border-[3px] border-navy rounded-2xl text-navy font-display font-normal placeholder:text-slate focus:outline-none focus:border-lime focus:shadow-[3px_3px_0_0_#C8F31D] transition-all";

  return (
    <div className="min-h-screen bg-ghost flex">
      {/* Left - Decorative Section (Admin themed) */}
      <div className="hidden lg:flex flex-1 bg-navy items-center justify-center relative overflow-hidden rounded-r-[2rem]">
        <div className="absolute inset-0 bg-cross-grid opacity-20 pointer-events-none" />

        {/* Diamond Sparkles */}
        <svg className="absolute top-12 right-[15%] w-5 h-5 text-coral/20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="absolute bottom-20 left-[10%] w-4 h-4 text-lime/15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>

        <div className="relative z-10 max-w-md p-12 text-center space-y-8">
          <div className="space-y-4">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-lime/60 flex items-center justify-center gap-2">
              <span>&#10022;</span> Administrator Access
            </span>
            <h2 className="font-display font-black text-3xl md:text-4xl text-snow">Admin Portal</h2>
            <p className="font-display font-normal text-snow/70 leading-relaxed">
              Manage students, announcements, events, and platform settings.
            </p>
          </div>

          <div className="space-y-4 text-left">
            {["Student management", "Payment verification", "Announcements & events", "Platform analytics"].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-snow/80">
                <span className="text-lime/40">&#9670;</span>
                <span className="font-display font-normal text-sm">{feature}</span>
              </div>
            ))}
          </div>

          {/* Warning */}
          <div className="p-4 border-[3px] border-lime/30 rounded-2xl space-y-2">
            <p className="font-display font-bold text-xs uppercase tracking-wider text-lime/60 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              Restricted Access
            </p>
            <p className="text-xs text-snow/50">This portal is for authorized administrators only.</p>
          </div>

          <div className="pt-8 border-t border-snow/20">
            <p className="font-display font-bold text-xs uppercase tracking-wider text-snow/50">University of Ibadan, Nigeria</p>
          </div>
        </div>
      </div>

      {/* Right - Form Section */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-coral border-[3px] border-navy shadow-[3px_3px_0_0_#000] flex items-center justify-center">
              <span className="text-snow font-display font-black text-sm">IE</span>
            </div>
            <span className="font-display font-black text-xl text-navy">IESA</span>
          </Link>

          {/* Header */}
          <div className="space-y-2">
            <h1 className="font-display font-black text-2xl md:text-3xl text-navy">Administrator Login</h1>
            <p className="font-display font-normal text-navy/60">Sign in to manage the platform</p>
          </div>

          {/* Info Card */}
          <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[4px_4px_0_0_#000]">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-slate shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <p className="text-sm text-navy/60">
                <strong className="text-navy font-bold">Admin access only.</strong>{" "}
                Contact an existing admin to get your account promoted.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="font-display font-bold text-xs uppercase tracking-wider text-slate">Admin Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@iesa.ui.edu.ng" required className={inputClass} />
            </div>

            <div className="space-y-2">
              <label className="font-display font-bold text-xs uppercase tracking-wider text-slate">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className={inputClass} />
            </div>

            {error && (
              <div role="alert" className="p-4 border-[3px] border-coral bg-coral-light text-coral text-sm rounded-2xl font-medium">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full py-3.5 bg-lime border-[3px] border-navy rounded-2xl shadow-[4px_4px_0_0_#0F0F2D] font-display font-black text-navy hover:shadow-[6px_6px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all disabled:opacity-50">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Links */}
          <div className="pt-6 border-t-[3px] border-cloud space-y-4">
            <p className="font-display font-normal text-navy/60 text-center text-sm">
              Only users promoted to admin by an existing administrator can access this portal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
