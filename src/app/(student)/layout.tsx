"use client";

import Sidebar from "@/components/dashboard/Sidebar";
import MobileNav from "@/components/dashboard/MobileNav";
import AutoPushEnrollment from "@/components/dashboard/AutoPushEnrollment";
import FloatingToolPopup from "@/components/ui/FloatingToolPopup";
import FullScreenLoader from "@/components/ui/FullScreenLoader";
import { useAuth } from "@/context/AuthContext";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { DMProvider } from "@/context/DMContext";
import { FloatingToolProvider } from "@/context/FloatingToolContext";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { useSSE } from "@/hooks/useSSE";
import { isExternalStudent, isRouteAllowedForExternal } from "@/lib/studentAccess";
import { buildAuthRedirect, pathWithQuery } from "@/lib/authRedirect";

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
        <AutoPushEnrollment />
        {children}
      </main>
      <MobileNav />
      <FloatingToolPopup />
    </div>
  );
}

function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!loading && !user) {
      const targetPath = pathWithQuery(pathname, searchParams?.toString());
      router.replace(buildAuthRedirect("/login", targetPath));
    }
  }, [user, loading, pathname, searchParams, router]);

  // Redirect external students from restricted routes
  useEffect(() => {
    if (loading || !user || !userProfile) return;
    if (isExternalStudent(userProfile.department) && !isRouteAllowedForExternal(pathname)) {
      router.replace("/dashboard");
    }
  }, [loading, user, userProfile, pathname, router]);

  if (loading) {
    return <FullScreenLoader size="sm" label="Loading..." />;
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <DMProvider>
        <FloatingToolProvider>
          <DashboardContent>{children}</DashboardContent>
        </FloatingToolProvider>
      </DMProvider>
    </SidebarProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<FullScreenLoader size="sm" label="Loading..." />}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  );
}
