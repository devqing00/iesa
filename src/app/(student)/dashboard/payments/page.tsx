"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams, useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/api";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

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

// Declare Paystack on window object
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
      }) => {
        openIframe: () => void;
      };
    };
  }
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<PaystackTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

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
      const token = await user?.getIdToken();

      // Fetch current session first
      const sessionRes = await fetch(getApiUrl("/api/sessions/active"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!sessionRes.ok) throw new Error("Failed to fetch session");
      const session = await sessionRes.json();
      const sessionId = session.id || session._id;

      const res = await fetch(
        getApiUrl(`/api/v1/payments?session_id=${sessionId}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error("Failed to fetch payments");
      const data = await res.json();
      setPayments(data);
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch(getApiUrl("/api/v1/paystack/transactions"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch transactions");
      const data = await res.json();
      setTransactions(data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  const initiatePayment = async (payment: Payment) => {
    if (processing) return;

    setProcessing(true);
    try {
      const token = await user?.getIdToken();

      const res = await fetch(getApiUrl("/api/v1/paystack/initialize"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: payment.amount,
          paymentId: payment._id,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to initialize payment");
      }

      const data = await res.json();

      if (!window.PaystackPop) {
        await loadPaystackScript();
      }

      const handler = window.PaystackPop!.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_xxx",
        email: user?.email || "",
        amount: Math.round(payment.amount * 100),
        ref: data.reference,
        onClose: function () {
          alert("Payment window closed");
          setProcessing(false);
        },
        callback: function (response) {
          router.push(
            `/dashboard/payments/verify?reference=${response.reference}`
          );
        },
      });

      handler.openIframe();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to initiate payment";
      console.error("Payment error:", error);
      alert(errorMessage);
      setProcessing(false);
    }
  };

  const verifyPayment = async (reference: string) => {
    try {
      setLoading(true);
      const token = await user?.getIdToken();

      const res = await fetch(
        getApiUrl(`/api/v1/paystack/verify/${reference}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error("Failed to verify payment");
      const data = await res.json();

      if (data.status === "success") {
        alert("Payment verified successfully!");
        router.push("/dashboard/payments");
        fetchPayments();
        fetchTransactions();
      } else {
        alert(`Payment status: ${data.status}`);
        router.push("/dashboard/payments");
      }
    } catch (error) {
      console.error("Verification error:", error);
      alert("Failed to verify payment");
      router.push("/dashboard/payments");
    } finally {
      setLoading(false);
    }
  };

  const loadPaystackScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.PaystackPop) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load Paystack script"));
      document.body.appendChild(script);
    });
  };

  const pendingPayments = payments.filter((p) => !p.hasPaid);
  const paidPayments = payments.filter((p) => p.hasPaid);

  const downloadReceipt = async (reference: string) => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch(
        getApiUrl(`/api/v1/paystack/receipt/${reference}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to download receipt";
      console.error("Download error:", error);
      alert(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <DashboardHeader title="Payments & Dues" />

      <div className="px-4 md:px-8 py-6 pb-24 md:pb-8">
        {loading ? (
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="h-6 bg-bg-secondary animate-pulse w-1/4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-border p-6 animate-pulse">
                  <div className="h-4 bg-bg-secondary mb-2 w-1/3" />
                  <div className="h-8 bg-bg-secondary w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header Section */}
            <section className="border-t border-border pt-8">
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
                      Payment Management
                    </h2>
                    <p className="text-label-sm text-text-muted">
                      Manage your departmental dues and payment history
                    </p>
                  </div>
                </div>
                <span className="page-number hidden md:block">Page 01</span>
              </div>
            </section>

            {/* Summary Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Paid Card */}
              <div className="border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 border border-border flex items-center justify-center">
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
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <span className="text-label-sm text-text-muted">
                    Completed
                  </span>
                </div>
                <p className="font-display text-3xl text-green-600 dark:text-green-400 mb-1">
                  {paidPayments.length}
                </p>
                <p className="text-body text-sm text-text-secondary">
                  Payments made
                </p>
              </div>

              {/* Pending Card */}
              <div className="border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 border border-border flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-orange-600 dark:text-orange-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <span className="text-label-sm text-text-muted">Pending</span>
                </div>
                <p className="font-display text-3xl text-orange-600 dark:text-orange-400 mb-1">
                  {pendingPayments.length}
                </p>
                <p className="text-body text-sm text-text-secondary">
                  Outstanding dues
                </p>
              </div>

              {/* Total Card */}
              <div className="border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 border border-border flex items-center justify-center">
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
                        d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
                      />
                    </svg>
                  </div>
                  <span className="text-label-sm text-text-muted">
                    Total Paid
                  </span>
                </div>
                <p className="font-display text-3xl text-text-primary mb-1">
                  ₦
                  {paidPayments
                    .reduce((sum, p) => sum + p.amount, 0)
                    .toLocaleString()}
                </p>
                <p className="text-body text-sm text-text-secondary">
                  Amount paid
                </p>
              </div>
            </section>

            {/* Tabs */}
            <section className="border-b border-border">
              <div className="flex gap-6">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`pb-3 text-label-sm transition-colors ${
                    activeTab === "pending"
                      ? "text-text-primary border-b-2 border-charcoal dark:border-cream"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Pending Dues ({pendingPayments.length})
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`pb-3 text-label-sm transition-colors ${
                    activeTab === "history"
                      ? "text-text-primary border-b-2 border-charcoal dark:border-cream"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Payment History ({transactions.length})
                </button>
              </div>
            </section>

            {/* Pending Dues */}
            {activeTab === "pending" && (
              <section className="space-y-4">
                {pendingPayments.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 border border-border flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-green-600 dark:text-green-400"
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
                    <h3 className="font-display text-lg text-text-primary mb-2">
                      All Caught Up!
                    </h3>
                    <p className="text-body text-sm text-text-muted">
                      You have no pending payments
                    </p>
                  </div>
                ) : (
                  pendingPayments.map((payment, index) => (
                    <article
                      key={payment._id}
                      className="border border-border hover:border-border-dark transition-colors"
                    >
                      <div className="p-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-label-sm text-text-muted">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-label-sm">
                            Pending
                          </span>
                        </div>
                        <span className="text-label-sm text-text-muted capitalize">
                          {payment.category}
                        </span>
                      </div>

                      <div className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-2">
                            <h3 className="font-display text-lg text-text-primary">
                              {payment.title}
                            </h3>
                            <p className="text-body text-sm text-text-secondary">
                              {payment.description}
                            </p>
                            <div className="flex items-center gap-2 text-label-sm text-text-muted">
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
                                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                                />
                              </svg>
                              <span>
                                Due:{" "}
                                {new Date(
                                  payment.deadline
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <p className="font-display text-2xl text-text-primary">
                              ₦{payment.amount.toLocaleString()}
                            </p>
                            <button
                              onClick={() => initiatePayment(payment)}
                              disabled={processing}
                              className="px-6 py-3 bg-charcoal dark:bg-cream text-cream dark:text-charcoal text-label-sm hover:bg-charcoal-light dark:hover:bg-cream-dark transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              {processing ? (
                                <>
                                  <svg
                                    className="animate-spin w-4 h-4"
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
                                  Processing...
                                </>
                              ) : (
                                <>
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
                                      d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                                    />
                                  </svg>
                                  Pay Now
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </section>
            )}

            {/* Payment History */}
            {activeTab === "history" && (
              <section className="space-y-4">
                {transactions.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 border border-border flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-text-muted"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                    </div>
                    <h3 className="font-display text-lg text-text-primary mb-2">
                      No Transactions Yet
                    </h3>
                    <p className="text-body text-sm text-text-muted">
                      Your payment history will appear here
                    </p>
                  </div>
                ) : (
                  transactions.map((txn, index) => (
                    <article
                      key={txn._id}
                      className="border border-border hover:border-border-dark transition-colors"
                    >
                      <div className="p-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-label-sm text-text-muted">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-label-sm ${
                              txn.status === "success"
                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                : txn.status === "pending"
                                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                            }`}
                          >
                            {txn.status}
                          </span>
                        </div>
                        {txn.channel && (
                          <span className="text-label-sm text-text-muted capitalize">
                            via {txn.channel}
                          </span>
                        )}
                      </div>

                      <div className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-2">
                            <h3 className="font-display text-base text-text-primary">
                              Transaction #{txn.reference}
                            </h3>
                            <div className="flex flex-wrap gap-4 text-label-sm text-text-muted">
                              <span>
                                Created:{" "}
                                {new Date(txn.createdAt).toLocaleString()}
                              </span>
                              {txn.paidAt && (
                                <span>
                                  Paid: {new Date(txn.paidAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <p className="font-display text-xl text-text-primary">
                              ₦{txn.amount.toLocaleString()}
                            </p>
                            {txn.status === "success" && (
                              <button
                                onClick={() => downloadReceipt(txn.reference)}
                                className="px-4 py-2 border border-border text-label-sm text-text-secondary hover:border-border-dark hover:text-text-primary transition-colors flex items-center gap-2"
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
                                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                                  />
                                </svg>
                                Receipt
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
