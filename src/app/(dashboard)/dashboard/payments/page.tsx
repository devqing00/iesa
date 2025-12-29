"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState } from "react";

// Mock Data
const PENDING_DUES = [
  {
    id: 1,
    title: "2024/2025 Departmental Dues",
    amount: 3000,
    deadline: "2025-02-28",
    mandatory: true,
  },
  {
    id: 2,
    title: "Annual Dinner Ticket",
    amount: 5000,
    deadline: "2025-03-15",
    mandatory: false,
  },
  {
    id: 3,
    title: "Departmental T-Shirt",
    amount: 4500,
    deadline: "2025-01-30",
    mandatory: false,
  },
];

const TRANSACTION_HISTORY = [
  {
    id: "TRX-7782-901",
    date: "2024-11-15",
    description: "Freshers' Welcome Package",
    amount: 2500,
    status: "Successful",
  },
  {
    id: "TRX-3321-002",
    date: "2024-05-20",
    description: "2023/2024 Departmental Dues",
    amount: 2500,
    status: "Successful",
  },
];

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader title="Payments" />
      
      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-primary/80 uppercase tracking-wider mb-1">Total Outstanding</p>
              <h2 className="text-4xl font-bold font-heading text-primary">
                {formatCurrency(PENDING_DUES.reduce((acc, curr) => acc + curr.amount, 0))}
              </h2>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
              📉
            </div>
          </div>

          <div className="bg-background/60 backdrop-blur-xl border border-foreground/5 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground/60 uppercase tracking-wider mb-1">Total Paid (Session)</p>
              <h2 className="text-4xl font-bold font-heading text-foreground">
                {formatCurrency(TRANSACTION_HISTORY.reduce((acc, curr) => acc + curr.amount, 0))}
              </h2>
            </div>
            <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center text-2xl">
              💰
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-foreground/10">
          <button
            onClick={() => setActiveTab("pending")}
            className={`pb-4 text-sm font-bold transition-all relative ${
              activeTab === "pending" 
                ? "text-primary" 
                : "text-foreground/40 hover:text-foreground"
            }`}
          >
            Pending Dues
            {activeTab === "pending" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-4 text-sm font-bold transition-all relative ${
              activeTab === "history" 
                ? "text-primary" 
                : "text-foreground/40 hover:text-foreground"
            }`}
          >
            Payment History
            {activeTab === "history" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="min-h-[300px]">
          {activeTab === "pending" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {PENDING_DUES.map((item) => (
                <div key={item.id} className="bg-background/60 backdrop-blur-xl border border-foreground/5 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/20 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-lg text-foreground">{item.title}</h3>
                      {item.mandatory && (
                        <span className="bg-red-500/10 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/20">
                          MANDATORY
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground/60">Deadline: {new Date(item.deadline).toLocaleDateString()}</p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-4 self-end md:self-auto">
                    <span className="font-heading font-bold text-xl text-foreground">
                      {formatCurrency(item.amount)}
                    </span>
                    <button className="bg-primary text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-primary/90 transition-transform active:scale-95">
                      Pay Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-background/60 backdrop-blur-xl border border-foreground/5 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-foreground/5 text-foreground/60 font-bold uppercase text-xs">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Reference</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/5">
                  {TRANSACTION_HISTORY.map((trx) => (
                    <tr key={trx.id} className="hover:bg-foreground/5 transition-colors">
                      <td className="p-4 text-foreground/80">{trx.date}</td>
                      <td className="p-4 font-bold text-foreground">{trx.description}</td>
                      <td className="p-4 font-mono text-xs text-foreground/60">{trx.id}</td>
                      <td className="p-4 text-right font-bold text-foreground">{formatCurrency(trx.amount)}</td>
                      <td className="p-4 text-center">
                        <span className="bg-green-500/10 text-green-600 text-xs font-bold px-2 py-1 rounded-full border border-green-500/20">
                          {trx.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button className="text-primary hover:text-primary/80 transition-colors" title="Download Receipt">
                          <svg className="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
