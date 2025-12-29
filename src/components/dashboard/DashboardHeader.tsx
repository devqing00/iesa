"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "next-themes";

export default function DashboardHeader({ title }: { title: string }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <header className="w-full px-8 py-6 flex justify-between items-center border-b border-foreground/5 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
      <h1 className="text-2xl font-bold font-heading text-foreground">{title}</h1>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-full hover:bg-foreground/5 transition-colors text-foreground/60 hover:text-foreground"
        >
          {theme === "dark" ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-foreground/10">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-foreground">{user?.email?.split('@')[0] || 'Student'}</p>
            <p className="text-xs text-foreground/50">Engineering Student</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
            {user?.email?.[0].toUpperCase() || 'S'}
          </div>
        </div>
      </div>
    </header>
  );
}
