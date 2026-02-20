"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const teamLinks = [
  { name: "Central Team", href: "/dashboard/team/central" },
  { name: "Class Reps", href: "/dashboard/team/class-reps" },
  { name: "Committees", href: "/dashboard/team/committees" },
];

export default function TeamNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {teamLinks.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              isActive
                ? "bg-lime text-navy border-[3px] border-navy shadow-[3px_3px_0_0_#0F0F2D]"
                : "bg-snow text-navy/60 border-[3px] border-navy hover:bg-cloud"
            }`}
          >
            {link.name}
          </Link>
        );
      })}
    </div>
  );
}
