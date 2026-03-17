"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getApiUrl,
  listBankAccounts,
  submitEventBankTransfer,
  checkTransactionReference,
  NIGERIAN_BANKS,
  BankAccount,
} from "@/lib/api";
import { toast } from "sonner";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import FullScreenLoader from "@/components/ui/FullScreenLoader";
import dynamic from "next/dynamic";
import { useDrive } from "@/hooks/useDrive";
import type { DriveItem } from "@/lib/api/drive";

const EventCalendarView = dynamic(() => import("@/components/dashboard/EventCalendarView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px]">
      <div className="w-8 h-8 border-[3px] border-navy border-t-lime rounded-full animate-spin" />
    </div>
  ),
});

const DriveExplorer = dynamic(() => import("@/components/dashboard/drive/DriveExplorer"), { ssr: false });
const ResourceViewer = dynamic(() => import("@/components/dashboard/drive/ResourceViewer"), { ssr: false });

/* ─── Types ─────────────────────────────────────────────────────── */

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate?: string;
  location: string;
  category: string;
  maxAttendees?: number;
  imageUrl?: string;
  requiresPayment: boolean;
  paymentAmount?: number;
  hasPaid?: boolean;
  attendeeCount: number;
  organizer: {
    firstName: string;
    lastName: string;
    role: string;
  };
}

interface EventTransferMeta {
  status?: "pending" | "approved" | "rejected";
  adminNote?: string | null;
  transactionReference?: string | null;
  receiptImageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface GalleryAlbumMeta {
  title: string;
  eventDate?: string;
  badge?: string;
  featured?: boolean;
  description?: string;
}

/* ─── Constants ─────────────────────────────────────────────────── */

const CATEGORIES = ["All", "Academic", "Social", "Career", "Workshop", "General"];

const EVENT_GALLERY_FOLDER_ID = process.env.NEXT_PUBLIC_EVENTS_GALLERY_FOLDER_ID?.trim() || "";
const EVENT_GALLERY_FOLDER_NAME = "Event Gallery";
const EVENT_GALLERY_FEATURED_ALBUM_ID = process.env.NEXT_PUBLIC_EVENTS_GALLERY_FEATURED_ALBUM_ID?.trim() || "";
const EVENT_GALLERY_RECENT_KEY = "events_gallery_recent_photos";
const MAX_GALLERY_RECENT = 12;
const MAX_ALBUM_COVERS = 12;
const EVENT_GALLERY_ALBUM_META_ENV = process.env.NEXT_PUBLIC_EVENTS_GALLERY_ALBUM_META?.trim() || "";

const EVENT_GALLERY_ALBUM_META: Record<string, GalleryAlbumMeta> = {
  // "drive-folder-id": {
  //   title: "IESA Dinner Night 2026",
  //   eventDate: "Feb 14, 2026",
  //   badge: "Dinner Night",
  //   featured: true,
  //   description: "Highlights from the annual dinner and awards.",
  // },
};

const parseGalleryAlbumMeta = (input: string): Record<string, GalleryAlbumMeta> => {
  if (!input) return {};
  try {
    const parsed = JSON.parse(input) as Record<string, GalleryAlbumMeta>;
    if (!parsed || typeof parsed !== "object") return {};
    const normalized: Record<string, GalleryAlbumMeta> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!key || !value || typeof value !== "object") continue;
      const title = typeof value.title === "string" && value.title.trim() ? value.title.trim() : "";
      if (!title) continue;
      normalized[key] = {
        title,
        eventDate: typeof value.eventDate === "string" ? value.eventDate : undefined,
        badge: typeof value.badge === "string" ? value.badge : undefined,
        featured: typeof value.featured === "boolean" ? value.featured : undefined,
        description: typeof value.description === "string" ? value.description : undefined,
      };
    }
    return normalized;
  } catch {
    return {};
  }
};

const EVENT_GALLERY_ALBUM_META_FROM_ENV = parseGalleryAlbumMeta(EVENT_GALLERY_ALBUM_META_ENV);

const categoryPills: Record<string, { active: string }> = {
  All: { active: "bg-navy text-snow border-lime" },
  Academic: { active: "bg-lavender text-snow border-navy" },
  Social: { active: "bg-coral text-snow border-navy" },
  Career: { active: "bg-teal text-snow border-navy" },
  Workshop: { active: "bg-sunny text-navy border-navy" },
  General: { active: "bg-navy text-snow border-lime" },
};

const cardAccents = [
  { header: "bg-coral", dateBg: "bg-snow/15", dateText: "text-snow", catBg: "bg-snow/20", catText: "text-snow", border: "border-navy" },
  { header: "bg-lavender", dateBg: "bg-snow/15", dateText: "text-snow", catBg: "bg-snow/20", catText: "text-snow", border: "border-navy" },
  { header: "bg-teal", dateBg: "bg-navy/15", dateText: "text-navy", catBg: "bg-navy/15", catText: "text-navy", border: "border-navy" },
  { header: "bg-navy", dateBg: "bg-teal/20", dateText: "text-snow", catBg: "bg-snow/15", catText: "text-snow/80", border: "border-lime" },
  { header: "bg-sunny", dateBg: "bg-navy/10", dateText: "text-navy", catBg: "bg-navy/10", catText: "text-navy", border: "border-navy" },
];

/* ─── Helpers ───────────────────────────────────────────────────── */

const formatTime = (dateString: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(dateString));

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateString));

const formatAlbumDate = (dateString?: string | null): string | undefined => {
  if (!dateString) return undefined;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
};

const toTitleCase = (value: string): string =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const inferAlbumMetaFromName = (folderName: string): Partial<GalleryAlbumMeta> => {
  const normalized = folderName.replace(/[_-]+/g, " ").trim();
  const title = toTitleCase(normalized);

  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  const eventDate = yearMatch ? yearMatch[1] : undefined;

  const nonYearTokens = normalized
    .split(" ")
    .filter((token) => token && !/^20\d{2}$/.test(token));
  const badge = nonYearTokens.length > 0 ? toTitleCase(nonYearTokens.slice(0, 2).join(" ")) : "Event Album";

  return {
    title: title || folderName,
    badge,
    eventDate,
  };
};

/* ─── Component ─────────────────────────────────────────────────── */

function EventsPage() {
  const { user, getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("events");
  const drive = useDrive("events_gallery_drive", { enableRecent: false, enableProgress: false });
  const navigateDriveFolder = drive.navigateFolder;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  // Payment verification state — shown while checking with Paystack after redirect
  const [verifying, setVerifying] = useState(false);
  // Prevents double-fetch when verifyEventPayment clears the URL via router.replace
  const skipFetch = useRef(false);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeSubPage, setActiveSubPage] = useState<"upcoming" | "gallery">("upcoming");
  const [viewMode, setViewMode] = useState<"list" | "calendar">(() => {
    const v = searchParams.get("view");
    return v === "calendar" ? "calendar" : "list";
  });
  const galleryInitializedRef = useRef(false);
  const [registeredEvents, setRegisteredEvents] = useState<Set<string>>(new Set());
  const [paidEvents, setPaidEvents] = useState<Set<string>>(new Set());
  const [paymentRefs, setPaymentRefs] = useState<Record<string, string>>({});
  const [pendingTransfers, setPendingTransfers] = useState<Set<string>>(new Set());
  const [eventTransfers, setEventTransfers] = useState<Record<string, EventTransferMeta>>({});
  const [registering, setRegistering] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  // Payment method modal
  const [payModalEvent, setPayModalEvent] = useState<Event | null>(null);
  // Bank transfer modal
  const [bankTransferEvent, setBankTransferEvent] = useState<Event | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferForm, setTransferForm] = useState({
    bankAccountId: "",
    senderName: "",
    senderBank: "",
    transactionReference: "",
    transferDate: new Date().toISOString().split("T")[0],
    narration: "",
  });
  const [downloadingReceipt, setDownloadingReceipt] = useState<string | null>(null);
  const [downloadingTicket, setDownloadingTicket] = useState<string | null>(null);
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  // Platform settings
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(true);
  // Reference duplicate check
  const [checkingRef, setCheckingRef] = useState(false);
  const [refExistsError, setRefExistsError] = useState("");
  // Confirmation modal for event bank transfer
  const [showConfirmTransfer, setShowConfirmTransfer] = useState(false);
  const [albumCoverMap, setAlbumCoverMap] = useState<Record<string, DriveItem | null>>({});
  const [albumCoverLoading, setAlbumCoverLoading] = useState(false);
  const [galleryRecentPhotos, setGalleryRecentPhotos] = useState<DriveItem[]>([]);
  const albumCoverFetchKeyRef = useRef("");

  /* ─── Reset on bfcache restore (user pressed browser back from Paystack) ─── */
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Page restored from bfcache — clear stale processing state
        setPaying(null);
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // Download receipt PDF
  const downloadReceipt = async (reference: string) => {
    try {
      setDownloadingReceipt(reference);
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/paystack/receipt/pdf?reference=${encodeURIComponent(reference)}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to download receipt");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `IESA_Receipt_${reference}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Receipt Downloaded", { description: "Your payment receipt has been downloaded successfully." });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to download receipt";
      toast.error("Download Failed", { description: errorMessage });
    } finally {
      setDownloadingReceipt(null);
    }
  };

  // Download ticket PDF
  const downloadTicket = async (eventId: string, reference: string) => {
    try {
      setDownloadingTicket(reference);
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/events/${eventId}/ticket/pdf?reference=${encodeURIComponent(reference)}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to download ticket");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `IESA_Ticket_${eventId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Ticket Downloaded", { description: "Your event ticket has been downloaded successfully." });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to download ticket";
      toast.error("Download Failed", { description: errorMessage });
    } finally {
      setDownloadingTicket(null);
    }
  };

  useEffect(() => {
    if (user) {
      // Check if returning from payment
      const paymentRef = searchParams.get("payment_ref");
      if (paymentRef) {
        verifyEventPayment(paymentRef);
      } else {
        if (skipFetch.current) {
          // verifyEventPayment already refreshed data; skip this duplicate effect run
          skipFetch.current = false;
          return;
        }
        fetchEvents();
        fetchRegistrations();
        fetchBankAccounts();
        fetchPlatformSettings();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  useEffect(() => {
    if (activeSubPage !== "gallery") return;
    if (!EVENT_GALLERY_FOLDER_ID) return;

    const inGalleryScope =
      drive.folderId === EVENT_GALLERY_FOLDER_ID ||
      drive.breadcrumbs.some((crumb) => crumb.id === EVENT_GALLERY_FOLDER_ID);

    if (!inGalleryScope) {
      navigateDriveFolder(EVENT_GALLERY_FOLDER_ID, EVENT_GALLERY_FOLDER_NAME);
      galleryInitializedRef.current = true;
      albumCoverFetchKeyRef.current = "";
      return;
    }

    galleryInitializedRef.current = true;
  }, [activeSubPage, navigateDriveFolder, drive.folderId, drive.breadcrumbs]);

  useEffect(() => {
    if (activeSubPage !== "gallery") return;
    if (!EVENT_GALLERY_FOLDER_ID) return;
    if (!drive.searchQuery) return;
    drive.setSearchQuery("");
  }, [activeSubPage, drive.searchQuery, drive.setSearchQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(EVENT_GALLERY_RECENT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as DriveItem[];
      if (Array.isArray(parsed)) {
        setGalleryRecentPhotos(parsed.filter((item) => item && typeof item.id === "string"));
      }
    } catch {
      // ignore malformed local cache
    }
  }, []);

  const upsertGalleryRecentPhoto = useCallback((item: DriveItem) => {
    if (item.isFolder || item.fileType !== "image") return;
    setGalleryRecentPhotos((prev) => {
      const next = [item, ...prev.filter((p) => p.id !== item.id)].slice(0, MAX_GALLERY_RECENT);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(EVENT_GALLERY_RECENT_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const fetchPlatformSettings = async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/settings"), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setOnlinePaymentEnabled(data.onlinePaymentEnabled ?? true);
      }
    } catch {
      // non-critical; default stays true
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const accounts = await listBankAccounts(true);
      setBankAccounts(accounts);
    } catch {
      // non-critical
    }
  };

  const fetchEvents = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/events/?upcoming_only=true"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      const items = data.items ?? data;
      const mappedData = items.map((item: Event & { _id?: string }) => ({
        ...item,
        id: item.id || item._id,
      }));
      setEvents(mappedData);
      // Batch-fetch payment status for all paid events in one call
      const paidEventIds = mappedData
        .filter((e: Event) => e.requiresPayment)
        .map((e: Event) => e.id);

      const paidSet = new Set<string>();
      const pendingSet = new Set<string>();
      const refs: Record<string, string> = {};
      const transferMeta: Record<string, EventTransferMeta> = {};

      // Seed with inline hasPaid flags from list response
      for (const e of mappedData) {
        if (e.requiresPayment && e.hasPaid) paidSet.add(e.id);
      }

      if (paidEventIds.length > 0) {
        try {
          const batchRes = await fetch(
            getApiUrl(`/api/v1/events/batch-payment-status?event_ids=${paidEventIds.join(",")}`),
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (batchRes.ok) {
            const statusMap = await batchRes.json();
            for (const [eid, s] of Object.entries(statusMap) as [
              string,
              {
                hasPaid: boolean;
                paymentReference?: string;
                hasPendingTransfer: boolean;
                latestTransfer?: EventTransferMeta;
              }
            ][]) {
              if (s.hasPaid) paidSet.add(eid);
              if (s.paymentReference) refs[eid] = s.paymentReference;
              if (s.hasPendingTransfer) pendingSet.add(eid);
              if (s.latestTransfer) transferMeta[eid] = s.latestTransfer;
            }
          }
        } catch { /* non-critical */ }
      }
      
      setPaidEvents(paidSet);
      setPaymentRefs(refs);
      setPendingTransfers(pendingSet);
      setEventTransfers(transferMeta);
    } catch (err) {
      setError("Failed to load events. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrations = async () => {
    if (!user) return;
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/events/registrations/me"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const eventIds = await response.json();
        setRegisteredEvents(new Set(eventIds));
      }
    } catch (err) {
    }
  };

  const handleRegister = async (eventId: string) => {
    if (!user) return;
    try {
      setRegistering(eventId);
      const token = await getAccessToken();
      const response = await fetch(getApiUrl(`/api/v1/events/${eventId}/register`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to register");
      }
      setRegisteredEvents((prev) => new Set([...prev, eventId]));
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, attendeeCount: e.attendeeCount + 1 } : e)));
      toast.success("Registered!", { description: "You've been registered for this event" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to register for event";
      toast.error("Registration Failed", { description: message });
    } finally {
      setRegistering(null);
    }
  };

  const handleUnregister = async (eventId: string) => {
    if (!user) return;
    try {
      setRegistering(eventId);
      const token = await getAccessToken();
      const response = await fetch(getApiUrl(`/api/v1/events/${eventId}/register`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to unregister");
      setRegisteredEvents((prev) => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, attendeeCount: Math.max(0, e.attendeeCount - 1) } : e)));
      toast.success("Unregistered", { description: "You've been removed from this event" });
    } catch (err) {
      toast.error("Unregister Failed", { description: "Failed to unregister from event" });
    } finally {
      setRegistering(null);
    }
  };

  /* ─── Event Payment Functions ─── */

  const handlePayForEvent = async (event: Event) => {
    if (!user || paying) return;
    setPaying(event.id);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/events/${event.id}/pay`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to initialize payment");
      }
      const data = await res.json();
      // Redirect to Paystack payment page
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error("No payment URL returned");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to initiate payment";
      toast.error("Payment Error", { description: message });
      setPaying(null);
    }
  };

  const handleBankTransferSubmit = () => {
    if (!bankTransferEvent || transferSubmitting) return;

    if (!transferForm.bankAccountId || !transferForm.senderName || !transferForm.senderBank
        || !transferForm.transferDate) {
      toast.error("Missing Fields", { description: "Please fill in all required fields" });
      return;
    }
    if (!receiptImage) {
      toast.error("Receipt Required", { description: "Please upload your receipt screenshot before submitting." });
      return;
    }
    if (refExistsError) {
      toast.error("Duplicate Reference", { description: "Please fix the transaction reference before submitting." });
      return;
    }
    setShowConfirmTransfer(true);
  };

  const doConfirmedEventTransferSubmit = async () => {
    if (!bankTransferEvent || transferSubmitting) return;
    if (!receiptImage) {
      toast.error("Receipt Required", { description: "Please upload your receipt screenshot before submitting." });
      return;
    }
    setShowConfirmTransfer(false);
    setTransferSubmitting(true);
    try {
      const result = await submitEventBankTransfer(bankTransferEvent.id, {
        bankAccountId: transferForm.bankAccountId,
        senderName: transferForm.senderName,
        senderBank: transferForm.senderBank,
        transactionReference: transferForm.transactionReference.trim() || undefined,
        transferDate: transferForm.transferDate,
        narration: transferForm.narration || undefined,
      });

      if (!result?._id) {
        throw new Error("Transfer submitted without an ID. Please try again.");
      }

      const formData = new FormData();
      formData.append("file", receiptImage);
      const token = await getAccessToken();
      const uploadRes = await fetch(getApiUrl(`/api/v1/bank-transfers/${result._id}/upload-receipt`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!uploadRes.ok) {
        let uploadMessage = "Failed to upload receipt screenshot";
        try {
          const uploadError = await uploadRes.json();
          uploadMessage = uploadError?.detail || uploadMessage;
        } catch {
          // Keep default message
        }
        throw new Error(uploadMessage);
      }

      toast.success("Transfer Submitted", { description: "Your bank transfer proof has been submitted for admin review." });
      setReceiptImage(null);
      setBankTransferEvent(null);
      setPendingTransfers(prev => new Set([...prev, bankTransferEvent.id]));
      await fetchEvents();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to submit transfer proof";
      toast.error("Submission Failed", { description: msg });
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleEventReferenceBlur = async () => {
    const ref = transferForm.transactionReference.trim();
    if (!ref) return;
    setCheckingRef(true);
    setRefExistsError("");
    try {
      const result = await checkTransactionReference(ref);
      if (result.exists) {
        setRefExistsError("This reference has already been used. Please check and enter the correct reference.");
      }
    } catch {
      // non-critical
    } finally {
      setCheckingRef(false);
    }
  };

  const openPaymentModal = (event: Event) => {
    setPayModalEvent(event);
  };

  const openBankTransfer = (event: Event) => {
    setPayModalEvent(null);
    setTransferForm({
      bankAccountId: bankAccounts[0]?._id || "",
      senderName: user ? `${user.firstName} ${user.lastName}`.trim() : "",
      senderBank: "",
      transactionReference: "",
      transferDate: new Date().toISOString().split("T")[0],
      narration: "",
    });
    setRefExistsError("");
    setReceiptImage(null);
    setShowConfirmTransfer(false);
    setBankTransferEvent(event);
  };

  const verifyEventPayment = async (reference: string) => {
    setVerifying(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/paystack/verify/${reference}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to verify payment");
      const data = await res.json();
      if (data.status === "success") {
        toast.success("Payment Verified", { description: "Your event payment was successful! You are now registered." });
      } else if (data.status === "failed") {
        toast.error("Payment Declined", { description: "Your payment was declined. Please try again or use a different payment method." });
      } else if (data.status === "abandoned") {
        toast.warning("Payment Cancelled", { description: "You cancelled the payment. No charges were made." });
      } else {
        toast.warning("Payment Pending", { description: `Your payment is being processed. Please check back shortly.` });
      }
    } catch (err) {
      toast.error("Verification Failed", { description: "Could not verify your event payment. Please check your payment history or contact support." });
    } finally {
      // Tell the useEffect not to re-fetch when router.replace fires
      skipFetch.current = true;
      router.replace("/dashboard/events");
      setVerifying(false);
      setPaying(null);
      // Refresh ALL data regardless of outcome (page re-mounts fresh after redirect)
      await fetchEvents();
      await fetchRegistrations();
      fetchBankAccounts();
      fetchPlatformSettings();
    }
  };

  const filteredEvents = activeCategory === "All" ? events : events.filter((e) => e.category === activeCategory);

  const galleryFolderIndex = EVENT_GALLERY_FOLDER_ID
    ? drive.breadcrumbs.findIndex((crumb) => crumb.id === EVENT_GALLERY_FOLDER_ID)
    : -1;
  const galleryBreadcrumbs =
    EVENT_GALLERY_FOLDER_ID && galleryFolderIndex >= 0
      ? [{ id: EVENT_GALLERY_FOLDER_ID, name: EVENT_GALLERY_FOLDER_NAME }, ...drive.breadcrumbs.slice(galleryFolderIndex + 1)]
      : drive.breadcrumbs;

  const handleGalleryNavigateFolder = (folderId: string | null, name?: string) => {
    if (!EVENT_GALLERY_FOLDER_ID) return;
    if (folderId === null) {
      if (galleryFolderIndex >= 0) {
        drive.navigateFolder(EVENT_GALLERY_FOLDER_ID);
      } else {
        drive.navigateFolder(EVENT_GALLERY_FOLDER_ID, EVENT_GALLERY_FOLDER_NAME);
      }
      return;
    }
    drive.navigateFolder(folderId, name);
  };

  const handleGalleryGoBack = () => {
    if (!EVENT_GALLERY_FOLDER_ID) {
      drive.goBack();
      return;
    }
    if (drive.folderId === EVENT_GALLERY_FOLDER_ID) return;
    drive.goBack();
  };

  const galleryVisibleItems = drive.searchResults ?? drive.items;
  const galleryFileSequence = galleryVisibleItems.filter((item) => !item.isFolder);
  const currentGalleryFileIndex = drive.viewingFile
    ? galleryFileSequence.findIndex((item) => item.id === drive.viewingFile?.id)
    : -1;
  const galleryFolders = drive.items.filter((item) => item.isFolder);
  const getAlbumMeta = (folder: DriveItem): GalleryAlbumMeta => {
    const fromEnv = EVENT_GALLERY_ALBUM_META_FROM_ENV[folder.id];
    const fromCode = EVENT_GALLERY_ALBUM_META[folder.id];
    const cover = albumCoverMap[folder.id];
    const inferred = inferAlbumMetaFromName(folder.name);

    const autoDate =
      formatAlbumDate(cover?.modifiedTime) ||
      formatAlbumDate(folder.modifiedTime) ||
      inferred.eventDate;

    const baseAuto: GalleryAlbumMeta = {
      title: inferred.title || folder.name,
      badge: inferred.badge || "Event Album",
      eventDate: autoDate,
      description: inferred.description,
      featured: inferred.featured,
    };

    if (fromEnv) {
      return {
        ...baseAuto,
        ...fromEnv,
        title: fromEnv.title || baseAuto.title,
      };
    }

    if (fromCode) {
      return {
        ...baseAuto,
        ...fromCode,
        title: fromCode.title || baseAuto.title,
      };
    }

    return {
      ...baseAuto,
    };
  };

  const newestFolderByModifiedTime = [...galleryFolders]
    .filter((folder) => !!folder.modifiedTime)
    .sort((a, b) => {
      const at = new Date(a.modifiedTime || "").getTime();
      const bt = new Date(b.modifiedTime || "").getTime();
      return bt - at;
    })[0];

  const featuredAlbum =
    (EVENT_GALLERY_FEATURED_ALBUM_ID
      ? galleryFolders.find((folder) => folder.id === EVENT_GALLERY_FEATURED_ALBUM_ID)
      : undefined) ||
    galleryFolders.find((folder) => getAlbumMeta(folder).featured) ||
    newestFolderByModifiedTime ||
    galleryFolders[0] ||
    null;
  const nonFeaturedAlbums = galleryFolders.filter((folder) => !featuredAlbum || folder.id !== featuredAlbum.id);
  const galleryFoldersCount = galleryVisibleItems.filter((item) => item.isFolder).length;
  const galleryImagesCount = galleryVisibleItems.filter((item) => !item.isFolder && item.fileType === "image").length;
  const galleryPreviewableCount = galleryVisibleItems.filter((item) => !item.isFolder && item.previewable).length;

  const openGalleryItem = (item: DriveItem) => {
    drive.openFile(item);
    upsertGalleryRecentPhoto(item);
  };

  const openPrevGalleryFile = () => {
    if (currentGalleryFileIndex <= 0) return;
    const prev = galleryFileSequence[currentGalleryFileIndex - 1];
    if (prev) openGalleryItem(prev);
  };

  const openNextGalleryFile = () => {
    if (currentGalleryFileIndex < 0 || currentGalleryFileIndex >= galleryFileSequence.length - 1) return;
    const next = galleryFileSequence[currentGalleryFileIndex + 1];
    if (next) openGalleryItem(next);
  };

  useEffect(() => {
    if (activeSubPage !== "gallery") return;
    if (!EVENT_GALLERY_FOLDER_ID) return;
    if (drive.folderId !== EVENT_GALLERY_FOLDER_ID) return;

    const folders = drive.items.filter((item) => item.isFolder).slice(0, MAX_ALBUM_COVERS);
    const folderFetchKey = folders.map((folder) => folder.id).join("|");

    if (folders.length === 0) {
      albumCoverFetchKeyRef.current = "";
      setAlbumCoverMap((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setAlbumCoverLoading(false);
      return;
    }

    if (albumCoverFetchKeyRef.current === folderFetchKey) {
      return;
    }
    albumCoverFetchKeyRef.current = folderFetchKey;

    let cancelled = false;

    const fetchAlbumCovers = async () => {
      setAlbumCoverLoading(true);
      try {
        const token = await getAccessToken();
        const folderIds = folders.map((folder) => folder.id).join(",");
        const res = await fetch(
          getApiUrl(`/api/v1/drive/covers?folder_ids=${encodeURIComponent(folderIds)}`),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error("Failed to fetch album covers");
        const data = await res.json();
        const covers = (data.covers || {}) as Record<string, DriveItem | null>;

        if (!cancelled) setAlbumCoverMap(covers);
      } finally {
        if (!cancelled) setAlbumCoverLoading(false);
      }
    };

    fetchAlbumCovers();

    return () => {
      cancelled = true;
    };
  }, [activeSubPage, drive.folderId, drive.items, getAccessToken]);

  /* ── Verifying Payment ── */
  if (verifying) {
    return (
      <div className="min-h-screen bg-ghost">
        <DashboardHeader title="Events" />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="w-10 h-10 border-[4px] border-teal border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-display font-black text-lg text-navy">Verifying Payment</p>
            <p className="text-xs font-bold text-slate uppercase tracking-wider">Checking with Paystack…</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-ghost">
        <DashboardHeader title="Events" />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-[3px] border-coral border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate uppercase tracking-wider">Loading events…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Events" />
      <ToolHelpModal toolId="events" isOpen={showHelp} onClose={closeHelp} />

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
        <div className="flex justify-end mb-3"><HelpButton onClick={openHelp} /></div>

        <div className="bg-snow border-[3px] border-navy rounded-2xl p-1 mb-5 inline-flex items-center gap-1">
          <button
            onClick={() => setActiveSubPage("upcoming")}
            className={`px-5 py-2.5 rounded-xl font-display font-bold text-xs uppercase tracking-wider border-[2px] transition-all ${
              activeSubPage === "upcoming"
                ? "bg-navy text-snow border-lime press-2 press-lime"
                : "bg-snow text-slate border-transparent hover:text-navy"
            }`}
          >
            Upcoming Events
          </button>
          <button
            onClick={() => setActiveSubPage("gallery")}
            className={`px-5 py-2.5 rounded-xl font-display font-bold text-xs uppercase tracking-wider border-[2px] transition-all ${
              activeSubPage === "gallery"
                ? "bg-lavender text-snow border-navy press-2 press-navy"
                : "bg-snow text-slate border-transparent hover:text-navy"
            }`}
          >
            Event Gallery
          </button>
        </div>

        {activeSubPage === "upcoming" ? (
        <>

        {/* ═══════════════════════════════════════════════════════
            HERO BENTO
            ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
          {/* Title block */}
          <div className="md:col-span-12 bg-coral border-[3px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[180px] flex flex-col justify-between">
            <div className="absolute -bottom-12 -right-12 w-40 h-40 rounded-full bg-navy/8 pointer-events-none" />
            <svg aria-hidden="true" className="absolute top-6 right-10 w-5 h-5 text-navy/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <svg aria-hidden="true" className="absolute bottom-10 right-24 w-4 h-4 text-snow/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>

            <div>
              <p className="text-[10px] font-bold text-snow/60 uppercase tracking-[0.15em] mb-2">Department Calendar</p>
              <h1 className="font-display font-black text-3xl md:text-4xl text-snow leading-[0.95]">
                Upcoming Events
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              <span className="text-[10px] font-bold text-navy bg-snow/90 rounded-md px-3 py-1 uppercase tracking-wider">
                {events.length} event{events.length !== 1 ? "s" : ""}
              </span>
              <span className="text-[10px] font-bold text-navy bg-sunny rounded-md px-3 py-1 uppercase tracking-wider">
                {registeredEvents.size} registered
              </span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            ERROR
            ═══════════════════════════════════════════════════════ */}
        {error && (
          <div className="bg-coral-light border-[3px] border-navy rounded-2xl p-4 mb-5 shadow-[3px_3px_0_0_#000] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-coral flex items-center justify-center shrink-0">
              <svg aria-hidden="true" className="w-4 h-4 text-snow" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm font-medium text-navy">{error}</p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            CATEGORY FILTERS + VIEW TOGGLE
            ═══════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1 flex-1">
            {CATEGORIES.map((cat) => {
              const pill = categoryPills[cat] || categoryPills.General;
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl border-[3px] transition-all whitespace-nowrap ${
                    isActive
                      ? `${pill.active} shadow-[3px_3px_0_0_#000]`
                      : "text-slate hover:text-navy bg-snow border-navy/20 hover:border-navy"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          {/* List / Calendar toggle */}
          <div className="flex shrink-0 gap-1 bg-ghost border-[3px] border-navy/20 rounded-xl p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-all ${viewMode === "list" ? "bg-navy text-snow shadow-[2px_2px_0_0_#C8F31D]" : "text-slate hover:text-navy"}`}
              aria-label="List view"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M2.625 6.75a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875 0A.75.75 0 0 1 8.25 6h12a.75.75 0 0 1 0 1.5h-12a.75.75 0 0 1-.75-.75ZM2.625 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0ZM7.5 12a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5h-12A.75.75 0 0 1 7.5 12Zm-4.875 5.25a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875 0a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5h-12a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`p-2 rounded-lg transition-all ${viewMode === "calendar" ? "bg-navy text-snow shadow-[2px_2px_0_0_#C8F31D]" : "text-slate hover:text-navy"}`}
              aria-label="Calendar view"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM15.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM16.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            CALENDAR VIEW
            ═══════════════════════════════════════════════════════ */}
        {viewMode === "calendar" ? (
          <EventCalendarView />
        ) : (
        <>

        {/* ═══════════════════════════════════════════════════════
            EVENT CARDS
            ═══════════════════════════════════════════════════════ */}
        {filteredEvents.length === 0 ? (
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-12 text-center shadow-[4px_4px_0_0_#000]">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sunny-light flex items-center justify-center">
              <svg aria-hidden="true" className="w-8 h-8 text-sunny" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-display font-black text-xl text-navy mb-2">
              {activeCategory === "All" ? "No upcoming events" : `No ${activeCategory.toLowerCase()} events`}
            </h3>
            <p className="text-sm text-slate">Check back later for new events</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event, index) => {
              const isRegistered = registeredEvents.has(event.id);
              const isProcessing = registering === event.id;
              const isFull = Boolean(event.maxAttendees && event.attendeeCount >= event.maxAttendees);
              const transferMeta = eventTransfers[event.id];
              const transferStatus = transferMeta?.status;
              const transferRejected = transferStatus === "rejected";
              const accent = cardAccents[index % cardAccents.length];
              const rotation = index % 3 === 1 ? "rotate-[0.5deg] hover:rotate-0" : index % 3 === 2 ? "rotate-[-0.5deg] hover:rotate-0" : "";

              return (
                <article
                  key={event.id}
                  className={`bg-snow border-[3px] ${accent.border} rounded-3xl overflow-hidden press-4 press-black transition-all ${rotation}`}
                >
                  {/* Card Header — event image or colored accent */}
                  {event.imageUrl ? (
                    <div className="relative h-44 overflow-hidden">
                      <img
                        src={event.imageUrl}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                      {/* Overlay badges */}
                      <div className="absolute inset-0 bg-gradient-to-t from-navy/60 to-transparent" />
                      <div className="absolute bottom-3 left-4 flex items-end justify-between w-[calc(100%-2rem)]">
                        <div>
                          <div className="font-display font-black text-4xl leading-none text-snow drop-shadow-md">
                            {new Date(event.date).getDate()}
                          </div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-snow/80">
                            {new Date(event.date).toLocaleDateString("en-US", { month: "short" })} {new Date(event.date).getFullYear()}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 bg-snow/20 text-snow backdrop-blur-sm">
                            {event.category}
                          </span>
                          {isRegistered && (
                            <span className="text-[10px] font-bold text-navy bg-lime rounded-md px-2.5 py-1 uppercase tracking-wider">
                              Going
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`${accent.header} p-5 relative overflow-hidden`}>
                      <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-navy/5 pointer-events-none" />
                      <div className="flex items-start justify-between">
                        <div>
                          <div className={`font-display font-black text-5xl leading-none ${accent.dateText}`}>
                            {new Date(event.date).getDate()}
                          </div>
                          <p className={`text-xs font-bold uppercase tracking-wider mt-1 ${accent.dateText} opacity-70`}>
                            {new Date(event.date).toLocaleDateString("en-US", { month: "short" })} {new Date(event.date).getFullYear()}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 ${accent.catBg} ${accent.catText}`}>
                            {event.category}
                          </span>
                          {isRegistered && (
                            <span className="text-[10px] font-bold text-navy bg-lime rounded-md px-2.5 py-1 uppercase tracking-wider">
                              Going
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Body */}
                  <div className="p-5 space-y-4">
                    <div>
                      <h3 className="font-display font-black text-lg text-navy mb-1.5 line-clamp-2 leading-snug">{event.title}</h3>
                      <p className="text-xs text-slate line-clamp-2 leading-relaxed">{event.description}</p>
                    </div>

                    {/* Meta */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 text-xs text-navy/60">
                        <svg aria-hidden="true" className="w-4 h-4 text-slate shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">{formatTime(event.date)} &middot; {formatDate(event.date)}</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-navy/60">
                        <svg aria-hidden="true" className="w-4 h-4 text-slate shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium truncate">{event.location}</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-navy/60">
                        <svg aria-hidden="true" className="w-4 h-4 text-slate shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">
                          {event.attendeeCount} going{event.maxAttendees ? ` / ${event.maxAttendees} max` : ""}
                        </span>
                      </div>
                    </div>

                    {/* Payment Badge for paid events */}
                    {event.requiresPayment && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-[2px] ${
                        paidEvents.has(event.id) 
                          ? "bg-teal-light border-teal/30" 
                          : transferRejected
                          ? "bg-coral-light border-coral/30"
                          : pendingTransfers.has(event.id)
                          ? "bg-sunny-light border-sunny/30"
                          : "bg-sunny-light border-sunny/30"
                      }`}>
                        <svg
                          aria-hidden="true"
                          className={`w-3.5 h-3.5 ${
                            paidEvents.has(event.id) ? "text-teal" : transferRejected ? "text-coral" : "text-sunny"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 7.5a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" />
                          <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 17.625V4.875z" clipRule="evenodd" />
                        </svg>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          paidEvents.has(event.id)
                            ? "text-teal"
                            : transferRejected
                            ? "text-coral"
                            : pendingTransfers.has(event.id)
                            ? "text-sunny"
                            : "text-navy/60"
                        }`}>
                          {paidEvents.has(event.id)
                            ? "Paid"
                            : transferRejected
                            ? "Transfer Rejected"
                            : pendingTransfers.has(event.id)
                            ? "Transfer Pending Review"
                            : `₦${(event.paymentAmount || 0).toLocaleString()} required`}
                        </span>
                      </div>
                    )}

                    {event.requiresPayment && transferStatus && !paidEvents.has(event.id) && (
                      <div className={`rounded-xl border-[2px] px-3 py-2 ${transferRejected ? "bg-coral-light border-coral/30" : "bg-sunny-light border-sunny/30"}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${transferRejected ? "text-coral" : "text-sunny"}`}>
                          {transferRejected ? "Latest transfer was rejected" : "Latest transfer is under review"}
                        </p>
                        {transferMeta?.adminNote && (
                          <p className="text-[11px] text-navy mt-1">Admin note: {transferMeta.adminNote}</p>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2">
                    {isRegistered ? (
                      <>
                        {/* Receipt + Ticket Buttons for paid events */}
                        {event.requiresPayment && paidEvents.has(event.id) && paymentRefs[event.id] && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => downloadReceipt(paymentRefs[event.id])}
                              disabled={downloadingReceipt === paymentRefs[event.id]}
                              className="flex-1 py-2.5 bg-lime border-[3px] border-navy rounded-xl font-display font-bold text-[10px] text-navy uppercase tracking-wider flex items-center justify-center gap-1.5 press-2 press-navy disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {downloadingReceipt === paymentRefs[event.id] ? (
                                <div className="w-3.5 h-3.5 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg aria-hidden="true" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                                </svg>
                              )}
                              Receipt
                            </button>
                            <button
                              onClick={() => downloadTicket(event.id, paymentRefs[event.id])}
                              disabled={downloadingTicket === paymentRefs[event.id]}
                              className="flex-1 py-2.5 bg-lavender border-[3px] border-navy rounded-xl font-display font-bold text-[10px] text-snow uppercase tracking-wider flex items-center justify-center gap-1.5 press-2 press-navy disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {downloadingTicket === paymentRefs[event.id] ? (
                                <div className="w-3.5 h-3.5 border-2 border-snow border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg aria-hidden="true" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                                </svg>
                              )}
                              Ticket
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => handleUnregister(event.id)}
                          disabled={isProcessing}
                          className="w-full py-3 font-bold text-xs uppercase tracking-wider border-[3px] border-navy text-navy hover:bg-cloud transition-all disabled:opacity-50 flex items-center justify-center gap-2 rounded-2xl"
                        >
                          {isProcessing ? (
                            <>
                              <div className="w-4 h-4 border-[2px] border-navy border-t-transparent rounded-full animate-spin" />
                              Processing…
                            </>
                          ) : (
                            <>
                              <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                              </svg>
                              Unregister
                            </>
                          )}
                        </button>
                      </>
                    ) : event.requiresPayment && !paidEvents.has(event.id) ? (
                      /* Paid event - needs payment first */
                      pendingTransfers.has(event.id) ? (
                        <div className="w-full py-3 text-center font-bold text-xs uppercase tracking-wider border-[3px] border-sunny/40 text-sunny bg-sunny-light rounded-2xl">
                          Transfer Under Review
                        </div>
                      ) : transferRejected ? (
                        <button
                          onClick={() => openPaymentModal(event)}
                          className="w-full py-3 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 rounded-2xl border-[3px] bg-coral text-snow border-navy press-3 press-black"
                        >
                          Resubmit Transfer / Pay Now
                        </button>
                      ) : (
                        <button
                          onClick={() => openPaymentModal(event)}
                          disabled={!!paying || isFull}
                          className={`w-full py-3 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 rounded-2xl border-[3px] ${
                            isFull
                              ? "bg-cloud text-slate border-navy/20 cursor-not-allowed"
                              : "bg-sunny text-navy border-navy press-3 press-navy disabled:opacity-50"
                          }`}
                        >
                          {paying === event.id ? (
                            <>
                              <div className="w-4 h-4 border-[2px] border-navy border-t-transparent rounded-full animate-spin" />
                              Processing…
                            </>
                          ) : isFull ? (
                            "Event Full"
                          ) : (
                            <>
                              <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 7.5a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" />
                                <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 17.625V4.875z" clipRule="evenodd" />
                              </svg>
                              Pay ₦{(event.paymentAmount || 0).toLocaleString()} & Register
                            </>
                          )}
                        </button>
                      )
                    ) : (
                      /* Free event or already paid */
                      <button
                        onClick={() => handleRegister(event.id)}
                        disabled={isProcessing || isFull}
                        className={`w-full py-3 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 rounded-2xl border-[3px] ${
                          isFull
                            ? "bg-cloud text-slate border-navy/20 cursor-not-allowed"
                            : "bg-lime text-navy border-navy press-3 press-navy disabled:opacity-50"
                        }`}
                      >
                        {isProcessing ? (
                          <>
                            <div className="w-4 h-4 border-[2px] border-navy border-t-transparent rounded-full animate-spin" />
                            Processing…
                          </>
                        ) : isFull ? (
                          "Event Full"
                        ) : (
                          <>
                            Register Now
                            <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                            </svg>
                          </>
                        )}
                      </button>
                    )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        </>
        )}
        </>
        ) : (
          <div className="space-y-5">
            <div className="bg-lavender border-[4px] border-navy rounded-[2rem] p-7 md:p-8 shadow-[6px_6px_0_0_#000] relative overflow-hidden">
              <svg aria-hidden="true" className="absolute top-6 right-8 w-5 h-5 text-snow/30 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
              </svg>
              <p className="text-[10px] font-bold text-snow/70 uppercase tracking-[0.14em] mb-2">Highlights</p>
              <h2 className="font-display font-black text-3xl md:text-4xl text-snow leading-[0.95] mb-3">Event Photo Gallery</h2>
              <p className="text-sm text-snow/90 max-w-3xl leading-relaxed">
                Browse event albums, open sub-folders, and preview images directly inside the dashboard.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="text-[10px] font-bold text-navy bg-snow rounded-md px-2.5 py-1 uppercase tracking-wider border border-navy/20">
                  Albums: {galleryFoldersCount}
                </span>
                <span className="text-[10px] font-bold text-navy bg-coral-light rounded-md px-2.5 py-1 uppercase tracking-wider border border-navy/20">
                  Images: {galleryImagesCount}
                </span>
                <span className="text-[10px] font-bold text-navy bg-lime-light rounded-md px-2.5 py-1 uppercase tracking-wider border border-navy/20">
                  Previewable: {galleryPreviewableCount}
                </span>
              </div>
            </div>

            {!EVENT_GALLERY_FOLDER_ID ? (
              <div className="bg-sunny-light border-[3px] border-navy rounded-2xl p-5 shadow-[4px_4px_0_0_#000]">
                <h3 className="font-display font-black text-lg text-navy mb-1">Gallery folder not configured</h3>
                <p className="text-sm text-navy-muted">
                  Set <span className="font-bold text-navy">NEXT_PUBLIC_EVENTS_GALLERY_FOLDER_ID</span> in your frontend environment, then refresh this page.
                </p>
              </div>
            ) : (
              <>
                {!drive.viewingFile && (
                  <>
                    {drive.folderId === EVENT_GALLERY_FOLDER_ID && featuredAlbum && (
                      <button
                        onClick={() => handleGalleryNavigateFolder(featuredAlbum.id, featuredAlbum.name)}
                        className="w-full bg-sunny border-[4px] border-navy rounded-3xl p-4 sm:p-5 shadow-[5px_5px_0_0_#000] text-left press-4 press-navy transition-all"
                      >
                        <p className="text-[10px] font-bold text-navy/70 uppercase tracking-[0.12em] mb-2">Featured Album</p>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                          <div className="md:col-span-2 rounded-2xl overflow-hidden border-[3px] border-navy bg-navy/10 min-h-[150px]">
                            {albumCoverMap[featuredAlbum.id]?.thumbnailUrl ? (
                              <img
                                src={albumCoverMap[featuredAlbum.id]!.thumbnailUrl!}
                                alt={getAlbumMeta(featuredAlbum).title || featuredAlbum.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full min-h-[150px] flex items-center justify-center text-navy">
                                <svg aria-hidden="true" className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
                                  <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6Zm3 10.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L4.5 16.061Z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="md:col-span-3 space-y-2">
                            <h3 className="font-display font-black text-2xl text-navy leading-tight">
                              {getAlbumMeta(featuredAlbum).title || featuredAlbum.name}
                            </h3>
                            {getAlbumMeta(featuredAlbum).description && (
                              <p className="text-sm text-navy-muted leading-relaxed">
                                {getAlbumMeta(featuredAlbum).description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 pt-1">
                              {(getAlbumMeta(featuredAlbum).badge || "Event Album") && (
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-navy text-snow px-2.5 py-1 rounded-md">
                                  {getAlbumMeta(featuredAlbum).badge || "Event Album"}
                                </span>
                              )}
                              {getAlbumMeta(featuredAlbum).eventDate && (
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-snow text-navy px-2.5 py-1 rounded-md border-2 border-navy">
                                  {getAlbumMeta(featuredAlbum).eventDate}
                                </span>
                              )}
                              <span className="text-[10px] font-bold uppercase tracking-wider bg-lime text-navy px-2.5 py-1 rounded-md border-2 border-navy">
                                Tap to open
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    )}

                    {drive.folderId === EVENT_GALLERY_FOLDER_ID && galleryRecentPhotos.length > 0 && (
                      <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[4px_4px_0_0_#000]">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <h3 className="font-display font-black text-base text-navy">Recently Viewed Photos</h3>
                          <button
                            onClick={() => {
                              setGalleryRecentPhotos([]);
                              if (typeof window !== "undefined") {
                                window.localStorage.removeItem(EVENT_GALLERY_RECENT_KEY);
                              }
                            }}
                            className="text-[10px] font-bold uppercase tracking-wider text-slate hover:text-coral"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-1">
                          {galleryRecentPhotos.map((photo) => (
                            <button
                              key={photo.id}
                              onClick={() => openGalleryItem(photo)}
                              className="shrink-0 w-36 sm:w-40 bg-ghost border-[3px] border-navy rounded-2xl overflow-hidden text-left press-2 press-navy transition-all"
                            >
                              <div className="h-24 sm:h-28 bg-cloud">
                                {photo.thumbnailUrl ? (
                                  <img src={photo.thumbnailUrl} alt={photo.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate">
                                    <svg aria-hidden="true" className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                                      <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6Z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="p-2.5">
                                <p className="text-[11px] font-bold text-navy line-clamp-2 leading-tight">{photo.name}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {drive.folderId === EVENT_GALLERY_FOLDER_ID && nonFeaturedAlbums.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <h3 className="font-display font-black text-lg text-navy">Albums</h3>
                          {albumCoverLoading && <span className="text-xs font-bold text-slate uppercase tracking-wider">Loading covers…</span>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {nonFeaturedAlbums.map((folder, index) => {
                            const cover = albumCoverMap[folder.id];
                            const meta = getAlbumMeta(folder);
                            const rotation = index % 3 === 1 ? "rotate-[0.5deg] hover:rotate-0" : index % 3 === 2 ? "rotate-[-0.5deg] hover:rotate-0" : "";
                            return (
                              <button
                                key={folder.id}
                                onClick={() => handleGalleryNavigateFolder(folder.id, folder.name)}
                                className={`bg-snow border-[3px] border-navy rounded-3xl overflow-hidden text-left press-3 press-navy transition-all ${rotation}`}
                              >
                                <div className="h-36 sm:h-40 bg-cloud relative">
                                  {cover?.thumbnailUrl ? (
                                    <img
                                      src={cover.thumbnailUrl}
                                      alt={meta?.title || folder.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate">
                                      <svg aria-hidden="true" className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19.906 9c.382 0 .749.057 1.094.162V9a3 3 0 0 0-3-3h-3.879a.75.75 0 0 1-.53-.22L11.47 3.66A2.25 2.25 0 0 0 9.879 3H6a3 3 0 0 0-3 3v3.162A3.756 3.756 0 0 1 4.094 9h15.812Z" />
                                        <path d="M4.094 10.5a2.25 2.25 0 0 0-2.227 2.568l.857 6A2.25 2.25 0 0 0 4.951 21H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-2.227-2.568H4.094Z" />
                                      </svg>
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-navy/70 to-transparent" />
                                  <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-snow/90 text-navy">
                                      {meta?.badge || "Album"}
                                    </span>
                                    {meta?.eventDate && (
                                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-lime text-navy border border-navy/20">
                                        {meta.eventDate}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="p-4">
                                  <h4 className="font-display font-black text-base text-navy leading-tight line-clamp-2">
                                    {meta?.title || folder.name}
                                  </h4>
                                  {meta?.description && (
                                    <p className="text-xs text-navy-muted mt-1.5 line-clamp-2">{meta.description}</p>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </>
                )}

                <div className="rounded-3xl py-3 md:p-5 overflow-hidden">
                  <DriveExplorer
                    items={drive.items}
                    breadcrumbs={galleryBreadcrumbs}
                    folderId={drive.folderId}
                    rootId={EVENT_GALLERY_FOLDER_ID || drive.rootId}
                    loading={drive.loading}
                    error={drive.error}
                    searchQuery={drive.searchQuery}
                    searchResults={drive.searchResults}
                    searchLoading={drive.searchLoading}
                    recentFiles={[]}
                    progressMap={drive.progressMap}
                    onNavigateFolder={handleGalleryNavigateFolder}
                    onOpenFile={(item: DriveItem) => openGalleryItem(item)}
                    onSearch={drive.setSearchQuery}
                    onSearchSubmit={drive.doSearch}
                    onGoBack={handleGalleryGoBack}
                    onRetry={drive.refreshFolder}
                    notConfigured={drive.notConfigured}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {activeSubPage === "gallery" && (drive.viewingFile || drive.viewerLoading) && (
        <ResourceViewer
          key={drive.viewingFile?.id}
          meta={drive.viewingFile!}
          loading={drive.viewerLoading}
          onClose={drive.closeViewer}
          token={null}
          hasPrev={currentGalleryFileIndex > 0}
          hasNext={currentGalleryFileIndex >= 0 && currentGalleryFileIndex < galleryFileSequence.length - 1}
          onPrev={openPrevGalleryFile}
          onNext={openNextGalleryFile}
        />
      )}

      {/* ═══════════════════════════════════════════════════════
          PAYMENT METHOD MODAL
          ═══════════════════════════════════════════════════════ */}
      {payModalEvent && (
        <div className="fixed inset-0 z-[70] bg-navy/60 flex items-center justify-center p-4" onClick={() => setPayModalEvent(null)}>
          <div className="bg-snow border-[3px] border-navy rounded-3xl shadow-[12px_12px_0_0_#000] max-w-md w-full overflow-hidden max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-sunny p-6 border-b-[4px] border-navy">
              <h2 className="font-display font-black text-xl text-navy">Choose Payment Method</h2>
              <p className="text-sm text-navy/70 mt-1">{payModalEvent.title} — ₦{(payModalEvent.paymentAmount || 0).toLocaleString()}</p>
            </div>
            <div className="p-6 space-y-3">
              {onlinePaymentEnabled ? (
              <button
                onClick={() => {
                  setPayModalEvent(null);
                  handlePayForEvent(payModalEvent);
                }}
                disabled={!!paying}
                className="w-full bg-lime border-[3px] border-navy rounded-2xl p-4 text-left press-3 press-navy transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center shrink-0">
                    <svg aria-hidden="true" className="w-5 h-5 text-snow" fill="currentColor" viewBox="0 0 24 24"><path d="M4.5 3.75a3 3 0 00-3 3v.75h21v-.75a3 3 0 00-3-3h-15z" /><path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 003 3h15a3 3 0 003-3v-7.5zm-18 3.75a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clipRule="evenodd" /></svg>
                  </div>
                  <div>
                    <p className="font-display font-black text-navy">Pay Online</p>
                    <p className="text-xs text-navy/60">Card, bank, USSD via Paystack</p>
                  </div>
                </div>
              </button>
              ) : (
                <div className="w-full bg-cloud border-[3px] border-navy/10 rounded-2xl p-4 cursor-not-allowed opacity-60" title="Online payments are currently disabled by admin">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-navy/20 flex items-center justify-center shrink-0">
                      <svg aria-hidden="true" className="w-5 h-5 text-navy/40" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" /></svg>
                    </div>
                    <div>
                      <p className="font-display font-black text-navy/40">Pay Online</p>
                      <p className="text-xs text-navy/30">Currently disabled by admin</p>
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={() => openBankTransfer(payModalEvent)}
                className="w-full bg-ghost border-[3px] border-navy rounded-2xl p-4 text-left press-3 press-navy transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center shrink-0">
                    <svg aria-hidden="true" className="w-5 h-5 text-snow" fill="currentColor" viewBox="0 0 24 24"><path d="M11.584 2.376a.75.75 0 01.832 0l9 6a.75.75 0 01-.832 1.248L12 3.901 3.416 9.624a.75.75 0 01-.832-1.248l9-6z" /><path fillRule="evenodd" d="M20.25 10.332v9.918H21a.75.75 0 010 1.5H3a.75.75 0 010-1.5h.75v-9.918a.75.75 0 01.634-.74A49.109 49.109 0 0112 9c2.59 0 5.134.202 7.616.592a.75.75 0 01.634.74zm-7.5 2.418a.75.75 0 00-1.5 0v6.75a.75.75 0 001.5 0v-6.75zm3-.75a.75.75 0 01.75.75v6.75a.75.75 0 01-1.5 0v-6.75a.75.75 0 01.75-.75zm-9 .75a.75.75 0 00-1.5 0v6.75a.75.75 0 001.5 0v-6.75z" clipRule="evenodd" /></svg>
                  </div>
                  <div>
                    <p className="font-display font-black text-navy">Bank Transfer</p>
                    <p className="text-xs text-navy/60">Transfer to IESA account, submit proof</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setPayModalEvent(null)}
                className="w-full py-2.5 text-center text-sm font-bold text-navy/50 hover:text-navy transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          BANK TRANSFER MODAL
          ═══════════════════════════════════════════════════════ */}
      {bankTransferEvent && (
        <div className="fixed inset-0 z-[70] bg-navy/60 flex items-center justify-center p-4" onClick={() => { setBankTransferEvent(null); setReceiptImage(null); }}>
          <div className="bg-snow border-[3px] border-navy rounded-3xl shadow-[12px_12px_0_0_#000] max-w-lg w-full max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-navy p-6 border-b-[4px] border-ghost/20 sticky top-0 z-10">
              <h2 className="font-display font-black text-xl text-snow">Bank Transfer</h2>
              <p className="text-sm text-snow/70 mt-1">{bankTransferEvent.title} — ₦{(bankTransferEvent.paymentAmount || 0).toLocaleString()}</p>
            </div>
            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              {/* Bank Account to Transfer To */}
              {bankAccounts.length > 0 ? (
                <div>
                  <label className="text-label text-navy/60 mb-2 block">Transfer To</label>
                  <select
                    title="Select destination bank account"
                    value={transferForm.bankAccountId}
                    onChange={e => setTransferForm(f => ({ ...f, bankAccountId: e.target.value }))}
                    className="w-full bg-ghost border-[3px] border-navy/20 rounded-xl px-4 py-3 font-bold text-sm text-navy focus:border-navy outline-none"
                  >
                    {bankAccounts.map(acc => (
                      <option key={acc._id} value={acc._id}>
                        {acc.bankName} — {acc.accountNumber} ({acc.accountName})
                      </option>
                    ))}
                  </select>
                  {bankAccounts.find(a => a._id === transferForm.bankAccountId)?.notes && (
                    <p className="text-[10px] text-navy/40 mt-1 italic">
                      {bankAccounts.find(a => a._id === transferForm.bankAccountId)?.notes}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-coral-light border-[3px] border-coral/30 rounded-xl p-4 text-center">
                  <p className="text-sm font-bold text-navy">No bank accounts available</p>
                  <p className="text-xs text-navy/60 mt-1">The department hasn&apos;t set up bank accounts yet. Please use online payment.</p>
                </div>
              )}

              {/* Sender Name */}
              <div>
                <label className="text-label text-navy/60 mb-2 block">Your Name (on bank account)</label>
                <input
                  type="text"
                  value={transferForm.senderName}
                  onChange={e => setTransferForm(f => ({ ...f, senderName: e.target.value }))}
                  className="w-full bg-ghost border-[3px] border-navy/20 rounded-xl px-4 py-3 font-bold text-sm text-navy focus:border-navy outline-none"
                  placeholder="Full name on your bank account"
                />
              </div>

              {/* Sender Bank */}
              <div>
                <label className="text-label text-navy/60 mb-2 block">Your Bank</label>
                <select
                  title="Select your bank"
                  value={transferForm.senderBank}
                  onChange={e => setTransferForm(f => ({ ...f, senderBank: e.target.value }))}
                  className="w-full bg-ghost border-[3px] border-navy/20 rounded-xl px-4 py-3 font-bold text-sm text-navy focus:border-navy outline-none"
                >
                  <option value="">Select your bank</option>
                  {NIGERIAN_BANKS.map(bank => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>

              {/* Transaction Reference */}
              <div>
                <label className="text-label text-navy/60 mb-2 block">Transaction Reference / Session ID <span className="text-navy/30">(optional)</span></label>
                <div className="relative">
                  <input
                    type="text"
                    value={transferForm.transactionReference}
                    onChange={e => { setTransferForm(f => ({ ...f, transactionReference: e.target.value })); setRefExistsError(""); }}
                    onBlur={handleEventReferenceBlur}
                    className={`w-full bg-ghost border-[3px] rounded-xl px-4 py-3 font-bold text-sm text-navy focus:outline-none transition-colors ${refExistsError ? "border-coral focus:border-coral" : "border-navy/20 focus:border-navy"}`}
                    placeholder="From your bank receipt"
                  />
                  {checkingRef && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <svg aria-hidden="true" className="w-4 h-4 animate-spin text-navy/40" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    </span>
                  )}
                </div>
                {refExistsError && (
                  <div className="flex items-start gap-2 bg-coral-light border-2 border-coral rounded-xl px-3 py-2.5 mt-2">
                    <svg aria-hidden="true" className="w-4 h-4 text-coral mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>
                    <p className="font-display font-medium text-xs text-coral">{refExistsError}</p>
                  </div>
                )}
              </div>

              {/* Receipt Image (Required) */}
              <div>
                <label className="text-label text-navy/60 mb-2 block">Receipt Screenshot <span className="text-coral">(required)</span></label>
                {receiptImage ? (
                  <div className="flex items-center gap-3 bg-teal-light border-[3px] border-teal/30 rounded-xl px-4 py-3">
                    <svg aria-hidden="true" className="w-5 h-5 text-teal shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h14v9.586l-3.293-3.293a1 1 0 00-1.414 0L11 14.586l-2.293-2.293a1 1 0 00-1.414 0L5 14.586V5zm4 2a2 2 0 100 4 2 2 0 000-4z"/></svg>
                    <span className="font-display font-medium text-sm text-navy truncate flex-1">{receiptImage.name}</span>
                    <button
                      type="button"
                      onClick={() => setReceiptImage(null)}
                      aria-label="Remove receipt image"
                      className="w-6 h-6 rounded-lg bg-coral/20 hover:bg-coral/40 flex items-center justify-center transition-colors shrink-0"
                    >
                      <svg aria-hidden="true" className="w-3.5 h-3.5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-3 bg-ghost border-[3px] border-dashed border-navy/20 rounded-xl px-4 py-4 cursor-pointer hover:border-navy/40 hover:bg-cloud transition-colors">
                    <svg aria-hidden="true" className="w-6 h-6 text-navy/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <div>
                      <span className="font-display font-bold text-sm text-navy/60">Upload receipt screenshot</span>
                      <span className="block font-display text-xs text-navy/30 mt-0.5">JPEG, PNG or WebP — max 5MB</span>
                    </div>
                    <input
                      type="file"
                      title="Upload receipt screenshot"
                      aria-label="Upload receipt screenshot"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            toast.error("File Too Large", { description: "Receipt image must be under 5MB" });
                            return;
                          }
                          setReceiptImage(file);
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Transfer Date */}
              <div>
                <label className="text-label text-navy/60 mb-2 block">Transfer Date</label>
                <input
                  type="date"
                  title="Transfer date"
                  value={transferForm.transferDate}
                  onChange={e => setTransferForm(f => ({ ...f, transferDate: e.target.value }))}
                  className="w-full bg-ghost border-[3px] border-navy/20 rounded-xl px-4 py-3 font-bold text-sm text-navy focus:border-navy outline-none"
                />
              </div>

              {/* Narration */}
              <div>
                <label className="text-label text-navy/60 mb-2 block">Narration (Optional)</label>
                <input
                  type="text"
                  value={transferForm.narration}
                  onChange={e => setTransferForm(f => ({ ...f, narration: e.target.value }))}
                  className="w-full bg-ghost border-[3px] border-navy/20 rounded-xl px-4 py-3 font-bold text-sm text-navy focus:border-navy outline-none"
                  placeholder="Transfer description or note"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setBankTransferEvent(null); setReceiptImage(null); }}
                  className="flex-1 py-3 border-[3px] border-navy text-navy rounded-2xl font-display font-bold text-sm hover:bg-cloud transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBankTransferSubmit}
                  disabled={transferSubmitting || bankAccounts.length === 0 || !!refExistsError || !receiptImage}
                  className="flex-1 py-3 bg-lime border-[3px] border-navy rounded-2xl font-display font-bold text-sm text-navy press-3 press-navy disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {transferSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-[2px] border-navy border-t-transparent rounded-full animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    "Review & Submit"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CONFIRM EVENT TRANSFER MODAL
          ═══════════════════════════════════════════════════════ */}
      {showConfirmTransfer && bankTransferEvent && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-navy/70 backdrop-blur-sm">
          <div className="bg-snow border-4 border-navy rounded-3xl shadow-[10px_10px_0_0_#000] w-full max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-y-auto">
            <div className="px-6 pt-6 pb-4 border-b-[3px] border-navy/10">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-sunny-light border-[3px] border-navy rounded-xl flex items-center justify-center">
                  <svg aria-hidden="true" className="w-5 h-5 text-navy" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>
                </div>
                <h2 className="font-display font-black text-xl text-navy">Confirm Submission</h2>
              </div>
              <p className="font-display font-normal text-sm text-navy/50 ml-13">Please verify all details before submitting.</p>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: "Event", value: bankTransferEvent.title },
                { label: "Amount", value: `₦${(bankTransferEvent.paymentAmount || 0).toLocaleString()}` },
                { label: "Your Name", value: transferForm.senderName },
                { label: "Your Bank", value: transferForm.senderBank },
                { label: "Reference", value: transferForm.transactionReference || "Not provided" },
                { label: "Receipt", value: receiptImage?.name || "Not attached" },
                { label: "Transfer Date", value: new Date(transferForm.transferDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
                ...(transferForm.narration ? [{ label: "Narration", value: transferForm.narration }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start gap-4 py-1.5 border-b border-navy/8">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-navy/40 shrink-0">{label}</span>
                  <span className="font-display font-medium text-sm text-navy text-right">{value}</span>
                </div>
              ))}
              <p className="font-display font-normal text-xs text-navy/50 pt-2">
                Once submitted, an admin will review and approve or reject your transfer proof.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowConfirmTransfer(false)}
                  className="flex-1 bg-ghost border-[3px] border-navy/20 px-5 py-3 rounded-xl font-display font-bold text-sm text-navy hover:bg-cloud transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={doConfirmedEventTransferSubmit}
                  disabled={transferSubmitting}
                  className="flex-1 bg-lime border-[3px] border-navy px-5 py-3 rounded-xl font-display font-bold text-sm text-navy press-4 press-navy transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {transferSubmitting ? "Submitting..." : "Yes, Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventsPageWrapper() {
  return (
    <Suspense fallback={<FullScreenLoader size="md" label="Loading events..." />}>
      <EventsPage />
    </Suspense>
  );
}

export default EventsPageWrapper;