"use client";

import Sidebar from "@/components/dashboard/Sidebar";
import MobileNav from "@/components/dashboard/MobileNav";
import { useAuth } from "@/context/AuthContext";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isExpanded } = useSidebar();

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
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

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
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  );
}
