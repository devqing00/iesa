"use client";

/**
 * Verify Email Page
 *
 * Primary email verification is now handled by Firebase Auth.
 * This page informs users and redirects them to login.
 * The verify-secondary-email page still uses the custom backend flow.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function VerifyEmailPage() {
  const router = useRouter();

  useEffect(() => {
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>

          <div className="space-y-3">
            <h1 className="font-display font-black text-2xl text-navy">Email Verification</h1>
            <p className="font-display font-normal text-navy/60">
              Email verification is handled automatically. Check your inbox for a verification link from Firebase, then sign in.
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

        <p className="font-display font-normal text-sm text-navy/60">
          Need help? <Link href="/contact" className="text-navy hover:underline">Contact support</Link>
        </p>
      </main>
    </div>
  );
}