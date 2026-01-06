"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { getApiUrl } from "@/lib/api";

export default function IDCardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [studentData, setStudentData] = useState<{
    full_name?: string;
    matric_number?: string;
    level?: string;
    session?: string;
    department?: string;
    payment_status?: string;
    profilePicture?: string;
  } | null>(null);
  const [cardFlipped, setCardFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!user) return;

    try {
      setDownloading(true);
      const token = await user.getIdToken();

      const response = await fetch(getApiUrl("/api/v1/student-document"), {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to generate ID card");
      }

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
      setDownloading(false);
    }
  };

  const fetchStudentData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      const response = await fetch(getApiUrl("/api/users/me"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setStudentData({
          full_name:
            `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
            data.displayName,
          matric_number: data.matricNumber,
          level: data.currentLevel,
          session: data.admissionYear
            ? `${data.admissionYear}/${data.admissionYear + 1}`
            : "2025/2026",
          department: data.department || "Industrial Engineering",
          payment_status: data.paymentStatus || "Not Paid",
          profilePicture: data.profilePicture,
        });
      }
    } catch (error) {
      console.error("Error fetching student data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStudentData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const isPaid = studentData?.payment_status?.toLowerCase() === "paid";
  const currentYear = new Date().getFullYear();
  const validityYear = `${currentYear}/${currentYear + 1}`;

  return (
    <div className="min-h-screen bg-bg-primary">
      <DashboardHeader title="Digital ID Card" />

      <div className="px-4 md:px-8 py-6 pb-24 md:pb-8 max-w-5xl mx-auto">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-label-sm text-text-muted hover:text-text-primary transition-colors mb-6 group"
        >
          <svg
            className="w-4 h-4 group-hover:-translate-x-1 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back to Dashboard
        </Link>

        {/* Header Section */}
        <section className="border-t border-border pt-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-charcoal dark:bg-cream flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-cream dark:text-charcoal"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl text-text-primary">
                  Your Digital ID
                </h2>
                <p className="text-label-sm text-text-muted">
                  Official IESA Student Identification
                </p>
              </div>
            </div>
            <span className="page-number hidden md:block">Page 01</span>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <div className="border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-4 h-4 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
                <span className="text-label-sm text-text-muted">Status</span>
              </div>
              <p className="font-display text-lg text-text-primary">Active</p>
            </div>
            <div className="border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-4 h-4 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-label-sm text-text-muted">Verified</span>
              </div>
              <p className="font-display text-lg text-text-primary">Yes</p>
            </div>
            <div className="border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-4 h-4 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
                <span className="text-label-sm text-text-muted">Format</span>
              </div>
              <p className="font-display text-lg text-text-primary">PDF</p>
            </div>
          </div>
        </section>

        {/* ID Card Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-text-primary flex items-center gap-2">
              <span>◆</span> Card Preview
            </h2>
            <button
              onClick={() => setCardFlipped(!cardFlipped)}
              className="text-label-sm text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2"
            >
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
                  d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
              </svg>
              {cardFlipped ? "View Front" : "View Back"}
            </button>
          </div>

          {/* Card Container with 3D perspective */}
          <div className="flex justify-center perspective-1000">
            {loading && !studentData ? (
              <div className="w-full max-w-[420px] aspect-[1.586/1] border border-border flex items-center justify-center">
                <div className="text-center">
                  <div className="w-10 h-10 border-2 border-charcoal dark:border-cream border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-label-sm text-text-muted">
                    Loading your ID...
                  </p>
                </div>
              </div>
            ) : (
              <div
                ref={cardRef}
                className="relative w-full max-w-[420px] aspect-[1.586/1] transition-transform duration-700 preserve-3d cursor-pointer"
                style={{
                  transform: cardFlipped ? "rotateY(180deg)" : "rotateY(0)",
                }}
                onClick={() => setCardFlipped(!cardFlipped)}
              >
                {/* Front of Card */}
                <div className="absolute inset-0 backface-hidden">
                  <div className="relative w-full h-full overflow-hidden border-2 border-charcoal">
                    {/* Background */}
                    <div className="absolute inset-0 bg-cream" />

                    {/* Grid pattern */}
                    <div className="absolute inset-0 opacity-10">
                      <svg
                        className="w-full h-full"
                        viewBox="0 0 400 250"
                        preserveAspectRatio="xMidYMid slice"
                      >
                        <defs>
                          <pattern
                            id="grid"
                            width="20"
                            height="20"
                            patternUnits="userSpaceOnUse"
                          >
                            <path
                              d="M 20 0 L 0 0 0 20"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="0.5"
                              className="stroke-charcoal"
                            />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                      </svg>
                    </div>

                    {/* Content */}
                    <div className="relative h-full p-5 md:p-6 flex flex-col">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 md:w-11 md:h-11 border border-charcoal/30 flex items-center justify-center">
                            <span className="text-charcoal font-display text-sm md:text-base tracking-tight">
                              IE
                            </span>
                          </div>
                          <div>
                            <h3 className="text-charcoal font-display text-base md:text-lg leading-none">
                              IESA
                            </h3>
                            <p className="text-charcoal/50 text-[9px] md:text-[10px] uppercase tracking-[0.2em] mt-0.5">
                              Student Identity
                            </p>
                          </div>
                        </div>

                        {/* QR Code */}
                        <div className="w-14 h-14 md:w-16 md:h-16 bg-charcoal p-1.5">
                          <div className="w-full h-full bg-charcoal flex items-center justify-center relative overflow-hidden">
                            <svg
                              viewBox="0 0 100 100"
                              className="w-full h-full p-1"
                            >
                              <rect
                                x="10"
                                y="10"
                                width="25"
                                height="25"
                                className="fill-cream"
                              />
                              <rect
                                x="65"
                                y="10"
                                width="25"
                                height="25"
                                className="fill-cream"
                              />
                              <rect
                                x="10"
                                y="65"
                                width="25"
                                height="25"
                                className="fill-cream"
                              />
                              <rect
                                x="15"
                                y="15"
                                width="15"
                                height="15"
                                className="fill-charcoal"
                              />
                              <rect
                                x="70"
                                y="15"
                                width="15"
                                height="15"
                                className="fill-charcoal"
                              />
                              <rect
                                x="15"
                                y="70"
                                width="15"
                                height="15"
                                className="fill-charcoal"
                              />
                              <rect
                                x="18"
                                y="18"
                                width="9"
                                height="9"
                                className="fill-cream"
                              />
                              <rect
                                x="73"
                                y="18"
                                width="9"
                                height="9"
                                className="fill-cream"
                              />
                              <rect
                                x="18"
                                y="73"
                                width="9"
                                height="9"
                                className="fill-cream"
                              />
                              <rect
                                x="40"
                                y="40"
                                width="20"
                                height="20"
                                className="fill-cream"
                              />
                              <rect
                                x="45"
                                y="45"
                                width="10"
                                height="10"
                                className="fill-charcoal"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 flex gap-4">
                        {/* Photo */}
                        <div className="relative">
                          <div className="w-20 h-24 md:w-[88px] md:h-[106px] border border-charcoal/30 overflow-hidden flex-shrink-0">
                            {studentData?.profilePicture || user?.photoURL ? (
                              <img
                                src={
                                  studentData?.profilePicture ||
                                  user?.photoURL ||
                                  ""
                                }
                                alt="Student"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-charcoal/10">
                                <svg
                                  className="w-8 h-8 md:w-10 md:h-10 text-charcoal/40"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={1.5}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 flex flex-col justify-center min-w-0">
                          <div className="mb-2.5">
                            <p className="text-charcoal/40 text-[8px] md:text-[9px] uppercase tracking-[0.15em] mb-0.5">
                              Full Name
                            </p>
                            <p className="text-charcoal font-display text-sm md:text-base leading-tight truncate">
                              {studentData?.full_name ||
                                user?.displayName ||
                                "Student Name"}
                            </p>
                          </div>

                          <div className="mb-2.5">
                            <p className="text-charcoal/40 text-[8px] md:text-[9px] uppercase tracking-[0.15em] mb-0.5">
                              Matric Number
                            </p>
                            <p className="text-charcoal text-xs md:text-sm tracking-wide">
                              {studentData?.matric_number || "N/A"}
                            </p>
                          </div>

                          <div className="flex gap-4">
                            <div>
                              <p className="text-charcoal/40 text-[8px] md:text-[9px] uppercase tracking-[0.15em] mb-0.5">
                                Level
                              </p>
                              <p className="text-charcoal text-xs md:text-sm">
                                {studentData?.level || "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-charcoal/40 text-[8px] md:text-[9px] uppercase tracking-[0.15em] mb-0.5">
                                Session
                              </p>
                              <p className="text-charcoal text-xs md:text-sm">
                                {studentData?.session || validityYear}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-auto pt-3 border-t border-charcoal/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`relative w-2.5 h-2.5 rounded-full ${
                              isPaid ? "bg-green-400" : "bg-red-400"
                            }`}
                          >
                            <div
                              className={`absolute inset-0 rounded-full ${
                                isPaid ? "bg-green-400" : "bg-red-400"
                              } animate-ping opacity-75`}
                            />
                          </div>
                          <span
                            className={`text-[10px] md:text-xs ${
                              isPaid ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {isPaid ? "Dues Paid" : "Payment Pending"}
                          </span>
                        </div>
                        <p className="text-charcoal/40 text-[9px] md:text-[10px]">
                          Valid: {validityYear}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Back of Card */}
                <div className="absolute inset-0 backface-hidden rotate-y-180">
                  <div className="relative w-full h-full overflow-hidden border-2 border-charcoal">
                    {/* Background */}
                    <div className="absolute inset-0 bg-cream" />

                    {/* Dot pattern */}
                    <div className="absolute inset-0 opacity-5">
                      <svg
                        className="w-full h-full"
                        viewBox="0 0 400 250"
                        preserveAspectRatio="xMidYMid slice"
                      >
                        <defs>
                          <pattern
                            id="dots"
                            width="15"
                            height="15"
                            patternUnits="userSpaceOnUse"
                          >
                            <circle
                              cx="7.5"
                              cy="7.5"
                              r="1"
                              className="fill-charcoal"
                            />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#dots)" />
                      </svg>
                    </div>

                    {/* Content */}
                    <div className="relative h-full p-5 md:p-6 flex flex-col">
                      {/* Magnetic stripe simulation */}
                      <div className="w-full h-10 md:h-12 bg-charcoal/10 mb-4" />

                      {/* Info blocks */}
                      <div className="flex-1 space-y-3">
                        <div className="bg-charcoal/5 border border-charcoal/10 p-3">
                          <p className="text-charcoal/40 text-[9px] uppercase tracking-wider mb-1">
                            Department
                          </p>
                          <p className="text-charcoal text-sm">
                            {studentData?.department ||
                              "Industrial Engineering"}
                          </p>
                        </div>

                        <div className="bg-charcoal/5 border border-charcoal/10 p-3">
                          <p className="text-charcoal/40 text-[9px] uppercase tracking-wider mb-1">
                            Card ID
                          </p>
                          <p className="text-charcoal/80 text-xs font-mono tracking-wider">
                            IESA-{new Date().getFullYear()}-
                            {Math.random()
                              .toString(36)
                              .substring(2, 8)
                              .toUpperCase()}
                          </p>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="pt-3 border-t border-charcoal/10 text-center">
                        <p className="text-charcoal/30 text-[8px] md:text-[9px] leading-relaxed">
                          This card is the property of IESA. If found, please
                          return to the Industrial Engineering Students&apos;
                          Association office.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-label-sm text-text-muted mt-3">
            Click card to flip
          </p>
        </section>

        {/* Action Buttons */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-8">
          <button
            onClick={handleDownload}
            disabled={downloading || loading}
            className="flex items-center justify-center gap-2.5 px-5 py-4 bg-charcoal dark:bg-cream text-cream dark:text-charcoal text-label-sm hover:bg-charcoal-light dark:hover:bg-cream-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <>
                <svg
                  className="w-5 h-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Generating PDF...
              </>
            ) : (
              <>
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
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                Download as PDF
              </>
            )}
          </button>

          <button
            onClick={fetchStudentData}
            disabled={loading}
            className="flex items-center justify-center gap-2.5 px-5 py-4 border border-border text-text-secondary text-label-sm hover:border-border-dark hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            {loading ? "Refreshing..." : "Refresh Data"}
          </button>
        </section>

        {/* Features Grid */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-label-sm text-text-muted">✦</span>
            <h2 className="text-label-sm text-text-muted">Card Features</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-border p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 border border-border flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-sm text-text-primary mb-1">
                    QR Verification
                  </h3>
                  <p className="text-body text-sm text-text-secondary">
                    Scannable QR code for instant identity verification at IESA
                    events.
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-border p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 border border-border flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-green-600 dark:text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-sm text-text-primary mb-1">
                    Payment Status
                  </h3>
                  <p className="text-body text-sm text-text-secondary">
                    Dues payment status is displayed and verified in real-time.
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-border p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 border border-border flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-sm text-text-primary mb-1">
                    PDF Download
                  </h3>
                  <p className="text-body text-sm text-text-secondary">
                    Download a high-quality PDF version for printing or offline
                    access.
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-border p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 border border-border flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-sm text-text-primary mb-1">
                    Secure & Official
                  </h3>
                  <p className="text-body text-sm text-text-secondary">
                    Official IESA identification. Keep it secure and do not
                    share.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Profile Update Notice */}
        <section className="border border-border p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-charcoal dark:bg-cream flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5 text-cream dark:text-charcoal"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-sm text-text-primary mb-1">
                Update Your Information
              </h3>
              <p className="text-body text-sm text-text-secondary mb-3">
                To update your photo or personal details displayed on your ID
                card, visit your profile settings.
              </p>
              <Link
                href="/dashboard/profile"
                className="inline-flex items-center gap-2 text-label-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Go to Profile
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
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* CSS for 3D card flip */}
      <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
}
