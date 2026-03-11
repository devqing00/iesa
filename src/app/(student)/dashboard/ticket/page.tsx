"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getReceiptData, ReceiptData, getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { IesaLogo } from "@/components/ui/IesaLogo";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

/* ─── Helpers ──────────────────────────────────────────────────── */

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "TBD";
  try {
    return new Date(dateString).toLocaleDateString("en-NG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

function formatTime(dateString: string | null | undefined) {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function generateTicketId(reference: string) {
  // Take last 8 chars + prefix
  const short = (reference || "").replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase();
  return `IESA-${short || "00000000"}`;
}

/* ─── Ticket Content ──────────────────────────────────────────── */

function TicketContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, getAccessToken } = useAuth();

  const eventId = searchParams.get("event");
  const reference = searchParams.get("ref");

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [eventData, setEventData] = useState<{
    title: string;
    date: string;
    endDate?: string;
    location: string;
    category: string;
    imageUrl?: string;
    description?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch event details
        if (eventId) {
          try {
            const token = await getAccessToken();
            const res = await fetch(getApiUrl(`/api/v1/events/${eventId}`), {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              setEventData({
                title: data.title,
                date: data.date,
                endDate: data.endDate,
                location: data.location,
                category: data.category,
                imageUrl: data.imageUrl,
                description: data.description,
              });
            }
          } catch (err) {
          }
        }

        // Fetch receipt data if reference provided
        if (reference) {
          try {
            const data = await getReceiptData(reference);
            setReceipt(data);
            // If we didn't get event data from the API, use the receipt event data
            if (!eventData && data.event) {
              setEventData({
                title: data.event.title,
                date: data.event.date || "",
                location: data.event.location,
                category: data.event.category,
              });
            }
          } catch (err) {
          }
        }

        if (!eventId && !reference) {
          setError("Missing event or reference parameters");
        }
      } catch (err) {
        setError("Failed to load ticket information");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, reference]);

  const handlePrint = () => window.print();

  /* ─ Loading ─ */
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-[3px] border-ghost/20 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-navy font-bold">Loading ticket…</p>
        </div>
      </div>
    );
  }

  /* ─ Error ─ */
  if (error || (!eventData && !receipt)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-8 max-w-md text-center shadow-[8px_8px_0_0_#000]">
          <div className="w-16 h-16 rounded-full bg-coral-light flex items-center justify-center mx-auto mb-4">
            <svg aria-hidden="true" className="w-8 h-8 text-coral" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="font-display font-black text-2xl text-navy mb-2">Ticket Not Found</h2>
          <p className="text-navy/60 mb-6">{error || "This ticket does not exist."}</p>
          <button
            onClick={() => router.push("/dashboard/events")}
            className="bg-lime border-[3px] border-navy rounded-2xl px-6 py-3 font-display font-bold text-navy press-3 press-navy"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  const title = eventData?.title || receipt?.event?.title || receipt?.payment?.title || "Event";
  const location = eventData?.location || receipt?.event?.location || "TBD";
  const category = eventData?.category || receipt?.event?.category || "";
  const date = eventData?.date || receipt?.event?.date || "";
  const ticketId = generateTicketId(reference || eventId || "XXXXX");
  const attendeeName = receipt?.student?.name || (user ? `${user.firstName} ${user.lastName}` : "Attendee");
  const attendeeMatric = receipt?.student?.matricNumber || "";
  const amount = receipt?.payment?.amount;
  const payDate = receipt?.transaction?.date;

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      {/* ─ Actions (hidden on print) ─ */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <button
          onClick={() => router.push("/dashboard/events")}
          className="bg-ghost border-[3px] border-navy rounded-xl px-4 py-2 font-display font-bold text-sm text-navy press-2 press-navy"
        >
          ← Events
        </button>
        <div className="flex-1" />
        <button
          onClick={handlePrint}
          className="bg-lime border-[3px] border-navy rounded-xl px-5 py-2 font-display font-bold text-sm text-navy press-2 press-navy flex items-center gap-2"
        >
          <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M7.875 1.5C6.839 1.5 6 2.34 6 3.375v2.99c-.426.053-.851.11-1.274.174-1.454.218-2.476 1.483-2.476 2.917v6.294a3 3 0 0 0 3 3h.27l-.092 1.086a1.875 1.875 0 0 0 1.865 2.063h9.414a1.875 1.875 0 0 0 1.865-2.063l-.092-1.086h.27a3 3 0 0 0 3-3V9.456c0-1.434-1.022-2.7-2.476-2.917A48.716 48.716 0 0 0 18 6.366V3.375c0-1.036-.84-1.875-1.875-1.875h-8.25ZM16.5 6.205v-2.83A.375.375 0 0 0 16.125 3h-8.25a.375.375 0 0 0-.375.375v2.83a49.353 49.353 0 0 1 9 0Zm-2.218 9.907a18.36 18.36 0 0 0-4.564 0l-.467.054a1.875 1.875 0 0 0-1.633 1.847l.092 4.122a.375.375 0 0 0 .373.413h9.834a.375.375 0 0 0 .373-.413l.092-4.122a1.875 1.875 0 0 0-1.633-1.847l-.467-.054Z" clipRule="evenodd" />
          </svg>
          Print Ticket
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          THE TICKET
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-snow border-[3px] border-navy rounded-[28px] shadow-[10px_10px_0_0_#000] overflow-hidden">

        {/* ─ Top: Event Hero ─ */}
        <div className="relative bg-navy p-7 pb-10 overflow-hidden">
          {/* Decorative diamonds */}
          <svg aria-hidden="true" className="absolute top-4 right-6 w-5 h-5 text-navy/15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
          </svg>
          <svg aria-hidden="true" className="absolute bottom-6 right-16 w-4 h-4 text-coral/20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
          </svg>
          <svg aria-hidden="true" className="absolute top-6 left-[40%] w-3 h-3 text-sunny/20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
          </svg>

          <div className="flex items-center gap-3 mb-5">
            <IesaLogo size={32} />
            <div>
              <p className="text-snow font-display font-black text-sm tracking-wide">IESA</p>
              <p className="text-snow/40 text-[10px] font-bold uppercase tracking-widest">Event Ticket</p>
            </div>
          </div>

          <h1 className="font-display font-black text-2xl sm:text-3xl text-snow leading-tight mb-3">
            {title}
          </h1>

          {category && (
            <span className="inline-block bg-teal/15 border border-navy/20 rounded-full px-3 py-0.5 text-[10px] font-bold text-snow uppercase tracking-widest">
              {category}
            </span>
          )}
        </div>

        {/* ─ Tear line ─ */}
        <div className="relative h-0">
          <div className="absolute -left-3 -top-3 w-6 h-6 bg-ghost rounded-full border-r-[3px] border-navy" />
          <div className="absolute -right-3 -top-3 w-6 h-6 bg-ghost rounded-full border-l-[3px] border-navy" />
          <div className="border-t-[3px] border-dashed border-navy/20 mx-6" />
        </div>

        {/* ─ Info Grid ─ */}
        <div className="p-7 pt-8 space-y-6">
          {/* Date + Location row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-label text-navy/40 mb-1">Date</p>
              <p className="font-display font-black text-navy text-lg leading-tight">{formatDate(date)}</p>
              {formatTime(date) && (
                <p className="text-sm font-bold text-navy/60 mt-0.5">{formatTime(date)}</p>
              )}
            </div>
            <div>
              <p className="text-label text-navy/40 mb-1">Venue</p>
              <p className="font-display font-black text-navy text-lg leading-tight">{location}</p>
            </div>
          </div>

          {/* Attendee */}
          <div className="bg-lime-light border-[3px] border-navy/10 rounded-2xl p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-label text-navy/40 mb-1">Attendee</p>
                <p className="font-display font-black text-navy text-base">{attendeeName}</p>
                {attendeeMatric && (
                  <p className="text-xs font-bold text-navy/50">{attendeeMatric}</p>
                )}
              </div>
              <div>
                <p className="text-label text-navy/40 mb-1">Ticket ID</p>
                <p className="font-display font-black text-navy text-base font-mono tracking-wider">{ticketId}</p>
              </div>
            </div>
          </div>

          {/* Payment info */}
          {amount != null && (
            <div className="flex items-center justify-between bg-ghost rounded-xl px-5 py-3 border-[2px] border-navy/8">
              <div>
                <p className="text-label text-navy/40 mb-0.5">Amount Paid</p>
                <p className="font-display font-black text-navy text-lg">₦{Number(amount).toLocaleString()}</p>
              </div>
              {payDate && (
                <div className="text-right">
                  <p className="text-label text-navy/40 mb-0.5">Payment Date</p>
                  <p className="text-sm font-bold text-navy/70">{formatDate(payDate)}</p>
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-3 pt-2">
            <div className="w-10 h-10 rounded-full bg-teal flex items-center justify-center">
              <svg aria-hidden="true" className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-display font-black text-teal text-sm">CONFIRMED</p>
              <p className="text-[10px] font-bold text-navy/40 uppercase tracking-widest">Registration verified</p>
            </div>
          </div>
        </div>

        {/* ─ Footer ─ */}
        <div className="bg-ghost border-t-[3px] border-navy/10 px-7 py-4 flex items-center justify-between">
          <p className="text-[10px] text-navy/30 font-bold">
            Industrial Engineering Students&apos; Association &bull; University of Ibadan
          </p>
          <p className="text-[10px] text-navy/30 font-bold font-mono">{reference || "—"}</p>
        </div>
      </div>

      {/* Print note */}
      <p className="text-center text-[11px] text-slate mt-4 print:hidden">
        Present this ticket (printed or on your phone) at the event entrance.
      </p>
    </div>
  );
}

/* ─── Page wrapper with Suspense ──────────────────────────────── */

export default function TicketPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-ghost">
          <DashboardHeader title="Event Ticket" />
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-[3px] border-ghost/20 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate uppercase tracking-wider">Loading…</p>
            </div>
          </div>
        </div>
      }
    >
      <TicketContent />
    </Suspense>
  );
}
