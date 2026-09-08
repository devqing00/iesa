"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { mutate } from "swr";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";
import Pagination from "@/components/ui/Pagination";
import { AnnouncementSchema, flattenZodErrors } from "@/lib/schemas";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import { throwApiError, getErrorMessage } from "@/lib/adminApiError";
import RichTitleEditor from "@/components/admin/RichTitleEditor";
import RichTextEditor from "@/components/ui/RichTextEditor";
import AnnouncementAIDraftModal from "@/components/admin/AnnouncementAIDraftModal";
import AnnouncementAttachments from "@/components/admin/AnnouncementAttachments";
import AnnouncementPreviewModal from "@/components/admin/AnnouncementPreviewModal";
import { CustomEmailListManager } from "@/components/admin/CustomEmailListManager";
import type { AnnouncementAttachment } from "@/lib/api/types";

/* ─── Types ──────────────────────────────── */

type TargetAudience =
  | "all"
  | "ipe"
  | "external"
  | "exco_only"
  | "team_leads_only"
  | "class_rep_and_assistant"
  | "specific_students"
  | "specific_levels"
  | "custom_emails";

interface RecipientOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  gender?: "male" | "female";
  matricNumber?: string;
  role?: string;
  currentLevel?: string;
}

interface Announcement {
  _id: string;
  id?: string;
  title: string;
  content: string;
  targetLevels: string[] | null;
  targetAudience?: TargetAudience;
  targetUserIds?: string[];
  customEmails?: string[];
  priority: "low" | "normal" | "high" | "urgent";
  isPinned: boolean;
  isPublished?: boolean;
  scheduledFor?: string | null;
  sendEmail?: boolean;
  sessionId: string;
  authorName?: string;
  attachments?: AnnouncementAttachment[];
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string | null;
}

interface FormState {
  title: string;
  content: string;
  priority: "low" | "normal" | "high" | "urgent";
  targetLevels: string[];
  targetAudience: TargetAudience;
  targetUserIds: string[];
  customEmails: string[];
  attachments: AnnouncementAttachment[];
  isPinned: boolean;
  expiresAt: string;
  scheduledFor: string;
  sendEmail: boolean;
}

const EMPTY_FORM: FormState = {
  title: "",
  content: "",
  priority: "normal",
  targetLevels: [],
  targetAudience: "all",
  targetUserIds: [],
  customEmails: [],
  attachments: [],
  isPinned: false,
  expiresAt: "",
  scheduledFor: "",
  sendEmail: true,
};

const NEW_DRAFT_KEY = "iesa_draft_announcement_new";
const getEditDraftKey = (id: string) => `iesa_draft_announcement_edit_${id}`;

function isFormEmpty(f: FormState) {
  return (
    !f.title.trim() &&
    !f.content.trim() &&
    f.attachments.length === 0 &&
    f.customEmails.length === 0 &&
    f.targetUserIds.length === 0
  );
}

const AUDIENCE_OPTIONS: { value: TargetAudience; label: string; desc: string }[] = [
  { value: "all", label: "All Students", desc: "Everyone sees this" },
  { value: "ipe", label: "IPE Only", desc: "Industrial Engineering students only" },
  { value: "external", label: "External Only", desc: "Students from other departments" },
  { value: "exco_only", label: "EXCO Only", desc: "Send only to users with EXCO role" },
  { value: "team_leads_only", label: "Team Leads Only", desc: "Send only to team leads" },
  { value: "class_rep_and_assistant", label: "Class Reps + Assistants", desc: "Send to class reps and assistant class reps" },
  { value: "specific_students", label: "Specific Students", desc: "Send only to selected students" },
  { value: "custom_emails", label: "Custom Email List", desc: "Send to a custom list of emails (paste, format & deduplicate)" },
];

const LEVEL_OPTIONS = ["100L", "200L", "300L", "400L", "500L"];

/* ─── Helpers ────────────────────────────── */

function priorityPill(priority: string) {
  switch (priority) {
    case "urgent":
      return "bg-coral text-snow";
    case "high":
      return "bg-coral-light text-coral";
    case "normal":
      return "bg-lavender-light text-lavender";
    default:
      return "bg-cloud text-slate";
  }
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function stripHtml(html: string) {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();
}

function audienceBadge(targetAudience?: TargetAudience): { label: string; className: string } | null {
  if (!targetAudience || targetAudience === "all") return null;
  const map: Record<string, { label: string; className: string }> = {
    ipe: { label: "IPE Only", className: "bg-lime-light text-navy" },
    external: { label: "External Only", className: "bg-lavender-light text-lavender" },
    exco_only: { label: "EXCO Only", className: "bg-coral-light text-coral" },
    team_leads_only: { label: "Team Leads", className: "bg-teal-light text-teal" },
    class_rep_and_assistant: { label: "Class Reps + Assist", className: "bg-sunny-light text-navy" },
    specific_students: { label: "Specific Students", className: "bg-ghost text-navy" },
    specific_levels: { label: "Specific Levels", className: "bg-cloud text-navy" },
    custom_emails: { label: "Custom Email List", className: "bg-yellow-100 text-yellow-900 border border-yellow-300" },
  };
  return map[targetAudience] ?? { label: targetAudience, className: "bg-cloud text-navy" };
}

/* ─── Component ──────────────────────────── */

function AdminAnnouncementsPage() {
  const { user, getAccessToken } = useAuth();
  const { currentSession } = useSession();
  const { showHelp, openHelp, closeHelp } = useToolHelp("admin-announcements");

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 8;

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendConfirmId, setResendConfirmId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([]);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<RecipientOption[]>([]);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Auto-Save State
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const lastLoadedFormStrRef = useRef<string>("");

  /* ── Fetch ──────────────────────── */

  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams();
      params.set("limit", String(ITEMS_PER_PAGE));
      params.set("skip", String((page - 1) * ITEMS_PER_PAGE));
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (selectedLevel !== "all") params.set("target_level", selectedLevel);

      const response = await fetch(getApiUrl(`/api/v1/announcements/?${params}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const items = data.items ?? data;
        const mapped = items.map((item: Announcement & { _id?: string }) => ({
          ...item,
          id: item.id || item._id,
        }));
        setAnnouncements(mapped);
        setTotalCount(data.total ?? items.length);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load announcements"));
    } finally {
      setLoading(false);
    }
  }, [user, getAccessToken, page, searchQuery, selectedLevel]);

  useEffect(() => {
    const debounce = setTimeout(() => fetchAnnouncements(), searchQuery ? 300 : 0);
    return () => clearTimeout(debounce);
  }, [fetchAnnouncements, searchQuery]);

  useEffect(() => {
    if (form.targetAudience !== "specific_students") {
      setRecipientQuery("");
      setRecipientOptions([]);
      return;
    }
    const q = recipientQuery.trim();
    if (q.length < 2) {
      setRecipientOptions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        setRecipientLoading(true);
        const token = await getAccessToken();
        const params = new URLSearchParams({ q, limit: "10" });
        const res = await fetch(getApiUrl(`/api/v1/announcements/recipient-search?${params.toString()}`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setRecipientOptions([]);
          return;
        }
        const data = await res.json();
        setRecipientOptions(data.items ?? []);
      } catch {
        setRecipientOptions([]);
      } finally {
        setRecipientLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [form.targetAudience, recipientQuery, getAccessToken]);

  /* ── Auto-Save Logic ────────────── */

  const saveDraft = useCallback(
    (currentForm: FormState, currentEditingId: string | null, recipients: RecipientOption[]) => {
      if (typeof window === "undefined") return;
      if (isFormEmpty(currentForm)) return;

      const draftKey = currentEditingId ? getEditDraftKey(currentEditingId) : NEW_DRAFT_KEY;
      const payload = {
        form: currentForm,
        selectedRecipients: recipients,
        savedAt: Date.now(),
        savedAtFormatted: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      try {
        localStorage.setItem(draftKey, JSON.stringify(payload));
        setAutoSaveStatus("saved");
        setLastSavedAt(payload.savedAtFormatted);
      } catch (e) {
        console.warn("Failed to auto-save announcement draft:", e);
      }
    },
    []
  );

  // Debounced auto-save on form change (keystroke / field edit)
  useEffect(() => {
    if (!modalOpen) return;
    const currentStr = JSON.stringify(form);
    if (currentStr === lastLoadedFormStrRef.current) return;
    if (isFormEmpty(form)) return;

    setAutoSaveStatus("saving");
    const timer = setTimeout(() => {
      saveDraft(form, editingId, selectedRecipients);
      lastLoadedFormStrRef.current = currentStr;
    }, 1000);

    return () => clearTimeout(timer);
  }, [form, editingId, selectedRecipients, modalOpen, saveDraft]);

  // Periodic interval auto-save (every 15 seconds)
  useEffect(() => {
    if (!modalOpen) return;
    const interval = setInterval(() => {
      const currentStr = JSON.stringify(form);
      if (currentStr !== lastLoadedFormStrRef.current && !isFormEmpty(form)) {
        setAutoSaveStatus("saving");
        saveDraft(form, editingId, selectedRecipients);
        lastLoadedFormStrRef.current = currentStr;
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [form, editingId, selectedRecipients, modalOpen, saveDraft]);

  // Save draft if user tries to close the tab or reload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (modalOpen && !isFormEmpty(form)) {
        saveDraft(form, editingId, selectedRecipients);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [modalOpen, form, editingId, selectedRecipients, saveDraft]);

  /* ── Create / Update ────────────── */

  const openCreate = () => {
    setEditingId(null);
    setFormErrors({});
    setRecipientQuery("");
    setRecipientOptions([]);

    let restored = false;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(NEW_DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.form && !isFormEmpty(parsed.form)) {
            setForm(parsed.form);
            if (parsed.selectedRecipients) {
              setSelectedRecipients(parsed.selectedRecipients);
            }
            setHasRestoredDraft(true);
            setLastSavedAt(parsed.savedAtFormatted || "earlier");
            setAutoSaveStatus("saved");
            lastLoadedFormStrRef.current = JSON.stringify(parsed.form);
            restored = true;
          }
        }
      } catch (e) {
        console.warn("Could not restore draft:", e);
      }
    }

    if (!restored) {
      setForm(EMPTY_FORM);
      setSelectedRecipients([]);
      setHasRestoredDraft(false);
      setLastSavedAt(null);
      setAutoSaveStatus("idle");
      lastLoadedFormStrRef.current = JSON.stringify(EMPTY_FORM);
    }
    setModalOpen(true);
  };

  const openEdit = (a: Announcement) => {
    const annId = a.id || a._id;
    setEditingId(annId);
    setFormErrors({});
    setRecipientQuery("");
    setRecipientOptions([]);

    const baseForm: FormState = {
      title: a.title,
      content: a.content,
      priority: a.priority,
      targetLevels: a.targetLevels ?? [],
      targetAudience: a.targetAudience ?? "all",
      targetUserIds: a.targetUserIds ?? [],
      customEmails: a.customEmails ?? [],
      attachments: a.attachments ?? [],
      isPinned: a.isPinned,
      expiresAt: a.expiresAt ? a.expiresAt.slice(0, 16) : "",
      scheduledFor: a.scheduledFor ? a.scheduledFor.slice(0, 16) : "",
      sendEmail: a.sendEmail !== false,
    };

    let restored = false;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(getEditDraftKey(annId));
        if (raw) {
          const parsed = JSON.parse(raw);
          const draftTime = parsed.savedAt || 0;
          const serverUpdateTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          if (parsed?.form && draftTime >= serverUpdateTime && !isFormEmpty(parsed.form)) {
            const isDifferent =
              parsed.form.title !== a.title ||
              parsed.form.content !== a.content ||
              JSON.stringify(parsed.form) !== JSON.stringify(baseForm);
            if (isDifferent) {
              setForm(parsed.form);
              if (parsed.selectedRecipients) {
                setSelectedRecipients(parsed.selectedRecipients);
              }
              setHasRestoredDraft(true);
              setLastSavedAt(parsed.savedAtFormatted || "earlier");
              setAutoSaveStatus("saved");
              lastLoadedFormStrRef.current = JSON.stringify(parsed.form);
              restored = true;
            }
          }
        }
      } catch (e) {
        console.warn("Could not restore announcement edit draft:", e);
      }
    }

    if (!restored) {
      setForm(baseForm);
      setSelectedRecipients([]);
      setHasRestoredDraft(false);
      setLastSavedAt(null);
      setAutoSaveStatus("idle");
      lastLoadedFormStrRef.current = JSON.stringify(baseForm);
    }
    setModalOpen(true);
  };

  const handleDiscardDraft = () => {
    if (typeof window !== "undefined") {
      const draftKey = editingId ? getEditDraftKey(editingId) : NEW_DRAFT_KEY;
      localStorage.removeItem(draftKey);
    }
    if (editingId) {
      const original = announcements.find((a) => (a.id || a._id) === editingId);
      if (original) {
        const restoredForm: FormState = {
          title: original.title,
          content: original.content,
          priority: original.priority,
          targetLevels: original.targetLevels ?? [],
          targetAudience: original.targetAudience ?? "all",
          targetUserIds: original.targetUserIds ?? [],
          customEmails: original.customEmails ?? [],
          attachments: original.attachments ?? [],
          isPinned: original.isPinned,
          expiresAt: original.expiresAt ? original.expiresAt.slice(0, 16) : "",
          scheduledFor: original.scheduledFor ? original.scheduledFor.slice(0, 16) : "",
          sendEmail: original.sendEmail !== false,
        };
        setForm(restoredForm);
        lastLoadedFormStrRef.current = JSON.stringify(restoredForm);
      } else {
        setForm(EMPTY_FORM);
        lastLoadedFormStrRef.current = JSON.stringify(EMPTY_FORM);
      }
    } else {
      setForm(EMPTY_FORM);
      setSelectedRecipients([]);
      lastLoadedFormStrRef.current = JSON.stringify(EMPTY_FORM);
    }
    setHasRestoredDraft(false);
    setAutoSaveStatus("idle");
    setLastSavedAt(null);
    toast.info("Draft discarded");
  };

  const handleCloseModal = () => {
    if (!isFormEmpty(form)) {
      saveDraft(form, editingId, selectedRecipients);
      toast.info("Draft saved automatically. You can resume editing anytime.", { duration: 3500 });
    }
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setRecipientQuery("");
    setRecipientOptions([]);
    setSelectedRecipients([]);
    setHasRestoredDraft(false);
    setAutoSaveStatus("idle");
    setLastSavedAt(null);
    lastLoadedFormStrRef.current = "";
  };

  const addRecipient = (recipient: RecipientOption) => {
    setForm((prev) => {
      if (prev.targetUserIds.includes(recipient.id)) return prev;
      return { ...prev, targetUserIds: [...prev.targetUserIds, recipient.id] };
    });
    setSelectedRecipients((prev) => (prev.some((u) => u.id === recipient.id) ? prev : [...prev, recipient]));
  };

  const removeRecipient = (userId: string) => {
    setForm((prev) => ({ ...prev, targetUserIds: prev.targetUserIds.filter((id) => id !== userId) }));
    setSelectedRecipients((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleQuickResend = async (announcementId: string) => {
    setResendingId(announcementId);
    try {
      let token = await getAccessToken();
      if (!token) token = await getAccessToken(true);
      const res = await fetch(getApiUrl(`/api/v1/announcements/${announcementId}/resend`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) await throwApiError(res, "resend announcement");
      const data = await res.json();
      toast.success(data.message || "Announcement broadcast resent successfully!");
      fetchAnnouncements();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resend broadcast");
    } finally {
      setResendingId(null);
      setResendConfirmId(null);
    }
  };

  const handleSubmit = async (resend = false) => {
    if (form.targetAudience === "specific_students" && form.targetUserIds.length === 0) {
      setFormErrors((prev) => ({ ...prev, targetUserIds: "Select at least one student" }));
      return;
    }
    if (form.targetAudience === "custom_emails" && form.customEmails.length === 0) {
      toast.error("Please add at least one recipient email address to the custom list");
      return;
    }
    const parsed = AnnouncementSchema.safeParse(form);
    if (!parsed.success) {
      setFormErrors(flattenZodErrors(parsed.error));
      return;
    }
    setFormErrors({});
    setSubmitting(true);

    try {
      let token = await getAccessToken();
      if (!token) {
        token = await getAccessToken(true);
      }
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (editingId) {
        const body: Record<string, unknown> = {
          title: form.title,
          content: form.content,
          priority: form.priority,
          targetLevels: form.targetLevels.length > 0 ? form.targetLevels : null,
          targetAudience: form.targetAudience,
          targetUserIds: form.targetAudience === "specific_students" ? form.targetUserIds : [],
          customEmails: form.targetAudience === "custom_emails" ? form.customEmails : [],
          attachments: form.attachments,
          isPinned: form.isPinned,
          expiresAt: form.expiresAt || null,
          scheduledFor: form.scheduledFor || null,
          sendEmail: form.sendEmail,
          resendNotification: resend,
        };
        const res = await fetch(getApiUrl(`/api/v1/announcements/${editingId}`), { method: "PATCH", headers, body: JSON.stringify(body) });
        if (!res.ok) await throwApiError(res, "update announcement");
        toast.success(
          resend
            ? "Announcement updated & broadcast resent to recipients"
            : "Announcement updated"
        );
      } else {
        if (!currentSession?.id) {
          throw new Error("No active academic session found. Please activate a session first.");
        }
        const body: Record<string, unknown> = {
          title: form.title,
          content: form.content,
          priority: form.priority,
          sessionId: currentSession.id,
          targetLevels: form.targetLevels.length > 0 ? form.targetLevels : null,
          targetAudience: form.targetAudience,
          targetUserIds: form.targetAudience === "specific_students" ? form.targetUserIds : [],
          customEmails: form.targetAudience === "custom_emails" ? form.customEmails : [],
          attachments: form.attachments,
          isPinned: form.isPinned,
          expiresAt: form.expiresAt || null,
          scheduledFor: form.scheduledFor || null,
          sendEmail: form.sendEmail,
          authorId: user?.id ?? "",
        };
        const res = await fetch(getApiUrl("/api/v1/announcements/"), { method: "POST", headers, body: JSON.stringify(body) });
        if (!res.ok) await throwApiError(res, "create announcement");
        toast.success(
          form.targetAudience === "custom_emails"
            ? `Announcement created for ${form.customEmails.length} custom recipient(s)`
            : form.targetAudience === "specific_students"
              ? `Announcement created for ${form.targetUserIds.length} selected student(s)`
              : form.targetLevels.length > 0
                ? `Announcement created for ${form.targetLevels.join(", ")}`
                : "Announcement created"
        );
      }

      // Clear draft on successful save
      if (typeof window !== "undefined") {
        const draftKey = editingId ? getEditDraftKey(editingId) : NEW_DRAFT_KEY;
        localStorage.removeItem(draftKey);
      }
      setHasRestoredDraft(false);
      setAutoSaveStatus("idle");
      setLastSavedAt(null);
      lastLoadedFormStrRef.current = "";

      await fetchAnnouncements();
      mutate("/api/v1/admin/stats");
      setModalOpen(false);
      setForm(EMPTY_FORM);
      setRecipientQuery("");
      setRecipientOptions([]);
      setSelectedRecipients([]);
      setEditingId(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save announcement"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete ─────────────────────── */

  const handleDelete = async (id: string) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/announcements/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) await throwApiError(res, "delete announcement");
      toast.success("Announcement deleted");
      setDeleteConfirmId(null);
      await fetchAnnouncements();
      mutate("/api/v1/admin/stats");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete announcement"));
    }
  };

  /* ── Filter ─────────────────────── */

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const handleSearch = (v: string) => { setSearchQuery(v); setPage(1); };
  const handleLevelFilter = (v: string) => { setSelectedLevel(v); setPage(1); };

  /* ── Stats ──────────────────────── */

  const highCount = announcements.filter((a) => a.priority === "high" || a.priority === "urgent").length;
  const pinnedCount = announcements.filter((a) => a.isPinned).length;

  /* ── Toggle target level ────────── */

  const toggleLevel = (level: string) => {
    setForm((prev) => ({
      ...prev,
      targetLevels: prev.targetLevels.includes(level)
        ? prev.targetLevels.filter((l) => l !== level)
        : [...prev.targetLevels, level],
    }));
  };

  /* ── Render ─────────────────────── */

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ── No Session Warning ─────────────────── */}
        {!currentSession && (
          <div className="bg-coral-light border-[3px] border-coral rounded-2xl p-6 shadow-[4px_4px_0_0_#000]">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-coral/20 flex items-center justify-center flex-shrink-0">
                <svg aria-hidden="true" className="w-5 h-5 text-coral" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-display font-black text-base text-navy mb-1">No Active Session</h4>
                <p className="text-sm text-navy/60">
                  Please create and activate an academic session in the{" "}
                  <a href="/admin/sessions" className="text-coral font-bold hover:underline">Sessions page</a>{" "}
                  before creating announcements.
                </p>
              </div>
            </div>
          </div>
        )}
        <ToolHelpModal toolId="admin-announcements" isOpen={showHelp} onClose={closeHelp} />
        <div className="flex justify-end mb-3">
          <HelpButton onClick={openHelp} />
        </div>
        {/* ── Header ─────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Administration</p>
            <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
              <span className="brush-highlight">Announcements</span>
            </h1>
            <p className="text-sm text-navy/60 mt-1">Create and manage announcements for students</p>
          </div>
          <PermissionGate permission="announcement:create">
            <button
              onClick={openCreate}
              disabled={!currentSession}
              className={`self-start border-[3px] border-navy press-3 press-navy px-6 py-2.5 rounded-2xl font-display font-bold text-sm transition-all flex items-center gap-2 ${
 currentSession
 ?"bg-lime text-navy cursor-pointer"
 :"bg-slate/30 text-slate/50 cursor-not-allowed"
 }`}
            >
              <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
              </svg>
              New Announcement
            </button>
          </PermissionGate>
        </div>

        {/* ── Stats Bento Row ─────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Total</p>
            <p className="font-display font-black text-3xl text-navy">{totalCount}</p>
          </div>
          <div className="bg-coral border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60 mb-1">High Priority</p>
            <p className="font-display font-black text-3xl text-snow">{highCount}</p>
          </div>
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Pinned</p>
            <p className="font-display font-black text-3xl text-navy">{pinnedCount}</p>
          </div>
        </div>

        {/* ── Filters ─────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-navy text-sm placeholder:text-slate transition-all"
            />
          </div>
          <select
            value={selectedLevel}
            onChange={(e) => handleLevelFilter(e.target.value)}
            aria-label="Filter by level"
            className="px-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-navy text-sm appearance-none cursor-pointer"
          >
            <option value="all">All Levels</option>
            {LEVEL_OPTIONS.map((l) => (
              <option key={l} value={l}>{l.replace("L", " Level")}</option>
            ))}
          </select>
        </div>

        {/* ── Announcements Grid ──────── */}
        <div aria-live="polite">
          {loading ? (
            <div className="bg-snow rounded-3xl border-[3px] border-navy p-12 text-center shadow-[4px_4px_0_0_#000]">
              <div className="inline-block w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-navy/60">Loading announcements...</p>
            </div>
          ) : announcements.length === 0 ? (
            <div className="bg-snow rounded-3xl border-[3px] border-navy p-16 text-center shadow-[4px_4px_0_0_#000] space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-sunny-light flex items-center justify-center">
                <svg aria-hidden="true" className="w-8 h-8 text-sunny" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.881 4.345A23.112 23.112 0 0 1 8.25 6H7.5a5.25 5.25 0 0 0-.88 10.427 21.593 21.593 0 0 0 1.378 3.94c.464 1.004 1.674 1.32 2.582.796l.657-.379c.88-.508 1.165-1.593.772-2.468a17.116 17.116 0 0 1-.628-1.607c1.918.258 3.76.75 5.5 1.446A21.727 21.727 0 0 0 18 11.25c0-2.414-.393-4.735-1.119-6.905Z" />
                </svg>
              </div>
              <p className="text-sm text-navy/60 font-medium">No announcements found</p>
              <PermissionGate permission="announcement:create">
                <button
                  onClick={openCreate}
 className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-navy border-[3px] border-lime text-snow text-sm font-bold press-4 press-lime transition-all"
                >
                  Create your first announcement
                </button>
              </PermissionGate>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {announcements.map((a, idx) => {
                const id = a.id || a._id;
                const accentBorders = ["border-l-teal", "border-l-coral", "border-l-lavender", "border-l-sunny"];
                const audience = audienceBadge(a.targetAudience);
                return (
                  <div
                    key={id}
 className={`group bg-snow rounded-3xl border-[3px] border-navy p-6 flex flex-col gap-4 transition-all press-3 press-black ${
                      a.isPinned ? "md:col-span-2 border-l-[6px] " + accentBorders[idx % 4] : ""
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold ${priorityPill(a.priority)}`}>
                        {a.priority}
                      </span>
                      {a.isPinned && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold bg-sunny-light text-sunny">
                          <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                          </svg>
                          Pinned
                        </span>
                      )}
                      {a.isPublished === false && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold bg-lavender-light text-lavender">
                          <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                          </svg>
                          Scheduled{a.scheduledFor ? ` · ${new Date(a.scheduledFor).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                        </span>
                      )}
                      {a.attachments && a.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold bg-teal-light text-teal" title={`${a.attachments.length} attachment(s)`}>
                          <svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          {a.attachments.length} {a.attachments.length === 1 ? "file" : "files"}
                        </span>
                      )}

                      {/* Actions — visible on hover */}
                      <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <PermissionGate permission="announcement:edit">
                          {resendConfirmId === id ? (
                            <div className="flex items-center gap-1 bg-snow border-2 border-navy rounded-xl px-2 py-1 shadow-sm">
                              <span className="text-[10px] font-black uppercase text-navy">Resend?</span>
                              <button
                                onClick={() => handleQuickResend(id)}
                                disabled={resendingId === id}
                                className="px-2 py-0.5 rounded-lg bg-navy text-lime text-xs font-black hover:bg-navy/90"
                              >
                                {resendingId === id ? "..." : "Yes"}
                              </button>
                              <button
                                onClick={() => setResendConfirmId(null)}
                                className="px-2 py-0.5 rounded-lg bg-ghost text-navy/70 text-xs font-bold"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setResendConfirmId(id)}
                              aria-label="Resend broadcast"
                              title="Resend email & notifications to recipients"
                              className="p-2 rounded-xl hover:bg-cloud transition-colors text-navy/60 hover:text-navy"
                            >
                              <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                              </svg>
                            </button>
                          )}
                        </PermissionGate>
                        <PermissionGate permission="announcement:edit">
                          <button
                            onClick={() => openEdit(a)}
                            aria-label="Edit announcement"
                            className="p-2 rounded-xl hover:bg-cloud transition-colors text-navy/60 hover:text-navy"
                          >
                            <svg aria-hidden="true" className="w-4 h-4 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                              <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
                            </svg>
                          </button>
                        </PermissionGate>
                        <PermissionGate permission="announcement:delete">
                          {deleteConfirmId === id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(id)} className="px-3 py-1.5 rounded-xl bg-coral text-snow text-xs font-bold hover:opacity-90 transition-opacity">Confirm</button>
                              <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 rounded-xl bg-cloud text-navy/60 text-xs font-bold">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(id)}
                              aria-label="Delete announcement"
                              className="p-2 rounded-xl hover:bg-coral-light transition-colors"
                            >
                              <svg aria-hidden="true" className="w-4 h-4 text-navy/60 hover:text-coral" viewBox="0 0 24 24" fill="currentColor">
                                <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </PermissionGate>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="font-display font-black text-lg text-navy leading-snug">{a.title}</h3>

                    {/* Content */}
                    <p className="text-sm text-navy/60 leading-relaxed line-clamp-3">{stripHtml(a.content)}</p>

                    {/* Footer */}
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 border-t-[3px] border-navy/10">
                      {audience && (
                        <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${audience.className}`}>
                          {audience.label}
                        </span>
                      )}
                      {a.targetAudience === "specific_students" && (a.targetUserIds?.length ?? 0) > 0 && (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-cloud text-navy/60">
                          {a.targetUserIds?.length} selected
                        </span>
                      )}
                      {a.targetAudience === "custom_emails" && (a.customEmails?.length ?? 0) > 0 && (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-yellow-100 text-yellow-900 border border-yellow-300">
                          {a.customEmails?.length} custom recipient{(a.customEmails?.length ?? 0) === 1 ? "" : "s"}
                        </span>
                      )}
                      {a.targetLevels && a.targetLevels.length > 0 ? (
                        a.targetLevels.map((level) => (
                          <span key={level} className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-cloud text-navy/60">{level}</span>
                        ))
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-cloud text-navy/60">All Levels</span>
                      )}
                      <span className="ml-auto text-xs text-slate font-medium">
                        {a.authorName || "Admin"} &middot; {relativeTime(a.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onPage={setPage} className="mt-5" />
        </div>
      </div>

      {/* ── Create / Edit Modal ───────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/50" onClick={handleCloseModal} />

          <div className="relative w-full max-w-3xl max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-y-auto bg-snow rounded-3xl border-[3px] border-navy shadow-[6px_6px_0_0_#000] p-6 sm:p-8 space-y-6 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="font-display font-black text-xl md:text-2xl text-navy">
                    {editingId ? "Edit Announcement" : "New Announcement"}
                  </h2>
                  {autoSaveStatus === "saving" && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sunny-light text-navy/80 border border-sunny/40 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-sunny animate-pulse" />
                      Saving draft...
                    </span>
                  )}
                  {autoSaveStatus === "saved" && lastSavedAt && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                      <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      Draft saved {lastSavedAt}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate mt-0.5">Craft dynamic, personalized updates with rich formatting and media</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 rounded-xl hover:bg-cloud transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <svg aria-hidden="true" className="w-5 h-5 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Restored Draft Banner */}
            {hasRestoredDraft && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-sunny-light/60 border-2 border-sunny/40 text-xs text-navy">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-sunny shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.59L7.3 9.24a.75.75 0 00-1.1 1.02l3.25 3.5a.75.75 0 001.1 0l3.25-3.5a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75z" clipRule="evenodd" />
                  </svg>
                  <span>
                    Auto-saved draft restored from <strong>{lastSavedAt || "earlier"}</strong>.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="text-xs font-bold text-coral hover:underline shrink-0 cursor-pointer"
                >
                  Discard draft
                </button>
              </div>
            )}

            {/* Title (Rich Title Editor with Variable Tags) */}
            <RichTitleEditor
              value={form.title}
              onChange={(title) => {
                setForm((f) => ({ ...f, title }));
                setFormErrors((p) => ({ ...p, title: undefined }));
              }}
              error={formErrors.title}
              availableVariables={[
                { label: "First Name", value: "{{first_name}}", description: "Student's first name (e.g. Alex)" },
                { label: "Full Name", value: "{{student_name}}", description: "Full student name (e.g. Alex Adeyemi)" },
                { label: "Matric No", value: "{{matric_no}}", description: "Matriculation number" },
                { label: "Level", value: "{{level}}", description: "Academic level (e.g. 300L)" },
              ]}
            />

            {/* Content (Rich Text Editor + AI Draft Studio Trigger) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-sm font-bold text-navy flex items-center gap-2">
                  Content
                  <span className="text-xs text-slate font-normal">(Rich Text &amp; Personalization)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAiModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-lime/40 hover:bg-lime border-[2px] border-navy text-xs font-bold text-navy transition-all shadow-[2px_2px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                  Draft with AI Studio
                </button>
              </div>
              <RichTextEditor
                value={form.content}
                onChange={(content) => {
                  setForm((f) => ({ ...f, content }));
                  setFormErrors((p) => ({ ...p, content: undefined }));
                }}
                error={formErrors.content}
                minHeight="min-h-[380px]"
                availableVariables={[
                  { label: "First Name", value: "{{first_name}}", description: "Student's first name (e.g. Alex)" },
                  { label: "Full Name", value: "{{student_name}}", description: "Full student name (e.g. Alex Adeyemi)" },
                  { label: "Matric No", value: "{{matric_no}}", description: "Matriculation number" },
                  { label: "Level", value: "{{level}}", description: "Academic level (e.g. 300L)" },
                  { label: "Department", value: "{{department}}", description: "Department name" },
                  { label: "Email", value: "{{email}}", description: "Student email address" },
                ]}
              />
              {formErrors.content && <p className="text-xs text-coral font-bold">{formErrors.content}</p>}
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-navy">Priority</label>
              <div className="flex flex-wrap gap-2">
                {(["low", "normal", "high", "urgent"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, priority: p }))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border-[3px] transition-colors ${
                      form.priority === p
                        ? "bg-navy border-lime text-snow"
                        : "border-navy/20 text-navy/60 hover:border-navy/40"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Audience */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-navy">Audience</label>
              <div className="flex flex-wrap gap-2">
                {AUDIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      targetAudience: opt.value,
                      targetLevels: ["all", "ipe", "external", "specific_levels"].includes(opt.value) ? f.targetLevels : [],
                      targetUserIds: opt.value === "specific_students" ? f.targetUserIds : [],
                    }))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border-[3px] transition-colors ${
                      form.targetAudience === opt.value
                        ? "bg-navy border-lime text-snow"
                        : "border-navy/20 text-navy/60 hover:border-navy/40"
                    }`}
                    title={opt.desc}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Levels */}
            {["all", "ipe", "external", "specific_levels"].includes(form.targetAudience) && (
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-navy">Target Levels</label>
                <p className="text-xs text-slate">Leave empty to target all levels</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {LEVEL_OPTIONS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => toggleLevel(level)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border-[3px] transition-colors ${
                        form.targetLevels.includes(level)
                          ? "bg-navy border-lime text-snow"
                          : "border-navy/20 text-navy/60 hover:border-navy/40"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.targetAudience === "specific_students" && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-navy">Select Students</label>
                <input
                  type="text"
                  value={recipientQuery}
                  onChange={(e) => {
                    setRecipientQuery(e.target.value);
                    setFormErrors((prev) => ({ ...prev, targetUserIds: undefined }));
                  }}
                  placeholder="Search by name, matric number, or email"
                  className={`w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] text-navy text-sm placeholder:text-slate transition-all ${formErrors.targetUserIds ? "border-coral" : "border-navy"}`}
                />
                {formErrors.targetUserIds && <p className="text-xs text-coral font-bold">{formErrors.targetUserIds}</p>}
                {recipientLoading && <p className="text-xs text-slate">Searching students...</p>}
                {!recipientLoading && recipientOptions.length > 0 && (
                  <div className="max-h-36 overflow-y-auto rounded-2xl border-[2px] border-navy/20 bg-snow p-2 space-y-1">
                    {recipientOptions.map((option) => {
                      const selected = form.targetUserIds.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => addRecipient(option)}
                          disabled={selected}
                          className={`w-full text-left px-3 py-2 rounded-xl border-[2px] text-xs transition-colors ${selected ? "bg-cloud border-navy/20 text-slate" : "bg-ghost border-navy/15 hover:border-navy text-navy"}`}
                        >
                          <p className="font-bold">{option.firstName} {option.lastName}</p>
                          <p className="text-slate">
                            {option.email}
                            {option.matricNumber ? ` · ${option.matricNumber}` : ""}
                            {option.gender ? ` · ${option.gender === "male" ? "Male" : "Female"}` : ""}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
                {form.targetUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.targetUserIds.map((userId) => (
                      <span key={userId} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cloud text-[11px] font-bold text-navy">
                        {(() => {
                          const selected = selectedRecipients.find((u) => u.id === userId);
                          if (selected) return `${selected.firstName} ${selected.lastName}`.trim() || selected.email;
                          return `${userId.slice(0, 8)}…`;
                        })()}
                        <button type="button" onClick={() => removeRecipient(userId)} className="text-coral hover:text-navy" aria-label="Remove recipient">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {form.targetAudience === "custom_emails" && (
              <CustomEmailListManager
                emails={form.customEmails}
                onChange={(emails) => setForm((prev) => ({ ...prev, customEmails: emails }))}
                disabled={submitting}
              />
            )}

            {/* Attachments Section */}
            <AnnouncementAttachments
              attachments={form.attachments}
              onChange={(attachments) => setForm((f) => ({ ...f, attachments }))}
            />

            {/* Options Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm((f) => ({ ...f, isPinned: !f.isPinned }))}
                  className={`relative w-11 h-6 rounded-full transition-colors border-[2px] ${
                    form.isPinned ? "bg-navy border-lime" : "bg-cloud border-navy/20"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full shadow transition-transform ${
                    form.isPinned ? "bg-lime left-5" : "bg-navy/30 left-0.5"
                  }`} />
                </div>
                <span className="text-sm text-navy font-medium">Pin to top</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm((f) => ({ ...f, sendEmail: !f.sendEmail }))}
                  className={`relative w-11 h-6 rounded-full transition-colors border-[2px] ${
                    form.sendEmail ? "bg-navy border-lime" : "bg-cloud border-navy/20"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full shadow transition-transform ${
                    form.sendEmail ? "bg-lime left-5" : "bg-navy/30 left-0.5"
                  }`} />
                </div>
                <span className="text-sm text-navy font-medium">Send email notification</span>
              </label>
            </div>

            {/* Scheduling Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="ann-scheduled" className="text-xs text-slate font-bold">Schedule for later (optional)</label>
                <input
                  id="ann-scheduled"
                  type="datetime-local"
                  value={form.scheduledFor}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledFor: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-ghost border-[3px] border-navy text-navy text-sm transition-all"
                />
              {form.scheduledFor && (
                  <p className="text-[10px] text-sunny font-bold flex items-center gap-1">
                    <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                    </svg>
                    Will be published automatically at scheduled time
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="ann-expires" className="text-xs text-slate font-bold">Expires at (optional)</label>
                <input
                  id="ann-expires"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-ghost border-[3px] border-navy text-navy text-sm transition-all"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t-[3px] border-navy/10">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(true)}
                className="px-4 py-2.5 rounded-2xl border-[3px] border-navy/30 bg-snow text-navy text-sm font-bold hover:border-navy hover:bg-cloud transition-colors flex items-center gap-2 cursor-pointer shadow-[2px_2px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5"
              >
                <svg className="w-4 h-4 text-navy/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview &amp; Test
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 rounded-2xl border-[3px] border-navy text-sm font-bold text-navy hover:bg-cloud transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                {editingId ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSubmit(false)}
                      disabled={submitting}
                      className="px-5 py-2.5 rounded-2xl border-[3px] border-navy bg-snow text-navy text-sm font-bold hover:bg-cloud disabled:opacity-40 transition-all cursor-pointer shadow-[2px_2px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5"
                      title="Update announcement quietly without re-sending emails or notifications"
                    >
                      {submitting ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmit(true)}
                      disabled={submitting}
                      className="px-6 py-2.5 rounded-2xl bg-navy border-[3px] border-lime text-snow text-sm font-bold press-4 press-lime disabled:opacity-40 transition-all cursor-pointer flex items-center gap-2"
                      title="Save changes and re-dispatch emails & in-app notifications to recipients"
                    >
                      <svg className="w-4 h-4 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                      {submitting ? "Resending..." : "Save & Resend"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-2xl bg-navy border-[3px] border-lime text-snow text-sm font-bold press-4 press-lime disabled:opacity-40 transition-all cursor-pointer"
                  >
                    {submitting ? "Publishing..." : form.scheduledFor ? "Schedule" : "Publish"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Draft Studio Modal ───────── */}
      <AnnouncementAIDraftModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        currentTitle={form.title}
        currentContent={form.content}
        audience={form.targetAudience}
        targetLevels={form.targetLevels}
        priority={form.priority}
        onApply={({ title, content }) => {
          setForm((prev) => ({
            ...prev,
            title: title ?? prev.title,
            content: content ?? prev.content,
          }));
          setFormErrors({});
        }}
      />

      {/* ── Preview & Test Modal ───────── */}
      <AnnouncementPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title={form.title}
        content={form.content}
        attachments={form.attachments}
        priority={form.priority}
        audience={form.targetAudience}
        scheduledFor={form.scheduledFor}
      />
    </>
  );
}

export default withAuth(AdminAnnouncementsPage, {
  anyPermission: ["announcement:create", "announcement:edit", "announcement:view"],
});