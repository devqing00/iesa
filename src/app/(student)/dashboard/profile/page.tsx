"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/api";

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
  const { user } = useAuth();
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

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        setFetchLoading(true);
        const token = await user.getIdToken();
        const response = await fetch(getApiUrl("/api/users/me"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }

        const data = await response.json();
        setProfileData(data);

        setFormData({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          phone: data.phone || "",
          bio: data.bio || "",
          personalEmail: data.personalEmail || "",
        });
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Failed to load profile data");
      } finally {
        setFetchLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const token = await user.getIdToken();
      const response = await fetch(getApiUrl("/api/users/me"), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
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
      console.error("Error updating profile:", err);
      const message =
        err instanceof Error ? err.message : "Failed to update profile";
      setError(message);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image size must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      setSelectedFile(file);
      setShowImageModal(true);
    };
    reader.readAsDataURL(file);
  };

  const confirmImageUpload = async () => {
    if (!selectedFile || !user) return;

    setUploadingImage(true);
    setError("");

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(getApiUrl("/api/users/me/profile-picture"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to upload image");
      }

      const updatedData = await response.json();
      setProfileData(updatedData);
      setSuccessMessage("Profile picture updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);

      setShowImageModal(false);
      setImagePreview(null);
      setSelectedFile(null);
    } catch (err: unknown) {
      console.error("Error uploading image:", err);
      const message =
        err instanceof Error ? err.message : "Failed to upload image";
      setError(message);
    } finally {
      setUploadingImage(false);
    }
  };

  const cancelImageUpload = () => {
    setShowImageModal(false);
    setImagePreview(null);
    setSelectedFile(null);
  };

  if (fetchLoading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <DashboardHeader title="Profile" />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border border-border-dark border-t-transparent animate-spin mx-auto" />
            <p className="text-label-sm text-text-muted">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <DashboardHeader title="Profile" />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <p className="text-body text-sm text-text-muted">
            Failed to load profile
          </p>
        </div>
      </div>
    );
  }

  const fullName = `${profileData.firstName} ${profileData.lastName}`;
  const initials = `${profileData.firstName?.[0] || ""}${
    profileData.lastName?.[0] || ""
  }`.toUpperCase();

  return (
    <div className="min-h-screen bg-bg-primary">
      <DashboardHeader title="Profile" />

      {/* Messages */}
      {successMessage && (
        <div className="mx-4 md:mx-8 mt-4 p-4 border border-border-dark bg-bg-secondary text-body text-sm text-text-primary">
          <span className="text-label-sm text-text-muted mr-2">✦ Success</span>
          {successMessage}
        </div>
      )}
      {error && (
        <div className="mx-4 md:mx-8 mt-4 p-4 border border-border-dark bg-bg-secondary text-body text-sm text-text-primary">
          <span className="text-label-sm text-text-muted mr-2">✦ Error</span>
          {error}
        </div>
      )}

      <div className="px-4 md:px-8 py-6 pb-24 md:pb-8 max-w-7xl mx-auto space-y-8">
        {/* Profile Header */}
        <section className="border-t border-border pt-8">
          <div className="flex items-center justify-between mb-6">
            <span className="text-label-sm text-text-muted flex items-center gap-2">
              <span>✦</span> Profile Overview
            </span>
            <span className="page-number">Page 01</span>
          </div>

          <div className="border border-border p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <button
                    onClick={() => {
                      if (profileData.profilePictureUrl) {
                        setImagePreview(profileData.profilePictureUrl);
                        setShowImageModal(true);
                      }
                    }}
                    className="group relative block"
                    disabled={!profileData.profilePictureUrl}
                  >
                    {profileData.profilePictureUrl ? (
                      <>
                        <img
                          src={profileData.profilePictureUrl}
                          alt={fullName}
                          className="w-24 h-24 md:w-32 md:h-32 object-cover grayscale hover:grayscale-0 transition-all"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-charcoal/40 dark:bg-cream/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg
                            className="w-6 h-6 text-cream dark:text-charcoal"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </div>
                      </>
                    ) : (
                      <div className="w-24 h-24 md:w-32 md:h-32 bg-charcoal dark:bg-cream flex items-center justify-center text-cream dark:text-charcoal font-display text-3xl md:text-4xl">
                        {initials}
                      </div>
                    )}
                  </button>

                  {/* Upload Button */}
                  <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-charcoal dark:bg-cream flex items-center justify-center cursor-pointer hover:bg-charcoal-light dark:hover:bg-cream-dark transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    {uploadingImage ? (
                      <div className="w-4 h-4 border border-cream dark:border-charcoal border-t-transparent animate-spin" />
                    ) : (
                      <svg
                        className="w-4 h-4 text-cream dark:text-charcoal"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                        />
                      </svg>
                    )}
                  </label>
                </div>
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center md:text-left">
                <h2 className="font-display text-2xl md:text-3xl text-text-primary mb-2">
                  {fullName}
                </h2>
                <p className="text-body text-sm text-text-secondary mb-4">
                  {profileData.institutionalEmail || profileData.email}
                </p>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                  <span className="px-3 py-1 border border-border text-label-sm text-text-secondary">
                    {profileData.currentLevel || "Student"}
                  </span>
                  <span className="px-3 py-1 border border-border text-label-sm text-text-secondary">
                    {profileData.matricNumber || "No Matric"}
                  </span>
                  <span className="px-3 py-1 border border-border text-label-sm text-text-secondary">
                    {profileData.department}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  {profileData.admissionYear && (
                    <div className="text-center md:text-left">
                      <p className="text-label-sm text-text-muted mb-1">
                        Admission
                      </p>
                      <p className="font-display text-lg text-text-primary">
                        {profileData.admissionYear}
                      </p>
                    </div>
                  )}
                  <div className="text-center md:text-left">
                    <p className="text-label-sm text-text-muted mb-1">
                      Member Since
                    </p>
                    <p className="font-display text-lg text-text-primary">
                      {new Date(profileData.createdAt).toLocaleDateString(
                        "en-US",
                        { month: "short", year: "numeric" }
                      )}
                    </p>
                  </div>
                  <div className="text-center md:text-left">
                    <p className="text-label-sm text-text-muted mb-1">Status</p>
                    <p className="font-display text-lg text-text-primary">
                      {profileData.hasCompletedOnboarding
                        ? "Active"
                        : "Pending"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Personal Information & Account Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Personal Information */}
          <section className="lg:col-span-2 border-t border-border pt-8">
            <div className="flex items-center justify-between mb-6">
              <span className="text-label-sm text-text-muted flex items-center gap-2">
                <span>◆</span> Personal Information
              </span>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 text-label-sm text-text-secondary hover:text-text-primary border border-border hover:border-border-dark transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                    />
                  </svg>
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="px-4 py-2 text-label-sm text-text-secondary hover:text-text-primary border border-border hover:border-border-dark transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-4 py-2 text-label-sm bg-charcoal dark:bg-cream text-cream dark:text-charcoal hover:bg-charcoal-light dark:hover:bg-cream-dark transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border border-current border-t-transparent animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="border border-border p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* First Name */}
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={
                      isEditing ? formData.firstName : profileData.firstName
                    }
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    disabled={!isEditing}
                    className={`w-full px-4 py-3 text-body text-sm border transition-colors ${
                      isEditing
                        ? "border-border-dark bg-bg-primary text-text-primary focus:outline-none"
                        : "border-border bg-bg-secondary text-text-secondary cursor-not-allowed"
                    }`}
                  />
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={isEditing ? formData.lastName : profileData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    disabled={!isEditing}
                    className={`w-full px-4 py-3 text-body text-sm border transition-colors ${
                      isEditing
                        ? "border-border-dark bg-bg-primary text-text-primary focus:outline-none"
                        : "border-border bg-bg-secondary text-text-secondary cursor-not-allowed"
                    }`}
                  />
                </div>

                {/* Institutional Email */}
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    Institutional Email
                  </label>
                  <input
                    type="email"
                    value={profileData.institutionalEmail || profileData.email}
                    disabled
                    className="w-full px-4 py-3 text-body text-sm border border-border bg-bg-secondary text-text-muted cursor-not-allowed"
                  />
                </div>

                {/* Personal Email */}
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    Personal Email
                  </label>
                  <input
                    type="email"
                    value={
                      isEditing
                        ? formData.personalEmail
                        : profileData.personalEmail || ""
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        personalEmail: e.target.value,
                      })
                    }
                    disabled={!isEditing}
                    placeholder="your.email@example.com"
                    className={`w-full px-4 py-3 text-body text-sm border transition-colors placeholder:text-text-muted ${
                      isEditing
                        ? "border-border-dark bg-bg-primary text-text-primary focus:outline-none"
                        : "border-border bg-bg-secondary text-text-secondary cursor-not-allowed"
                    }`}
                  />
                </div>

                {/* Matric Number */}
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    Matric Number
                  </label>
                  <input
                    type="text"
                    value={profileData.matricNumber || "Not Set"}
                    disabled
                    className="w-full px-4 py-3 text-body text-sm border border-border bg-bg-secondary text-text-muted cursor-not-allowed"
                  />
                </div>

                {/* Level */}
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    Current Level
                  </label>
                  <input
                    type="text"
                    value={profileData.currentLevel || "Not Set"}
                    disabled
                    className="w-full px-4 py-3 text-body text-sm border border-border bg-bg-secondary text-text-muted cursor-not-allowed"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={isEditing ? formData.phone : profileData.phone || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    disabled={!isEditing}
                    placeholder="+234..."
                    className={`w-full px-4 py-3 text-body text-sm border transition-colors placeholder:text-text-muted ${
                      isEditing
                        ? "border-border-dark bg-bg-primary text-text-primary focus:outline-none"
                        : "border-border bg-bg-secondary text-text-secondary cursor-not-allowed"
                    }`}
                  />
                </div>

                {/* Department */}
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    Department
                  </label>
                  <input
                    type="text"
                    value={profileData.department}
                    disabled
                    className="w-full px-4 py-3 text-body text-sm border border-border bg-bg-secondary text-text-muted cursor-not-allowed"
                  />
                </div>

                {/* Bio */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-label-sm text-text-muted">Bio</label>
                  <textarea
                    value={isEditing ? formData.bio : profileData.bio || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, bio: e.target.value })
                    }
                    disabled={!isEditing}
                    placeholder="Tell us about yourself..."
                    rows={4}
                    maxLength={500}
                    className={`w-full px-4 py-3 text-body text-sm border transition-colors resize-none placeholder:text-text-muted ${
                      isEditing
                        ? "border-border-dark bg-bg-primary text-text-primary focus:outline-none"
                        : "border-border bg-bg-secondary text-text-secondary cursor-not-allowed"
                    }`}
                  />
                  {isEditing && (
                    <p className="text-label-sm text-text-muted text-right">
                      {formData.bio.length}/500
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Account Status */}
          <section className="lg:col-span-1 border-t border-border pt-8">
            <div className="flex items-center justify-between mb-6">
              <span className="text-label-sm text-text-muted flex items-center gap-2">
                <span>✦</span> Account Status
              </span>
              <span className="page-number">Page 02</span>
            </div>

            <div className="border border-border p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-bg-secondary border border-border">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 ${
                        profileData.hasCompletedOnboarding
                          ? "bg-charcoal dark:bg-cream"
                          : "bg-text-muted"
                      }`}
                    />
                    <span className="text-body text-sm text-text-primary">
                      Profile
                    </span>
                  </div>
                  <span className="text-label-sm text-text-secondary">
                    {profileData.hasCompletedOnboarding
                      ? "Complete"
                      : "Incomplete"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-bg-secondary border border-border">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-text-secondary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                      />
                    </svg>
                    <span className="text-body text-sm text-text-primary">
                      Email
                    </span>
                  </div>
                  <span className="text-label-sm text-text-secondary">
                    Verified
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-charcoal/90 dark:bg-cream/90 z-50 flex items-center justify-center p-4">
          <div className="bg-bg-primary border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-bg-primary border-b border-border p-4 md:p-6 flex items-center justify-between">
              <h2 className="font-display text-lg text-text-primary flex items-center gap-2">
                <span>✦</span>
                {selectedFile ? "Preview New Photo" : "Profile Picture"}
              </h2>
              <button
                onClick={cancelImageUpload}
                className="p-2 hover:bg-bg-secondary transition-colors"
                disabled={uploadingImage}
              >
                <svg
                  className="w-5 h-5 text-text-secondary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4 md:p-6">
              <div className="mb-6">
                <div className="relative w-full aspect-square max-w-md mx-auto border border-border overflow-hidden">
                  <img
                    src={imagePreview || profileData.profilePictureUrl || ""}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {selectedFile && (
                <div className="mb-6 p-4 border border-border bg-bg-secondary">
                  <p className="text-body text-sm text-text-primary truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-label-sm text-text-muted mt-1">
                    {(selectedFile.size / 1024).toFixed(1)} KB •{" "}
                    {selectedFile.type}
                  </p>
                </div>
              )}

              <div className="mb-6 p-4 border border-border">
                <p className="text-label-sm text-text-muted">
                  <span className="text-text-secondary">◆ Tip:</span> For best
                  results, use a square image with good lighting. Maximum file
                  size is 2MB.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={cancelImageUpload}
                  disabled={uploadingImage}
                  className="flex-1 px-4 py-3 text-label-sm border border-border text-text-secondary hover:border-border-dark hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                {selectedFile && (
                  <button
                    onClick={confirmImageUpload}
                    disabled={uploadingImage}
                    className="flex-1 px-4 py-3 text-label-sm bg-charcoal dark:bg-cream text-cream dark:text-charcoal hover:bg-charcoal-light dark:hover:bg-cream-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploadingImage ? (
                      <>
                        <div className="w-4 h-4 border border-current border-t-transparent animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                          />
                        </svg>
                        Upload Photo
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
