"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "next-themes";
import Image from "next/image";
import { useState } from "react";

export default function ProfilePage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mock State for Profile Data
  const [profileData, setProfileData] = useState({
    matricNumber: "219082",
    level: "400L",
    phone: "08123456789",
    department: "Industrial & Production Engineering",
    bio: "Passionate about optimization and systems thinking.",
  });

  const handleSave = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader title="Profile" />

      <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Left Column: ID Card Preview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-background/60 backdrop-blur-xl border border-foreground/5 rounded-2xl p-6 text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-linear-to-b from-primary/5 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <div className="w-32 h-32 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-5xl mb-4 border-4 border-background shadow-xl">
                {user?.email?.[0].toUpperCase() || "S"}
              </div>
              <h2 className="text-xl font-bold font-heading text-foreground">
                {user?.displayName || "Student Name"}
              </h2>
              <p className="text-sm text-foreground/60 mb-4">{user?.email}</p>

              <div className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/20">
                {profileData.level} • {profileData.matricNumber || "No Matric"}
              </div>
            </div>
          </div>

          {/* ID Card Visualization */}
          <div className="bg-linear-to-br from-primary to-[#0f2e1b] rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden aspect-[1.58/1]">
            {/* Decorative Circles */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />

            <div className="relative z-10 h-full flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold font-heading text-lg tracking-wider">
                    IESA
                  </h3>
                  <p className="text-[10px] opacity-80 uppercase tracking-widest">
                    Student Identity
                  </p>
                </div>
                <div className="flex flex-row gap-2">
                  <div className="w-8 h-8 relative">
                    {theme === "light" ? (
                      <Image
                        src="/assets/images/logo.svg"
                        alt="IESA Logo"
                        fill
                        className="object-contain"
                      />
                    ) : (
                      <Image
                        src="/assets/images/logo-light.svg"
                        alt="IESA Logo"
                        fill
                        className="object-contain"
                      />
                    )}
                  </div>
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.131A8 8 0 008 8m0 0a8 8 0 00-8 8c0 2.472.345 4.865.99 7.131M8 8a8 8 0 008 8m0 0a8 8 0 01-8 8m8-8c0-2.472-.345-4.865-.99-7.131"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 items-end">
                <div className="w-16 h-16 bg-white/20 rounded-lg backdrop-blur-sm" />
                <div>
                  <p className="text-xs opacity-70 uppercase">Name</p>
                  <p className="font-bold text-sm truncate max-w-[150px]">
                    {user?.displayName || "Student"}
                  </p>
                  <p className="text-xs opacity-70 uppercase mt-2">Matric No</p>
                  <p className="font-mono font-bold text-sm">
                    {profileData.matricNumber}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Form */}
        <div className="lg:col-span-2">
          <div className="bg-background/60 backdrop-blur-xl border border-foreground/5 rounded-2xl p-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold font-heading text-foreground">
                Personal Information
              </h3>
              <button
                onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
                disabled={loading}
                className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                  isEditing
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "bg-foreground/5 text-foreground hover:bg-foreground/10"
                }`}
              >
                {loading
                  ? "Saving..."
                  : isEditing
                  ? "Save Changes"
                  : "Edit Profile"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label
                  htmlFor="fullName"
                  className="text-xs font-bold text-foreground/60 uppercase tracking-wider"
                >
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={user?.displayName || ""}
                  disabled
                  className="w-full p-3 rounded-xl bg-foreground/5 border border-foreground/5 text-foreground/50 cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-xs font-bold text-foreground/60 uppercase tracking-wider"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full p-3 rounded-xl bg-foreground/5 border border-foreground/5 text-foreground/50 cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="matricNumber"
                  className="text-xs font-bold text-foreground/60 uppercase tracking-wider"
                >
                  Matric Number
                </label>
                <input
                  id="matricNumber"
                  type="text"
                  value={profileData.matricNumber}
                  onChange={(e) =>
                    setProfileData({
                      ...profileData,
                      matricNumber: e.target.value,
                    })
                  }
                  disabled={!isEditing}
                  className={`w-full p-3 rounded-xl border transition-all ${
                    isEditing
                      ? "bg-background border-primary/50 focus:ring-2 focus:ring-primary/20"
                      : "bg-foreground/5 border-foreground/5 text-foreground/80"
                  }`}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="level"
                  className="text-xs font-bold text-foreground/60 uppercase tracking-wider"
                >
                  Level
                </label>
                <select
                  id="level"
                  value={profileData.level}
                  onChange={(e) =>
                    setProfileData({ ...profileData, level: e.target.value })
                  }
                  disabled={!isEditing}
                  className={`w-full p-3 rounded-xl border transition-all ${
                    isEditing
                      ? "bg-background border-primary/50 focus:ring-2 focus:ring-primary/20"
                      : "bg-foreground/5 border-foreground/5 text-foreground/80"
                  }`}
                >
                  {["100L", "200L", "300L", "400L", "500L"].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="phone"
                  className="text-xs font-bold text-foreground/60 uppercase tracking-wider"
                >
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) =>
                    setProfileData({ ...profileData, phone: e.target.value })
                  }
                  disabled={!isEditing}
                  className={`w-full p-3 rounded-xl border transition-all ${
                    isEditing
                      ? "bg-background border-primary/50 focus:ring-2 focus:ring-primary/20"
                      : "bg-foreground/5 border-foreground/5 text-foreground/80"
                  }`}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="department"
                  className="text-xs font-bold text-foreground/60 uppercase tracking-wider"
                >
                  Department
                </label>
                <input
                  id="department"
                  type="text"
                  value={profileData.department}
                  disabled
                  className="w-full p-3 rounded-xl bg-foreground/5 border border-foreground/5 text-foreground/50 cursor-not-allowed"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label
                  htmlFor="bio"
                  className="text-xs font-bold text-foreground/60 uppercase tracking-wider"
                >
                  Bio
                </label>
                <textarea
                  id="bio"
                  rows={4}
                  value={profileData.bio}
                  onChange={(e) =>
                    setProfileData({ ...profileData, bio: e.target.value })
                  }
                  disabled={!isEditing}
                  className={`w-full p-3 rounded-xl border transition-all resize-none ${
                    isEditing
                      ? "bg-background border-primary/50 focus:ring-2 focus:ring-primary/20"
                      : "bg-foreground/5 border-foreground/5 text-foreground/80"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
