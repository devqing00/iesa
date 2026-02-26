"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams, useRouter } from "next/navigation";
import { getApiUrl, listBankAccounts, submitTransferProof, getMyTransfers, checkTransactionReference, NIGERIAN_BANKS, TRANSFER_STATUS_STYLES } from "@/lib/api";
import type { BankAccount, BankTransfer } from "@/lib/api";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useToast } from "@/components/ui/Toast";

/* ─── Types ─── */
interface Payment {
  id: string;
  _id?: string;
  title: string;
  description: string;
  amount: number;
  deadline: string;
  category: string;
  sessionId: string;
  hasPaid: boolean;
  transactionId?: string;
}

interface PaystackTransaction {
  _id: string;
  reference: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt?: string;
  channel?: string;
}

/* ─── Accent cycle ─── */
const ACCENT_CYCLE = ["border-l-teal", "border-l-coral", "border-l-lavender", "border-l-sunny"] as const;

export default function PaymentsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-ghost flex items-center justify-center">
        <div className="animate-pulse text-navy/60 font-medium">Loading payments...</div>
      </div>
    }>
      <PaymentsContent />
    </Suspense>
  );
}

function PaymentsContent() {
  const { user, getAccessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<PaystackTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [downloadingReceipt, setDownloadingReceipt] = useState<string | null>(null);
  const [resendingReceipt, setResendingReceipt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const toast = useToast();

  // Bank transfer state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [myTransfers, setMyTransfers] = useState<BankTransfer[]>([]);
  const [showTransferModal, setShowTransferModal] = useState<Payment | null>(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferForm, setTransferForm] = useState({
    bankAccountId: "",
    senderName: "",
    senderBank: "",
    transactionReference: "",
    transferDate: new Date().toISOString().split("T")[0],
    narration: "",
  });
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  // Platform settings
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(true);
  // Reference duplicate check
  const [checkingRef, setCheckingRef] = useState(false);
  const [refExistsError, setRefExistsError] = useState("");
  // Confirmation modal for bank transfer
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // Payment verification state — shown while checking with Paystack after redirect
  const [verifying, setVerifying] = useState(false);
  // Prevents double-fetch when verifyPayment clears the URL via router.replace
  const skipFetch = useRef(false);

  /* ─── Data Fetching ─── */
  useEffect(() => {
    if (!user) return; // wait for auth to initialise after full-page redirect
    const reference = searchParams.get("reference");
    if (reference) {
      verifyPayment(reference);
    } else {
      // User returned without a reference (e.g. cancelled Paystack page) — reset loading state
      setProcessingId(null);
      if (skipFetch.current) {
        // verifyPayment already refreshed data; skip this duplicate effect run
        skipFetch.current = false;
        return;
      }
      fetchPayments();
      fetchTransactions();
      fetchBankAccounts();
      fetchMyTransfers();
      fetchPlatformSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

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

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const sessionRes = await fetch(getApiUrl("/api/v1/sessions/active"), { headers: { Authorization: `Bearer ${token}` } });
      if (!sessionRes.ok) throw new Error("Failed to fetch session");
      const session = await sessionRes.json();
      const sessionId = session.id || session._id;
      const res = await fetch(getApiUrl(`/api/v1/payments/?session_id=${sessionId}`), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch payments");
      const payData = await res.json();
      setPayments(payData.items ?? payData);
    } catch (error) {
      console.error("Error fetching payments:", error);
      setFetchError("Failed to load payments. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/paystack/transactions"), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      setTransactions(await res.json());
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const accounts = await listBankAccounts(true);
      setBankAccounts(accounts);
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
    }
  };

  const fetchMyTransfers = async () => {
    try {
      const transfers = await getMyTransfers();
      setMyTransfers(transfers);
    } catch (error) {
      console.error("Error fetching transfers:", error);
    }
  };

  const initiatePayment = async (payment: Payment) => {
    if (processingId) return;
    setProcessingId(payment.id || payment._id || "");
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/paystack/initialize"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: payment.amount, paymentId: payment.id || payment._id }),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.detail || "Failed to initialize payment"); }
      const data = await res.json();
      // Redirect to Paystack payment page (same approach as events page)
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error("No payment URL returned");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to initiate payment";
      console.error("Payment error:", error);
      toast.error("Payment Error", errorMessage);
      setProcessingId(null);
    }
  };

  const verifyPayment = async (reference: string) => {
    setVerifying(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/paystack/verify/${reference}`), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to verify payment");
      const data = await res.json();
      if (data.status === "success") {
        toast.success("Payment Verified", "Your payment has been verified successfully!");
      } else if (data.status === "failed") {
        toast.error("Payment Declined", "Your payment was declined. Please try again or use a different payment method.");
      } else if (data.status === "abandoned") {
        toast.warning("Payment Cancelled", "You cancelled the payment. No charges were made.");
      } else {
        toast.warning("Payment Pending", `Your payment is being processed. Please check back shortly.`);
      }
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("Verification Failed", "Could not verify your payment. Please check your payment history or contact support.");
    } finally {
      // Tell the useEffect not to re-fetch when router.replace fires
      skipFetch.current = true;
      router.replace("/dashboard/payments");
      setVerifying(false);
      // Refresh data regardless of outcome
      fetchPayments();
      fetchTransactions();
    }
  };

  const downloadReceipt = async (reference: string) => {
    setDownloadingReceipt(reference);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/paystack/receipt/pdf?reference=${encodeURIComponent(reference)}`), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { 
        const error = await res.json().catch(() => ({ detail: "Download failed" }));
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
      toast.success("Download Complete", "Receipt downloaded successfully");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to download receipt";
      console.error("Download error:", error);
      toast.error("Download Failed", errorMessage);
    } finally {
      setDownloadingReceipt(null);
    }
  };

  const resendReceipt = async (reference: string) => {
    setResendingReceipt(reference);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/paystack/receipt/resend?reference=${encodeURIComponent(reference)}`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to resend" }));
        throw new Error(error.detail || "Failed to resend receipt");
      }
      toast.success("Receipt sent to your email!");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to resend receipt";
      toast.error(errorMessage);
    } finally {
      setResendingReceipt(null);
    }
  };

  // ─── Bank Transfer Submission ────────────────────────────────
  const openTransferModal = (payment: Payment) => {
    setTransferForm({
      bankAccountId: bankAccounts[0]?._id || "",
      senderName: user ? `${user.firstName} ${user.lastName}`.trim() : "",
      senderBank: "",
      transactionReference: "",
      transferDate: new Date().toISOString().split("T")[0],
      narration: "",
    });
    setRefExistsError("");
    setShowConfirmModal(false);
    setShowTransferModal(payment);
  };

  const handleReferenceBlur = async () => {
    const ref = transferForm.transactionReference.trim();
    if (!ref) return;
    setCheckingRef(true);
    setRefExistsError("");
    try {
      const result = await checkTransactionReference(ref);
      if (result.exists) {
        setRefExistsError("This reference has already been used for a previous submission. Please check and enter the correct reference.");
      }
    } catch {
      // non-critical — backend will catch it on submit anyway
    } finally {
      setCheckingRef(false);
    }
  };

  const handleTransferSubmit = () => {
    if (!showTransferModal || transferSubmitting) return;
    if (!transferForm.bankAccountId || !transferForm.senderName || !transferForm.senderBank || !transferForm.transactionReference || !transferForm.transferDate) {
      toast.error("Missing Fields", "Please fill in all required fields");
      return;
    }
    if (refExistsError) {
      toast.error("Duplicate Reference", "Please fix the transaction reference before submitting.");
      return;
    }
    setShowConfirmModal(true);
  };

  const doConfirmedTransferSubmit = async () => {
    if (!showTransferModal || transferSubmitting) return;
    const payment = showTransferModal;
    setShowConfirmModal(false);
    setTransferSubmitting(true);
    try {
      const result = await submitTransferProof({
        paymentId: payment.id || payment._id || "",
        bankAccountId: transferForm.bankAccountId,
        amount: payment.amount,
        senderName: transferForm.senderName,
        senderBank: transferForm.senderBank,
        transactionReference: transferForm.transactionReference,
        transferDate: transferForm.transferDate,
        narration: transferForm.narration || undefined,
      });

      // Upload receipt image if selected
      if (receiptImage && result._id) {
        try {
          const formData = new FormData();
          formData.append("file", receiptImage);
          const token = await getAccessToken();
          await fetch(getApiUrl(`/api/v1/bank-transfers/${result._id}/upload-receipt`), {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
        } catch {
          // Non-critical — transfer was submitted successfully
          toast.info("Note", "Transfer submitted but receipt image upload failed. You can re-upload later.");
        }
      }

      toast.success("Transfer Submitted", "Your bank transfer proof has been submitted for admin review.");
      setReceiptImage(null);
      setShowTransferModal(null);
      fetchMyTransfers();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to submit transfer proof";
      toast.error("Submission Failed", msg);
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Check if a payment has a pending bank transfer
  const getPendingTransfer = (paymentId: string) => myTransfers.find(t => t.paymentId === paymentId && t.status === "pending");

  const pendingPayments = payments.filter((p) => !p.hasPaid);
  const paidPayments = payments.filter((p) => p.hasPaid);

  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Payments & Dues" />

      <div className="px-4 md:px-8 py-6 pb-24 md:pb-8 max-w-6xl mx-auto relative">
        {/* Diamond Sparkle Decorators */}
        <svg className="fixed top-20 left-[6%] w-5 h-5 text-sunny/18 pointer-events-none z-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed top-44 right-[8%] w-7 h-7 text-teal/12 pointer-events-none z-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed top-[52%] left-[4%] w-4 h-4 text-coral/15 pointer-events-none z-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed bottom-36 right-[12%] w-6 h-6 text-lavender/15 pointer-events-none z-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed top-[32%] right-[20%] w-4 h-4 text-navy/10 pointer-events-none z-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>

        {verifying ? (
          /* ── Verifying Payment ── */
          <div className="flex flex-col items-center justify-center py-24">
            <div className="bg-snow border-[4px] border-navy rounded-3xl p-10 max-w-sm text-center shadow-[8px_8px_0_0_#000] relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-teal/10 pointer-events-none" />
              <div className="w-12 h-12 border-[4px] border-teal border-t-transparent rounded-full animate-spin mx-auto mb-5" />
              <h3 className="font-display font-black text-xl text-navy mb-2">Verifying Payment</h3>
              <p className="text-sm text-slate">Checking your transaction with Paystack…</p>
            </div>
          </div>
        ) : loading ? (
          /* ── Loading Skeleton ── */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-7 h-48 bg-cloud/50 border-[3px] border-navy/10 rounded-[2rem] animate-pulse" />
              <div className="md:col-span-5 grid grid-cols-1 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-cloud/50 border-[3px] border-navy/10 rounded-[1.5rem] animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        ) : fetchError ? (
          /* ── Error State ── */
          <div className="flex flex-col items-center justify-center py-16">
            <div className="bg-coral-light border-[3px] border-coral rounded-3xl p-8 max-w-md text-center shadow-[6px_6px_0_0_#000]">
              <svg className="w-12 h-12 text-coral mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <h3 className="font-display font-bold text-navy text-lg mb-2">Unable to Load Payments</h3>
              <p className="text-navy/60 text-sm mb-4">{fetchError}</p>
              <button
                onClick={() => { setFetchError(null); fetchPayments(); fetchTransactions(); }}
                className="bg-lime border-[3px] border-navy press-4 press-navy px-6 py-2.5 rounded-xl font-display font-bold text-sm text-navy transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* ═══ BENTO HERO ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Title Card — sunny theme */}
              <div className="md:col-span-7 bg-sunny border-[3px] border-navy rounded-[2rem] p-8 shadow-[4px_4px_0_0_#000] rotate-[-0.4deg] hover:rotate-0 transition-transform relative overflow-hidden">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/70 flex items-center gap-2 mb-3">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
                  Finance Portal
                </span>
                <h1 className="font-display font-black text-3xl md:text-4xl text-navy mb-2">
                  <span className="brush-highlight brush-coral">Payments</span> & Dues
                </h1>
                <p className="font-display font-normal text-sm text-navy/70 max-w-md">
                  Manage your departmental dues, view payment history, and download receipts.
                </p>
              </div>

              {/* Stats Strip */}
              <div className="md:col-span-5 grid grid-cols-1 gap-3">
                {/* Completed */}
                <div className="bg-teal-light border-[3px] border-navy rounded-[1.5rem] p-4 shadow-[4px_4px_0_0_#000] rotate-[0.3deg] hover:rotate-0 transition-transform flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Completed</span>
                    <p className="font-display font-black text-2xl text-navy">{paidPayments.length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-teal/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-teal" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                  </div>
                </div>
                {/* Pending */}
                <div className="bg-coral-light border-[3px] border-navy rounded-[1.5rem] p-4 shadow-[4px_4px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Pending</span>
                    <p className={`font-display font-black text-2xl ${pendingPayments.length > 0 ? "text-coral" : "text-navy"}`}>{pendingPayments.length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-coral/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-coral" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" /></svg>
                  </div>
                </div>
                {/* Total Paid */}
                <div className="bg-navy border-[3px] border-lime rounded-[1.5rem] p-4 shadow-[4px_4px_0_0_#C8F31D] rotate-[0.5deg] hover:rotate-0 transition-transform flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/50">Total Paid</span>
                    <p className="font-display font-black text-2xl text-snow">₦{paidPayments.reduce((s, p) => s + p.amount, 0).toLocaleString()}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-teal/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-snow" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7.5a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" /><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 17.625V4.875zM8.25 9.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM18.75 9a.75.75 0 00-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 00.75-.75V9.75a.75.75 0 00-.75-.75h-.008zM4.5 9.75A.75.75 0 015.25 9h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H5.25a.75.75 0 01-.75-.75V9.75z" clipRule="evenodd" /></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ TAB BAR ═══ */}
            <div className="bg-snow border-[3px] border-navy rounded-[1.5rem] shadow-[4px_4px_0_0_#000] p-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`px-5 py-2.5 rounded-xl font-display font-bold text-xs uppercase tracking-wider border-[3px] transition-all ${
                    activeTab === "pending"
                      ? "bg-coral text-navy border-navy shadow-[3px_3px_0_0_#000]"
                      : "bg-ghost text-navy/40 border-transparent hover:border-navy/20 hover:text-navy"
                  }`}
                >
                  Pending Dues ({pendingPayments.length})
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-5 py-2.5 rounded-xl font-display font-bold text-xs uppercase tracking-wider border-[3px] transition-all ${
                    activeTab === "history"
                      ? "bg-teal text-navy border-navy shadow-[3px_3px_0_0_#000]"
                      : "bg-ghost text-navy/40 border-transparent hover:border-navy/20 hover:text-navy"
                  }`}
                >
                  Payment History ({transactions.length})
                </button>
              </div>
            </div>

            {/* ═══ PENDING DUES ═══ */}
            {activeTab === "pending" && (
              <div className="space-y-4">
                {pendingPayments.length === 0 ? (
                  <div className="bg-navy border-[3px] border-lime rounded-[2rem] shadow-[3px_3px_0_0_#C8F31D] p-12 text-center">
                    <div className="w-14 h-14 bg-teal/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-teal" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                    </div>
                    <p className="font-display font-black text-xl text-snow mb-2">All Caught Up!</p>
                    <p className="font-display font-normal text-sm text-snow/50">You have no pending payments. Well done!</p>
                  </div>
                ) : (
                  pendingPayments.map((payment, i) => {
                    const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
                    return (
                      <div
                        key={payment.id || payment._id}
                        className={`bg-snow border-[3px] border-navy ${accent} border-l-[6px] rounded-[1.5rem] press-4 press-black overflow-hidden transition-all`}
                      >
                        {/* Card Header */}
                        <div className="px-5 py-3 border-b-[3px] border-navy/10 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/40">#{String(i + 1).padStart(2, "0")}</span>
                            <span className="px-2.5 py-1 rounded-lg bg-sunny-light text-sunny font-display font-bold text-[10px] uppercase tracking-[0.08em] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-sunny" />
                              Pending
                            </span>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/40 capitalize">{payment.category}</span>
                        </div>

                        {/* Card Body */}
                        <div className="p-5">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-2">
                              <h3 className="font-display font-black text-lg text-navy">{payment.title}</h3>
                              <p className="font-display font-normal text-sm text-navy/50">{payment.description}</p>
                              <p className="font-display font-bold text-xs text-slate uppercase tracking-wider flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" /></svg>
                                Due: {new Date(payment.deadline).toLocaleDateString()}
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <p className="font-display font-black text-2xl text-navy">₦{payment.amount.toLocaleString()}</p>
                              {(() => {
                                const pending = getPendingTransfer(payment.id || payment._id || "");
                                if (pending) {
                                  return (
                                    <span className="px-4 py-2 bg-sunny-light text-navy border-[3px] border-navy/20 rounded-xl font-display font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                                      <svg className="w-3.5 h-3.5 text-sunny" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" /></svg>
                                      Transfer Under Review
                                    </span>
                                  );
                                }
                                return (
                                  <div className="flex items-center gap-2">
                                    {onlinePaymentEnabled ? (
                                    <button
                                      onClick={() => initiatePayment(payment)}
                                      disabled={!!processingId}
                                      className="px-5 py-2.5 bg-lime text-navy border-[3px] border-navy rounded-2xl font-display font-bold text-[11px] uppercase tracking-wider transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                                    >
                                      {processingId === (payment.id || payment._id) ? (
                                        <>
                                          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                                          Processing...
                                        </>
                                      ) : (
                                        <>
                                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7.5a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" /><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 17.625V4.875zM8.25 9.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM18.75 9a.75.75 0 00-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 00.75-.75V9.75a.75.75 0 00-.75-.75h-.008zM4.5 9.75A.75.75 0 015.25 9h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H5.25a.75.75 0 01-.75-.75V9.75z" clipRule="evenodd" /></svg>
                                          Pay Online
                                        </>
                                      )}
                                    </button>
                                    ) : (
                                      <div title="Online payments are currently disabled by admin" className="px-5 py-2.5 bg-cloud text-navy/35 border-[3px] border-navy/15 rounded-2xl font-display font-bold text-[11px] uppercase tracking-wider cursor-not-allowed flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" /></svg>
                                        Pay Online
                                        <span className="text-[9px] font-normal lowercase tracking-normal opacity-60">(disabled)</span>
                                      </div>
                                    )}
                                    {bankAccounts.length > 0 && (
                                      <button
                                        onClick={() => openTransferModal(payment)}
                                        className="px-5 py-2.5 bg-ghost text-navy border-[3px] border-navy rounded-2xl font-display font-bold text-[11px] uppercase tracking-wider transition-all hover:bg-cloud flex items-center gap-2"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.47 1.72a.75.75 0 011.06 0l3 3a.75.75 0 01-1.06 1.06l-1.72-1.72V7.5h-1.5V4.06L9.53 5.78a.75.75 0 01-1.06-1.06l3-3zM11.25 7.5V15a.75.75 0 001.5 0V7.5h-1.5z" /><path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v11.25C1.5 17.16 2.34 18 3.375 18H9.75v1.5H6a.75.75 0 000 1.5h12a.75.75 0 000-1.5h-3.75V18h6.375c1.035 0 1.875-.84 1.875-1.875V4.875C22.5 3.839 21.66 3 20.625 3H3.375z" /></svg>
                                        Bank Transfer
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ═══ PAYMENT HISTORY ═══ */}
            {activeTab === "history" && (
              <div className="space-y-6">
                {/* Bank Transfer Submissions */}
                {myTransfers.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="font-display font-black text-lg text-navy flex items-center gap-2">
                      <svg className="w-5 h-5 text-lavender" fill="currentColor" viewBox="0 0 24 24"><path d="M11.47 1.72a.75.75 0 011.06 0l3 3a.75.75 0 01-1.06 1.06l-1.72-1.72V7.5h-1.5V4.06L9.53 5.78a.75.75 0 01-1.06-1.06l3-3zM11.25 7.5V15a.75.75 0 001.5 0V7.5h-1.5z" /><path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v11.25C1.5 17.16 2.34 18 3.375 18H9.75v1.5H6a.75.75 0 000 1.5h12a.75.75 0 000-1.5h-3.75V18h6.375c1.035 0 1.875-.84 1.875-1.875V4.875C22.5 3.839 21.66 3 20.625 3H3.375z" /></svg>
                      Bank Transfers
                    </h2>
                    {myTransfers.map((transfer, i) => {
                      const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
                      const sCfg = TRANSFER_STATUS_STYLES[transfer.status];
                      return (
                        <div key={transfer._id} className={`bg-snow border-[3px] border-navy ${accent} border-l-[6px] rounded-[1.5rem] press-4 press-black overflow-hidden`}>
                          <div className="px-5 py-3 border-b-[3px] border-navy/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/40">Bank Transfer</span>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${sCfg.bg} ${sCfg.text} font-display font-bold text-[10px] uppercase tracking-[0.08em]`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />
                                {sCfg.label}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/40">
                              {new Date(transfer.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="p-5">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <h3 className="font-display font-black text-base text-navy">{transfer.paymentTitle}</h3>
                                <p className="text-[11px] text-navy/50">
                                  Ref: {transfer.transactionReference} &middot; From: {transfer.senderName} ({transfer.senderBank})
                                </p>
                                <p className="text-[11px] text-navy/50">
                                  To: {transfer.bankAccountBank} &middot; {transfer.bankAccountNumber}
                                </p>
                                {transfer.adminNote && (
                                  <p className={`text-[11px] italic mt-1 ${transfer.status === "rejected" ? "text-coral" : "text-teal"}`}>
                                    Admin: {transfer.adminNote}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <p className="font-display font-black text-xl text-navy">₦{transfer.amount.toLocaleString()}</p>
                                {transfer.status === "approved" && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => downloadReceipt(transfer.transactionReference)}
                                      disabled={downloadingReceipt === transfer.transactionReference}
                                      className="px-4 py-2 bg-lime border-[3px] border-navy rounded-xl font-display font-bold text-xs text-navy uppercase tracking-wider press-2 press-navy disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                      {downloadingReceipt === transfer.transactionReference ? (
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" /></svg>
                                      )}
                                      {downloadingReceipt === transfer.transactionReference ? "..." : "PDF"}
                                    </button>
                                    <button
                                      onClick={() => resendReceipt(transfer.transactionReference)}
                                      disabled={resendingReceipt === transfer.transactionReference}
                                      className="px-4 py-2 bg-lavender/30 border-[3px] border-navy/30 rounded-xl font-display font-bold text-xs text-navy uppercase tracking-wider hover:bg-lavender/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                      title="Resend receipt to your email"
                                    >
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" /><path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" /></svg>
                                      {resendingReceipt === transfer.transactionReference ? "..." : "Email"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Paystack Online Transactions */}
                {transactions.length > 0 && (
                  <div className="space-y-3">
                    {myTransfers.length > 0 && (
                      <h2 className="font-display font-black text-lg text-navy flex items-center gap-2">
                        <svg className="w-5 h-5 text-teal" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7.5a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" /><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 17.625V4.875zM8.25 9.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM18.75 9a.75.75 0 00-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 00.75-.75V9.75a.75.75 0 00-.75-.75h-.008zM4.5 9.75A.75.75 0 015.25 9h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H5.25a.75.75 0 01-.75-.75V9.75z" clipRule="evenodd" /></svg>
                        Online Payments
                      </h2>
                    )}
                    {transactions.map((txn, i) => {
                      const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
                      const statusCfg = txn.status === "success"
                        ? { bg: "bg-teal-light", text: "text-teal", dot: "bg-teal" }
                        : txn.status === "pending"
                        ? { bg: "bg-sunny-light", text: "text-sunny", dot: "bg-sunny" }
                        : { bg: "bg-coral-light", text: "text-coral", dot: "bg-coral" };

                      return (
                        <div
                          key={txn._id}
                          className={`bg-snow border-[3px] border-navy ${accent} border-l-[6px] rounded-[1.5rem] press-4 press-black overflow-hidden transition-all`}
                        >
                          {/* Header */}
                          <div className="px-5 py-3 border-b-[3px] border-navy/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/40">#{String(i + 1).padStart(2, "0")}</span>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${statusCfg.bg} ${statusCfg.text} font-display font-bold text-[10px] uppercase tracking-[0.08em]`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                {txn.status}
                              </span>
                            </div>
                            {txn.channel && (
                              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/40 capitalize">via {txn.channel}</span>
                            )}
                          </div>

                          {/* Body */}
                          <div className="p-5">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="space-y-1.5">
                                <h3 className="font-display font-black text-base text-navy">Ref: {txn.reference}</h3>
                                <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-[0.08em] text-navy/40">
                                  <span>Created: {new Date(txn.createdAt).toLocaleString()}</span>
                                  {txn.paidAt && <span>Paid: {new Date(txn.paidAt).toLocaleString()}</span>}
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <p className="font-display font-black text-xl text-navy">₦{txn.amount.toLocaleString()}</p>
                                {txn.status === "success" && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => downloadReceipt(txn.reference)}
                                      disabled={downloadingReceipt === txn.reference}
                                      className="px-4 py-2.5 bg-lime border-[3px] border-navy rounded-xl font-display font-bold text-xs text-navy uppercase tracking-wider press-2 press-navy disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                      {downloadingReceipt === txn.reference ? (
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" /></svg>
                                      )}
                                      {downloadingReceipt === txn.reference ? "..." : "PDF"}
                                    </button>
                                    <button
                                      onClick={() => resendReceipt(txn.reference)}
                                      disabled={resendingReceipt === txn.reference}
                                      className="px-4 py-2.5 bg-lavender/30 border-[3px] border-navy/30 rounded-xl font-display font-bold text-xs text-navy uppercase tracking-wider hover:bg-lavender/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                      title="Resend receipt to your email"
                                    >
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" /><path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" /></svg>
                                      {resendingReceipt === txn.reference ? "..." : "Email"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Empty state */}
                {transactions.length === 0 && myTransfers.length === 0 && (
                  <div className="bg-navy border-[3px] border-lime rounded-[2rem] shadow-[3px_3px_0_0_#C8F31D] p-12 text-center">
                    <div className="w-14 h-14 bg-teal/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-snow" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z" clipRule="evenodd" /></svg>
                    </div>
                    <p className="font-display font-black text-xl text-snow mb-2">No Transactions Yet</p>
                    <p className="font-display font-normal text-sm text-snow/50">Your payment history will appear here.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ BANK TRANSFER MODAL ═══ */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm">
          <div className="bg-snow border-[3px] border-navy rounded-3xl shadow-[10px_10px_0_0_#000] w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b-[3px] border-navy/10 flex items-center justify-between">
              <div>
                <h2 className="font-display font-black text-xl text-navy">Submit Transfer Proof</h2>
                <p className="text-xs text-navy/50 mt-1">{showTransferModal.title} &mdash; ₦{showTransferModal.amount.toLocaleString()}</p>
              </div>
              <button
                onClick={() => setShowTransferModal(null)}
                title="Close modal"
                className="w-10 h-10 bg-ghost border-[3px] border-navy rounded-xl flex items-center justify-center hover:bg-coral-light transition-colors"
              >
                <svg className="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Bank Account Selection */}
            <div className="p-6 space-y-5">
              {bankAccounts.length === 0 ? (
                <div className="bg-coral-light border-[3px] border-coral rounded-2xl p-5 text-center">
                  <p className="font-display font-bold text-sm text-coral">No bank accounts available.</p>
                  <p className="text-xs text-coral/70 mt-1">Please check back later or contact the admin.</p>
                </div>
              ) : (
                <>
                  {/* Choose IESA Account */}
                  <div className="space-y-2">
                    <label className="text-label text-navy/60">Transfer To (IESA Account)</label>
                    <select
                      title="Select IESA bank account"
                      value={transferForm.bankAccountId}
                      onChange={(e) => setTransferForm({ ...transferForm, bankAccountId: e.target.value })}
                      className="w-full bg-ghost border-[3px] border-navy/20 rounded-xl px-4 py-3 font-display font-medium text-sm text-navy focus:border-navy focus:outline-none transition-colors"
                    >
                      <option value="">Select bank account</option>
                      {bankAccounts.map((acc) => (
                        <option key={acc._id} value={acc._id}>
                          {acc.bankName} &mdash; {acc.accountNumber} ({acc.accountName})
                        </option>
                      ))}
                    </select>
                    {/* Show selected account details */}
                    {transferForm.bankAccountId && (() => {
                      const sel = bankAccounts.find(a => a._id === transferForm.bankAccountId);
                      return sel ? (
                        <div className="bg-lime-light border-[3px] border-navy/20 rounded-xl p-4 space-y-1">
                          <p className="font-display font-bold text-sm text-navy">{sel.accountName}</p>
                          <p className="text-xs text-navy/60">{sel.bankName} &middot; {sel.accountNumber}</p>
                          {sel.notes && <p className="text-xs text-navy/40 italic">{sel.notes}</p>}
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Sender Name */}
                  <div className="space-y-2">
                    <label className="text-label text-navy/60">Your Name (as on bank account)</label>
                    <input
                      type="text"
                      value={transferForm.senderName}
                      onChange={(e) => setTransferForm({ ...transferForm, senderName: e.target.value })}
                      placeholder="John Doe"
                      className="w-full bg-ghost border-[3px] border-navy/20 rounded-xl px-4 py-3 font-display font-medium text-sm text-navy placeholder:text-navy/30 focus:border-navy focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Sender Bank */}
                  <div className="space-y-2">
                    <label className="text-label text-navy/60">Your Bank</label>
                    <select
                      title="Select your bank"
                      value={transferForm.senderBank}
                      onChange={(e) => setTransferForm({ ...transferForm, senderBank: e.target.value })}
                      className="w-full bg-ghost border-[3px] border-navy/20 rounded-xl px-4 py-3 font-display font-medium text-sm text-navy focus:border-navy focus:outline-none transition-colors"
                    >
                      <option value="">Select your bank</option>
                      {NIGERIAN_BANKS.map((bank) => (
                        <option key={bank} value={bank}>{bank}</option>
                      ))}
                    </select>
                  </div>

                  {/* Transaction Reference */}
                  <div className="space-y-2">
                    <label className="text-label text-navy/60">Transaction Reference / Receipt No.</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={transferForm.transactionReference}
                        onChange={(e) => { setTransferForm({ ...transferForm, transactionReference: e.target.value }); setRefExistsError(""); }}
                        onBlur={handleReferenceBlur}
                        placeholder="e.g. TRF/1234567890/XXXX"
                        className={`w-full bg-ghost border-[3px] rounded-xl px-4 py-3 font-display font-medium text-sm text-navy placeholder:text-navy/30 focus:outline-none transition-colors ${refExistsError ? "border-coral focus:border-coral" : "border-navy/20 focus:border-navy"}`}
                      />
                      {checkingRef && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                          <svg className="w-4 h-4 animate-spin text-navy/40" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        </span>
                      )}
                    </div>
                    {refExistsError && (
                      <div className="flex items-start gap-2 bg-coral-light border-2 border-coral rounded-xl px-3 py-2.5">
                        <svg className="w-4 h-4 text-coral mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>
                        <p className="font-display font-medium text-xs text-coral">{refExistsError}</p>
                      </div>
                    )}
                  </div>

                  {/* Transfer Date */}
                  <div className="space-y-2">
                    <label className="text-label text-navy/60">Date of Transfer</label>
                    <input
                      type="date"
                      title="Date of transfer"
                      value={transferForm.transferDate}
                      onChange={(e) => setTransferForm({ ...transferForm, transferDate: e.target.value })}
                      className="w-full bg-ghost border-[3px] border-navy/20 rounded-xl px-4 py-3 font-display font-medium text-sm text-navy focus:border-navy focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Narration (Optional) */}
                  <div className="space-y-2">
                    <label className="text-label text-navy/60">Narration / Notes <span className="text-navy/30">(optional)</span></label>
                    <textarea
                      value={transferForm.narration}
                      onChange={(e) => setTransferForm({ ...transferForm, narration: e.target.value })}
                      placeholder="Any additional details about the transfer..."
                      rows={3}
                      className="w-full bg-ghost border-[3px] border-navy/20 rounded-xl px-4 py-3 font-display font-medium text-sm text-navy placeholder:text-navy/30 focus:border-navy focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  {/* Receipt Image (Optional) */}
                  <div className="space-y-2">
                    <label className="text-label text-navy/60">Receipt Screenshot <span className="text-navy/30">(optional)</span></label>
                    <div className="relative">
                      {receiptImage ? (
                        <div className="flex items-center gap-3 bg-teal-light border-[3px] border-teal/30 rounded-xl px-4 py-3">
                          <svg className="w-5 h-5 text-teal shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h14v9.586l-3.293-3.293a1 1 0 00-1.414 0L11 14.586l-2.293-2.293a1 1 0 00-1.414 0L5 14.586V5zm4 2a2 2 0 100 4 2 2 0 000-4z"/></svg>
                          <span className="font-display font-medium text-sm text-navy truncate flex-1">{receiptImage.name}</span>
                          <button
                            type="button"
                            onClick={() => setReceiptImage(null)}
                            aria-label="Remove receipt image"
                            className="w-6 h-6 rounded-lg bg-coral/20 hover:bg-coral/40 flex items-center justify-center transition-colors shrink-0"
                          >
                            <svg className="w-3.5 h-3.5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-3 bg-ghost border-[3px] border-dashed border-navy/20 rounded-xl px-4 py-4 cursor-pointer hover:border-navy/40 hover:bg-cloud transition-colors">
                          <svg className="w-6 h-6 text-navy/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <div>
                            <span className="font-display font-bold text-sm text-navy/60">Upload receipt screenshot</span>
                            <span className="block font-display text-xs text-navy/30 mt-0.5">JPEG, PNG or WebP — max 5MB</span>
                          </div>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 5 * 1024 * 1024) {
                                  toast.error("File Too Large", "Receipt image must be under 5MB");
                                  return;
                                }
                                setReceiptImage(file);
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowTransferModal(null)}
                      className="flex-1 bg-ghost border-[3px] border-navy/20 px-6 py-3.5 rounded-xl font-display font-bold text-sm text-navy hover:bg-cloud transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleTransferSubmit}
                      disabled={transferSubmitting || !!refExistsError || !transferForm.bankAccountId || !transferForm.senderName || !transferForm.senderBank || !transferForm.transactionReference}
                      className="flex-1 bg-lime border-[3px] border-navy px-6 py-3.5 rounded-xl font-display font-bold text-sm text-navy press-3 press-navy transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {transferSubmitting ? "Submitting..." : "Review & Submit"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CONFIRM TRANSFER MODAL ═══ */}
      {showConfirmModal && showTransferModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-navy/70 backdrop-blur-sm">
          <div className="bg-snow border-4 border-navy rounded-3xl shadow-[10px_10px_0_0_#000] w-full max-w-md">
            <div className="px-6 pt-6 pb-4 border-b-[3px] border-navy/10">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-sunny-light border-[3px] border-navy rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-navy" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>
                </div>
                <h2 className="font-display font-black text-xl text-navy">Confirm Submission</h2>
              </div>
              <p className="font-display font-normal text-sm text-navy/50 ml-13">Please verify all details before submitting.</p>
            </div>
            <div className="p-6 space-y-3">
              {/* Summary rows */}
              {[
                { label: "Payment", value: showTransferModal.title },
                { label: "Amount", value: `₦${showTransferModal.amount.toLocaleString()}` },
                { label: "Your Name", value: transferForm.senderName },
                { label: "Your Bank", value: transferForm.senderBank },
                { label: "Reference", value: transferForm.transactionReference },
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
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 bg-ghost border-[3px] border-navy/20 px-5 py-3 rounded-xl font-display font-bold text-sm text-navy hover:bg-cloud transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={doConfirmedTransferSubmit}
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
