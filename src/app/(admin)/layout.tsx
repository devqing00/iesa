"use client";

import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 min-h-screen bg-background/50 relative pb-20 md:pb-0">
        {/* Background Pattern for Admin */}
        <div className="absolute inset-0 -z-10 opacity-[0.03]" 
             style={{ 
               backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', 
               backgroundSize: '20px 20px' 
             }}>
        </div>
        
        {children}
      </main>
      <AdminMobileNav />
    </div>
  );
}
