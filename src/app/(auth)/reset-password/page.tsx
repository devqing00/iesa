"use client";

/**
 * Reset Password Page
 *
 * Firebase handles password reset via its own action URL.
 * This page now simply redirects users to the login page
 * with an informational message.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function ResetPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to login after a short delay
    const timer = setTimeout(() => router.push("/login"), 5000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-ghost flex items-center justify-center p-8">
      <main id="main-content" className="w-full max-w-md space-y-8 text-center">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center justify-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <Image src="/assets/images/logo.svg" alt="IESA Logo" width={40} height={40} className="object-contain" />
          </div>
          <span className="font-display font-black text-xl text-navy">IESA</span>
        </Link>

        <div className="bg-snow border-[4px] border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000] space-y-6">
          <div className="w-16 h-16 mx-auto bg-teal-light border-[3px] border-navy rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>

          <div className="space-y-3">
            <h1 className="font-display font-black text-2xl text-navy">Password Reset</h1>
            <p className="font-display font-normal text-navy/60">
              Password reset is handled via the link in your email. Use the &quot;Forgot password?&quot; option on the login page to request a reset link.
            </p>
          </div>

          <Link
            href="/login"
            className="inline-block py-3.5 px-8 bg-lime border-[3px] border-navy rounded-2xl press-3 press-navy font-display font-black text-navy transition-all"
          >
            Go to Login
          </Link>

          <p className="text-xs text-slate">Redirecting automatically in 5 seconds...</p>
        </div>
      </main>
    </div>
  );
}
