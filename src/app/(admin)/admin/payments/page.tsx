"use client";

import { useState, useEffect } from "react";

interface Payment {
  _id: string;
  id?: string;
  studentId: string;
  sessionId: string;
  category: string;
  amount: number;
  status: string;
  dueDate: string;
  paidDate?: string;
  student?: {
    firstName: string;
    lastName: string;
    matricNumber: string;
  };
  session?: {
    name: string;
  };
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

export default function AdminPaymentsPage() {
  const [activeTab, setActiveTab] = useState<"payments" | "transactions">(
    "payments"
  );
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (activeTab === "payments") {
      fetchPayments();
    } else {
      fetchTransactions();
    }
  }, [activeTab]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/payments");
      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map((item: Payment & { _id?: string }) => ({
          ...item,
          id: item.id || item._id,
        }));
        setPayments(mappedData);
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/paystack/transactions");
      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map((item: Transaction & { _id?: string }) => ({
          ...item,
          id: item.id || item._id,
        }));
        setTransactions(mappedData);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesCategory =
      categoryFilter === "all" || payment.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" || payment.status === statusFilter;
    return matchesCategory && matchesStatus;
  });

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesStatus =
      statusFilter === "all" || transaction.status === statusFilter;
    return matchesStatus;
  });

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-[var(--foreground)] mb-2">
          Payment Management
        </h1>
        <p className="text-[var(--foreground)]/60">
          Manage payment dues and transactions
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-[var(--glass-border)]">
        <button
          onClick={() => setActiveTab("payments")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "payments"
              ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
              : "text-[var(--foreground)]/60 hover:text-[var(--foreground)]"
          }`}
        >
          Payment Dues
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "transactions"
              ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
              : "text-[var(--foreground)]/60 hover:text-[var(--foreground)]"
          }`}
        >
          Transactions
        </button>
      </div>

      {/* Payment Dues Tab */}
      {activeTab === "payments" && (
        <div>
          <div className="mb-6 flex gap-4">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 rounded-lg bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="all">All Categories</option>
              <option value="dues">Dues</option>
              <option value="event">Events</option>
              <option value="other">Other</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-lg bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--glass-border)]">
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                      Student
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                      Session
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                      Category
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                      Amount
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                      Status
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                      Due Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-8 text-center text-[var(--foreground)]/60"
                      >
                        Loading payments...
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-8 text-center text-[var(--foreground)]/60"
                      >
                        No payments found
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)]/50 transition-colors"
                      >
                        <td className="p-4">
                          <div className="font-medium text-[var(--foreground)]">
                            {payment.student
                              ? `${payment.student.firstName} ${payment.student.lastName}`
                              : "N/A"}
                          </div>
                          {payment.student?.matricNumber && (
                            <div className="text-sm text-[var(--foreground)]/60">
                              {payment.student.matricNumber}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-[var(--foreground)]/80">
                          {payment.session?.name || "N/A"}
                        </td>
                        <td className="p-4">
                          <span className="inline-block px-2 py-1 rounded bg-blue-500/10 text-blue-500 text-xs font-medium">
                            {payment.category}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-[var(--foreground)]">
                          ₦{payment.amount.toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              payment.status === "paid"
                                ? "bg-green-500/10 text-green-500"
                                : payment.status === "overdue"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-yellow-500/10 text-yellow-500"
                            }`}
                          >
                            {payment.status}
                          </span>
                        </td>
                        <td className="p-4 text-[var(--foreground)]/80">
                          {new Date(payment.dueDate).toLocaleDateString()}
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

      {/* Transactions Tab */}
      {activeTab === "transactions" && (
        <div>
          <div className="mb-6 flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-lg bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--glass-border)]">
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                      Reference
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                      User
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                      Category
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                      Amount
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                      Status
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-8 text-center text-[var(--foreground)]/60"
                      >
                        Loading transactions...
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-8 text-center text-[var(--foreground)]/60"
                      >
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)]/50 transition-colors"
                      >
                        <td className="p-4 font-mono text-sm text-[var(--foreground)]">
                          {transaction.reference}
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-[var(--foreground)]">
                            {transaction.user
                              ? `${transaction.user.firstName} ${transaction.user.lastName}`
                              : "N/A"}
                          </div>
                          {transaction.user?.email && (
                            <div className="text-sm text-[var(--foreground)]/60">
                              {transaction.user.email}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="inline-block px-2 py-1 rounded bg-purple-500/10 text-purple-500 text-xs font-medium">
                            {transaction.paymentCategory || "N/A"}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-[var(--foreground)]">
                          ₦{(transaction.amount / 100).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              transaction.status === "success"
                                ? "bg-green-500/10 text-green-500"
                                : transaction.status === "failed"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-yellow-500/10 text-yellow-500"
                            }`}
                          >
                            {transaction.status}
                          </span>
                        </td>
                        <td className="p-4 text-[var(--foreground)]/80">
                          {new Date(transaction.createdAt).toLocaleDateString()}
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
    </div>
  );
}
