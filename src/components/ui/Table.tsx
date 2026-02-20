'use client';

import React from 'react';

export interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`card p-0 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">{children}</table>
      </div>
    </div>
  );
}

export function TableSimple({ children, className = '' }: TableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">{children}</table>
    </div>
  );
}

export function TableHeader({ children, className = '' }: TableProps) {
  return (
    <thead className={`border-b-[3px] border-navy ${className}`}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '' }: TableProps) {
  return <tbody className={className}>{children}</tbody>;
}

export function TableFooter({ children, className = '' }: TableProps) {
  return (
    <tfoot className={`border-t-[3px] border-navy bg-cloud ${className}`}>
      {children}
    </tfoot>
  );
}

export interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  hoverable?: boolean;
}

export function TableRow({ 
  children, 
  className = '', 
  onClick,
  selected = false,
  hoverable = true,
}: TableRowProps) {
  return (
    <tr
      className={`
        border-b-[3px] border-navy last:border-b-0
        ${hoverable ? 'hover:bg-cloud transition-colors' : ''}
        ${selected ? 'bg-lime-light' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export interface TableHeadProps {
  children?: React.ReactNode;
  className?: string;
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | null;
  onSort?: () => void;
  align?: 'left' | 'center' | 'right';
}

export function TableHead({ 
  children, 
  className = '',
  sortable = false,
  sorted = null,
  onSort,
  align = 'left',
}: TableHeadProps) {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <th
      scope="col"
      className={`
        px-4 py-3 font-display font-bold text-xs uppercase tracking-wider text-slate font-medium
        ${alignClasses[align]}
        ${sortable ? 'cursor-pointer select-none hover:text-navy transition-colors' : ''}
        ${className}
      `}
      onClick={sortable ? onSort : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && (
          <span className="text-[10px]">
            {sorted === 'asc' && '↑'}
            {sorted === 'desc' && '↓'}
            {!sorted && '↕'}
          </span>
        )}
      </span>
    </th>
  );
}

export interface TableCellProps {
  children?: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  truncate?: boolean;
}

export function TableCell({ 
  children, 
  className = '',
  align = 'left',
  truncate = false,
}: TableCellProps) {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <td
      className={`
        px-4 py-3 text-sm text-navy
        ${alignClasses[align]}
        ${truncate ? 'max-w-xs truncate' : ''}
        ${className}
      `}
    >
      {children}
    </td>
  );
}

export function TableEmptyState({ 
  message = 'No data available',
  colSpan = 1,
}: { 
  message?: string;
  colSpan?: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <svg className="w-8 h-8 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
          </svg>
          <p className="text-sm text-slate">{message}</p>
        </div>
      </td>
    </tr>
  );
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  className = '',
}: PaginationProps) {
  const pages = React.useMemo(() => {
    const result: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) result.push(i);
    } else {
      result.push(1);
      if (currentPage > 3) result.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        result.push(i);
      }
      if (currentPage < totalPages - 2) result.push('ellipsis');
      result.push(totalPages);
    }
    return result;
  }, [currentPage, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-center gap-1 ${className}`}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-sm text-navy/60 hover:text-navy disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        ← Prev
      </button>
      {pages.map((page, i) => (
        page === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-slate">...</span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`
              w-8 h-8 text-sm rounded-xl transition-colors
              ${currentPage === page 
                ? 'bg-lime text-navy font-semibold' 
                : 'text-navy/60 hover:text-navy hover:bg-cloud'
              }
            `}
          >
            {page}
          </button>
        )
      ))}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 text-sm text-navy/60 hover:text-navy disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Next →
      </button>
    </div>
  );
}

export interface PaginatedTableProps extends TableProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginatedTable({
  children,
  className = '',
  currentPage,
  totalPages,
  onPageChange,
}: PaginatedTableProps) {
  return (
    <div className={className}>
      <Table>{children}</Table>
      <div className="mt-4">
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
      </div>
    </div>
  );
}
