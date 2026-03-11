"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getReceiptData, ReceiptData, getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { IesaLogo } from "@/components/ui/IesaLogo";
import { toast } from "sonner";

function ReceiptContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getAccessToken } = useAuth();

  const reference = searchParams.get("ref");
  
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (!reference) {
      setError("No transaction reference provided");
      setLoading(false);
      return;
    }

    const fetchReceipt = async () => {
      try {
        const data = await getReceiptData(reference);
        setReceipt(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load receipt");
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [reference]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!reference) return;
    setDownloadingPdf(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/paystack/receipt/pdf?reference=${encodeURIComponent(reference)}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to download PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `IESA_Receipt_${reference}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed", { description: "Please try Print / Save PDF instead." });
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-[3px] border-ghost/20 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-navy font-bold">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-8 max-w-md text-center shadow-[8px_8px_0_0_#000]">
          <div className="w-16 h-16 rounded-full bg-coral-light flex items-center justify-center mx-auto mb-4">
            <svg aria-hidden="true" className="w-8 h-8 text-coral" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="font-display font-black text-2xl text-navy mb-2">Receipt Not Found</h2>
          <p className="text-navy/60 mb-6">{error || "This receipt does not exist or you don't have permission to view it."}</p>
          <button
            onClick={() => router.push("/dashboard/payments")}
            className="bg-lime border-[3px] border-navy rounded-2xl px-6 py-3 font-display font-bold text-navy press-3 press-navy"
          >
            Back to Payments
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-page {
            box-shadow: none !important;
            border: 2px solid #0F0F2D !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          nav, aside, header, footer {
            display: none !important;
          }
          main {
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="py-8 px-4 print:bg-white print:py-0">
        {/* Action buttons - hidden on print */}
        <div className="no-print max-w-4xl mx-auto mb-6 flex justify-between items-center">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-navy hover:text-navy/70 font-bold transition-colors"
          >
            <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M11.03 3.97a.75.75 0 0 1 0 1.06l-6.22 6.22H21a.75.75 0 0 1 0 1.5H4.81l6.22 6.22a.75.75 0 1 1-1.06 1.06l-7.5-7.5a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
            Back
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="bg-lime text-navy border-[3px] border-navy rounded-2xl px-6 py-3 font-display font-bold flex items-center gap-2 press-3 press-navy disabled:opacity-50"
            >
              <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
              </svg>
              {downloadingPdf ? "Downloading..." : "Download PDF"}
            </button>
            <button
              onClick={handlePrint}
              className="bg-navy text-snow border-[3px] border-lime rounded-2xl px-6 py-3 font-display font-bold flex items-center gap-2 press-3 press-lime"
            >
              <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M7.875 1.5C6.839 1.5 6 2.34 6 3.375v2.99c-.426.053-.851.11-1.274.174-1.454.218-2.476 1.483-2.476 2.917v6.294a3 3 0 0 0 3 3h.27l-.155 1.705A1.875 1.875 0 0 0 7.232 22.5h9.536a1.875 1.875 0 0 0 1.867-2.045l-.155-1.705h.27a3 3 0 0 0 3-3V9.456c0-1.434-1.022-2.7-2.476-2.917A48.716 48.716 0 0 0 18 6.366V3.375c0-1.036-.84-1.875-1.875-1.875h-8.25ZM16.5 6.205v-2.83A.375.375 0 0 0 16.125 3h-8.25a.375.375 0 0 0-.375.375v2.83a49.353 49.353 0 0 1 9 0Zm-.217 8.265c.178.018.317.16.333.337l.526 5.784a.375.375 0 0 1-.374.409H7.232a.375.375 0 0 1-.374-.409l.526-5.784a.373.373 0 0 1 .333-.337 41.741 41.741 0 0 1 8.566 0Zm.967-3.97a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H18a.75.75 0 0 1-.75-.75V10.5ZM15 9.75a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V10.5a.75.75 0 0 0-.75-.75H15Z" clipRule="evenodd" />
              </svg>
              Print
            </button>
          </div>
        </div>

        {/* Receipt */}
        <div className="print-page max-w-4xl mx-auto bg-snow border-[3px] border-navy rounded-3xl shadow-[12px_12px_0_0_#000] overflow-hidden">
          {/* Header */}
          <div className="bg-navy text-snow p-8 text-center border-b-[6px] border-ghost/20">
            <div className="mx-auto mb-4 flex justify-center">
              <IesaLogo size={100} />
            </div>
            <h1 className="font-display font-black text-4xl mb-2">
              {receipt.isEventPayment ? "EVENT PAYMENT RECEIPT" : "PAYMENT RECEIPT"}
            </h1>
            <p className="text-snow text-sm font-bold uppercase tracking-wider">Industrial Engineering Students&apos; Association</p>
            <p className="text-snow/70 text-xs mt-1">University of Ibadan, Nigeria</p>
          </div>

          {/* Receipt Details */}
          <div className="p-8 space-y-6">
            {/* Reference & Status */}
            <div className="flex justify-between items-start pb-6 border-b-[3px] border-navy/10">
              <div>
                <p className="text-xs text-navy/50 uppercase font-bold tracking-wider mb-1">Receipt Number</p>
                <p className="font-display font-black text-2xl text-navy break-all">{receipt.reference}</p>
              </div>
              <div className="px-4 py-2 bg-teal-light border-[3px] border-teal rounded-xl shrink-0">
                <p className="text-teal font-display font-black text-sm flex items-center gap-1">
                  <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg>
                  {receipt.transaction.status}
                </p>
              </div>
            </div>

            {/* Event Information (if event payment) */}
            {receipt.isEventPayment && receipt.event && (
              <div className="bg-lavender-light border-[3px] border-lavender/30 rounded-2xl p-6">
                <h3 className="text-xs text-navy/50 uppercase font-bold tracking-wider mb-4">Event Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-navy/50 mb-1">Event</p>
                    <p className="font-bold text-navy">{receipt.event.title}</p>
                  </div>
                  {receipt.event.date && (
                    <div>
                      <p className="text-xs text-navy/50 mb-1">Date</p>
                      <p className="font-bold text-navy">{formatDate(receipt.event.date)}</p>
                    </div>
                  )}
                  {receipt.event.location && (
                    <div>
                      <p className="text-xs text-navy/50 mb-1">Location</p>
                      <p className="font-bold text-navy">{receipt.event.location}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-navy/50 mb-1">Category</p>
                    <p className="font-bold text-navy">{receipt.event.category}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Student Information */}
            <div className="bg-ghost border-[3px] border-navy/20 rounded-2xl p-6">
              <h3 className="text-xs text-navy/50 uppercase font-bold tracking-wider mb-4">Student Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-navy/50 mb-1">Full Name</p>
                  <p className="font-bold text-navy">{receipt.student.name}</p>
                </div>
                <div>
                  <p className="text-xs text-navy/50 mb-1">Matric Number</p>
                  <p className="font-bold text-navy">{receipt.student.matricNumber || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-navy/50 mb-1">Level</p>
                  <p className="font-bold text-navy">{receipt.student.level}</p>
                </div>
                <div>
                  <p className="text-xs text-navy/50 mb-1">Department</p>
                  <p className="font-bold text-navy">{receipt.student.department}</p>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="bg-lime-light border-[3px] border-navy/20 rounded-2xl p-6">
              <h3 className="text-xs text-navy/50 uppercase font-bold tracking-wider mb-4">Payment Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-navy/60">Payment Title</span>
                  <span className="font-bold text-navy">{receipt.payment.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-navy/60">Category</span>
                  <span className="font-bold text-navy">{receipt.payment.category}</span>
                </div>
                {receipt.payment.description && (
                  <div>
                    <span className="text-navy/60 block mb-1">Description</span>
                    <p className="text-sm text-navy">{receipt.payment.description}</p>
                  </div>
                )}
                <div className="pt-3 border-t-[2px] border-navy/10 flex justify-between items-center">
                  <span className="font-display font-bold text-lg text-navy">Amount Paid</span>
                  <span className="font-display font-black text-3xl text-navy">{formatAmount(receipt.payment.amount)}</span>
                </div>
              </div>
            </div>

            {/* Transaction Information */}
            <div className="bg-ghost border-[3px] border-navy/20 rounded-2xl p-6">
              <h3 className="text-xs text-navy/50 uppercase font-bold tracking-wider mb-4">Transaction Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-navy/60">Payment Method</span>
                  <span className="font-bold text-navy">{receipt.transaction.method}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-navy/60">Transaction Reference</span>
                  <span className="font-mono text-xs font-bold text-navy break-all">{receipt.transaction.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-navy/60">Date & Time</span>
                  <span className="font-bold text-navy">{receipt.transaction.date ? formatDate(receipt.transaction.date) : "N/A"}</span>
                </div>
                {receipt.transaction.verifiedBy && (
                  <div className="flex justify-between">
                    <span className="text-navy/60">Verified By</span>
                    <span className="font-bold text-navy">{receipt.transaction.verifiedBy}</span>
                  </div>
                )}
                {receipt.transaction.bankAccount && (
                  <div className="pt-3 border-t-[2px] border-navy/10">
                    <p className="text-xs text-navy/50 mb-2">Bank Transfer Details</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-navy/60">Bank</span>
                        <span className="font-bold text-navy">{receipt.transaction.bankAccount.bank}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy/60">Account Number</span>
                        <span className="font-mono font-bold text-navy">{receipt.transaction.bankAccount.accountNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy/60">Account Name</span>
                        <span className="font-bold text-navy">{receipt.transaction.bankAccount.accountName}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-navy/5 border-t-[3px] border-navy/10 p-6 text-center">
            <p className="text-xs text-navy/50 mb-2">
              This is an official receipt issued by the Industrial Engineering Students&apos; Association, University of Ibadan.
            </p>
            <p className="text-xs text-navy/40">
              For inquiries, contact: secretary@iesa-ui.org | Generated on {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-[3px] border-ghost/20 border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-navy font-bold">Loading receipt...</p>
          </div>
        </div>
      }
    >
      <ReceiptContent />
    </Suspense>
  );
}
