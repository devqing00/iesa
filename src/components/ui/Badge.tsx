'use client';

import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline' | 'lime' | 'lavender' | 'coral' | 'teal' | 'sunny';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-cloud text-navy/60',
  success: 'bg-teal-light text-teal-dark',
  warning: 'bg-sunny-light text-sunny',
  error: 'bg-coral-light text-coral',
  info: 'bg-lavender-light text-lavender',
  outline: 'bg-transparent border-[3px] border-navy text-navy/60',
  lime: 'bg-lime-light text-teal',
  lavender: 'bg-lavender-light text-lavender',
  coral: 'bg-coral-light text-coral',
  teal: 'bg-teal-light text-teal-dark',
  sunny: 'bg-sunny-light text-sunny',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2.5 py-0.5 text-[10px]',
  md: 'px-3 py-1 text-xs',
};

export function Badge({
  variant = 'default',
  size = 'md',
  icon,
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 
        font-bold rounded-full
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

export interface StatusBadgeProps {
  status: boolean;
  trueLabel?: string;
  falseLabel?: string;
  size?: BadgeSize;
  className?: string;
}

export function StatusBadge({
  status,
  trueLabel = 'Active',
  falseLabel = 'Inactive',
  size = 'md',
  className = '',
}: StatusBadgeProps) {
  return (
    <Badge
      variant={status ? 'success' : 'default'}
      size={size}
      className={className}
      icon={
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            status ? 'bg-teal' : 'bg-slate'
          }`}
        />
      }
    >
      {status ? trueLabel : falseLabel}
    </Badge>
  );
}

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface PriorityBadgeProps {
  priority: Priority;
  size?: BadgeSize;
  className?: string;
}

const priorityConfig: Record<Priority, { variant: BadgeVariant; label: string }> = {
  low: { variant: 'default', label: 'Low' },
  normal: { variant: 'info', label: 'Normal' },
  high: { variant: 'warning', label: 'High' },
  urgent: { variant: 'error', label: 'Urgent' },
};

export function PriorityBadge({ priority, size = 'sm', className = '' }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  return (
    <Badge variant={config.variant} size={size} className={className}>
      {config.label}
    </Badge>
  );
}

export interface LevelBadgeProps {
  level: number | string;
  size?: BadgeSize;
  className?: string;
}

export function LevelBadge({ level, size = 'sm', className = '' }: LevelBadgeProps) {
  const levelStr = typeof level === 'number' ? `${level}L` : level;
  return (
    <Badge variant="outline" size={size} className={className}>
      {levelStr}
    </Badge>
  );
}

export interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: 'default' | 'success' | 'error';
  className?: string;
}

export function CountBadge({
  count,
  max = 99,
  variant = 'error',
  className = '',
}: CountBadgeProps) {
  if (count === 0) return null;

  const displayCount = count > max ? `${max}+` : count;

  return (
    <span
      className={`
        inline-flex items-center justify-center
        min-w-4.5 h-4.5 px-1
        text-[10px] font-semibold text-white
        rounded-full
        ${variant === 'success' ? 'bg-teal' : variant === 'error' ? 'bg-coral' : 'bg-slate'}
        ${className}
      `}
    >
      {displayCount}
    </span>
  );
}
