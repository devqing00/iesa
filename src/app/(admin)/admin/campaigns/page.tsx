"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";
import { ToolHelpModal, useToolHelp, HelpButton } from "@/components/ui/ToolHelpModal";
import { getErrorMessage } from "@/lib/adminApiError";
import { ConfirmModal } from "@/components/ui/Modal";

/* ── Types ──────────────────────────────── */

interface Campaign {
  id: string;
  name: string;
  triggerType: "unpaid_due" | "inactive_student";
  conditionValue: string;
  actionType: "email" | "in_app";
  messageTemplate: string;
  intervalDays: number;
  isActive: boolean;
  createdAt: string;
  lastRunAt?: string;
}

interface Payment {
  id: string;
  title: string;
}

/* ── Component ──────────────────────────── */

function CampaignsPage() {
  const { user, userProfile, loading: authLoading, getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("admin-campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Campaign>>({
    name: "",
    triggerType: "unpaid_due",
    conditionValue: "",
    actionType: "in_app",
    messageTemplate: "Hi {{name}}, this is a friendly reminder to complete your pending task.",
    intervalDays: 3,
    isActive: true
  });
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: "" });

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const [campRes, payRes] = await Promise.all([
        fetch(getApiUrl("/api/v1/campaigns/"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(getApiUrl("/api/v1/payments/"), { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (!campRes.ok) throw new Error("Failed to load campaigns");
      
      const campData = await campRes.json();
      setCampaigns(campData);
      
      if (payRes.ok) {
        const payData = await payRes.json();
        setPayments(payData.items || payData);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to fetch campaigns"));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (user && userProfile) {
      fetchCampaigns();
    }
  }, [user, userProfile, fetchCampaigns]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch(getApiUrl("/api/v1/campaigns/"), {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) throw new Error(await res.text());
      
      toast.success("Campaign created successfully");
      setShowModal(false);
      setFormData({
        name: "", triggerType: "unpaid_due", conditionValue: "", 
        actionType: "in_app", messageTemplate: "", intervalDays: 3, isActive: true
      });
      fetchCampaigns();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create campaign"));
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch(getApiUrl(`/api/v1/campaigns/${id}/toggle`), {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Failed to toggle campaign");
      
      fetchCampaigns();
      toast.success("Campaign status updated");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update campaign"));
    }
  };
  
  const handleDelete = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch(getApiUrl(`/api/v1/campaigns/${deleteConfirm.id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Failed to delete campaign");
      
      setDeleteConfirm({ isOpen: false, id: "" });
      fetchCampaigns();
      toast.success("Campaign deleted");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete campaign"));
    }
  };

  if (authLoading || (loading && campaigns.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <ToolHelpModal toolId="admin-campaigns" isOpen={showHelp} onClose={closeHelp} />
      <div className="flex justify-end mb-3">
        <HelpButton onClick={openHelp} />
      </div>
      
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Engagement</p>
          <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
            <span className="brush-highlight">Automated</span> Campaigns
          </h1>
          <p className="text-sm text-navy/60 mt-1">Build rules to automatically nudge students.</p>
        </div>
        <PermissionGate permission="campaign:manage">
          <button
            onClick={() => setShowModal(true)}
            className="self-start px-5 py-2.5 bg-lime border-[3px] border-navy rounded-2xl text-navy text-sm font-bold press-3 press-navy flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Campaign
          </button>
        </PermissionGate>
      </div>

      {error && (
        <div role="alert" className="bg-coral-light border-[3px] border-coral rounded-2xl p-4">
          <p className="text-coral text-sm font-bold">{error}</p>
        </div>
      )}

      {/* ── Campaigns List ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.length === 0 ? (
          <div className="col-span-full py-20 px-6 text-center bg-snow border-[3px] border-navy border-dashed rounded-3xl flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-lime/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-coral/20 rounded-full blur-3xl pointer-events-none" />
            
            <div className="w-24 h-24 mb-6 bg-lavender-light border-[3px] border-navy rounded-2xl shadow-[4px_4px_0_0_#000] flex items-center justify-center transform -rotate-3 transition-transform hover:rotate-0">
              <svg aria-hidden="true" className="w-12 h-12 text-lavender" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                <path d="M19 14l-7 7-7-7" />
              </svg>
            </div>
            
            <h3 className="font-display font-black text-2xl text-navy mb-2">
              No Campaigns Yet
            </h3>
            <p className="text-sm text-slate max-w-md mx-auto mb-8 leading-relaxed">
              Automate your workflow by creating rules to nudge students about unpaid dues or inactivity. Your campaigns will run in the background.
            </p>
            
            <PermissionGate permission="campaign:manage">
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 bg-coral border-[3px] border-navy rounded-2xl text-snow text-sm font-bold shadow-[4px_4px_0_0_#000] press-3 press-black flex items-center gap-2 hover:bg-coral-light hover:text-navy transition-colors"
              >
                <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Create First Campaign
              </button>
            </PermissionGate>
          </div>
        ) : (
          campaigns.map((camp) => (
            <div key={camp.id} className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-display font-bold text-lg text-navy line-clamp-1">{camp.name}</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleToggle(camp.id)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${camp.isActive ? 'bg-teal' : 'bg-cloud'}`}
                  >
                    <div className={`w-3 h-3 bg-snow rounded-full absolute top-1 transition-all ${camp.isActive ? 'right-1' : 'left-1'}`} />
                  </button>
                  <button onClick={() => setDeleteConfirm({ isOpen: true, id: camp.id })} className="text-coral hover:text-coral/80">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="space-y-3 flex-1">
                <div className="text-xs text-navy/70">
                  <span className="font-bold text-navy">IF </span>
                  {camp.triggerType === "unpaid_due" ? "Unpaid Due" : "Inactive Student"}
                  <span className="font-bold text-navy"> IS </span>
                  {camp.triggerType === "unpaid_due" ? payments.find(p => p.id === camp.conditionValue)?.title || camp.conditionValue : `${camp.conditionValue} days`}
                </div>
                <div className="text-xs text-navy/70">
                  <span className="font-bold text-navy">THEN SEND </span>
                  <span className="px-2 py-0.5 bg-lavender-light text-lavender font-bold rounded">{camp.actionType}</span>
                </div>
                <div className="text-xs text-navy/70">
                  <span className="font-bold text-navy">EVERY </span>
                  {camp.intervalDays} days
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t-2 border-navy/10 text-xs text-slate flex justify-between">
                <span>Runs Daily</span>
                <span>Last run: {camp.lastRunAt ? new Date(camp.lastRunAt).toLocaleDateString() : "Never"}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Create Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-4 sm:p-6">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-snow border-[3px] border-navy rounded-3xl p-8 w-full max-w-lg max-h-[calc(100vh-2rem)] sm:max-h-[85vh] overflow-y-auto shadow-[4px_4px_0_0_#000]">
            <h2 className="font-display font-black text-xl text-navy mb-6">Create Campaign Rule</h2>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-navy">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full mt-1 px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm"
                  placeholder="e.g. Freshers Dues Reminder"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-navy">IF (Trigger)</label>
                  <select
                    value={formData.triggerType}
                    onChange={e => setFormData({...formData, triggerType: e.target.value as any, conditionValue: ""})}
                    className="w-full mt-1 px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm"
                  >
                    <option value="unpaid_due">Unpaid Due</option>
                    <option value="inactive_student">Inactive Student</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-navy">IS (Condition)</label>
                  {formData.triggerType === "unpaid_due" ? (
                    <select
                      required
                      value={formData.conditionValue}
                      onChange={e => setFormData({...formData, conditionValue: e.target.value})}
                      className="w-full mt-1 px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm"
                    >
                      <option value="">Select Payment...</option>
                      {payments.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Days inactive..."
                      value={formData.conditionValue}
                      onChange={e => setFormData({...formData, conditionValue: e.target.value})}
                      className="w-full mt-1 px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-navy">THEN SEND (Action)</label>
                <select
                  value={formData.actionType}
                  onChange={e => setFormData({...formData, actionType: e.target.value as any})}
                  className="w-full mt-1 px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm"
                >
                  <option value="in_app">In-App Notification</option>
                  <option value="email">Email</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-navy">MESSAGE</label>
                <textarea
                  required
                  rows={3}
                  value={formData.messageTemplate}
                  onChange={e => setFormData({...formData, messageTemplate: e.target.value})}
                  className="w-full mt-1 px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm resize-none"
                  placeholder="Use {{name}} for student's name."
                />
              </div>

              <div>
                <label className="text-sm font-bold text-navy">EVERY (Interval in Days)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.intervalDays}
                  onChange={e => setFormData({...formData, intervalDays: parseInt(e.target.value)})}
                  className="w-full mt-1 px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy font-bold">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-5 py-2.5 rounded-2xl bg-navy text-snow font-bold">
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: "" })}
        onConfirm={handleDelete}
        title="Delete Campaign"
        message="Are you sure you want to delete this campaign? The automated reminders will stop."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

export default withAuth(CampaignsPage, {
  requiredPermission: "campaign:manage",
});
