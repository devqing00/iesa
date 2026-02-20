"use client";

import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/dashboard/NotificationBell";

export default function DashboardHeader({ title = "Dashboard" }: { title?: string }) {
  const { userProfile } = useAuth();

  return (
    <div className="bg-snow border-b-[3px] border-navy px-4 md:px-6 lg:px-8 py-4 sticky top-0 z-30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">{title}</p>
            <h1 className="font-display font-black text-xl sm:text-2xl text-navy">
              Welcome back{userProfile?.firstName ? `, ${userProfile.firstName}` : ""}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          {userProfile && (
            <div className="hidden sm:flex items-center gap-3 pl-4 border-l-[3px] border-navy/10">
              <div className="w-10 h-10 rounded-xl bg-lavender-light border-[3px] border-navy flex items-center justify-center">
                <span className="text-navy font-black text-xs">
                  {userProfile.firstName?.[0]}{userProfile.lastName?.[0]}
                </span>
              </div>
              <div>
                <p className="font-bold text-sm text-navy">{userProfile.firstName} {userProfile.lastName}</p>
                <p className="text-xs text-slate font-medium">
                  {(userProfile.level || userProfile.currentLevel) ? `${userProfile.level || userProfile.currentLevel} Level` : "Student"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
