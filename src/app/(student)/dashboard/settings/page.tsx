"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/Input";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

/* ─── Types ──────────────────────────────────────────────── */

type EmailPref = "primary" | "secondary" | "both";
type ChannelPref = "email" | "in_app" | "both";

type NotifCategory = "announcements" | "payments" | "events" | "timetable" | "academic" | "mentoring";

const CATEGORY_META: { key: NotifCategory; label: string; desc: string; icon: ReactNode }[] = [
  {
    key: "announcements",
    label: "Announcements",
    desc: "Department-wide announcements",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16.881 4.345A23.112 23.112 0 0 1 8.25 6H7.5a5.25 5.25 0 0 0-.88 10.427 21.593 21.593 0 0 0 1.378 3.948c.215.46.772.626 1.204.403a.75.75 0 0 0 .402-1.203 19.96 19.96 0 0 1-1.062-2.882c.426.07.858.12 1.296.148a.75.75 0 0 0 .746-.435 23.1 23.1 0 0 0 6.247-1.061c.078.443.362.82.756 1.025a1.125 1.125 0 0 0 1.535-.422c.058-.1.103-.207.134-.318a9.04 9.04 0 0 0 .287-2.292c.023-.99-.08-1.98-.287-2.942a1.125 1.125 0 0 0-1.669-.74c-.394.204-.678.582-.756 1.024Z" />
        <path d="M16.5 18.75a.75.75 0 0 0 .75-.75V6a.75.75 0 0 0-.75-.75 22.5 22.5 0 0 1-7.235 1.307V12.7A22.5 22.5 0 0 1 16.5 14v4.75Z" />
      </svg>
    ),
  },
  {
    key: "payments",
    label: "Payments",
    desc: "Transfer approvals & receipts",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" />
        <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: "events",
    label: "Events",
    desc: "New events & reminders",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
        <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: "timetable",
    label: "Timetable",
    desc: "Class cancellations & changes",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: "academic",
    label: "Academic",
    desc: "Enrollments & records",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.949 49.949 0 0 0-9.902 3.912l-.003.002-.34.18a.75.75 0 0 1-.707 0A50.009 50.009 0 0 0 7.5 12.174v-.224c0-.131.067-.248.172-.311a54.614 54.614 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.129 56.129 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
        <path d="M13.06 15.473a48.45 48.45 0 0 1 7.666-3.282c.134 1.414.22 2.843.255 4.285a.75.75 0 0 1-.46.71 47.878 47.878 0 0 0-8.105 4.342.75.75 0 0 1-.832 0 47.877 47.877 0 0 0-8.104-4.342.75.75 0 0 1-.461-.71c.035-1.442.121-2.87.255-4.286A48.4 48.4 0 0 1 6 13.18v1.27a1.5 1.5 0 0 0-.14 2.508c-.09.38-.222.753-.397 1.11.452.213.901.434 1.346.661a6.729 6.729 0 0 0 .551-1.608 1.5 1.5 0 0 0 .14-2.67v-.645a48.549 48.549 0 0 1 3.44 1.668 2.25 2.25 0 0 0 2.12 0Z" />
        <path d="M4.462 19.462c.42-.419.753-.89 1-1.394.453.213.902.434 1.347.661a6.743 6.743 0 0 1-1.286 1.794.75.75 0 1 1-1.06-1.06Z" />
      </svg>
    ),
  },
  {
    key: "mentoring",
    label: "Mentoring",
    desc: "TIMP mentorship updates",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" />
        <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
      </svg>
    ),
  },
];

/* ─── Page ───────────────────────────────────────────────── */

export default function SettingsPage() {
  const { userProfile, refreshProfile, signOut } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("settings");
  const { allSessions } = useSession();
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

  /* ── Notification Categories ──────────────── */
  const defaultCats: Record<NotifCategory, boolean> = {
    announcements: true, payments: true, events: true,
    timetable: true, academic: true, mentoring: true,
  };
  const [categories, setCategories] = useState<Record<NotifCategory, boolean>>(defaultCats);
  const [catLoading, setCatLoading] = useState<NotifCategory | null>(null);

  /* ── Account Deletion ─────────────────────── */
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteZone, setShowDeleteZone] = useState(false);

  /* ── Two-Factor Auth ──────────────────────── */
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaSetup, setTwoFaSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaBackupCodes, setTwoFaBackupCodes] = useState<string[]>([]);
  const [twoFaStep, setTwoFaStep] = useState<"idle" | "setup" | "backup" | "disable">("idle");

  // Sync prefs from user profile
  useEffect(() => {
    if (userProfile) {
      setEmailPref(userProfile.notificationEmailPreference || "primary");
      setChannelPref(userProfile.notificationChannelPreference || "both");
      if (userProfile.notificationCategories) {
        setCategories({ ...defaultCats, ...userProfile.notificationCategories } as Record<NotifCategory, boolean>);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  // Fetch 2FA status on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/v1/2fa/status");
        setTwoFaEnabled(res.enabled ?? false);
      } catch { /* silent */ }
    })();
  }, []);

  /* ─── Handlers ─────────────────────────────────────────── */

  /* ── 2FA Handlers ── */
  const handle2FASetup = async () => {
    setTwoFaLoading(true);
    try {
      const res = await api.post("/api/v1/2fa/setup");
      setTwoFaSetup({ secret: res.secret, qrCodeDataUrl: res.qrCodeDataUrl });
      setTwoFaStep("setup");
      setTwoFaCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set up 2FA");
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handle2FAVerify = async () => {
    if (twoFaCode.length !== 6) return;
    setTwoFaLoading(true);
    try {
      const res = await api.post("/api/v1/2fa/verify", { code: twoFaCode });
      setTwoFaEnabled(true);
      setTwoFaBackupCodes(res.backupCodes || []);
      setTwoFaStep("backup");
      setTwoFaCode("");
      toast.success("2FA enabled successfully!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handle2FADisable = async () => {
    if (twoFaCode.length !== 6) return;
    setTwoFaLoading(true);
    try {
      await api.post("/api/v1/2fa/disable", { code: twoFaCode });
      setTwoFaEnabled(false);
      setTwoFaStep("idle");
      setTwoFaCode("");
      setTwoFaSetup(null);
      toast.success("2FA disabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setTwoFaLoading(false);
    }
  };

  // Auto-submit 2FA code when 6 digits entered
  const verifyRef = useRef(handle2FAVerify);
  const disableRef = useRef(handle2FADisable);
  verifyRef.current = handle2FAVerify;
  disableRef.current = handle2FADisable;

  useEffect(() => {
    if (twoFaCode.length !== 6 || twoFaLoading) return;
    if (twoFaStep === "setup") verifyRef.current();
    if (twoFaStep === "disable") disableRef.current();
  }, [twoFaCode, twoFaStep, twoFaLoading]);

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
      refreshProfile?.();
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
      refreshProfile?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update channel";
      toast.error(msg);
    } finally {
      setChannelLoading(false);
    }
  };

  const handleCategoryToggle = async (cat: NotifCategory) => {
    const newVal = !categories[cat];
    setCatLoading(cat);
    // Optimistically update UI
    setCategories((prev) => ({ ...prev, [cat]: newVal }));
    try {
      await api.patch("/api/v1/users/me/notification-categories", {
        category: cat,
        enabled: newVal,
      });
      refreshProfile?.();
    } catch (err: unknown) {
      // Revert on failure
      setCategories((prev) => ({ ...prev, [cat]: !newVal }));
      const msg = err instanceof Error ? err.message : "Failed to update preference";
      toast.error(msg);
    } finally {
      setCatLoading(null);
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
      <ToolHelpModal toolId="settings" isOpen={showHelp} onClose={closeHelp} />
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 mb-10">
        <div>
          <h1 className="font-display font-black text-display-lg text-navy">
            <span className="brush-highlight">Settings</span>
          </h1>
          <p className="mt-2 text-slate text-body">
            Manage your password, notification preferences, and account.
          </p>
        </div>
        <HelpButton onClick={openHelp} />
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
          SECTION 1.5: TWO-FACTOR AUTHENTICATION
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-snow border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0_0_#000] mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-lavender-light rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-lavender" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h2 className="font-display font-black text-xl text-navy">Two-Factor Authentication</h2>
            <p className="text-sm text-slate">Add an extra layer of security with a TOTP authenticator app</p>
          </div>
          {twoFaEnabled && (
            <span className="ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full bg-teal-light text-teal text-xs font-bold border-[2px] border-teal">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
              </svg>
              Enabled
            </span>
          )}
        </div>

        {/* Idle state — not enabled */}
        {twoFaStep === "idle" && !twoFaEnabled && (
          <div className="bg-ghost rounded-2xl p-6 text-center">
            <p className="text-sm text-navy mb-4">
              Use an authenticator app (Google Authenticator, Authy, etc.) to generate time-based one-time passwords for extra security.
            </p>
            <button
              onClick={handle2FASetup}
              disabled={twoFaLoading}
              className="bg-lavender border-[3px] border-navy press-4 press-navy px-6 py-3 rounded-2xl font-display font-black text-snow disabled:opacity-50 transition-all"
            >
              {twoFaLoading ? "Setting up..." : "Enable 2FA"}
            </button>
          </div>
        )}

        {/* Idle state — enabled */}
        {twoFaStep === "idle" && twoFaEnabled && (
          <div className="bg-teal-light rounded-2xl p-6">
            <p className="text-sm text-navy mb-4">
              Two-factor authentication is active. You&apos;ll need your authenticator app to verify logins.
            </p>
            <button
              onClick={() => { setTwoFaStep("disable"); setTwoFaCode(""); }}
              className="bg-coral border-[3px] border-navy press-3 press-navy px-5 py-2.5 rounded-xl font-display font-black text-snow text-sm transition-all"
            >
              Disable 2FA
            </button>
          </div>
        )}

        {/* Setup step — scan QR */}
        {twoFaStep === "setup" && twoFaSetup && (
          <div className="space-y-5">
            <div className="bg-ghost rounded-2xl p-6 text-center">
              <p className="text-sm text-navy font-bold mb-3">
                1. Scan this QR code with your authenticator app
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={twoFaSetup.qrCodeDataUrl}
                alt="2FA QR Code"
                className="mx-auto w-48 h-48 rounded-xl border-[3px] border-navy"
              />
              <p className="text-xs text-slate mt-3">
                Or enter this key manually: <code className="bg-snow px-2 py-1 rounded text-navy font-mono text-xs border border-cloud">{twoFaSetup.secret}</code>
              </p>
            </div>
            <div>
              <p className="text-sm text-navy font-bold mb-2">2. Enter the 6-digit code from your app</p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-40 text-center text-2xl font-mono tracking-[0.3em] px-4 py-3 bg-ghost border-[3px] border-navy rounded-xl focus:outline-none focus:border-lavender"
                />
                <button
                  onClick={handle2FAVerify}
                  disabled={twoFaLoading || twoFaCode.length !== 6}
                  className="bg-lime border-[3px] border-navy press-3 press-navy px-6 py-3 rounded-xl font-display font-black text-navy disabled:opacity-50 transition-all"
                >
                  {twoFaLoading ? "Verifying..." : "Verify & Enable"}
                </button>
                <button
                  onClick={() => { setTwoFaStep("idle"); setTwoFaSetup(null); }}
                  className="text-sm text-slate hover:text-navy transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Backup codes step */}
        {twoFaStep === "backup" && twoFaBackupCodes.length > 0 && (
          <div className="space-y-4">
            <div className="bg-sunny-light border-[3px] border-sunny rounded-2xl p-5">
              <p className="text-sm font-bold text-navy mb-2">Save your backup codes</p>
              <p className="text-xs text-slate mb-4">
                Each code can only be used once. Store them in a safe place — you&apos;ll need them if you lose access to your authenticator app.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {twoFaBackupCodes.map((code) => (
                  <div key={code} className="bg-snow rounded-lg px-3 py-2 text-center font-mono text-sm text-navy border border-cloud">
                    {code}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => { setTwoFaStep("idle"); setTwoFaBackupCodes([]); }}
              className="bg-lime border-[3px] border-navy press-3 press-navy px-6 py-3 rounded-xl font-display font-black text-navy transition-all"
            >
              I&apos;ve saved my codes
            </button>
          </div>
        )}

        {/* Disable step */}
        {twoFaStep === "disable" && (
          <div className="bg-coral-light rounded-2xl p-6 space-y-4">
            <p className="text-sm text-navy font-bold">Enter a code from your authenticator app to disable 2FA</p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-40 text-center text-2xl font-mono tracking-[0.3em] px-4 py-3 bg-snow border-[3px] border-navy rounded-xl focus:outline-none focus:border-coral"
              />
              <button
                onClick={handle2FADisable}
                disabled={twoFaLoading || twoFaCode.length !== 6}
                className="bg-coral border-[3px] border-navy press-3 press-navy px-6 py-3 rounded-xl font-display font-black text-snow disabled:opacity-50 transition-all"
              >
                {twoFaLoading ? "Disabling..." : "Disable 2FA"}
              </button>
              <button
                onClick={() => { setTwoFaStep("idle"); setTwoFaCode(""); }}
                className="text-sm text-slate hover:text-navy transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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

        {/* Notification Categories — per-type toggles */}
        <div className="mt-8 pt-8 border-t-[2px] border-cloud">
          <h3 className="font-display font-bold text-navy text-base mb-1">Notification Categories</h3>
          <p className="text-sm text-slate mb-4">Choose which types of notifications you want to receive.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CATEGORY_META.map((cat) => {
              const enabled = categories[cat.key];
              const loading = catLoading === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleCategoryToggle(cat.key)}
                  disabled={loading}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-[3px] text-left transition-all ${
                    enabled
                      ? "border-navy bg-teal-light"
                      : "border-navy/15 bg-ghost"
                  } ${loading ? "opacity-60" : "hover:bg-cloud"}`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    enabled ? "bg-teal text-snow" : "bg-cloud text-slate"
                  }`}>
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block font-display font-bold text-navy text-sm">{cat.label}</span>
                    <span className="block text-xs text-slate mt-0.5">{cat.desc}</span>
                  </div>
                  {/* Toggle indicator */}
                  <div className={`w-10 h-6 rounded-full shrink-0 relative transition-colors ${
                    enabled ? "bg-teal" : "bg-navy/20"
                  }`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-snow shadow transition-transform ${
                      enabled ? "translate-x-[18px]" : "translate-x-0.5"
                    }`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3: SESSION ARCHIVE (only if multiple sessions)
          ═══════════════════════════════════════════════════════ */}
      {allSessions.length > 1 && (
        <section className="bg-snow border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0_0_#000] mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-sunny-light rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-sunny" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375Z" />
                <path fillRule="evenodd" d="m3.087 9 .54 9.176A3 3 0 0 0 6.62 21h10.757a3 3 0 0 0 2.995-2.824L20.913 9H3.087ZM12 10.5a.75.75 0 0 1 .75.75v4.94l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72v-4.94a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h2 className="font-display font-black text-xl text-navy">Session Archive</h2>
              <p className="text-sm text-slate">Browse data from previous academic sessions</p>
            </div>
          </div>
          <p className="text-sm text-slate mb-4">
            You have access to <span className="font-bold text-navy">{allSessions.length}</span> academic sessions.
            View past announcements, events, and records in the archive.
          </p>
          <Link
            href="/dashboard/archive"
            className="inline-flex items-center gap-2 bg-sunny-light border-[3px] border-navy press-4 press-navy px-6 py-3 rounded-xl font-display font-bold text-navy transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375Z" />
              <path fillRule="evenodd" d="m3.087 9 .54 9.176A3 3 0 0 0 6.62 21h10.757a3 3 0 0 0 2.995-2.824L20.913 9H3.087ZM12 10.5a.75.75 0 0 1 .75.75v4.94l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72v-4.94a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
            </svg>
            Open Archive
          </Link>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          SECTION 4: DANGER ZONE
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
              <PasswordInput
                id="delete-password"
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
