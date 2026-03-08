"use client";

import Sidebar from "@/components/dashboard/Sidebar";
import MobileNav from "@/components/dashboard/MobileNav";
import { useAuth } from "@/context/AuthContext";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { DMProvider } from "@/context/DMContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSSE } from "@/hooks/useSSE";
import { isExternalStudent, isRouteAllowedForExternal } from "@/lib/studentAccess";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isExpanded } = useSidebar();
  useSSE();

  return (
    <div className="min-h-screen bg-ghost">
      <Sidebar />
      <main
        id="main-content"
        className={`min-h-screen relative pb-20 md:pb-0 transition-all duration-300 md:ml-[72px] ${
          isExpanded ? "lg:ml-[260px]" : ""
        }`}
      >
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 -z-10 bg-dots opacity-30 pointer-events-none" />
        {children}
      </main>
      <MobileNav />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Redirect external students from restricted routes
  useEffect(() => {
    if (loading || !user || !userProfile) return;
    if (isExternalStudent(userProfile.department) && !isRouteAllowedForExternal(pathname)) {
      router.replace("/dashboard");
    }
  }, [loading, user, userProfile, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ghost">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-navy border-t-transparent mx-auto"></div>
          <p className="font-display font-bold text-xs text-slate uppercase tracking-wider">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <DMProvider>
        <DashboardContent>{children}</DashboardContent>
      </DMProvider>
    </SidebarProvider>
  );
}
