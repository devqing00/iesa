"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { AnnouncementAttachment } from "@/lib/api/types";

interface SampleStudent {
  firstName: string;
  lastName: string;
  matricNumber: string;
  currentLevel: string;
  department: string;
}

const SAMPLE_STUDENTS: SampleStudent[] = [
  {
    firstName: "Alex",
    lastName: "Adetayo",
    matricNumber: "219800",
    currentLevel: "400L",
    department: "Industrial Engineering",
  },
  {
    firstName: "Chioma",
    lastName: "Eze",
    matricNumber: "230412",
    currentLevel: "100L",
    department: "Industrial Engineering",
  },
  {
    firstName: "Ibrahim",
    lastName: "Danladi",
    matricNumber: "224510",
    currentLevel: "300L",
    department: "Mechanical Engineering",
  },
];

interface AnnouncementPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  priority: string;
  targetAudience?: string;
  audience?: string;
  targetLevels?: string[];
  attachments: AnnouncementAttachment[];
  scheduledFor?: string | null;
}

export default function AnnouncementPreviewModal({
  isOpen,
  onClose,
  title,
  content,
  priority,
  targetAudience,
  audience,
  targetLevels = [],
  attachments = [],
  scheduledFor,
}: AnnouncementPreviewModalProps) {
  const effectiveAudience = audience ?? targetAudience ?? "all";
  const { user, getAccessToken } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<SampleStudent>(SAMPLE_STUDENTS[0]);
  const [viewTab, setViewTab] = useState<"email" | "portal">("email");
  const [sendingTest, setSendingTest] = useState(false);

  if (!isOpen) return null;

  // Personalization interpolation
  const interpolate = (text: string, student: SampleStudent) => {
    if (!text) return "";
    const fullName = `${student.firstName} ${student.lastName}`.trim();
    return text.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key) => {
      const k = key.toLowerCase();
      if (k === "first_name" || k === "firstname") return student.firstName;
      if (k === "last_name" || k === "lastname") return student.lastName;
      if (k === "student_name" || k === "studentname" || k === "name" || k === "full_name") return fullName;
      if (k === "matric_no" || k === "matricno" || k === "matric_number") return student.matricNumber;
      if (k === "level" || k === "current_level") return student.currentLevel;
      if (k === "department" || k === "dept") return student.department;
      if (k === "email") return user?.email || "student@stu.ui.edu.ng";
      return `{{${key}}}`;
    });
  };

  const resolvedTitle = interpolate(title || "Announcement Title", selectedStudent);
  const resolvedContent = interpolate(content || "<p>Announcement content...</p>", selectedStudent);

  const handleSendTestEmail = async () => {
    if (!user?.email) {
      toast.error("Your admin account has no associated email address.");
      return;
    }

    setSendingTest(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        token = await getAccessToken(true);
      }
      if (!token) {
        toast.error("Authentication session expired. Please refresh the page or sign in again.");
        return;
      }

      const payload = {
        title,
        content,
        priority,
        targetAudience: effectiveAudience,
        targetLevels,
        attachments,
        sampleStudent: selectedStudent,
      };

      let res = await fetch(getApiUrl("/api/v1/announcements/send-test-email"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // If token expired in background, refresh once and retry
      if (res.status === 401) {
        const freshToken = await getAccessToken(true);
        if (freshToken) {
          token = freshToken;
          res = await fetch(getApiUrl("/api/v1/announcements/send-test-email"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${freshToken}`,
            },
            body: JSON.stringify(payload),
          });
        }
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to send test email");
      }

      toast.success(`Test preview email sent to ${user.email}! Check your inbox.`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to send test email";
      toast.error(errorMsg);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-snow rounded-3xl border-[3px] border-navy shadow-[6px_6px_0_0_#000] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b-[3px] border-navy bg-ghost flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-black text-lg text-navy">
              Live Preview & Dispatch Simulator
            </h3>
            <p className="text-xs text-navy/60">
              Verify how your announcement and personalized tags look to students
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-cloud border-2 border-transparent hover:border-navy/20 text-navy/60 hover:text-navy"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Controls Bar: Sample Student Switcher & View Tabs */}
        <div className="px-5 py-3 border-b-2 border-navy/10 bg-snow flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-navy shrink-0">Preview as:</span>
            <select
              value={selectedStudent.matricNumber}
              onChange={(e) => {
                const s = SAMPLE_STUDENTS.find((st) => st.matricNumber === e.target.value);
                if (s) setSelectedStudent(s);
              }}
              className="px-3 py-1.5 rounded-xl bg-ghost border-2 border-navy text-xs font-bold text-navy appearance-none cursor-pointer"
            >
              {SAMPLE_STUDENTS.map((s) => (
                <option key={s.matricNumber} value={s.matricNumber}>
                  {s.firstName} {s.lastName} ({s.currentLevel} · {s.matricNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-ghost border-2 border-navy rounded-xl p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewTab("email")}
              className={`px-3 py-1 rounded-lg transition-colors ${viewTab === "email" ? "bg-navy text-snow" : "text-navy hover:bg-snow"}`}
            >
              Email View
            </button>
            <button
              type="button"
              onClick={() => setViewTab("portal")}
              className={`px-3 py-1 rounded-lg transition-colors ${viewTab === "portal" ? "bg-navy text-snow" : "text-navy hover:bg-snow"}`}
            >
              Student Portal View
            </button>
          </div>
        </div>

        {/* Preview Container */}
        <div className="p-6 overflow-y-auto flex-1 bg-cloud/30">
          {viewTab === "email" ? (
            /* Subtle & Minimal Email Canvas (Straight to the email content, no boxes) */
            <div className="max-w-xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 text-left font-sans text-slate-700">
              {/* Natural Content Flow (straight to email content, responsive images) */}
              <div
                className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none [&_p]:mb-4 [&_p]:min-h-[1.25rem] [&_p:empty]:min-h-[1.25rem] [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:block [&_img]:my-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-slate-200 [&_hr]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-500 [&_a]:text-lavender [&_a]:font-bold [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: resolvedContent }}
              />

              {/* Attachments inside Email */}
              {attachments.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Attachments ({attachments.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att, i) => (
                      <span
                        key={att.id || i}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700"
                      >
                        📎 {att.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtle CTA Button */}
              <div className="mt-7">
                <span className="inline-block bg-slate-900 text-white px-4 py-2.5 rounded-md text-xs font-semibold cursor-default">
                  Open in Dashboard &rarr;
                </span>
              </div>

              {/* Minimal Footer */}
              <div className="mt-10 pt-5 border-t border-slate-200 text-xs text-slate-400 leading-relaxed">
                Industrial Engineering Students&apos; Association · University of Ibadan<br />
                Department of Industrial &amp; Production Engineering
              </div>
            </div>
          ) : (
            /* Student Portal Card Mockup */
            <div className="max-w-lg mx-auto bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-black uppercase bg-lime-light text-navy">
                  {priority.toUpperCase()}
                </span>
                <span className="text-xs font-bold text-slate">Just now</span>
              </div>

              <h3 className="font-display font-black text-xl text-navy">
                {resolvedTitle}
              </h3>

              <div
                className="text-sm text-navy/80 leading-relaxed prose prose-sm max-w-none [&_p]:mb-4 [&_p]:min-h-[1.5rem] [&_p:empty]:min-h-[1.5rem] [&_h2]:font-display [&_h2]:font-black [&_h2]:text-navy [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:block [&_img]:my-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_hr]:border-0 [&_hr]:border-t-2 [&_hr]:border-navy/10 [&_hr]:my-5 [&_a]:text-lavender [&_a]:font-bold [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: resolvedContent }}
              />

              {attachments.length > 0 && (
                <div className="pt-3 border-t-2 border-navy/10 space-y-2">
                  <p className="text-xs font-bold text-navy uppercase tracking-wider">
                    Attached Files:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {attachments.map((att, i) => (
                      <div
                        key={att.id || i}
                        className="flex items-center gap-2 p-2 bg-ghost border-2 border-navy/15 rounded-xl text-xs font-bold text-navy truncate"
                      >
                        <span>📎</span>
                        <span className="truncate">{att.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t-[3px] border-navy bg-ghost flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border-2 border-navy text-xs font-bold text-navy hover:bg-snow transition-colors"
          >
            Close Preview
          </button>

          <button
            type="button"
            onClick={handleSendTestEmail}
            disabled={sendingTest}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy border-[3px] border-lime text-snow text-xs font-bold press-3 press-lime disabled:opacity-50"
            title={`Sends a test email to ${user?.email || "your email"}`}
          >
            {sendingTest ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-snow/30 border-t-snow rounded-full animate-spin" />
                <span>Sending Test...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                <span>Send Test Email to Me ({user?.email || "Admin"})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
