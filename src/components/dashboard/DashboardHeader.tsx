"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "next-themes";
import { SessionDisplay } from "./SessionDisplay";
import Image from "next/image";

export default function DashboardHeader({ title }: { title: string }) {
  const { user, userProfile } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <header className="w-full px-4 md:px-8 py-4 flex justify-between items-center border-b border-border bg-bg-primary sticky top-0 z-10">
      {/* Title */}
      <div className="space-y-0.5">
        <span className="text-label-sm text-text-muted hidden md:flex items-center gap-2">
          <span>✦</span> Dashboard
        </span>
        <h1 className="font-display text-xl md:text-2xl">{title}</h1>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Session Display - Hidden on mobile */}
        <div className="hidden md:block">
          <SessionDisplay />
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 hover:bg-bg-secondary transition-colors text-text-muted hover:text-text-primary"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
              />
            </svg>
          )}
        </button>

        {/* User Info */}
        <div className="flex items-center gap-3 pl-3 md:pl-4 border-l border-border">
          <div className="text-right hidden lg:block">
            <p className="text-body text-sm font-medium text-text-primary">
              {userProfile
                ? `${userProfile.firstName} ${userProfile.lastName}`
                : user?.email?.split("@")[0] || "Student"}
            </p>
            <p className="text-label-sm text-text-muted">
              {userProfile?.role === "admin"
                ? "Administrator"
                : userProfile?.role === "exco"
                ? "Executive"
                : "Engineering Student"}
            </p>
          </div>
          {userProfile?.profilePictureUrl ? (
            <Image
              src={userProfile.profilePictureUrl}
              alt={
                userProfile
                  ? `${userProfile.firstName} ${userProfile.lastName}`
                  : "User"
              }
              width={40}
              height={40}
              className="w-8 h-8 md:w-10 md:h-10 object-cover border border-border"
            />
          ) : (
            <div className="w-8 h-8 md:w-10 md:h-10 bg-charcoal dark:bg-cream text-cream dark:text-charcoal flex items-center justify-center font-display text-sm md:text-base">
              {userProfile?.firstName?.[0]?.toUpperCase() ||
                user?.email?.[0].toUpperCase() ||
                "S"}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
