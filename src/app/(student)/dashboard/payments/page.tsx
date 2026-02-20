"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams, useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/api";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useToast } from "@/components/ui/Toast";

/* ─── Types ─── */
interface Payment {
  _id: string;
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

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: {
        key: string;
        email: string;
        amount: number;
        ref: string;
        onClose: () => void;
        callback: (response: { reference: string }) => void;
      }) => { openIframe: () => void };
    };
  }
}

/* ─── Accent cycle ─── */
const ACCENT_CYCLE = ["border-l-teal", "border-l-coral", "border-l-lavender", "border-l-sunny"] as const;

export default function PaymentsPage() {
  const { user, getAccessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<PaystackTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const toast = useToast();

  /* ─── Data Fetching ─── */
  useEffect(() => {
    const reference = searchParams.get("reference");
    if (reference) {
      verifyPayment(reference);
    } else {
      fetchPayments();
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const sessionRes = await fetch(getApiUrl("/api/v1/sessions/active"), { headers: { Authorization: `Bearer ${token}` } });
      if (!sessionRes.ok) throw new Error("Failed to fetch session");
      const session = await sessionRes.json();
      const sessionId = session.id || session._id;
      const res = await fetch(getApiUrl(`/api/v1/payments?session_id=${sessionId}`), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch payments");
      setPayments(await res.json());
    } catch (error) {
      console.error("Error fetching payments:", error);
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

  const initiatePayment = async (payment: Payment) => {
    if (processing) return;
    setProcessing(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/paystack/initialize"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: payment.amount, paymentId: payment._id }),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.detail || "Failed to initialize payment"); }
      const data = await res.json();
      if (!window.PaystackPop) await loadPaystackScript();
      const handler = window.PaystackPop!.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_xxx",
        email: user?.email || "",
        amount: Math.round(payment.amount * 100),
        ref: data.reference,
        onClose: () => { toast.info("Payment Closed", "Payment window was closed"); setProcessing(false); },
        callback: (response) => { router.push(`/dashboard/payments/verify?reference=${response.reference}`); },
      });
      handler.openIframe();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to initiate payment";
      console.error("Payment error:", error);
      toast.error("Payment Error", errorMessage);
      setProcessing(false);
    }
  };

  const verifyPayment = async (reference: string) => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/paystack/verify/${reference}`), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to verify payment");
      const data = await res.json();
      if (data.status === "success") {
        toast.success("Payment Verified", "Your payment has been verified successfully!");
        router.push("/dashboard/payments");
        fetchPayments();
        fetchTransactions();
      } else {
        toast.warning("Payment Status", `Payment status: ${data.status}`);
        router.push("/dashboard/payments");
      }
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("Verification Failed", "Failed to verify payment");
      router.push("/dashboard/payments");
    } finally {
      setLoading(false);
    }
  };

  const loadPaystackScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.PaystackPop) { resolve(); return; }
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Paystack script"));
      document.body.appendChild(script);
    });
  };

  const downloadReceipt = async (reference: string) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/paystack/receipt/${reference}`), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const error = await res.json(); throw new Error(error.detail || "Failed to download receipt"); }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `IESA_Receipt_${reference}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to download receipt";
      console.error("Download error:", error);
      toast.error("Download Failed", errorMessage);
    }
  };

  const pendingPayments = payments.filter((p) => !p.hasPaid);
  const paidPayments = payments.filter((p) => p.hasPaid);

  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Payments & Dues" />

      <div className="px-4 md:px-8 py-6 pb-24 md:pb-8 max-w-6xl mx-auto relative">
        {/* Diamond Sparkle Decorators */}
        <svg className="fixed top-20 left-[6%] w-5 h-5 text-sunny/18 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed top-44 right-[8%] w-7 h-7 text-teal/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed top-[52%] left-[4%] w-4 h-4 text-coral/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed bottom-36 right-[12%] w-6 h-6 text-lavender/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed top-[32%] right-[20%] w-4 h-4 text-lime/18 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>

        {loading ? (
          /* ── Loading Skeleton ── */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-7 h-48 bg-cloud/50 border-[4px] border-navy/10 rounded-[2rem] animate-pulse" />
              <div className="md:col-span-5 grid grid-cols-1 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-cloud/50 border-[4px] border-navy/10 rounded-[1.5rem] animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* ═══ BENTO HERO ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Title Card — sunny theme */}
              <div className="md:col-span-7 bg-sunny border-[6px] border-navy rounded-[2rem] p-8 shadow-[10px_10px_0_0_#000] rotate-[-0.4deg] hover:rotate-0 transition-transform relative overflow-hidden">
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
                <div className="bg-teal-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[0.3deg] hover:rotate-0 transition-transform flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Completed</span>
                    <p className="font-display font-black text-2xl text-navy">{paidPayments.length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-teal/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-teal" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                  </div>
                </div>
                {/* Pending */}
                <div className="bg-coral-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Pending</span>
                    <p className={`font-display font-black text-2xl ${pendingPayments.length > 0 ? "text-coral" : "text-navy"}`}>{pendingPayments.length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-coral/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-coral" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" /></svg>
                  </div>
                </div>
                {/* Total Paid */}
                <div className="bg-navy border-[4px] border-lime rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-lime/60">Total Paid</span>
                    <p className="font-display font-black text-2xl text-lime">₦{paidPayments.reduce((s, p) => s + p.amount, 0).toLocaleString()}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-lime/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-lime" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7.5a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" /><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 17.625V4.875zM8.25 9.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM18.75 9a.75.75 0 00-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 00.75-.75V9.75a.75.75 0 00-.75-.75h-.008zM4.5 9.75A.75.75 0 015.25 9h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H5.25a.75.75 0 01-.75-.75V9.75z" clipRule="evenodd" /></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ TAB BAR ═══ */}
            <div className="bg-snow border-[4px] border-navy rounded-[1.5rem] shadow-[6px_6px_0_0_#000] p-4">
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
                  <div className="bg-navy border-[4px] border-lime rounded-[2rem] shadow-[8px_8px_0_0_#000] p-12 text-center">
                    <div className="w-14 h-14 bg-teal/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-teal" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                    </div>
                    <p className="font-display font-black text-xl text-lime mb-2">All Caught Up!</p>
                    <p className="font-display font-normal text-sm text-lime/60">You have no pending payments. Well done!</p>
                  </div>
                ) : (
                  pendingPayments.map((payment, i) => {
                    const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
                    return (
                      <div
                        key={payment._id}
                        className={`bg-snow border-[4px] border-navy ${accent} border-l-[6px] rounded-[1.5rem] shadow-[6px_6px_0_0_#000] overflow-hidden transition-all hover:shadow-[4px_4px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px]`}
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

                            <div className="flex items-center gap-4">
                              <p className="font-display font-black text-2xl text-navy">₦{payment.amount.toLocaleString()}</p>
                              <button
                                onClick={() => initiatePayment(payment)}
                                disabled={processing}
                                className="px-6 py-3 bg-lime text-navy border-[4px] border-navy rounded-2xl shadow-[5px_5px_0_0_#0F0F2D] font-display font-bold text-xs uppercase tracking-wider hover:shadow-[7px_7px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                              >
                                {processing ? (
                                  <>
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7.5a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" /><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 17.625V4.875zM8.25 9.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM18.75 9a.75.75 0 00-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 00.75-.75V9.75a.75.75 0 00-.75-.75h-.008zM4.5 9.75A.75.75 0 015.25 9h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H5.25a.75.75 0 01-.75-.75V9.75z" clipRule="evenodd" /></svg>
                                    Pay Now
                                  </>
                                )}
                              </button>
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
              <div className="space-y-4">
                {transactions.length === 0 ? (
                  <div className="bg-navy border-[4px] border-lime rounded-[2rem] shadow-[8px_8px_0_0_#000] p-12 text-center">
                    <div className="w-14 h-14 bg-lime/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-lime" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z" clipRule="evenodd" /></svg>
                    </div>
                    <p className="font-display font-black text-xl text-lime mb-2">No Transactions Yet</p>
                    <p className="font-display font-normal text-sm text-lime/60">Your payment history will appear here.</p>
                  </div>
                ) : (
                  transactions.map((txn, i) => {
                    const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
                    const statusCfg = txn.status === "success"
                      ? { bg: "bg-teal-light", text: "text-teal", dot: "bg-teal" }
                      : txn.status === "pending"
                      ? { bg: "bg-sunny-light", text: "text-sunny", dot: "bg-sunny" }
                      : { bg: "bg-coral-light", text: "text-coral", dot: "bg-coral" };

                    return (
                      <div
                        key={txn._id}
                        className={`bg-snow border-[4px] border-navy ${accent} border-l-[6px] rounded-[1.5rem] shadow-[6px_6px_0_0_#000] overflow-hidden transition-all hover:shadow-[4px_4px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px]`}
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
                                <button
                                  onClick={() => downloadReceipt(txn.reference)}
                                  className="px-4 py-2.5 bg-ghost border-[3px] border-navy rounded-xl font-display font-bold text-xs text-navy uppercase tracking-wider hover:bg-cloud transition-colors flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" /></svg>
                                  Receipt
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
