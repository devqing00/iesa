"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { getApiUrl, getMyRoles, getMyEnrollments } from "@/lib/api";
import type { Role, Enrollment } from "@/lib/api";
import { isInstitutionalEmail } from "@/lib/emailUtils";
import Link from "next/link";
import { toast } from "sonner";
import { OnboardingModal } from "@/components/ui/OnboardingModal";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

/* ─── types ─── */
interface UserProfile {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  matricNumber?: string;
  department: string;
  phone?: string;
  bio?: string;
  currentLevel?: string;
  admissionYear?: number;
  profilePictureUrl?: string;
  personalEmail?: string;
  institutionalEmail?: string;
  skills?: string[];
  dateOfBirth?: string;
  hasCompletedOnboarding?: boolean;
  emailVerified?: boolean;
  createdAt: string;
  // Dual Email System
  emailType?: "institutional" | "personal";
  secondaryEmail?: string;
  secondaryEmailType?: "institutional" | "personal";
  secondaryEmailVerified?: boolean;
  notificationEmailPreference?: "primary" | "secondary" | "both";
}

export default function ProfilePage() {
  const { user, getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [showOnboardingFlow, setShowOnboardingFlow] = useState(false);

  /* ─── secondary email state ─── */
  const [secondaryEmailInput, setSecondaryEmailInput] = useState("");
  const [addingSecondaryEmail, setAddingSecondaryEmail] = useState(false);
  const [showAddSecondaryForm, setShowAddSecondaryForm] = useState(false);
  const [removingSecondaryEmail, setRemovingSecondaryEmail] = useState(false);
  const [resendingSecondaryVerification, setResendingSecondaryVerification] = useState(false);
  const [savingNotifPref, setSavingNotifPref] = useState(false);

  /* ─── roles state ─── */
  const [myRoles, setMyRoles] = useState<Role[]>([]);
  /* ─── enrollments state ─── */
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    bio: "",
    personalEmail: "",
    dateOfBirth: "",
  });

  /* ─── fetch profile ─── */
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        setFetchLoading(true);
        const token = await getAccessToken();
        const response = await fetch(getApiUrl("/api/v1/users/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Failed to fetch profile");
        const data = await response.json();
        setProfileData(data);
        setFormData({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          phone: data.phone || "",
          bio: data.bio || "",
          personalEmail: data.personalEmail || "",
          dateOfBirth: data.dateOfBirth || "",
        });
      } catch {
        setError("Failed to load profile data");
      } finally {
        setFetchLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  /* ─── fetch roles ─── */
  useEffect(() => {
    getMyRoles()
      .then((roles) => setMyRoles(roles.filter((r) => r.isActive)))
      .catch(() => {});
  }, []);

  /* ─── fetch enrollments ─── */
  useEffect(() => {
    getMyEnrollments()
      .then((data) => setEnrollments(data))
      .catch(() => {});
  }, []);

  /* ─── save profile ─── */
  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/users/me"), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to update profile");
      }
      const updatedData = await response.json();
      setProfileData(updatedData);
      setSuccessMessage("Profile updated successfully!");
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(""), 3000);
      toast.success("Profile updated!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (profileData) {
      setFormData({
        firstName: profileData.firstName || "",
        lastName: profileData.lastName || "",
        phone: profileData.phone || "",
        bio: profileData.bio || "",
        personalEmail: profileData.personalEmail || "",
        dateOfBirth: profileData.dateOfBirth || "",
      });
    }
    setIsEditing(false);
    setError("");
  };

  /* ─── complete onboarding from profile page ─── */
  const handleOnboardingComplete = async () => {
    setShowOnboardingFlow(false);
    if (!profileData?.admissionYear) {
      toast.error("Admission year missing — please edit your profile first.");
      setIsEditing(true);
      return;
    }
    if (!profileData.matricNumber) {
      toast.error("Matric number missing — please edit your profile first.");
      setIsEditing(true);
      return;
    }
    if (!profileData.phone) {
      toast.error("Phone number missing — please edit your profile first.");
      setIsEditing(true);
      return;
    }
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/students/complete-registration"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          matricNumber: profileData.matricNumber,
          phone: profileData.phone,
          level: profileData.currentLevel || "100L",
          admissionYear: profileData.admissionYear,
          dateOfBirth: profileData.dateOfBirth ? String(profileData.dateOfBirth).split("T")[0] : undefined,
        }),
      });
      const responseData = await res.json();
      if (res.ok) {
        await refetchProfile();
        toast.success("Onboarding complete! Welcome to IESA.");
      } else if (res.status === 409) {
        await refetchProfile();
      } else {
        toast.error(responseData.detail || "Could not complete onboarding. Please check your profile details.");
        setIsEditing(true);
      }
    } catch {
      toast.error("Failed to complete onboarding. Please try again.");
    }
  };

  /* ─── refetch profile helper ─── */
  const refetchProfile = async () => {
    if (!user) return;
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/users/me"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
      }
    } catch { /* silent */ }
  };

  /* ─── secondary email: add ─── */
  const handleAddSecondaryEmail = async () => {
    if (!secondaryEmailInput.trim()) return;
    setAddingSecondaryEmail(true);
    setError("");
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/students/secondary-email"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: secondaryEmailInput.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to add secondary email");
      toast.success("Secondary email added!", { description: "Check your inbox for a verification link." });
      setShowAddSecondaryForm(false);
      setSecondaryEmailInput("");
      await refetchProfile();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add secondary email";
      setError(msg);
      toast.error(msg);
    } finally {
      setAddingSecondaryEmail(false);
    }
  };

  /* ─── secondary email: remove ─── */
  const handleRemoveSecondaryEmail = async () => {
    if (!confirm("Remove your secondary email? This action cannot be undone.")) return;
    setRemovingSecondaryEmail(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/students/secondary-email"), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to remove secondary email");
      toast.success("Secondary email removed.");
      await refetchProfile();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove secondary email");
    } finally {
      setRemovingSecondaryEmail(false);
    }
  };

  /* ─── secondary email: resend verification ─── */
  const handleResendSecondaryVerification = async () => {
    setResendingSecondaryVerification(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/students/secondary-email/resend-verification"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to resend verification");
      toast.success(data.message || "Verification email sent!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resend verification");
    } finally {
      setResendingSecondaryVerification(false);
    }
  };

  /* ─── notification preference ─── */
  const handleNotificationPrefChange = async (pref: "primary" | "secondary" | "both") => {
    setSavingNotifPref(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/students/notification-preference"), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ preference: pref }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to update preference");
      toast.success(`Notifications set to: ${pref}`);
      await refetchProfile();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update preference");
    } finally {
      setSavingNotifPref(false);
    }
  };

  /* ─── image upload ─── */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { setError("Image size must be less than 2MB"); return; }
    const reader = new FileReader();
    reader.onloadend = () => { setImagePreview(reader.result as string); setSelectedFile(file); setShowImageModal(true); };
    reader.readAsDataURL(file);
  };

  const confirmImageUpload = async () => {
    if (!selectedFile || !user) return;
    setUploadingImage(true);
    setError("");
    try {
      const token = await getAccessToken();
      const fd = new FormData();
      fd.append("file", selectedFile);
      const response = await fetch(getApiUrl("/api/v1/users/me/profile-picture"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to upload image");
      }
      const updatedData = await response.json();
      setProfileData(updatedData);
      setSuccessMessage("Profile picture updated!");
      setTimeout(() => setSuccessMessage(""), 3000);
      toast.success("Profile picture updated!");
      setShowImageModal(false);
      setImagePreview(null);
      setSelectedFile(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const cancelImageUpload = () => { setShowImageModal(false); setImagePreview(null); setSelectedFile(null); };

  /* ─── skeleton ─── */
  if (fetchLoading) {
    return (
      <div className="min-h-screen bg-ghost p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-7 h-44 bg-cloud rounded-[2rem] animate-pulse" />
            <div className="col-span-12 md:col-span-5 grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (<div key={i} className="h-20 bg-cloud rounded-[1.5rem] animate-pulse" />))}
            </div>
          </div>
          <div className="h-64 bg-cloud rounded-[2rem] animate-pulse" />
          <div className="h-80 bg-cloud rounded-[2rem] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-ghost p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[60vh]">
          <div className="bg-navy border-[3px] border-lime rounded-[2rem] p-8 shadow-[3px_3px_0_0_#C8F31D] text-center">
            <p className="font-display font-black text-lg text-snow">Failed to load profile</p>
            <p className="text-sm text-snow/50 mt-2">Please try refreshing the page.</p>
          </div>
        </div>
      </div>
    );
  }

  const fullName = `${profileData.firstName} ${profileData.lastName}`;
  const initials = `${profileData.firstName?.[0] || ""}${profileData.lastName?.[0] || ""}`.toUpperCase();
  const inputBase = "w-full px-4 py-3 font-display font-normal text-sm border-[3px] rounded-xl transition-all";
  const inputEditing = `${inputBase} border-navy bg-ghost text-navy focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20`;
  const inputDisabled = `${inputBase} border-navy/40 bg-cloud text-navy/50 cursor-not-allowed`;

  /* ─── categorise roles ─── */
  const ROLE_META: Record<string, { label: string; color: string; bg: string; icon: "exec" | "unit" | "class" }> = {
    president: { label: "President", color: "text-snow", bg: "bg-lime-light", icon: "exec" },
    vice_president: { label: "Vice President", color: "text-snow", bg: "bg-lime-light", icon: "exec" },
    general_secretary: { label: "General Secretary", color: "text-teal", bg: "bg-teal-light", icon: "exec" },
    assistant_general_secretary: { label: "Asst. General Secretary", color: "text-teal", bg: "bg-teal-light", icon: "exec" },
    financial_secretary: { label: "Financial Secretary", color: "text-sunny", bg: "bg-sunny-light", icon: "exec" },
    treasurer: { label: "Treasurer", color: "text-sunny", bg: "bg-sunny-light", icon: "exec" },
    public_relations_officer: { label: "PRO", color: "text-coral", bg: "bg-coral-light", icon: "exec" },
    director_of_socials: { label: "Director of Socials", color: "text-lavender", bg: "bg-lavender-light", icon: "exec" },
    director_of_sports: { label: "Director of Sports", color: "text-teal", bg: "bg-teal-light", icon: "exec" },
    director_of_welfare: { label: "Director of Welfare", color: "text-coral", bg: "bg-coral-light", icon: "exec" },
    class_rep: { label: "Class Representative", color: "text-lavender", bg: "bg-lavender-light", icon: "class" },
    assistant_class_rep: { label: "Asst. Class Rep", color: "text-lavender", bg: "bg-lavender-light", icon: "class" },
    press_head: { label: "Press Unit Head", color: "text-coral", bg: "bg-coral-light", icon: "unit" },
    press_member: { label: "Press Member", color: "text-coral", bg: "bg-coral-light", icon: "unit" },
    timp_lead: { label: "TIMP Lead", color: "text-teal", bg: "bg-teal-light", icon: "unit" },
    committee_academic_member: { label: "Academic Committee", color: "text-sunny", bg: "bg-sunny-light", icon: "unit" },
    committee_welfare_member: { label: "Welfare Committee", color: "text-coral", bg: "bg-coral-light", icon: "unit" },
    committee_sports_member: { label: "Sports Committee", color: "text-teal", bg: "bg-teal-light", icon: "unit" },
    committee_socials_member: { label: "Socials Committee", color: "text-lavender", bg: "bg-lavender-light", icon: "unit" },
  };

  function getRoleMeta(position: string) {
    return ROLE_META[position] || {
      label: position.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      color: "text-slate",
      bg: "bg-cloud",
      icon: "unit" as const,
    };
  }

  const execRoles = myRoles.filter((r) => getRoleMeta(r.position).icon === "exec");
  const unitRoles = myRoles.filter((r) => getRoleMeta(r.position).icon === "unit");
  const classRoles = myRoles.filter((r) => getRoleMeta(r.position).icon === "class");

  return (
    <div className="min-h-screen bg-ghost p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 overflow-x-hidden relative">
      <ToolHelpModal toolId="profile" isOpen={showHelp} onClose={closeHelp} />
      {/* ── onboarding modal (portal) ── */}
      {showOnboardingFlow && (
        <OnboardingModal
          onComplete={handleOnboardingComplete}
          onSkip={() => setShowOnboardingFlow(false)}
        />
      )}
      {/* ── diamond sparkles ── */}
      {[
        "top-12 left-[7%] w-5 h-5 text-coral/15",
        "top-32 right-[10%] w-4 h-4 text-teal/12",
        "top-[45%] left-[4%] w-6 h-6 text-lavender/14",
        "top-[60%] right-[6%] w-5 h-5 text-sunny/16",
        "bottom-24 left-[14%] w-4 h-4 text-navy/8",
      ].map((cls, i) => (
        <svg aria-hidden="true" key={i} className={`fixed ${cls} pointer-events-none z-0`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
        </svg>
      ))}

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* ── back link + help ── */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-display font-bold text-navy hover:text-coral transition-colors"
          >
            <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            Back to Dashboard
          </Link>
          <HelpButton onClick={openHelp} />
        </div>

        {/* ── notifications ── */}
        {successMessage && (
          <div className="bg-teal-light border-[3px] border-navy rounded-[1.5rem] p-4 shadow-[4px_4px_0_0_#000] flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal/30 flex items-center justify-center flex-shrink-0">
              <svg aria-hidden="true" className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-display font-bold text-sm text-navy">{successMessage}</span>
          </div>
        )}
        {error && (
          <div className="bg-coral-light border-[3px] border-navy rounded-[1.5rem] p-4 shadow-[4px_4px_0_0_#000] flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-coral/30 flex items-center justify-center flex-shrink-0">
              <svg aria-hidden="true" className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-display font-bold text-sm text-navy">{error}</span>
            <button onClick={() => setError("")} className="ml-auto">
              <svg aria-hidden="true" className="w-4 h-4 text-navy/40 hover:text-navy" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════
            BENTO HERO — coral theme
        ════════════════════════════════════════ */}
        <div className="grid grid-cols-12 gap-4">
          {/* left: title + avatar card */}
          <div className="col-span-12 md:col-span-7 bg-coral border-[3px] border-navy rounded-[2rem] p-8 shadow-[4px_4px_0_0_#000] rotate-[-0.4deg] hover:rotate-0 transition-transform relative overflow-hidden">
            <div className="flex items-start gap-5">
              {/* avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl border-[3px] border-lime overflow-hidden bg-navy">
                  {profileData.profilePictureUrl ? (
                    <img src={profileData.profilePictureUrl} alt={fullName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="font-display font-black text-2xl md:text-3xl text-snow">{initials}</span>
                    </div>
                  )}
                </div>
                {/* upload button */}
                <label className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-lime border-[3px] border-navy flex items-center justify-center cursor-pointer hover:bg-cloud transition-colors shadow-[2px_2px_0_0_#000]">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                  {uploadingImage ? (
                    <div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg aria-hidden="true" className="w-4 h-4 text-navy" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                  )}
                </label>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60 mb-1">
                  Your Profile
                </div>
                <h1 className="font-display font-black text-2xl sm:text-3xl text-snow leading-tight truncate">
                  {fullName}
                </h1>
                <p className="text-sm text-snow/70 font-medium mt-1 truncate">
                  {profileData.institutionalEmail || profileData.email}
                </p>
                {/* badges */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-navy/15 font-display font-bold text-[10px] text-snow uppercase tracking-[0.08em]">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                    {profileData.currentLevel || "Student"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-navy/15 font-display font-bold text-[10px] text-snow uppercase tracking-[0.08em]">
                    <span className="w-1.5 h-1.5 rounded-full bg-lavender" />
                    {profileData.matricNumber || "N/A"}
                  </span>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-navy/8" />
          </div>

          {/* right: 2×2 stats */}
          <div className="col-span-12 md:col-span-5 grid grid-cols-2 gap-3">
            <div className="bg-teal-light border-[3px] border-navy rounded-[1.5rem] p-4 shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
              <div className="w-8 h-8 rounded-xl bg-teal/30 flex items-center justify-center mb-2">
                <svg aria-hidden="true" className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                </svg>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Status</div>
              <div className="font-display font-black text-lg text-navy">
                {profileData.hasCompletedOnboarding ? "Active" : "Pending"}
              </div>
            </div>

            <div className="bg-lavender-light border-[3px] border-navy rounded-[1.5rem] p-4 shadow-[4px_4px_0_0_#000] rotate-[-0.6deg] hover:rotate-0 transition-transform">
              <div className="w-8 h-8 rounded-xl bg-lavender/30 flex items-center justify-center mb-2">
                <svg aria-hidden="true" className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Member Since</div>
              <div className="font-display font-black text-base text-navy">
                {new Date(profileData.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </div>
            </div>

            <div className="bg-sunny-light border-[3px] border-navy rounded-[1.5rem] p-4 shadow-[4px_4px_0_0_#000] rotate-[0.7deg] hover:rotate-0 transition-transform">
              <div className="w-8 h-8 rounded-xl bg-sunny/30 flex items-center justify-center mb-2">
                <svg aria-hidden="true" className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M1 2.75A.75.75 0 011.75 2h16.5a.75.75 0 010 1.5H18v8.75A2.75 2.75 0 0115.25 15h-1.072l.798 3.06a.75.75 0 01-1.452.38L13.41 18H6.59l-.114.44a.75.75 0 01-1.452-.38L5.822 15H4.75A2.75 2.75 0 012 12.25V3.5h-.25A.75.75 0 011 2.75zM7.373 15l-.391 1.5h6.037l-.392-1.5H7.373zm.879-6.206a.75.75 0 00-.146 1.49A13.94 13.94 0 0010 10.5c.65 0 1.286-.056 1.894-.216a.75.75 0 10-.382-1.45A12.41 12.41 0 0110 9c-.59 0-1.18-.043-1.748-.206z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Department</div>
              <div className="font-display font-black text-[11px] text-navy leading-tight">
                {profileData.department?.split(" ").slice(0, 3).join(" ") || "N/A"}
              </div>
            </div>

            <div className="bg-coral-light border-[3px] border-navy rounded-[1.5rem] p-4 shadow-[4px_4px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
              <div className="w-8 h-8 rounded-xl bg-coral/30 flex items-center justify-center mb-2">
                <svg aria-hidden="true" className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4.214 3.227a.75.75 0 00-1.156-.955 8.97 8.97 0 00-1.856 3.825.75.75 0 001.466.316 7.47 7.47 0 011.546-3.186zM16.942 2.272a.75.75 0 00-1.157.955 7.47 7.47 0 011.547 3.186.75.75 0 001.466-.316 8.97 8.97 0 00-1.856-3.825z" />
                  <path fillRule="evenodd" d="M10 2a6 6 0 00-5.547 8.247l-.634 4.217a1 1 0 001.136 1.136l3.153-.474A6 6 0 1010 2zM6.5 8a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Admission</div>
              <div className="font-display font-black text-lg text-navy">
                {profileData.admissionYear || "N/A"}
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════
            ROLES & MEMBERSHIPS
        ════════════════════════════════════════ */}
        {myRoles.length > 0 && (
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-lavender-light text-navy font-display font-bold text-[10px] uppercase tracking-[0.08em]">
              <span className="w-1.5 h-1.5 rounded-full bg-lavender" />
              Roles & Memberships
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Executive Roles */}
              {execRoles.map((role) => {
                const meta = getRoleMeta(role.position);
                return (
                  <div key={role.id} className={`${meta.bg} border-[3px] border-navy rounded-[1.5rem] p-5 shadow-[4px_4px_0_0_#000] rotate-[-0.3deg] hover:rotate-0 transition-transform`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0">
                        <svg aria-hidden="true" className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50">Executive</div>
                        <div className="font-display font-black text-sm text-navy leading-tight">{meta.label}</div>
                        {role.customTitle && (
                          <div className="text-[10px] text-navy/60 mt-0.5">{role.customTitle}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Unit / Committee Roles */}
              {unitRoles.map((role) => {
                const meta = getRoleMeta(role.position);
                return (
                  <div key={role.id} className={`${meta.bg} border-[3px] border-navy rounded-[1.5rem] p-5 shadow-[4px_4px_0_0_#000] rotate-[0.3deg] hover:rotate-0 transition-transform`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0">
                        <svg aria-hidden="true" className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A18.034 18.034 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50">
                          {role.position.includes("head") || role.position.includes("lead") ? "Unit Lead" : "Member"}
                        </div>
                        <div className="font-display font-black text-sm text-navy leading-tight">{meta.label}</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Class Rep Roles */}
              {classRoles.map((role) => {
                const meta = getRoleMeta(role.position);
                return (
                  <div key={role.id} className={`${meta.bg} border-[3px] border-navy rounded-[1.5rem] p-5 shadow-[4px_4px_0_0_#000] rotate-[-0.2deg] hover:rotate-0 transition-transform`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0">
                        <svg aria-hidden="true" className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.948 49.948 0 0 0-9.902 3.912l-.003.002-.34.18a.75.75 0 0 1-.707 0A50.88 50.88 0 0 0 7.5 12.173v-.224c0-.131.067-.248.172-.311a54.615 54.615 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.123 56.123 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
                          <path d="M13.06 15.473a48.45 48.45 0 0 1 7.666-3.282c.134 1.414.22 2.843.255 4.284a.75.75 0 0 1-.46.711 47.87 47.87 0 0 0-8.105 4.342.75.75 0 0 1-.832 0 47.87 47.87 0 0 0-8.104-4.342.75.75 0 0 1-.461-.71c.035-1.442.121-2.87.255-4.286a48.4 48.4 0 0 1 6.39 2.57l.09.045a3.11 3.11 0 0 0 2.823.19l.195-.098a48.6 48.6 0 0 1 .288-.139Z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50">Class Role</div>
                        <div className="font-display font-black text-sm text-navy leading-tight">{meta.label}</div>
                        {role.level && (
                          <div className="text-[10px] text-navy/60 mt-0.5">{String(role.level).endsWith("L") ? role.level : `${role.level}L`}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            PERSONAL INFORMATION
        ════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {/* section header */}
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-coral-light text-navy font-display font-bold text-[10px] uppercase tracking-[0.08em]">
                <span className="w-1.5 h-1.5 rounded-full bg-coral" />
                Personal Information
              </div>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
 className="bg-snow border-[3px] border-navy rounded-xl px-4 py-2 font-display font-bold text-[10px] text-navy uppercase tracking-[0.08em] press-3 press-black transition-all inline-flex items-center gap-2"
                >
                  <svg aria-hidden="true" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                  </svg>
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="bg-snow border-[3px] border-navy rounded-xl px-4 py-2 font-display font-bold text-[10px] text-navy/60 uppercase tracking-[0.08em] hover:text-navy transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-lime border-[3px] border-navy press-3 press-navy px-5 py-2 rounded-xl font-display font-black text-[10px] text-navy uppercase tracking-[0.08em] transition-all disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {loading ? (
                      <><div className="w-3 h-3 border-2 border-navy border-t-transparent rounded-full animate-spin" />Saving...</>
                    ) : "Save Changes"}
                  </button>
                </div>
              )}
            </div>

            {/* form card */}
            <div className="bg-snow border-[3px] border-navy rounded-[2rem] p-6 md:p-8 shadow-[3px_3px_0_0_#000]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* First Name */}
                <div className="space-y-1.5">
                  <label htmlFor="p-fn" className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal" />First Name
                  </label>
                  <input id="p-fn" type="text" value={isEditing ? formData.firstName : profileData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} disabled={!isEditing} className={isEditing ? inputEditing : inputDisabled} />
                </div>

                {/* Last Name */}
                <div className="space-y-1.5">
                  <label htmlFor="p-ln" className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-lavender" />Last Name
                  </label>
                  <input id="p-ln" type="text" value={isEditing ? formData.lastName : profileData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} disabled={!isEditing} className={isEditing ? inputEditing : inputDisabled} />
                </div>

                {/* Primary Email */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-coral" />Primary Email
                    {profileData.emailType === "institutional" ? (
                      <span className="ml-1 px-2 py-0.5 rounded-lg bg-teal-light border border-navy/20 text-[9px] font-bold uppercase tracking-wider text-navy">Institutional</span>
                    ) : (
                      <span className="ml-1 px-2 py-0.5 rounded-lg bg-lavender-light border border-navy/20 text-[9px] font-bold uppercase tracking-wider text-navy">Personal</span>
                    )}
                    {profileData.emailVerified ? (
                      <span className="ml-1 px-2 py-0.5 rounded-lg bg-teal/20 text-[9px] font-bold text-navy">Verified</span>
                    ) : (
                      <span className="ml-1 px-2 py-0.5 rounded-lg bg-coral/20 text-[9px] font-bold text-navy">Unverified</span>
                    )}
                  </label>
                  <input type="email" value={profileData.email} disabled className={inputDisabled} title="Primary email address" />
                </div>

                {/* Secondary Email Section */}
                <div className="space-y-3 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sunny" />Secondary Email
                    {profileData.secondaryEmail && (
                      <>
                        {profileData.secondaryEmailType === "institutional" ? (
                          <span className="ml-1 px-2 py-0.5 rounded-lg bg-teal-light border border-navy/20 text-[9px] font-bold uppercase tracking-wider text-navy">Institutional</span>
                        ) : (
                          <span className="ml-1 px-2 py-0.5 rounded-lg bg-lavender-light border border-navy/20 text-[9px] font-bold uppercase tracking-wider text-navy">Personal</span>
                        )}
                        {profileData.secondaryEmailVerified ? (
                          <span className="ml-1 px-2 py-0.5 rounded-lg bg-teal/20 text-[9px] font-bold text-navy">Verified</span>
                        ) : (
                          <span className="ml-1 px-2 py-0.5 rounded-lg bg-coral/20 text-[9px] font-bold text-navy">Unverified</span>
                        )}
                      </>
                    )}
                  </label>

                  {profileData.secondaryEmail ? (
                    <div className="space-y-2">
                      <input type="email" value={profileData.secondaryEmail} disabled className={inputDisabled} title="Secondary email address" />
                      <div className="flex flex-wrap gap-2">
                        {!profileData.secondaryEmailVerified && (
                          <button
                            type="button"
                            onClick={handleResendSecondaryVerification}
                            disabled={resendingSecondaryVerification}
                            className="px-3 py-1.5 bg-sunny border-[2px] border-navy press-2 press-navy rounded-xl font-display font-bold text-[11px] text-navy transition-all disabled:opacity-50"
                          >
                            {resendingSecondaryVerification ? "Sending..." : "Resend Verification"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleRemoveSecondaryEmail}
                          disabled={removingSecondaryEmail}
                          className="px-3 py-1.5 bg-coral/20 border-[2px] border-navy/30 rounded-xl font-display font-bold text-[11px] text-navy hover:bg-coral/40 transition-all disabled:opacity-50"
                        >
                          {removingSecondaryEmail ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </div>
                  ) : showAddSecondaryForm ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={secondaryEmailInput}
                          onChange={(e) => setSecondaryEmailInput(e.target.value)}
                          placeholder={profileData.emailType === "institutional" ? "yourname@gmail.com" : "yourname@stu.ui.edu.ng"}
                          className={inputEditing + " flex-1"}
                        />
                        <button
                          type="button"
                          onClick={handleAddSecondaryEmail}
                          disabled={addingSecondaryEmail || !secondaryEmailInput.trim()}
                          className="px-4 py-2 bg-lime border-[2px] border-navy press-2 press-navy rounded-xl font-display font-bold text-[11px] text-navy transition-all disabled:opacity-50 whitespace-nowrap"
                        >
                          {addingSecondaryEmail ? "Adding..." : "Add"}
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-slate">
                          {profileData.emailType === "institutional"
                            ? "Add a personal email (e.g., Gmail, Yahoo)"
                            : "Add your institutional email (@stu.ui.edu.ng)"}
                        </p>
                        <button type="button" onClick={() => { setShowAddSecondaryForm(false); setSecondaryEmailInput(""); }} className="text-[10px] text-slate hover:text-navy underline">
                          Cancel
                        </button>
                      </div>
                      {secondaryEmailInput && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(secondaryEmailInput) && (
                        <div className="flex items-center gap-1.5">
                          {isInstitutionalEmail(secondaryEmailInput) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-light border border-navy/20 text-[9px] font-bold text-navy">Institutional</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-lavender-light border border-navy/20 text-[9px] font-bold text-navy">Personal</span>
                          )}
                          {isInstitutionalEmail(secondaryEmailInput) === (profileData.emailType === "institutional") && (
                            <span className="text-[10px] text-coral font-bold">Must be {profileData.emailType === "institutional" ? "personal" : "institutional"} email</span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAddSecondaryForm(true)}
                      className="px-4 py-2 bg-ghost border-[2px] border-navy/30 rounded-xl font-display font-bold text-[11px] text-navy hover:border-navy hover:bg-cloud transition-all"
                    >
                      + Add {profileData.emailType === "institutional" ? "Personal" : "Institutional"} Email
                    </button>
                  )}
                </div>

                {/* Matric */}
                <div className="space-y-1.5">
                  <label htmlFor="p-mat" className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal" />Matric Number
                  </label>
                  <input id="p-mat" type="text" value={profileData.matricNumber || "Not Set"} disabled className={inputDisabled} />
                </div>

                {/* Level */}
                <div className="space-y-1.5">
                  <label htmlFor="p-lvl" className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-lavender" />Current Level
                  </label>
                  <input id="p-lvl" type="text" value={profileData.currentLevel || "Not Set"} disabled className={inputDisabled} />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label htmlFor="p-ph" className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-coral" />Phone Number
                  </label>
                  <input id="p-ph" type="tel" value={isEditing ? formData.phone : profileData.phone || ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} disabled={!isEditing} placeholder="+234..." className={isEditing ? inputEditing : inputDisabled} />
                </div>

                {/* Date of Birth */}
                <div className="space-y-1.5">
                  <label htmlFor="p-dob" className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-lavender" />Date of Birth
                  </label>
                  <input id="p-dob" type="date" value={isEditing ? formData.dateOfBirth : profileData.dateOfBirth || ""} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} disabled={!isEditing} className={isEditing ? inputEditing : inputDisabled} />
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <label htmlFor="p-dept" className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sunny" />Department
                  </label>
                  <input id="p-dept" type="text" value={profileData.department} disabled className={inputDisabled} />
                </div>

                {/* Bio */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal" />Bio
                  </label>
                  <textarea
                    value={isEditing ? formData.bio : profileData.bio || ""}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    disabled={!isEditing}
                    placeholder="Tell us about yourself..."
                    rows={4}
                    maxLength={500}
                    className={`resize-none ${isEditing ? inputEditing : inputDisabled}`}
                  />
                  {isEditing && (
                    <p className="text-[10px] font-bold text-slate text-right">{formData.bio.length}/500</p>
                  )}
                </div>
              </div>
            </div>

            {/* Notification Preference Card */}
            {profileData.secondaryEmail && profileData.secondaryEmailVerified && (
              <div className="bg-snow border-[3px] border-navy rounded-[2rem] p-6 md:p-8 shadow-[3px_3px_0_0_#000] space-y-4">
                <div className="space-y-1">
                  <h3 className="font-display font-black text-lg text-navy flex items-center gap-2">
                    <svg aria-hidden="true" className="w-5 h-5 text-lavender" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                    Notification Email
                  </h3>
                  <p className="text-[11px] text-slate">Choose where you receive email notifications</p>
                </div>
                <div className="space-y-2">
                  {(["primary", "secondary", "both"] as const).map((pref) => {
                    const isActive = (profileData.notificationEmailPreference || "primary") === pref;
                    const labels: Record<string, string> = {
                      primary: `Primary (${profileData.email})`,
                      secondary: `Secondary (${profileData.secondaryEmail})`,
                      both: "Both emails",
                    };
                    return (
                      <button
                        key={pref}
                        type="button"
                        disabled={savingNotifPref}
                        onClick={() => handleNotificationPrefChange(pref)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-[2px] transition-all text-left ${
                          isActive
                            ? "border-navy bg-lime/30 shadow-[2px_2px_0_0_#000]"
                            : "border-navy/20 bg-ghost hover:border-navy/40"
                        } ${savingNotifPref ? "opacity-50" : ""}`}
                      >
                        <span className={`w-4 h-4 rounded-full border-[2px] flex items-center justify-center ${isActive ? "border-navy" : "border-navy/30"}`}>
                          {isActive && <span className="w-2 h-2 rounded-full bg-navy" />}
                        </span>
                        <span className={`font-display text-xs ${isActive ? "font-bold text-navy" : "font-medium text-navy/70"}`}>
                          {labels[pref]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════
              ACCOUNT STATUS SIDEBAR
          ════════════════════════════════════════ */}
          <div className="lg:col-span-1 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-light text-navy font-display font-bold text-[10px] uppercase tracking-[0.08em]">
              <span className="w-1.5 h-1.5 rounded-full bg-teal" />
              Account Status
            </div>

            <div className="bg-snow border-[3px] border-navy rounded-[2rem] p-6 shadow-[3px_3px_0_0_#000] space-y-3">
              {/* profile status */}
              <div className="flex items-center justify-between p-3 bg-teal-light border-[3px] border-navy rounded-xl">
                <div className="flex items-center gap-2">
                  <svg aria-hidden="true" className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                  </svg>
                  <span className="font-display font-bold text-xs text-navy">Profile</span>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-display font-bold text-[10px] uppercase tracking-[0.08em] ${profileData.hasCompletedOnboarding ? "bg-teal/20 text-teal" : "bg-coral/20 text-coral"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${profileData.hasCompletedOnboarding ? "bg-teal" : "bg-coral"}`} />
                  {profileData.hasCompletedOnboarding ? "Complete" : "Incomplete"}
                </span>
              </div>

              {/* email status */}
              <div className="flex items-center justify-between p-3 bg-lavender-light border-[3px] border-navy rounded-xl">
                <div className="flex items-center gap-2">
                  <svg aria-hidden="true" className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                    <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                  </svg>
                  <span className="font-display font-bold text-xs text-navy">Email</span>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-display font-bold text-[10px] uppercase tracking-[0.08em] ${profileData.emailVerified ? "bg-navy/20 text-navy" : "bg-coral/20 text-coral"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${profileData.emailVerified ? "bg-navy" : "bg-coral"}`} />
                  {profileData.emailVerified ? "Verified" : "Unverified"}
                </span>
              </div>
              {!profileData.emailVerified && (
                <button
                  disabled={resendingVerification}
                  onClick={async () => {
                    setResendingVerification(true);
                    try {
                      const token = await getAccessToken();
                      const res = await fetch(getApiUrl("/api/v1/auth/resend-verification"), {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const data = await res.json();
                      if (res.ok) {
                        toast.success(data.message || "Verification email sent!");
                      } else {
                        toast.error(data.detail || "Failed to send verification email");
                      }
                    } catch {
                      toast.error("Failed to send verification email");
                    } finally {
                      setResendingVerification(false);
                    }
                  }}
                  className="w-full py-2 bg-lavender/20 border-[2px] border-navy/30 rounded-xl font-display font-bold text-[11px] text-navy hover:bg-lavender/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {resendingVerification && (
                    <div className="w-3.5 h-3.5 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                  )}
                  {resendingVerification ? "Sending..." : "Resend Verification Email"}
                </button>
              )}

              {/* onboarding status */}
              <div className="flex items-center justify-between p-3 bg-sunny-light border-[3px] border-navy rounded-xl">
                <div className="flex items-center gap-2">
                  <svg aria-hidden="true" className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  <span className="font-display font-bold text-xs text-navy">Onboarding</span>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-display font-bold text-[10px] uppercase tracking-[0.08em] ${profileData.hasCompletedOnboarding ? "bg-teal/20 text-teal" : "bg-sunny/20 text-sunny"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${profileData.hasCompletedOnboarding ? "bg-teal" : "bg-sunny"}`} />
                  {profileData.hasCompletedOnboarding ? "Done" : "Pending"}
                </span>
              </div>

              {/* onboarding CTA — only shown when pending */}
              {!profileData.hasCompletedOnboarding && (
                <div className="space-y-2">
                  {(!profileData.matricNumber || !profileData.phone || !profileData.admissionYear) ? (
                    <div className="p-3 bg-coral-light border-[2px] border-coral/30 rounded-xl">
                      <p className="text-[11px] font-display font-bold text-navy">Complete your profile first</p>
                      <p className="text-[10px] text-navy/60 mt-0.5 leading-relaxed">Add your matric number, phone number, and admission year, then return here to finish onboarding.</p>
                      <button
                        onClick={() => { setIsEditing(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        className="mt-2 text-[11px] font-display font-bold text-coral hover:underline"
                      >
                        Edit Profile →
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowOnboardingFlow(true)}
                      className="w-full py-2.5 bg-lime border-[2px] border-navy press-2 press-navy rounded-xl font-display font-bold text-xs text-navy flex items-center justify-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      Complete Onboarding
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* quick links */}
            <div className="bg-navy border-[3px] border-lime rounded-[2rem] p-6 shadow-[3px_3px_0_0_#C8F31D]">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/50 mb-3">Quick Links</div>
              <div className="space-y-2">

                <Link href="/dashboard/payments" className="flex items-center gap-2 text-sm font-display font-bold text-snow hover:text-teal transition-colors">
                  <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.5 4A1.5 1.5 0 001 5.5V6h18v-.5A1.5 1.5 0 0017.5 4h-15zM19 8.5H1v6A1.5 1.5 0 002.5 16h15a1.5 1.5 0 001.5-1.5v-6z" />
                  </svg>
                  Payments
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════
            ENROLLMENT HISTORY
        ════════════════════════════════════════ */}
        {enrollments.length > 0 && (
          <div className="mt-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-lavender-light text-navy font-display font-bold text-[10px] uppercase tracking-[0.08em] mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-lavender" />
              Enrollment History
            </div>
            <div className="bg-snow border-[3px] border-navy rounded-3xl shadow-[6px_6px_0_0_#000] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-[3px] border-navy bg-lavender-light">
                      <th className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Session</th>
                      <th className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Level</th>
                      <th className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Enrolled On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((e, i) => (
                      <tr key={e.id || i} className="border-b-[2px] border-navy/10 last:border-b-0 hover:bg-ghost transition-colors">
                        <td className="p-4">
                          <div>
                            <span className="font-display font-bold text-sm text-navy">{e.session?.name || "—"}</span>
                            {e.session?.isActive && (
                              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-teal-light text-[9px] font-bold uppercase tracking-wider text-teal">Active</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lavender-light text-xs font-bold text-navy">
                            {e.level ? `${String(e.level).replace(/L$/i, "")} Level` : "—"}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-navy/60">
                          {new Date(e.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          IMAGE MODAL
      ════════════════════════════════════════ */}
      {showImageModal && (
        <div className="fixed inset-0 bg-navy/80 z-[70] flex items-center justify-center px-4 py-4 sm:p-6">
          <div className="bg-ghost border-[3px] border-navy rounded-[2rem] max-w-lg w-full shadow-[4px_4px_0_0_#000] overflow-hidden max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col">
            {/* header */}
            <div className="bg-coral-light border-b-[4px] border-navy p-5 flex items-center justify-between">
              <h2 className="font-display font-black text-lg text-navy">
                {selectedFile ? "Preview New Photo" : "Profile Picture"}
              </h2>
              <button onClick={cancelImageUpload} disabled={uploadingImage} className="w-8 h-8 flex items-center justify-center bg-snow border-[3px] border-navy rounded-xl hover:bg-cloud transition-colors" aria-label="Close">
                <svg aria-hidden="true" className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              {/* preview */}
              <div className="w-full aspect-square max-w-xs mx-auto border-[3px] border-navy rounded-2xl overflow-hidden bg-cloud">
                <img
                  src={imagePreview || profileData.profilePictureUrl || ""}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* file info */}
              {selectedFile && (
                <div className="bg-cloud border-[3px] border-navy rounded-xl p-3">
                  <p className="font-display font-bold text-sm text-navy truncate">{selectedFile.name}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate mt-1">
                    {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type}
                  </p>
                </div>
              )}

              {/* tip */}
              <div className="bg-sunny-light border-[3px] border-navy rounded-xl p-3">
                <p className="text-[10px] font-bold text-navy/60">
                  <span className="text-navy font-display font-black">Tip:</span> Use a square image with good lighting. Max 2MB.
                </p>
              </div>

              {/* actions */}
              <div className="flex gap-3">
                <button
                  onClick={cancelImageUpload}
                  disabled={uploadingImage}
                  className="flex-1 bg-transparent border-[3px] border-navy px-4 py-3 rounded-xl font-display font-bold text-xs text-navy uppercase tracking-[0.08em] hover:bg-navy hover:text-lime hover:border-lime transition-all"
                >
                  Cancel
                </button>
                {selectedFile && (
                  <button
                    onClick={confirmImageUpload}
                    disabled={uploadingImage}
                    className="flex-1 bg-lime border-[3px] border-navy press-3 press-navy px-4 py-3 rounded-xl font-display font-black text-xs text-navy uppercase tracking-[0.08em] transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {uploadingImage ? (
                      <><div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />Uploading...</>
                    ) : (
                      <>
                        <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                          <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                        </svg>
                        Upload
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
