"use client";

import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSSE } from "@/hooks/useSSE";

function AdminContent({ children }: { children: React.ReactNode }) {
  const { isExpanded } = useSidebar();
  useSSE();

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
  const { permissions, loading: permissionsLoading } = usePermissions();
  const router = useRouter();

  // User has admin access if their role is admin/exco OR they have any permissions from roles
  const hasAdminAccess = userProfile && (
    userProfile.role === "admin" ||
    userProfile.role === "exco" ||
    permissions.length > 0
  );

  useEffect(() => {
    if (loading || permissionsLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }
    // Redirect users with no admin access
    if (userProfile && !hasAdminAccess) {
      router.push("/dashboard");
    }
  }, [user, userProfile, loading, permissionsLoading, hasAdminAccess, router]);

  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ghost">
        <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-navy border-t-transparent"></div>
      </div>
    );
  }

  if (!user) return null;

  // Block access for users without admin access while redirect is pending
  if (userProfile && !hasAdminAccess) {
    return null;
  }

  return (
    <SidebarProvider>
      <AdminContent>{children}</AdminContent>
    </SidebarProvider>
  );
}
