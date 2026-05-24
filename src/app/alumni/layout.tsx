"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { isAlumni } from "@/lib/studentAccess";
import { buildAuthRedirect, pathWithQuery } from "@/lib/authRedirect";
import FullScreenLoader from "@/components/ui/FullScreenLoader";
import SignOutConfirmModal from "@/components/ui/SignOutConfirmModal";

/* ─── Alumni Sidebar ────────────────────────────────────────────── */

function AlumniSidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { isExpanded, toggleSidebar, closeSidebar } = useSidebar();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const navLinks = [
    {
      name: "Overview",
      href: "/alumni/dashboard",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6ZM15.75 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3h-2.25ZM6 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3H6ZM15.75 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3h-2.25Z" />
        </svg>
      ),
    },
    {
      name: "Directory",
      href: "/alumni/directory",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Mentorship",
      href: "/alumni/mentorship",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  const handleConfirmSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      setShowSignOutConfirm(false);
    }
  };

  return (
    <>
      <aside
        className={`hidden md:flex md:flex-col fixed left-0 top-0 h-screen z-40 bg-snow border-r-[4px] border-navy transition-all duration-300 ease-in-out ${
          isExpanded ? "w-[260px]" : "w-[72px]"
        }`}
      >
        {/* Logo Area */}
        <div className="p-4 pb-3 flex items-center gap-3">
          <Link href="/alumni/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center overflow-hidden">
              <Image src="/assets/images/logo.svg" alt="IESA Logo" width={28} height={28} className="object-contain" />
            </div>
            {isExpanded && (
              <div className="min-w-0 overflow-hidden">
                <h1 className="font-display font-black text-lg text-navy leading-tight">IESA</h1>
                <p className="text-[10px] font-bold text-slate tracking-wide uppercase">Alumni Portal</p>
              </div>
            )}
          </Link>
        </div>

        {/* Collapse/Expand Toggle */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-[14px] top-[54px] w-7 h-7 rounded-full bg-snow border-[3px] border-navy flex items-center justify-center press-2 press-black hover:bg-ghost transition-all z-50"
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <svg className={`w-3.5 h-3.5 text-navy transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Navigation */}
        <nav aria-label="Dashboard navigation" className="flex-1 overflow-y-auto px-2.5 space-y-2 mt-4">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                title={!isExpanded ? link.name : undefined}
                className={`flex items-center gap-3 rounded-xl transition-all text-sm ${
                  isExpanded ? "px-3 py-2.5" : "justify-center px-2 py-2.5"
                } ${
                  isActive
                    ? "bg-lime text-navy font-bold border-[3px] border-navy shadow-[3px_3px_0_0_#000]"
                    : "text-navy/50 hover:bg-ghost hover:text-navy font-medium"
                }`}
              >
                <span className={isActive ? "text-navy" : ""}>{link.icon}</span>
                {isExpanded && <span className="truncate">{link.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="p-2.5 mt-auto">
          <button
            onClick={() => setShowSignOutConfirm(true)}
            title={!isExpanded ? "Sign Out" : undefined}
            className={`w-full flex items-center gap-3 rounded-xl text-coral hover:bg-coral-light border-[2px] border-transparent hover:border-coral transition-all text-sm font-bold ${
              isExpanded ? "px-3 py-2.5" : "justify-center px-2 py-2.5"
            }`}
          >
            <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9a.75.75 0 0 1-1.5 0V5.25a1.5 1.5 0 0 0-1.5-1.5h-6Zm10.72 4.72a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H9a.75.75 0 0 1 0-1.5h10.94l-1.72-1.72a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
            {isExpanded && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      <SignOutConfirmModal
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={handleConfirmSignOut}
        isLoading={signingOut}
      />

      {/* Overlay backdrop */}
      {isExpanded && (
        <div className="hidden md:block lg:hidden fixed inset-0 bg-navy/30 z-35 transition-opacity" onClick={closeSidebar} aria-hidden="true" />
      )}
    </>
  );
}

/* ─── Layout Wrapper ───────────────────────────────────────────── */

function AlumniContent({ children }: { children: React.ReactNode }) {
  const { isExpanded } = useSidebar();

  return (
    <div className="min-h-screen bg-ghost">
      <AlumniSidebar />
      <main
        className={`min-h-screen relative pb-20 md:pb-0 transition-all duration-300 md:ml-[72px] ${
          isExpanded ? "lg:ml-[260px]" : ""
        }`}
      >
        <div className="absolute inset-0 -z-10 bg-dots opacity-30 pointer-events-none" />
        {children}
      </main>
      
      {/* Basic Mobile Bottom Nav for Alumni */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-snow border-t-[3px] border-navy px-4 py-2 flex items-center justify-around pb-safe">
        <Link href="/alumni/dashboard" className="p-3 text-navy hover:text-lime">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6ZM15.75 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3h-2.25ZM6 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3H6ZM15.75 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3h-2.25Z" />
          </svg>
        </Link>
        <Link href="/alumni/directory" className="p-3 text-navy hover:text-lime">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
          </svg>
        </Link>
        <Link href="/alumni/mentorship" className="p-3 text-navy hover:text-lime">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clipRule="evenodd" />
          </svg>
        </Link>
      </nav>
    </div>
  );
}

function AlumniLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && !user) {
      const targetPath = pathWithQuery(pathname, searchParams?.toString());
      router.replace(buildAuthRedirect("/login", targetPath));
    }
  }, [user, loading, pathname, searchParams, router]);

  useEffect(() => {
    if (loading || !user || !userProfile) return;
    
    if (!isAlumni(userProfile.currentLevel)) {
      router.replace("/dashboard");
    }
  }, [loading, user, userProfile, router]);

  if (loading || !user) return <FullScreenLoader size="sm" label="Loading..." />;

  return (
    <SidebarProvider>
      <AlumniContent>{children}</AlumniContent>
    </SidebarProvider>
  );
}

export default function AlumniLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<FullScreenLoader size="sm" label="Loading..." />}>
      <AlumniLayoutInner>{children}</AlumniLayoutInner>
    </Suspense>
  );
}
