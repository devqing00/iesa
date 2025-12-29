"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import Image from "next/image";

export default function Header() {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsMenuOpen(false);
    }
  };

  return (
    <header className="relative z-20 w-full px-8 py-8 flex justify-between items-center">
      {/* Logo */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
        <div className="w-10 h-10 relative">
           {theme === "light" ? (
            <Image src="/assets/images/logo.svg" alt="IESA Logo" fill className="object-contain" />
          ) : (
            <Image src="/assets/images/logo-light.svg" alt="IESA Logo" fill className="object-contain" />
          )}
        </div>
        {/* <span className="font-heading font-bold text-xl tracking-tight text-foreground">IESA</span> */}
      </div>

      {/* 2. THE SPLIT PILL NAV */}
      <div className="hidden md:flex items-center bg-background/50 rounded-xl p-1 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-foreground/10 relative">
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="px-5 py-3 backdrop-blur-sm rounded-lg text-xs font-bold text-foreground/80 hover:bg-foreground/5 dark:hover:bg-white/10 transition-all flex items-center gap-2 active:scale-95"
        >
          {/* <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg> */}
          Menu
        </button>
        
        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute top-full left-0 mt-2 w-48 bg-background/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
            <div className="py-1">
              <button onClick={() => scrollToSection('about')} className="w-full text-left px-4 py-2 text-sm hover:bg-foreground/5 transition-colors">About Us</button>
              <button onClick={() => scrollToSection('stats')} className="w-full text-left px-4 py-2 text-sm hover:bg-foreground/5 transition-colors">Statistics</button>
              <button onClick={() => scrollToSection('events')} className="w-full text-left px-4 py-2 text-sm hover:bg-foreground/5 transition-colors">Events</button>
              <button onClick={() => scrollToSection('contact')} className="w-full text-left px-4 py-2 text-sm hover:bg-foreground/5 transition-colors">Contact</button>
            </div>
          </div>
        )}

        <button className="px-5 py-3 backdrop-blur-sm rounded-lg bg-foreground text-background text-xs font-bold shadow-md flex items-center gap-2 ml-1 hover:opacity-90 transition-opacity">
          {/* <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> */}
          Discover Platform
        </button>
      </div>

      {/* Right Action & Theme Toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-3 rounded-xl border border-foreground/10  transition-all text-foreground backdrop-blur-sm"
          aria-label="Toggle Theme"
        >
          {theme === "dark" ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
        </button>

        <button 
          onClick={user ? () => router.push('/dashboard') : signInWithGoogle}
          className="group cursor-pointer flex items-center gap-3 px-5 py-3 rounded-xl border border-foreground/10  transition-all text-sm font-bold backdrop-blur-md text-foreground shadow-sm"
        >
          <div className="w-5 h-5 rounded-xl bg-foreground text-background flex items-center justify-center">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <p className="text-xs">{user ? "Dashboard" : "Student Login"}</p>
        </button>
      </div>
    </header>
  );
}
