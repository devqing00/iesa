"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

/* ─── Types ──────────────────────────────── */

interface Payment {
  _id: string;
  id?: string;
  title?: string;
  amount: number;
  sessionId: string;
  category?: string;
  type?: string;
  deadline?: string;
  status?: string;
  mandatory?: boolean;
  description?: string;
  paidBy?: string[];
  createdAt?: string;
}

interface Session {
  _id: string;
  id?: string;
  name: string;
  isActive: boolean;
}

interface Transaction {
  _id: string;
  id?: string;
  reference: string;
  amount: number;
  status: string;
  createdAt: string;
  paymentCategory: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

/* ─── Helpers ────────────────────────────── */

function transactionStatusBadge(status: string) {
  switch (status) {
    case "success":
      return "bg-teal-light text-teal";
    case "failed":
      return "bg-coral-light text-coral";
    default:
      return "bg-sunny-light text-sunny";
  }
}

/* ─── Component ──────────────────────────── */

export default function AdminPaymentsPage() {
  const { getAccessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"payments" | "transactions">("payments");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    sessionId: "",
    category: "Dues",
    mandatory: true,
    deadline: "",
    description: "",
  });

  useEffect(() => {
    fetchSessions();
    if (activeTab === "payments") {
      fetchPayments();
    } else {
      fetchTransactions();
    }
  }, [activeTab]);

  /* ─── Data Fetching ──────────────────────────── */

  const fetchSessions = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const response = await fetch(getApiUrl("/api/v1/sessions/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data.map((item: Session & { _id?: string }) => ({ ...item, id: item.id || item._id })));
        // Set active session as default
        const active = data.find((s: Session) => s.isActive);
        if (active && !formData.sessionId) {
          setFormData(prev => ({ ...prev, sessionId: active._id }));
        }
      }
    } catch (error) {
      console.error("Failed to load sessions", error);
    }
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) return;
      const response = await fetch(getApiUrl("/api/v1/payments/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPayments(data.map((item: Payment & { _id?: string }) => ({ ...item, id: item.id || item._id })));
      }
    } catch (error) {
      toast.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) return;
      const response = await fetch(getApiUrl("/api/v1/paystack/transactions"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.map((item: Transaction & { _id?: string }) => ({ ...item, id: item.id || item._id })));
      }
    } catch (error) {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const token = await getAccessToken();
      if (!token) return;
      
      const response = await fetch(getApiUrl("/api/v1/payments/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          amount: parseFloat(formData.amount),
          sessionId: formData.sessionId,
          category: formData.category,
          mandatory: formData.mandatory,
          deadline: new Date(formData.deadline).toISOString(),
          description: formData.description || undefined,
        }),
      });

      if (response.ok) {
        toast.success("Payment created successfully!");
        setShowCreateModal(false);
        setFormData({
          title: "",
          amount: "",
          sessionId: formData.sessionId, // Keep session
          category: "Dues",
          mandatory: true,
          deadline: "",
          description: "",
        });
        fetchPayments();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to create payment");
      }
    } catch (error) {
      toast.error("Failed to create payment");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Filtering Logic ──────────────────────────── */

  const filteredPayments = payments.filter((p) => {
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchesStatus = 
      statusFilter === "all" ? true :
      statusFilter === "paid" ? (p.paidBy && p.paidBy.length > 0) :
      statusFilter === "pending" ? (!p.paidBy || p.paidBy.length === 0) :
      false;
    return matchesCategory && matchesStatus;
  });

  const filteredTransactions = transactions.filter((t) => {
    return statusFilter === "all" || t.status === statusFilter;
  });

  /* ── Stats ──────────────────────── */

  const totalPaymentAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidCount = payments.filter((p) => p.paidBy && p.paidBy.length > 0).length;
  const pendingCount = payments.filter((p) => !p.paidBy || p.paidBy.length === 0).length;
  const overdueCount = 0; // Calculate based on deadline if needed
  const totalTransactionAmount = transactions
    .filter((t) => t.status === "success")
    .reduce((sum, t) => sum + t.amount / 100, 0);

  /* ── Render ─────────────────────── */

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Administration</p>
          <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
            <span className="brush-highlight">Payment</span> Management
          </h1>
          <p className="text-sm text-navy/60 mt-1">Manage payment dues and transactions</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="self-start bg-lime border-[4px] border-navy press-3 press-black px-6 py-2.5 rounded-2xl text-sm font-bold text-navy transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
          </svg>
          Create Payment Due
        </button>
      </div>

      {/* ── Stats Bento Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-navy border-[4px] border-lime rounded-3xl p-6 shadow-[4px_4px_0_0_#C8F31D]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-lime/60 mb-2">Total Revenue</p>
          <p className="font-display font-black text-2xl md:text-3xl text-lime">
            ₦{totalPaymentAmount.toLocaleString()}
          </p>
          <p className="text-xs text-lime/40 mt-1">Total dues amount</p>
        </div>

        {/* Paid */}
        <div className="bg-teal border-[4px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60">Paid</p>
            <div className="w-9 h-9 rounded-xl bg-snow/20 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-snow" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <p className="font-display font-black text-2xl md:text-3xl text-snow">{paidCount}</p>
          <p className="text-xs text-snow/40 mt-1">Payments received</p>
        </div>

        {/* Pending */}
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Pending</p>
            <div className="w-9 h-9 rounded-xl bg-sunny-light flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-sunny" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <p className="font-display font-black text-2xl md:text-3xl text-navy">{pendingCount}</p>
          <p className="text-xs text-navy/40 mt-1">Awaiting payment</p>
        </div>

        {/* Overdue */}
        <div className="bg-coral border-[4px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60">Overdue</p>
            <div className="w-9 h-9 rounded-xl bg-snow/20 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-snow" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <p className="font-display font-black text-2xl md:text-3xl text-snow">{overdueCount}</p>
          <p className="text-xs text-snow/40 mt-1">Past due date</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 p-1 bg-cloud border-[3px] border-navy rounded-2xl w-fit">
        <button
          onClick={() => { setActiveTab("payments"); setStatusFilter("all"); }}
          className={`px-5 py-2 text-sm font-bold rounded-xl transition-all ${
            activeTab === "payments" ? "bg-navy text-lime" : "text-navy/60 hover:text-navy"
          }`}
        >
          Payment Dues
        </button>
        <button
          onClick={() => { setActiveTab("transactions"); setStatusFilter("all"); }}
          className={`px-5 py-2 text-sm font-bold rounded-xl transition-all ${
            activeTab === "transactions" ? "bg-navy text-lime" : "text-navy/60 hover:text-navy"
          }`}
        >
          Transactions
        </button>
      </div>

      {/* ── Payment Dues Tab ── */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="px-4 py-2.5 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer transition-all"
            >
              <option value="all">All Categories</option>
              <option value="dues">Dues</option>
              <option value="event">Events</option>
              <option value="other">Other</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="px-4 py-2.5 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer transition-all"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            {(categoryFilter !== "all" || statusFilter !== "all") && (
              <button
                onClick={() => { setCategoryFilter("all"); setStatusFilter("all"); }}
                className="px-4 py-2.5 rounded-2xl border-[3px] border-navy/20 text-sm text-slate font-bold hover:text-navy hover:border-navy transition-all"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-snow border-[4px] border-navy rounded-3xl overflow-hidden shadow-[4px_4px_0_0_#000]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-[4px] border-navy bg-navy">
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Title</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Category</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Amount</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Paid By</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Mandatory</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center">
                        <div className="inline-block w-8 h-8 border-[3px] border-navy border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-sm text-navy/60">Loading payments...</p>
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-sunny-light flex items-center justify-center">
                          <svg className="w-7 h-7 text-sunny" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 0 1-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.323.152-.691.546-1.004ZM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 0 1-.921.42Z" />
                            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v.816a3.128 3.128 0 0 0-1.071.267 3.248 3.248 0 0 0-1.634 2.917c0 .98.627 1.834 1.287 2.358.36.286.764.508 1.168.64v3.281c-.508-.135-.951-.397-1.223-.706a.75.75 0 0 0-1.134.982c.596.689 1.454 1.114 2.357 1.263V18a.75.75 0 0 0 1.5 0v-.766a3.5 3.5 0 0 0 1.202-.317 3.299 3.299 0 0 0 1.548-2.917c0-.98-.627-1.834-1.287-2.358-.36-.286-.764-.508-1.168-.64V7.999c.401.135.77.377 1.01.689A.75.75 0 0 0 15.372 7.7c-.596-.689-1.455-1.114-2.357-1.263V6Z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <p className="text-sm text-navy/60 font-medium">No payments found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((payment) => (
                      <tr key={payment.id} className="border-b-[3px] border-navy/10 last:border-b-0 hover:bg-ghost transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-navy text-sm">{payment.title}</div>
                          {payment.description && (
                            <div className="text-xs text-slate mt-0.5 line-clamp-1">{payment.description}</div>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="inline-block px-3 py-1 rounded-full bg-cloud text-navy/60 text-xs font-bold">{payment.category}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-display font-black text-base text-navy">₦{payment.amount.toLocaleString()}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="inline-block px-3 py-1 rounded-full bg-teal-light text-teal text-xs font-bold">
                              {payment.paidBy?.length || 0} students
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          {payment.mandatory ? (
                            <span className="inline-block px-3 py-1 rounded-full bg-coral-light text-coral text-xs font-bold">Yes</span>
                          ) : (
                            <span className="inline-block px-3 py-1 rounded-full bg-cloud text-navy/60 text-xs font-bold">No</span>
                          )}
                        </td>
                        <td className="p-4 text-navy/60 text-sm">
                          {payment.deadline ? new Date(payment.deadline).toLocaleDateString() : "N/A"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Transactions Tab ── */}
      {activeTab === "transactions" && (
        <div className="space-y-6">
          {/* Transaction Summary Card */}
          <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Total Successful Transactions</p>
                <p className="font-display font-black text-2xl md:text-3xl text-navy">
                  ₦{totalTransactionAmount.toLocaleString()}
                </p>
              </div>
              <div className="flex gap-3 items-center">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter transactions by status"
                  className="px-4 py-2.5 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer transition-all"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
                {statusFilter !== "all" && (
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="px-4 py-2.5 rounded-2xl border-[3px] border-navy/20 text-sm text-slate font-bold hover:text-navy hover:border-navy transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-snow border-[4px] border-navy rounded-3xl overflow-hidden shadow-[4px_4px_0_0_#000]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-[4px] border-navy bg-navy">
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Reference</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">User</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Category</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Amount</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Status</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center">
                        <div className="inline-block w-8 h-8 border-[3px] border-navy border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-sm text-navy/60">Loading transactions...</p>
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-lavender-light flex items-center justify-center">
                          <svg className="w-7 h-7 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M15.97 2.47a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H7.5a.75.75 0 0 1 0-1.5h11.69l-3.22-3.22a.75.75 0 0 1 0-1.06Zm-7.94 9a.75.75 0 0 1 0 1.06l-3.22 3.22H16.5a.75.75 0 0 1 0 1.5H4.81l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <p className="text-sm text-navy/60 font-medium">No transactions found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b-[3px] border-navy/10 last:border-b-0 hover:bg-ghost transition-colors">
                        <td className="p-4">
                          <span className="font-mono text-xs px-2.5 py-1 rounded-xl bg-cloud border-[2px] border-navy/20 text-navy">{transaction.reference}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-teal-light flex items-center justify-center text-xs font-bold text-teal shrink-0">
                              {transaction.user ? `${transaction.user.firstName[0]}${transaction.user.lastName[0]}` : "?"}
                            </div>
                            <div>
                              <div className="font-bold text-navy text-sm">
                                {transaction.user ? `${transaction.user.firstName} ${transaction.user.lastName}` : "N/A"}
                              </div>
                              {transaction.user?.email && (
                                <div className="text-xs text-slate mt-0.5">{transaction.user.email}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="inline-block px-3 py-1 rounded-full bg-cloud text-navy/60 text-xs font-bold">{transaction.paymentCategory || "N/A"}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-display font-black text-base text-navy">₦{(transaction.amount / 100).toLocaleString()}</span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${transactionStatusBadge(transaction.status)}`}>
                            {transaction.status}
                          </span>
                        </td>
                        <td className="p-4 text-navy/60 text-sm">{new Date(transaction.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Payment Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-snow border-[4px] border-navy rounded-3xl p-8 shadow-[10px_10px_0_0_#000] max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-black text-2xl text-navy">Create Payment Due</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-xl bg-cloud hover:bg-navy/10 flex items-center justify-center transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="space-y-5">
              {/* Title Field */}
              <div>
                <label htmlFor="title" className="block text-xs font-bold uppercase tracking-wider text-slate mb-2">
                  Payment Title <span className="text-coral">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Department Dues 2024/2025"
                  required
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy placeholder:text-slate/50 focus:outline-none focus:ring-4 focus:ring-lime/30 transition-all"
                />
              </div>

              {/* Amount and Category Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="amount" className="block text-xs font-bold uppercase tracking-wider text-slate mb-2">
                    Amount (₦) <span className="text-coral">*</span>
                  </label>
                  <input
                    id="amount"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="5000"
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy placeholder:text-slate/50 focus:outline-none focus:ring-4 focus:ring-lime/30 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="category" className="block text-xs font-bold uppercase tracking-wider text-slate mb-2">
                    Category <span className="text-coral">*</span>
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy appearance-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-lime/30 transition-all"
                  >
                    <option key="dues" value="Dues">Dues</option>
                    <option key="event" value="Event">Event</option>
                    <option key="other" value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Session and Deadline Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="sessionId" className="block text-xs font-bold uppercase tracking-wider text-slate mb-2">
                    Session <span className="text-coral">*</span>
                  </label>
                  <select
                    id="sessionId"
                    value={formData.sessionId}
                    onChange={(e) => setFormData({ ...formData, sessionId: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy appearance-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-lime/30 transition-all"
                  >
                    <option value="">Select Session</option>
                    {sessions.map((session) => (
                      <option key={session._id} value={session._id}>
                        {session.name} {session.isActive && "(Active)"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="deadline" className="block text-xs font-bold uppercase tracking-wider text-slate mb-2">
                    Deadline <span className="text-coral">*</span>
                  </label>
                  <input
                    id="deadline"
                    type="datetime-local"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy focus:outline-none focus:ring-4 focus:ring-lime/30 transition-all"
                  />
                </div>
              </div>

              {/* Mandatory Checkbox */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.mandatory}
                    onChange={(e) => setFormData({ ...formData, mandatory: e.target.checked })}
                    className="w-5 h-5 rounded-lg border-[3px] border-navy checked:bg-lime checked:border-navy focus:ring-4 focus:ring-lime/30 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-navy group-hover:text-navy/70 transition-colors">
                    Mandatory Payment (Students must pay to access certain features)
                  </span>
                </label>
              </div>

              {/* Description Field */}
              <div>
                <label htmlFor="description" className="block text-xs font-bold uppercase tracking-wider text-slate mb-2">
                  Description <span className="text-slate/50">(Optional)</span>
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional details about this payment..."
                  rows={3}
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy placeholder:text-slate/50 focus:outline-none focus:ring-4 focus:ring-lime/30 transition-all resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-transparent border-[3px] border-navy rounded-2xl font-display font-black text-navy hover:bg-navy hover:text-lime transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-lime border-[4px] border-navy rounded-2xl font-display font-black text-navy shadow-[5px_5px_0_0_#0F0F2D] hover:shadow-[8px_8px_0_0_#0F0F2D] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                >
                  {submitting ? "Creating..." : "Create Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
