"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function IDCardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/student-document`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to generate ID card");
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "IESA_ID_Card.pdf";
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
          contentDisposition
        );
        if (matches?.[1]) {
          filename = matches[1].replace(/['"]/g, "");
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading ID card:", error);
      alert("Failed to download ID card. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/student-document/view`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to preview ID card");
      }

      const blob = await response.blob();
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(pdfBlob);
      setPreviewUrl(url);
    } catch (error) {
      console.error("Error previewing ID card:", error);
      alert("Failed to preview ID card. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-load preview on mount
  useEffect(() => {
    if (user && !previewUrl) {
      handlePreview();
    }
  }, [user]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-[var(--foreground)] mb-2">
          Digital ID Card
        </h1>
        <p className="text-[var(--foreground)] opacity-70">
          Your official IESA student identification card
        </p>
      </div>

      {/* Card Preview & Actions */}
      <div className="max-w-4xl mx-auto">
        {/* ID Card Preview */}
        <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-8 mb-6">
          <h2 className="text-xl font-heading font-semibold mb-6 text-[var(--foreground)]">
            ID Card Preview
          </h2>

          {loading && !previewUrl ? (
            <div className="flex items-center justify-center h-96 rounded-lg bg-[var(--background)] border-2 border-dashed border-[var(--glass-border)]">
              <div className="text-center">
                <div className="inline-block w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-[var(--foreground)] opacity-70">
                  Generating your ID card...
                </p>
              </div>
            </div>
          ) : previewUrl ? (
            <div className="flex justify-center">
              <embed
                src={previewUrl}
                type="application/pdf"
                className="w-full h-96 rounded-lg border-2 border-[var(--glass-border)]"
                title="ID Card Preview"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 rounded-lg bg-[var(--background)] border-2 border-dashed border-[var(--glass-border)]">
              <p className="text-[var(--foreground)] opacity-50">
                Preview will load automatically
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={loading}
            className="flex items-center justify-center gap-3 px-6 py-4 rounded-lg bg-[var(--primary)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {loading ? "Generating..." : "Download ID Card"}
          </button>

          {/* Refresh Preview Button */}
          <button
            onClick={handlePreview}
            disabled={loading}
            className="flex items-center justify-center gap-3 px-6 py-4 rounded-lg bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] text-[var(--foreground)] font-semibold hover:bg-[var(--glass-bg)]/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh Preview
          </button>
        </div>

        {/* Information Card */}
        <div className="mt-6 rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-6">
          <h3 className="text-lg font-heading font-semibold mb-4 text-[var(--foreground)]">
            About Your ID Card
          </h3>
          <div className="space-y-3 text-sm text-[var(--foreground)] opacity-80">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-[var(--primary)] mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p>
                Your ID card contains a QR code for quick verification at IESA
                events and activities.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-[var(--primary)] mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p>
                The card displays your current payment status. Ensure your dues
                are paid for full access.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-[var(--primary)] mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <p>
                Download your ID card as a PDF file and keep it on your device
                for offline access.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-[var(--primary)] mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <p>
                This is your official student identification. Do not share it
                with unauthorized individuals.
              </p>
            </div>
          </div>
        </div>

        {/* Student Info */}
        <div className="mt-6 rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-6">
          <h3 className="text-lg font-heading font-semibold mb-4 text-[var(--foreground)]">
            Your Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-[var(--foreground)] opacity-60 mb-1">
                Name
              </p>
              <p className="font-medium text-[var(--foreground)]">
                {user?.displayName || "Not Set"}
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--foreground)] opacity-60 mb-1">
                Email
              </p>
              <p className="font-medium text-[var(--foreground)]">
                {user?.email || "Not Set"}
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-lg bg-[var(--background)] border border-[var(--glass-border)]">
            <p className="text-sm text-[var(--foreground)] opacity-70">
              <strong>Note:</strong> To update your photo or personal
              information, please visit the{" "}
              <a
                href="/dashboard/profile"
                className="text-[var(--primary)] hover:underline"
              >
                Profile
              </a>{" "}
              page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
