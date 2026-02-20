"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";

interface SidebarContextType {
  isExpanded: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isExpanded: false,
  toggleSidebar: () => {},
  closeSidebar: () => {},
});

const LG_BREAKPOINT = 1024;

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();

  const toggleSidebar = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsExpanded(false);
  }, []);

  // Set initial state based on screen width (SSR-safe)
  useEffect(() => {
    const isLg = window.innerWidth >= LG_BREAKPOINT;
    setIsExpanded(isLg);
  }, []); // runs once on mount

  // Auto-close on route change — only on mobile/tablet (< lg)
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < LG_BREAKPOINT) {
      setIsExpanded(false);
    }
  }, [pathname]);

  return (
    <SidebarContext.Provider value={{ isExpanded, toggleSidebar, closeSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
