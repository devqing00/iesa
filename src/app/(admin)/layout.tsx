"use client";

import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useSSE } from "@/hooks/useSSE";
import { hasAdminAccess as checkAdminAccess } from "@/lib/studentAccess";
import { buildAuthRedirect, pathWithQuery } from "@/lib/authRedirect";

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

        <div className="p-4 md:p-6 lg:p-8 -mt-4">{children}</div>
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
  const { permissions, loading: permissionsLoading, loaded: permissionsLoaded } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // User has admin access if their role is admin/exco OR they have at least one
  // permission that goes beyond basic student-level view/access.
  const userHasAdminAccess = userProfile && checkAdminAccess(userProfile.role, permissions);

  useEffect(() => {
    if (loading || permissionsLoading || !permissionsLoaded) return;

    if (!user) {
      const targetPath = pathWithQuery(pathname, searchParams?.toString());
      router.replace(buildAuthRedirect("/admin/login", targetPath));
      return;
    }
    // Redirect users with no admin access
    if (userProfile && !userHasAdminAccess) {
      router.replace("/dashboard");
    }
  }, [user, userProfile, loading, permissionsLoading, permissionsLoaded, userHasAdminAccess, pathname, searchParams, router]);

  if (loading || permissionsLoading || !permissionsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ghost">
        <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-navy border-t-transparent"></div>
      </div>
    );
  }

  if (!user) return null;

  // Block access for users without admin access while redirect is pending
  if (userProfile && !userHasAdminAccess) {
    return null;
  }

  return (
    <SidebarProvider>
      <AdminContent>{children}</AdminContent>
    </SidebarProvider>
  );
}
