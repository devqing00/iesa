"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/api";
import Link from "next/link";

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
  hasCompletedOnboarding?: boolean;
  createdAt: string;
}

export default function ProfilePage() {
  const { user, getAccessToken } = useAuth();
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

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    bio: "",
    personalEmail: "",
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
        });
      } catch {
        setError("Failed to load profile data");
      } finally {
        setFetchLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

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
      });
    }
    setIsEditing(false);
    setError("");
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
          <div className="bg-navy border-[4px] border-lime rounded-[2rem] p-8 shadow-[8px_8px_0_0_#000] text-center">
            <p className="font-display font-black text-lg text-lime">Failed to load profile</p>
            <p className="text-sm text-lime/60 mt-2">Please try refreshing the page.</p>
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

  return (
    <div className="min-h-screen bg-ghost p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 overflow-x-hidden relative">
      {/* ── diamond sparkles ── */}
      {[
        "top-12 left-[7%] w-5 h-5 text-coral/15",
        "top-32 right-[10%] w-4 h-4 text-teal/12",
        "top-[45%] left-[4%] w-6 h-6 text-lavender/14",
        "top-[60%] right-[6%] w-5 h-5 text-sunny/16",
        "bottom-24 left-[14%] w-4 h-4 text-lime/12",
      ].map((cls, i) => (
        <svg key={i} className={`fixed ${cls} pointer-events-none z-0`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
        </svg>
      ))}

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* ── back link ── */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-display font-bold text-navy hover:text-coral transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Back to Dashboard
        </Link>

        {/* ── notifications ── */}
        {successMessage && (
          <div className="bg-teal-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-display font-bold text-sm text-navy">{successMessage}</span>
          </div>
        )}
        {error && (
          <div className="bg-coral-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-coral/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-display font-bold text-sm text-navy">{error}</span>
            <button onClick={() => setError("")} className="ml-auto">
              <svg className="w-4 h-4 text-navy/40 hover:text-navy" fill="currentColor" viewBox="0 0 20 20">
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
          <div className="col-span-12 md:col-span-7 bg-coral border-[6px] border-navy rounded-[2rem] p-8 shadow-[10px_10px_0_0_#000] rotate-[-0.4deg] hover:rotate-0 transition-transform relative overflow-hidden">
            <div className="flex items-start gap-5">
              {/* avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl border-[4px] border-navy overflow-hidden bg-navy">
                  {profileData.profilePictureUrl ? (
                    <img src={profileData.profilePictureUrl} alt={fullName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="font-display font-black text-2xl md:text-3xl text-lime">{initials}</span>
                    </div>
                  )}
                </div>
                {/* upload button */}
                <label className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-lime border-[3px] border-navy flex items-center justify-center cursor-pointer hover:bg-lime-light transition-colors shadow-[2px_2px_0_0_#000]">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                  {uploadingImage ? (
                    <div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M1 8a7 7 0 1012.042 4.856l1.536 1.538a.75.75 0 001.06-1.06l-1.536-1.538A7 7 0 001 8zm4.75-1.5a.75.75 0 000 1.5h1.5v1.5a.75.75 0 001.5 0v-1.5h1.5a.75.75 0 000-1.5h-1.5v-1.5a.75.75 0 00-1.5 0v1.5h-1.5z" />
                    </svg>
                  )}
                </label>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 mb-1">
                  Your Profile
                </div>
                <h1 className="font-display font-black text-2xl sm:text-3xl text-navy leading-tight truncate">
                  {fullName}
                </h1>
                <p className="text-sm text-navy/70 font-medium mt-1 truncate">
                  {profileData.institutionalEmail || profileData.email}
                </p>
                {/* badges */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-navy/15 font-display font-bold text-[10px] text-navy uppercase tracking-[0.08em]">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                    {profileData.currentLevel || "Student"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-navy/15 font-display font-bold text-[10px] text-navy uppercase tracking-[0.08em]">
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
            <div className="bg-teal-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
              <div className="w-8 h-8 rounded-xl bg-teal/30 flex items-center justify-center mb-2">
                <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                </svg>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Status</div>
              <div className="font-display font-black text-lg text-navy">
                {profileData.hasCompletedOnboarding ? "Active" : "Pending"}
              </div>
            </div>

            <div className="bg-lavender-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[-0.6deg] hover:rotate-0 transition-transform">
              <div className="w-8 h-8 rounded-xl bg-lavender/30 flex items-center justify-center mb-2">
                <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Member Since</div>
              <div className="font-display font-black text-base text-navy">
                {new Date(profileData.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </div>
            </div>

            <div className="bg-sunny-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[0.7deg] hover:rotate-0 transition-transform">
              <div className="w-8 h-8 rounded-xl bg-sunny/30 flex items-center justify-center mb-2">
                <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M1 2.75A.75.75 0 011.75 2h16.5a.75.75 0 010 1.5H18v8.75A2.75 2.75 0 0115.25 15h-1.072l.798 3.06a.75.75 0 01-1.452.38L13.41 18H6.59l-.114.44a.75.75 0 01-1.452-.38L5.822 15H4.75A2.75 2.75 0 012 12.25V3.5h-.25A.75.75 0 011 2.75zM7.373 15l-.391 1.5h6.037l-.392-1.5H7.373zm.879-6.206a.75.75 0 00-.146 1.49A13.94 13.94 0 0010 10.5c.65 0 1.286-.056 1.894-.216a.75.75 0 10-.382-1.45A12.41 12.41 0 0110 9c-.59 0-1.18-.043-1.748-.206z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Department</div>
              <div className="font-display font-black text-[11px] text-navy leading-tight">
                {profileData.department?.split(" ").slice(0, 3).join(" ") || "N/A"}
              </div>
            </div>

            <div className="bg-coral-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
              <div className="w-8 h-8 rounded-xl bg-coral/30 flex items-center justify-center mb-2">
                <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
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
                  className="bg-snow border-[3px] border-navy rounded-xl px-4 py-2 font-display font-bold text-[10px] text-navy uppercase tracking-[0.08em] hover:shadow-[4px_4px_0_0_#000] transition-all inline-flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
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
                    className="bg-lime border-[4px] border-navy shadow-[4px_4px_0_0_#0F0F2D] px-5 py-2 rounded-xl font-display font-black text-[10px] text-navy uppercase tracking-[0.08em] hover:shadow-[6px_6px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {loading ? (
                      <><div className="w-3 h-3 border-2 border-navy border-t-transparent rounded-full animate-spin" />Saving...</>
                    ) : "Save Changes"}
                  </button>
                </div>
              )}
            </div>

            {/* form card */}
            <div className="bg-snow border-[4px] border-navy rounded-[2rem] p-6 md:p-8 shadow-[8px_8px_0_0_#000]">
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

                {/* Institutional Email */}
                <div className="space-y-1.5">
                  <label htmlFor="p-ie" className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-coral" />Institutional Email
                  </label>
                  <input id="p-ie" type="email" value={profileData.institutionalEmail || profileData.email} disabled className={inputDisabled} />
                </div>

                {/* Personal Email */}
                <div className="space-y-1.5">
                  <label htmlFor="p-pe" className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sunny" />Personal Email
                  </label>
                  <input id="p-pe" type="email" value={isEditing ? formData.personalEmail : profileData.personalEmail || ""} onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })} disabled={!isEditing} placeholder="your.email@example.com" className={isEditing ? inputEditing : inputDisabled} />
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
          </div>

          {/* ════════════════════════════════════════
              ACCOUNT STATUS SIDEBAR
          ════════════════════════════════════════ */}
          <div className="lg:col-span-1 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-light text-navy font-display font-bold text-[10px] uppercase tracking-[0.08em]">
              <span className="w-1.5 h-1.5 rounded-full bg-teal" />
              Account Status
            </div>

            <div className="bg-snow border-[4px] border-navy rounded-[2rem] p-6 shadow-[8px_8px_0_0_#000] space-y-3">
              {/* profile status */}
              <div className="flex items-center justify-between p-3 bg-teal-light border-[3px] border-navy rounded-xl">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
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
                  <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                    <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                  </svg>
                  <span className="font-display font-bold text-xs text-navy">Email</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-teal/20 text-teal font-display font-bold text-[10px] uppercase tracking-[0.08em]">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                  Verified
                </span>
              </div>

              {/* onboarding status */}
              <div className="flex items-center justify-between p-3 bg-sunny-light border-[3px] border-navy rounded-xl">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  <span className="font-display font-bold text-xs text-navy">Onboarding</span>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-display font-bold text-[10px] uppercase tracking-[0.08em] ${profileData.hasCompletedOnboarding ? "bg-teal/20 text-teal" : "bg-sunny/20 text-sunny"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${profileData.hasCompletedOnboarding ? "bg-teal" : "bg-sunny"}`} />
                  {profileData.hasCompletedOnboarding ? "Done" : "Pending"}
                </span>
              </div>
            </div>

            {/* quick links */}
            <div className="bg-navy border-[4px] border-teal rounded-[2rem] p-6 shadow-[8px_8px_0_0_#000]">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-lime/50 mb-3">Quick Links</div>
              <div className="space-y-2">

                <Link href="/dashboard/payments" className="flex items-center gap-2 text-sm font-display font-bold text-lime hover:text-teal transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.5 4A1.5 1.5 0 001 5.5V6h18v-.5A1.5 1.5 0 0017.5 4h-15zM19 8.5H1v6A1.5 1.5 0 002.5 16h15a1.5 1.5 0 001.5-1.5v-6z" />
                  </svg>
                  Payments
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          IMAGE MODAL
      ════════════════════════════════════════ */}
      {showImageModal && (
        <div className="fixed inset-0 bg-navy/80 z-50 flex items-center justify-center px-4 pt-4 pb-20 md:p-6">
          <div className="bg-ghost border-[4px] border-navy rounded-[2rem] max-w-lg w-full shadow-[10px_10px_0_0_#000] overflow-hidden">
            {/* header */}
            <div className="bg-coral-light border-b-[4px] border-navy p-5 flex items-center justify-between">
              <h2 className="font-display font-black text-lg text-navy">
                {selectedFile ? "Preview New Photo" : "Profile Picture"}
              </h2>
              <button onClick={cancelImageUpload} disabled={uploadingImage} className="w-8 h-8 flex items-center justify-center bg-snow border-[3px] border-navy rounded-xl hover:bg-cloud transition-colors" aria-label="Close">
                <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* preview */}
              <div className="w-full aspect-square max-w-xs mx-auto border-[4px] border-navy rounded-2xl overflow-hidden bg-cloud">
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
                  className="flex-1 bg-transparent border-[3px] border-navy px-4 py-3 rounded-xl font-display font-bold text-xs text-navy uppercase tracking-[0.08em] hover:bg-navy hover:text-lime transition-all"
                >
                  Cancel
                </button>
                {selectedFile && (
                  <button
                    onClick={confirmImageUpload}
                    disabled={uploadingImage}
                    className="flex-1 bg-lime border-[4px] border-navy shadow-[5px_5px_0_0_#0F0F2D] px-4 py-3 rounded-xl font-display font-black text-xs text-navy uppercase tracking-[0.08em] hover:shadow-[7px_7px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {uploadingImage ? (
                      <><div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />Uploading...</>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
