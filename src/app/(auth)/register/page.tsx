"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading, signUpWithEmail } = useAuth();

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

  const validateForm = (): boolean => {
    setError("");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) { setError("Email is required"); return false; }
    if (!emailRegex.test(email)) { setError("Please enter a valid email address"); return false; }
    if (!password) { setError("Password is required"); return false; }
    if (password.length < 8) { setError("Password must be at least 8 characters with uppercase, lowercase, and a number"); return false; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return false; }
    if (!firstName.trim()) { setError("First name is required"); return false; }
    if (!lastName.trim()) { setError("Last name is required"); return false; }
    if (!matricNumber.trim()) { setError("Matric number is required"); return false; }
    if (!/^\d{6}$/.test(matricNumber)) { setError("Matric number must be exactly 6 digits"); return false; }
    if (!phone.trim()) { setError("Phone number is required"); return false; }
    if (!/^(\+234|0)[789]\d{9}$/.test(phone)) { setError("Invalid Nigerian phone number"); return false; }
    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await signUpWithEmail(email, password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        matricNumber: matricNumber.trim(),
        phone: phone.trim(),
        level,
        admissionYear: parseInt(admissionYear),
      });
      toast.success("Account created!", { description: "Verification email sent. Check your inbox." });
    } catch (err: unknown) {
      console.error("Registration error:", err);
      const msg = err instanceof Error ? err.message || "Registration failed. Please try again." : "An unexpected error occurred. Please try again.";
      setError(msg);
      toast.error("Registration failed", { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ghost">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-navy border-t-transparent"></div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-3.5 bg-snow border-[3px] border-navy rounded-2xl text-navy font-display font-normal placeholder:text-slate focus:outline-none focus:border-lime focus:shadow-[3px_3px_0_0_#C8F31D] transition-all";

  return (
    <div className="min-h-screen bg-ghost flex">
      {/* Left - Decorative Section */}
      <div className="hidden lg:flex w-2/5 bg-navy items-center justify-center relative overflow-hidden rounded-r-[2rem]">
        <div className="absolute inset-0 bg-dots opacity-20 pointer-events-none" />

        {/* Diamond Sparkles */}
        <svg className="absolute top-16 left-[12%] w-5 h-5 text-lime/20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="absolute bottom-24 right-[15%] w-4 h-4 text-coral/15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="absolute top-[60%] left-[8%] w-3 h-3 text-sunny/20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>

        <div className="relative z-10 max-w-sm p-12 space-y-8">
          <div className="space-y-4">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-lime/60 flex items-center gap-2">
              <span>&#10022;</span> Join IESA
            </span>
            <h2 className="font-display font-black text-3xl md:text-4xl text-snow">
              Create Your Account
            </h2>
            <p className="font-display font-normal text-snow/70 leading-relaxed">
              Join the Industrial Engineering Students&apos; Association and access exclusive resources.
            </p>
          </div>

          <div className="space-y-4">
            {["Access course materials", "Stay updated with events", "Connect with peers", "Track your progress"].map((benefit, i) => (
              <div key={i} className="flex items-center gap-3 text-snow/80">
                <span className="text-lime/40">&#9670;</span>
                <span className="font-display font-normal text-sm">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-snow/20">
            <p className="font-display font-bold text-xs uppercase tracking-wider text-snow/50">University of Ibadan, Nigeria</p>
          </div>
        </div>
      </div>

      {/* Right - Form Section */}
      <main id="main-content" className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-xl space-y-8 py-8">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <Image src="/assets/images/logo.svg" alt="IESA Logo" width={40} height={40} className="object-contain" />
            </div>
            <span className="font-display font-black text-xl text-navy">IESA</span>
          </Link>

          {/* Header */}
          <div className="space-y-2">
            <h1 className="font-display font-black text-2xl md:text-3xl text-navy">Create Account</h1>
            <p className="font-display font-normal text-navy/60">Register with any email you own</p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-8">
            {/* Account Section */}
            <div className="space-y-4">
              <h2 className="font-display font-bold text-xs text-slate uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-lime border-[2px] border-navy flex items-center justify-center text-xs font-bold text-navy">1</span>
                <span>Account</span>
              </h2>

              <div className="space-y-2">
                <label htmlFor="register-email" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Email</label>
                <input id="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@stu.ui.edu.ng" required className={inputClass} />
                <p className="text-xs text-slate">Must end with @stu.ui.edu.ng</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="register-password" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Password</label>
                  <input id="register-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} className={inputClass} />
                  <p className="text-xs text-slate">Min 8 chars, uppercase, lowercase & number</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="register-confirm-password" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Confirm Password</label>
                  <input id="register-confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={8} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Personal Info Section */}
            <div className="space-y-4 pt-4 border-t-[3px] border-cloud">
              <h2 className="font-display font-bold text-xs text-slate uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-lavender border-[2px] border-navy flex items-center justify-center text-xs font-bold text-navy">2</span>
                <span>Personal Info</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="register-first-name" className="font-display font-bold text-xs uppercase tracking-wider text-slate">First Name</label>
                  <input id="register-first-name" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" required className={inputClass} />
                </div>
                <div className="space-y-2">
                  <label htmlFor="register-last-name" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Last Name</label>
                  <input id="register-last-name" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" required className={inputClass} />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="register-matric-number" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Matric Number</label>
                <input id="register-matric-number" type="text" value={matricNumber} onChange={(e) => { const value = e.target.value.replace(/\D/g, "").slice(0, 6); setMatricNumber(value); }} placeholder="236856" required maxLength={6} className={inputClass} />
                <p className="text-xs text-slate">6 digits only</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="register-phone" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Phone Number</label>
                <input id="register-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 812 345 6789" required className={inputClass} />
              </div>
            </div>

            {/* Academic Info Section */}
            <div className="space-y-4 pt-4 border-t-[3px] border-cloud">
              <h2 className="font-display font-bold text-xs text-slate uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-teal border-[2px] border-navy flex items-center justify-center text-xs font-bold text-navy">3</span>
                <span>Academic Info</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="register-level" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Current Level</label>
                  <select id="register-level" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Current Level" className={inputClass}>
                    <option value="100L">100 Level</option>
                    <option value="200L">200 Level</option>
                    <option value="300L">300 Level</option>
                    <option value="400L">400 Level</option>
                    <option value="500L">500 Level</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="register-admission-year" className="font-display font-bold text-xs uppercase tracking-wider text-slate">Admission Year</label>
                  <input id="register-admission-year" type="number" value={admissionYear} onChange={(e) => setAdmissionYear(e.target.value)} min={new Date().getFullYear() - 6} max={new Date().getFullYear()} placeholder="2024" required className={inputClass} />
                </div>
              </div>
            </div>

            {error && (
              <div role="alert" className="p-4 border-[3px] border-coral bg-coral-light text-coral text-sm rounded-2xl font-medium">
                {error}
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="w-full py-3.5 bg-lime border-[3px] border-navy rounded-2xl press-3 press-navy font-display font-black text-navy transition-all disabled:opacity-50">
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          {/* Links */}
          <div className="pt-6 border-t-[3px] border-cloud">
            <p className="font-display font-normal text-navy/60 text-center">
              Already have an account?{" "}
              <Link href="/login" className="text-navy font-bold hover:underline">Sign in</Link>
            </p>
          </div>

          {/* Help Info */}
          <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[3px_3px_0_0_#000]">
            <div className="flex items-start gap-3">
              <span className="text-teal">&#9670;</span>
              <p className="text-sm text-navy/60">
                You can register with any email you own — institutional or personal.
                A verification email will be sent after registration.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
