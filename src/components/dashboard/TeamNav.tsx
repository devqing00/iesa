"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TeamNav() {
  const pathname = usePathname();
  const links = [
    { name: "Central Excos", href: "/dashboard/team/central" },
    { name: "Committee Heads", href: "/dashboard/team/committees" },
    { name: "Class Reps", href: "/dashboard/team/class-reps" },
  ];
  return (
    <nav className="flex gap-2 md:gap-4 flex-wrap mb-6">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
            pathname === link.href
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
          }`}
        >
          {link.name}
        </Link>
      ))}
    </nav>
  );
}
