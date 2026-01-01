"use client";

import { useState } from "react";

export default function AdminPaymentsPage() {
  const [activeTab, setActiveTab] = useState<"payments" | "transactions">("payments");

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
          <div className="mb-6 flex justify-between items-center">
            <div className="flex gap-4">
              <select className="px-4 py-2 rounded-lg bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]">
                <option>All Categories</option>
                <option>DUES</option>
                <option>EVENTS</option>
                <option>OTHERS</option>
              </select>
            </div>
            <button className="px-6 py-2 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity">
              Create Payment
            </button>
          </div>

          <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-8">
            <p className="text-center text-[var(--foreground)]/60">
              Payment dues management coming soon...
            </p>
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === "transactions" && (
        <div>
          <div className="mb-6">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--foreground)]/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search transactions..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] text-[var(--foreground)] placeholder:text-[var(--foreground)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
          </div>

          <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--glass-border)]">
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">Student</th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">Payment</th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">Amount</th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">Status</th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">Date</th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[var(--foreground)]/60">
                      Transaction history coming soon...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
