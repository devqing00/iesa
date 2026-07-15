"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";
import { ToolHelpModal, useToolHelp, HelpButton } from "@/components/ui/ToolHelpModal";
import { getErrorMessage } from "@/lib/adminApiError";

/* ── Types ──────────────────────────────── */

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  createdAt: string;
  createdBy: string;
}

interface Forecast {
  expectedRevenue: number;
  collectedRevenue: number;
  totalExpenses: number;
  netBalance: number;
}

/* ── Component ──────────────────────────── */

function TreasuryPage() {
  const { user, userProfile, loading: authLoading, getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("admin-treasury");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    category: "General",
    date: new Date().toISOString().split("T")[0]
  });

  const fetchTreasuryData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) return;

      const [expRes, forRes] = await Promise.all([
        fetch(getApiUrl("/api/v1/treasury/expenses"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(getApiUrl("/api/v1/treasury/forecast"), { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (!expRes.ok) throw new Error("Failed to load expenses");
      if (!forRes.ok) throw new Error("Failed to load forecast");
      
      const expData = await expRes.json();
      const forData = await forRes.json();
      
      if (forData.error) throw new Error(forData.error);
      
      setExpenses(expData);
      setForecast(forData);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to fetch treasury data"));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (user && userProfile) {
      fetchTreasuryData();
    }
  }, [user, userProfile, fetchTreasuryData]);

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = await getAccessToken();
      if (!token) return;

      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date).toISOString()
      };

      const res = await fetch(getApiUrl("/api/v1/treasury/expenses"), {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error(await res.text());
      
      toast.success("Expense logged successfully");
      setShowModal(false);
      setFormData({
        title: "", amount: "", category: "General", 
        date: new Date().toISOString().split("T")[0]
      });
      fetchTreasuryData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to log expense"));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  if (authLoading || (loading && !forecast)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <ToolHelpModal toolId="admin-treasury" isOpen={showHelp} onClose={closeHelp} />
      <div className="flex justify-end mb-3">
        <HelpButton onClick={openHelp} />
      </div>
      
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Financials</p>
          <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
            <span className="brush-highlight">Treasury</span> Management
          </h1>
          <p className="text-sm text-navy/60 mt-1">Track collections, log expenses, and view net balance.</p>
        </div>
        <PermissionGate permission="payment:manage">
          <button
            onClick={() => setShowModal(true)}
            className="self-start px-5 py-2.5 bg-lime border-[3px] border-navy rounded-2xl text-navy text-sm font-bold press-3 press-navy flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log Expense
          </button>
        </PermissionGate>
      </div>

      {error && (
        <div role="alert" className="bg-coral-light border-[3px] border-coral rounded-2xl p-4">
          <p className="text-coral text-sm font-bold">{error}</p>
        </div>
      )}

      {/* ── Financial Overview Cards ── */}
      {forecast && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Expected Revenue</p>
            <p className="font-display font-black text-2xl text-navy">{formatCurrency(forecast.expectedRevenue)}</p>
            <p className="text-xs text-navy/40 mt-1">Total possible dues</p>
          </div>
          
          <div className="bg-teal border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80 mb-1">Actual Collected</p>
            <p className="font-display font-black text-2xl text-snow">{formatCurrency(forecast.collectedRevenue)}</p>
            <div className="w-full bg-snow/20 rounded-full h-1.5 mt-3">
              <div className="bg-snow h-1.5 rounded-full" style={{ width: `${Math.min(100, (forecast.collectedRevenue / Math.max(1, forecast.expectedRevenue)) * 100)}%` }}></div>
            </div>
          </div>
          
          <div className="bg-coral border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80 mb-1">Total Expenses</p>
            <p className="font-display font-black text-2xl text-snow">{formatCurrency(forecast.totalExpenses)}</p>
            <p className="text-xs text-snow/60 mt-1">Logged outflows</p>
          </div>
          
          <div className="bg-sunny border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 mb-1">Net Balance</p>
            <p className="font-display font-black text-2xl text-navy">{formatCurrency(forecast.netBalance)}</p>
            <p className="text-xs text-navy/60 mt-1">Cash in hand</p>
          </div>
        </div>
      )}

      {/* ── Expenses List ── */}
      <div className="relative bg-snow border-[3px] border-navy rounded-3xl overflow-hidden shadow-[4px_4px_0_0_#000]">
        <div className="p-5 border-b-[3px] border-navy/10 flex justify-between items-center bg-ghost">
          <h3 className="font-display font-bold text-lg text-navy">Recent Expenses</h3>
          <span className="px-3 py-1 bg-cloud text-navy text-xs font-bold rounded-full">{expenses.length} Records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-[4px] border-lime bg-navy">
                <th scope="col" className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Title</th>
                <th scope="col" className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Category</th>
                <th scope="col" className="text-right px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Amount</th>
                <th scope="col" className="text-right px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Date</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <p className="text-sm text-navy/60 font-medium">No expenses logged yet.</p>
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="border-b-[3px] border-navy/10 last:border-b-0 hover:bg-ghost transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-navy">{expense.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-cloud text-navy">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-coral">
                      -{formatCurrency(expense.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-navy/60">
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Log Expense Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-4 sm:p-6">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-snow border-[3px] border-navy rounded-3xl p-8 w-full max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[85vh] overflow-y-auto shadow-[4px_4px_0_0_#000]">
            <h2 className="font-display font-black text-xl text-navy mb-6">Log Expense</h2>
            
            <form onSubmit={handleLogExpense} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-navy">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full mt-1 px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm"
                  placeholder="e.g. Venue Rental"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-navy">Amount (NGN)</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  className="w-full mt-1 px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-navy">Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full mt-1 px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm"
                >
                  <option value="Events">Events</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Prizes">Prizes</option>
                  <option value="General">General</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-bold text-navy">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className="w-full mt-1 px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy font-bold hover:bg-cloud transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-5 py-2.5 rounded-2xl bg-navy border-[3px] border-lime text-snow font-bold press-3 press-lime">
                  Log Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(TreasuryPage, {
  requiredPermission: "payment:view_all",
});
