"use client";

import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import { useAuth } from "@/context/AuthContext";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function AdminContent({ children }: { children: React.ReactNode }) {
  const { isExpanded } = useSidebar();

  return (
    <div className="min-h-screen bg-ghost">
      <AdminSidebar />
      <main
        id="main-content"
        className={`min-h-screen bg-ghost relative pb-20 md:pb-0 transition-all duration-300 md:ml-[72px] ${
          isExpanded ? "lg:ml-[260px]" : ""
        }`}
      >
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 -z-10 bg-dots opacity-20 pointer-events-none" />
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
      <AdminMobileNav />
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    // Redirect non-admin users
    if (!loading && user && userProfile && userProfile.role !== "admin" && userProfile.role !== "exco") {
      router.push("/dashboard");
    }
  }, [user, userProfile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ghost">
        <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-navy border-t-transparent"></div>
      </div>
    );
  }

  if (!user) return null;

  // Block access for non-admin/exco users while redirect is pending
  if (userProfile && userProfile.role !== "admin" && userProfile.role !== "exco") {
    return null;
  }

  return (
    <SidebarProvider>
      <AdminContent>{children}</AdminContent>
    </SidebarProvider>
  );
}
