"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

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
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Editable form fields
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    bio: "",
    personalEmail: "",
  });

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        setFetchLoading(true);
        const token = await user.getIdToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }

        const data = await response.json();
        setProfileData(data);

        // Initialize form data
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/me`, {
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

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original data
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
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 2MB to stay within Cloudinary free tier)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image size must be less than 2MB');
      return;
    }

    setUploadingImage(true);
    setError("");

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/me/profile-picture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload image');
      }

      const updatedData = await response.json();
      setProfileData(updatedData);
      setSuccessMessage('Profile picture updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Error uploading image:', err);
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <DashboardHeader title="Profile" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen flex flex-col">
        <DashboardHeader title="Profile" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-foreground/60">Failed to load profile</p>
        </div>
      </div>
    );
  }

  const fullName = `${profileData.firstName} ${profileData.lastName}`;
  const initials = `${profileData.firstName?.[0] || ""}${
    profileData.lastName?.[0] || ""
  }`.toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader title="Profile" />

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mx-4 md:mx-8 mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 dark:text-green-400">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="mx-4 md:mx-8 mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Profile Header Card */}
        <div className="bg-background/60 backdrop-blur-xl border border-foreground/5 rounded-2xl p-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar with Upload */}
            <div className="flex-shrink-0 relative group">
              {profileData.profilePictureUrl ? (
                <img
                  src={profileData.profilePictureUrl}
                  alt={fullName}
                  className="w-32 h-32 rounded-full object-cover border-4 border-background shadow-xl"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-5xl border-4 border-background shadow-xl">
                  {initials}
                </div>
              )}
              
              {/* Upload Button Overlay */}
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploadingImage}
                />
                {uploadingImage ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                ) : (
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </label>
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-3xl font-bold font-heading text-foreground mb-2">
                {fullName}
              </h2>
              <p className="text-foreground/60 mb-4">
                {profileData.institutionalEmail || profileData.email}
              </p>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                <div className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                  {profileData.currentLevel || "Student"}
                </div>
                <div className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                  Matric: {profileData.matricNumber || "Not Set"}
                </div>
                <div className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                  {profileData.department}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {profileData.admissionYear && (
                  <div className="text-center md:text-left">
                    <p className="text-xs text-foreground/60 uppercase tracking-wider mb-1">
                      Admission Year
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {profileData.admissionYear}
                    </p>
                  </div>
                )}
                <div className="text-center md:text-left">
                  <p className="text-xs text-foreground/60 uppercase tracking-wider mb-1">
                    Member Since
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {new Date(profileData.createdAt).toLocaleDateString(
                      "en-US",
                      { month: "short", year: "numeric" }
                    )}
                  </p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-xs text-foreground/60 uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      profileData.hasCompletedOnboarding
                        ? "text-green-600 dark:text-green-400"
                        : "text-yellow-600 dark:text-yellow-400"
                    }`}
                  >
                    {profileData.hasCompletedOnboarding ? "Active" : "Pending"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information & Account Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personal Information Form - Takes 2 columns on large screens */}
          <div className="lg:col-span-2">
            <div className="bg-background/60 backdrop-blur-xl border border-foreground/5 rounded-2xl p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold font-heading text-foreground">
                  Personal Information
                </h3>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-6 py-2 rounded-lg font-bold text-sm transition-all bg-foreground/5 text-foreground hover:bg-foreground/10"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancel}
                      disabled={loading}
                      className="px-4 py-2 rounded-lg font-medium text-sm transition-all bg-foreground/5 text-foreground hover:bg-foreground/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="px-6 py-2 rounded-lg font-bold text-sm transition-all bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {loading ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* First Name */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/60 uppercase tracking-wider">
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
                    className={`w-full p-3 rounded-xl border transition-all ${
                      isEditing
                        ? "bg-background border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none"
                        : "bg-foreground/5 border-foreground/5 text-foreground/80 cursor-not-allowed"
                    }`}
                  />
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/60 uppercase tracking-wider">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={isEditing ? formData.lastName : profileData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    disabled={!isEditing}
                    className={`w-full p-3 rounded-xl border transition-all ${
                      isEditing
                        ? "bg-background border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none"
                        : "bg-foreground/5 border-foreground/5 text-foreground/80 cursor-not-allowed"
                    }`}
                  />
                </div>

                {/* Institutional Email (Read-only) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/60 uppercase tracking-wider">
                    Institutional Email
                  </label>
                  <input
                    type="email"
                    value={profileData.institutionalEmail || profileData.email}
                    disabled
                    className="w-full p-3 rounded-xl bg-foreground/5 border border-foreground/5 text-foreground/50 cursor-not-allowed"
                  />
                </div>

                {/* Personal Email */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/60 uppercase tracking-wider">
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
                    className={`w-full p-3 rounded-xl border transition-all ${
                      isEditing
                        ? "bg-background border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none"
                        : "bg-foreground/5 border-foreground/5 text-foreground/80 cursor-not-allowed"
                    }`}
                  />
                </div>

                {/* Matric Number (Read-only) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/60 uppercase tracking-wider">
                    Matric Number
                  </label>
                  <input
                    type="text"
                    value={profileData.matricNumber || "Not Set"}
                    disabled
                    className="w-full p-3 rounded-xl bg-foreground/5 border border-foreground/5 text-foreground/50 cursor-not-allowed"
                  />
                </div>

                {/* Level (Read-only) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/60 uppercase tracking-wider">
                    Current Level
                  </label>
                  <input
                    type="text"
                    value={profileData.currentLevel || "Not Set"}
                    disabled
                    className="w-full p-3 rounded-xl bg-foreground/5 border border-foreground/5 text-foreground/50 cursor-not-allowed"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/60 uppercase tracking-wider">
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
                    className={`w-full p-3 rounded-xl border transition-all ${
                      isEditing
                        ? "bg-background border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none"
                        : "bg-foreground/5 border-foreground/5 text-foreground/80 cursor-not-allowed"
                    }`}
                  />
                </div>

                {/* Department (Read-only) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/60 uppercase tracking-wider">
                    Department
                  </label>
                  <input
                    type="text"
                    value={profileData.department}
                    disabled
                    className="w-full p-3 rounded-xl bg-foreground/5 border border-foreground/5 text-foreground/50 cursor-not-allowed"
                  />
                </div>

                {/* Bio (Full Width) */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-foreground/60 uppercase tracking-wider">
                    Bio
                  </label>
                  <textarea
                    value={isEditing ? formData.bio : profileData.bio || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, bio: e.target.value })
                    }
                    disabled={!isEditing}
                    placeholder="Tell us about yourself..."
                    rows={4}
                    maxLength={500}
                    className={`w-full p-3 rounded-xl border transition-all resize-none ${
                      isEditing
                        ? "bg-background border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none"
                        : "bg-foreground/5 border-foreground/5 text-foreground/80 cursor-not-allowed"
                    }`}
                  />
                  {isEditing && (
                    <p className="text-xs text-foreground/40 text-right">
                      {formData.bio.length}/500 characters
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Account Status - Takes 1 column on large screens */}
            <div className="lg:col-span-1">
              <div className="bg-background/60 backdrop-blur-xl border border-foreground/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold font-heading text-foreground mb-4">
                  Account Status
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-foreground/5 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          profileData.hasCompletedOnboarding
                            ? "bg-green-500"
                            : "bg-yellow-500"
                        }`}
                      />
                      <span className="text-sm font-medium text-foreground">
                        Profile
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        profileData.hasCompletedOnboarding
                          ? "text-green-600 dark:text-green-400"
                          : "text-yellow-600 dark:text-yellow-400"
                      }`}
                    >
                      {profileData.hasCompletedOnboarding
                        ? "Complete"
                        : "Incomplete"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-foreground/5 rounded-xl">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-foreground">
                        Email
                      </span>
                    </div>
                    <span className="text-xs font-bold text-green-600 dark:text-green-400">
                      Verified
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
