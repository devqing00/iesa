"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams, useRouter } from "next/navigation";

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
      setup: (config: any) => {
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

  // Check for payment verification on mount
  useEffect(() => {
    const reference = searchParams.get("reference");
    if (reference) {
      verifyPayment(reference);
    } else {
      fetchPayments();
      fetchTransactions();
    }
  }, [searchParams]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const token = await user?.getIdToken();
      
      // Get current session (hardcoded for now - should come from context)
      const sessionId = "6777e69ea13e60af6e73e8a6"; // Replace with actual session management
      
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/payments?session_id=${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/paystack/transactions`   , {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

      // Initialize payment with backend
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/paystack/initialize`, {
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

      // Load Paystack inline script if not already loaded
      if (!window.PaystackPop) {
        await loadPaystackScript();
      }

      // Initialize Paystack Popup
      const handler = window.PaystackPop!.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_xxx", // Replace with your public key
        email: user?.email || "",
        amount: Math.round(payment.amount * 100), // Convert to kobo
        ref: data.reference,
        onClose: function () {
          alert("Payment window closed");
          setProcessing(false);
        },
        callback: function (response: any) {
          // Payment successful
          router.push(`/dashboard/payments/verify?reference=${response.reference}`);
        },
      });

      handler.openIframe();
    } catch (error: any) {
      console.error("Payment error:", error);
      alert(error.message || "Failed to initiate payment");
      setProcessing(false);
    }
  };

  const verifyPayment = async (reference: string) => {
    try {
      setLoading(true);
      const token = await user?.getIdToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/paystack/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) throw new Error("Failed to verify payment");
      const data = await res.json();

      if (data.status === "success") {
        alert("Payment verified successfully! ✅");
        // Clear URL parameters and refresh
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
      script.onerror = () => reject(new Error("Failed to load Paystack script"));
      document.body.appendChild(script);
    });
  };

  const pendingPayments = payments.filter((p) => !p.hasPaid);
  const paidPayments = payments.filter((p) => p.hasPaid);

  const downloadReceipt = async (reference: string) => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/paystack/receipt/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to download receipt");
      }

      // Download PDF
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `IESA_Receipt_${reference}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error("Download error:", error);
      alert(error.message || "Failed to download receipt");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-(--glass-bg) rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 bg-(--glass-bg) rounded"></div>
            <div className="h-48 bg-(--glass-bg) rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">
          Payments & Dues
        </h1>
        <p className="text-foreground opacity-70">
          Manage your departmental dues and payment history
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-(--glass-bg) backdrop-blur-(--glass-blur) border border-(--glass-border) p-6">
          <div className="flex items-center gap-3 mb-2">
            <svg
              className="w-8 h-8 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="font-semibold text-lg">Paid</h3>
          </div>
          <p className="text-3xl font-bold text-green-500">{paidPayments.length}</p>
          <p className="text-sm opacity-70">Completed payments</p>
        </div>

        <div className="rounded-xl bg-(--glass-bg) backdrop-blur-(--glass-blur) border border-(--glass-border) p-6">
          <div className="flex items-center gap-3 mb-2">
            <svg
              className="w-8 h-8 text-orange-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="font-semibold text-lg">Pending</h3>
          </div>
          <p className="text-3xl font-bold text-orange-500">
            {pendingPayments.length}
          </p>
          <p className="text-sm opacity-70">Outstanding dues</p>
        </div>

        <div className="rounded-xl bg-(--glass-bg) backdrop-blur-(--glass-blur) border border-(--glass-border) p-6">
          <div className="flex items-center gap-3 mb-2">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="font-semibold text-lg">Total Amount</h3>
          </div>
          <p className="text-3xl font-bold text-primary">
            ₦{paidPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
          </p>
          <p className="text-sm opacity-70">Amount paid</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-(--glass-border)">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "pending"
              ? "text-primary border-b-2 border-primary"
              : "text-foreground opacity-60 hover:opacity-100"
          }`}
        >
          Pending Dues ({pendingPayments.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "history"
              ? "text-primary border-b-2 border-primary"
              : "text-foreground opacity-60 hover:opacity-100"
          }`}
        >
          Payment History ({transactions.length})
        </button>
      </div>

      {/* Pending Dues */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          {pendingPayments.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-xl font-semibold mb-2">All Caught Up!</h3>
              <p className="opacity-70">You have no pending payments</p>
            </div>
          ) : (
            pendingPayments.map((payment) => (
              <div
                key={payment._id}
                className="rounded-xl bg-(--glass-bg) backdrop-blur-(--glass-blur) border border-(--glass-border) p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">
                      {payment.title}
                    </h3>
                    <p className="text-sm opacity-70 mb-3">
                      {payment.description}
                    </p>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span>
                          Due: {new Date(payment.deadline).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                          />
                        </svg>
                        <span className="capitalize">{payment.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-6">
                    <div className="text-3xl font-bold text-primary mb-3">
                      ₦{payment.amount.toLocaleString()}
                    </div>
                    <button
                      onClick={() => initiatePayment(payment)}
                      disabled={processing}
                      className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {processing ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
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
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                            />
                          </svg>
                          Pay Now
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Payment History */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-xl font-semibold mb-2">No Transactions Yet</h3>
              <p className="opacity-70">Your payment history will appear here</p>
            </div>
          ) : (
            transactions.map((txn) => (
              <div
                key={txn._id}
                className="rounded-xl bg-(--glass-bg) backdrop-blur-(--glass-blur) border border-(--glass-border) p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">
                        Transaction #{txn.reference}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          txn.status === "success"
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : txn.status === "pending"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        }`}
                      >
                        {txn.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm opacity-70">
                      <span>
                        Created: {new Date(txn.createdAt).toLocaleString()}
                      </span>
                      {txn.paidAt && (
                        <span>
                          Paid: {new Date(txn.paidAt).toLocaleString()}
                        </span>
                      )}
                      {txn.channel && (
                        <span className="capitalize">via {txn.channel}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-6">
                    <div className="text-2xl font-bold text-primary">
                      ₦{txn.amount.toLocaleString()}
                    </div>
                    {txn.status === "success" && (
                      <button
                        onClick={() => downloadReceipt(txn.reference)}
                        className="mt-3 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 text-sm"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Download Receipt
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
