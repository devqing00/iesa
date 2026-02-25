"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "sonner";

/* ─── Types ──────────────────────────────────────────────── */

type EmailPref = "primary" | "secondary" | "both";
type ChannelPref = "email" | "in_app" | "both";

/* ─── Page ───────────────────────────────────────────────── */

export default function SettingsPage() {
  const { userProfile, refreshUser, signOut } = useAuth();
  const router = useRouter();

  /* ── Password Change ──────────────────────── */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  /* ── Notification Preferences ─────────────── */
  const [emailPref, setEmailPref] = useState<EmailPref>("primary");
  const [channelPref, setChannelPref] = useState<ChannelPref>("both");
  const [prefLoading, setPrefLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);

  /* ── Account Deletion ─────────────────────── */
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteZone, setShowDeleteZone] = useState(false);

  // Sync prefs from user profile
  useEffect(() => {
    if (userProfile) {
      setEmailPref(userProfile.notificationEmailPreference || "primary");
      setChannelPref(userProfile.notificationChannelPreference || "both");
    }
  }, [userProfile]);

  /* ─── Handlers ─────────────────────────────────────────── */

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setPwLoading(true);
    try {
      await api.post("/api/v1/auth/change-password", {
        currentPassword,
        newPassword,
      });
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change password";
      toast.error(msg);
    } finally {
      setPwLoading(false);
    }
  };

  const handleEmailPrefChange = async (pref: EmailPref) => {
    setPrefLoading(true);
    try {
      await api.patch("/api/v1/students/notification-preference", {
        preference: pref,
      });
      setEmailPref(pref);
      toast.success(`Email preference updated to "${pref}"`);
      refreshUser?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update preference";
      toast.error(msg);
    } finally {
      setPrefLoading(false);
    }
  };

  const handleChannelChange = async (pref: ChannelPref) => {
    setChannelLoading(true);
    try {
      await api.patch("/api/v1/users/me/notification-channel", {
        preference: pref,
      });
      setChannelPref(pref);
      toast.success(`Notification channel updated to "${pref.replace("_", "-")}"`);
      refreshUser?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update channel";
      toast.error(msg);
    } finally {
      setChannelLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmText !== "DELETE MY ACCOUNT") {
      toast.error('Please type "DELETE MY ACCOUNT" to confirm');
      return;
    }
    setDeleteLoading(true);
    try {
      await api.delete("/api/v1/users/me", { body: { password: deletePassword } });
      toast.success("Account deleted. Redirecting...");
      await signOut();
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete account";
      toast.error(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const hasSecondary = !!userProfile?.secondaryEmail;
  const secondaryVerified = !!userProfile?.secondaryEmailVerified;

  /* ─── Render ───────────────────────────────────────────── */

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="font-display font-black text-display-lg text-navy">
          <span className="brush-highlight">Settings</span>
        </h1>
        <p className="mt-2 text-slate text-body">
          Manage your password, notification preferences, and account.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════
          SECTION 1: CHANGE PASSWORD
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-snow border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0_0_#000] mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-lavender-light rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-lavender" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h2 className="font-display font-black text-xl text-navy">Change Password</h2>
            <p className="text-sm text-slate">Update your account password</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="block text-sm font-bold text-navy mb-1">
              Current Password
            </label>
            <input
              id="current-password"
              type={showPasswords ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border-[3px] border-navy rounded-xl bg-ghost text-navy font-medium focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime transition-all"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-bold text-navy mb-1">
              New Password
            </label>
            <input
              id="new-password"
              type={showPasswords ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 border-[3px] border-navy rounded-xl bg-ghost text-navy font-medium focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime transition-all"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-bold text-navy mb-1">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 border-[3px] border-navy rounded-xl bg-ghost text-navy font-medium focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime transition-all"
              placeholder="Re-enter new password"
            />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm text-slate cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                className="rounded border-navy"
              />
              Show passwords
            </label>
          </div>

          <button
            type="submit"
            disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
            className="bg-lime border-[4px] border-navy press-5 press-navy px-8 py-3 rounded-2xl font-display font-black text-navy disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {pwLoading ? "Changing..." : "Change Password"}
          </button>
        </form>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2: NOTIFICATION PREFERENCES
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-snow border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0_0_#000] mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-teal-light rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-teal" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h2 className="font-display font-black text-xl text-navy">Notification Preferences</h2>
            <p className="text-sm text-slate">Control how and where you receive notifications</p>
          </div>
        </div>

        {/* Notification Channel */}
        <div className="mb-8">
          <h3 className="font-display font-bold text-navy text-base mb-1">Delivery Channel</h3>
          <p className="text-sm text-slate mb-4">Choose how you want to be notified about announcements, payments, and events.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { value: "both" as ChannelPref, label: "Both", desc: "Email + In-App" },
              { value: "email" as ChannelPref, label: "Email Only", desc: "Emails only, no in-app" },
              { value: "in_app" as ChannelPref, label: "In-App Only", desc: "Dashboard notifications" },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleChannelChange(opt.value)}
                disabled={channelLoading}
                className={`p-4 rounded-2xl border-[3px] text-left transition-all ${
                  channelPref === opt.value
                    ? "border-navy bg-lime shadow-[4px_4px_0_0_#000] font-bold"
                    : "border-navy/20 bg-ghost hover:bg-cloud"
                }`}
              >
                <span className="block font-display font-bold text-navy text-sm">{opt.label}</span>
                <span className="block text-xs text-slate mt-0.5">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Email Preference — only shown if secondary email exists */}
        <div>
          <h3 className="font-display font-bold text-navy text-base mb-1">Email Recipient</h3>
          <p className="text-sm text-slate mb-4">
            {hasSecondary
              ? "Choose which email address(es) receive notification emails."
              : "Add a secondary email in your profile to choose between email addresses."}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              {
                value: "primary" as EmailPref,
                label: "Primary Only",
                desc: userProfile?.email ?? "—",
              },
              {
                value: "secondary" as EmailPref,
                label: "Secondary Only",
                desc: hasSecondary
                  ? `${userProfile?.secondaryEmail}${secondaryVerified ? "" : " (unverified)"}`
                  : "No secondary email",
                disabled: !hasSecondary || !secondaryVerified,
              },
              {
                value: "both" as EmailPref,
                label: "Both Emails",
                desc: "Send to primary & secondary",
                disabled: !hasSecondary || !secondaryVerified,
              },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleEmailPrefChange(opt.value)}
                disabled={prefLoading || opt.disabled}
                className={`p-4 rounded-2xl border-[3px] text-left transition-all ${
                  emailPref === opt.value
                    ? "border-navy bg-lavender-light shadow-[4px_4px_0_0_#000] font-bold"
                    : opt.disabled
                    ? "border-navy/10 bg-ghost/50 opacity-50 cursor-not-allowed"
                    : "border-navy/20 bg-ghost hover:bg-cloud"
                }`}
              >
                <span className="block font-display font-bold text-navy text-sm">{opt.label}</span>
                <span className="block text-xs text-slate mt-0.5 truncate">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3: DANGER ZONE
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-snow border-[4px] border-coral rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0_0_#000]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-coral-light rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-coral" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h2 className="font-display font-black text-xl text-coral">Danger Zone</h2>
            <p className="text-sm text-slate">Irreversible actions — proceed with caution</p>
          </div>
        </div>

        {!showDeleteZone ? (
          <button
            type="button"
            onClick={() => setShowDeleteZone(true)}
            className="bg-coral/10 border-[3px] border-coral px-6 py-3 rounded-xl font-display font-bold text-coral hover:bg-coral hover:text-snow transition-all"
          >
            Delete My Account
          </button>
        ) : (
          <form onSubmit={handleDeleteAccount} className="space-y-4 mt-4">
            <div className="bg-coral-light border-[2px] border-coral/30 rounded-xl p-4">
              <p className="text-sm text-navy font-bold mb-2">
                This will permanently delete your account and all associated data:
              </p>
              <ul className="text-sm text-slate list-disc pl-5 space-y-1">
                <li>Your profile and personal information</li>
                <li>All enrollments and academic records</li>
                <li>Payment histories and bank transfers</li>
                <li>All notifications</li>
              </ul>
              <p className="text-sm text-coral font-bold mt-3">This action cannot be undone.</p>
            </div>

            <div>
              <label htmlFor="delete-password" className="block text-sm font-bold text-navy mb-1">
                Enter your password to confirm
              </label>
              <input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                required
                className="w-full px-4 py-3 border-[3px] border-coral rounded-xl bg-ghost text-navy font-medium focus:outline-none focus:ring-2 focus:ring-coral transition-all"
                placeholder="Your current password"
              />
            </div>

            <div>
              <label htmlFor="delete-confirm" className="block text-sm font-bold text-navy mb-1">
                Type <span className="text-coral font-black">DELETE MY ACCOUNT</span> to confirm
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                required
                className="w-full px-4 py-3 border-[3px] border-coral rounded-xl bg-ghost text-navy font-medium focus:outline-none focus:ring-2 focus:ring-coral transition-all"
                placeholder="DELETE MY ACCOUNT"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={deleteLoading || deleteConfirmText !== "DELETE MY ACCOUNT" || !deletePassword}
                className="bg-coral border-[4px] border-navy press-5 press-navy px-8 py-3 rounded-2xl font-display font-black text-snow disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {deleteLoading ? "Deleting..." : "Permanently Delete Account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteZone(false);
                  setDeletePassword("");
                  setDeleteConfirmText("");
                }}
                className="bg-ghost border-[3px] border-navy px-6 py-3 rounded-xl font-display font-bold text-navy hover:bg-cloud transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
