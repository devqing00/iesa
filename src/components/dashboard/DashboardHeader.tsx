"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "next-themes";
import { SessionDisplay } from "./SessionDisplay";
import Image from "next/image";

export default function DashboardHeader({ title }: { title: string }) {
  const { user, userProfile } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <header className="w-full px-4 md:px-8 py-4 md:py-6 flex justify-between items-center border-b border-foreground/5 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
      <h1 className="text-lg md:text-2xl font-bold font-heading text-foreground truncate max-w-[40%] md:max-w-none">{title}</h1>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Session Display - Hidden on mobile, shows on md+ screens */}
        <div className="hidden md:block">
          <SessionDisplay />
        </div>
        
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-full hover:bg-foreground/5 transition-colors text-foreground/60 hover:text-foreground"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
        </button>

        <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-foreground/10">
          <div className="text-right hidden lg:block">
            <p className="text-sm font-bold text-foreground">
              {userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user?.email?.split('@')[0] || 'Student'}
            </p>
            <p className="text-xs text-foreground/50">
              {userProfile?.role === 'admin' ? 'Administrator' : 
               userProfile?.role === 'exco' ? 'Executive' : 
               'Engineering Student'}
            </p>
          </div>
          {userProfile?.profilePictureUrl ? (
            <Image 
              src={userProfile.profilePictureUrl} 
              alt={userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'User'}
              width={40}
              height={40}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border-2 border-primary/20"
            />
          ) : (
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base md:text-lg">
              {userProfile?.firstName?.[0]?.toUpperCase() || user?.email?.[0].toUpperCase() || 'S'}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
