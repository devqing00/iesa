"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/api";
import {
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  listAllTransfers,
  reviewTransfer,
  NIGERIAN_BANKS,
  TRANSFER_STATUS_STYLES,
} from "@/lib/api";
import type { BankAccount, BankTransfer } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import Pagination from "@/components/ui/Pagination";

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

function AdminPaymentsPage() {
  const { getAccessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"payments" | "transactions" | "bank-accounts" | "transfers">("payments");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payPage, setPayPage] = useState(1);
  const [txnPage, setTxnPage] = useState(1);
  const PAGE_SIZE = 15;
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

  // ── Bank Accounts State ──
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountLoading, setBankAccountLoading] = useState(false);
  const [showBankAccountModal, setShowBankAccountModal] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [bankAccountForm, setBankAccountForm] = useState({
    bankName: "",
    accountNumber: "",
    accountName: "",
    notes: "",
    isActive: true,
  });
  const [bankAccountSubmitting, setBankAccountSubmitting] = useState(false);

  // ── Bank Transfers State ──
  const [bankTransfers, setBankTransfers] = useState<BankTransfer[]>([]);
  const [bankTransferLoading, setBankTransferLoading] = useState(false);
  const [transferStatusFilter, setTransferStatusFilter] = useState("all");
  const [transferPage, setTransferPage] = useState(1);
  const [reviewingTransfer, setReviewingTransfer] = useState<BankTransfer | null>(null);
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // ── Platform Settings State ──
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(true);
  const [togglingPayment, setTogglingPayment] = useState(false);

  useEffect(() => {
    fetchSessions();
    fetchPlatformSettings();
    if (activeTab === "payments") {
      fetchPayments();
    } else if (activeTab === "transactions") {
      fetchTransactions();
    } else if (activeTab === "bank-accounts") {
      fetchBankAccounts();
    } else if (activeTab === "transfers") {
      fetchBankTransfers();
    }
  }, [activeTab]);

  /* ─── Platform Settings ──────────────────────── */

  const fetchPlatformSettings = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(getApiUrl("/api/v1/settings"), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setOnlinePaymentEnabled(data.onlinePaymentEnabled ?? true);
      }
    } catch { /* non-critical */ }
  };

  const toggleOnlinePayment = async (enabled: boolean) => {
    setTogglingPayment(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(getApiUrl(`/api/v1/settings?onlinePaymentEnabled=${enabled}`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to update setting");
      setOnlinePaymentEnabled(enabled);
      toast.success(enabled ? "Online payments enabled" : "Online payments disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update setting");
    } finally {
      setTogglingPayment(false);
    }
  };

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

  /* ─── Bank Accounts ──────────────────────────── */

  const fetchBankAccounts = async () => {
    try {
      setBankAccountLoading(true);
      const data = await listBankAccounts();
      setBankAccounts(data);
    } catch {
      toast.error("Failed to load bank accounts");
    } finally {
      setBankAccountLoading(false);
    }
  };

  const openCreateBankAccount = () => {
    setEditingBankAccount(null);
    setBankAccountForm({ bankName: "", accountNumber: "", accountName: "", notes: "", isActive: true });
    setShowBankAccountModal(true);
  };

  const openEditBankAccount = (account: BankAccount) => {
    setEditingBankAccount(account);
    setBankAccountForm({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      notes: account.notes || "",
      isActive: account.isActive,
    });
    setShowBankAccountModal(true);
  };

  const handleBankAccountSubmit = async () => {
    if (!bankAccountForm.bankName || !bankAccountForm.accountNumber || !bankAccountForm.accountName) {
      toast.error("Please fill all required fields");
      return;
    }
    setBankAccountSubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      if (editingBankAccount) {
        await updateBankAccount(editingBankAccount._id, {
          bankName: bankAccountForm.bankName,
          accountNumber: bankAccountForm.accountNumber,
          accountName: bankAccountForm.accountName,
          notes: bankAccountForm.notes || undefined,
          isActive: bankAccountForm.isActive,
        });
        toast.success("Bank account updated");
      } else {
        await createBankAccount({
          bankName: bankAccountForm.bankName,
          accountNumber: bankAccountForm.accountNumber,
          accountName: bankAccountForm.accountName,
          notes: bankAccountForm.notes || undefined,
        });
        toast.success("Bank account created");
      }
      setShowBankAccountModal(false);
      fetchBankAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save bank account");
    } finally {
      setBankAccountSubmitting(false);
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    if (!confirm("Delete this bank account? Students will no longer see it.")) return;
    try {
      await deleteBankAccount(id);
      toast.success("Bank account deleted");
      fetchBankAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete bank account");
    }
  };

  /* ─── Bank Transfers (Review) ──────────────────── */

  const fetchBankTransfers = async () => {
    try {
      setBankTransferLoading(true);
      const data = await listAllTransfers(transferStatusFilter !== "all" ? transferStatusFilter : undefined);
      setBankTransfers(data);
    } catch {
      toast.error("Failed to load bank transfers");
    } finally {
      setBankTransferLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "transfers") {
      fetchBankTransfers();
    }
  }, [transferStatusFilter]);

  const openReviewModal = (transfer: BankTransfer, action: "approved" | "rejected") => {
    setReviewingTransfer(transfer);
    setReviewAction(action);
    setReviewNote("");
  };

  const handleReviewSubmit = async () => {
    if (!reviewingTransfer) return;
    setReviewSubmitting(true);
    try {
      await reviewTransfer(reviewingTransfer._id, { status: reviewAction, adminNote: reviewNote || undefined });
      toast.success(`Transfer ${reviewAction}`);
      setReviewingTransfer(null);
      fetchBankTransfers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to review transfer");
    } finally {
      setReviewSubmitting(false);
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

  // Reset pages when filters/tab change
  useEffect(() => { setPayPage(1); }, [categoryFilter, statusFilter]);
  useEffect(() => { setTxnPage(1); }, [statusFilter]);
  useEffect(() => { setPayPage(1); setTxnPage(1); }, [activeTab]);

  const payTotalPages = Math.ceil(filteredPayments.length / PAGE_SIZE);
  const paginatedPayments = filteredPayments.slice((payPage - 1) * PAGE_SIZE, payPage * PAGE_SIZE);
  const txnTotalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE);
  const paginatedTransactions = filteredTransactions.slice((txnPage - 1) * PAGE_SIZE, txnPage * PAGE_SIZE);
  const btTotalPages = Math.ceil(bankTransfers.length / PAGE_SIZE);
  const paginatedBankTransfers = bankTransfers.slice((transferPage - 1) * PAGE_SIZE, transferPage * PAGE_SIZE);
  const pendingTransferCount = bankTransfers.filter(t => t.status === "pending").length;

  /* ── Stats ──────────────────────── */

  const totalPaymentAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidCount = payments.filter((p) => p.paidBy && p.paidBy.length > 0).length;
  const pendingCount = payments.filter((p) => !p.paidBy || p.paidBy.length === 0).length;
  const overdueCount = 0; // Calculate based on deadline if needed
  const totalTransactionAmount = transactions
    .filter((t) => t.status === "success")
    .reduce((sum, t) => sum + t.amount, 0);

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
          className="self-start bg-lime border-[3px] border-navy press-3 press-black px-6 py-2.5 rounded-2xl text-sm font-bold text-navy transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
          </svg>
          Create Payment Due
        </button>
      </div>

      {/* ── Online Payment Toggle ── */}
      <PermissionGate permission="admin:manage_settings">
        <div className={`border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000] flex items-center justify-between gap-4 transition-colors ${onlinePaymentEnabled ? "bg-teal-light" : "bg-coral-light"}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl border-[3px] border-navy flex items-center justify-center shrink-0 ${onlinePaymentEnabled ? "bg-teal" : "bg-coral"}`}>
              {onlinePaymentEnabled ? (
                <svg className="w-5 h-5 text-snow" fill="currentColor" viewBox="0 0 24 24"><path d="M4.5 3.75a3 3 0 00-3 3v.75h21v-.75a3 3 0 00-3-3h-15z" /><path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 003 3h15a3 3 0 003-3v-7.5zm-18 3.75a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clipRule="evenodd" /></svg>
              ) : (
                <svg className="w-5 h-5 text-snow" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" /></svg>
              )}
            </div>
            <div>
              <p className="font-display font-black text-sm text-navy">Online Payments (Paystack)</p>
              <p className="text-xs text-navy/60 mt-0.5">
                {onlinePaymentEnabled
                  ? "Students can pay online via card, bank transfer, or USSD."
                  : "Online payments are disabled. Students can only use bank transfer."}
              </p>
            </div>
          </div>
          {/* eslint-disable-next-line jsx-a11y/aria-proptypes */}
          <button
            onClick={() => toggleOnlinePayment(!onlinePaymentEnabled)}
            disabled={togglingPayment}
            className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-[3px] border-navy transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${onlinePaymentEnabled ? "bg-teal" : "bg-navy/30"}`}
            role="switch"
            aria-checked={onlinePaymentEnabled ? "true" : "false"}
            title={onlinePaymentEnabled ? "Disable online payments" : "Enable online payments"}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-snow shadow-md transition duration-200 ease-in-out mt-0.5 ${onlinePaymentEnabled ? "translate-x-7" : "translate-x-1"}`}
            />
          </button>
        </div>
      </PermissionGate>

      {/* ── Stats Bento Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-navy border-[3px] border-ghost/20 rounded-3xl p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/50 mb-2">Total Revenue</p>
          <p className="font-display font-black text-2xl md:text-3xl text-snow">
            ₦{totalPaymentAmount.toLocaleString()}
          </p>
          <p className="text-xs text-snow/30 mt-1">Total dues amount</p>
        </div>

        {/* Paid */}
        <div className="bg-teal border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
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
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
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
        <div className="bg-coral border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
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
      <div className="flex flex-wrap gap-2 p-1 bg-cloud border-[3px] border-navy rounded-2xl w-fit">
        <button
          onClick={() => { setActiveTab("payments"); setStatusFilter("all"); }}
          className={`px-5 py-2 text-sm font-bold rounded-xl transition-all ${
            activeTab === "payments" ? "bg-navy text-snow" : "text-navy/60 hover:text-navy"
          }`}
        >
          Payment Dues
        </button>
        <button
          onClick={() => { setActiveTab("transactions"); setStatusFilter("all"); }}
          className={`px-5 py-2 text-sm font-bold rounded-xl transition-all ${
            activeTab === "transactions" ? "bg-navy text-snow" : "text-navy/60 hover:text-navy"
          }`}
        >
          Transactions
        </button>
        <button
          onClick={() => setActiveTab("bank-accounts")}
          className={`px-5 py-2 text-sm font-bold rounded-xl transition-all ${
            activeTab === "bank-accounts" ? "bg-navy text-snow" : "text-navy/60 hover:text-navy"
          }`}
        >
          Bank Accounts
        </button>
        <button
          onClick={() => setActiveTab("transfers")}
          className={`px-5 py-2 text-sm font-bold rounded-xl transition-all relative ${
            activeTab === "transfers" ? "bg-navy text-snow" : "text-navy/60 hover:text-navy"
          }`}
        >
          Bank Transfers
          {pendingTransferCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-coral text-snow text-[10px] font-bold rounded-full flex items-center justify-center">
              {pendingTransferCount}
            </span>
          )}
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
          <div className="bg-snow border-[3px] border-navy rounded-3xl overflow-hidden shadow-[4px_4px_0_0_#000]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-[4px] border-navy bg-navy">
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Title</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Category</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Amount</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Paid By</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Mandatory</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Deadline</th>
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
                    paginatedPayments.map((payment) => (
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

          <Pagination page={payPage} totalPages={payTotalPages} onPage={setPayPage} className="mt-4" />
        </div>
      )}

      {/* ── Transactions Tab ── */}
      {activeTab === "transactions" && (
        <div className="space-y-6">
          {/* Transaction Summary Card */}
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
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
          <div className="bg-snow border-[3px] border-navy rounded-3xl overflow-hidden shadow-[4px_4px_0_0_#000]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-[4px] border-navy bg-navy">
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Reference</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">User</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Category</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Amount</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Status</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Date</th>
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
                    paginatedTransactions.map((transaction) => (
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
                          <span className="font-display font-black text-base text-navy">₦{transaction.amount.toLocaleString()}</span>
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

          <Pagination page={txnPage} totalPages={txnTotalPages} onPage={setTxnPage} className="mt-4" />
        </div>
      )}

      {/* ══════════════ BANK ACCOUNTS TAB ══════════════ */}
      {activeTab === "bank-accounts" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-navy/60">Manage IESA bank accounts that students can transfer to</p>
            <PermissionGate permission="bank_transfer:manage_accounts">
              <button
                onClick={openCreateBankAccount}
                className="bg-lime border-[3px] border-navy press-3 press-black px-5 py-2 rounded-2xl text-sm font-bold text-navy transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /></svg>
                Add Account
              </button>
            </PermissionGate>
          </div>

          {bankAccountLoading ? (
            <div className="text-center py-16">
              <div className="inline-block w-8 h-8 border-[3px] border-navy border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-navy/60">Loading bank accounts...</p>
            </div>
          ) : bankAccounts.length === 0 ? (
            <div className="bg-navy border-[3px] border-ghost/20 rounded-3xl p-12 text-center">
              <p className="font-display font-black text-xl text-snow mb-2">No Bank Accounts</p>
              <p className="text-sm text-snow/50">Add a bank account so students can make transfers.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankAccounts.map((account) => (
                <div
                  key={account._id}
                  className={`border-[3px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000] transition-transform hover:rotate-0 ${
                    account.isActive ? "bg-snow rotate-[0.3deg]" : "bg-cloud opacity-60 rotate-[-0.3deg]"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      account.isActive ? "bg-teal-light text-teal" : "bg-coral-light text-coral"
                    }`}>
                      {account.isActive ? "Active" : "Inactive"}
                    </span>
                    <PermissionGate permission="bank_transfer:manage_accounts">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => openEditBankAccount(account)}
                          title="Edit account"
                          className="w-8 h-8 rounded-xl bg-ghost border-[2px] border-navy/20 flex items-center justify-center hover:bg-ghost-light transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDeleteBankAccount(account._id)}
                          title="Delete account"
                          className="w-8 h-8 rounded-xl bg-ghost border-[2px] border-navy/20 flex items-center justify-center hover:bg-coral-light transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </PermissionGate>
                  </div>
                  <h3 className="font-display font-black text-lg text-navy">{account.bankName}</h3>
                  <p className="font-mono text-base text-navy/80 mt-1">{account.accountNumber}</p>
                  <p className="text-sm text-navy/60 mt-0.5">{account.accountName}</p>
                  {account.notes && (
                    <p className="text-xs text-navy/40 mt-2 italic">{account.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ BANK TRANSFERS TAB ══════════════ */}
      {activeTab === "transfers" && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={transferStatusFilter}
              onChange={(e) => { setTransferStatusFilter(e.target.value); setTransferPage(1); }}
              aria-label="Filter by transfer status"
              className="px-4 py-2.5 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer transition-all"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            {transferStatusFilter !== "all" && (
              <button
                onClick={() => { setTransferStatusFilter("all"); setTransferPage(1); }}
                className="px-4 py-2.5 rounded-2xl border-[3px] border-navy/20 text-sm text-slate font-bold hover:text-navy hover:border-navy transition-all"
              >
                Clear
              </button>
            )}
            <span className="text-xs text-navy/40 ml-auto">{bankTransfers.length} transfer(s)</span>
          </div>

          {/* Transfers Table */}
          <div className="bg-snow border-[3px] border-navy rounded-3xl overflow-hidden shadow-[4px_4px_0_0_#000]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-[4px] border-navy bg-navy">
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Student</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Payment</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Amount</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Reference</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Status</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Date</th>
                    <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bankTransferLoading ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center">
                        <div className="inline-block w-8 h-8 border-[3px] border-navy border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-sm text-navy/60">Loading transfers...</p>
                      </td>
                    </tr>
                  ) : paginatedBankTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-lavender-light flex items-center justify-center">
                          <svg className="w-7 h-7 text-lavender" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M15.97 2.47a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H7.5a.75.75 0 0 1 0-1.5h11.69l-3.22-3.22a.75.75 0 0 1 0-1.06Zm-7.94 9a.75.75 0 0 1 0 1.06l-3.22 3.22H16.5a.75.75 0 0 1 0 1.5H4.81l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" /></svg>
                        </div>
                        <p className="text-sm text-navy/60 font-medium">No bank transfers found</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedBankTransfers.map((transfer) => {
                      const sCfg = TRANSFER_STATUS_STYLES[transfer.status];
                      return (
                        <tr key={transfer._id} className="border-b-[3px] border-navy/10 last:border-b-0 hover:bg-ghost transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-lavender-light flex items-center justify-center text-xs font-bold text-lavender shrink-0">
                                {transfer.studentName?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?"}
                              </div>
                              <div>
                                <div className="font-bold text-navy text-sm">{transfer.studentName || "Unknown"}</div>
                                <div className="text-xs text-slate mr-0.5">{transfer.senderBank}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-navy text-sm">{transfer.paymentTitle}</div>
                          </td>
                          <td className="p-4">
                            <span className="font-display font-black text-base text-navy">₦{transfer.amount.toLocaleString()}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-mono text-xs px-2 py-1 rounded-lg bg-cloud border-[2px] border-navy/20 text-navy">{transfer.transactionReference}</span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${sCfg.bg} ${sCfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />
                              {sCfg.label}
                            </span>
                          </td>
                          <td className="p-4 text-navy/60 text-sm">{new Date(transfer.createdAt).toLocaleDateString()}</td>
                          <td className="p-4">
                            {transfer.status === "pending" ? (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => openReviewModal(transfer, "approved")}
                                  className="px-3 py-1.5 bg-teal-light border-[2px] border-teal rounded-xl text-[10px] font-bold uppercase tracking-wider text-teal hover:bg-teal hover:text-snow transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => openReviewModal(transfer, "rejected")}
                                  className="px-3 py-1.5 bg-coral-light border-[2px] border-coral rounded-xl text-[10px] font-bold uppercase tracking-wider text-coral hover:bg-coral hover:text-snow transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-navy/40">
                                {transfer.adminNote || "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={transferPage} totalPages={btTotalPages} onPage={setTransferPage} className="mt-4" />
        </div>
      )}

      {/* ── Create Payment Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-8 shadow-[10px_10px_0_0_#000] max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
                  className="flex-1 px-6 py-3 bg-transparent border-[3px] border-navy rounded-2xl font-display font-black text-navy hover:bg-navy hover:text-snow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-lime border-[3px] border-navy rounded-2xl font-display font-black text-navy press-3 press-navy transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Creating..." : "Create Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bank Account Modal ── */}
      {showBankAccountModal && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowBankAccountModal(false)}>
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-8 shadow-[10px_10px_0_0_#000] max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-black text-2xl text-navy">
                {editingBankAccount ? "Edit Bank Account" : "Add Bank Account"}
              </h3>
              <button
                onClick={() => setShowBankAccountModal(false)}
                className="w-8 h-8 rounded-xl bg-cloud hover:bg-navy/10 flex items-center justify-center transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate mb-2">Bank Name <span className="text-coral">*</span></label>
                <select
                  value={bankAccountForm.bankName}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, bankName: e.target.value })}
                  aria-label="Select bank"
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy focus:outline-none focus:ring-4 focus:ring-lime/30 transition-all"
                >
                  <option value="">Select a bank</option>
                  {NIGERIAN_BANKS.map((bank) => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate mb-2">Account Number <span className="text-coral">*</span></label>
                <input
                  type="text"
                  value={bankAccountForm.accountNumber}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, accountNumber: e.target.value })}
                  placeholder="0123456789"
                  maxLength={10}
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy placeholder:text-slate/50 focus:outline-none focus:ring-4 focus:ring-lime/30 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate mb-2">Account Name <span className="text-coral">*</span></label>
                <input
                  type="text"
                  value={bankAccountForm.accountName}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, accountName: e.target.value })}
                  placeholder="IESA University of Ibadan"
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy placeholder:text-slate/50 focus:outline-none focus:ring-4 focus:ring-lime/30 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate mb-2">Notes <span className="text-slate/50">(Optional)</span></label>
                <input
                  type="text"
                  value={bankAccountForm.notes}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, notes: e.target.value })}
                  placeholder="Main IESA account"
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy placeholder:text-slate/50 focus:outline-none focus:ring-4 focus:ring-lime/30 transition-all"
                />
              </div>
              {editingBankAccount && (
                <div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={bankAccountForm.isActive}
                      onChange={(e) => setBankAccountForm({ ...bankAccountForm, isActive: e.target.checked })}
                      className="w-5 h-5 rounded-lg border-[3px] border-navy checked:bg-lime checked:border-navy focus:ring-4 focus:ring-lime/30 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-navy group-hover:text-navy/70 transition-colors">
                      Active (visible to students)
                    </span>
                  </label>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBankAccountModal(false)}
                  disabled={bankAccountSubmitting}
                  className="flex-1 px-6 py-3 bg-transparent border-[3px] border-navy rounded-2xl font-display font-black text-navy hover:bg-navy hover:text-snow transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBankAccountSubmit}
                  disabled={bankAccountSubmitting}
                  className="flex-1 px-6 py-3 bg-lime border-[3px] border-navy rounded-2xl font-display font-black text-navy press-3 press-navy transition-all disabled:opacity-50"
                >
                  {bankAccountSubmitting ? "Saving..." : editingBankAccount ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer Review Modal ── */}
      {reviewingTransfer && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setReviewingTransfer(null)}>
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-8 shadow-[10px_10px_0_0_#000] max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-black text-2xl text-navy">
                {reviewAction === "approved" ? "Approve Transfer" : "Reject Transfer"}
              </h3>
              <button
                onClick={() => setReviewingTransfer(null)}
                className="w-8 h-8 rounded-xl bg-cloud hover:bg-navy/10 flex items-center justify-center transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Transfer Details */}
            <div className="bg-ghost border-[3px] border-navy/10 rounded-2xl p-5 mb-5 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-navy/50 uppercase font-bold tracking-wider">Student</span>
                <span className="text-sm font-bold text-navy">{reviewingTransfer.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-navy/50 uppercase font-bold tracking-wider">Payment</span>
                <span className="text-sm font-bold text-navy">{reviewingTransfer.paymentTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-navy/50 uppercase font-bold tracking-wider">Amount</span>
                <span className="text-sm font-display font-black text-navy">₦{reviewingTransfer.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-navy/50 uppercase font-bold tracking-wider">Reference</span>
                <span className="text-sm font-mono text-navy">{reviewingTransfer.transactionReference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-navy/50 uppercase font-bold tracking-wider">Sender</span>
                <span className="text-sm text-navy">{reviewingTransfer.senderName} ({reviewingTransfer.senderBank})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-navy/50 uppercase font-bold tracking-wider">To Account</span>
                <span className="text-sm text-navy">{reviewingTransfer.bankAccountBank} &middot; {reviewingTransfer.bankAccountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-navy/50 uppercase font-bold tracking-wider">Transfer Date</span>
                <span className="text-sm text-navy">{new Date(reviewingTransfer.transferDate).toLocaleDateString()}</span>
              </div>
              {reviewingTransfer.narration && (
                <div className="flex justify-between">
                  <span className="text-xs text-navy/50 uppercase font-bold tracking-wider">Narration</span>
                  <span className="text-sm text-navy italic">{reviewingTransfer.narration}</span>
                </div>
              )}
            </div>

            {/* Admin Note */}
            <div className="mb-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate mb-2">
                Admin Note <span className="text-slate/50">(Optional)</span>
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={reviewAction === "approved" ? "Payment confirmed..." : "Reason for rejection..."}
                rows={3}
                className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy placeholder:text-slate/50 focus:outline-none focus:ring-4 focus:ring-lime/30 transition-all resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setReviewingTransfer(null)}
                disabled={reviewSubmitting}
                className="flex-1 px-6 py-3 bg-transparent border-[3px] border-navy rounded-2xl font-display font-black text-navy hover:bg-navy hover:text-snow transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReviewSubmit}
                disabled={reviewSubmitting}
                className={`flex-1 px-6 py-3 border-[3px] border-navy rounded-2xl font-display font-black press-3 press-navy transition-all disabled:opacity-50 ${
                  reviewAction === "approved"
                    ? "bg-teal text-snow"
                    : "bg-coral text-snow"
                }`}
              >
                {reviewSubmitting ? "Processing..." : reviewAction === "approved" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(AdminPaymentsPage, {
  anyPermission: ["payment:view_all", "payment:create", "payment:approve", "bank_transfer:manage_accounts", "bank_transfer:review"],
});