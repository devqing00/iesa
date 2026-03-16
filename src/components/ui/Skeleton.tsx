'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-cloud rounded-xl animate-shimmer ${className}`} aria-hidden="true" />
  );
}

export function SkeletonText({ width = 'w-full', className = '' }: { width?: string; className?: string }) {
  return <Skeleton className={`h-4 rounded ${width} ${className}`} />;
}

export function SkeletonHeading({ level = 1, className = '' }: { level?: 1 | 2 | 3; className?: string }) {
  const heights = { 1: 'h-8', 2: 'h-6', 3: 'h-5' };
  return <Skeleton className={`${heights[level]} rounded w-3/4 ${className}`} />;
}

export function SkeletonAvatar({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };
  return <Skeleton className={`rounded-full ${sizes[size]} ${className}`} />;
}

export function SkeletonButton({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'h-8 w-20', md: 'h-10 w-24', lg: 'h-12 w-32' };
  return <Skeleton className={`rounded-2xl ${sizes[size]} ${className}`} />;
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`card p-6 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-8 rounded" />
      </div>
      <SkeletonHeading level={3} />
      <div className="space-y-2">
        <SkeletonText />
        <SkeletonText width="w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonStatCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`card p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-8 w-16 rounded" />
        </div>
        <SkeletonAvatar size="sm" />
      </div>
    </div>
  );
}

export function SkeletonTableRow({ columns = 4, className = '' }: { columns?: number; className?: string }) {
  return (
    <tr className={className}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <SkeletonText width={i === 0 ? 'w-32' : 'w-20'} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5, columns = 4, className = '' }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div className={`card p-0 overflow-hidden ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-navy">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} scope="col" className="px-4 py-3 text-left">
                <Skeleton className="h-3 w-16 rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonList({ items = 3, className = '' }: { items?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonAvatar size="sm" />
          <div className="flex-1 space-y-2">
            <SkeletonText width="w-1/2" />
            <SkeletonText width="w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage({ className = '' }: SkeletonProps) {
  return (
    <div className={`space-y-8 ${className}`}>
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-8 w-48 rounded" />
        </div>
        <SkeletonButton />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SkeletonTable />
        </div>
        <div>
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

/* ─── Dashboard Skeletons ──────────────────────────────────────── */

/**
 * Full-page shimmer skeleton for the admin dashboard.
 * Mimics the stat cards → chart row → activity list layout.
 */
export function AdminDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-ghost" aria-hidden="true">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-9 w-64 rounded-2xl" />
          </div>
          <Skeleton className="h-10 w-32 rounded-2xl" />
        </div>

        {/* Hero row — large greeting card + stat */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 bg-cloud rounded-[2rem] border-[3px] border-cloud h-[230px] animate-shimmer" />
          <div className="lg:col-span-4 bg-cloud rounded-[2rem] border-[3px] border-cloud h-[230px] animate-shimmer" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-snow border-[3px] border-cloud rounded-3xl p-6 space-y-3">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-8 w-16 rounded" />
            </div>
          ))}
        </div>

        {/* Chart + activity row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 bg-snow border-[3px] border-cloud rounded-3xl p-6">
            <Skeleton className="h-4 w-40 rounded mb-4" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-5 bg-snow border-[3px] border-cloud rounded-3xl p-6 space-y-4">
            <Skeleton className="h-4 w-36 rounded" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4 rounded" />
                  <Skeleton className="h-2.5 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Full-page shimmer skeleton for the student dashboard.
 * Mimics the greeting → schedule → announcements → sidebar layout.
 */
export function StudentDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-ghost" aria-hidden="true">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-5">
        {/* Hero row — greeting + classes counter */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 bg-cloud rounded-[2rem] border-[3px] border-cloud h-[230px] animate-shimmer" />
          <div className="lg:col-span-4 bg-cloud rounded-[2rem] border-[3px] border-cloud h-[230px] animate-shimmer" />
        </div>

        {/* Main content row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left column — schedule + announcements */}
          <div className="lg:col-span-8 space-y-4">
            {/* Schedule skeleton */}
            <div className="bg-snow border-[3px] border-cloud rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <Skeleton className="h-5 w-40 rounded" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border-[3px] border-cloud">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-24 rounded" />
                      <Skeleton className="h-2.5 w-32 rounded" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                ))}
              </div>
            </div>

            {/* Announcements skeleton */}
            <div className="bg-snow border-[3px] border-cloud rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <Skeleton className="h-5 w-36 rounded" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border-[2px] border-cloud">
                    <Skeleton className="w-8 h-6 rounded" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4 rounded" />
                      <Skeleton className="h-2.5 w-1/3 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — dues + events */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-snow border-[3px] border-cloud rounded-3xl p-6 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-4 w-28 rounded" />
              </div>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-cloud rounded-2xl p-4 space-y-2">
                  <Skeleton className="h-2.5 w-20 rounded" />
                  <Skeleton className="h-6 w-24 rounded" />
                </div>
              ))}
            </div>
            <div className="bg-snow border-[3px] border-cloud rounded-3xl p-6 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-4 w-24 rounded" />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-cloud">
                  <Skeleton className="w-11 h-11 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4 rounded" />
                    <Skeleton className="h-2.5 w-1/2 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
