'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-cloud rounded-xl animate-pulse ${className}`} aria-hidden="true" />
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
