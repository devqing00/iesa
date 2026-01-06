"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Award, GraduationCap } from "lucide-react";

export default function TeamNav() {
  const pathname = usePathname();
  const links = [
    { name: "Central Excos", href: "/dashboard/team/central", icon: Award },
    {
      name: "Committee Heads",
      href: "/dashboard/team/committees",
      icon: Users,
    },
    {
      name: "Class Reps",
      href: "/dashboard/team/class-reps",
      icon: GraduationCap,
    },
  ];
  return (
    <nav className="-mx-3 md:mx-0 px-3 md:px-0 mb-6 md:mb-8">
      <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-shrink-0 flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all active:scale-95 ${
                isActive
                  ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/30"
                  : "bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] text-foreground/60 hover:text-foreground hover:border-primary/30 hover:shadow-md"
              }`}
            >
              <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="whitespace-nowrap">{link.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
