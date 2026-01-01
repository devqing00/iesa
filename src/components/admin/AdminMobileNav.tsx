"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

export default function AdminMobileNav() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const adminLinks = [
    {
      name: "Dashboard",
      href: "/admin/dashboard",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      name: "Sessions",
      href: "/admin/sessions",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: "Users",
      href: "/admin/enrollments",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      name: "More",
      href: "#",
      onClick: () => setIsMenuOpen(!isMenuOpen),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-foreground/10 z-50">
        <div className="flex justify-around items-center py-2">
          {adminLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={link.onClick}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-foreground/50 hover:text-foreground"
                }`}
              >
                {link.icon}
                <span className="text-xs font-medium">{link.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsMenuOpen(false)}>
          <div className="absolute bottom-20 left-0 right-0 bg-background border-t border-foreground/10 p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <Link href="/admin/roles" className="block px-4 py-3 rounded-lg hover:bg-foreground/5 transition-colors">
              <span className="font-medium text-sm">Roles</span>
            </Link>
            <Link href="/admin/payments" className="block px-4 py-3 rounded-lg hover:bg-foreground/5 transition-colors">
              <span className="font-medium text-sm">Payments</span>
            </Link>
            <Link href="/admin/events" className="block px-4 py-3 rounded-lg hover:bg-foreground/5 transition-colors">
              <span className="font-medium text-sm">Events</span>
            </Link>
            <Link href="/admin/announcements" className="block px-4 py-3 rounded-lg hover:bg-foreground/5 transition-colors">
              <span className="font-medium text-sm">Announcements</span>
            </Link>
            <button
              onClick={signOut}
              className="w-full text-left px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              <span className="font-medium text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
