'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  /** Auto-generate from pathname if items not provided */
  auto?: boolean;
  className?: string;
}

/** Route label overrides for auto-generated breadcrumbs */
const LABEL_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  admin: 'Admin',
  announcements: 'Announcements',
  events: 'Events',
  payments: 'Payments',
  profile: 'Profile',
  settings: 'Settings',
  users: 'Users',
  roles: 'Roles',
  sessions: 'Sessions',
  enrollments: 'Enrollments',
  library: 'Library',
  timetable: 'Timetable',

  'growth-hub': 'Growth Hub',
  growth: 'Growth Hub',
  cgpa: 'CGPA Calculator',
  press: 'Press',
  review: 'Review',
  write: 'Write',
  team: 'Team',
  about: 'About',
  contact: 'Contact',
  history: 'History',
};

function labelFromSegment(segment: string): string {
  return (
    LABEL_MAP[segment] ||
    segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];

  // Determine home based on admin vs student
  const isAdmin = segments[0] === 'admin';
  crumbs.push({
    label: isAdmin ? 'Admin' : 'Dashboard',
    href: isAdmin ? '/admin/dashboard' : '/dashboard',
  });

  // Build path incrementally, skipping the 'dashboard' or 'admin' prefix
  let path = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    path += `/${seg}`;

    // Skip 'dashboard' if it's right after 'admin' or at index 0
    if (seg === 'dashboard' && (i === 0 || (i === 1 && segments[0] === 'admin'))) {
      continue;
    }
    // Skip 'admin' at index 0 (already added as home)
    if (seg === 'admin' && i === 0) continue;

    const isLast = i === segments.length - 1;
    crumbs.push({
      label: labelFromSegment(seg),
      href: isLast ? undefined : path,
    });
  }

  return crumbs;
}

export function Breadcrumb({ items, auto = true, className = '' }: BreadcrumbProps) {
  const pathname = usePathname();
  const crumbs = items || (auto ? generateBreadcrumbs(pathname) : []);

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1.5 flex-wrap">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <svg
                  className="w-3.5 h-3.5 text-slate/40 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
              {isLast || !crumb.href ? (
                <span className="font-display font-bold text-xs uppercase tracking-wider text-navy">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="font-display font-medium text-xs uppercase tracking-wider text-slate hover:text-navy transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
