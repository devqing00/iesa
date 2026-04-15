"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { getApiUrl } from "@/lib/api";
import { withAuth } from "@/lib/withAuth";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import { Modal } from "@/components/ui/Modal";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  gender?: "male" | "female";
  institutionalEmail?: string;
  secondaryEmail?: string;
  matricNumber?: string;
  phone?: string;
  profilePictureUrl?: string;
  level: string;
  currentLevel?: string;
  department?: string;
  admissionYear?: number;
  isExternalStudent?: boolean;
  role?: string;
  bio?: string;
  skills?: string[];
  dateOfBirth?: string;
  notificationEmailPreference?: string;
  notificationChannelPreference?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
}

interface CohortStats {
  level: string;
  enrolledCount: number;
  payments: { id: string; title: string; total: number; paid: number; percentage: number }[];
}

interface PaymentCompliance {
  level: string;
  payment: {
    id: string;
    title: string;
    amount?: number;
    deadline?: string | null;
    total: number;
    paid: number;
    unpaid: number;
    percentage: number;
  };
  paidStudents: Student[];
  unpaidStudents: Student[];
}

interface Deadline {
  id: string;
  title: string;
  course: string;
  description: string;
  dueDate: string | null;
  createdByName: string;
  createdAt: string;
}

interface PollOption {
  text: string;
  voteCount: number;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  eligibleMembers: number;
  memberVotes: number;
  turnoutPercentage: number;
  userVote: number | null;
  isActive: boolean;
  createdByName: string;
  createdAt: string;
}

interface RelayPost {
  id: string;
  title: string;
  content: string;
  course: string;
  lecturerName: string;
  attachmentUrl?: string;
  isPinned: boolean;
  createdByName: string;
  createdAt: string;
}

interface TimetableEntry {
  id: string;
  courseCode: string;
  courseTitle: string;
  lecturer: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  venue: string;
  type: string;
  recurring?: boolean;
}

type Tab = "overview" | "cohort" | "deadlines" | "polls" | "relay" | "announcements" | "timetable";
type ClassRepPortalVariant = "class-rep" | "freshers";

interface ClassRepPortalProps {
  variant?: ClassRepPortalVariant;
}

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: "overview",
    label: "Overview",
    icon: (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6ZM15.75 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3h-2.25ZM6 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3H6ZM15.75 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3h-2.25Z" /></svg>
    ),
  },
  {
    key: "cohort",
    label: "Cohort",
    icon: (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" /></svg>
    ),
  },
  {
    key: "deadlines",
    label: "Deadlines",
    icon: (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" /></svg>
    ),
  },
  {
    key: "polls",
    label: "Polls",
    icon: (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75ZM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875V8.625ZM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 0 1 3 19.875v-6.75Z" /></svg>
    ),
  },
  {
    key: "relay",
    label: "Class Updates",
    icon: (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16.881 4.345A23.112 23.112 0 0 1 8.25 6H7.5a5.25 5.25 0 0 0-.88 10.427 21.593 21.593 0 0 0 1.378 3.94c.464 1.004 1.674 1.32 2.582.796l.657-.379c.88-.508 1.165-1.593.772-2.468a17.116 17.116 0 0 1-.628-1.607c1.918.258 3.76.75 5.5 1.446A21.727 21.727 0 0 0 18 11.25c0-2.414-.393-4.735-1.119-6.905Z" /></svg>
    ),
  },
  {
    key: "announcements",
    label: "Announce",
    icon: (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5.25 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM2.25 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122Z" /></svg>
    ),
  },
  {
    key: "timetable",
    label: "Timetable",
    icon: (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" /></svg>
    ),
  },
];

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return "";
  const now = Date.now();
  const then = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ═══════════════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════════════ */

export function ClassRepPortal({ variant = "class-rep" }: ClassRepPortalProps = {}) {
  const { getAccessToken } = useAuth();
  const { hasPermission } = usePermissions();
  const [tab, setTab] = useState<Tab>("overview");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const helpToolId = variant === "freshers" ? "freshers-portal" : "class-rep-portal";
  const portalLabel = variant === "freshers" ? "FRESHERS COORDINATOR PORTAL" : "CLASS REP PORTAL";
  const { showHelp, openHelp, closeHelp } = useToolHelp(helpToolId);

  /* ── data state ──────────────────────────────────────────── */
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState<CohortStats | null>(null);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [relayPosts, setRelayPosts] = useState<RelayPost[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);
  const [paymentCompliance, setPaymentCompliance] = useState<PaymentCompliance | null>(null);
  const [complianceModalOpen, setComplianceModalOpen] = useState(false);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [remindingUnpaid, setRemindingUnpaid] = useState(false);
  const [exportingCohortPdf, setExportingCohortPdf] = useState(false);
  const [exportingUnpaid, setExportingUnpaid] = useState(false);
  const [exportingUnpaidPdf, setExportingUnpaidPdf] = useState(false);

  /* ── form states ─────────────────────────────────────────── */
  const [showDeadlineForm, setShowDeadlineForm] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  const [showRelayForm, setShowRelayForm] = useState(false);
  const [showAnnounceForm, setShowAnnounceForm] = useState(false);
  const [showTimetableForm, setShowTimetableForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [savingTimetable, setSavingTimetable] = useState(false);
  const [editingTimetableId, setEditingTimetableId] = useState<string | null>(null);

  // Deadline form
  const [dlTitle, setDlTitle] = useState("");
  const [dlCourse, setDlCourse] = useState("");
  const [dlDesc, setDlDesc] = useState("");
  const [dlDue, setDlDue] = useState("");

  // Poll form
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Relay form
  const [relayTitle, setRelayTitle] = useState("");
  const [relayContent, setRelayContent] = useState("");
  const [relayCourse, setRelayCourse] = useState("");
  const [relayLecturer, setRelayLecturer] = useState("");

  // Announcement form
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annPriority, setAnnPriority] = useState("normal");

  // Timetable form
  const [ttCourseCode, setTtCourseCode] = useState("");
  const [ttCourseTitle, setTtCourseTitle] = useState("");
  const [ttDay, setTtDay] = useState("Monday");
  const [ttStartTime, setTtStartTime] = useState("08:00");
  const [ttEndTime, setTtEndTime] = useState("10:00");
  const [ttVenue, setTtVenue] = useState("");
  const [ttLecturer, setTtLecturer] = useState("");
  const [ttType, setTtType] = useState("lecture");

  /* ── API helper ──────────────────────────────────────────── */
  const apiFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/class-rep${path}`), {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options?.headers || {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 403) {
          throw new Error(
            "You are not assigned as Class Rep or Asst. Class Rep for your level.",
          );
        }
        throw new Error(body.detail || `API error ${res.status}`);
      }
      return res.json();
    },
    [getAccessToken],
  );

  /* ── loaders ─────────────────────────────────────────────── */
  const loadCohort = useCallback(async () => {
    const search = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : "";
    const data = await apiFetch(`/cohort${search}`);
    setLevel(data.level);
    setStudents(data.students);
  }, [apiFetch, searchQuery]);

  const loadStats = useCallback(async () => {
    const data = await apiFetch("/stats");
    setStats(data);
    setLevel(data.level);
  }, [apiFetch]);

  const loadDeadlines = useCallback(async () => {
    const data = await apiFetch("/deadlines");
    setDeadlines(data.deadlines);
    setLevel(data.level);
  }, [apiFetch]);

  const loadPolls = useCallback(async () => {
    const data = await apiFetch("/polls");
    setPolls(data.polls);
    setLevel(data.level);
  }, [apiFetch]);

  const loadRelay = useCallback(async () => {
    const data = await apiFetch("/relay");
    setRelayPosts(data.posts);
    setLevel(data.level);
  }, [apiFetch]);

  const loadTimetable = useCallback(async () => {
    const data = await apiFetch("/timetable");
    setTimetable(data.timetable);
    setLevel(data.level);
  }, [apiFetch]);

  async function openStudentModal(studentId: string) {
    setStudentLoading(true);
    setStudentModalOpen(true);
    try {
      const data = await apiFetch(`/cohort/${studentId}`);
      setSelectedStudent(data);
    } catch {
      toast.error("Failed to load student details");
      setStudentModalOpen(false);
    } finally {
      setStudentLoading(false);
    }
  }

  async function openPaymentCompliance(paymentId: string) {
    setComplianceLoading(true);
    setComplianceModalOpen(true);
    setRemindingUnpaid(false);
    setExportingUnpaid(false);
    setExportingUnpaidPdf(false);
    try {
      const data = await apiFetch(`/payments/${paymentId}/compliance`);
      setPaymentCompliance(data);
    } catch {
      toast.error("Failed to load payment compliance details");
      setComplianceModalOpen(false);
    } finally {
      setComplianceLoading(false);
    }
  }

  function resetTimetableForm() {
    setTtCourseCode("");
    setTtCourseTitle("");
    setTtDay("Monday");
    setTtStartTime("08:00");
    setTtEndTime("10:00");
    setTtVenue("");
    setTtLecturer("");
    setTtType("lecture");
    setEditingTimetableId(null);
  }

  /* ── initial load ────────────────────────────────────────── */
  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        await loadStats();
        await loadDeadlines();
        await loadPolls();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── tab-switched loads ──────────────────────────────────── */
  useEffect(() => {
    if (loading) return;
    if (tab === "cohort") loadCohort().catch(() => {});
    if (tab === "relay") loadRelay().catch(() => {});
    if (tab === "timetable") loadTimetable().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (loading || tab !== "polls") return;
    const interval = window.setInterval(() => {
      loadPolls().catch(() => {});
    }, 20000);
    return () => window.clearInterval(interval);
  }, [loading, tab, loadPolls]);

  /* ── actions ─────────────────────────────────────────────── */
  async function createDeadline() {
    setFormLoading(true);
    try {
      await apiFetch("/deadlines", {
        method: "POST",
        body: JSON.stringify({ title: dlTitle, course: dlCourse, description: dlDesc, dueDate: dlDue || null }),
      });
      setDlTitle(""); setDlCourse(""); setDlDesc(""); setDlDue("");
      setShowDeadlineForm(false);
      await loadDeadlines();
      toast.success("Deadline created");
    } catch { toast.error("Failed to create deadline"); } finally { setFormLoading(false); }
  }

  async function deleteDeadline(id: string) {
    await apiFetch(`/deadlines/${id}`, { method: "DELETE" });
    await loadDeadlines();
  }

  async function createPoll() {
    setFormLoading(true);
    try {
      await apiFetch("/polls", {
        method: "POST",
        body: JSON.stringify({ question: pollQuestion, options: pollOptions.filter(o => o.trim()) }),
      });
      setPollQuestion(""); setPollOptions(["", ""]);
      setShowPollForm(false);
      await loadPolls();
      toast.success("Poll created");
    } catch { toast.error("Failed to create poll"); } finally { setFormLoading(false); }
  }

  async function votePoll(pollId: string, optionIndex: number) {
    await apiFetch(`/polls/${pollId}/vote`, {
      method: "POST",
      body: JSON.stringify({ optionIndex }),
    });
    await loadPolls();
  }

  async function closePoll(pollId: string) {
    await apiFetch(`/polls/${pollId}/close`, { method: "PATCH" });
    await loadPolls();
  }

  async function deletePoll(id: string) {
    await apiFetch(`/polls/${id}`, { method: "DELETE" });
    await loadPolls();
  }

  async function createRelayPost() {
    setFormLoading(true);
    try {
      await apiFetch("/relay", {
        method: "POST",
        body: JSON.stringify({ title: relayTitle, content: relayContent, course: relayCourse, lecturerName: relayLecturer }),
      });
      setRelayTitle(""); setRelayContent(""); setRelayCourse(""); setRelayLecturer("");
      setShowRelayForm(false);
      await loadRelay();
      toast.success("Relay post created");
    } catch { toast.error("Failed to create relay post"); } finally { setFormLoading(false); }
  }

  async function togglePinRelay(postId: string, isPinned: boolean) {
    await apiFetch(`/relay/${postId}/pin`, {
      method: "PATCH",
      body: JSON.stringify({ isPinned: !isPinned }),
    });
    await loadRelay();
  }

  async function deleteRelay(id: string) {
    await apiFetch(`/relay/${id}`, { method: "DELETE" });
    await loadRelay();
  }

  async function createAnnouncement() {
    setFormLoading(true);
    try {
      await apiFetch("/announcements", {
        method: "POST",
        body: JSON.stringify({ title: annTitle, content: annContent, priority: annPriority }),
      });
      setAnnTitle(""); setAnnContent(""); setAnnPriority("normal");
      setShowAnnounceForm(false);
      toast.success("Announcement sent");
    } catch { toast.error("Failed to send announcement"); } finally { setFormLoading(false); }
  }

  async function saveTimetableEntry() {
    if (!ttCourseCode.trim() || !ttCourseTitle.trim() || !ttVenue.trim()) {
      toast.error("Course code, title, and venue are required");
      return;
    }
    setSavingTimetable(true);
    try {
      const payload = {
        courseCode: ttCourseCode,
        courseTitle: ttCourseTitle,
        day: ttDay,
        startTime: ttStartTime,
        endTime: ttEndTime,
        venue: ttVenue,
        lecturer: ttLecturer,
        type: ttType,
        recurring: true,
      };
      if (editingTimetableId) {
        await apiFetch(`/timetable/${editingTimetableId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Timetable entry updated");
      } else {
        await apiFetch("/timetable", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Timetable entry created");
      }
      resetTimetableForm();
      setShowTimetableForm(false);
      await loadTimetable();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save timetable entry";
      toast.error(message);
    } finally {
      setSavingTimetable(false);
    }
  }

  async function sendUnpaidReminders() {
    if (!paymentCompliance?.payment?.id) return;
    setRemindingUnpaid(true);
    try {
      const data = await apiFetch(`/payments/${paymentCompliance.payment.id}/remind-unpaid`, {
        method: "POST",
        body: JSON.stringify({ channel: "both" }),
      });
      const inAppQueued = data?.inAppQueued ?? 0;
      const emailQueued = data?.emailQueued ?? 0;
      toast.success(`Reminder queued (${inAppQueued} in-app, ${emailQueued} email)`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to send reminders";
      toast.error(message);
    } finally {
      setRemindingUnpaid(false);
    }
  }

  async function exportUnpaidComplianceCSV() {
    if (!paymentCompliance?.payment?.id) return;
    setExportingUnpaid(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/class-rep/payments/${paymentCompliance.payment.id}/unpaid/export`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to export unpaid CSV");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${level}_${paymentCompliance.payment.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_unpaid.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Unpaid CSV exported");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to export unpaid CSV";
      toast.error(message);
    } finally {
      setExportingUnpaid(false);
    }
  }

  async function exportUnpaidCompliancePDF() {
    if (!paymentCompliance?.payment?.id) return;
    setExportingUnpaidPdf(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/class-rep/payments/${paymentCompliance.payment.id}/unpaid/export/pdf`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to export unpaid PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${level}_${paymentCompliance.payment.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_unpaid.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Unpaid PDF exported");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to export unpaid PDF";
      toast.error(message);
    } finally {
      setExportingUnpaidPdf(false);
    }
  }

  function startEditTimetable(entry: TimetableEntry) {
    setEditingTimetableId(entry.id);
    setTtCourseCode(entry.courseCode);
    setTtCourseTitle(entry.courseTitle);
    setTtDay(entry.dayOfWeek);
    setTtStartTime(entry.startTime);
    setTtEndTime(entry.endTime);
    setTtVenue(entry.venue);
    setTtLecturer(entry.lecturer || "");
    setTtType(entry.type || "lecture");
    setShowTimetableForm(true);
  }

  async function deleteTimetableEntry(entryId: string) {
    try {
      await apiFetch(`/timetable/${entryId}`, { method: "DELETE" });
      toast.success("Timetable entry deleted");
      await loadTimetable();
    } catch {
      toast.error("Failed to delete timetable entry");
    }
  }

  async function exportCSV() {
    const token = await getAccessToken();
    const res = await fetch(getApiUrl("/api/v1/class-rep/cohort/export"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${level}_cohort.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    setExportingCohortPdf(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/class-rep/cohort/export/pdf"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to export cohort PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${level}_cohort.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Cohort PDF exported");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to export cohort PDF";
      toast.error(message);
    } finally {
      setExportingCohortPdf(false);
    }
  }

  /* ── gate ─────────────────────────────────────────────────── */
  const isClassRep = hasPermission("class_rep:view_cohort");
  const canManageDeadlines = hasPermission("class_rep:manage_deadlines");
  const canManagePolls = hasPermission("class_rep:manage_polls");
  const canManageRelay = hasPermission("class_rep:manage_relay");
  const canPinRelay = hasPermission("class_rep:pin_relay");
  const canExport = hasPermission("class_rep:export_cohort");
  const canAnnounce = hasPermission("announcement:create");
  const canManageTimetable = hasPermission("class_rep:manage_timetable") || hasPermission("timetable:create") || hasPermission("timetable:edit");

  if (!isClassRep && !loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-snow border-4 border-navy rounded-3xl p-10 shadow-[8px_8px_0_0_#000] text-center max-w-md">
            <h2 className="font-display font-black text-display-md text-navy mb-2">Access Denied</h2>
            <p className="text-slate">You need a Class Rep or Asst. Class Rep role to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-10 h-10 border-4 border-lime border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-coral-light border-4 border-navy rounded-3xl p-10 shadow-[8px_8px_0_0_#000] text-center max-w-md">
            <h2 className="font-display font-black text-display-md text-navy mb-2">Error</h2>
            <p className="text-navy">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ░░░ Header ░░░ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-label text-slate">{portalLabel}</p>
          <h1 className="font-display font-black text-display-lg text-navy">
            <span className="brush-highlight">{level}</span> Dashboard
          </h1>
        </div>
        <HelpButton onClick={openHelp} />
      </div>

      {/* ░░░ Tabs ░░░ */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all border-[3px] ${
              tab === t.key
                ? "bg-lime text-navy border-navy shadow-[3px_3px_0_0_#000]"
                : "bg-snow text-slate border-transparent hover:border-navy hover:text-navy"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ░░░ Tab Content ░░░ */}

      {/* ── OVERVIEW ──────────────────────────────────────── */}
      {tab === "overview" && stats && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-teal border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
              <p className="text-label-sm text-navy/60">ENROLLED STUDENTS</p>
              <p className="font-display font-black text-display-md text-navy">{stats.enrolledCount}</p>
            </div>
            <div className="bg-lavender border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
              <p className="text-label-sm text-navy/60">UPCOMING DEADLINES</p>
              <p className="font-display font-black text-display-md text-navy">{deadlines.length}</p>
            </div>
            <div className="bg-sunny border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
              <p className="text-label-sm text-navy/60">ACTIVE POLLS</p>
              <p className="font-display font-black text-display-md text-navy">{polls.filter(p => p.isActive).length}</p>
            </div>
          </div>

          {/* Payment compliance */}
          {stats.payments.length > 0 && (
            <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
              <h3 className="font-display font-black text-lg text-navy mb-4">Payment Compliance</h3>
              <div className="space-y-3">
                {stats.payments.map((p) => (
                  <div key={p.id || p.title}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-bold text-navy">{p.title}</span>
                      <span className="text-slate">{p.paid}/{p.total} ({p.percentage}%)</span>
                    </div>
                    <div className="w-full h-3 bg-ghost rounded-full overflow-hidden border-2 border-navy">
                      <div
                        className="h-full bg-lime rounded-full transition-all"
                        style={{ width: `${p.percentage}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => openPaymentCompliance(p.id)}
                        className="text-xs font-bold text-navy hover:text-teal transition-colors"
                      >
                        View paid/unpaid list
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick deadlines preview */}
          {deadlines.length > 0 && (
            <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-black text-lg text-navy">Upcoming Deadlines</h3>
                <button onClick={() => setTab("deadlines")} className="text-sm font-bold text-teal hover:underline">
                  View all
                </button>
              </div>
              <div className="space-y-2">
                {deadlines.slice(0, 3).map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b border-cloud last:border-0">
                    <div>
                      <p className="font-bold text-navy text-sm">{d.title}</p>
                      {d.course && <p className="text-xs text-slate">{d.course}</p>}
                    </div>
                    <span className="text-xs font-bold text-coral bg-coral-light px-2 py-1 rounded-lg">
                      {formatDate(d.dueDate)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── COHORT ────────────────────────────────────────── */}
      {tab === "cohort" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search by name, email, or matric..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadCohort()}
                className="w-full border-[3px] border-navy rounded-2xl px-4 py-3 pl-10 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime"
              />
              <svg aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
              </svg>
            </div>
            <button onClick={loadCohort} className="bg-lime border-[3px] border-navy rounded-2xl px-5 py-3 font-bold text-sm text-navy press-3 press-navy">
              Search
            </button>
            {canExport && (
              <button onClick={exportCSV} className="bg-teal border-[3px] border-navy rounded-2xl px-5 py-3 font-bold text-sm text-navy press-3 press-navy">
                Export CSV
              </button>
            )}
            {canExport && (
              <button onClick={exportPDF} disabled={exportingCohortPdf} className="bg-lime border-[3px] border-navy rounded-2xl px-5 py-3 font-bold text-sm text-navy press-3 press-navy disabled:opacity-50">
                {exportingCohortPdf ? "Exporting..." : "Export PDF"}
              </button>
            )}
          </div>

          <div className="bg-snow border-4 border-navy rounded-3xl shadow-[8px_8px_0_0_#000] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ghost border-b-[3px] border-navy">
                    <th className="text-left px-4 py-3 font-bold text-navy">Name</th>
                    <th className="text-left px-4 py-3 font-bold text-navy">Email</th>
                    <th className="text-left px-4 py-3 font-bold text-navy">Matric</th>
                    <th className="text-left px-4 py-3 font-bold text-navy">Phone</th>
                    <th className="text-left px-4 py-3 font-bold text-navy">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate">No students found.</td></tr>
                  ) : students.map((s) => (
                    <tr key={s.id} className="border-b border-cloud hover:bg-ghost/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-navy">
                        <button onClick={() => openStudentModal(s.id)} className="hover:text-teal transition-colors text-left">
                          {s.firstName} {s.lastName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate">{s.email}</td>
                      <td className="px-4 py-3 text-slate">{s.matricNumber || "—"}</td>
                      <td className="px-4 py-3 text-slate">{s.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openStudentModal(s.id)}
                          className="text-xs font-bold text-navy hover:text-teal transition-colors"
                        >
                          View full profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-slate text-right">{students.length} student{students.length !== 1 ? "s" : ""}</p>
        </div>
      )}

      {/* ── DEADLINES ─────────────────────────────────────── */}
      {tab === "deadlines" && (
        <div className="space-y-4">
          {canManageDeadlines && (
            <button
              onClick={() => setShowDeadlineForm(!showDeadlineForm)}
              className="bg-lime border-[3px] border-navy rounded-2xl px-5 py-3 font-bold text-sm text-navy press-3 press-navy"
            >
              {showDeadlineForm ? "Cancel" : "+ New Deadline"}
            </button>
          )}

          {showDeadlineForm && (
            <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] space-y-4">
              <input value={dlTitle} onChange={e => setDlTitle(e.target.value)} placeholder="Title *" className="w-full border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input value={dlCourse} onChange={e => setDlCourse(e.target.value)} placeholder="Course (e.g. IPE 401)" className="border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime" />
                <input type="datetime-local" value={dlDue} onChange={e => setDlDue(e.target.value)} title="Due date" className="border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy focus:outline-none focus:border-lime" />
              </div>
              <textarea value={dlDesc} onChange={e => setDlDesc(e.target.value)} placeholder="Description (optional)" rows={3} className="w-full border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime resize-none" />
              <button onClick={createDeadline} disabled={!dlTitle || formLoading} className="bg-lime border-[3px] border-navy rounded-2xl px-6 py-3 font-bold text-sm text-navy press-3 press-navy disabled:opacity-50">
                {formLoading ? "Creating..." : "Create Deadline"}
              </button>
            </div>
          )}

          <div className="space-y-3">
            {deadlines.length === 0 ? (
              <div className="bg-snow border-4 border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000] text-center">
                <p className="text-slate">No deadlines yet.</p>
              </div>
            ) : deadlines.map((d) => (
              <div key={d.id} className="bg-snow border-4 border-navy rounded-3xl p-5 shadow-[5px_5px_0_0_#000]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-display font-black text-navy">{d.title}</h4>
                    {d.course && <p className="text-xs font-bold text-teal">{d.course}</p>}
                    {d.description && <p className="text-sm text-slate mt-1">{d.description}</p>}
                    <p className="text-xs text-slate mt-2">By {d.createdByName} · {timeAgo(d.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {d.dueDate && (
                      <span className="text-xs font-bold text-coral bg-coral-light px-3 py-1.5 rounded-xl">
                        Due: {formatDate(d.dueDate)}
                      </span>
                    )}
                    {canManageDeadlines && (
                      <button onClick={() => deleteDeadline(d.id)} className="block mt-2 text-xs text-coral hover:underline">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── POLLS ─────────────────────────────────────────── */}
      {tab === "polls" && (
        <div className="space-y-4">
          {canManagePolls && (
            <button
              onClick={() => setShowPollForm(!showPollForm)}
              className="bg-lime border-[3px] border-navy rounded-2xl px-5 py-3 font-bold text-sm text-navy press-3 press-navy"
            >
              {showPollForm ? "Cancel" : "+ New Poll"}
            </button>
          )}

          {showPollForm && (
            <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] space-y-4">
              <input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Question *" className="w-full border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime" />
              <div className="space-y-2">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={opt}
                      onChange={e => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 border-[3px] border-navy rounded-2xl px-4 py-2.5 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime"
                    />
                    {pollOptions.length > 2 && (
                      <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} className="text-coral font-bold text-sm">×</button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button onClick={() => setPollOptions([...pollOptions, ""])} className="text-sm font-bold text-teal hover:underline">
                    + Add option
                  </button>
                )}
              </div>
              <button onClick={createPoll} disabled={!pollQuestion || pollOptions.filter(o => o.trim()).length < 2 || formLoading} className="bg-lime border-[3px] border-navy rounded-2xl px-6 py-3 font-bold text-sm text-navy press-3 press-navy disabled:opacity-50">
                {formLoading ? "Creating..." : "Create Poll"}
              </button>
            </div>
          )}

          <div className="space-y-4">
            {polls.length === 0 ? (
              <div className="bg-snow border-4 border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000] text-center">
                <p className="text-slate">No polls yet.</p>
              </div>
            ) : polls.map((p) => (
              <div key={p.id} className={`border-4 border-navy rounded-3xl p-5 shadow-[5px_5px_0_0_#000] ${p.isActive ? "bg-snow" : "bg-ghost"}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h4 className="font-display font-black text-navy">{p.question}</h4>
                  <div className="flex items-center gap-2 shrink-0">
                    {!p.isActive && <span className="text-xs font-bold bg-coral-light text-coral px-2 py-1 rounded-lg">Closed</span>}
                    {p.isActive && canManagePolls && (
                      <button onClick={() => closePoll(p.id)} className="text-xs font-bold text-slate hover:text-coral">Close</button>
                    )}
                    {canManagePolls && (
                      <button onClick={() => deletePoll(p.id)} className="text-xs font-bold text-coral hover:underline">Delete</button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {p.options.map((opt, i) => {
                    const pct = p.totalVotes > 0 ? Math.round((opt.voteCount / p.totalVotes) * 100) : 0;
                    const isUserVote = p.userVote === i;
                    return (
                      <button
                        key={i}
                        onClick={() => p.isActive && votePoll(p.id, i)}
                        disabled={!p.isActive}
                        className={`w-full text-left relative overflow-hidden rounded-2xl border-[3px] px-4 py-2.5 text-sm font-bold transition-all ${
                          isUserVote
                            ? "border-lime bg-lime-light text-navy"
                            : "border-navy/20 bg-snow text-navy hover:border-navy"
                        } ${!p.isActive ? "cursor-default" : "cursor-pointer"}`}
                      >
                        {/* Progress bar background */}
                        <div
                          className={`absolute inset-y-0 left-0 ${isUserVote ? "bg-lime/30" : "bg-ghost"} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                        <span className="relative flex justify-between">
                          <span>{opt.text}</span>
                          <span className="text-slate">{pct}% ({opt.voteCount})</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate mt-2">
                  {p.totalVotes} vote{p.totalVotes !== 1 ? "s" : ""} · Turnout {p.memberVotes}/{p.eligibleMembers} ({p.turnoutPercentage}%) · By {p.createdByName} · {timeAgo(p.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CLASS UPDATES ─────────────────────────────────── */}
      {tab === "relay" && (
        <div className="space-y-4">
          {canManageRelay && (
            <button
              onClick={() => setShowRelayForm(!showRelayForm)}
              className="bg-lime border-[3px] border-navy rounded-2xl px-5 py-3 font-bold text-sm text-navy press-3 press-navy"
            >
              {showRelayForm ? "Cancel" : "+ New Update"}
            </button>
          )}

          {showRelayForm && (
            <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] space-y-4">
              <input value={relayTitle} onChange={e => setRelayTitle(e.target.value)} placeholder="Title *" className="w-full border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input value={relayCourse} onChange={e => setRelayCourse(e.target.value)} placeholder="Course (e.g. IPE 401)" className="border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime" />
                <input value={relayLecturer} onChange={e => setRelayLecturer(e.target.value)} placeholder="Lecturer name" className="border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime" />
              </div>
              <textarea value={relayContent} onChange={e => setRelayContent(e.target.value)} placeholder="Content / Instructions *" rows={4} className="w-full border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime resize-none" />
              <button onClick={createRelayPost} disabled={!relayTitle || !relayContent || formLoading} className="bg-lime border-[3px] border-navy rounded-2xl px-6 py-3 font-bold text-sm text-navy press-3 press-navy disabled:opacity-50">
                {formLoading ? "Posting..." : "Post Update"}
              </button>
            </div>
          )}

          <div className="space-y-3">
            {relayPosts.length === 0 ? (
              <div className="bg-snow border-4 border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000] text-center">
                <p className="text-slate">No class updates yet.</p>
              </div>
            ) : relayPosts.map((post) => (
              <div key={post.id} className={`border-4 border-navy rounded-3xl p-5 shadow-[5px_5px_0_0_#000] ${post.isPinned ? "bg-sunny-light" : "bg-snow"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {post.isPinned && (
                        <span className="text-[10px] font-bold bg-sunny text-navy px-2 py-0.5 rounded-lg">PINNED</span>
                      )}
                      <h4 className="font-display font-black text-navy">{post.title}</h4>
                    </div>
                    {(post.course || post.lecturerName) && (
                      <p className="text-xs font-bold text-teal mb-1">
                        {[post.course, post.lecturerName].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <p className="text-sm text-navy whitespace-pre-wrap">{post.content}</p>
                    <p className="text-xs text-slate mt-2">By {post.createdByName} · {timeAgo(post.createdAt)}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {canPinRelay && (
                      <button onClick={() => togglePinRelay(post.id, post.isPinned)} className="text-xs font-bold text-sunny hover:underline">
                        {post.isPinned ? "Unpin" : "Pin"}
                      </button>
                    )}
                    {canManageRelay && (
                      <button onClick={() => deleteRelay(post.id)} className="text-xs font-bold text-coral hover:underline">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ANNOUNCEMENTS ─────────────────────────────────── */}
      {tab === "announcements" && (
        <div className="space-y-4">
          {canAnnounce ? (
            <>
              <button
                onClick={() => setShowAnnounceForm(!showAnnounceForm)}
                className="bg-lime border-[3px] border-navy rounded-2xl px-5 py-3 font-bold text-sm text-navy press-3 press-navy"
              >
                {showAnnounceForm ? "Cancel" : "+ New Announcement"}
              </button>

              {showAnnounceForm && (
                <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] space-y-4">
                  <div className="bg-teal-light border-[3px] border-teal rounded-2xl p-3">
                    <p className="text-xs font-bold text-navy">
                      This announcement will be automatically sent to <span className="text-teal">{level} students only</span>.
                    </p>
                  </div>
                  <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Title *" className="w-full border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime" />
                  <textarea value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Content *" rows={5} className="w-full border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime resize-none" />
                  <select value={annPriority} onChange={e => setAnnPriority(e.target.value)} title="Priority level" className="border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy focus:outline-none focus:border-lime">
                    <option value="normal">Normal priority</option>
                    <option value="urgent">Urgent</option>
                    <option value="low">Low</option>
                  </select>
                  <button onClick={createAnnouncement} disabled={!annTitle || !annContent || formLoading} className="bg-lime border-[3px] border-navy rounded-2xl px-6 py-3 font-bold text-sm text-navy press-3 press-navy disabled:opacity-50">
                    {formLoading ? "Sending..." : "Send to " + level}
                  </button>
                </div>
              )}

              {!showAnnounceForm && (
                <div className="bg-snow border-4 border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000] text-center">
                  <svg aria-hidden="true" className="w-12 h-12 text-slate/30 mx-auto mb-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.881 4.345A23.112 23.112 0 0 1 8.25 6H7.5a5.25 5.25 0 0 0-.88 10.427 21.593 21.593 0 0 0 1.378 3.94c.464 1.004 1.674 1.32 2.582.796l.657-.379c.88-.508 1.165-1.593.772-2.468a17.116 17.116 0 0 1-.628-1.607c1.918.258 3.76.75 5.5 1.446A21.727 21.727 0 0 0 18 11.25c0-2.414-.393-4.735-1.119-6.905Z" />
                  </svg>
                  <p className="text-slate font-bold">Send announcements targeted exclusively to your {level} cohort.</p>
                  <p className="text-xs text-slate mt-1">Notifications are sent automatically to all {level} students.</p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-snow border-4 border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000] text-center">
              <p className="text-slate">You don&apos;t have permission to create announcements.</p>
            </div>
          )}
        </div>
      )}

      {/* ── TIMETABLE ─────────────────────────────────────── */}
      {tab === "timetable" && (
        <div className="space-y-4">
          {canManageTimetable && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  if (showTimetableForm) {
                    setShowTimetableForm(false);
                    resetTimetableForm();
                    return;
                  }
                  setShowTimetableForm(true);
                }}
                className="bg-lime border-[3px] border-navy rounded-2xl px-5 py-3 font-bold text-sm text-navy press-3 press-navy"
              >
                {showTimetableForm ? "Cancel" : "+ Add Timetable Entry"}
              </button>
            </div>
          )}

          {showTimetableForm && canManageTimetable && (
            <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input value={ttCourseCode} onChange={(e) => setTtCourseCode(e.target.value)} placeholder="Course code (e.g. IPE 401)" className="border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime" />
                <input value={ttCourseTitle} onChange={(e) => setTtCourseTitle(e.target.value)} placeholder="Course title" className="border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <select value={ttDay} onChange={(e) => setTtDay(e.target.value)} title="Class day" className="border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy focus:outline-none focus:border-lime">
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ].map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
                <input type="time" title="Start time" value={ttStartTime} onChange={(e) => setTtStartTime(e.target.value)} className="border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy focus:outline-none focus:border-lime" />
                <input type="time" title="End time" value={ttEndTime} onChange={(e) => setTtEndTime(e.target.value)} className="border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy focus:outline-none focus:border-lime" />
                <select value={ttType} onChange={(e) => setTtType(e.target.value)} title="Class type" className="border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy focus:outline-none focus:border-lime">
                  <option value="lecture">Lecture</option>
                  <option value="practical">Practical</option>
                  <option value="tutorial">Tutorial</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input value={ttVenue} onChange={(e) => setTtVenue(e.target.value)} placeholder="Venue" className="border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime" />
                <input value={ttLecturer} onChange={(e) => setTtLecturer(e.target.value)} placeholder="Lecturer" className="border-[3px] border-navy rounded-2xl px-4 py-3 text-sm font-medium text-navy placeholder:text-slate focus:outline-none focus:border-lime" />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={saveTimetableEntry} disabled={savingTimetable} className="bg-lime border-[3px] border-navy rounded-2xl px-6 py-3 font-bold text-sm text-navy press-3 press-navy disabled:opacity-50">
                  {savingTimetable ? "Saving..." : editingTimetableId ? "Update Entry" : "Create Entry"}
                </button>
                {editingTimetableId && (
                  <button
                    onClick={() => {
                      resetTimetableForm();
                      setShowTimetableForm(false);
                    }}
                    className="bg-ghost border-[3px] border-navy rounded-2xl px-6 py-3 font-bold text-sm text-navy press-3 press-black"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="bg-snow border-4 border-navy rounded-3xl shadow-[8px_8px_0_0_#000] overflow-hidden">
            {timetable.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate">No timetable entries for {level}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ghost border-b-[3px] border-navy">
                      <th className="text-left px-4 py-3 font-bold text-navy">Day</th>
                      <th className="text-left px-4 py-3 font-bold text-navy">Time</th>
                      <th className="text-left px-4 py-3 font-bold text-navy">Course</th>
                      <th className="text-left px-4 py-3 font-bold text-navy">Lecturer</th>
                      <th className="text-left px-4 py-3 font-bold text-navy">Venue</th>
                      <th className="text-left px-4 py-3 font-bold text-navy">Type</th>
                      {canManageTimetable && <th className="text-left px-4 py-3 font-bold text-navy">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {timetable.map((entry) => (
                      <tr key={entry.id} className="border-b border-cloud hover:bg-ghost/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-navy">{entry.dayOfWeek}</td>
                        <td className="px-4 py-3 text-slate">{entry.startTime} – {entry.endTime}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-navy">{entry.courseCode}</span>
                          {entry.courseTitle && <span className="text-slate ml-1">({entry.courseTitle})</span>}
                        </td>
                        <td className="px-4 py-3 text-slate">{entry.lecturer || "—"}</td>
                        <td className="px-4 py-3 text-slate">{entry.venue || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                            entry.type === "lecture" ? "bg-teal-light text-teal" :
                            entry.type === "practical" ? "bg-lavender-light text-lavender" :
                            "bg-sunny-light text-navy"
                          }`}>
                            {entry.type}
                          </span>
                        </td>
                        {canManageTimetable && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => startEditTimetable(entry)} className="text-xs font-bold text-teal hover:underline">Edit</button>
                              <button onClick={() => deleteTimetableEntry(entry.id)} className="text-xs font-bold text-coral hover:underline">Delete</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={complianceModalOpen}
        onClose={() => {
          setComplianceModalOpen(false);
          setPaymentCompliance(null);
        }}
        title={paymentCompliance?.payment?.title || "Payment Compliance"}
        size="xl"
      >
        {complianceLoading || !paymentCompliance ? (
          <div className="py-10 text-center text-slate">Loading compliance details...</div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                onClick={exportUnpaidComplianceCSV}
                disabled={exportingUnpaid}
                className="bg-teal border-[3px] border-navy rounded-xl px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-navy press-2 press-navy disabled:opacity-50"
              >
                {exportingUnpaid ? "Exporting..." : "Export Unpaid CSV"}
              </button>
              <button
                onClick={exportUnpaidCompliancePDF}
                disabled={exportingUnpaidPdf}
                className="bg-lime border-[3px] border-navy rounded-xl px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-navy press-2 press-navy disabled:opacity-50"
              >
                {exportingUnpaidPdf ? "Exporting..." : "Export Unpaid PDF"}
              </button>
              <button
                onClick={sendUnpaidReminders}
                disabled={remindingUnpaid || paymentCompliance.unpaidStudents.length === 0}
                className="bg-lime border-[3px] border-navy rounded-xl px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-navy press-2 press-navy disabled:opacity-50"
              >
                {remindingUnpaid ? "Sending..." : "Remind Unpaid"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-light text-navy font-bold text-[10px] uppercase tracking-[0.08em]">
                <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                Paid {paymentCompliance.payment.paid}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-coral-light text-navy font-bold text-[10px] uppercase tracking-[0.08em]">
                <span className="w-1.5 h-1.5 rounded-full bg-coral" />
                Unpaid {paymentCompliance.payment.unpaid}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-lime-light text-navy font-bold text-[10px] uppercase tracking-[0.08em]">
                <span className="w-1.5 h-1.5 rounded-full bg-lime-dark" />
                {paymentCompliance.payment.percentage}% Compliance
              </span>
            </div>

            <div>
              <p className="text-xs font-bold text-navy uppercase tracking-[0.12em] mb-2">Paid Students</p>
              <div className="max-h-56 overflow-y-auto rounded-2xl border-[3px] border-navy/15 bg-ghost p-2 space-y-1.5">
                {paymentCompliance.paidStudents.length === 0 ? (
                  <p className="text-xs text-slate px-2 py-1">No paid students yet.</p>
                ) : paymentCompliance.paidStudents.map((student) => (
                  <button key={student.id} onClick={() => openStudentModal(student.id)} className="w-full text-left px-3 py-2 rounded-xl hover:bg-snow transition-colors">
                    <p className="font-bold text-sm text-navy">{student.firstName} {student.lastName}</p>
                    <p className="text-[11px] text-slate">{student.matricNumber || "No matric"} · {student.email}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-navy uppercase tracking-[0.12em] mb-2">Unpaid Students</p>
              <div className="max-h-56 overflow-y-auto rounded-2xl border-[3px] border-navy/15 bg-ghost p-2 space-y-1.5">
                {paymentCompliance.unpaidStudents.length === 0 ? (
                  <p className="text-xs text-slate px-2 py-1">All students have paid.</p>
                ) : paymentCompliance.unpaidStudents.map((student) => (
                  <button key={student.id} onClick={() => openStudentModal(student.id)} className="w-full text-left px-3 py-2 rounded-xl hover:bg-snow transition-colors">
                    <p className="font-bold text-sm text-navy">{student.firstName} {student.lastName}</p>
                    <p className="text-[11px] text-slate">{student.matricNumber || "No matric"} · {student.email}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={studentModalOpen}
        onClose={() => {
          setStudentModalOpen(false);
          setSelectedStudent(null);
        }}
        title={selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : "Student Details"}
        size="lg"
      >
        {studentLoading || !selectedStudent ? (
          <div className="py-10 text-center text-slate">Loading student details...</div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-ghost border-[2px] border-navy/20 rounded-xl p-3"><p className="text-xs text-slate">Email</p><p className="font-bold text-navy break-all">{selectedStudent.email || "—"}</p></div>
              <div className="bg-ghost border-[2px] border-navy/20 rounded-xl p-3"><p className="text-xs text-slate">Institutional Email</p><p className="font-bold text-navy break-all">{selectedStudent.institutionalEmail || "—"}</p></div>
              <div className="bg-ghost border-[2px] border-navy/20 rounded-xl p-3"><p className="text-xs text-slate">Matric Number</p><p className="font-bold text-navy">{selectedStudent.matricNumber || "—"}</p></div>
              <div className="bg-ghost border-[2px] border-navy/20 rounded-xl p-3"><p className="text-xs text-slate">Phone</p><p className="font-bold text-navy">{selectedStudent.phone || "—"}</p></div>
              <div className="bg-ghost border-[2px] border-navy/20 rounded-xl p-3"><p className="text-xs text-slate">Gender</p><p className="font-bold text-navy">{selectedStudent.gender ? (selectedStudent.gender === "male" ? "Male" : "Female") : "—"}</p></div>
              <div className="bg-ghost border-[2px] border-navy/20 rounded-xl p-3"><p className="text-xs text-slate">Level</p><p className="font-bold text-navy">{selectedStudent.currentLevel || selectedStudent.level || "—"}</p></div>
              <div className="bg-ghost border-[2px] border-navy/20 rounded-xl p-3"><p className="text-xs text-slate">Department</p><p className="font-bold text-navy">{selectedStudent.department || "—"}</p></div>
              <div className="bg-ghost border-[2px] border-navy/20 rounded-xl p-3"><p className="text-xs text-slate">Admission Year</p><p className="font-bold text-navy">{selectedStudent.admissionYear || "—"}</p></div>
              <div className="bg-ghost border-[2px] border-navy/20 rounded-xl p-3"><p className="text-xs text-slate">Role</p><p className="font-bold text-navy">{selectedStudent.role || "student"}</p></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-ghost border-[2px] border-navy/20 rounded-xl p-3"><p className="text-xs text-slate">Joined</p><p className="font-bold text-navy">{formatDate(selectedStudent.createdAt)}</p></div>
              <div className="bg-ghost border-[2px] border-navy/20 rounded-xl p-3"><p className="text-xs text-slate">Last Login</p><p className="font-bold text-navy">{formatDate(selectedStudent.lastLogin)}</p></div>
            </div>
            <div className="bg-ghost border-[2px] border-navy/20 rounded-xl p-3">
              <p className="text-xs text-slate">Bio</p>
              <p className="font-medium text-navy whitespace-pre-wrap">{selectedStudent.bio || "No bio provided."}</p>
            </div>
          </div>
        )}
      </Modal>

      <ToolHelpModal toolId={helpToolId} isOpen={showHelp} onClose={closeHelp} />
    </div>
  );
}

export default withAuth(ClassRepPortal, { requiredPermission: "class_rep:view_cohort" });
