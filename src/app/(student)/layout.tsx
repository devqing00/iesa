"use client";

import Sidebar from "@/components/dashboard/Sidebar";
import MobileNav from "@/components/dashboard/MobileNav";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

// Hydration helper
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getSnapshot,
    getServerSnapshot
  );
  useTheme(); // Initialize theme
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-text-primary border-t-transparent mx-auto"></div>
          <p className="text-label-sm text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar />
      <main className="flex-1 min-h-screen relative pb-20 md:pb-0">
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 -z-10 bg-dot-grid opacity-30 pointer-events-none" />
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
