"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"verifying" | "success" | "error" | "already-verified">("verifying");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No verification token provided");
      return;
    }

    const verifyEmail = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/v1/auth/verify-email?token=${token}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Verification failed");
        }

        if (data.alreadyVerified) {
          setStatus("already-verified");
        } else {
          setStatus("success");
        }
      } catch (error: unknown) {
        console.error("Verification error:", error);
        setStatus("error");
        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to verify email. Please try again.");
        }
      }
    };

    verifyEmail();
  }, [token]);

  const handleGoToLogin = () => {
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-ghost flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-lime border-[3px] border-navy shadow-[3px_3px_0_0_#000] flex items-center justify-center overflow-hidden">
            <Image src="/assets/images/logo.svg" alt="IESA Logo" width={28} height={28} className="object-contain" />
          </div>
          <span className="font-display font-black text-xl text-navy">IESA</span>
        </Link>

        {/* Card */}
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-8 shadow-[3px_3px_0_0_#000]">
          {status === "verifying" && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-navy border-t-transparent"></div>
              </div>
              <div className="space-y-2">
                <h1 className="font-display font-black text-2xl text-navy">Verifying Email</h1>
                <p className="font-display font-normal text-navy/60">Please wait while we verify your email address...</p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-teal border-[4px] border-navy flex items-center justify-center">
                  <svg className="w-8 h-8 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="font-display font-black text-2xl text-navy">Email Verified!</h1>
                <p className="font-display font-normal text-navy/60">Your email has been successfully verified. You can now log in to your account.</p>
              </div>
              <button
                onClick={handleGoToLogin}
                className="w-full bg-lime border-[4px] border-navy press-3 press-navy px-8 py-4 rounded-2xl font-display font-bold text-lg text-navy transition-all"
              >
                Go to Login
              </button>
            </div>
          )}

          {status === "already-verified" && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-sunny border-[4px] border-navy flex items-center justify-center">
                  <svg className="w-8 h-8 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="font-display font-black text-2xl text-navy">Already Verified</h1>
                <p className="font-display font-normal text-navy/60">This email address has already been verified. You can log in to your account.</p>
              </div>
              <button
                onClick={handleGoToLogin}
                className="w-full bg-lime border-[4px] border-navy press-3 press-navy px-8 py-4 rounded-2xl font-display font-bold text-lg text-navy transition-all"
              >
                Go to Login
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-coral border-[4px] border-navy flex items-center justify-center">
                  <svg className="w-8 h-8 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="font-display font-black text-2xl text-navy">Verification Failed</h1>
                <p className="font-display font-normal text-navy/60">{errorMessage || "Failed to verify email. The link may have expired."}</p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => router.push("/register")}
                  className="w-full bg-lime border-[4px] border-navy press-3 press-navy px-8 py-4 rounded-2xl font-display font-bold text-lg text-navy transition-all"
                >
                  Register Again
                </button>
                <Link
                  href="/login"
                  className="block w-full bg-transparent border-[3px] border-navy px-8 py-3 rounded-xl font-display font-bold text-base text-navy hover:bg-navy hover:text-lime transition-all text-center"
                >
                  Back to Login
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center font-display font-normal text-sm text-navy/60">
          Need help? <Link href="/contact" className="text-lime hover:underline">Contact support</Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-ghost">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-navy border-t-lime animate-spin mx-auto mb-4" />
          <p className="font-display font-bold text-navy">Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}