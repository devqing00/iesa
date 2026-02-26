"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/dashboard/NotificationBell";
import GlobalSearch from "@/components/dashboard/GlobalSearch";
import UrgentBar from "@/components/dashboard/UrgentBar";
import { getTimeGreeting } from "@/lib/greeting";

export default function DashboardHeader({ title = "Dashboard" }: { title?: string }) {
  const { userProfile } = useAuth();

  return (
    <div className="sticky top-0 z-30">
      <div className="bg-snow border-b-[3px] border-navy px-4 md:px-6 lg:px-8 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">{title}</p>
            <h1 className="font-display font-black text-xl sm:text-2xl text-navy">
              {getTimeGreeting()}{userProfile?.firstName ? `, ${userProfile.firstName}` : ""}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <GlobalSearch />
          <NotificationBell />
          {userProfile && (
            <Link
              href="/dashboard/profile"
              className="hidden sm:flex items-center gap-3 pl-4 border-l-[3px] border-navy/10 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-xl bg-lavender-light border-[3px] border-navy flex items-center justify-center overflow-hidden">
                {userProfile.profilePictureUrl ? (
                  <img
                    src={userProfile.profilePictureUrl}
                    alt={`${userProfile.firstName} ${userProfile.lastName}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-navy font-black text-xs">
                    {userProfile.firstName?.[0]}{userProfile.lastName?.[0]}
                  </span>
                )}
              </div>
              <div>
                <p className="font-bold text-sm text-navy">{userProfile.firstName} {userProfile.lastName}</p>
                <p className="text-xs text-slate font-medium">
                  {(userProfile.level || userProfile.currentLevel) ? `${userProfile.level || userProfile.currentLevel} Level` : "Student"}
                </p>
              </div>
            </Link>
          )}
        </div>
      </div>
      </div>
      <UrgentBar />
    </div>
  );
}
